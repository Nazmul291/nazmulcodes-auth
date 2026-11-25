import { isHttps } from "~/lib/env.server";
import { encrypt, tryDecrypt, type KeyPurpose } from "./crypto.server";

/**
 * Stateless, AES-256-GCM sealed, HttpOnly cookies. The GCM tag authenticates
 * the payload, so the cookie is both encrypted and tamper-proof.
 *
 * Over HTTPS the `__Host-` prefix is used, which forces Secure + Path=/ and
 * forbids a Domain attribute (the cookie can't be set by subdomains).
 */
export interface SealedCookie<T> {
  readonly name: string;
  read(request: Request): T | null;
  commit(value: T, maxAgeSeconds?: number): string;
  destroy(): string;
}

interface Envelope<T> {
  v: T;
  exp: number; // unix ms
}

function serialize(name: string, value: string, maxAge: number): string {
  const parts = [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (maxAge === 0) parts.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
  if (isHttps) parts.push("Secure");
  return parts.join("; ");
}

function readRaw(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}

export function createSealedCookie<T>(
  baseName: string,
  purpose: KeyPurpose,
  defaultMaxAgeSeconds: number,
): SealedCookie<T> {
  const name = isHttps ? `__Host-${baseName}` : baseName;
  return {
    name,
    read(request) {
      const raw = readRaw(request, name);
      if (!raw || raw.length > 4096) return null;
      const json = tryDecrypt(raw, purpose);
      if (!json) return null;
      try {
        const env = JSON.parse(json) as Envelope<T>;
        if (typeof env.exp !== "number" || env.exp < Date.now()) return null;
        return env.v;
      } catch {
        return null;
      }
    },
    commit(value, maxAgeSeconds = defaultMaxAgeSeconds) {
      const envelope: Envelope<T> = { v: value, exp: Date.now() + maxAgeSeconds * 1000 };
      return serialize(name, encrypt(JSON.stringify(envelope), purpose), maxAgeSeconds);
    },
    destroy() {
      return serialize(name, "", 0);
    },
  };
}
