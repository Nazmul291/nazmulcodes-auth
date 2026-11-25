import type { CentralUser } from "@prisma/client";
import { redirect } from "@remix-run/node";
import { db } from "~/lib/db.server";
import { createSealedCookie } from "./cookie.server";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days
const PENDING_2FA_TTL_SECONDS = 60 * 5; // 5 minutes to enter the code

/** Stateless, encrypted end-user session. */
interface UserSessionPayload {
  uid: string;
  /** Must equal CentralUser.sessionVersion, bumping it revokes all sessions. */
  sv: number;
  /** True when the user passed (or did not need) the TOTP challenge. */
  mfa: boolean;
  iat: number;
}

/** Issued after the first factor when 2FA is required. NOT an authenticated session. */
export interface Pending2faPayload {
  uid: string;
  sv: number;
  returnTo: string;
  method: "password" | "google";
}

const userCookie = createSealedCookie<UserSessionPayload>("nc_session", "cookie:user-session", SESSION_TTL_SECONDS);
const pendingCookie = createSealedCookie<Pending2faPayload>("nc_2fa", "cookie:pending-2fa", PENDING_2FA_TTL_SECONDS);

export type PublicUser = Pick<
  CentralUser,
  "id" | "email" | "name" | "avatarUrl" | "twoFactorEnabled" | "emailVerified" | "status"
> & { hasPassword: boolean; hasGoogle: boolean };

export function toPublicUser(u: CentralUser): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatarUrl,
    twoFactorEnabled: u.twoFactorEnabled,
    emailVerified: u.emailVerified,
    status: u.status,
    hasPassword: Boolean(u.passwordHash),
    hasGoogle: Boolean(u.googleId),
  };
}

/** Returns the fully-authenticated user (incl. 2FA) or null. */
export async function getUser(request: Request): Promise<CentralUser | null> {
  const payload = userCookie.read(request);
  if (!payload) return null;
  const user = await db.centralUser.findUnique({ where: { id: payload.uid } });
  if (!user || user.status !== "ACTIVE" || user.sessionVersion !== payload.sv) return null;
  if (user.twoFactorEnabled && !payload.mfa) return null;
  return user;
}

export async function requireUser(request: Request): Promise<CentralUser> {
  const user = await getUser(request);
  if (!user) {
    const url = new URL(request.url);
    const returnTo = url.pathname + url.search;
    throw redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`, {
      headers: { "Set-Cookie": userCookie.destroy() },
    });
  }
  return user;
}

export function commitUserSession(user: Pick<CentralUser, "id" | "sessionVersion">, mfa: boolean): string {
  return userCookie.commit({ uid: user.id, sv: user.sessionVersion, mfa, iat: Date.now() });
}

export function destroyUserSession(): string {
  return userCookie.destroy();
}

// ─── Pending 2FA ─────────────────────────────────────────────────────────────

export function commitPending2fa(payload: Pending2faPayload): string {
  return pendingCookie.commit(payload);
}

export function readPending2fa(request: Request): Pending2faPayload | null {
  return pendingCookie.read(request);
}

export function destroyPending2fa(): string {
  return pendingCookie.destroy();
}

/**
 * Completes the first factor. Either issues a full session, or (if 2FA is
 * enabled) a short-lived pending cookie and sends the user to /login/2fa.
 */
export async function completeFirstFactor(
  user: CentralUser,
  returnTo: string,
  method: Pending2faPayload["method"],
): Promise<{ location: string; cookies: string[] }> {
  if (user.twoFactorEnabled) {
    return {
      location: "/login/2fa",
      cookies: [commitPending2fa({ uid: user.id, sv: user.sessionVersion, returnTo, method }), userCookie.destroy()],
    };
  }
  await db.centralUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return { location: returnTo, cookies: [commitUserSession(user, false), pendingCookie.destroy()] };
}

export function withCookies(cookies: string[], init: ResponseInit = {}): ResponseInit {
  const headers = new Headers(init.headers);
  for (const c of cookies) headers.append("Set-Cookie", c);
  return { ...init, headers };
}
