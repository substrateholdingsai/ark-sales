import { AuditService } from "../auth/audit";

export const AUTOMATION_TASK_TITLES = {
  qualifiedLead: "Seguimiento lead calificado",
  demoScheduled: "Preparar demo agendada",
  proposalSent: "Seguimiento propuesta enviada",
} as const;

export async function ensureAccountContactForLead(db: any, lead: {
  id: string;
  email?: string | null;
  despacho_nombre?: string | null;
  tamano?: string | null;
}): Promise<{ accountId: string; contactId: string }> {
  const accountId = `acc_${lead.id}`;
  const contactId = `ct_${lead.id}`;
  if (!db) return { accountId, contactId };
  try {
    await db.prepare(`
      INSERT OR IGNORE INTO sales_accounts (id, name, normalized_name, size, origin, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'lead', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(accountId, lead.despacho_nombre || lead.email || "Despacho", (lead.despacho_nombre || lead.email || "").toLowerCase().trim(), lead.tamano || null).run();
  } catch {}
  try {
    await db.prepare(`
      INSERT OR IGNORE INTO sales_contacts (id, account_id, email, created_at, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(contactId, accountId, lead.email || null).run();
  } catch {}
  try {
    await db.prepare(`
      UPDATE sales_leads SET account_id = ?, contact_id = ? WHERE id = ? AND (account_id IS NULL OR contact_id IS NULL)
    `).bind(accountId, contactId, lead.id).run();
  } catch {}
  return { accountId, contactId };
}

async function taskExists(db: any, opts: { leadId?: string; opportunityId?: string; title: string }): Promise<boolean> {
  if (!db) return false;
  try {
    let sql = "SELECT id FROM sales_tasks WHERE title = ?";
    const params: any[] = [opts.title];
    if (opts.leadId) { sql += " AND lead_id = ?"; params.push(opts.leadId); }
    if (opts.opportunityId) { sql += " AND opportunity_id = ?"; params.push(opts.opportunityId); }
    sql += " LIMIT 1";
    const row = await db.prepare(sql).bind(...params).first();
    return !!row;
  } catch {
    return false;
  }
}

export async function ensureTask(db: any, params: {
  title: string;
  description?: string | null;
  leadId?: string | null;
  accountId?: string | null;
  contactId?: string | null;
  opportunityId?: string | null;
  ownerUserId?: string | null;
  dueInDays?: number;
  actorUserId?: string | null;
}): Promise<void> {
  if (!db) return;
  const exists = await taskExists(db, { leadId: params.leadId || undefined, opportunityId: params.opportunityId || undefined, title: params.title });
  if (exists) return;
  const id = `tsk_${crypto.randomUUID()}`;
  const dueDate = params.dueInDays
    ? new Date(Date.now() + params.dueInDays * 86400000).toISOString().slice(0, 10)
    : null;
  try {
    await db.prepare(`
      INSERT INTO sales_tasks (id, account_id, contact_id, opportunity_id, lead_id, title, description, owner_user_id, due_date, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      id,
      params.accountId ?? null,
      params.contactId ?? null,
      params.opportunityId ?? null,
      params.leadId ?? null,
      params.title,
      params.description ?? null,
      params.ownerUserId ?? null,
      dueDate
    ).run();
  } catch (e) {
    console.warn("[automation] No se pudo crear tarea:", e);
  }
}

export async function autoTaskOnQualifiedLead(db: any, lead: { id: string; email?: string | null; despacho_nombre?: string | null; tamano?: string | null }): Promise<void> {
  const { accountId, contactId } = await ensureAccountContactForLead(db, lead);
  await ensureTask(db, {
    title: AUTOMATION_TASK_TITLES.qualifiedLead,
    description: "Contactar al lead calificado y agendar demo del Bundle ARK.",
    leadId: lead.id,
    accountId,
    contactId,
    dueInDays: 2,
  });
}

export async function autoTaskOnDemoScheduled(db: any, params: { opportunityId: string; accountId?: string | null; leadId?: string | null; ownerUserId?: string | null }): Promise<void> {
  await ensureTask(db, {
    title: AUTOMATION_TASK_TITLES.demoScheduled,
    description: "Preparar demo y enviar recordatorio al prospecto.",
    opportunityId: params.opportunityId,
    accountId: params.accountId ?? null,
    leadId: params.leadId ?? null,
    ownerUserId: params.ownerUserId ?? null,
    dueInDays: 1,
  });
}

export async function autoTaskOnProposalSent(db: any, params: { opportunityId: string; accountId?: string | null; leadId?: string | null; ownerUserId?: string | null }): Promise<void> {
  await ensureTask(db, {
    title: AUTOMATION_TASK_TITLES.proposalSent,
    description: "Seguimiento de propuesta enviada y cierre.",
    opportunityId: params.opportunityId,
    accountId: params.accountId ?? null,
    leadId: params.leadId ?? null,
    ownerUserId: params.ownerUserId ?? null,
    dueInDays: 3,
  });
}

// Federated delivery on won: reuse outbox pattern via sales_pending_ingest + queue
export async function enqueueFederatedOnWon(env: any, params: {
  leadId: string;
  destination: "ledger" | "angel" | "commerce" | "bundle";
  score: number;
  summary: string;
  accountContext: { despacho_nombre: string; tamano: string; productos_interes: string[]; dolor_principal: string };
}): Promise<void> {
  if (!env?.DB) return;
  // Idempotency: check if already pending/delivered for this lead+destination
  try {
    const existing: any = await env.DB.prepare(
      "SELECT id FROM sales_pending_ingest WHERE lead_id = ? AND destination = ? LIMIT 1"
    ).bind(params.leadId, params.destination).first();
    if (existing) return;
  } catch {}

  const payload = {
    version: 3 as const,
    lead_id: params.leadId,
    email: "", // filled below if possible
    source_worker: "ark-sales" as const,
    destination: params.destination,
    vertical: (params.destination === "bundle" ? "bundle" : params.destination === "ledger" ? "fiscal" : params.destination === "angel" ? "cobranza" : "ecommerce") as any,
    score: params.score,
    conversation_summary: params.summary,
    account_context: params.accountContext,
  };

  // fetch email from lead
  try {
    const lead: any = await env.DB.prepare("SELECT email FROM sales_leads WHERE id = ?").bind(params.leadId).first();
    if (lead?.email) payload.email = lead.email;
  } catch {}
  if (!payload.email) payload.email = "anonimo@lead.arksystems.site";

  const outboxId = `outbox_${crypto.randomUUID()}`;
  try {
    await env.DB.prepare(`
      INSERT INTO sales_pending_ingest (id, lead_id, destination, payload_json, status, retries, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pending', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(outboxId, params.leadId, params.destination, JSON.stringify(payload)).run();
  } catch (e) {
    console.warn("[automation] outbox insert failed:", e);
    return;
  }
  if (env.SALES_INGEST_QUEUE) {
    try { await env.SALES_INGEST_QUEUE.send(payload); } catch {}
  }
}