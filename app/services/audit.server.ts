import type { AuditActorType, Prisma } from "@prisma/client";
import { waitUntil } from "@vercel/functions";
import { db } from "~/lib/db.server";
import { getRequestMeta } from "~/lib/http.server";

export interface AuditEntry {
  actorType: AuditActorType;
  actorId?: string | null;
  action: string;
  success?: boolean;
  request?: Request;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Best-effort audit logging. Never throws and never blocks auth flows for long:
 * if PostgreSQL is down (e.g. during root recovery) the entry goes to stderr.
 *
 * Callers usually fire-and-forget (`void audit(...)`). On Vercel, waitUntil keeps
 * the function alive until the write finishes, so entries are not lost when the
 * response is sent. Elsewhere waitUntil does nothing.
 */
export function audit(entry: AuditEntry): Promise<void> {
  const pending = writeAudit(entry);
  try {
    waitUntil(pending);
  } catch {
    /* not on Vercel */
  }
  return pending;
}

async function writeAudit(entry: AuditEntry): Promise<void> {
  const meta = entry.request ? getRequestMeta(entry.request) : { ip: null, userAgent: null };
  const data = {
    actorType: entry.actorType,
    actorId: entry.actorId ?? null,
    action: entry.action,
    success: entry.success ?? true,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: entry.metadata,
  };
  try {
    await Promise.race([
      db.auditLog.create({ data }),
      // Generous: callers do not wait for this, and on Vercel waitUntil keeps it alive.
      new Promise((_, reject) => setTimeout(() => reject(new Error("audit timeout")), 8000)),
    ]);
  } catch (err) {
    console.warn("[audit] database unavailable, logging to stderr:", JSON.stringify(data), String(err));
  }
}
