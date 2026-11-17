// Usage events / credit-bag billing layer (Step 2: G7).
// Writes one usage_events row per billable send. No event for excluded sends;
// failed sends may write a zero-cost audit event.

export const UNIT_COSTS_USD: Record<string, number> = {
  whatsapp: 0.2, // per message
  voice: 0.25, // per minute
  sms: 0.15, // per message
  email: 0.06, // per message
} as const;

export interface UsageEventParams {
  jobId?: string | null;
  tenantId: string;
  contactId: string;
  channel: "whatsapp" | "sms" | "email" | "voice";
  units: number;
  status?: "billable" | "audit_zero";
}

export class UsageEventsService {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async write(params: UsageEventParams): Promise<void> {
    if (!this.db) return;
    const unitCost = UNIT_COSTS_USD[params.channel] ?? 0;
    const totalCost = params.units * unitCost;
    const id = `evt_${crypto.randomUUID()}`;

    await this.db
      .prepare(
        `
        INSERT INTO usage_events (
          id, job_id, tenant_id, contact_id, channel, units,
          unit_cost_usd, total_cost_usd, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      )
      .bind(id, params.jobId ?? null, params.tenantId, params.contactId, params.channel, params.units, unitCost, totalCost, params.status ?? "billable")
      .run();
  }

  // Credit-deduct hook: returns the total to deduct from the tenant's bundle credit ledger.
  // The caller (CRM / billing system) performs the actual ledger deduction.
  async totalForJob(jobId: string): Promise<{ totalCostUsd: number; eventCount: number }> {
    if (!this.db) return { totalCostUsd: 0, eventCount: 0 };
    const row = (await this.db
      .prepare(
        `
        SELECT COALESCE(SUM(total_cost_usd), 0) as total_cost_usd, COUNT(*) as event_count
        FROM usage_events WHERE job_id = ? AND status = 'billable'
      `,
      )
      .bind(jobId)
      .first()) as any;
    return {
      totalCostUsd: Number(row?.total_cost_usd || 0),
      eventCount: Number(row?.event_count || 0),
    };
  }

  async totalForTenant(tenantId: string): Promise<{ totalCostUsd: number; eventCount: number }> {
    if (!this.db) return { totalCostUsd: 0, eventCount: 0 };
    const row = (await this.db
      .prepare(
        `
        SELECT COALESCE(SUM(total_cost_usd), 0) as total_cost_usd, COUNT(*) as event_count
        FROM usage_events WHERE tenant_id = ? AND status = 'billable'
      `,
      )
      .bind(tenantId)
      .first()) as any;
    return {
      totalCostUsd: Number(row?.total_cost_usd || 0),
      eventCount: Number(row?.event_count || 0),
    };
  }

  getUnitCostUsd(channel: "whatsapp" | "sms" | "email" | "voice"): number {
    return UNIT_COSTS_USD[channel] ?? 0;
  }
}
