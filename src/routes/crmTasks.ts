import { Hono } from "hono";
import { Env } from "../types";
import { AuthVariables } from "../auth/middleware";
import { requireAuth, requireRole } from "../auth/middleware";
import { AuditService, clientIp } from "../auth/audit";

export const crmTasksRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();
crmTasksRouter.use("*", requireAuth());

function parsePagination(c: any) {
  const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "20", 10) || 20, 1), 100);
  const offset = Math.max(parseInt(c.req.query("offset") || "0", 10) || 0, 0);
  return { limit, offset };
}

crmTasksRouter.get("/", async (c) => {
  const { limit, offset } = parsePagination(c);
  const status = c.req.query("status");
  const owner = c.req.query("owner") || c.req.query("owner_user_id");
  const accountId = c.req.query("account_id");
  const opportunityId = c.req.query("opportunity_id");
  const leadId = c.req.query("lead_id");
  const overdue = c.req.query("overdue");
  let sql = "SELECT * FROM sales_tasks WHERE 1=1";
  const params: any[] = [];
  if (status) { sql += " AND status = ?"; params.push(status); }
  if (owner) { sql += " AND owner_user_id = ?"; params.push(owner); }
  if (accountId) { sql += " AND account_id = ?"; params.push(accountId); }
  if (opportunityId) { sql += " AND opportunity_id = ?"; params.push(opportunityId); }
  if (leadId) { sql += " AND lead_id = ?"; params.push(leadId); }
  if (overdue === "true") {
    sql += " AND status IN ('pending','in_progress') AND due_date IS NOT NULL AND due_date < CURRENT_TIMESTAMP";
  }
  sql += " ORDER BY CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC, created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);
  const stmt = c.env.DB.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const { results } = await bound.all();
  return c.json({ items: results || [], limit, offset });
});

crmTasksRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const task: any = await c.env.DB.prepare("SELECT * FROM sales_tasks WHERE id = ?").bind(id).first();
  if (!task) return c.json({ error: "Tarea no encontrada." }, 404);
  return c.json({ task });
});

crmTasksRouter.post("/", requireRole("write"), async (c) => {
  try {
    const body = await c.req.json();
    const title = (body?.title || "").trim();
    if (!title) return c.json({ error: "El campo 'title' es obligatorio." }, 400);
    const id = `tsk_${crypto.randomUUID()}`;
    const accountId = body?.account_id ?? null;
    const contactId = body?.contact_id ?? null;
    const opportunityId = body?.opportunity_id ?? null;
    const leadId = body?.lead_id ?? null;
    const description = body?.description ?? null;
    const owner = body?.owner_user_id ?? null;
    const dueDate = body?.due_date ?? null;
    const status = body?.status || "pending";
    const validStatuses = ["pending","in_progress","done","cancelled"];
    if (!validStatuses.includes(status)) return c.json({ error: "Estado inválido." }, 400);

    await c.env.DB.prepare(`
      INSERT INTO sales_tasks (id, account_id, contact_id, opportunity_id, lead_id, title, description, owner_user_id, due_date, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(id, accountId, contactId, opportunityId, leadId, title, description, owner, dueDate, status).run();

    const audit = new AuditService(c.env.DB);
    await audit.record({
      actor_user_id: c.get("user")!.sub,
      actor_email: c.get("user")!.email,
      action: "crm.task_created",
      entity_type: "task",
      entity_id: id,
      metadata: { title, owner_user_id: owner, due_date: dueDate },
      ip: clientIp(c),
    });

    const task = await c.env.DB.prepare("SELECT * FROM sales_tasks WHERE id = ?").bind(id).first();
    return c.json({ task }, 201);
  } catch (err: any) {
    return c.json({ error: err.message || "Error creando tarea" }, 400);
  }
});

crmTasksRouter.patch("/:id", requireRole("write"), async (c) => {
  try {
    const id = c.req.param("id");
    const existing: any = await c.env.DB.prepare("SELECT * FROM sales_tasks WHERE id = ?").bind(id).first();
    if (!existing) return c.json({ error: "Tarea no encontrada." }, 404);

    const body = await c.req.json();
    const title = body?.title !== undefined ? String(body.title).trim() : existing.title;
    if (!title) return c.json({ error: "El título no puede estar vacío." }, 400);
    const description = body?.description !== undefined ? body.description : existing.description;
    const owner = body?.owner_user_id !== undefined ? body.owner_user_id : existing.owner_user_id;
    const dueDate = body?.due_date !== undefined ? body.due_date : existing.due_date;
    const status = body?.status !== undefined ? body.status : existing.status;
    const validStatuses = ["pending","in_progress","done","cancelled"];
    if (!validStatuses.includes(status)) return c.json({ error: "Estado inválido." }, 400);

    await c.env.DB.prepare(`
      UPDATE sales_tasks
      SET title = ?, description = ?, owner_user_id = ?, due_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(title, description, owner, dueDate, status, id).run();

    const audit = new AuditService(c.env.DB);
    await audit.record({
      actor_user_id: c.get("user")!.sub,
      actor_email: c.get("user")!.email,
      action: "crm.task_updated",
      entity_type: "task",
      entity_id: id,
      metadata: { status, owner_user_id: owner },
      ip: clientIp(c),
    });

    const task = await c.env.DB.prepare("SELECT * FROM sales_tasks WHERE id = ?").bind(id).first();
    return c.json({ task });
  } catch (err: any) {
    return c.json({ error: err.message || "Error actualizando tarea" }, 400);
  }
});

crmTasksRouter.post("/:id/complete", requireRole("write"), async (c) => {
  const id = c.req.param("id");
  const existing: any = await c.env.DB.prepare("SELECT * FROM sales_tasks WHERE id = ?").bind(id).first();
  if (!existing) return c.json({ error: "Tarea no encontrada." }, 404);
  await c.env.DB.prepare("UPDATE sales_tasks SET status = 'done', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
  const audit = new AuditService(c.env.DB);
  await audit.record({
    actor_user_id: c.get("user")!.sub,
    actor_email: c.get("user")!.email,
    action: "crm.task_completed",
    entity_type: "task",
    entity_id: id,
    ip: clientIp(c),
  });
  const task = await c.env.DB.prepare("SELECT * FROM sales_tasks WHERE id = ?").bind(id).first();
  return c.json({ task });
});