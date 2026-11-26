import { redirect } from "@remix-run/node";
import bcrypt from "bcryptjs";
import { env } from "~/lib/env.server";
import { audit } from "./audit.server";
import { createSealedCookie } from "./cookie.server";
import { safeEqual, sha256Hex } from "./crypto.server";
import { kv } from "./kv.server";
import { verifyTotp } from "./totp.server";

/**
 * Root Super Admin — 100% database-independent.
 *
 * Credentials live only in environment variables (email, bcrypt hash, TOTP
 * secret), so the owner can always reach /admin/* to recover the platform,
 * even with an empty or unreachable PostgreSQL.
 *
 * Lockout policy: a STRICT maximum of 10 failed attempts (global, not per-IP).
 * The 10th failure locks /root-access (HTTP 423) until the server restarts.
 *
 * The counter lives in the shared KV store (kv.server.ts), never in Postgres:
 * - Locally without Upstash it is in memory, so restarting `npm run dev` unlocks.
 * - On Vercel it is in Upstash Redis, shared by every instance. Keys are scoped
 *   to the deployment, so a redeploy is the "restart" that unlocks. You can
 *   also delete the `nc-auth:root:*` keys in the Upstash console.
 */
export const MAX_ROOT_ATTEMPTS = 10;
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8; // 8h
/** Keeps old deployments' keys from piling up; far longer than any deployment lives. */
// Note: without Upstash on Vercel, the memory fallback is per instance (see kv.server.ts).
const ROOT_KEY_TTL_SECONDS = 60 * 60 * 24 * 90;

const scope = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "local";
const K_FAILURES = `root:${scope}:failures`;
const K_LOCKED = `root:${scope}:locked-at`;
const K_LAST_TOTP_STEP = `root:${scope}:totp-last-step`;
const totpStepKey = (step: number) => `root:${scope}:totp-step:${step}`;

export interface LockoutStatus {
  locked: boolean;
  lockedAt: string | null;
  remaining: number;
}

/** Throws if the KV store is unreachable — callers treat that as "unavailable". */
export async function getLockoutStatus(): Promise<LockoutStatus> {
  const [lockedAt, failures] = await Promise.all([kv.get(K_LOCKED), kv.get(K_FAILURES)]);
  return {
    locked: lockedAt !== null,
    lockedAt,
    remaining: Math.max(0, MAX_ROOT_ATTEMPTS - Number(failures ?? 0)),
  };
}

async function lock() {
  await kv.set(K_LOCKED, new Date().toISOString(), { ttlSeconds: ROOT_KEY_TTL_SECONDS });
}

// ─── Stateless admin session ─────────────────────────────────────────────────

interface AdminSession {
  role: "super_admin";
  email: string;
  /** Binds the session to the current .env credentials: rotating them logs out every admin session. */
  fp: string;
  iat: number;
}

const adminCookie = createSealedCookie<AdminSession>(
  "nc_root",
  "cookie:admin-session",
  ADMIN_SESSION_TTL_SECONDS,
);

function credentialFingerprint(): string {
  return sha256Hex(
    `${env.SUPER_ADMIN_EMAIL}|${env.SUPER_ADMIN_PASSWORD_HASH}|${env.SUPER_ADMIN_TOTP_SECRET}`,
  ).slice(0, 32);
}

export function getSuperAdmin(request: Request): AdminSession | null {
  const session = adminCookie.read(request);
  if (!session || session.role !== "super_admin") return null;
  if (!safeEqual(session.fp, credentialFingerprint())) return null;
  if (!safeEqual(session.email, env.SUPER_ADMIN_EMAIL)) return null;
  return session;
}

/** Route guard for every /admin/* loader & action. */
export function requireSuperAdmin(request: Request): AdminSession {
  const session = getSuperAdmin(request);
  if (!session) throw redirect("/root-access", { headers: { "Set-Cookie": adminCookie.destroy() } });
  return session;
}

export function destroySuperAdminSession(): string {
  return adminCookie.destroy();
}

// ─── Authentication ──────────────────────────────────────────────────────────

