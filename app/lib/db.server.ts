import { PrismaClient } from "@prisma/client";
import { env, isProduction } from "./env.server";

const globalForPrisma = globalThis as unknown as { __ncPrisma?: PrismaClient };

export const db: PrismaClient =
  globalForPrisma.__ncPrisma ??
  new PrismaClient({
    datasourceUrl: env.DATABASE_URL,
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
