import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { env } from "~/lib/env.server";

/**
 * Every use of MASTER_ENCRYPTION_KEY goes through a purpose-bound HKDF subkey,
 * so a ciphertext sealed for one purpose (e.g. a session cookie) can never be
 * replayed as another (e.g. a 2FA secret).
 */
export type KeyPurpose =
  | "field:totp-secret"
  | "cookie:user-session"
  | "cookie:admin-session"
  | "cookie:pending-2fa"
  | "cookie:google-oauth"
  | "cookie:flash";

const VERSION = "v1";
const masterKey = Buffer.from(env.MASTER_ENCRYPTION_KEY, "hex");
const subkeys = new Map<KeyPurpose, Buffer>();

function subkey(purpose: KeyPurpose): Buffer {
  let key = subkeys.get(purpose);
  if (!key) {
    key = Buffer.from(hkdfSync("sha256", masterKey, "nazmulcodes-auth/hkdf/v1", purpose, 32));
    subkeys.set(purpose, key);
  }
  return key;
}

/** AES-256-GCM. Output: `v1.<iv>.<tag>.<ciphertext>` (base64url). */
export function encrypt(plaintext: string, purpose: KeyPurpose): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", subkey(purpose), iv);
  cipher.setAAD(Buffer.from(purpose));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

/** Returns null if the payload was tampered with, truncated or sealed for another purpose. */
export function tryDecrypt(sealed: string, purpose: KeyPurpose): string | null {
  try {
    const [version, ivB64, tagB64, ctB64] = sealed.split(".");
    if (version !== VERSION || !ivB64 || !tagB64 || ctB64 === undefined) return null;
    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", subkey(purpose), iv);
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function decrypt(sealed: string, purpose: KeyPurpose): string {
  const value = tryDecrypt(sealed, purpose);
  if (value === null) throw new Error(`Failed to decrypt value for purpose "${purpose}"`);
  return value;
}

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Constant-time string comparison. Both sides are hashed first so that
 * differing lengths do not leak through an early return.
 */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a, "utf8").digest();
  const hb = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(ha, hb);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function randomHex(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}
