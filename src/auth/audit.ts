import { Env } from "../types";

export type AuditEntry = {
  actor_user_id?: string | null;
  actor_email?: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  metadata?: Record<string, any> | null;
  ip?: string | null;
};

export class AuditService {
  constructor(private db: any) {}

  async record(entry: AuditEntry): Promise<void> {
    if (!this.db) return;
    try {
      const id = `aud_${crypto.randomUUID()}`;
      await this.db
        .prepare(
          `INSERT INTO crm_audit_log (id, actor_user_id, actor_email, action, entity_type, entity_id, metadata_json, ip, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
        )
        .bind(
          id,
          entry.actor_user_id ?? null,
          entry.actor_email ?? null,
          entry.action,
          entry.entity_type ?? null,
          entry.entity_id ?? null,
          entry.metadata ? JSON.stringify(entry.metadata) : null,
          entry.ip ?? null
        )
        .run();
    } catch (err) {
      console.warn("[AuditService] No se pudo registrar auditoría:", err);
    }
  }
}

export function clientIp(c: any): string | null {
  try {
    return (
      c.req.header("cf-connecting-ip") ||
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      null
    );
  } catch {
    return null;
  }
}