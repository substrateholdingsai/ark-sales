import { Hono } from "hono";
import { Env } from "../types";
import { AuthVariables } from "../auth/middleware";
import { requireAuth, requireRole } from "../auth/middleware";
import { AuditService, clientIp } from "../auth/audit";
import { enrichLeadByVertical } from "../services/contactEnrichment";
import { handleSheetsImport } from "../services/sheetsImport";

export const crmAccountsRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
crmAccountsRouter.use("*", requireAuth());

const FUTURA_SCIANS = new Set([
  "531210", "531311", "523920",
  "621111", "621112", "621113", "621211", "621399", "621410", "621420", "621490", "621511", "621990", "622111", "622110", "622210", "622310",
  "484111", "484121", "493111", "488511",
  "721111", "721190", "531110", "551110"
]);

export function isFuturaAccount(a: any): boolean {
  if (!a) return false;
  if (a.tenant_id === "acc_futura_capital") return true;
  const scian = String(a.scian_code || "").trim();
  if (scian.startsWith("62") || FUTURA_SCIANS.has(scian)) return true;
  const id = String(a.id || "").toLowerCase();
  const name = String(a.name || "").toLowerCase();
  const origin = String(a.origin || "").toLowerCase();
  const source = String(a.harvest_source || a.origin || "").toLowerCase();
  if (
    id.includes("futura") ||
    name.includes("futura capital") ||
    origin.includes("futura") ||
    origin.includes("proptech") ||
    origin.includes("inmobiliaria") ||
    source.includes("hermes") ||
    source.includes("vektor")
  ) {
    return true;
  }
  return false;
}

export function resolveTenantId(a: any): string {
  if (isFuturaAccount(a)) return "acc_futura_capital";
  if (a.tenant_id) return a.tenant_id;
  return "acc_ark_ledger";
}

function parsePagination(c: any) {
  const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "20", 10) || 20, 1), 100);
  const offset = Math.max(parseInt(c.req.query("offset") || "0", 10) || 0, 0);
  return { limit, offset };
}

