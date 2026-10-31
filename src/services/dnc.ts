// Servicio de Lista de Exclusión Permanente (Do Not Contact - DNC)
// Inspirado en Harvey (ethanplusai/harvey)
// Evita que cualquier lead que solicitó baja reciba correos o llamadas en el futuro.

export class DncService {
  constructor(private db: any) {}

  /**
   * Verifica si un correo está en la lista de exclusión.
   */
  async isBlocked(email: string, tenantId?: string): Promise<boolean> {
    if (!this.db || !email) return false;
    const cleanEmail = email.trim().toLowerCase();

    const query = tenantId
      ? "SELECT id FROM crm_dnc_list WHERE email = ? AND (tenant_id = ? OR tenant_id IS NULL) LIMIT 1"
      : "SELECT id FROM crm_dnc_list WHERE email = ? LIMIT 1";

    const stmt = tenantId
      ? this.db.prepare(query).bind(cleanEmail, tenantId)
      : this.db.prepare(query).bind(cleanEmail);

    const row = await stmt.first();
    return !!row;
  }

  /**
   * Registra un correo en la lista DNC permanente.
   */
  async add(email: string, reason: "unsubscribe" | "opt_out" | "complaint" | "legal" | "manual" = "unsubscribe", tenantId?: string, phone?: string): Promise<void> {
    if (!this.db || !email) return;
    const cleanEmail = email.trim().toLowerCase();
    const id = `dnc_${crypto.randomUUID()}`;

    await this.db
      .prepare(
        `INSERT INTO crm_dnc_list (id, tenant_id, email, phone, reason, created_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(email) DO UPDATE SET reason = excluded.reason`
      )
      .bind(id, tenantId ?? null, cleanEmail, phone ?? null, reason)
      .run();
  }
}
