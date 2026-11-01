import { Hono } from "hono";
import { Env } from "../types";
import { z } from "zod";
import { AuthVariables } from "../auth/middleware";
import { requireAuth, requireRole } from "../auth/middleware";
import { UserService } from "../auth/users";
import { signJwt, verifyJwt } from "../auth/jwt";
import { AuditService, clientIp } from "../auth/audit";

export const authRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

function getSecret(env: Env): string {
  if (env.CRM_JWT_SECRET && env.CRM_JWT_SECRET.trim()) return env.CRM_JWT_SECRET.trim();
  return "ark-sales-jwt-production-sovereign-2026-substrate";
}

authRouter.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const loginSchema = z.object({
      email: z.string().optional(),
      username: z.string().optional(),
      user: z.string().optional(),
      password: z.string().optional(),
      pass: z.string().optional(),
    });
    const parsed = loginSchema.safeParse(body || {});
    if (!parsed.success) {
      return c.json({ error: "Payload inválido" }, 400);
    }
    const email = parsed.data.email ?? parsed.data.username ?? parsed.data.user;
    const password = parsed.data.password ?? parsed.data.pass;
    if (!email || !password) {
      return c.json({ error: "email y password son obligatorios." }, 400);
    }
    const svc = new UserService(c.env.DB);
    const user = await svc.authenticate(String(email), String(password));
    if (!user) {
      const audit = new AuditService(c.env.DB);
      await audit.record({
        action: "auth.login_failed",
        entity_type: "auth",
        metadata: { email: String(email).trim().toLowerCase() },
        ip: clientIp(c),
      });
      return c.json({ error: "Credenciales inválidas." }, 401);
    }
    const token = await signJwt(
      { sub: user.id, email: user.email, role: user.role, name: user.name ?? undefined },
      getSecret(c.env)
    );
    const audit = new AuditService(c.env.DB);
    await audit.record({
      actor_user_id: user.id,
      actor_email: user.email,
      action: "auth.login",
      entity_type: "auth",
      ip: clientIp(c),
    });
    c.header("Set-Cookie", `ark_sales_token=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax`);
    return c.json({ token, access_token: token, user });
  } catch (err: any) {
    return c.json({ error: err.message || "Error en login" }, 500);
  }
});

authRouter.post("/logout", async (c) => {
  const user = c.get("user");
  const audit = new AuditService(c.env.DB);
  await audit.record({
    actor_user_id: user?.sub ?? null,
    actor_email: user?.email ?? null,
    action: "auth.logout",
    entity_type: "auth",
    ip: clientIp(c),
  });
  c.header("Set-Cookie", "ark_sales_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
  return c.json({ success: true });
});

authRouter.get("/me", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Autenticación requerida." }, 401);
  const svc = new UserService(c.env.DB);
  const dbUser = await svc.findById(user.sub);
  return c.json({ user: dbUser ?? { id: user.sub, email: user.email, role: user.role, name: user.name } });
});

// Recuperación de contraseña: solicitar token
authRouter.post("/forgot-password", async (c) => {
  try {
    const body = await c.req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    if (!email) return c.json({ error: "email es obligatorio." }, 400);
    const svc = new UserService(c.env.DB);
    const user = await svc.findByEmail(email);
    if (!user) return c.json({ success: true, message: "Si el correo existe, se enviará un enlace de recuperación." });

    const token = await signJwt(
      { sub: user.id, email: user.email, role: "reset", name: user.name ?? undefined },
      getSecret(c.env),
      15 * 60
    );

    if (c.env.RESEND_API_KEY) {
      try {
        const from = c.env.RESEND_FROM_EMAIL || "ventas@arksystems.site";
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.env.RESEND_API_KEY}` },
          body: JSON.stringify({
            from,
            to: [user.email],
            subject: "Recuperación de contraseña · ARK CRM",
            html: `<p>Usa este enlace para restablecer tu contraseña:</p><p><a href="${c.env.SALES_API_URL || "https://sales.arksystems.site"}/crm/login?reset=${encodeURIComponent(token)}">Restablecer contraseña</a></p><p>Expira en 15 minutos.</p>`,
          }),
        });
      } catch (e) { console.warn("[auth] resend error:", e); }
    }

    const audit = new AuditService(c.env.DB);
    await audit.record({ actor_user_id: user.id, actor_email: user.email, action: "auth.password_reset_requested", entity_type: "auth", ip: clientIp(c) });

    const devMode = !c.env.RESEND_API_KEY;
    return c.json({ success: true, message: "Si el correo existe, se enviará un enlace de recuperación.", ...(devMode ? { reset_token: token } : {}) });
  } catch (err: any) {
    return c.json({ error: err.message || "Error en recuperación" }, 400);
  }
});

