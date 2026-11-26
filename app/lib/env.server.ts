import fs from "node:fs";
import path from "node:path";
import { parse as parseDotenv } from "dotenv";
import { z } from "zod";

const BCRYPT_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // postgres:// or postgresql://, or Prisma Postgres / Accelerate (prisma+postgres://, prisma://).
  DATABASE_URL: z
    .string()
    .url()
    .regex(/^(postgres(ql)?|prisma(\+postgres)?):\/\//, "DATABASE_URL must be a PostgreSQL or Prisma Postgres URL"),
  MASTER_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "MASTER_ENCRYPTION_KEY must be 32 bytes encoded as 64 hex chars")
    .refine((v) => !/^0+$/.test(v), "MASTER_ENCRYPTION_KEY must not be the all-zero placeholder"),
  SUPER_ADMIN_EMAIL: z.string().trim().toLowerCase().email(),
  SUPER_ADMIN_PASSWORD_HASH: z.string().regex(BCRYPT_RE, "SUPER_ADMIN_PASSWORD_HASH must be a bcrypt hash"),
  SUPER_ADMIN_TOTP_SECRET: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z2-7]{16,}=*$/, "SUPER_ADMIN_TOTP_SECRET must be a Base32 secret (min 16 chars)"),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  APP_BASE_URL: z
    .string()
    .url()
    .transform((v) => v.replace(/\/+$/, "")),
  // Shared store for the root lockout and rate limits. Required on Vercel.
  // Vercel's Upstash integration names them KV_REST_API_URL / KV_REST_API_TOKEN; both are accepted.
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  VERCEL: z.string().optional(),
}).superRefine((v, ctx) => {
  if (Boolean(v.UPSTASH_REDIS_REST_URL) !== Boolean(v.UPSTASH_REDIS_REST_TOKEN)) {
    ctx.addIssue({ code: "custom", path: ["UPSTASH_REDIS_REST_TOKEN"], message: "Set both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, or neither" });
  }
  if (v.VERCEL && !v.UPSTASH_REDIS_REST_URL) {
    ctx.addIssue({
      code: "custom",
      path: ["UPSTASH_REDIS_REST_URL"],
      message: "Required on Vercel: in-memory lockout and rate limits do not work across serverless instances. Add Upstash Redis from the Vercel Marketplace",
    });
  }
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Some dotenv loaders (incl. Vite's, used by `remix vite:dev`) run variable
 * expansion, which silently mangles bcrypt hashes (`$2b$12$…`). If the value
 * in process.env is not a valid hash but the raw `.env` file contains one,
 * prefer the raw, unexpanded file value.
 */
function repairExpandedValues(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const current = source.SUPER_ADMIN_PASSWORD_HASH;
  if (current && BCRYPT_RE.test(current)) return source;
  try {
    const file = path.resolve(process.cwd(), ".env");
    if (!fs.existsSync(file)) return source;
    const raw = parseDotenv(fs.readFileSync(file));
    if (raw.SUPER_ADMIN_PASSWORD_HASH && BCRYPT_RE.test(raw.SUPER_ADMIN_PASSWORD_HASH)) {
      return { ...source, SUPER_ADMIN_PASSWORD_HASH: raw.SUPER_ADMIN_PASSWORD_HASH };
    }
  } catch {
    /* fall through to normal validation error */
  }
  return source;
}

/** Accept Vercel's KV_* names for the Upstash integration. Empty strings count as unset. */
function withAliases(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const pick = (...keys: string[]) => keys.map((k) => source[k]).find((v) => v && v.trim() !== "");
  return {
    ...source,
    UPSTASH_REDIS_REST_URL: pick("UPSTASH_REDIS_REST_URL", "KV_REST_API_URL"),
    UPSTASH_REDIS_REST_TOKEN: pick("UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_TOKEN"),
  };
}

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(withAliases(repairExpandedValues(process.env)));
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`❌ Invalid environment configuration:\n${issues}\n\nSee .env.example.`);
  }
  return Object.freeze(parsed.data);
}

const globalForEnv = globalThis as unknown as { __ncEnv?: Env };
export const env: Env = globalForEnv.__ncEnv ?? (globalForEnv.__ncEnv = loadEnv());

export const isProduction = env.NODE_ENV === "production";
export const isHttps = env.APP_BASE_URL.startsWith("https://");
export const appOrigin = new URL(env.APP_BASE_URL).origin;
