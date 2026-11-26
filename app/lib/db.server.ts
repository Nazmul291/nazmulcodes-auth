import { PrismaClient } from "@prisma/client";
import { env, isProduction } from "./env.server";

const globalForPrisma = globalThis as unknown as { __ncPrisma?: PrismaClient };

/**
 * The app connects through the pooled URL when there is one (Vercel's Prisma
 * Postgres integration adds DATABASE_URL_POOLED, host pooled.db.prisma.io,
 * which is PgBouncer in transaction mode). Migrations always use the direct
 * DATABASE_URL (see schema.prisma). Locally there is no pooled URL, so
 * DATABASE_URL is used as is.
 *
 * - `pgbouncer=true`: turns off prepared statements, which transaction-mode
 *   PgBouncer does not support.
 * - On Vercel, `connection_limit=1`: every serverless instance would otherwise
 *   open its own pool of several connections, and many instances together use
 *   up the database's connections (Prisma error P2024, "Timed out fetching a
 *   new connection from the connection pool"). One connection per instance is
 *   Prisma's recommendation for serverless; the pooler does the sharing.
 *   `pool_timeout` gives a busy instance a little longer before failing.
 *
 * Values already present in the URL are never overridden.
 */
function runtimeDatabaseUrl(): string {
  const pooled = Boolean(env.DATABASE_URL_POOLED);
  const raw = env.DATABASE_URL_POOLED ?? env.DATABASE_URL;
  if (!/^postgres(ql)?:\/\//.test(raw)) return raw; // prisma:// URLs manage pooling themselves

  const url = new URL(raw);
  const setDefault = (key: string, value: string) => {
    if (!url.searchParams.has(key)) url.searchParams.set(key, value);
  };
  if (pooled) setDefault("pgbouncer", "true");
  if (env.VERCEL) {
    setDefault("connection_limit", "1");
    setDefault("pool_timeout", "20");
  }
  return url.toString();
}

export const db: PrismaClient =
  globalForPrisma.__ncPrisma ??
  new PrismaClient({
    datasourceUrl: runtimeDatabaseUrl(),
    log: isProduction ? ["error"] : ["warn", "error"],
  });

if (!isProduction) globalForPrisma.__ncPrisma = db;

/** True when PostgreSQL answers within `timeoutMs`. Never throws. */
export async function isDatabaseReachable(timeoutMs = 1500): Promise<boolean> {
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("db timeout")), timeoutMs)),
    ]);
    return true;
  } catch {
    return false;
  }
}
