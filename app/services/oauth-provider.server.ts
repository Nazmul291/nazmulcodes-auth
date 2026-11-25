import type { CentralUser, ClientApplication } from "@prisma/client";
import { db } from "~/lib/db.server";
import { apiError } from "~/lib/http.server";
import { API_KEY_RE } from "./client-apps.server";
import { randomToken, sha256Hex } from "./crypto.server";

export const AUTH_CODE_TTL_SECONDS = 60;

/** The user shape returned to client apps (the SDK's `VerifiedCentralUser`). */
export interface VerifiedCentralUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  twoFactorEnabled: boolean;
}

export function toVerifiedUser(u: CentralUser): VerifiedCentralUser {
  return { id: u.id, email: u.email, name: u.name, avatarUrl: u.avatarUrl, twoFactorEnabled: u.twoFactorEnabled };
}

// ─── /authorize ──────────────────────────────────────────────────────────────

export type AuthorizeValidation =
  | { ok: true; app: ClientApplication; redirectUri: string; state: string | null }
  | { ok: false; error: string; description: string };

/**
 * Validates client_id + redirect_uri BEFORE anything else. If either is invalid
 * we must render an error page and NEVER redirect (open-redirect protection).
 */
export async function validateAuthorizeRequest(url: URL): Promise<AuthorizeValidation> {
  const clientId = url.searchParams.get("client_id")?.trim();
  const redirectUri = url.searchParams.get("redirect_uri")?.trim();
  const responseType = url.searchParams.get("response_type") ?? "code";
  const state = url.searchParams.get("state");

  if (!clientId || !redirectUri) {
    return { ok: false, error: "invalid_request", description: "client_id and redirect_uri are required." };
  }
  const app = await db.clientApplication.findFirst({
    where: { OR: [{ slug: clientId.toLowerCase() }, { id: clientId }] },
  });
  if (!app) return { ok: false, error: "unauthorized_client", description: "Unknown client_id." };
  if (app.status !== "ACTIVE") {
    return { ok: false, error: "unauthorized_client", description: `${app.name} is currently suspended.` };
  }
  // Exact string match only — no prefix / wildcard matching.
  if (!app.callbackUrls.includes(redirectUri)) {
    return { ok: false, error: "invalid_request", description: "redirect_uri is not registered for this app." };
  }
  if (responseType !== "code") {
    return { ok: false, error: "unsupported_response_type", description: "Only response_type=code is supported." };
  }
  if (state !== null && state.length > 1024) {
    return { ok: false, error: "invalid_request", description: "state is too long." };
  }
  return { ok: true, app, redirectUri, state };
}

export function buildRedirect(redirectUri: string, params: Record<string, string | null>): string {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v !== null) url.searchParams.set(k, v);
  return url.toString();
}

/** Issues a single-use, 60-second authorization code. Only its SHA-256 is stored. */
export async function issueAuthorizationCode(userId: string, clientAppId: string, redirectUri: string) {
  const code = randomToken(32);
  await db.authorizationCode.create({
    data: {
      codeHash: sha256Hex(code),
      userId,
      clientAppId,
      redirectUri,
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_SECONDS * 1000),
    },
  });
  // Opportunistic cleanup of stale codes (~5% of requests).
  if (Math.random() < 0.05) {
    void db.authorizationCode
      .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } } })
      .catch(() => undefined);
  }
  return code;
}

// ─── Server-to-server API authentication ─────────────────────────────────────

export type ClientAuthResult = { ok: true; app: ClientApplication; corsHeaders: HeadersInit } | { ok: false; response: Response };

/**
 * Authenticates `Authorization: Bearer nc_live_…`. If the request carries an
 * Origin header (i.e. it came from a browser), it must be in allowedOrigins.
 */
export async function authenticateClientApp(request: Request): Promise<ClientAuthResult> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  const key = match?.[1];
  if (!key || !API_KEY_RE.test(key)) {
    return {
      ok: false,
      response: apiError(401, "invalid_client", "Missing or malformed API key.", { "WWW-Authenticate": "Bearer" }),
    };
  }
  const app = await db.clientApplication.findUnique({ where: { apiKeyHash: sha256Hex(key) } });
  if (!app) {
    return { ok: false, response: apiError(401, "invalid_client", "Invalid API key.", { "WWW-Authenticate": "Bearer" }) };
  }
  if (app.status !== "ACTIVE") {
    return { ok: false, response: apiError(403, "client_suspended", `${app.name} is suspended.`) };
  }

  const origin = request.headers.get("origin");
  let corsHeaders: HeadersInit = {};
  if (origin) {
    if (!app.allowedOrigins.includes(origin)) {
      return { ok: false, response: apiError(403, "origin_not_allowed", "Origin is not allowed for this app.") };
    }
    corsHeaders = { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
  }
  return { ok: true, app, corsHeaders };
}

// ─── /api/v1/token ───────────────────────────────────────────────────────────

export type ExchangeResult =
  | { ok: true; user: VerifiedCentralUser }
  | { ok: false; status: number; error: string; message: string };

export async function exchangeAuthorizationCode(
  app: ClientApplication,
  code: string,
  redirectUri: string | null,
): Promise<ExchangeResult> {
  const codeHash = sha256Hex(code);
  const now = new Date();

  // Atomic single-use consumption: only one concurrent request can win.
  const { count } = await db.authorizationCode.updateMany({
    where: { codeHash, clientAppId: app.id, consumedAt: null, expiresAt: { gt: now } },
    data: { consumedAt: now },
  });
  if (count !== 1) {
    return { ok: false, status: 400, error: "invalid_grant", message: "Code is invalid, expired or already used." };
  }

  const record = await db.authorizationCode.findUniqueOrThrow({ where: { codeHash }, include: { user: true } });
  if (redirectUri !== null && redirectUri !== record.redirectUri) {
    return { ok: false, status: 400, error: "invalid_grant", message: "redirect_uri does not match." };
  }
  if (record.user.status !== "ACTIVE") {
    return { ok: false, status: 403, error: "access_denied", message: "User account is suspended." };
  }

  await db.appConnection.upsert({
    where: { userId_clientAppId: { userId: record.userId, clientAppId: app.id } },
    create: { userId: record.userId, clientAppId: app.id },
    update: { lastUsedAt: now },
  });

  return { ok: true, user: toVerifiedUser(record.user) };
}

// ─── /api/v1/verify-user ─────────────────────────────────────────────────────

/**
 * A user is "valid" for an app only if they are ACTIVE and still connected to
 * THAT app — so apps can't probe for users of other apps, and a user revoking
 * an app from /account/security takes effect on the next check.
 */
export async function verifyUserForApp(app: ClientApplication, userId: string) {
  const connection = await db.appConnection.findUnique({
    where: { userId_clientAppId: { userId, clientAppId: app.id } },
    include: { user: true },
  });
  if (!connection || connection.user.status !== "ACTIVE") return { valid: false as const };
  await db.appConnection.update({ where: { id: connection.id }, data: { lastUsedAt: new Date() } });
  return { valid: true as const, user: toVerifiedUser(connection.user) };
}
