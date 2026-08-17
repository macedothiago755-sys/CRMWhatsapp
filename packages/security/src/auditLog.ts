import { getDb, securitySchema } from "@polar/database";

/**
 * Audit log writer — the only path that inserts into security.audit_log.
 * See docs/security/security-architecture.md §6: append-only, no update/delete
 * path exposed at the application layer.
 */
export interface AuditLogEntryInput {
  actorUserId?: string;
  actorType: "human" | "system" | "ai";
  action: string;
  entityType: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(entry: AuditLogEntryInput): Promise<void> {
  await getDb().insert(securitySchema.auditLog).values({
    actorUserId: entry.actorUserId,
    actorType: entry.actorType,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    before: entry.before,
    after: entry.after,
    ipAddress: entry.ipAddress,
    metadata: entry.metadata,
  });
}
