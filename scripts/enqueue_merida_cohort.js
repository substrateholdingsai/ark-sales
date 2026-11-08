const { execSync } = require("child_process");

function isGenericFirmName(name) {
  if (!name || typeof name !== "string") return true;
  const cleaned = name.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,\-_/\\()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 3) return true;
  const genericExact = new Set([
    "despacho", "despacho contable", "despachos", "contabilidad", "contable",
    "contador", "contadores", "asesoria", "asesorias", "consultoria", "consultorias",
    "consultores", "abogados", "sin nombre", "corporativo", "unknown", "n a", "na", "null", "none",
    "asesoria contable", "asesoria fiscal", "servicios contables", "despacho sc", "s n", "sn", "no aplica", "desconocido"
  ]);
  if (genericExact.has(cleaned)) return true;
  const stripped = cleaned
    .replace(/^(despacho\s+contable|despacho|contabilidad|contadores|contador|asesoria|consultoria)\s*/g, "")
    .replace(/\s*(despacho\s+contable|despacho|contabilidad|contadores|contador|asesoria|consultoria)$/g, "")
    .trim();
  if (stripped.length === 0) return true;
  return false;
}

function isValidEmailFormat(email) {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return false;
  if (
    trimmed.includes("@harvest.arksystems.local") ||
    trimmed.endsWith("@example.com") ||
    trimmed.endsWith(".example.com") ||
    trimmed.includes("example.com") ||
    trimmed.includes("@test.com") ||
    trimmed.includes("@placeholder.com") ||
    trimmed.includes("noemail") ||
    trimmed.includes("sincorreo") ||
    trimmed.includes("noreply") ||
    trimmed.includes("no-reply")
  ) {
    return false;
  }
  return true;
}

