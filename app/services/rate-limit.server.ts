/**
 * Minimal fixed-window, in-memory rate limiter for end-user auth endpoints.
 * (Root Super Admin uses its own hard-lockout in super-admin.server.ts.)
 * For multi-instance deployments, swap the Map for Redis/KV.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const globalForRl = globalThis as unknown as { __ncRateLimit?: Map<string, Bucket> };
const buckets = (globalForRl.__ncRateLimit ??= new Map());

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowSeconds * 1000 };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (buckets.size > 50_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  return {
    ok: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
  };
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}
