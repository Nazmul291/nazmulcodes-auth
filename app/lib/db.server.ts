import { PrismaClient } from "@prisma/client";
import { env, isProduction } from "./env.server";

const globalForPrisma = globalThis as unknown as { __ncPrisma?: PrismaClient };

/**
 * The app connects through the pooled URL when there is one (Vercel's Prisma
 * Postgres integration adds DATABASE_URL_POOLED), because many serverless
 * instances run at once. Migrations always use the direct DATABASE_URL (see
 * schema.prisma). Locally there is no pooled URL, so DATABASE_URL is used.
 *
 * `pgbouncer=true` turns off prepared statements, which transaction-mode
 * poolers do not support. It is harmless with other poolers.
 */
function runtimeDatabaseUrl(): string {
  if (!env.DATABASE_URL_POOLED) return env.DATABASE_URL;
  const url = new URL(env.DATABASE_URL_POOLED);
  if (!url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
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
