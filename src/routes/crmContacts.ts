import { Hono } from "hono";
import { Env } from "../types";
import { AuthVariables } from "../auth/middleware";
import { requireAuth, requireRole } from "../auth/middleware";
import { AuditService, clientIp } from "../auth/audit";
import { enrichDoctorLead } from "../services/contactEnrichment";

export const crmContactsRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
crmContactsRouter.use("*", requireAuth());

function parsePagination(c: any) {
  const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "20", 10) || 20, 1), 5000);
  const offset = Math.max(parseInt(c.req.query("offset") || "0", 10) || 0, 0);
  return { limit, offset };
}

crmContactsRouter.get("/", async (c) => {
  const { limit, offset } = parsePagination(c);
  const accountId = c.req.query("account_id");
  const q = (c.req.query("q") || "").trim();
  let sql = `
    SELECT c.*, a.name AS account_name, a.city AS account_city, a.origin AS account_origin, a.scian_code AS account_scian
    FROM sales_contacts c
    LEFT JOIN sales_accounts a ON c.account_id = a.id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (accountId) { sql += " AND c.account_id = ?"; params.push(accountId); }
  if (q) { sql += " AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.whatsapp LIKE ?)"; params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  sql += " ORDER BY c.created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);
  const stmt = c.env.DB.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const { results } = await bound.all();

  let countSql = "SELECT COUNT(*) as n FROM sales_contacts c WHERE 1=1";
  const cparams: any[] = [];
  if (accountId) { countSql += " AND c.account_id = ?"; cparams.push(accountId); }
  if (q) { countSql += " AND (c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.whatsapp LIKE ?)"; cparams.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  const countStmt = c.env.DB.prepare(countSql);
  const countBound = cparams.length ? countStmt.bind(...cparams) : countStmt;
  const countRow: any = await countBound.first();

  return c.json({ items: results || [], total: countRow?.n ?? (results?.length ?? 0), limit, offset });
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
    const whatsapp = body?.whatsapp ?? null;
    const title = body?.title ?? null;
    const consent = body?.consent_status ?? null;
    const prefs = body?.contact_preferences ? JSON.stringify(body.contact_preferences) : null;

    await c.env.DB.prepare(`
      INSERT INTO sales_contacts (id, account_id, name, email, phone, whatsapp, title, consent_status, contact_preferences_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(id, accountId, name, email, phone, whatsapp, title, consent, prefs).run();

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
    const whatsapp = body?.whatsapp !== undefined ? body.whatsapp : existing.whatsapp;
    const title = body?.title !== undefined ? body.title : existing.title;
    const consent = body?.consent_status !== undefined ? body.consent_status : existing.consent_status;
    const prefs = body?.contact_preferences !== undefined
      ? (body.contact_preferences ? JSON.stringify(body.contact_preferences) : null)
      : existing.contact_preferences_json;

    await c.env.DB.prepare(`
      UPDATE sales_contacts
      SET account_id = ?, name = ?, email = ?, phone = ?, whatsapp = ?, title = ?, consent_status = ?, contact_preferences_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(accountId, name, email, phone, whatsapp, title, consent, prefs, id).run();

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

// Enriquecimiento Nivel 2 (Google / Doctoralia)
crmContactsRouter.post("/:id/enrich", requireRole("write"), async (c) => {
  try {
    const id = c.req.param("id");
    const existing: any = await c.env.DB.prepare(`
      SELECT c.*, a.name AS account_name, a.city AS account_city
      FROM sales_contacts c
      LEFT JOIN sales_accounts a ON c.account_id = a.id
      WHERE c.id = ?
    `).bind(id).first();
    if (!existing) return c.json({ error: "Contacto no encontrado." }, 404);

    let body: any = {};
    try { body = await c.req.json(); } catch {}
    const autoApply = body?.auto_apply !== false;

    const enrichment = await enrichDoctorLead({
      name: existing.name,
      accountName: existing.account_name,
      city: existing.account_city,
    });

    let updatedContact = existing;
    if (autoApply && enrichment.found) {
      const isPlaceholder = !existing.name || existing.name === "Sin nombre" || existing.name.toLowerCase().includes("contacto corporativo");
      const newName = (isPlaceholder && enrichment.doctor_name) ? enrichment.doctor_name : existing.name;
      const newPhone = enrichment.phone || existing.phone;
      const newWhatsapp = enrichment.whatsapp || existing.whatsapp;
      const newTitle = enrichment.title || existing.title;

      await c.env.DB.prepare(`
        UPDATE sales_contacts
        SET name = ?, phone = ?, whatsapp = ?, title = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(newName, newPhone, newWhatsapp, newTitle, id).run();

      const audit = new AuditService(c.env.DB);
      await audit.record({
        actor_user_id: c.get("user")!.sub,
        actor_email: c.get("user")!.email,
        action: "crm.contact_enriched",
        entity_type: "contact",
        entity_id: id,
        metadata: {
          previous: { name: existing.name, phone: existing.phone, whatsapp: existing.whatsapp },
          enriched: { name: newName, phone: newPhone, whatsapp: newWhatsapp, title: newTitle },
          source_url: enrichment.source_url,
        },
        ip: clientIp(c),
      });

      updatedContact = await c.env.DB.prepare("SELECT * FROM sales_contacts WHERE id = ?").bind(id).first();
    }

    return c.json({
      success: true,
      enrichment,
      contact: updatedContact,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Error enriqueciendo contacto" }, 400);
  }
});

// Delete contact
crmContactsRouter.delete("/:id", requireRole("write"), async (c) => {
  try {
    const id = c.req.param("id");
    const existing: any = await c.env.DB.prepare("SELECT * FROM sales_contacts WHERE id = ?").bind(id).first();
    if (!existing) return c.json({ error: "Contacto no encontrado." }, 404);

    await c.env.DB.prepare("UPDATE sales_leads SET contact_id = NULL WHERE contact_id = ?").bind(id).run();
    await c.env.DB.prepare("UPDATE sales_opportunities SET contact_id = NULL WHERE contact_id = ?").bind(id).run();
    await c.env.DB.prepare("UPDATE sales_activities SET contact_id = NULL WHERE contact_id = ?").bind(id).run();
    await c.env.DB.prepare("DELETE FROM sales_contacts WHERE id = ?").bind(id).run();

    const audit = new AuditService(c.env.DB);
    await audit.record({
      actor_user_id: c.get("user")!.sub,
      actor_email: c.get("user")!.email,
      action: "crm.contact_deleted",
      entity_type: "contact",
      entity_id: id,
      metadata: { name: existing.name, account_id: existing.account_id },
      ip: clientIp(c),
    });

    return c.json({ success: true, id, message: `Contacto "${existing.name || id}" eliminado correctamente.` });
  } catch (err: any) {
    return c.json({ error: err.message || "Error eliminando contacto" }, 400);
  }
});

// Bulk Delete contacts (Batch / Multiple Selection)
crmContactsRouter.post("/bulk-delete", requireRole("write"), async (c) => {
  try {
    const body = await c.req.json<{ ids?: string[] }>();
    const ids = body?.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return c.json({ error: "Se requiere un arreglo 'ids' con al menos 1 ID." }, 400);
    }

    // Process in chunks of 100 for SQL binding safety
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 100) {
      chunks.push(ids.slice(i, i + 100));
    }

    for (const chunk of chunks) {
      const placeholders = chunk.map(() => "?").join(",");
      await c.env.DB.prepare(`UPDATE sales_leads SET contact_id = NULL WHERE contact_id IN (${placeholders})`).bind(...chunk).run();
      await c.env.DB.prepare(`UPDATE sales_opportunities SET contact_id = NULL WHERE contact_id IN (${placeholders})`).bind(...chunk).run();
      await c.env.DB.prepare(`UPDATE sales_activities SET contact_id = NULL WHERE contact_id IN (${placeholders})`).bind(...chunk).run();
      await c.env.DB.prepare(`DELETE FROM sales_contacts WHERE id IN (${placeholders})`).bind(...chunk).run();
    }

    const audit = new AuditService(c.env.DB);
    await audit.record({
      actor_user_id: c.get("user")!.sub,
      actor_email: c.get("user")!.email,
      action: "crm.contacts_bulk_deleted",
      entity_type: "contact",
      metadata: { count: ids.length, ids_preview: ids.slice(0, 5) },
      ip: clientIp(c),
    });

    return c.json({ success: true, count: ids.length, message: `${ids.length} contactos eliminados exitosamente.` });
  } catch (err: any) {
    return c.json({ error: err.message || "Error en eliminación masiva de contactos." }, 400);
  }
});
