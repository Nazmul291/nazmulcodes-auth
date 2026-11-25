import { randomInt } from "node:crypto";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { db } from "~/lib/db.server";
import { decrypt, encrypt, safeEqual, sha256Hex } from "./crypto.server";

const ISSUER = "NazmulCodes";
const STEP_SECONDS = 30;
/** Accept the previous, current and next 30s step (±30s clock drift). */
const WINDOW = 1;
export const BACKUP_CODE_COUNT = 8;

export function currentTimeStep(now = Date.now()): number {
  return Math.floor(now / 1000 / STEP_SECONDS);
}

/**
 * Constant-time TOTP verification. Every step in the window is generated and
 * compared with `timingSafeEqual` (no early exit), and the matching time-step
 * is returned so callers can reject replays of an already-used code.
 */
export function verifyTotp(secret: string, token: string, now = Date.now()): number | null {
  const normalized = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) {
    safeEqual("000000", "000001"); // keep timing uniform
    return null;
  }
  const step = currentTimeStep(now);
  let matched: number | null = null;
  for (let offset = -WINDOW; offset <= WINDOW; offset++) {
    const expected = authenticator.clone({ epoch: now + offset * STEP_SECONDS * 1000 }).generate(secret);
    if (safeEqual(expected, normalized) && matched === null) matched = step + offset;
  }
  return matched;
}

export function generateTotpSecret(): string {
  return authenticator.generateSecret(20); // 160-bit, RFC 4226 recommended
}

export async function buildTotpEnrollment(email: string, secret: string) {
  const otpauthUrl = authenticator.keyuri(email, ISSUER, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
    color: { dark: "#0a0a0a", light: "#fafafa" },
  });
  return { otpauthUrl, qrDataUrl, manualKey: secret.match(/.{1,4}/g)?.join(" ") ?? secret };
}

// ─── Backup codes ────────────────────────────────────────────────────────────

const BACKUP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o/1/l/i

export function normalizeBackupCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function generateBackupCode(): string {
  let raw = "";
  for (let i = 0; i < 10; i++) raw += BACKUP_ALPHABET[randomInt(BACKUP_ALPHABET.length)];
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

/** Replaces all backup codes. Returns the plaintext codes — show them ONCE. */
export async function regenerateBackupCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: BACKUP_CODE_COUNT }, generateBackupCode);
  await db.$transaction([
    db.backupCode.deleteMany({ where: { userId } }),
    db.backupCode.createMany({
      data: codes.map((c) => ({ userId, codeHash: sha256Hex(normalizeBackupCode(c)) })),
    }),
  ]);
  return codes;
}

/** Atomically consumes a backup code. Returns true if it was valid & unused. */
export async function consumeBackupCode(userId: string, code: string): Promise<boolean> {
  const normalized = normalizeBackupCode(code);
  if (normalized.length !== 10) return false;
  const { count } = await db.backupCode.updateMany({
    where: { userId, codeHash: sha256Hex(normalized), usedAt: null },
    data: { usedAt: new Date() },
  });
  return count === 1;
}

export async function remainingBackupCodes(userId: string): Promise<number> {
  return db.backupCode.count({ where: { userId, usedAt: null } });
}

// ─── User 2FA lifecycle ──────────────────────────────────────────────────────

export async function startTwoFactorSetup(user: { id: string; email: string }) {
  const secret = generateTotpSecret();
  await db.centralUser.update({
    where: { id: user.id },
    data: { twoFactorPendingSecret: encrypt(secret, "field:totp-secret") },
  });
  return buildTotpEnrollment(user.email, secret);
}

export async function confirmTwoFactorSetup(userId: string, code: string): Promise<string[] | null> {
  const user = await db.centralUser.findUniqueOrThrow({ where: { id: userId } });
  if (!user.twoFactorPendingSecret) return null;
  const secret = decrypt(user.twoFactorPendingSecret, "field:totp-secret");
  const step = verifyTotp(secret, code);
  if (step === null) return null;

  const { count } = await db.centralUser.updateMany({
    where: { id: userId, twoFactorPendingSecret: user.twoFactorPendingSecret },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: user.twoFactorPendingSecret,
      twoFactorPendingSecret: null,
      twoFactorLastUsedStep: step,
    },
  });
  if (count !== 1) return null;
  return regenerateBackupCodes(userId);
}

export async function disableTwoFactor(userId: string): Promise<void> {
  await db.$transaction([
    db.backupCode.deleteMany({ where: { userId } }),
    db.centralUser.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorPendingSecret: null,
        twoFactorLastUsedStep: null,
      },
    }),
  ]);
}

export type SecondFactorResult = { ok: true; method: "totp" | "backup_code" } | { ok: false };

/**
 * Verifies a 6-digit TOTP (with replay protection) or a single-use backup code
 * for a user who has 2FA enabled.
 */
export async function verifySecondFactor(userId: string, input: string): Promise<SecondFactorResult> {
  const user = await db.centralUser.findUnique({
    where: { id: userId },
    select: { twoFactorEnabled: true, twoFactorSecret: true, twoFactorLastUsedStep: true },
  });
  if (!user?.twoFactorEnabled || !user.twoFactorSecret) return { ok: false };

  const compact = input.replace(/\s+/g, "");
  if (/^\d{6}$/.test(compact)) {
    const step = verifyTotp(decrypt(user.twoFactorSecret, "field:totp-secret"), compact);
    if (step === null) return { ok: false };
    // Atomic replay guard: only succeeds if this step is newer than the last one used.
    const { count } = await db.centralUser.updateMany({
      where: {
        id: userId,
        OR: [{ twoFactorLastUsedStep: null }, { twoFactorLastUsedStep: { lt: step } }],
      },
      data: { twoFactorLastUsedStep: step },
    });
    return count === 1 ? { ok: true, method: "totp" } : { ok: false };
  }

  return (await consumeBackupCode(userId, compact)) ? { ok: true, method: "backup_code" } : { ok: false };
}