// List accounts
crmAccountsRouter.get("/", async (c) => {
  const { limit, offset } = parsePagination(c);
  const q = (c.req.query("q") || "").trim();
  const origin = c.req.query("origin");
  const size = c.req.query("size");
  const duplicate = c.req.query("duplicate_review_status");
  const tenantFilter = c.req.query("tenant") || c.req.query("tenant_id");

  let sql = `
    SELECT sales_accounts.*,
           CASE WHEN EXISTS (
             SELECT 1 FROM sales_opportunities opp
             WHERE opp.account_id = sales_accounts.id AND opp.stage = 'propuesta_enviada'
           ) THEN 1 ELSE 0 END AS has_proposal_sent
    FROM sales_accounts
    WHERE 1=1
  `;
  const params: any[] = [];
  let countSql = "SELECT COUNT(*) as n FROM sales_accounts WHERE 1=1";
  const cparams: any[] = [];

  if (tenantFilter === "acc_futura_capital") {
    const clause = ` AND (
      sales_accounts.tenant_id = 'acc_futura_capital' OR 
      sales_accounts.scian_code LIKE '62%' OR 
      sales_accounts.scian_code IN ('531210', '531311', '523920', '484111', '484121', '493111', '488511', '721111', '721190', '531110', '551110', '621111', '621112', '621211', '621399', '621511', '622111') OR
      sales_accounts.id LIKE '%futura%' OR
      sales_accounts.name LIKE '%futura capital%' OR
      sales_accounts.origin LIKE '%futura%' OR
      sales_accounts.origin LIKE '%proptech%' OR
      sales_accounts.origin LIKE '%inmobiliaria%' OR
      sales_accounts.harvest_source LIKE '%hermes%' OR
      sales_accounts.harvest_source LIKE '%vektor%'
    )`;
    sql += clause;
    countSql += clause;
  } else if (tenantFilter === "acc_ark_ledger") {
    const clause = ` AND (
      (sales_accounts.tenant_id = 'acc_ark_ledger' OR sales_accounts.tenant_id IS NULL) AND
      (sales_accounts.scian_code NOT LIKE '62%' OR sales_accounts.scian_code IS NULL) AND
      (sales_accounts.scian_code NOT IN ('531210', '531311', '523920', '484111', '484121', '493111', '488511', '721111', '721190', '531110', '551110') OR sales_accounts.scian_code IS NULL) AND
      sales_accounts.id NOT LIKE '%futura%' AND
      sales_accounts.name NOT LIKE '%futura capital%' AND
      sales_accounts.origin NOT LIKE '%futura%' AND
      sales_accounts.harvest_source NOT LIKE '%hermes%' AND
      sales_accounts.harvest_source NOT LIKE '%vektor%'
    )`;
    sql += clause;
    countSql += clause;
  } else if (tenantFilter) {
    sql += " AND sales_accounts.tenant_id = ?";
    params.push(tenantFilter);
    countSql += " AND sales_accounts.tenant_id = ?";
    cparams.push(tenantFilter);
  }

  if (q) {
    sql += " AND (name LIKE ? OR normalized_name LIKE ?)";
    params.push(`%${q}%`, `%${q.toLowerCase()}%`);
    countSql += " AND (name LIKE ? OR normalized_name LIKE ?)";
    cparams.push(`%${q}%`, `%${q.toLowerCase()}%`);
  }
  if (origin) {
    sql += " AND origin = ?"; params.push(origin);
    countSql += " AND origin = ?"; cparams.push(origin);
  }
  if (size) {
    sql += " AND size = ?"; params.push(size);
    countSql += " AND size = ?"; cparams.push(size);
  }
  if (duplicate) {
    sql += " AND duplicate_review_status = ?"; params.push(duplicate);
    countSql += " AND duplicate_review_status = ?"; cparams.push(duplicate);
  }

  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const stmt = c.env.DB.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const { results } = await bound.all();

  const countStmt = c.env.DB.prepare(countSql);
  const countBound = cparams.length ? countStmt.bind(...cparams) : countStmt;
  const countRow: any = await countBound.first();

  let items = (results || []).map((row: any) => ({
    ...row,
    tenant_id: resolveTenantId(row)
  }));

  if (tenantFilter) {
    items = items.filter((row: any) => row.tenant_id === tenantFilter);
  }

  return c.json({ items, total: countRow?.n ?? (results?.length ?? 0), limit, offset });
});

// Duplicate detection groups
crmAccountsRouter.get("/duplicates", requireRole("write"), async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT normalized_name, COUNT(*) as n
    FROM sales_accounts
    WHERE normalized_name IS NOT NULL AND normalized_name != ''
    GROUP BY normalized_name
    HAVING COUNT(*) > 1
    ORDER BY n DESC
  `).all();
  const groups: any[] = [];
  for (const r of results || []) {
    const { results: accs } = await c.env.DB.prepare(
      "SELECT * FROM sales_accounts WHERE normalized_name = ?"
    ).bind((r as any).normalized_name).all();
    groups.push({ normalized_name: (r as any).normalized_name, count: (r as any).n, accounts: accs || [] });
  }
  return c.json({ groups });
});

// Get single account with related data
crmAccountsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const account: any = await c.env.DB.prepare("SELECT * FROM sales_accounts WHERE id = ?").bind(id).first();
  if (!account) return c.json({ error: "Cuenta no encontrada." }, 404);
  account.tenant_id = resolveTenantId(account);

  const { results: contacts } = await c.env.DB.prepare("SELECT * FROM sales_contacts WHERE account_id = ? ORDER BY created_at DESC").bind(id).all();
  const { results: opportunities } = await c.env.DB.prepare("SELECT * FROM sales_opportunities WHERE account_id = ? ORDER BY created_at DESC").bind(id).all();
  const { results: activities } = await c.env.DB.prepare(`
    SELECT a.*, u.name AS author_name
    FROM sales_activities a
    LEFT JOIN crm_users u ON u.id = a.author_user_id
    WHERE a.account_id = ?
    ORDER BY a.created_at DESC
    LIMIT 50
  `).bind(id).all();
  const { results: tasks } = await c.env.DB.prepare("SELECT * FROM sales_tasks WHERE account_id = ? ORDER BY created_at DESC").bind(id).all();
  const { results: leads } = await c.env.DB.prepare("SELECT * FROM sales_leads WHERE account_id = ? ORDER BY created_at DESC").bind(id).all();

  return c.json({ account, contacts: contacts || [], opportunities: opportunities || [], activities: activities || [], tasks: tasks || [], leads: leads || [] });
});

// Create account
crmAccountsRouter.post("/", requireRole("write"), async (c) => {
  try {
    const body = await c.req.json();
    const name = (body?.name || "").trim();
    if (!name) return c.json({ error: "El campo 'name' es obligatorio." }, 400);
    const size = body?.size ?? null;
    const city = body?.city ?? null;
    const origin = body?.origin ?? null;
    const id = `acc_${crypto.randomUUID()}`;
    const normalized = name.toLowerCase().trim();
    await c.env.DB.prepare(`
      INSERT INTO sales_accounts (id, name, normalized_name, size, city, origin, duplicate_review_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(id, name, normalized, size, city, origin).run();

    const audit = new AuditService(c.env.DB);
    await audit.record({
      actor_user_id: c.get("user")!.sub,
      actor_email: c.get("user")!.email,
      action: "crm.account_created",
      entity_type: "account",
      entity_id: id,
      metadata: { name, size, city, origin },
      ip: clientIp(c),
    });

    const account = await c.env.DB.prepare("SELECT * FROM sales_accounts WHERE id = ?").bind(id).first();
    return c.json({ account }, 201);
  } catch (err: any) {
    return c.json({ error: err.message || "Error creando cuenta" }, 400);
  }
});

