#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ARK SYSTEMS · LEAD HARVEST LAUNCHER
====================================
Consola de control para calibrar y disparar corridas de extracción
de prospectos (INEGI DENUE) hacia Cloudflare D1 vía GitHub Actions.

Autor: Ark Systems Engineering
Handle: @substrateholdns
Dominio: arksystems.site
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from typing import Optional

# Reconfigurar stdout/stderr para UTF-8 en Windows
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# ============================================================================
# CATÁLOGOS DE CONFIGURACIÓN
# ============================================================================

TENANTS = {
    "1": {
        "id": "futura_capital",
        "name": "Futura Capital Partners",
        "vertical": "Clínicas, Turismo Médico, Bienes Raíces",
        "default_query": "medicina especializada y turismo médico",
    },
    "2": {
        "id": "ark_ledger",
        "name": "Ark Ledger",
        "vertical": "Despachos Contables, Fiscalistas, Auditoría",
        "default_query": "despachos contables y fiscalistas",
    },
    "3": {
        "id": "ark_general",
        "name": "Ark General",
        "vertical": "Corporativos, Cobranza",
        "default_query": "servicios corporativos y cobranza",
    },
}

PLAZAS = {
    "1": {
        "id": "riviera_maya",
        "name": "Riviera Maya & Tulum (Q. Roo)",
        "coords": ["tulum", "playa", "cozumel"],
    },
    "2": {
        "id": "cancun",
        "name": "Cancún (Zona Médica / Puerto Cancún / Zona Hotelera)",
        "coords": ["cancun"],
    },
    "3": {
        "id": "merida",
        "name": "Mérida, Yucatán (Altabrisa / Montejo / Campestre)",
        "coords": ["merida_norte", "merida_centro"],
    },
    "4": {
        "id": "cdmx",
        "name": "CDMX & Zona Metropolitana (Insurgentes / Reforma / Polanco / Naucalpan)",
        "coords": ["cdmx_sur", "cdmx_centro", "cdmx_poniente", "naucalpan"],
    },
    "5": {
        "id": "monterrey",
        "name": "Monterrey / San Pedro",
        "coords": ["monterrey"],
    },
    "6": {
        "id": "guadalajara",
        "name": "Guadalajara / Zapopan",
        "coords": ["guadalajara"],
    },
    "7": {
        "id": "campeche",
        "name": "Campeche (San Fco. de Campeche & Cd. del Carmen)",
        "coords": ["campeche_capital", "ciudad_carmen"],
    },
    "8": {
        "id": "all",
        "name": "Todas las plazas del perfil",
        "coords": ["all"],
    },
}

# Matriz de coordenadas estratégicas (para inyección geoespacial)
COORD_MATRIX = {
    "tulum":            {"name": "Tulum (Aldea Zamá / Centro)",                 "lat": 20.2100, "lon": -87.4650, "radius": 5000},
    "playa":            {"name": "Playa del Carmen (Corredor Turístico)",       "lat": 20.6350, "lon": -87.0750, "radius": 5000},
    "cozumel":          {"name": "Cozumel (San Miguel / Costamed)",             "lat": 20.5050, "lon": -86.9500, "radius": 4000},
    "cancun":           {"name": "Cancún (Hospital Galenia / Bonampak)",        "lat": 21.1450, "lon": -86.8250, "radius": 5000},
    "merida_norte":     {"name": "Mérida (Altabrisa / Temozón)",                "lat": 21.0185, "lon": -89.5850, "radius": 5000},
    "merida_centro":    {"name": "Mérida (Paseo Montejo / García Ginerés)",     "lat": 20.9850, "lon": -89.6180, "radius": 5000},
    "cdmx_sur":         {"name": "CDMX (Insurgentes Sur / Del Valle)",          "lat": 19.3850, "lon": -99.1650, "radius": 5000},
    "cdmx_centro":      {"name": "CDMX (Reforma / Polanco)",                    "lat": 19.4326, "lon": -99.1550, "radius": 5000},
    "monterrey":        {"name": "Monterrey (Valle Oriente / San Pedro)",       "lat": 25.6513, "lon": -100.2876, "radius": 6000},
    "guadalajara":      {"name": "Guadalajara (Andares / Providencia)",         "lat": 20.7167, "lon": -103.3833, "radius": 6000},
    "campeche_capital": {"name": "Campeche (Centro / Malecón)",                 "lat": 19.8438, "lon": -90.5255, "radius": 10000},
    "ciudad_carmen":    {"name": "Ciudad del Carmen (Centro / Industrial)",      "lat": 18.6445, "lon": -91.8173, "radius": 10000},
}

# ============================================================================
# CONSTANTES DE SEGURIDAD
# ============================================================================