export type RootLoginResult =
  | { status: "ok"; setCookie: string }
  | { status: "invalid"; remaining: number; message: string }
  | { status: "locked"; message: string }
  | { status: "unavailable"; message: string };

const LOCKED_MESSAGE =
  "Root access is permanently locked after 10 failed attempts. Restart (redeploy) the server to unlock.";
const UNAVAILABLE_MESSAGE = "Root access is temporarily unavailable. Please try again shortly.";

export async function authenticateRootAdmin(
  request: Request,
  input: { email: string; password: string; totp: string },
): Promise<RootLoginResult> {
  try {
    return await attempt(request, input);
  } catch (err) {
    // Fail closed: if the lockout store cannot be reached, nobody gets in.
    console.error("[root-access] lockout store unavailable:", err);
    void audit({ actorType: "ANONYMOUS", action: "root.login.store_unavailable", success: false, request });
    return { status: "unavailable", message: UNAVAILABLE_MESSAGE };
  }
}

async function attempt(
  request: Request,
  input: { email: string; password: string; totp: string },
): Promise<RootLoginResult> {
  if (await kv.get(K_LOCKED)) {
    void audit({ actorType: "ANONYMOUS", action: "root.login.blocked_locked", success: false, request });
    return { status: "locked", message: LOCKED_MESSAGE };
  }

  // Count the attempt atomically BEFORE the slow bcrypt check, so concurrent
  // requests (even on different instances) can never get more than
  // MAX_ROOT_ATTEMPTS guesses. A successful login clears the counter.
  const { value: attemptNo } = await kv.incr(K_FAILURES, ROOT_KEY_TTL_SECONDS);
  if (attemptNo > MAX_ROOT_ATTEMPTS) {
    await lock();
    return { status: "locked", message: LOCKED_MESSAGE };
  }

  // Evaluate ALL factors every time (no short-circuit) so timing reveals nothing.
  const emailOk = safeEqual(input.email.trim().toLowerCase(), env.SUPER_ADMIN_EMAIL);
  const passwordOk = await bcrypt.compare(input.password, env.SUPER_ADMIN_PASSWORD_HASH);
  const step = verifyTotp(env.SUPER_ADMIN_TOTP_SECRET, input.totp);
  const lastStep = Number((await kv.get(K_LAST_TOTP_STEP)) ?? -1);
  let totpOk = step !== null && step > lastStep;

  if (emailOk && passwordOk && totpOk && step !== null) {
    // Consume this time-step exactly once across all instances (replay guard).
    totpOk = await kv.set(totpStepKey(step), "1", { nx: true, ttlSeconds: 300 });
  }

  if (emailOk && passwordOk && totpOk && step !== null) {
    await Promise.all([
      kv.set(K_LAST_TOTP_STEP, String(step), { ttlSeconds: ROOT_KEY_TTL_SECONDS }),
      kv.del(K_FAILURES),
    ]);
    void audit({ actorType: "SUPER_ADMIN", actorId: env.SUPER_ADMIN_EMAIL, action: "root.login.success", request });
    const session: AdminSession = {
      role: "super_admin",
      email: env.SUPER_ADMIN_EMAIL,
      fp: credentialFingerprint(),
      iat: Date.now(),
    };
    return { status: "ok", setCookie: adminCookie.commit(session) };
  }

  const locked = attemptNo >= MAX_ROOT_ATTEMPTS;
  if (locked) await lock();
  const remaining = Math.max(0, MAX_ROOT_ATTEMPTS - attemptNo);

  void audit({
    actorType: "ANONYMOUS",
    action: locked ? "root.login.locked" : "root.login.failed",
    success: false,
    request,
    metadata: { attempt: attemptNo, remaining },
  });

  if (locked) {
    console.error(`[root-access] 🔒 LOCKED after ${attemptNo} failed attempts at ${new Date().toISOString()}`);
    return { status: "locked", message: LOCKED_MESSAGE };
  }
  return {
    status: "invalid",
    remaining,
    message: `Invalid credentials. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
  };
}
