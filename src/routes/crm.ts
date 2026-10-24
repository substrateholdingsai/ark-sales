import { Hono } from "hono";
import { Env } from "../types";
import { AuthVariables } from "../auth/middleware";
import { requireAuth, requireRole } from "../auth/middleware";
import { AuditService, clientIp } from "../auth/audit";
import { UserService } from "../auth/users";

export const crmRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// Toda la sección CRM requiere autenticación
crmRouter.use("*", requireAuth());

// Endpoint base protegido (cualquier usuario autenticado)
crmRouter.get("/", (c) => {
  const user = c.get("user");
  return c.json({ status: "ok", crm: "ark-sales", user: { id: user!.sub, email: user!.email, role: user!.role } });
});

crmRouter.get("/ping", (c) => {
  const user = c.get("user");
  return c.json({ status: "ok", crm: "ark-sales", user: { id: user!.sub, email: user!.email, role: user!.role } });
});

crmRouter.get("/me", (c) => {
  const user = c.get("user");
  return c.json({ id: user!.sub, email: user!.email, role: user!.role, name: user!.name });
});

// Acción restringida: solo admin
crmRouter.get("/admin/users", requireRole("admin"), async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, email, name, role, is_active, created_at, updated_at FROM crm_users ORDER BY created_at DESC"
  ).all<any>();
  const audit = new AuditService(c.env.DB);
  await audit.record({
    actor_user_id: c.get("user")!.sub,
    actor_email: c.get("user")!.email,
    action: "crm.admin_users_listed",
    entity_type: "user",
    ip: clientIp(c),
  });
  return c.json({ count: results?.length ?? 0, users: results ?? [] });
});

crmRouter.post("/admin/users", requireRole("admin"), async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, name, role } = body || {};
    if (!email || !password) return c.json({ error: "email y password obligatorios." }, 400);
    const svc = new UserService(c.env.DB);
    const user = await svc.create({ email: String(email), password: String(password), name, role });
    const audit = new AuditService(c.env.DB);
    await audit.record({
      actor_user_id: c.get("user")!.sub,
      actor_email: c.get("user")!.email,
      action: "crm.user_created",
      entity_type: "user",
      entity_id: user.id,
      metadata: { email: user.email, role: user.role },
      ip: clientIp(c),
    });
    return c.json({ user }, 201);
  } catch (err: any) {
    return c.json({ error: err.message || "Error creando usuario" }, 400);
  }
});

// Auditoría: solo admin (lectura)
crmRouter.get("/audit", requireRole("admin"), async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") || "50", 10) || 50, 200);
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM crm_audit_log ORDER BY created_at DESC LIMIT ?"
  ).bind(limit).all<any>();
  return c.json({ count: results?.length ?? 0, events: results ?? [] });
});

// Work inbox
crmRouter.get("/inbox", async (c) => {
  const { results: opps } = await c.env.DB.prepare(`
    SELECT o.* FROM sales_opportunities o
    WHERE o.stage NOT IN ('ganado','perdido')
    ORDER BY o.updated_at ASC
  `).all<any>();

  const inbox: any[] = [];
  for (const o of opps || []) {
    const lastAct: any = await c.env.DB.prepare(
      "SELECT created_at FROM sales_activities WHERE opportunity_id = ? ORDER BY created_at DESC LIMIT 1"
    ).bind(o.id).first();
    const lastDate = lastAct?.created_at ? new Date(lastAct.created_at) : new Date(o.created_at);
    const daysSince = (Date.now() - lastDate.getTime()) / 86400000;
    const noRecentActivity = daysSince >= 7;

    const { results: overdueTasks } = await c.env.DB.prepare(`
      SELECT * FROM sales_tasks
      WHERE opportunity_id = ? AND status IN ('pending','in_progress')
        AND due_date IS NOT NULL AND due_date < CURRENT_TIMESTAMP
    `).bind(o.id).all<any>();

    const hasOverdue = (overdueTasks || []).length > 0;
    if (noRecentActivity || hasOverdue) {
      inbox.push({
        opportunity: o,
        days_since_activity: Math.floor(daysSince),
        no_recent_activity: noRecentActivity,
        overdue_tasks: overdueTasks || [],
      });
    }
  }

  const { results: globalOverdue } = await c.env.DB.prepare(`
    SELECT * FROM sales_tasks
    WHERE status IN ('pending','in_progress') AND opportunity_id IS NULL
      AND due_date IS NOT NULL AND due_date < CURRENT_TIMESTAMP
    ORDER BY due_date ASC
  `).all<any>();

  return c.json({ inbox, global_overdue_tasks: globalOverdue || [] });
});