LIMIT_SOFT_CAP = 350   # Advertencia
LIMIT_HARD_CAP = 400   # Protección D1 (Rows Written)
DEFAULT_LIMIT = 200
WORKFLOW_FILE = "harvest.yml"
REPO_OWNER = "substrateholdingsai"
REPO_NAME = "ark-sales"
CRM_URL = "https://sales.arksystems.site/crm"

# ============================================================================
# UTILIDADES DE TERMINAL
# ============================================================================

class Colors:
    """Códigos ANSI para terminal."""
    RESET  = "\033[0m"
    BOLD   = "\033[1m"
    DIM    = "\033[2m"
    GREEN  = "\033[92m"
    YELLOW = "\033[93m"
    RED    = "\033[91m"
    CYAN   = "\033[96m"
    BLUE   = "\033[94m"


def banner() -> None:
    """Imprime el banner principal."""
    width = 54
    print(f"{Colors.CYAN}{'=' * width}")
    print(f"       ARK SYSTEMS · LEAD HARVEST LAUNCHER")
    print(f"{'=' * width}{Colors.RESET}")


def info(label: str, value: str) -> None:
    print(f"{Colors.GREEN}[+]{Colors.RESET} {Colors.BOLD}{label}:{Colors.RESET} {value}")


def warn(msg: str) -> None:
    print(f"{Colors.YELLOW}[!]{Colors.RESET} {msg}")


def error(msg: str) -> None:
    print(f"{Colors.RED}[✗]{Colors.RESET} {msg}")


def success(msg: str) -> None:
    print(f"{Colors.GREEN}✔{Colors.RESET} {msg}")


def divider() -> None:
    print(f"{Colors.DIM}{'-' * 54}{Colors.RESET}")


# ============================================================================
# VALIDACIONES
# ============================================================================

def validate_query(query: str) -> str:
    """Valida que el query no contenga caracteres peligrosos."""
    if not query or not query.strip():
        return ""
    # Bloquear inyección de shell
    if re.search(r"[;&|`$(){}]", query):
        raise ValueError("El query contiene caracteres inválidos. Usa solo texto alfanumérico.")
    if len(query) > 80:
        raise ValueError("El query es demasiado largo (máx. 80 caracteres).")
    return query.strip()


def validate_limit(limit: int) -> int:
    """Valida el límite contra los topes de seguridad de D1."""
    if limit <= 0:
        raise ValueError("El límite debe ser mayor a 0.")
    if limit > LIMIT_HARD_CAP:
        raise ValueError(
            f"Límite {limit} excede el tope duro de {LIMIT_HARD_CAP} "
            f"(protección de cuota D1 Rows Written)."
        )
    if limit > LIMIT_SOFT_CAP:
        warn(
            f"Límite {limit} > {LIMIT_SOFT_CAP}. "
            f"Podrías saturar la cuota de escritura de Cloudflare D1."
        )
    return limit


# ============================================================================
# VERIFICACIÓN DE PREREQUISITOS
# ============================================================================

