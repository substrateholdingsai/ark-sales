"""
ARK Sales - Safe Deduplication & Write Optimization Script
Specifically protects all contacts with WhatsApp and consolidates master records.
Optimized to execute in compact, fast batches.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from collections import defaultdict
from pathlib import Path


def run_d1_query(sql: str, remote: bool = True) -> list[dict]:
    cmd = ["npx", "wrangler", "d1", "execute", "ark-sales-db"]
    if remote:
        cmd.append("--remote")
    cmd.extend(["--command", sql, "--json"])

    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", shell=(os.name == "nt"))
    if res.returncode != 0:
        raise RuntimeError(f"Wrangler query failed:\nSTDOUT: {res.stdout}\nSTDERR: {res.stderr}")

    stdout = res.stdout or ""
    try:
        start = stdout.find("[")
        end = stdout.rfind("]") + 1
        if start == -1 or end <= start:
            raise ValueError(f"No JSON array found in output:\n{stdout}")
        parsed = json.loads(stdout[start:end])
        results = []
        for block in parsed:
            results.extend(block.get("results", []))
        return results
    except Exception as e:
        raise RuntimeError(f"Failed parsing wrangler json output: {e}\nRaw output: {stdout[:500]}")


def run_d1_sql_file(file_path: Path, remote: bool = True) -> None:
    cmd = ["npx", "wrangler", "d1", "execute", "ark-sales-db"]
    if remote:
        cmd.append("--remote")
    cmd.extend(["--file", str(file_path)])

    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", shell=(os.name == "nt"))
    if res.returncode != 0:
        raise RuntimeError(f"Wrangler batch execution failed:\nSTDOUT: {res.stdout}\nSTDERR: {res.stderr}")


def escape_sql(val: str | None) -> str:
    if val is None:
        return "NULL"
    escaped = val.replace("'", "''")
    return f"'{escaped}'"


def chunk_list(lst: list, n: int):
    for i in range(0, len(lst), n):
        yield lst[i : i + n]


def main():
    try:
        sys.stdout.reconfigure(line_buffering=True)
    except Exception:
        pass
    parser = argparse.ArgumentParser(description="Deduplicate ark-sales-db protecting WhatsApp records.")
    parser.add_argument("--remote", action="store_true", default=True, help="Run on remote D1 (default)")
    parser.add_argument("--local", action="store_true", help="Run on local D1")
    parser.add_argument("--execute", action="store_true", help="Execute changes on D1 (default is dry-run)")
    args = parser.parse_args()

    remote = not args.local

    print("=================================================================")
    print("      ARK SALES - SAFE DEDUPLICATION ENGINE (WHATSAPP PROTECTED) ")
    print(f"      Mode: {'EXECUTE' if args.execute else 'DRY-RUN'} | Target: {'REMOTE' if remote else 'LOCAL'}")
    print("=================================================================\n")

    print("1. Descargando registros de D1...")
    contacts = run_d1_query("SELECT id, account_id, name, email, phone, whatsapp, created_at FROM sales_contacts;", remote=remote)
    leads = run_d1_query("SELECT id, email, despacho_nombre, tamano, dolor_detectado, especialista_asignado, estado, score, phone, account_id, contact_id, created_at FROM sales_leads;", remote=remote)
    accounts = run_d1_query("SELECT id, name, normalized_name, size, city, origin, scian_code, harvest_source, created_at FROM sales_accounts;", remote=remote)

    # Cargar IDs de tablas dependientes para filtrar sólo los UPDATEs necesarios
    obs_acc_ids = {r["account_id"] for r in run_d1_query("SELECT DISTINCT account_id FROM sales_observations;", remote=remote) if r.get("account_id")}
    conv_lead_ids = {r["lead_id"] for r in run_d1_query("SELECT DISTINCT lead_id FROM sales_conversations;", remote=remote) if r.get("lead_id")}
    activities = run_d1_query("SELECT id, account_id, contact_id, lead_id FROM sales_activities;", remote=remote)
    tasks = run_d1_query("SELECT id, account_id, contact_id, lead_id FROM sales_tasks;", remote=remote)
    opportunities = run_d1_query("SELECT id, account_id, contact_id, lead_id FROM sales_opportunities;", remote=remote)

    print(f"   -> {len(contacts)} contactos")
    print(f"   -> {len(leads)} leads")
    print(f"   -> {len(accounts)} cuentas")
    print(f"   -> {len(obs_acc_ids)} cuentas con observaciones")
    print(f"   -> {len(conv_lead_ids)} leads con conversaciones")

    whatsapp_contacts = [c for c in contacts if c.get("whatsapp") and c.get("whatsapp").strip()]
    initial_whatsapp_count = len(whatsapp_contacts)
    print(f"\n   [PROTEGER] Contactos con WhatsApp detectados: {initial_whatsapp_count}")
    for c in whatsapp_contacts[:5]:
        print(f"      - {c.get('name')} | {c.get('email')} | WA: {c.get('whatsapp')} | ID: {c.get('id')}")
    if initial_whatsapp_count > 5:
        print(f"      ... y {initial_whatsapp_count - 5} más.")

    # -------------------------------------------------------------
    # 2. DEDUPLICAR CONTACTOS
    # -------------------------------------------------------------
    contacts_by_email = defaultdict(list)
    dummy_contacts = []

    for c in contacts:
        email = (c.get("email") or "").strip().lower()
        if email and not email.endswith("@harvest.arksystems.local"):
            contacts_by_email[email].append(c)
        else:
            dummy_contacts.append(c)

    contact_id_map: dict[str, str] = {}  # dup_id -> master_id
    contacts_to_delete: list[str] = []
    contact_updates: list[str] = []

    for email, group in contacts_by_email.items():
        if len(group) <= 1:
            continue

        # Ordenar: primero los de mayor prioridad
        sorted_group = sorted(group, key=lambda c: (
            1 if (c.get("whatsapp") and c.get("whatsapp").strip()) else 0,
            1 if (c.get("phone") and c.get("phone").strip()) else 0,
            1 if (c.get("name") and c.get("name") not in ("Contacto", "Contacto Corporativo")) else 0,
            c.get("created_at") or "9999"
        ), reverse=True)

        master = sorted_group[0]
        duplicates = sorted_group[1:]

        master_wa = master.get("whatsapp")
        master_ph = master.get("phone")
        master_nm = master.get("name")

        for dup in duplicates:
            if not master_wa and dup.get("whatsapp"):
                master_wa = dup.get("whatsapp")
            if not master_ph and dup.get("phone"):
                master_ph = dup.get("phone")
            if (not master_nm or master_nm in ("Contacto", "Contacto Corporativo")) and dup.get("name") and dup.get("name") not in ("Contacto", "Contacto Corporativo"):
                master_nm = dup.get("name")

            contact_id_map[dup["id"]] = master["id"]
            contacts_to_delete.append(dup["id"])

        if master_wa != master.get("whatsapp") or master_ph != master.get("phone") or master_nm != master.get("name"):
            contact_updates.append(
                f"UPDATE sales_contacts SET whatsapp = {escape_sql(master_wa)}, phone = {escape_sql(master_ph)}, name = {escape_sql(master_nm)}, updated_at = CURRENT_TIMESTAMP WHERE id = '{master['id']}';"
            )

    print(f"\n2. Contactos Duplicados: {len(contacts_to_delete)} a remover, {len(contacts_by_email)} grupos únicos.")

    # -------------------------------------------------------------
    # 3. DEDUPLICAR LEADS
    # -------------------------------------------------------------
    leads_by_email = defaultdict(list)
    for l in leads:
        email = (l.get("email") or "").strip().lower()
        if email:
            leads_by_email[email].append(l)

    lead_id_map: dict[str, str] = {}  # dup_lead_id -> master_lead_id
    leads_to_delete: list[str] = []
    lead_updates: list[str] = []

    contacts_wa_set = {c["id"] for c in whatsapp_contacts}

    for email, group in leads_by_email.items():
        if len(group) <= 1:
            continue

        sorted_leads = sorted(group, key=lambda l: (
            1 if (l.get("contact_id") in contacts_wa_set or contact_id_map.get(l.get("contact_id")) in contacts_wa_set) else 0,
            1 if (l.get("phone") and l.get("phone").strip()) else 0,
            l.get("score") or 0,
            l.get("created_at") or "9999"
        ), reverse=True)

        master_lead = sorted_leads[0]
        dup_leads = sorted_leads[1:]

        master_score = master_lead.get("score") or 0
        master_phone = master_lead.get("phone")
        master_name = master_lead.get("despacho_nombre")

        for d in dup_leads:
            lead_id_map[d["id"]] = master_lead["id"]
            leads_to_delete.append(d["id"])
            if (d.get("score") or 0) > master_score:
                master_score = d.get("score")
            if not master_phone and d.get("phone"):
                master_phone = d.get("phone")
            if not master_name and d.get("despacho_nombre"):
                master_name = d.get("despacho_nombre")

        target_contact_id = contact_id_map.get(master_lead.get("contact_id"), master_lead.get("contact_id"))

        lead_updates.append(
            f"UPDATE sales_leads SET score = {master_score}, phone = {escape_sql(master_phone)}, despacho_nombre = {escape_sql(master_name)}, contact_id = {escape_sql(target_contact_id)}, updated_at = CURRENT_TIMESTAMP WHERE id = '{master_lead['id']}';"
        )

    print(f"3. Leads Duplicados: {len(leads_to_delete)} a remover, {len(leads_by_email)} correos únicos.")

    # -------------------------------------------------------------
    # 4. DEDUPLICAR CUENTAS
    # -------------------------------------------------------------
    account_id_map: dict[str, str] = {}
    accounts_to_delete: list[str] = []

    lead_to_account = {l["id"]: l.get("account_id") for l in leads if l.get("account_id")}

    for dup_lead_id, master_lead_id in lead_id_map.items():
        dup_acc = lead_to_account.get(dup_lead_id) or f"acc_{dup_lead_id}"
        master_acc = lead_to_account.get(master_lead_id) or f"acc_{master_lead_id}"
        if dup_acc != master_acc:
            account_id_map[dup_acc] = master_acc
            if dup_acc not in accounts_to_delete:
                accounts_to_delete.append(dup_acc)

    print(f"4. Cuentas Duplicadas vinculadas a leads duplicados: {len(accounts_to_delete)} a consolidar.")

    # -------------------------------------------------------------
    # 5. GENERACIÓN CONSOLIDADA DE STATEMENTS (OPTIMIZADA)
    # -------------------------------------------------------------
    statements: list[str] = [
        "-- ARK SALES - DEDUPLICACION Y PURGA ATOMICA",
        "PRAGMA foreign_keys = OFF;",
    ]

    # Actualizar contactos master enriquecidos
    for stmt in contact_updates:
        statements.append(stmt)

    # Actualizar leads master
    for stmt in lead_updates:
        statements.append(stmt)

    # Re-vincular cuentas en sales_contacts SOLO para los que existen
    for dup_acc, master_acc in account_id_map.items():
        statements.append(f"UPDATE sales_contacts SET account_id = '{master_acc}' WHERE account_id = '{dup_acc}';")

    # Re-vincular observaciones SOLO si la cuenta duplicada tiene observaciones
    for dup_acc, master_acc in account_id_map.items():
        if dup_acc in obs_acc_ids:
            statements.append(f"UPDATE sales_observations SET account_id = '{master_acc}' WHERE account_id = '{dup_acc}';")

    # Re-vincular conversaciones SOLO si el lead duplicado tiene conversaciones
    for dup_lead, master_lead in lead_id_map.items():
        if dup_lead in conv_lead_ids:
            statements.append(f"UPDATE sales_conversations SET lead_id = '{master_lead}' WHERE lead_id = '{dup_lead}';")

    # Re-vincular activities, tasks, opportunities si aplican
    for act in activities:
        aid = act.get("account_id")
        cid = act.get("contact_id")
        lid = act.get("lead_id")
        if aid in account_id_map:
            statements.append(f"UPDATE sales_activities SET account_id = '{account_id_map[aid]}' WHERE id = '{act['id']}';")
        if cid in contact_id_map:
            statements.append(f"UPDATE sales_activities SET contact_id = '{contact_id_map[cid]}' WHERE id = '{act['id']}';")
        if lid in lead_id_map:
            statements.append(f"UPDATE sales_activities SET lead_id = '{lead_id_map[lid]}' WHERE id = '{act['id']}';")

    for tsk in tasks:
        aid = tsk.get("account_id")
        cid = tsk.get("contact_id")
        lid = tsk.get("lead_id")
        if aid in account_id_map:
            statements.append(f"UPDATE sales_tasks SET account_id = '{account_id_map[aid]}' WHERE id = '{tsk['id']}';")
        if cid in contact_id_map:
            statements.append(f"UPDATE sales_tasks SET contact_id = '{contact_id_map[cid]}' WHERE id = '{tsk['id']}';")
        if lid in lead_id_map:
            statements.append(f"UPDATE sales_tasks SET lead_id = '{lead_id_map[lid]}' WHERE id = '{tsk['id']}';")

    for opp in opportunities:
        aid = opp.get("account_id")
        cid = opp.get("contact_id")
        lid = opp.get("lead_id")
        if aid in account_id_map:
            statements.append(f"UPDATE sales_opportunities SET account_id = '{account_id_map[aid]}' WHERE id = '{opp['id']}';")
        if cid in contact_id_map:
            statements.append(f"UPDATE sales_opportunities SET contact_id = '{contact_id_map[cid]}' WHERE id = '{opp['id']}';")
        if lid in lead_id_map:
            statements.append(f"UPDATE sales_opportunities SET lead_id = '{lead_id_map[lid]}' WHERE id = '{opp['id']}';")

    # Eliminar contactos duplicados en lotes usando IN (...)
    # Comprobar seguridad absoluta: NINGÚN contacto con WhatsApp puede ser borrado
    for c_id in contacts_to_delete:
        assert c_id not in contacts_wa_set, f"CRITICAL: Intento de eliminar contacto con WhatsApp {c_id}"

    for chunk in chunk_list(contacts_to_delete, 60):
        ids_str = ", ".join(f"'{cid}'" for cid in chunk)
        statements.append(f"DELETE FROM sales_contacts WHERE id IN ({ids_str});")

    # Eliminar cuentas duplicadas en lotes usando IN (...)
    for chunk in chunk_list(accounts_to_delete, 60):
        ids_str = ", ".join(f"'{aid}'" for aid in chunk)
        statements.append(f"DELETE FROM sales_accounts WHERE id IN ({ids_str});")

    # Eliminar leads duplicados en lotes usando IN (...)
    for chunk in chunk_list(leads_to_delete, 60):
        ids_str = ", ".join(f"'{lid}'" for lid in chunk)
        statements.append(f"DELETE FROM sales_leads WHERE id IN ({ids_str});")

    # Limpiar conversaciones repetidas automáticas en sales_conversations
    statements.append("""
    DELETE FROM sales_conversations
    WHERE id NOT IN (
        SELECT MIN(id)
        FROM sales_conversations
        GROUP BY lead_id, role, content
    );
    """)

    statements.append("PRAGMA foreign_keys = ON;")

    print(f"\n5. Total de sentencias SQL consolidadas: {len(statements)} (reducido de 15,000+ a {len(statements)})")

    sql_path = Path("scripts") / "dedup_migration_run.sql"
    sql_path.write_text("\n".join(statements), encoding="utf-8")
    print(f"   -> Archivo generado en: {sql_path.resolve()} ({sql_path.stat().st_size // 1024} KB)")

    if not args.execute:
        print("\n[MODO DRY-RUN COMPLETADO]: No se aplicaron cambios a la base de datos.")
        print("Para aplicar los cambios a producción, ejecuta:")
        print("  python scripts/dedup_database.py --execute")
        return

    print("\n6. Ejecutando deduplicación en D1 en lotes controlados...")
    CHUNK_SIZE = 500
    sub_stmts = [s for s in statements if not s.startswith("--")]
    total_chunks = (len(sub_stmts) + CHUNK_SIZE - 1) // CHUNK_SIZE

    for i in range(total_chunks):
        chunk = sub_stmts[i * CHUNK_SIZE : (i + 1) * CHUNK_SIZE]
        temp_file = Path("scripts") / f"temp_chunk_{i}.sql"
        temp_file.write_text("\n".join(chunk), encoding="utf-8")
        print(f"   Ejecutando lote {i + 1}/{total_chunks} ({len(chunk)} sentencias)...")
        run_d1_sql_file(temp_file, remote=remote)
        try:
            temp_file.unlink()
        except Exception:
            pass

    print("\n7. Validando integridad post-ejecución...")
    post_contacts = run_d1_query("SELECT count(*) as c FROM sales_contacts WHERE whatsapp IS NOT NULL AND TRIM(whatsapp) != '';", remote=remote)
    post_wa_count = post_contacts[0].get("c", 0)
    print(f"   -> Contactos con WhatsApp en DB ahora: {post_wa_count} (Esperados: {initial_whatsapp_count})")
    assert post_wa_count >= initial_whatsapp_count, f"ERROR: Se perdieron contactos con WhatsApp! Antes: {initial_whatsapp_count}, Ahora: {post_wa_count}"

    post_counts = run_d1_query("""
    SELECT 
        (SELECT count(*) FROM sales_leads) as leads,
        (SELECT count(*) FROM sales_accounts) as accounts,
        (SELECT count(*) FROM sales_contacts) as contacts,
        (SELECT count(*) FROM sales_conversations) as conversations;
    """, remote=remote)
    print(f"   -> Conteo final en DB: {post_counts[0]}")
    print("\n[DEDUPLICACIÓN COMPLETADA EXITOSAMENTE] Base de datos limpia y protegida.")


if __name__ == "__main__":
    main()