// Bulk import accounts (CSV/JSON)
crmAccountsRouter.post("/bulk", requireRole("write"), async (c) => {
  try {
    const body = await c.req.json();
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!items.length) return c.json({ error: "items es obligatorio y no puede estar vacío." }, 400);
    const created: string[] = [];
    const errors: { index: number; error: string }[] = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i] || {};
      const name = String(it.name || "").trim();
      if (!name) { errors.push({ index: i, error: "name obligatorio" }); continue; }
      try {
        const id = `acc_${crypto.randomUUID()}`;
        const normalized = name.toLowerCase().trim();
        await c.env.DB.prepare(`
          INSERT INTO sales_accounts (id, name, normalized_name, size, city, origin, duplicate_review_status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(id, name, normalized, it.size ?? null, it.city ?? null, it.origin ?? null).run();
        created.push(id);
      } catch (e: any) {
        errors.push({ index: i, error: e.message || "error insertando" });
      }
    }
    const audit = new AuditService(c.env.DB);
    await audit.record({
      actor_user_id: c.get("user")!.sub,
      actor_email: c.get("user")!.email,
      action: "crm.accounts_bulk_imported",
      entity_type: "account",
      metadata: { created: created.length, errors: errors.length },
      ip: clientIp(c),
    });
    return c.json({ created: created.length, errors, ids: created });
  } catch (err: any) {
    return c.json({ error: err.message || "Error en importación masiva" }, 400);
  }
});
// Importador desde Google Sheets / CSV (Cuentas + Contactos + Pipeline)
crmAccountsRouter.post("/import/sheets", requireRole("write"), handleSheetsImport);

crmAccountsRouter.patch("/:id", requireRole("write"), async (c) => {
  try {
    const id = c.req.param("id");
    const existing: any = await c.env.DB.prepare("SELECT * FROM sales_accounts WHERE id = ?").bind(id).first();
    if (!existing) return c.json({ error: "Cuenta no encontrada." }, 404);

    const body = await c.req.json();
    const name = body?.name !== undefined ? String(body.name).trim() : existing.name;
    if (!name) return c.json({ error: "El campo 'name' no puede estar vacío." }, 400);
    const size = body?.size !== undefined ? body.size : existing.size;
    const city = body?.city !== undefined ? body.city : existing.city;
    const origin = body?.origin !== undefined ? body.origin : existing.origin;
    const status = body?.duplicate_review_status !== undefined ? body.duplicate_review_status : existing.duplicate_review_status;
    const mergedInto = body?.merged_into_account_id !== undefined ? body.merged_into_account_id : existing.merged_into_account_id;
    const normalized = name.toLowerCase().trim();

    await c.env.DB.prepare(`
      UPDATE sales_accounts
      SET name = ?, normalized_name = ?, size = ?, city = ?, origin = ?, duplicate_review_status = ?, merged_into_account_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(name, normalized, size, city, origin, status, mergedInto, id).run();

    const audit = new AuditService(c.env.DB);
    await audit.record({
      actor_user_id: c.get("user")!.sub,
      actor_email: c.get("user")!.email,
      action: "crm.account_updated",
      entity_type: "account",
      entity_id: id,
      metadata: { name, size, city, origin, status },
      ip: clientIp(c),
    });

    const account = await c.env.DB.prepare("SELECT * FROM sales_accounts WHERE id = ?").bind(id).first();
    return c.json({ account });
  } catch (err: any) {
    return c.json({ error: err.message || "Error actualizando cuenta" }, 400);
  }
});

