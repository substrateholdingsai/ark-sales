import { Hono } from "hono";
import { Env } from "../types";
import { AuthVariables } from "../auth/middleware";
import { requireAuth, requireRole } from "../auth/middleware";
import { AuditService, clientIp } from "../auth/audit";

export const crmActivitiesRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
crmActivitiesRouter.use("*", requireAuth());

function parsePagination(c: any) {
  const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "20", 10) || 20, 1), 100);
  const offset = Math.max(parseInt(c.req.query("offset") || "0", 10) || 0, 0);
  return { limit, offset };
}

crmActivitiesRouter.get("/", async (c) => {
  const { limit, offset } = parsePagination(c);
  const accountId = c.req.query("account_id");
  const opportunityId = c.req.query("opportunity_id");
  const leadId = c.req.query("lead_id");
  const contactId = c.req.query("contact_id");
  const type = c.req.query("type");
  let sql = "SELECT * FROM sales_activities WHERE 1=1";
  const params: any[] = [];
  if (accountId) { sql += " AND account_id = ?"; params.push(accountId); }
  if (opportunityId) { sql += " AND opportunity_id = ?"; params.push(opportunityId); }
  if (leadId) { sql += " AND lead_id = ?"; params.push(leadId); }
  if (contactId) { sql += " AND contact_id = ?"; params.push(contactId); }
  if (type) { sql += " AND type = ?"; params.push(type); }
  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);
  const stmt = c.env.DB.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const { results } = await bound.all();
  return c.json({ items: results || [], limit, offset });
});

crmActivitiesRouter.post("/", requireRole("write"), async (c) => {
  try {
    const body = await c.req.json();
    const type = body?.type || "note";
    const validTypes = ["note","call","email","demo","stage_change","task","system"];
    if (!validTypes.includes(type)) return c.json({ error: "Tipo de actividad inválido." }, 400);

    const rawContent = typeof body?.content === "string" ? body.content : null;
    const noteContent = rawContent?.trim() || "";
    if (type === "note" && !noteContent) {
      return c.json({ error: "El texto de la nota es obligatorio." }, 400);
    }
    if (type === "note" && noteContent.length > 10000) {
      return c.json({ error: "La nota no puede exceder 10,000 caracteres." }, 400);
    }
    const content = type === "note" ? noteContent : rawContent;

    let accountId = body?.account_id ?? null;
    const contactId = body?.contact_id ?? null;
    const opportunityId = body?.opportunity_id ?? null;
    const leadId = body?.lead_id ?? null;

    if (accountId) {
      const account = await c.env.DB.prepare("SELECT id FROM sales_accounts WHERE id = ?").bind(accountId).first();
      if (!account) return c.json({ error: "La cuenta asociada no existe." }, 400);
    }
    if (contactId) {
      const contact: any = await c.env.DB.prepare("SELECT id, account_id FROM sales_contacts WHERE id = ?").bind(contactId).first();
      if (!contact) return c.json({ error: "El contacto asociado no existe." }, 400);
      if (accountId && contact.account_id !== accountId) {
        return c.json({ error: "El contacto no pertenece a la cuenta indicada." }, 400);
      }
      accountId = accountId || contact.account_id;
    }
    if (opportunityId) {
      const opportunity: any = await c.env.DB.prepare("SELECT id, account_id, contact_id FROM sales_opportunities WHERE id = ?").bind(opportunityId).first();
      if (!opportunity) return c.json({ error: "La oportunidad asociada no existe." }, 400);
      if (accountId && opportunity.account_id !== accountId) {
        return c.json({ error: "La oportunidad no pertenece a la cuenta indicada." }, 400);
      }
      if (contactId && opportunity.contact_id && opportunity.contact_id !== contactId) {
        return c.json({ error: "La oportunidad no corresponde al contacto indicado." }, 400);
      }
      accountId = accountId || opportunity.account_id;
    }
    if (type === "note" && !accountId && !contactId && !opportunityId) {
      return c.json({ error: "La nota debe asociarse a una cuenta, contacto u oportunidad." }, 400);
    }

    const id = `act_${crypto.randomUUID()}`;
    const metadata = body?.metadata ? JSON.stringify(body.metadata) : null;

    await c.env.DB.prepare(`
      INSERT INTO sales_activities (id, account_id, contact_id, opportunity_id, lead_id, type, author_user_id, content, metadata_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(id, accountId, contactId, opportunityId, leadId, type, c.get("user")!.sub, content, metadata).run();

    const audit = new AuditService(c.env.DB);
    await audit.record({
      actor_user_id: c.get("user")!.sub,
      actor_email: c.get("user")!.email,
      action: "crm.activity_created",
      entity_type: "activity",
      entity_id: id,
      metadata: { type, account_id: accountId, opportunity_id: opportunityId },
      ip: clientIp(c),
    });

    const activity = await c.env.DB.prepare(`
      SELECT a.*, u.name AS author_name
      FROM sales_activities a
      LEFT JOIN crm_users u ON u.id = a.author_user_id
      WHERE a.id = ?
    `).bind(id).first();
    return c.json({ activity }, 201);
  } catch (err: any) {
    return c.json({ error: err.message || "Error registrando actividad" }, 400);
  }
});