// Restablecer contraseña con token
authRouter.post("/reset-password", async (c) => {
  try {
    const body = await c.req.json();
    const token = String(body?.token || "");
    const password = String(body?.password || "");
    if (!token || !password) return c.json({ error: "token y password son obligatorios." }, 400);
    if (password.length < 6) return c.json({ error: "La contraseña debe tener al menos 6 caracteres." }, 400);

    const payload = await verifyJwt(token, getSecret(c.env));
    if (!payload || payload.role !== "reset") return c.json({ error: "Token inválido o expirado." }, 400);

    const svc = new UserService(c.env.DB);
    const user = await svc.findById(payload.sub);
    if (!user) return c.json({ error: "Usuario no encontrado." }, 404);

    await svc.updatePassword(user.id, password);

    const audit = new AuditService(c.env.DB);
    await audit.record({ actor_user_id: user.id, actor_email: user.email, action: "auth.password_reset", entity_type: "auth", ip: clientIp(c) });

    return c.json({ success: true, message: "Contraseña actualizada." });
  } catch (err: any) {
    return c.json({ error: err.message || "Error restableciendo contraseña" }, 400);
  }
});

// Invitar usuario (solo admin)
authRouter.post("/invite", requireAuth(), requireRole("admin"), async (c) => {
  try {
    const body = await c.req.json();
    const email = String(body?.email || "").trim();
    const name = body?.name ?? null;
    const role = body?.role ?? "vendedor";
    if (!email) return c.json({ error: "email es obligatorio." }, 400);

    const svc = new UserService(c.env.DB);
    const tempPassword = `Tmp-${crypto.randomUUID().slice(0, 8)}`;
    let user;
    try {
      user = await svc.create({ email, password: tempPassword, name, role });
    } catch (e: any) {
      const existing = await svc.findByEmail(email);
      if (!existing) throw e;
      user = existing;
    }

    const token = await signJwt(
      { sub: user.id, email: user.email, role: "reset", name: user.name ?? undefined },
      getSecret(c.env),
      24 * 60 * 60
    );

    if (c.env.RESEND_API_KEY) {
      try {
        const from = c.env.RESEND_FROM_EMAIL || "ventas@arksystems.site";
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.env.RESEND_API_KEY}` },
          body: JSON.stringify({
            from,
            to: [user.email],
            subject: "Invitación a ARK CRM",
            html: `<p>Has sido invitado a ARK CRM.</p><p>Define tu contraseña aquí:</p><p><a href="${c.env.SALES_API_URL || "https://sales.arksystems.site"}/crm/login?reset=${encodeURIComponent(token)}">Aceptar invitación</a></p>`,
          }),
        });
      } catch (e) { console.warn("[auth] resend error:", e); }
    }

    const audit = new AuditService(c.env.DB);
    await audit.record({ actor_user_id: c.get("user")!.sub, actor_email: c.get("user")!.email, action: "auth.user_invited", entity_type: "user", entity_id: user.id, metadata: { email: user.email, role }, ip: clientIp(c) });

    const devMode = !c.env.RESEND_API_KEY;
    return c.json({ success: true, user, ...(devMode ? { reset_token: token } : {}) }, 201);
  } catch (err: any) {
    return c.json({ error: err.message || "Error invitando usuario" }, 400);
  }
});

// Registro: bootstrap público si no hay usuarios; después solo admin.
authRouter.post("/register", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, name, role } = body || {};
    if (!email || !password) {
      return c.json({ error: "email y password son obligatorios." }, 400);
    }
    const svc = new UserService(c.env.DB);
    const count = await svc.count();
    const currentUser = c.get("user");

    if (count > 0) {
      if (!currentUser || currentUser.role !== "admin") {
        return c.json({ error: "Solo un administrador puede registrar usuarios." }, 403);
      }
    }

    const requestedRole = role ?? (count === 0 ? "admin" : "vendedor");
    const user = await svc.create({ email: String(email), password: String(password), name, role: requestedRole });

    const audit = new AuditService(c.env.DB);
    await audit.record({
      actor_user_id: currentUser?.sub ?? user.id,
      actor_email: currentUser?.email ?? user.email,
      action: count === 0 ? "auth.bootstrap_admin" : "auth.user_created",
      entity_type: "user",
      entity_id: user.id,
      metadata: { email: user.email, role: user.role },
      ip: clientIp(c),
    });

    return c.json({ user }, 201);
  } catch (err: any) {
    return c.json({ error: err.message || "Error en registro" }, 400);
  }
});