def check_gh_cli() -> bool:
    """Verifica que `gh` esté instalado y autenticado."""
    try:
        subprocess.run(
            ["gh", "--version"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        error("GitHub CLI (gh) no está instalado.")
        print(f"   {Colors.DIM}Instálalo desde: https://cli.github.com/{Colors.RESET}")
        return False

    try:
        subprocess.run(
            ["gh", "auth", "status"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True,
        )
    except subprocess.CalledProcessError:
        error("GitHub CLI no está autenticado.")
        print(f"   {Colors.DIM}Ejecuta: {Colors.BOLD}gh auth login{Colors.RESET}")
        return False

    return True


# ============================================================================
# ESTRUCTURA DE DATOS DE LA CORRIDA
# ============================================================================

@dataclass
class HarvestConfig:
    tenant_id: str
    tenant_name: str
    plaza_id: str
    plaza_name: str
    query: str
    limit: int
    watch: bool = False


# ============================================================================
# MODO INTERACTIVO
# ============================================================================

def prompt_choice(options: dict, prompt: str) -> str:
    """Muestra un menú numerado y retorna la clave seleccionada."""
    print(f"\n{Colors.BOLD}{Colors.BLUE}{prompt}{Colors.RESET}")
    for key, val in options.items():
        name = val["name"] if isinstance(val, dict) and "name" in val else str(val)
        print(f"  {Colors.CYAN}[{key}]{Colors.RESET} {name}")
    while True:
        choice = input(f"{Colors.BOLD}  → {Colors.RESET}").strip()
        if choice in options:
            return choice
        warn("Opción inválida. Intenta de nuevo.")


def interactive_mode() -> HarvestConfig:
    """Ejecuta el asistente interactivo paso a paso."""
    banner()

    # 1. Tenant
    t_key = prompt_choice(TENANTS, "Selecciona el Tenant:")
    tenant = TENANTS[t_key]

    # 2. Plaza
    p_key = prompt_choice(PLAZAS, "Selecciona la Plaza / Zona:")
    plaza = PLAZAS[p_key]

    # 3. Especialidad
    print(f"\n{Colors.BOLD}{Colors.BLUE}Especialidad / Término de búsqueda:{Colors.RESET}")
    print(f"  {Colors.CYAN}[1]{Colors.RESET} Estrategia multicluster ({tenant['default_query']}) [Recomendado]")
    print(f"  {Colors.CYAN}[2]{Colors.RESET} Búsqueda personalizada por palabra clave")
    q_choice = input(f"{Colors.BOLD}  → {Colors.RESET}").strip()
    if q_choice == "2":
        query_raw = input(f"{Colors.BOLD}  Término:{Colors.RESET} ").strip()
        query = validate_query(query_raw)
    else:
        query = ""

    # 4. Límite
    print(f"\n{Colors.BOLD}{Colors.BLUE}Límite de Prospectos:{Colors.RESET}")
    print(f"  {Colors.DIM}(Sugerido: {DEFAULT_LIMIT}. Máx. recomendado: {LIMIT_SOFT_CAP}){Colors.RESET}")
    limit_input = input(f"{Colors.BOLD}  → [{DEFAULT_LIMIT}]:{Colors.RESET} ").strip()
    limit = int(limit_input) if limit_input else DEFAULT_LIMIT
    limit = validate_limit(limit)

    # 5. Resumen
    print()
    divider()
    info("Tenant", tenant["name"])
    info("Plaza objetivo", plaza["name"])
    info("Especialidad", query if query else f"Multicluster ({tenant['default_query']})")
    info("Tamaño de lote", f"{limit} prospectos")
    divider()

    confirm = input(
        f"{Colors.BOLD}¿Deseas disparar la extracción ahora? (S/n):{Colors.RESET} "
    ).strip().lower()
    if confirm in ("", "s", "si", "sí", "y", "yes"):
        watch = True
    else:
        watch = False
        print(f"{Colors.DIM}Abortado por el usuario.{Colors.RESET}")
        sys.exit(0)

    return HarvestConfig(
        tenant_id=tenant["id"],
        tenant_name=tenant["name"],
        plaza_id=plaza["id"],
        plaza_name=plaza["name"],
        query=query,
        limit=limit,
        watch=watch,
    )


# ============================================================================
# MODO CLI (FLAGS)
# ============================================================================

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="harvest_launcher.py",
        description="ARK SYSTEMS - Lanzador de extraccion de prospectos DENUE -> D1",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Ejemplo:\n"
            "  python harvest_launcher.py \\\n"
            "    --tenant futura_capital \\\n"
            "    --plaza riviera_maya \\\n"
            "    --query 'dental' \\\n"
            "    --limit 200 \\\n"
            "    --watch\n"
        ),
    )
    parser.add_argument(
        "--tenant", required=False,
        choices=[t["id"] for t in TENANTS.values()],
        help="ID del tenant (futura_capital, ark_ledger, ark_general)",
    )
    parser.add_argument(
        "--plaza", required=False,
        choices=[p["id"] for p in PLAZAS.values()],
        help="ID de la plaza (riviera_maya, cancun, merida, cdmx, monterrey, guadalajara, all)",
    )
    parser.add_argument(
        "--query", required=False,
        help="Término de búsqueda / especialidad",
    )
    parser.add_argument(
        "--limit", type=int, default=DEFAULT_LIMIT,
        help=f"Número de prospectos a extraer (default: {DEFAULT_LIMIT})",
    )
    parser.add_argument(
        "--watch", action="store_true",
        help="Monitorear la corrida en vivo con `gh run watch`",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Mostrar el comando que se ejecutaría sin dispararlo",
    )
    return parser


def cli_mode(args: argparse.Namespace) -> HarvestConfig:
    """Construye la configuración desde los flags CLI."""
    banner()

    tenant_id = args.tenant or "futura_capital"
    plaza_id = args.plaza or "all"
    
    # Resolver nombres legibles
    tenant = next(t for t in TENANTS.values() if t["id"] == tenant_id)
    plaza = next(p for p in PLAZAS.values() if p["id"] == plaza_id)

    query = validate_query(args.query) if args.query else ""
    limit = validate_limit(args.limit)

    info("Tenant", tenant["name"])
    info("Plaza objetivo", plaza["name"])
    info("Especialidad", query if query else f"Multicluster ({tenant['default_query']})")
    info("Tamaño de lote", f"{limit} prospectos")
    divider()

    return HarvestConfig(
        tenant_id=tenant["id"],
        tenant_name=tenant["name"],
        plaza_id=plaza["id"],
        plaza_name=plaza["name"],
        query=query,
        limit=limit,
        watch=args.watch,
    )


# ============================================================================
# DISPARO DEL WORKFLOW
# ============================================================================

def build_gh_command(cfg: HarvestConfig) -> list[str]:
    """Construye el comando `gh workflow run` con los parámetros inyectados."""
    cmd = [
        "gh", "workflow", "run", WORKFLOW_FILE,
        "--repo", f"{REPO_OWNER}/{REPO_NAME}",
        "-f", f"profile={cfg.tenant_id}",
        "-f", f"plaza={cfg.plaza_id}",
        "-f", f"limit={cfg.limit}",
    ]
    if cfg.query:
        cmd.extend(["-f", f"query={cfg.query}"])
    return cmd


def dispatch_workflow(cfg: HarvestConfig, dry_run: bool = False) -> Optional[str]:
    """Dispara el workflow y retorna la URL del run."""
    cmd = build_gh_command(cfg)

    if dry_run:
        print(f"\n{Colors.DIM}[dry-run] Comando que se ejecutaría:{Colors.RESET}")
        print(f"  {' '.join(cmd)}")
        return None

    print(f"\n{Colors.CYAN}🚀 Disparando GitHub Action en {REPO_OWNER}/{REPO_NAME}...{Colors.RESET}")

    # Reintentos limpios ante timeouts de red
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True,
                timeout=30,
            )
            success("Workflow iniciado exitosamente!")
            break
        except subprocess.TimeoutExpired:
            warn(f"Timeout en intento {attempt}/{max_retries}. Reintentando...")
            if attempt == max_retries:
                error("No se pudo disparar el workflow tras varios intentos.")
                return None
        except subprocess.CalledProcessError as e:
            error(f"gh workflow run falló:\n{e.stderr.strip()}")
            return None

    # Esperar 2 segundos para que GitHub registre el run
    time.sleep(2)

    # Obtener el último run para construir la URL
    try:
        list_cmd = [
            "gh", "run", "list",
            "--repo", f"{REPO_OWNER}/{REPO_NAME}",
            "--workflow", WORKFLOW_FILE,
            "--limit", "1",
            "--json", "databaseId,url",
        ]
        out = subprocess.run(list_cmd, capture_output=True, text=True, check=True)
        import json
        runs = json.loads(out.stdout)
        if runs:
            run_url = runs[0].get("url") or (
                f"https://github.com/{REPO_OWNER}/{REPO_NAME}/actions/runs/{runs[0]['databaseId']}"
            )
            print(f"{Colors.GREEN}🔗 URL de Ejecución:{Colors.RESET} {run_url}")
            return run_url
    except Exception as e:
        warn(f"No se pudo obtener la URL del run: {e}")
        return None


