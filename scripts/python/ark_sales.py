#!/usr/bin/env python3
# scripts/python/ark_sales.py
# StayPuft connector helper para el worker Ark Sales.
# Endpoint objetivo: POST /api/internal/leads (alta de un solo lead, fail-closed, autenticado con X-StayPuft-Key).
# No contiene secretos hardcodeados: STAYPUFT_API_KEY se lee del entorno.

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

ARK_SALES_API = os.getenv("ARK_SALES_API", "http://localhost:8787/api/internal")


def _env_key() -> str:
    key = os.getenv("STAYPUFT_API_KEY")
    if not key:
        sys.stderr.write("ERROR: STAYPUFT_API_KEY no definida en el entorno.\n")
        sys.exit(2)
    return key


def cmd_add_lead(payload: dict) -> int:
    url = f"{ARK_SALES_API}/leads"
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "X-StayPuft-Key": _env_key(),
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8")
            sys.stdout.write(body)
            if not body.endswith("\n"):
                sys.stdout.write("\n")
            return 0
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        sys.stderr.write(f"HTTP {e.code}: {body}\n")
        return e.code
    except urllib.error.URLError as e:
        sys.stderr.write(f"ERROR: no se pudo conectar con {url}: {e}\n")
        return 3


def main() -> int:
    parser = argparse.ArgumentParser(prog="ark_sales.py", description="StayPuft connector helper para Ark Sales.")
    sub = parser.add_subparsers(dest="command", required=True)

    p_add = sub.add_parser(
        "add-lead",
        help="Crea un único lead en Ark Sales vía POST /api/internal/leads (fail-closed, sin efectos colaterales).",
    )
    p_add.add_argument("--json", required=True, help="Payload JSON con un único objeto de lead.")

    args = parser.parse_args()

    if args.command == "add-lead":
        try:
            payload = json.loads(args.json)
        except json.JSONDecodeError as e:
            sys.stderr.write(f"ERROR: --json inválido: {e}\n")
            return 2
        if not isinstance(payload, dict):
            sys.stderr.write("ERROR: --json debe contener un único objeto de lead (no arreglos ni payloads masivos).\n")
            return 2
        return cmd_add_lead(payload)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
