import { z } from "zod";

/** Shared zod schemas (safe to import on client and server). */

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters.")
  .refine((v) => new TextEncoder().encode(v).length <= 72, "Password must be at most 72 bytes.");

export const totpCodeSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app."));

/** Accepts a 6-digit TOTP code or an 8+ char backup code. */
export const secondFactorSchema = z
  .string()
  .trim()
  .min(6, "Enter your 6-digit code or a backup code.")
  .max(32);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required.").max(256),
  returnTo: z.string().optional(),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  email: emailSchema,
  password: passwordSchema,
  returnTo: z.string().optional(),
});

export const rootLoginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254),
  password: z.string().max(256),
  totp: z.string().trim().max(16),
});

const urlList = (kind: "origin" | "url") =>
  z
    .string()
    .default("")
    .transform((raw) =>
      raw
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(
          z
            .string()
            .url(`Each ${kind} must be an absolute URL.`)
            .refine((v) => {
              const u = new URL(v);
              const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
              return u.protocol === "https:" || (u.protocol === "http:" && local);
            }, `Each ${kind} must use https:// (http:// is allowed for localhost only).`)
            .refine((v) => (kind === "origin" ? new URL(v).origin === v.replace(/\/$/, "") : !new URL(v).hash), kind === "origin" ? "Origins must not contain a path (e.g. https://veltrix.app)." : "Callback URLs must not contain a #fragment.")
            .transform((v) => (kind === "origin" ? new URL(v).origin : v)),
        )
        .max(20),
    );

export const clientAppSchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/, "Slug: lowercase letters, numbers and dashes."),
  description: z.string().trim().max(280).optional().transform((v) => v || null),
  allowedOrigins: urlList("origin"),
  callbackUrls: urlList("url").pipe(z.array(z.string()).min(1, "Add at least one callback URL.")),
});

export type ClientAppInput = z.infer<typeof clientAppSchema>;

/** Flatten zod errors into `{ field: message }`. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
