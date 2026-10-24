import { Hono } from "hono";
import { Env } from "../types";
import { AuthVariables } from "../auth/middleware";
import { requireAuth, requireRole } from "../auth/middleware";
import { AuditService, clientIp } from "../auth/audit";

export const crmContactsRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
crmContactsRouter.use("*", requireAuth());

function parsePagination(c: any) {
  const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "20", 10) || 20, 1), 100);
  const offset = Math.max(parseInt(c.req.query("offset") || "0", 10) || 0, 0);
  return { limit, offset };
}

crmContactsRouter.get("/", async (c) => {
  const { limit, offset } = parsePagination(c);
  const accountId = c.req.query("account_id");
  const q = (c.req.query("q") || "").trim();
  let sql = "SELECT * FROM sales_contacts WHERE 1=1";
  const params: any[] = [];
  if (accountId) { sql += " AND account_id = ?"; params.push(accountId); }
  if (q) { sql += " AND (name LIKE ? OR email LIKE ?)"; params.push(`%${q}%`, `%${q}%`); }
  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);
  const stmt = c.env.DB.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const { results } = await bound.all();
  return c.json({ items: results || [], limit, offset });
});

crmContactsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const contact: any = await c.env.DB.prepare("SELECT * FROM sales_contacts WHERE id = ?").bind(id).first();
  if (!contact) return c.json({ error: "Contacto no encontrado." }, 404);
  return c.json({ contact });
});

crmContactsRouter.post("/", requireRole("write"), async (c) => {
  try {
    const body = await c.req.json();
    const accountId = body?.account_id;
    if (!accountId) return c.json({ error: "account_id es obligatorio." }, 400);
    const account: any = await c.env.DB.prepare("SELECT id FROM sales_accounts WHERE id = ?").bind(accountId).first();
    if (!account) return c.json({ error: "La cuenta no existe." }, 400);

    const id = `ct_${crypto.randomUUID()}`;
    const name = body?.name ?? null;
    const email = body?.email ?? null;
    const phone = body?.phone ?? null;
    const title = body?.title ?? null;
    const consent = body?.consent_status ?? null;
    const prefs = body?.contact_preferences ? JSON.stringify(body.contact_preferences) : null;

    await c.env.DB.prepare(`
      INSERT INTO sales_contacts (id, account_id, name, email, phone, title, consent_status, contact_preferences_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(id, accountId, name, email, phone, title, consent, prefs).run();

    const audit = new AuditService(c.env.DB);
    await audit.record({
      actor_user_id: c.get("user")!.sub,
      actor_email: c.get("user")!.email,
      action: "crm.contact_created",
      entity_type: "contact",
      entity_id: id,
      metadata: { account_id: accountId, email },
      ip: clientIp(c),
    });

    const contact = await c.env.DB.prepare("SELECT * FROM sales_contacts WHERE id = ?").bind(id).first();
    return c.json({ contact }, 201);
  } catch (err: any) {
    return c.json({ error: err.message || "Error creando contacto" }, 400);
  }
});

crmContactsRouter.patch("/:id", requireRole("write"), async (c) => {
  try {
    const id = c.req.param("id");
    const existing: any = await c.env.DB.prepare("SELECT * FROM sales_contacts WHERE id = ?").bind(id).first();
    if (!existing) return c.json({ error: "Contacto no encontrado." }, 404);

    const body = await c.req.json();
    const accountId = body?.account_id !== undefined ? body.account_id : existing.account_id;
    const name = body?.name !== undefined ? body.name : existing.name;
    const email = body?.email !== undefined ? body.email : existing.email;
    const phone = body?.phone !== undefined ? body.phone : existing.phone;
    const title = body?.title !== undefined ? body.title : existing.title;
    const consent = body?.consent_status !== undefined ? body.consent_status : existing.consent_status;
    const prefs = body?.contact_preferences !== undefined
      ? (body.contact_preferences ? JSON.stringify(body.contact_preferences) : null)
      : existing.contact_preferences_json;

    await c.env.DB.prepare(`
      UPDATE sales_contacts
      SET account_id = ?, name = ?, email = ?, phone = ?, title = ?, consent_status = ?, contact_preferences_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(accountId, name, email, phone, title, consent, prefs, id).run();

    const audit = new AuditService(c.env.DB);
    await audit.record({
      actor_user_id: c.get("user")!.sub,
      actor_email: c.get("user")!.email,
      action: "crm.contact_updated",
      entity_type: "contact",
      entity_id: id,
      metadata: { account_id: accountId, email },
      ip: clientIp(c),
    });

    const contact = await c.env.DB.prepare("SELECT * FROM sales_contacts WHERE id = ?").bind(id).first();
    return c.json({ contact });
  } catch (err: any) {
    return c.json({ error: err.message || "Error actualizando contacto" }, 400);
  }
});