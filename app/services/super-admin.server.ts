import fs from "node:fs";
import path from "node:path";
import { redirect } from "@remix-run/node";
import bcrypt from "bcryptjs";
import { env } from "~/lib/env.server";
import { audit } from "./audit.server";
import { createSealedCookie } from "./cookie.server";
import { safeEqual, sha256Hex } from "./crypto.server";
import { verifyTotp } from "./totp.server";

/**
 * Root Super Admin — 100% database-independent.
 *
 * Credentials live only in .env (email, bcrypt hash, TOTP secret) so the owner
 * can always reach /admin/* to recover the platform, even with an empty or
 * unreachable PostgreSQL.
 *
 * Lockout policy: a STRICT maximum of 10 failed attempts (global, not per-IP).
 * The 10th failure permanently locks /root-access (HTTP 423) until the server
 * process is restarted. Successful login resets the counter.
 */
export const MAX_ROOT_ATTEMPTS = 10;
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8; // 8h

// ─── Lockout store ───────────────────────────────────────────────────────────

export interface LockoutState {
  failures: number;
  locked: boolean;
  lockedAt: string | null;
}

interface LockoutStore {
  read(): LockoutState;
  write(state: LockoutState): void;
}

const EMPTY: LockoutState = { failures: 0, locked: false, lockedAt: null };

/** Default: survives HMR/module reloads, cleared by a process restart. */
class MemoryLockoutStore implements LockoutStore {
  private state: LockoutState = { ...EMPTY };
  read() {
    return { ...this.state };
  }
  write(state: LockoutState) {
    this.state = { ...state };
  }
}

/**
 * Optional: persists to `.data/root-lockout.json` so the lock also survives
 * restarts/redeploys. Unlock by deleting that file and restarting.
 * Memory remains authoritative if the filesystem is read-only.
 */
class FileLockoutStore implements LockoutStore {
  private memory = new MemoryLockoutStore();
  private file = path.resolve(process.cwd(), ".data/root-lockout.json");
  constructor() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, "utf8")) as LockoutState;
      this.memory.write({ ...EMPTY, ...parsed });
    } catch {
      /* no file yet */
    }
  }
  read() {
    return this.memory.read();
  }
  write(state: LockoutState) {
    this.memory.write(state);
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(state), { mode: 0o600 });
    } catch (err) {
      console.error("[root-access] could not persist lockout file:", err);
    }
  }
}

/** Switch to "file" to make the lockout survive restarts. */
const LOCKOUT_PERSISTENCE = "memory" as "memory" | "file";

interface RootGlobals {
  __ncRootLockout?: LockoutStore;
  __ncRootInFlight?: number;
  __ncRootLastTotpStep?: number;
}
const g = globalThis as unknown as RootGlobals;
const store: LockoutStore = (g.__ncRootLockout ??=
  LOCKOUT_PERSISTENCE === "file" ? new FileLockoutStore() : new MemoryLockoutStore());

export function getLockoutStatus() {
  const state = store.read();
  return {
    locked: state.locked,
    lockedAt: state.lockedAt,
    remaining: Math.max(0, MAX_ROOT_ATTEMPTS - state.failures),
  };
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
  | { status: "busy"; message: string };

const LOCKED_MESSAGE =
  "Root access is permanently locked after 10 failed attempts. Restart the server to unlock.";

export async function authenticateRootAdmin(
  request: Request,
  input: { email: string; password: string; totp: string },
): Promise<RootLoginResult> {
  const before = store.read();
  if (before.locked) {
    void audit({ actorType: "ANONYMOUS", action: "root.login.blocked_locked", success: false, request });
    return { status: "locked", message: LOCKED_MESSAGE };
  }

  // Reserve the attempt BEFORE the slow bcrypt check, so concurrent requests
  // can never squeeze in more than MAX_ROOT_ATTEMPTS guesses.
  const inFlight = g.__ncRootInFlight ?? 0;
  if (before.failures + inFlight >= MAX_ROOT_ATTEMPTS) {
    return { status: "busy", message: "Another login attempt is in progress. Try again in a moment." };
  }
  g.__ncRootInFlight = inFlight + 1;

  try {
    // Evaluate ALL factors every time (no short-circuit) so timing reveals nothing.
    const emailOk = safeEqual(input.email.trim().toLowerCase(), env.SUPER_ADMIN_EMAIL);
    const passwordOk = await bcrypt.compare(input.password, env.SUPER_ADMIN_PASSWORD_HASH);
    const step = verifyTotp(env.SUPER_ADMIN_TOTP_SECRET, input.totp);
    const lastStep = g.__ncRootLastTotpStep ?? -1;
    const totpOk = step !== null && step > lastStep;

    if (emailOk && passwordOk && totpOk) {
      g.__ncRootLastTotpStep = step;
      store.write({ ...EMPTY });
      void audit({ actorType: "SUPER_ADMIN", actorId: env.SUPER_ADMIN_EMAIL, action: "root.login.success", request });
      const session: AdminSession = {
        role: "super_admin",
        email: env.SUPER_ADMIN_EMAIL,
        fp: credentialFingerprint(),
        iat: Date.now(),
      };
      return { status: "ok", setCookie: adminCookie.commit(session) };
    }

    const current = store.read();
    const failures = current.failures + 1;
    const locked = failures >= MAX_ROOT_ATTEMPTS;
    store.write({ failures, locked, lockedAt: locked ? new Date().toISOString() : null });
    const remaining = Math.max(0, MAX_ROOT_ATTEMPTS - failures);

    void audit({
      actorType: "ANONYMOUS",
      action: locked ? "root.login.locked" : "root.login.failed",
      success: false,
      request,
      metadata: { attempt: failures, remaining },
    });

    if (locked) {
      console.error(`[root-access] 🔒 LOCKED after ${failures} failed attempts at ${new Date().toISOString()}`);
      return { status: "locked", message: LOCKED_MESSAGE };
    }
    return {
      status: "invalid",
      remaining,
      message: `Invalid credentials. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
    };
  } finally {
    g.__ncRootInFlight = Math.max(0, (g.__ncRootInFlight ?? 1) - 1);
  }
}
