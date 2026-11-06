"""CLI entry point for the lead harvester."""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import uuid

import httpx

from .pipeline import run_pipeline, write_report

BASE_URL = os.getenv("ARK_SALES_BASE_URL", "http://localhost:8787")
INTERNAL_TOKEN = os.getenv("INTERNAL_API_TOKEN", "")


def _headers() -> dict:
    h = {}
    if INTERNAL_TOKEN:
        h["Authorization"] = f"Bearer {INTERNAL_TOKEN}"
        h["X-Ark-Internal-Key"] = INTERNAL_TOKEN
    return h


async def _register_run(run_id: str, source: str, github_run_url: str | None) -> None:
    url = BASE_URL.rstrip("/") + "/api/internal/harvest/runs"
    async with httpx.AsyncClient(timeout=30.0) as client:
        await client.post(
            url,
            headers=_headers(),
            json={"run_id": run_id, "source": source, "status": "running", "github_run_url": github_run_url},
        )


async def _finish_run(run_id: str, status: str, metrics: dict, error: str | None = None) -> None:
    url = BASE_URL.rstrip("/") + f"/api/internal/harvest/runs/{run_id}"
    payload = {"status": status, "finished_at": "now", **metrics}
    if error:
        payload["error_message"] = error
    async with httpx.AsyncClient(timeout=30.0) as client:
        await client.patch(url, headers=_headers(), json=payload)


async def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="lead_harvester")
    parser.add_argument("--source", default="denue", choices=["denue", "sipres"])
    parser.add_argument("--profile", default=None, choices=["ark", "futura_capital", "ark_ledger", "fintech_credit_app", "sipres_sofom"])
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--fixture", default=None)
    parser.add_argument("--base-url", default=None)
    parser.add_argument("--skip-enrich", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--preview", action="store_true", help="Harvest and print a local preview without CRM writes")
    parser.add_argument("--plaza", default=None)
    parser.add_argument("--query", default=None)
    parser.add_argument("--require-email", action="store_true", help="Descartar prospectos sin correo electrónico corporativo")
    args = parser.parse_args(argv)

    base_url = args.base_url or os.getenv("ARK_SALES_BASE_URL")
    global BASE_URL
    if base_url:
        BASE_URL = base_url

    profile = args.profile or ("sipres_sofom" if args.source == "sipres" else "ark")
    if args.source == "sipres" and profile != "sipres_sofom":
        parser.error("--source sipres requires --profile sipres_sofom")
    if args.source == "sipres" and args.plaza:
        parser.error("--plaza is not supported with --source sipres")
    if args.source == "sipres" and args.limit is not None and not 1 <= args.limit <= 50:
        parser.error("SIPRES pilot --limit must be between 1 and 50")
    if args.source == "sipres" and args.limit is None:
        args.limit = 50

    if args.dry_run:
        print(json.dumps({
            "dry_run": True,
            "source": args.source,
            "profile": profile,
            "plaza": args.plaza,
            "query": args.query,
            "limit": args.limit,
            "enrich": not args.skip_enrich,
            "preview": args.preview,
        }))
        return 0

    if args.source == "denue" and not args.fixture and not os.getenv("INEGI_TOKEN"):
        print("ERROR: INEGI_TOKEN no configurado para fuente denue", file=__import__("sys").stderr)
        return 2

    run_id = os.getenv("GITHUB_RUN_ID") or f"run_{uuid.uuid4().hex[:12]}"
    github_run_url = None
    if os.getenv("GITHUB_SERVER_URL") and os.getenv("GITHUB_REPOSITORY") and os.getenv("GITHUB_RUN_ID"):
        github_run_url = f"{os.getenv('GITHUB_SERVER_URL')}/{os.getenv('GITHUB_REPOSITORY')}/actions/runs/{os.getenv('GITHUB_RUN_ID')}"

    enrich = not args.skip_enrich

    if not args.preview:
        try:
            await _register_run(run_id, f"{args.source}:{profile}", github_run_url)
        except Exception:
            pass

    metrics = {
        "leads_discovered": 0,
        "leads_ingested": 0,
        "leads_deduped": 0,
        "leads_enriched": 0,
    }

    try:
        result = await run_pipeline(
            source=args.source,
            limit=args.limit,
            enrich=enrich,
            fixture_path=args.fixture,
            base_url=base_url,
            profile=profile,
            plaza=args.plaza,
            query=args.query,
            require_email=args.require_email,
            preview_only=args.preview,
        )
        metrics["leads_discovered"] = result.total + result.deduped
        metrics["leads_ingested"] = result.ingested
        metrics["leads_deduped"] = result.deduped
        metrics["leads_enriched"] = result.total if enrich else 0
        if args.preview:
            print(result.model_dump_json(indent=2))
            return 0
        write_report(result, "harvest_report.json")
        print(result.model_dump_json(indent=2))
        try:
            await _finish_run(run_id, "completed", metrics)
        except Exception:
            pass
        return 0
    except Exception as e:
        # Incluir el tipo de excepción: httpx.ReadTimeout y similares tienen str(e) vacío
        err_msg = f"{type(e).__name__}: {e}"
        try:
            await _finish_run(run_id, "failed", metrics, err_msg)
        except Exception:
            pass
        import traceback
        traceback.print_exc()
        print(f"ERROR: {err_msg}", file=__import__("sys").stderr)
        return 1


def run() -> None:
    raise SystemExit(asyncio.run(main()))


if __name__ == "__main__":
    run()
