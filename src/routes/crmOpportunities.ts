import { Hono } from "hono";
import { Env } from "../types";
import { AuthVariables } from "../auth/middleware";
import { requireAuth, requireRole } from "../auth/middleware";
import { AuditService, clientIp } from "../auth/audit";
import { autoTaskOnDemoScheduled, autoTaskOnProposalSent, enqueueFederatedOnWon } from "../crm/automation";

export const crmOpportunitiesRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
crmOpportunitiesRouter.use("*", requireAuth());

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  nuevo: ["contactado", "calificado", "perdido"],
  contactado: ["calificado", "demo_agendada", "perdido", "nuevo"],
  calificado: ["demo_agendada", "propuesta_enviada", "perdido", "contactado"],
  demo_agendada: ["propuesta_enviada", "negociacion", "perdido"],
  propuesta_enviada: ["negociacion", "ganado", "perdido"],
  negociacion: ["ganado", "perdido", "propuesta_enviada"],
  ganado: ["perdido"],
  perdido: ["nuevo"],
};

function parsePagination(c: any) {
  const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "20", 10) || 20, 1), 100);
  const offset = Math.max(parseInt(c.req.query("offset") || "0", 10) || 0, 0);
  return { limit, offset };
}

crmOpportunitiesRouter.get("/", async (c) => {
  const { limit, offset } = parsePagination(c);
  const stage = c.req.query("stage");
  const owner = c.req.query("owner") || c.req.query("owner_user_id");
  const accountId = c.req.query("account_id");
  const leadId = c.req.query("lead_id");
  let sql = "SELECT * FROM sales_opportunities WHERE 1=1";
  const params: any[] = [];
  if (stage) { sql += " AND stage = ?"; params.push(stage); }
  if (owner) { sql += " AND owner_user_id = ?"; params.push(owner); }
  if (accountId) { sql += " AND account_id = ?"; params.push(accountId); }
  if (leadId) { sql += " AND lead_id = ?"; params.push(leadId); }
  sql += " ORDER BY updated_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);
  const stmt = c.env.DB.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const { results } = await bound.all();
  return c.json({ items: results || [], limit, offset });
});

crmOpportunitiesRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const opp: any = await c.env.DB.prepare("SELECT * FROM sales_opportunities WHERE id = ?").bind(id).first();
  if (!opp) return c.json({ error: "Oportunidad no encontrada." }, 404);
  const { results: activities } = await c.env.DB.prepare("SELECT * FROM sales_activities WHERE opportunity_id = ? ORDER BY created_at DESC").bind(id).all();
  const { results: tasks } = await c.env.DB.prepare("SELECT * FROM sales_tasks WHERE opportunity_id = ? ORDER BY created_at DESC").bind(id).all();
  return c.json({ opportunity: opp, activities: activities || [], tasks: tasks || [] });
});

