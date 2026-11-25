import { json } from "@remix-run/node";
import { appOrigin } from "./env.server";

export function getClientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip") ?? request.headers.get("cf-connecting-ip");
}

export function getRequestMeta(request: Request) {
  return {
    ip: getClientIp(request),
    userAgent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
  };
}

/**
 * Defence-in-depth CSRF check for browser form actions (cookies are already
 * SameSite=Lax). Rejects requests whose Origin header is a foreign origin.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (origin && origin !== appOrigin) {
    throw json({ error: "Cross-origin request blocked." }, { status: 403 });
  }
}

/** Only allow internal, path-absolute redirect targets ("/x", never "//x" or "https://x"). */
export function safeReturnTo(value: unknown, fallback = "/account/security"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  try {
    const url = new URL(value, appOrigin);
    if (url.origin !== appOrigin) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

export function apiError(status: number, error: string, message: string, headers?: HeadersInit) {
  return json({ error, message }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function methodNotAllowed() {
  return apiError(405, "method_not_allowed", "Use POST.", { Allow: "POST" });
}
