// src/services/sheetsImport.ts
// Importador universal para Google Sheets / TSV / CSV a Cuentas, Contactos y Pipeline

import { AuditService, clientIp } from "../auth/audit";

export interface SheetRowItem {
  despacho_nombre?: string;
  empresa?: string;
  name?: string;
  razon_social?: string;

  titular_nombre?: string;
  contacto?: string;
  contact_name?: string;

  email?: string;
  correo?: string;

  telefono?: string;
  whatsapp?: string;
  phone?: string;

  ciudad?: string;
  city?: string;
}

export interface ParsedSheetRow {
  despacho_nombre: string;
  titular_nombre: string;
  email: string;
  telefono: string;
  ciudad: string;
}

export function parseRawSheetsText(text: string): ParsedSheetRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  // Detectar si la primera fila es encabezado (no debe contener '@' de un email de datos)
  const firstLineLower = lines[0].toLowerCase();
  const hasEmail = lines[0].includes("@");
  const hasHeader =
    !hasEmail &&
    (firstLineLower.includes("despacho") ||
      firstLineLower.includes("empresa") ||
      firstLineLower.includes("titular") ||
      firstLineLower.includes("contacto") ||
      firstLineLower.includes("correo") ||
      firstLineLower.includes("email") ||
      firstLineLower.includes("telefono") ||
      firstLineLower.includes("whatsapp") ||
      firstLineLower.includes("ciudad"));

  const startIdx = hasHeader ? 1 : 0;
  let colMap: Record<string, number> = {};

  if (hasHeader) {
    const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
    const headerCols = lines[0].split(sep).map((c) => c.trim().toLowerCase().replace(/^["']|["']$/g, ""));
    headerCols.forEach((col, idx) => {
      if (col.includes("despacho") || col.includes("empresa") || col.includes("razon") || col === "nombre") {
        if (colMap.despacho === undefined) colMap.despacho = idx;
      } else if (col.includes("titular") || col.includes("contacto") || col.includes("socio") || col.includes("persona")) {
        colMap.titular = idx;
      } else if (col.includes("email") || col.includes("correo")) {
        colMap.email = idx;
      } else if (col.includes("tel") || col.includes("whatsapp") || col.includes("celular") || col.includes("movil")) {
        colMap.telefono = idx;
      } else if (col.includes("ciudad") || col.includes("plaza") || col.includes("municipio") || col.includes("estado")) {
        colMap.ciudad = idx;
      }
    });
  }

  const results: ParsedSheetRow[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Preferir tabulador (copiar-pegar típico de Google Sheets / Excel), luego punto y coma o coma
    const sep = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
    const parts = line.split(sep).map((s) => s.trim().replace(/^["']|["']$/g, ""));

    let despacho = "";
    let titular = "";
    let email = "";
    let telefono = "";
    let ciudad = "";

    if (hasHeader && Object.keys(colMap).length > 0) {
      if (colMap.despacho !== undefined && parts[colMap.despacho]) despacho = parts[colMap.despacho];
      if (colMap.titular !== undefined && parts[colMap.titular]) titular = parts[colMap.titular];
      if (colMap.email !== undefined && parts[colMap.email]) email = parts[colMap.email];
      if (colMap.telefono !== undefined && parts[colMap.telefono]) telefono = parts[colMap.telefono];
      if (colMap.ciudad !== undefined && parts[colMap.ciudad]) ciudad = parts[colMap.ciudad];
    } else {
      // Orden estándar si no hay cabecera: Despacho | Titular | Email | Teléfono | Ciudad
      despacho = parts[0] || "";
      titular = parts[1] || "";
      email = parts[2] || "";
      telefono = parts[3] || "";
      ciudad = parts[4] || "";
    }

    if (despacho || titular || email) {
      results.push({
        despacho_nombre: despacho,
        titular_nombre: titular,
        email,
        telefono,
        ciudad,
      });
    }
  }

  return results;
}

export function normalizeSheetItems(rawItems: any[]): ParsedSheetRow[] {
  const results: ParsedSheetRow[] = [];
  for (const row of rawItems) {
    if (!row || typeof row !== "object") continue;
    const despacho = String(row.despacho_nombre || row.empresa || row.name || row.razon_social || "").trim();
    const titular = String(row.titular_nombre || row.contacto || row.contact_name || (row.name && row.despacho_nombre ? row.name : "")).trim();
    const email = String(row.email || row.correo || "").trim().toLowerCase();
    const telefono = String(row.telefono || row.whatsapp || row.phone || "").trim();
    const ciudad = String(row.ciudad || row.city || "").trim();

    if (despacho || titular || email) {
      results.push({
        despacho_nombre: despacho,
        titular_nombre: titular,
        email,
        telefono,
        ciudad,
      });
    }
  }
  return results;
}

export async function processSheetImport(
  db: any,
  rows: ParsedSheetRow[],
  actorUserId?: string | null
): Promise<{
  success: boolean;
  imported_accounts: number;
  imported_contacts: number;
  imported_opportunities: number;
  total_processed: number;
  errors: { index: number; error: string; row?: any }[];
}> {
  let importedAccounts = 0;
  let importedContacts = 0;
  let importedOpportunities = 0;
  const errors: { index: number; error: string; row?: any }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const despacho = row.despacho_nombre.trim();
    const titular = row.titular_nombre.trim();
    const email = row.email.trim().toLowerCase();
    const telefono = row.telefono.trim();
    const ciudad = row.ciudad.trim();

    if (!despacho && !titular && !email) {
      errors.push({ index: i, error: "Fila sin datos mínimos (despacho, titular o email requeridos)", row });
      continue;
    }

    const finalDespachoName = despacho || (titular ? `Despacho ${titular}` : (email ? `Despacho ${email.split("@")[0]}` : "Despacho Prospecto"));
    const finalTitularName = titular || "Socio / Titular";

    try {
      // 1. sales_accounts (id: acc_..., name, city, origin: 'google_sheets', tenant_id: 'acc_ark_ledger')
      const normalized = finalDespachoName.toLowerCase().trim();
      let accountId: string;

      let existingAcc: any = null;
      try {
        existingAcc = await db.prepare(
          "SELECT id, city FROM sales_accounts WHERE normalized_name = ? OR name = ? LIMIT 1"
        ).bind(normalized, finalDespachoName).first();
      } catch {}

      if (existingAcc) {
        accountId = existingAcc.id;
        if (ciudad && !existingAcc.city) {
          try {
            await db.prepare("UPDATE sales_accounts SET city = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
              .bind(ciudad, accountId)
              .run();
          } catch {}
        }
      } else {
        accountId = `acc_${crypto.randomUUID().slice(0, 8)}`;
        try {
          await db.prepare(`
            INSERT INTO sales_accounts (id, name, normalized_name, city, origin, tenant_id, duplicate_review_status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'google_sheets', 'acc_ark_ledger', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).bind(accountId, finalDespachoName, normalized, ciudad || null).run();
        } catch {
          // Fallback en caso de que la columna tenant_id aún no esté en el schema
          await db.prepare(`
            INSERT INTO sales_accounts (id, name, normalized_name, city, origin, duplicate_review_status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'google_sheets', 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).bind(accountId, finalDespachoName, normalized, ciudad || null).run();
        }
        importedAccounts++;
      }

      // 2. sales_contacts (id: ct_..., account_id, name: titular, email, phone, title: 'Socio / Titular')
      let contactId: string;
      let existingContact: any = null;

      try {
        if (email) {
          existingContact = await db.prepare(
            "SELECT id, phone, whatsapp FROM sales_contacts WHERE account_id = ? AND email = ? LIMIT 1"
          ).bind(accountId, email).first();
        }
        if (!existingContact && titular && titular !== "Socio / Titular") {
          existingContact = await db.prepare(
            "SELECT id, phone, whatsapp FROM sales_contacts WHERE account_id = ? AND name = ? LIMIT 1"
          ).bind(accountId, titular).first();
        }
      } catch {}

      if (existingContact) {
        contactId = existingContact.id;
        if (telefono && (!existingContact.phone || !existingContact.whatsapp)) {
          try {
            await db.prepare(
              "UPDATE sales_contacts SET phone = COALESCE(phone, ?), whatsapp = COALESCE(whatsapp, ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            ).bind(telefono, telefono, contactId).run();
          } catch {}
        }
      } else {
        contactId = `ct_${crypto.randomUUID().slice(0, 8)}`;
        await db.prepare(`
          INSERT INTO sales_contacts (id, account_id, name, email, phone, whatsapp, title, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'Socio / Titular', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(contactId, accountId, finalTitularName, email || null, telefono || null, telefono || null).run();
        importedContacts++;
      }

      // 3. sales_opportunities (id: opp_..., stage: 'calificado', products_interest_json: '["ledger_pro"]', estimated_value: 399.0)
      let existingOpp: any = null;
      try {
        existingOpp = await db.prepare(
          "SELECT id, stage FROM sales_opportunities WHERE account_id = ? OR contact_id = ? LIMIT 1"
        ).bind(accountId, contactId).first();
      } catch {}

      if (!existingOpp) {
        const oppId = `opp_${crypto.randomUUID().slice(0, 8)}`;
        await db.prepare(`
          INSERT INTO sales_opportunities (id, account_id, contact_id, stage, products_interest_json, estimated_value, currency, created_at, updated_at)
          VALUES (?, ?, ?, 'calificado', '["ledger_pro"]', 399.0, 'MXN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(oppId, accountId, contactId).run();
        importedOpportunities++;
      }

    } catch (err: any) {
      errors.push({ index: i, error: err.message || "Error procesando registro", row });
    }
  }

  return {
    success: errors.length === 0 || importedAccounts > 0 || importedContacts > 0,
    imported_accounts: importedAccounts,
    imported_contacts: importedContacts,
    imported_opportunities: importedOpportunities,
    total_processed: rows.length,
    errors,
  };
}

export async function handleSheetsImport(c: any) {
  try {
    const contentType = c.req.header("content-type") || "";
    let rows: ParsedSheetRow[] = [];

    if (contentType.includes("application/json")) {
      const body = await c.req.json().catch(() => ({}));
      if (Array.isArray(body?.items)) {
        rows = normalizeSheetItems(body.items);
      } else {
        const raw = body?.text || body?.tsv || body?.csv || body?.data || body?.raw || "";
        if (typeof raw === "string" && raw.trim()) {
          rows = parseRawSheetsText(raw);
        }
      }
    } else {
      const rawText = await c.req.text().catch(() => "");
      if (rawText.trim()) {
        rows = parseRawSheetsText(rawText);
      }
    }

    if (!rows.length) {
      return c.json({
        error: "No se encontraron filas válidas para importar. Proporciona un JSON con { items: [...] } o texto delimitado por tabuladores o comas.",
      }, 400);
    }

    const userId = c.get("user")?.sub || null;
    const result = await processSheetImport(c.env.DB, rows, userId);

    if (c.env.DB) {
      try {
        const audit = new AuditService(c.env.DB);
        await audit.record({
          actor_user_id: c.get("user")?.sub || "system",
          actor_email: c.get("user")?.email || "unknown@domain.com",
          action: "crm.sheets_imported",
          entity_type: "account",
          metadata: {
            imported_accounts: result.imported_accounts,
            imported_contacts: result.imported_contacts,
            imported_opportunities: result.imported_opportunities,
            total_rows: rows.length,
          },
          ip: clientIp(c),
        });
      } catch {}
    }

    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message || "Error procesando importación de Google Sheets" }, 400);
  }
}
