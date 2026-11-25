import fs from "node:fs";
import path from "node:path";
import { parse as parseDotenv } from "dotenv";
import { z } from "zod";

const BCRYPT_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url().startsWith("postgres", "DATABASE_URL must be a PostgreSQL URL"),
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

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(repairExpandedValues(process.env));
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
