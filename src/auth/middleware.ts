import { createMiddleware } from "hono/factory";
import { Env } from "../types";
import { verifyJwt, JwtPayload } from "./jwt";
import { normalizeRole, CrmRole } from "./roles";

export type AuthVariables = {
  user: (JwtPayload & { role: CrmRole }) | null;
};

export function getJwtSecret(env: Env): string | null {
  const s = env.CRM_JWT_SECRET;
  if (s && s.trim()) return s.trim();
  if ((env.ENVIRONMENT || "development") === "production") {
    return null;
  }
  return "ark-sales-dev-only-jwt-secret";
}

export function authMiddleware() {
  return createMiddleware<{ Bindings: Env; Variables: AuthVariables }>(async (c, next) => {
    c.set("user", null);
    let token: string | null = null;

    const authHeader = c.req.header("authorization") || c.req.header("Authorization");
    if (authHeader && /^Bearer\s+/i.test(authHeader)) {
      token = authHeader.replace(/^Bearer\s+/i, "").trim();
    }

    if (!token) {
      const cookie = c.req.header("cookie") || "";
      const match = cookie.match(/(?:^|;\s*)ark_sales_token=([^;]+)/);
      if (match) token = decodeURIComponent(match[1]);
    }

    if (!token) {
      await next();
      return;
    }

    try {
      const secret = getJwtSecret(c.env);
      if (!secret) {
        await next();
        return;
      }
      const payload = await verifyJwt(token, secret);
      if (payload) {
        const role = normalizeRole(payload.role);
        if (role) {
          c.set("user", { ...payload, role });
        }
      }
    } catch {
      // ignore
    }
    await next();
  });
}

export function requireAuth() {
  return createMiddleware<{ Bindings: Env; Variables: AuthVariables }>(async (c, next) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Autenticación requerida." }, 401);
    }
    await next();
  });
}

export function requireRole(level: "read" | "write" | "admin") {
  return createMiddleware<{ Bindings: Env; Variables: AuthVariables }>(async (c, next) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Autenticación requerida." }, 401);
    }
    // lazy import to avoid cycle
    const { hasPermission } = await import("./roles");
    if (!hasPermission(user.role, level)) {
      return c.json({ error: "No tienes permisos para esta acción." }, 403);
    }
    await next();
  });
}