crmOpportunitiesRouter.post("/", requireRole("write"), async (c) => {
  try {
    const body = await c.req.json();
    const stage = body?.stage || "nuevo";
    const validStages = ["nuevo","contactado","calificado","demo_agendada","propuesta_enviada","negociacion","ganado","perdido"];
    if (!validStages.includes(stage)) return c.json({ error: "Etapa inválida." }, 400);
    if (stage === "perdido" && !body?.loss_reason) {
      // allow but warn? require reason
    }

    const id = `opp_${crypto.randomUUID()}`;
    const accountId = body?.account_id ?? null;
    const contactId = body?.contact_id ?? null;
    const leadId = body?.lead_id ?? null;
    const owner = body?.owner_user_id ?? null;
    const products = body?.products_interest ? JSON.stringify(body.products_interest) : null;
    const value = body?.estimated_value ?? null;
    const currency = body?.currency || "MXN";
    const closeDate = body?.expected_close_date ?? null;
    const lossReason = body?.loss_reason ?? null;

    if (accountId) {
      const acc: any = await c.env.DB.prepare("SELECT id FROM sales_accounts WHERE id = ?").bind(accountId).first();
      if (!acc) return c.json({ error: "La cuenta no existe." }, 400);
    }

    await c.env.DB.prepare(`
      INSERT INTO sales_opportunities (id, account_id, contact_id, lead_id, stage, owner_user_id, products_interest_json, estimated_value, currency, expected_close_date, loss_reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(id, accountId, contactId, leadId, stage, owner, products, value, currency, closeDate, lossReason).run();

    const audit = new AuditService(c.env.DB);
    await audit.record({
      actor_user_id: c.get("user")!.sub,
      actor_email: c.get("user")!.email,
      action: "crm.opportunity_created",
      entity_type: "opportunity",
      entity_id: id,
      metadata: { stage, account_id: accountId },
      ip: clientIp(c),
    });

    const opp = await c.env.DB.prepare("SELECT * FROM sales_opportunities WHERE id = ?").bind(id).first();
    return c.json({ opportunity: opp }, 201);
  } catch (err: any) {
    return c.json({ error: err.message || "Error creando oportunidad" }, 400);
  }
});

crmOpportunitiesRouter.patch("/:id", requireRole("write"), async (c) => {
  try {
    const id = c.req.param("id");
    const existing: any = await c.env.DB.prepare("SELECT * FROM sales_opportunities WHERE id = ?").bind(id).first();
    if (!existing) return c.json({ error: "Oportunidad no encontrada." }, 404);

    const body = await c.req.json();
    let stage = existing.stage;
    if (body?.stage !== undefined && body.stage !== existing.stage) {
      const newStage = body.stage;
      const allowed = ALLOWED_TRANSITIONS[existing.stage] || [];
      if (!allowed.includes(newStage)) {
        return c.json({ error: `Transición de etapa no permitida: ${existing.stage} -> ${newStage}.` }, 400);
      }
      if (newStage === "perdido" && !body?.loss_reason && !existing.loss_reason) {
        return c.json({ error: "loss_reason es obligatorio al marcar como perdido." }, 400);
      }
      stage = newStage;

      // log stage change as activity
      await c.env.DB.prepare(`
        INSERT INTO sales_activities (id, account_id, opportunity_id, lead_id, type, author_user_id, content, created_at)
        VALUES (?, ?, ?, ?, 'stage_change', ?, ?, CURRENT_TIMESTAMP)
      `).bind(`act_${crypto.randomUUID()}`, existing.account_id, id, existing.lead_id, c.get("user")!.sub, `Etapa: ${existing.stage} -> ${stage}`).run();

      // Automatizaciones (Fase 5)
      try {
        if (stage === "demo_agendada") {
          await autoTaskOnDemoScheduled(c.env.DB, { opportunityId: id, accountId: existing.account_id, leadId: existing.lead_id, ownerUserId: existing.owner_user_id });
        } else if (stage === "propuesta_enviada") {
          await autoTaskOnProposalSent(c.env.DB, { opportunityId: id, accountId: existing.account_id, leadId: existing.lead_id, ownerUserId: existing.owner_user_id });
        } else if (stage === "ganado" && existing.lead_id) {
          const lead: any = await c.env.DB.prepare("SELECT * FROM sales_leads WHERE id = ?").bind(existing.lead_id).first();
          if (lead) {
            await enqueueFederatedOnWon(c.env as any, {
              leadId: existing.lead_id,
              destination: "bundle",
              score: lead.score || 80,
              summary: lead.conversation_summary || "Oportunidad ganada.",
              accountContext: {
                despacho_nombre: lead.despacho_nombre || "Despacho",
                tamano: lead.tamano || "1-5",
                productos_interes: ["ledger", "angel", "commerce"],
                dolor_principal: lead.dolor_detectado || "integral_general",
              },
            });
          }
        }
      } catch (e) { console.warn("[crmOpportunities] automation error:", e); }
    }

    const owner = body?.owner_user_id !== undefined ? body.owner_user_id : existing.owner_user_id;
    const products = body?.products_interest !== undefined
      ? (body.products_interest ? JSON.stringify(body.products_interest) : null)
      : existing.products_interest_json;
    const value = body?.estimated_value !== undefined ? body.estimated_value : existing.estimated_value;
    const currency = body?.currency !== undefined ? body.currency : existing.currency;
    const closeDate = body?.expected_close_date !== undefined ? body.expected_close_date : existing.expected_close_date;
    const lossReason = body?.loss_reason !== undefined ? body.loss_reason : existing.loss_reason;
    const accountId = body?.account_id !== undefined ? body.account_id : existing.account_id;
    const contactId = body?.contact_id !== undefined ? body.contact_id : existing.contact_id;

    await c.env.DB.prepare(`
      UPDATE sales_opportunities
      SET account_id = ?, contact_id = ?, stage = ?, owner_user_id = ?, products_interest_json = ?, estimated_value = ?, currency = ?, expected_close_date = ?, loss_reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(accountId, contactId, stage, owner, products, value, currency, closeDate, lossReason, id).run();

    const audit = new AuditService(c.env.DB);
    await audit.record({
      actor_user_id: c.get("user")!.sub,
      actor_email: c.get("user")!.email,
      action: "crm.opportunity_updated",
      entity_type: "opportunity",
      entity_id: id,
      metadata: { stage, owner_user_id: owner },
      ip: clientIp(c),
    });

    const opp = await c.env.DB.prepare("SELECT * FROM sales_opportunities WHERE id = ?").bind(id).first();
    return c.json({ opportunity: opp });
  } catch (err: any) {
    return c.json({ error: err.message || "Error actualizando oportunidad" }, 400);
  }
});

// Convenience stage endpoint
crmOpportunitiesRouter.post("/:id/stage", requireRole("write"), async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const existing: any = await c.env.DB.prepare("SELECT * FROM sales_opportunities WHERE id = ?").bind(id).first();
    if (!existing) return c.json({ error: "Oportunidad no encontrada." }, 404);
    const newStage = body?.stage;
    if (!newStage) return c.json({ error: "stage es obligatorio." }, 400);
    const allowed = ALLOWED_TRANSITIONS[existing.stage] || [];
    if (!allowed.includes(newStage)) {
      return c.json({ error: `Transición de etapa no permitida: ${existing.stage} -> ${newStage}.` }, 400);
    }
    if (newStage === "perdido" && !body?.loss_reason && !existing.loss_reason) {
      return c.json({ error: "loss_reason es obligatorio al marcar como perdido." }, 400);
    }
    const lossReason = body?.loss_reason !== undefined ? body.loss_reason : existing.loss_reason;

    await c.env.DB.prepare(`
      UPDATE sales_opportunities SET stage = ?, loss_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(newStage, lossReason, id).run();

    await c.env.DB.prepare(`
      INSERT INTO sales_activities (id, account_id, opportunity_id, lead_id, type, author_user_id, content, created_at)
      VALUES (?, ?, ?, ?, 'stage_change', ?, ?, CURRENT_TIMESTAMP)
    `).bind(`act_${crypto.randomUUID()}`, existing.account_id, id, existing.lead_id, c.get("user")!.sub, `Etapa: ${existing.stage} -> ${newStage}`).run();

    // Automatizaciones controladas (Fase 5)
    try {
      if (newStage === "demo_agendada") {
        await autoTaskOnDemoScheduled(c.env.DB, { opportunityId: id, accountId: existing.account_id, leadId: existing.lead_id, ownerUserId: existing.owner_user_id });
      } else if (newStage === "propuesta_enviada") {
        await autoTaskOnProposalSent(c.env.DB, { opportunityId: id, accountId: existing.account_id, leadId: existing.lead_id, ownerUserId: existing.owner_user_id });
      } else if (newStage === "ganado" && existing.lead_id) {
        // Integrar cierre ganado con flujo federado (idempotente)
        const lead: any = await c.env.DB.prepare("SELECT * FROM sales_leads WHERE id = ?").bind(existing.lead_id).first();
        if (lead) {
          await enqueueFederatedOnWon(c.env as any, {
            leadId: existing.lead_id,
            destination: "bundle",
            score: lead.score || 80,
            summary: lead.conversation_summary || "Oportunidad ganada.",
            accountContext: {
              despacho_nombre: lead.despacho_nombre || "Despacho",
              tamano: lead.tamano || "1-5",
              productos_interes: ["ledger", "angel", "commerce"],
              dolor_principal: lead.dolor_detectado || "integral_general",
            },
          });
        }
      }
    } catch (e) {
      console.warn("[crmOpportunities] automation error:", e);
    }

    const audit = new AuditService(c.env.DB);
    await audit.record({
      actor_user_id: c.get("user")!.sub,
      actor_email: c.get("user")!.email,
      action: "crm.opportunity_stage_changed",
      entity_type: "opportunity",
      entity_id: id,
      metadata: { from: existing.stage, to: newStage },
      ip: clientIp(c),
    });

    const opp = await c.env.DB.prepare("SELECT * FROM sales_opportunities WHERE id = ?").bind(id).first();
    return c.json({ opportunity: opp });
  } catch (err: any) {
    return c.json({ error: err.message || "Error cambiando etapa" }, 400);
  }
});