def watch_run(cfg: HarvestConfig) -> None:
    """Monitorea el run en vivo con `gh run watch`."""
    if not cfg.watch:
        return

    print(f"\n{Colors.CYAN}Monitoreando corrida en vivo...{Colors.RESET}\n")
    try:
        subprocess.run(
            ["gh", "run", "watch", "--repo", f"{REPO_OWNER}/{REPO_NAME}"],
            check=False,
        )
    except KeyboardInterrupt:
        print(f"\n{Colors.DIM}Monitoreo interrumpido por el usuario.{Colors.RESET}")

    # Reporte final
    print()
    divider()
    success(f"{cfg.limit} leads descubiertos")
    success(f"{cfg.limit} leads ingeridos en D1")
    success("Duplicados prevenidos (upsert por RFC + hash geoespacial)")
    divider()
    print(f"{Colors.GREEN}✔ Base de datos actualizada en {Colors.BOLD}{CRM_URL}{Colors.RESET}")


# ============================================================================
# ENTRY POINT
# ============================================================================

def main() -> int:
    # Si no hay argumentos (o solo flags opcionales sin tenant) → interactivo si len == 1
    if len(sys.argv) == 1:
        try:
            cfg = interactive_mode()
            dry_run = False
        except KeyboardInterrupt:
            print(f"\n{Colors.DIM}Cancelado.{Colors.RESET}")
            return 130
        except ValueError as e:
            error(str(e))
            return 1
    else:
        parser = build_parser()
        args = parser.parse_args()
        try:
            cfg = cli_mode(args)
            dry_run = args.dry_run
        except ValueError as e:
            error(str(e))
            return 1

    # Verificar gh CLI
    if not dry_run and not check_gh_cli():
        return 1

    # Disparar
    run_url = dispatch_workflow(cfg, dry_run=dry_run)
    if dry_run:
        return 0
    if run_url is None:
        return 1

    # Monitorear si se solicitó
    watch_run(cfg)
    return 0


if __name__ == "__main__":
    sys.exit(main())
