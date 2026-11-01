"""Backfill SCIAN codes in sales_accounts from sales_observations."""
from __future__ import annotations

import argparse
import os
import sys

import httpx

BASE_URL = os.getenv("ARK_SALES_BASE_URL", "http://localhost:8787")
INTERNAL_TOKEN = os.getenv("INTERNAL_API_TOKEN", "")


async def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="backfill_scian")
    parser.add_argument("--base-url", default=None)
    args = parser.parse_args(argv)

    base = (args.base_url or BASE_URL).rstrip("/")
    headers = {}
    if INTERNAL_TOKEN:
        headers["Authorization"] = f"Bearer {INTERNAL_TOKEN}"
        headers["X-Ark-Internal-Key"] = INTERNAL_TOKEN

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(f"{base}/api/internal/harvest/backfill-scian", headers=headers)
        print(resp.status_code, resp.text)
        return 0 if resp.status_code in (200, 201, 202) else 1


if __name__ == "__main__":
    import asyncio
    raise SystemExit(asyncio.run(main()))