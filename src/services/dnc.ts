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

    const stmt = tenantId ? this.db.prepare(query).bind(cleanEmail, tenantId) : this.db.prepare(query).bind(cleanEmail);

    const row = await stmt.first();
    return !!row;
  }

  /**
   * Verifica si un teléfono está en la lista de exclusión (WhatsApp/SMS/voz).
   */
  async isBlockedByPhone(phone: string, tenantId?: string): Promise<boolean> {
    if (!this.db || !phone) return false;
    const cleanPhone = phone.trim();

    const query = tenantId
      ? "SELECT id FROM crm_dnc_list WHERE phone = ? AND (tenant_id = ? OR tenant_id IS NULL) LIMIT 1"
      : "SELECT id FROM crm_dnc_list WHERE phone = ? LIMIT 1";

    const stmt = tenantId ? this.db.prepare(query).bind(cleanPhone, tenantId) : this.db.prepare(query).bind(cleanPhone);

    const row = await stmt.first();
    return !!row;
  }

  /**
   * Registra un correo o teléfono en la lista DNC permanente.
   * Si solo se proporciona teléfono, se usa una clave sintética en la columna email.
   */
  async add(
    email: string,
    reason: "unsubscribe" | "opt_out" | "complaint" | "legal" | "manual" = "unsubscribe",
    tenantId?: string,
    phone?: string,
  ): Promise<void> {
    if (!this.db || (!email && !phone)) return;
    const cleanEmail = email ? email.trim().toLowerCase() : `tel:${phone?.trim()}`;
    const cleanPhone = phone?.trim() ?? null;
    const id = `dnc_${crypto.randomUUID()}`;

    await this.db
      .prepare(
        `INSERT INTO crm_dnc_list (id, tenant_id, email, phone, reason, created_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(email) DO UPDATE SET reason = excluded.reason`,
      )
      .bind(id, tenantId ?? null, cleanEmail, cleanPhone, reason)
      .run();
  }
}
