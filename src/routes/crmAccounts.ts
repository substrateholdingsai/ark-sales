import { Hono } from "hono";
import { Env } from "../types";
import { AuthVariables } from "../auth/middleware";
import { requireAuth, requireRole } from "../auth/middleware";
import { AuditService, clientIp } from "../auth/audit";

export const crmAccountsRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
crmAccountsRouter.use("*", requireAuth());

const FUTURA_SCIANS = new Set([
  "531210", "531311", "523920",
  "621111", "621112", "621211", "621511", "622111",
  "484111", "484121", "493111", "488511",
  "721111", "721190", "531110", "551110"
]);

export function resolveTenantId(a: any): string {
  if (a.tenant_id) return a.tenant_id;
  const id = String(a.id || "").toLowerCase();
  const name = String(a.name || "").toLowerCase();
  const origin = String(a.origin || "").toLowerCase();
  const source = String(a.harvest_source || a.origin || "").toLowerCase();
  const scian = String(a.scian_code || "").trim();

  if (
    id.includes("futura") ||
    name.includes("futura capital") ||
    origin.includes("futura") ||
    origin.includes("proptech") ||
    origin.includes("inmobiliaria") ||
    source.includes("hermes") ||
    source.includes("vektor")
  ) {
    return "acc_futura_capital";
  }

  if (scian && FUTURA_SCIANS.has(scian)) {
    return "acc_futura_capital";
  }

  return "acc_ark_ledger";
}

function parsePagination(c: any) {
  const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "20", 10) || 20, 1), 5000);
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

  let sql = "SELECT * FROM sales_accounts WHERE 1=1";
  const params: any[] = [];
  if (q) {
    sql += " AND (name LIKE ? OR normalized_name LIKE ?)";
    params.push(`%${q}%`, `%${q.toLowerCase()}%`);
  }
  if (origin) { sql += " AND origin = ?"; params.push(origin); }
  if (size) { sql += " AND size = ?"; params.push(size); }
  if (duplicate) { sql += " AND duplicate_review_status = ?"; params.push(duplicate); }
  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const stmt = c.env.DB.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const { results } = await bound.all();

  // total count
  let countSql = "SELECT COUNT(*) as n FROM sales_accounts WHERE 1=1";
  const cparams: any[] = [];
  if (q) { countSql += " AND (name LIKE ? OR normalized_name LIKE ?)"; cparams.push(`%${q}%`, `%${q.toLowerCase()}%`); }
  if (origin) { countSql += " AND origin = ?"; cparams.push(origin); }
  if (size) { countSql += " AND size = ?"; cparams.push(size); }
  if (duplicate) { countSql += " AND duplicate_review_status = ?"; cparams.push(duplicate); }
  const countStmt = c.env.DB.prepare(countSql);
  const countBound = cparams.length ? countStmt.bind(...cparams) : countStmt;
  const countRow: any = await countBound.first();

  let items = (results || []).map((row: any) => ({
    ...row,
    tenant_id: resolveTenantId(row)
  }));

  const tenantFilter = c.req.query("tenant") || c.req.query("tenant_id");
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
  const { results: activities } = await c.env.DB.prepare("SELECT * FROM sales_activities WHERE account_id = ? ORDER BY created_at DESC LIMIT 50").bind(id).all();
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