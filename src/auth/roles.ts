export type CrmRole = "admin" | "vendedor" | "lector";

const ALIASES: Record<string, CrmRole> = {
  admin: "admin",
  administrador: "admin",
  administrator: "admin",
  owner: "admin",
  vendedor: "vendedor",
  seller: "vendedor",
  vendedora: "vendedor",
  sales: "vendedor",
  lector: "lector",
  viewer: "lector",
  reader: "lector",
  readonly: "lector",
  read_only: "lector",
  solo_lectura: "lector",
};

export function normalizeRole(input: unknown): CrmRole | null {
  if (typeof input !== "string") return null;
  const key = input.trim().toLowerCase().replace(/\s+/g, "_");
  return ALIASES[key] ?? null;
}

export function hasPermission(role: CrmRole, level: "read" | "write" | "admin"): boolean {
  if (level === "read") return true;
  if (level === "write") return role === "admin" || role === "vendedor";
  if (level === "admin") return role === "admin";
  return false;
}

export const ALL_ROLES: CrmRole[] = ["admin", "vendedor", "lector"];