#!/usr/bin/env python3
"""
Burst de 100 operaciones concurrentes (smoke de capacidad).

Uso (con stack arriba y rate limits elevados si hace falta):
  python -u scripts/load_100_ops_burst.py --base-url http://127.0.0.1:8000 --ops 100

Valida que el API atiende al menos 100 requests en paralelo sin 5xx masivos.
No sustituye la campaña de 1000 usuarios (load_1000_concurrent.py).
"""
from __future__ import annotations

import argparse
import asyncio
import statistics
import time
from typing import List

import httpx


async def one(client: httpx.AsyncClient, i: int) -> tuple[bool, float, int]:
    start = time.perf_counter()
    try:
        # Mezcla ligera: health + catálogo (endpoints públicos calientes)
        if i % 3 == 0:
            r = await client.get("/health")
        elif i % 3 == 1:
            r = await client.get("/importadores/", params={"limit": 20})
        else:
            r = await client.get("/cursos", params={"limit": 20})
        ms = (time.perf_counter() - start) * 1000
        ok = r.status_code < 500
        return ok, ms, r.status_code
    except Exception:
        ms = (time.perf_counter() - start) * 1000
        return False, ms, 599


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--ops", type=int, default=100)
    args = parser.parse_args()

    limits = httpx.Limits(max_connections=args.ops + 20, max_keepalive_connections=args.ops)
    async with httpx.AsyncClient(base_url=args.base_url, timeout=60.0, limits=limits) as client:
        t0 = time.perf_counter()
        results = await asyncio.gather(*[one(client, i) for i in range(args.ops)])
        wall = time.perf_counter() - t0

    oks = [r for r in results if r[0]]
    fails = [r for r in results if not r[0]]
    lat = [r[1] for r in results]
    print(f"ops={args.ops} ok={len(oks)} fail={len(fails)} wall={wall:.2f}s")
    print(f"latency_ms avg={statistics.mean(lat):.0f} p95={sorted(lat)[int(0.95*len(lat))-1]:.0f} max={max(lat):.0f}")
    if fails:
        codes = {}
        for _, _, c in fails:
            codes[c] = codes.get(c, 0) + 1
        print("fail_status_counts", codes)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
