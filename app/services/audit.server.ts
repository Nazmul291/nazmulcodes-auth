import type { AuditActorType, Prisma } from "@prisma/client";
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
 */
export async function audit(entry: AuditEntry): Promise<void> {
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
      new Promise((_, reject) => setTimeout(() => reject(new Error("audit timeout")), 2000)),
    ]);
  } catch (err) {
    console.warn("[audit] database unavailable, logging to stderr:", JSON.stringify(data), String(err));
  }
}