function runD1Query(query) {
  const singleLine = query.replace(/\s+/g, " ").trim();
  const jsonCmd = `npx wrangler d1 execute ark-sales-db --remote --json --command "${singleLine.replace(/"/g, '\\"')}"`;
  const stdout = execSync(jsonCmd, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  const match = stdout.match(/\[\s*\{\s*"results":/);
  if (!match) {
    throw new Error("No results array found in wrangler output:\n" + stdout);
  }
  const startIdx = match.index;
  const endIdx = stdout.lastIndexOf("]");
  const parsed = JSON.parse(stdout.slice(startIdx, endIdx + 1));
  return parsed[0].results || [];
}

async function main() {
  console.log("=== ENCOLANDO LOTE DE 20 DESPACHOS DE MÉRIDA (STAYPUFT) ===");
  
  const candidateQuery = `
    SELECT a.id as account_id, a.name as account_name, a.scian_code, a.city, a.tenant_id, a.origin, a.created_at,
           l.id as lead_id, l.email as lead_email, l.despacho_nombre, l.estado as lead_estado,
           c.email as contact_email, c.name as contact_name
    FROM sales_accounts a
    LEFT JOIN sales_leads l ON (l.account_id = a.id OR l.id = a.id)
    LEFT JOIN sales_contacts c ON (c.account_id = a.id)
    WHERE (a.scian_code IN ('541211', '541212') OR l.dolor_detectado = 'fiscal')
      AND (a.city LIKE '%merida%' OR a.city LIKE '%mérida%' OR a.city LIKE '%yucat%')
      AND (a.id NOT LIKE '%sipres%' AND a.name NOT LIKE '%sofom%' AND a.name NOT LIKE '%s.a.p.i.%')
    ORDER BY a.created_at ASC
    LIMIT 100
  `;

  const candidateRows = runD1Query(candidateQuery);
  console.log(`Candidatos cargados desde D1: ${candidateRows.length}`);

  const existingTasks = runD1Query("SELECT lead_id, skill_name, operator, status FROM agent_tasks WHERE skill_name = 'research_prospect_web'");
  const existingSet = new Set(existingTasks.map(t => String(t.lead_id)));
  console.log(`Tareas existentes previamente en agent_tasks: ${existingSet.size}`);

  const limit = 20;
  const skillName = "research_prospect_web";
  const operator = "staypuft";
  const enqueued = [];
  const skipped = [];
  const seenEmails = new Set();
  const insertStatements = [];

  for (const row of candidateRows) {
    if (enqueued.length >= limit) break;

    const leadId = String(row.lead_id || row.account_id);
    const firmName = String(row.despacho_nombre || row.account_name || "").trim();
    const email = String(row.lead_email || row.contact_email || "").trim().toLowerCase();
    const scian = String(row.scian_code || "").trim();
    const city = String(row.city || "").toLowerCase();

    // Filtro 1: SCIAN
    if (scian !== "541211" && scian !== "541212") {
      skipped.push({ lead_id: leadId, firmName, reason: "scian_no_es_541211_o_541212" });
      continue;
    }

    // Filtro 2: Ciudad Mérida
    if (!city.includes("merida") && !city.includes("mérida") && !city.includes("yucat")) {
      skipped.push({ lead_id: leadId, firmName, reason: "ciudad_no_merida" });
      continue;
    }

    // Filtro 3: No SOFOM / SIPRES
    if (leadId.toLowerCase().includes("sipres") || firmName.toLowerCase().includes("sofom") || firmName.toLowerCase().includes("s.a.p.i.")) {
      skipped.push({ lead_id: leadId, firmName, reason: "origen_sipres_sofom" });
      continue;
    }

    // Filtro 4: Nombre real
    if (isGenericFirmName(firmName)) {
      skipped.push({ lead_id: leadId, firmName, reason: "nombre_generico" });
      continue;
    }

    // Filtro 5: Email válido
    if (!isValidEmailFormat(email)) {
      skipped.push({ lead_id: leadId, firmName, reason: "email_invalido_o_placeholder" });
      continue;
    }

    // Filtro 6: Deduplicación
    if (seenEmails.has(email)) {
      skipped.push({ lead_id: leadId, firmName, reason: "email_duplicado_en_lote" });
      continue;
    }

    // Filtro 7: Idempotencia
    if (existingSet.has(leadId)) {
      skipped.push({ lead_id: leadId, firmName, reason: "tarea_ya_existente" });
      continue;
    }

    const taskId = `task_${require("crypto").randomUUID()}`;
    const payloadObj = {
      lead_id: leadId,
      account_id: row.account_id,
      despacho_nombre: firmName,
      email: email,
      city: row.city || "Mérida, Yucatán",
      scian_code: scian,
      tenant_id: "acc_ark_ledger"
    };

    const escapedPayload = JSON.stringify(payloadObj).replace(/'/g, "''");
    insertStatements.push(
      `INSERT INTO agent_tasks (id, lead_id, skill_name, operator, payload, status, retry_count, created_at, updated_at) VALUES ('${taskId}', '${leadId}', '${skillName}', '${operator}', '${escapedPayload}', 'pending', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`
    );

    seenEmails.add(email);
    enqueued.push({
      task_id: taskId,
      lead_id: leadId,
      despacho_nombre: firmName,
      email: email,
    });
  }

  console.log(`\nCandidatos que pasaron filtros: ${enqueued.length}`);
  console.log(`Candidatos omitidos con motivo: ${skipped.length}`);

  if (insertStatements.length > 0) {
    const batchSql = insertStatements.join("\n");
    require("fs").writeFileSync("scripts/batch_enqueue.sql", batchSql, "utf8");
    console.log("Ejecutando inserción en D1 remoto...");
    execSync("npx wrangler d1 execute ark-sales-db --remote --file scripts/batch_enqueue.sql", { stdio: "inherit" });
    require("fs").unlinkSync("scripts/batch_enqueue.sql");
    console.log("\n¡20 Tareas encoladas exitosamente en producción!");
  }

  console.log("\nResumen Encolado:");
  console.table(enqueued);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
