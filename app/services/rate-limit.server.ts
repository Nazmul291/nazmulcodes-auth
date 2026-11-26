import { kv } from "./kv.server";

/**
 * Fixed-window rate limiter for end-user auth endpoints, stored in the shared
 * KV store so limits hold across serverless instances.
 * (Root Super Admin uses its own hard lockout in super-admin.server.ts.)
 *
 * Fails OPEN: if the store is unreachable, users can still sign in (passwords,
 * 2FA and the root lockout still protect accounts); the error is logged.
 */
export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  try {
    const { value, ttlSeconds } = await kv.incr(`rl:${key}`, windowSeconds);
    return { ok: value <= limit, remaining: Math.max(0, limit - value), retryAfterSeconds: ttlSeconds };
  } catch (err) {
    console.error("[rate-limit] store unavailable, allowing request:", err);
    return { ok: true, remaining: limit, retryAfterSeconds: 0 };
  }
}

export async function resetRateLimit(key: string): Promise<void> {
  try {
    await kv.del(`rl:${key}`);
  } catch (err) {
    console.error("[rate-limit] could not reset:", err);
  }
}
