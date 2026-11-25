import { db } from "~/lib/db.server";
import type { ClientAppInput } from "~/lib/validation";
import { randomHex, sha256Hex } from "./crypto.server";

export const API_KEY_PREFIX = "nc_live_";
export const API_KEY_RE = /^nc_live_[0-9a-f]{64}$/;

/** `nc_live_<32 random bytes hex>`. The plaintext is returned once and never stored. */
export function generateApiKey() {
  const key = `${API_KEY_PREFIX}${randomHex(32)}`;
  return { key, hash: sha256Hex(key), prefix: key.slice(0, API_KEY_PREFIX.length + 4) };
}

export const clientAppSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  status: true,
  allowedOrigins: true,
  callbackUrls: true,
  apiKeyPrefix: true,
  apiKeyRotatedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { connections: true } },
} as const;

export async function listClientApps() {
  return db.clientApplication.findMany({ select: clientAppSelect, orderBy: { createdAt: "asc" } });
}

export async function createClientApp(input: ClientAppInput) {
  const { key, hash, prefix } = generateApiKey();
  const app = await db.clientApplication.create({
    data: { ...input, apiKeyHash: hash, apiKeyPrefix: prefix },
    select: clientAppSelect,
  });
  return { app, apiKey: key };
}

export async function updateClientApp(id: string, input: Omit<ClientAppInput, "slug">) {
  return db.clientApplication.update({ where: { id }, data: input, select: clientAppSelect });
}

export async function setClientAppStatus(id: string, status: "ACTIVE" | "SUSPENDED") {
  return db.clientApplication.update({ where: { id }, data: { status }, select: clientAppSelect });
}

/** Immediately invalidates the previous key. */
export async function rotateClientAppKey(id: string) {
  const { key, hash, prefix } = generateApiKey();
  const app = await db.clientApplication.update({
    where: { id },
    data: { apiKeyHash: hash, apiKeyPrefix: prefix, apiKeyRotatedAt: new Date() },
    select: clientAppSelect,
  });
  return { app, apiKey: key };
}

export type ClientAppView = Awaited<ReturnType<typeof listClientApps>>[number];
