import { Env } from "../types";
import { normalizeRole, CrmRole } from "./roles";
import { hashPassword, verifyPassword } from "./password";

export type CrmUser = {
  id: string;
  email: string;
  name: string | null;
  role: CrmRole;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export class UserService {
  constructor(private db: any) {}

  async findByEmail(email: string): Promise<(CrmUser & { password_hash: string }) | null> {
    if (!this.db) return null;
    const row = await (this.db as any)
      .prepare("SELECT * FROM crm_users WHERE email = ? LIMIT 1")
      .bind(email.trim().toLowerCase())
      .first();
    if (!row) return null;
    const role = normalizeRole(row.role);
    if (!role) return null;
    return { ...row, role };
  }

  async findById(id: string): Promise<CrmUser | null> {
    if (!this.db) return null;
    const row = await (this.db as any).prepare("SELECT id, email, name, role, is_active, created_at, updated_at FROM crm_users WHERE id = ? LIMIT 1").bind(id).first();
    if (!row) return null;
    const role = normalizeRole(row.role);
    if (!role) return null;
    return { ...row, role };
  }

  async count(): Promise<number> {
    if (!this.db) return 0;
    const row = await (this.db as any).prepare("SELECT COUNT(*) as n FROM crm_users").first();
    return row?.n ?? 0;
  }

  async create(params: { email: string; password: string; name?: string; role?: string }): Promise<CrmUser> {
    if (!this.db) throw new Error("DB no disponible");
    const email = params.email.trim().toLowerCase();
    const role = normalizeRole(params.role ?? "vendedor");
    if (!role) throw new Error("Rol inválido");
    const existing = await this.findByEmail(email);
    if (existing) throw new Error("El usuario ya existe");
    const id = `usr_${crypto.randomUUID()}`;
    const password_hash = await hashPassword(params.password);
    await this.db
      .prepare(
        `INSERT INTO crm_users (id, email, password_hash, name, role, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )
      .bind(id, email, password_hash, params.name ?? null, role)
      .run();
    const created = await this.findById(id);
    if (!created) throw new Error("No se pudo crear el usuario");
    return created;
  }

  async authenticate(email: string, password: string): Promise<CrmUser | null> {
    const user = await this.findByEmail(email);
    if (!user) return null;
    if (!user.is_active) return null;
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}