// Merge accounts (admin): mark source as merged into target
crmAccountsRouter.post("/:id/merge", requireRole("admin"), async (c) => {
  try {
    const sourceId = c.req.param("id");
    const body = await c.req.json();
    const targetId = body?.target_id;
    if (!targetId) return c.json({ error: "target_id es obligatorio." }, 400);
    if (sourceId === targetId) return c.json({ error: "No se puede fusionar una cuenta consigo misma." }, 400);

    const source: any = await c.env.DB.prepare("SELECT * FROM sales_accounts WHERE id = ?").bind(sourceId).first();
    const target: any = await c.env.DB.prepare("SELECT * FROM sales_accounts WHERE id = ?").bind(targetId).first();
    if (!source || !target) return c.json({ error: "Cuenta origen o destino no encontrada." }, 404);

    // Reassign related records
    await c.env.DB.prepare("UPDATE sales_leads SET account_id = ? WHERE account_id = ?").bind(targetId, sourceId).run();
    await c.env.DB.prepare("UPDATE sales_contacts SET account_id = ? WHERE account_id = ?").bind(targetId, sourceId).run();
    await c.env.DB.prepare("UPDATE sales_opportunities SET account_id = ? WHERE account_id = ?").bind(targetId, sourceId).run();
    await c.env.DB.prepare("UPDATE sales_activities SET account_id = ? WHERE account_id = ?").bind(targetId, sourceId).run();
    await c.env.DB.prepare("UPDATE sales_tasks SET account_id = ? WHERE account_id = ?").bind(targetId, sourceId).run();

    await c.env.DB.prepare(`
      UPDATE sales_accounts SET duplicate_review_status = 'merged', merged_into_account_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(targetId, sourceId).run();

    const audit = new AuditService(c.env.DB);
    await audit.record({
      actor_user_id: c.get("user")!.sub,
      actor_email: c.get("user")!.email,
      action: "crm.account_merged",
      entity_type: "account",
      entity_id: sourceId,
      metadata: { target_id: targetId },
      ip: clientIp(c),
    });

    return c.json({ success: true, source_id: sourceId, target_id: targetId });
  } catch (err: any) {
    return c.json({ error: err.message || "Error fusionando cuentas" }, 400);
  }
});

// Enriquecimiento Nivel 2 de Titular / Despacho / Cuenta
crmAccountsRouter.post("/:id/enrich", requireRole("write"), async (c) => {
  try {
    const id = c.req.param("id");
    const existing: any = await c.env.DB.prepare("SELECT * FROM sales_accounts WHERE id = ?").bind(id).first();
    if (!existing) return c.json({ error: "Cuenta no encontrada." }, 404);

    let body: any = {};
    try { body = await c.req.json(); } catch {}
    const autoApply = body?.auto_apply !== false;

    // Buscar si ya tiene contactos asociados
    const { results: contacts } = await c.env.DB.prepare(
      "SELECT * FROM sales_contacts WHERE account_id = ? ORDER BY created_at ASC"
    ).bind(id).all();

    const primaryContact: any = contacts && contacts.length > 0 ? contacts[0] : null;

    const enrichment = await enrichLeadByVertical({
      name: primaryContact?.name,
      accountName: existing.name,
      city: existing.city,
      scian: existing.scian_code,
      vertical: resolveTenantId(existing) === "acc_ark_ledger" ? "fiscal" : undefined,
    });

    let updatedContact = primaryContact;

    if (autoApply && enrichment.found) {
      const titularName = (enrichment as any).titular_name || (enrichment as any).doctor_name || (enrichment as any).contact_name;
      const title = (enrichment as any).title || "Socio Director / Titular";
      const phone = enrichment.phone || primaryContact?.phone || null;
      const whatsapp = enrichment.whatsapp || primaryContact?.whatsapp || null;
      const email = (enrichment as any).email || primaryContact?.email || null;

      if (primaryContact) {
        const isPlaceholder = !primaryContact.name || primaryContact.name === "Sin nombre" || primaryContact.name.toLowerCase().includes("contacto corporativo");
        const newName = (isPlaceholder && titularName) ? titularName : (titularName || primaryContact.name);
        const newTitle = title || primaryContact.title;

        await c.env.DB.prepare(`
          UPDATE sales_contacts
          SET name = ?, phone = COALESCE(?, phone), whatsapp = COALESCE(?, whatsapp), email = COALESCE(?, email), title = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(newName, phone, whatsapp, email, newTitle, primaryContact.id).run();

        updatedContact = await c.env.DB.prepare("SELECT * FROM sales_contacts WHERE id = ?").bind(primaryContact.id).first();
      } else if (titularName || phone || email) {
        // Crear contacto titular para la cuenta si no existía ninguno
        const newContactId = `ct_${crypto.randomUUID()}`;
        await c.env.DB.prepare(`
          INSERT INTO sales_contacts (id, account_id, name, email, phone, whatsapp, title, consent_status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(newContactId, id, titularName || "Titular", email, phone, whatsapp, title).run();

        updatedContact = await c.env.DB.prepare("SELECT * FROM sales_contacts WHERE id = ?").bind(newContactId).first();
      }

      await c.env.DB.prepare("UPDATE sales_accounts SET last_enriched_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();

      const audit = new AuditService(c.env.DB);
      await audit.record({
        actor_user_id: c.get("user")!.sub,
        actor_email: c.get("user")!.email,
        action: "crm.account_enriched",
        entity_type: "account",
        entity_id: id,
        metadata: {
          account_name: existing.name,
          titular_found: titularName,
          title,
          phone,
          whatsapp,
          email,
          source_url: enrichment.source_url,
        },
        ip: clientIp(c),
      });
    }

    return c.json({
      success: true,
      enrichment,
      account: { ...existing, last_enriched_at: new Date().toISOString() },
      contact: updatedContact,
    });
  } catch (err: any) {
    return c.json({ error: err.message || "Error enriqueciendo cuenta" }, 400);
  }
});

// Delete account
crmAccountsRouter.delete("/:id", requireRole("write"), async (c) => {
  try {
    const id = c.req.param("id");
    const existing: any = await c.env.DB.prepare("SELECT * FROM sales_accounts WHERE id = ?").bind(id).first();
    if (!existing) return c.json({ error: "Cuenta no encontrada." }, 404);

    // Clean up dependent records to guarantee consistency
    await c.env.DB.prepare("DELETE FROM sales_activities WHERE account_id = ?").bind(id).run();
    await c.env.DB.prepare("DELETE FROM sales_tasks WHERE account_id = ?").bind(id).run();
    await c.env.DB.prepare("DELETE FROM sales_opportunities WHERE account_id = ?").bind(id).run();
    await c.env.DB.prepare("DELETE FROM sales_contacts WHERE account_id = ?").bind(id).run();
    await c.env.DB.prepare("UPDATE sales_leads SET account_id = NULL WHERE account_id = ?").bind(id).run();
    await c.env.DB.prepare("DELETE FROM sales_accounts WHERE id = ?").bind(id).run();

    const audit = new AuditService(c.env.DB);
    await audit.record({
      actor_user_id: c.get("user")!.sub,
      actor_email: c.get("user")!.email,
      action: "crm.account_deleted",
      entity_type: "account",
      entity_id: id,
      metadata: { name: existing.name },
      ip: clientIp(c),
    });

    return c.json({ success: true, id, message: `Cuenta "${existing.name}" eliminada correctamente.` });
  } catch (err: any) {
    return c.json({ error: err.message || "Error eliminando cuenta" }, 400);
  }
});