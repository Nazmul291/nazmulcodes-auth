import { Redis } from "@upstash/redis";
import { env } from "~/lib/env.server";

/**
 * Small key-value store for the root lockout, the root TOTP replay guard and
 * user rate limits.
 *
 * - Upstash Redis (REST) when UPSTASH_REDIS_REST_URL / _TOKEN (or Vercel's
 *   KV_REST_API_URL / _TOKEN) are set: shared by every server instance.
 * - Otherwise, in-process memory (the fallback). Fine for local development and
 *   a single long-running server. On Vercel it still works, but each serverless
 *   instance keeps its own counts and loses them on a cold start, so the
 *   10-attempt root lockout and the rate limits are much weaker. Add Upstash
 *   for full protection.
 *
 * Used for the root lockout, the root TOTP replay guard and user rate limits.
 * Deliberately independent of PostgreSQL.
 */
export interface KvStore {
  readonly backend: "upstash" | "memory";
  /** INCR; the TTL is set only when the key is new (fixed window). */
  incr(key: string, ttlSeconds: number): Promise<{ value: number; ttlSeconds: number }>;
  get(key: string): Promise<string | null>;
  /** SET with optional TTL. With `nx`, returns false if the key already existed. */
  set(key: string, value: string, opts?: { ttlSeconds?: number; nx?: boolean }): Promise<boolean>;
  del(key: string): Promise<void>;
}

const PREFIX = "nc-auth:";

// ─── Upstash ─────────────────────────────────────────────────────────────────

class UpstashStore implements KvStore {
  readonly backend = "upstash" as const;
  private redis: Redis;

  constructor(url: string, token: string) {
    this.redis = new Redis({ url, token, automaticDeserialization: false, retry: { retries: 2 } });
  }

  async incr(key: string, ttlSeconds: number) {
    const k = PREFIX + key;
    const [value, , ttl] = await this.redis
      .multi()
      .incr(k)
      .expire(k, ttlSeconds, "NX")
      .ttl(k)
      .exec<[number, number, number]>();
    return { value, ttlSeconds: ttl > 0 ? ttl : ttlSeconds };
  }

  async get(key: string) {
    const v = await this.redis.get<string>(PREFIX + key);
    return v === null || v === undefined ? null : String(v);
  }

  async set(key: string, value: string, opts: { ttlSeconds?: number; nx?: boolean } = {}) {
    const k = PREFIX + key;
    const result = opts.nx
      ? opts.ttlSeconds
        ? await this.redis.set(k, value, { nx: true, ex: opts.ttlSeconds })
        : await this.redis.set(k, value, { nx: true })
      : opts.ttlSeconds
        ? await this.redis.set(k, value, { ex: opts.ttlSeconds })
        : await this.redis.set(k, value);
    return result !== null;
  }

  async del(key: string) {
    await this.redis.del(PREFIX + key);
  }
}

// ─── Memory ──────────────────────────────────────────────────────────────────

interface Entry {
  value: string;
  expiresAt: number | null;
}

class MemoryStore implements KvStore {
  readonly backend = "memory" as const;
  private map = new Map<string, Entry>();

  private live(key: string): Entry | null {
    const e = this.map.get(key);
    if (!e) return null;
    if (e.expiresAt !== null && e.expiresAt <= Date.now()) {
      this.map.delete(key);
      return null;
    }
    return e;
  }

  private sweep() {
    if (this.map.size < 50_000) return;
    const now = Date.now();
    for (const [k, e] of this.map) if (e.expiresAt !== null && e.expiresAt <= now) this.map.delete(k);
  }

  async incr(key: string, ttlSeconds: number) {
    const e = this.live(key);
    const now = Date.now();
    const entry: Entry = e
      ? { value: String(Number(e.value) + 1), expiresAt: e.expiresAt }
      : { value: "1", expiresAt: now + ttlSeconds * 1000 };
    this.map.set(key, entry);
    this.sweep();
    const ttl = entry.expiresAt === null ? ttlSeconds : Math.max(1, Math.ceil((entry.expiresAt - now) / 1000));
    return { value: Number(entry.value), ttlSeconds: ttl };
  }

  async get(key: string) {
    return this.live(key)?.value ?? null;
  }

  async set(key: string, value: string, opts: { ttlSeconds?: number; nx?: boolean } = {}) {
    if (opts.nx && this.live(key)) return false;
    this.map.set(key, { value, expiresAt: opts.ttlSeconds ? Date.now() + opts.ttlSeconds * 1000 : null });
    this.sweep();
    return true;
  }

  async del(key: string) {
    this.map.delete(key);
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

const g = globalThis as unknown as { __ncKv?: KvStore };

function createStore(): KvStore {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return new UpstashStore(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN);
  }
  if (env.VERCEL) {
    console.warn(
      "[kv] Upstash Redis is not configured; using in-memory fallback. On Vercel each instance " +
        "counts separately, so the root lockout and rate limits are weaker. Add Upstash for Redis to fix this.",
    );
  }
  return new MemoryStore();
}

export const kv: KvStore = (g.__ncKv ??= createStore());