// Métricas básicas del pipeline
crmRouter.get("/metrics", async (c) => {
  const db = c.env.DB;
  const { results: byStage } = await db.prepare(`
    SELECT stage, COUNT(*) as count FROM sales_opportunities GROUP BY stage
  `).all<any>();

  const stageCounts: Record<string, number> = {};
  for (const r of byStage || []) stageCounts[(r as any).stage] = (r as any).count;

  const totalOpps = Object.values(stageCounts).reduce((a, b) => a + b, 0);
  const won = stageCounts["ganado"] || 0;
  const lost = stageCounts["perdido"] || 0;
  const closed = won + lost;
  const conversionRate = closed > 0 ? Math.round((won / closed) * 100) : 0;

  const { results: wonOpps } = await db.prepare(`
    SELECT created_at, updated_at FROM sales_opportunities WHERE stage = 'ganado'
  `).all<any>();
  let avgCloseDays = 0;
  if (wonOpps && wonOpps.length > 0) {
    const days = wonOpps.map((o: any) => {
      const c = new Date(o.created_at).getTime();
      const u = new Date(o.updated_at).getTime();
      return Math.max(0, (u - c) / 86400000);
    });
    avgCloseDays = Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10;
  }

  const overdueRow: any = await db.prepare(`
    SELECT COUNT(*) as n FROM sales_tasks
    WHERE status IN ('pending','in_progress') AND due_date IS NOT NULL AND due_date < CURRENT_TIMESTAMP
  `).first();

  const { results: openOpps } = await db.prepare(`
    SELECT o.id FROM sales_opportunities o
    WHERE o.stage NOT IN ('ganado','perdido')
      AND NOT EXISTS (SELECT 1 FROM sales_tasks t WHERE t.opportunity_id = o.id AND t.status IN ('pending','in_progress'))
  `).all<any>();

  const { results: byActivityType } = await db.prepare(`
    SELECT type, COUNT(*) as count FROM sales_activities GROUP BY type
  `).all<any>();
  const activityCounts: Record<string, number> = {};
  for (const r of byActivityType || []) activityCounts[(r as any).type] = (r as any).count;

  const accountsRow: any = await db.prepare("SELECT COUNT(*) as n FROM sales_accounts").first();
  const contactsRow: any = await db.prepare("SELECT COUNT(*) as n FROM sales_contacts").first();
  const leadsRow: any = await db.prepare("SELECT COUNT(*) as n FROM sales_leads").first();
  const usersRow: any = await db.prepare("SELECT COUNT(*) as n FROM crm_users").first();

  return c.json({
    opportunities: {
      total: totalOpps,
      by_stage: stageCounts,
      won,
      lost,
      closed,
      conversion_rate_percent: conversionRate,
      avg_time_to_close_days: avgCloseDays,
      open_without_next_action: (openOpps || []).length,
    },
    tasks: {
      overdue: overdueRow?.n ?? 0,
    },
    entities: {
      accounts: accountsRow?.n ?? 0,
      contacts: contactsRow?.n ?? 0,
      leads: leadsRow?.n ?? 0,
      users: usersRow?.n ?? 0,
    },
    activities: {
      total: Object.values(activityCounts).reduce((a, b) => a + b, 0),
      by_type: activityCounts,
    },
  });
});