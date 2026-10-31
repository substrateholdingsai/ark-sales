import { Hono } from "hono";
import { Env } from "../types";
import { z } from "zod";
import { AuthVariables } from "../auth/middleware";
import { UserService } from "../auth/users";
import { signJwt } from "../auth/jwt";
import { AuditService, clientIp } from "../auth/audit";

export const authRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

function getSecret(env: Env): string {
  if (env.CRM_JWT_SECRET && env.CRM_JWT_SECRET.trim()) return env.CRM_JWT_SECRET;
  if (env.ENVIRONMENT === "production") throw new Error("CRM_JWT_SECRET required");
  return "ark-sales-dev-jwt-secret-change-me";
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
      // requiere admin
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