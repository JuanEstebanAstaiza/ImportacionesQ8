#!/usr/bin/env python3
"""
Prueba de alto flujo: 1000 usuarios concurrentes (escenarios mixtos).

Fases:
  1) provision — registra N solicitantes en oleadas
  2) peak     — asyncio: N tareas concurrentes comparten un AsyncClient
                 (evita 'Too many open files' de 1000 Client() síncronos)

Uso:
  python -u scripts/load_1000_concurrent.py --base-url http://127.0.0.1:8000 \\
      --users 1000 --concurrency 1000
"""
from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import httpx

PASSWORD = "LoadTest123!"
TIMEOUT = httpx.Timeout(120.0, connect=30.0)


@dataclass
class Timing:
    name: str
    ms: float
    ok: bool
    status: int = 0
    error: str = ""


@dataclass
class UserResult:
    user_index: int
    scenario: str
    timings: List[Timing] = field(default_factory=list)
    success: bool = False
    stage_failed: str = ""


def percentile(values: List[float], p: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    k = (len(ordered) - 1) * (p / 100.0)
    f = int(k)
    c = min(f + 1, len(ordered) - 1)
    if f == c:
        return ordered[f]
    return ordered[f] + (ordered[c] - ordered[f]) * (k - f)


def timed_sync(client: httpx.Client, method: str, path: str, **kwargs) -> Tuple[httpx.Response, Timing]:
    start = time.perf_counter()
    try:
        response = client.request(method, path, **kwargs)
        ms = (time.perf_counter() - start) * 1000
        return response, Timing(
            name=f"{method} {path.split('?')[0]}",
            ms=ms,
            ok=response.is_success,
            status=response.status_code,
            error="" if response.is_success else response.text[:240],
        )
    except Exception as exc:  # noqa: BLE001
        ms = (time.perf_counter() - start) * 1000
        return (
            httpx.Response(599, request=httpx.Request(method, path)),
            Timing(name=f"{method} {path.split('?')[0]}", ms=ms, ok=False, status=599, error=str(exc)[:240]),
        )


async def timed_async(client: httpx.AsyncClient, method: str, path: str, **kwargs) -> Tuple[httpx.Response, Timing]:
    start = time.perf_counter()
    try:
        response = await client.request(method, path, **kwargs)
        ms = (time.perf_counter() - start) * 1000
        return response, Timing(
            name=f"{method} {path.split('?')[0]}",
            ms=ms,
            ok=response.is_success,
            status=response.status_code,
            error="" if response.is_success else response.text[:240],
        )
    except Exception as exc:  # noqa: BLE001
        ms = (time.perf_counter() - start) * 1000
        return (
            httpx.Response(599, request=httpx.Request(method, path)),
            Timing(name=f"{method} {path.split('?')[0]}", ms=ms, ok=False, status=599, error=str(exc)[:240]),
        )


def ensure_bootstrap(base_url: str, admin_email: str, admin_password: str, companies: int) -> Dict[str, Any]:
    print(f"  waiting ready at {base_url} ...", flush=True)
    with httpx.Client(base_url=base_url, timeout=TIMEOUT) as client:
        for i in range(60):
            try:
                r = client.get("/health/ready")
                if r.status_code == 200:
                    print("  ready OK", flush=True)
                    break
            except Exception as exc:
                if i % 10 == 0:
                    print(f"  ready wait ({i}): {exc}", flush=True)
            time.sleep(1)
        else:
            raise RuntimeError("API no quedó ready")

        print("  login admin...", flush=True)
        login = client.post("/auth/login", json={"email": admin_email, "password": admin_password})
        if login.status_code != 200:
            raise RuntimeError(f"Login admin falló: {login.status_code} {login.text}")
        admin_token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {admin_token}"}

        firms = []
        for i in range(companies):
            suffix = uuid.uuid4().hex[:8]
            email_dueno = f"dueno_c{i}_{suffix}@example.com"
            print(f"  creating company {i+1}/{companies}...", flush=True)
            create = client.post(
                "/admin/importadores",
                headers=headers,
                json={
                    "nombre_empresa": f"Empresa Carga {i} {suffix}",
                    "especialidad_producto": ["Textiles"],
                    "paises_origen": ["China"],
                    "tiempo_respuesta_promedio": "24h",
                    "email_dueño": email_dueno,
                    "password_dueño": PASSWORD,
                    "nombre_dueño": f"Dueño {i}",
                },
            )
            if create.status_code not in (200, 201):
                raise RuntimeError(f"Crear importador falló: {create.status_code} {create.text}")
            importador_id = create.json()["importador"]["id"]
            login_dueno = client.post("/auth/login", json={"email": email_dueno, "password": PASSWORD})
            if login_dueno.status_code != 200:
                raise RuntimeError(f"Login dueño falló: {login_dueno.text}")
            firms.append(
                {
                    "importador_id": importador_id,
                    "dueno_token": login_dueno.json()["access_token"],
                    "dueno_email": email_dueno,
                }
            )
        return {"admin_token": admin_token, "firms": firms}


def register_user(base_url: str, user_index: int, run_id: str) -> Dict[str, Any]:
    email = f"u{user_index}_{run_id}@load.example.com"
    doc = f"{run_id[:4]}{user_index:08d}"[-12:]
    tel = f"3{user_index:09d}"[-10:]
    with httpx.Client(base_url=base_url, timeout=TIMEOUT) as client:
        r, t = timed_sync(
            client,
            "POST",
            "/auth/register",
            json={
                "email": email,
                "password": PASSWORD,
                "rol": "solicitante",
                "tipo_persona": "natural",
                "tipo_documento": "cedula",
                "numero_documento": doc,
                "nombre": f"User{user_index}",
                "apellido": "Load",
                "indicativo_pais_telefono": "+57",
                "telefono": tel,
                "acepto_politica_datos": True,
            },
        )
        if not t.ok:
            return {"ok": False, "timing": t, "email": email, "token": None, "user_index": user_index}
        return {
            "ok": True,
            "timing": t,
            "email": email,
            "token": r.json()["access_token"],
            "user_index": user_index,
        }


def pick_scenario(idx: int) -> str:
    bucket = idx % 10
    if bucket < 2:
        return "full_deal"
    if bucket < 5:
        return "browse"
    if bucket < 7:
        return "cotizacion_abierta"
    if bucket < 9:
        return "chat_negociacion"
    return "auth_refresh"


async def scenario_full_deal(client: httpx.AsyncClient, token: str, firm: Dict[str, str], idx: int) -> UserResult:
    result = UserResult(user_index=idx, scenario="full_deal")
    sol_h = {"Authorization": f"Bearer {token}"}
    due_h = {"Authorization": f"Bearer {firm['dueno_token']}"}
    imp_id = firm["importador_id"]

    r, t = await timed_async(
        client,
        "POST",
        "/cotizaciones/",
        headers=sol_h,
        json={
            "modalidad": "dirigida",
            "importador_id": imp_id,
            "pais_importacion": "China",
            "nombre_producto": f"Prod {idx}",
            "descripcion_cliente": f"Descripcion de carga concurrente usuario {idx}",
            "linea_producto": "Textiles",
            "tipo_calidad": "estandar",
            "cantidad_minima": 100,
            "incoterm": "FOB",
        },
    )
    result.timings.append(t)
    if not t.ok:
        result.stage_failed = "crear_cotizacion"
        return result
    cot_id = r.json()["id"]

    r, t = await timed_async(
        client,
        "POST",
        "/propuestas/",
        headers=due_h,
        json={
            "cotizacion_id": cot_id,
            "precio_ofrecido_usd": 10 + (idx % 20),
            "tiempo_estimado_entrega": "30 días",
            "incoterm": "FOB",
            "condiciones_adicionales": "load",
        },
    )
    result.timings.append(t)
    if not t.ok:
        result.stage_failed = "enviar_propuesta"
        return result
    prop_id = r.json()["id"]

    r, t = await timed_async(
        client,
        "PUT",
        f"/cotizaciones/{cot_id}/propuestas/aceptar",
        headers=sol_h,
        json={"importador_id": imp_id},
    )
    result.timings.append(t)
    if not t.ok:
        result.stage_failed = "negociacion"
        return result

    r, t = await timed_async(client, "GET", "/chat/conversaciones", headers=sol_h)
    result.timings.append(t)
    if not t.ok or not r.json():
        result.stage_failed = "listar_chat"
        return result
    conv = r.json()[0]["id"]

    for i in range(2):
        r, t = await timed_async(
            client,
            "POST",
            f"/chat/conversaciones/{conv}/mensajes",
            headers=sol_h if i % 2 == 0 else due_h,
            json={"contenido": f"msg {idx}-{i}", "tipo": "texto"},
        )
        result.timings.append(t)
        if not t.ok:
            result.stage_failed = "chat"
            return result

    r, t = await timed_async(client, "POST", f"/propuestas/{prop_id}/pre-aceptar", headers=sol_h, json={"aceptar": True})
    result.timings.append(t)
    if not t.ok:
        result.stage_failed = "preaceptar_sol"
        return result
    r, t = await timed_async(client, "POST", f"/propuestas/{prop_id}/pre-aceptar", headers=due_h, json={"aceptar": True})
    result.timings.append(t)
    if not t.ok:
        result.stage_failed = "preaceptar_emp"
        return result

    r, t = await timed_async(client, "GET", "/ordenes/", headers=sol_h)
    result.timings.append(t)
    if not t.ok:
        result.stage_failed = "ordenes"
        return result
    result.success = True
    return result


async def scenario_browse(client: httpx.AsyncClient, token: str, idx: int) -> UserResult:
    result = UserResult(user_index=idx, scenario="browse")
    h = {"Authorization": f"Bearer {token}"}
    for path in ("/usuarios/me", "/importadores/", "/cotizaciones/", "/creditos/saldo", "/health"):
        headers = None if path == "/health" else h
        r, t = await timed_async(client, "GET", path, headers=headers)
        result.timings.append(t)
        if not t.ok:
            result.stage_failed = path
            return result
    result.success = True
    return result


async def scenario_cotizacion_abierta(client: httpx.AsyncClient, token: str, idx: int) -> UserResult:
    result = UserResult(user_index=idx, scenario="cotizacion_abierta")
    h = {"Authorization": f"Bearer {token}"}
    r, t = await timed_async(
        client,
        "POST",
        "/cotizaciones/",
        headers=h,
        json={
            "modalidad": "abierta",
            "pais_importacion": "China",
            "nombre_producto": f"Abierta {idx}",
            "descripcion_cliente": f"Cotizacion abierta de carga usuario {idx}",
            "linea_producto": "Textiles",
            "tipo_calidad": "estandar",
            "cantidad_minima": 50,
            "incoterm": "FOB",
        },
    )
    result.timings.append(t)
    if not t.ok:
        result.stage_failed = "crear_abierta"
        return result
    cot_id = r.json()["id"]
    r, t = await timed_async(client, "GET", f"/cotizaciones/{cot_id}/matching-status", headers=h)
    result.timings.append(t)
    if not t.ok:
        result.stage_failed = "matching_status"
        return result
    r, t = await timed_async(client, "GET", "/cotizaciones/", headers=h)
    result.timings.append(t)
    result.success = t.ok
    if not t.ok:
        result.stage_failed = "listar"
    return result


async def scenario_chat_negociacion(client: httpx.AsyncClient, token: str, firm: Dict[str, str], idx: int) -> UserResult:
    result = UserResult(user_index=idx, scenario="chat_negociacion")
    sol_h = {"Authorization": f"Bearer {token}"}
    due_h = {"Authorization": f"Bearer {firm['dueno_token']}"}
    imp_id = firm["importador_id"]

    r, t = await timed_async(
        client,
        "POST",
        "/cotizaciones/",
        headers=sol_h,
        json={
            "modalidad": "dirigida",
            "importador_id": imp_id,
            "pais_importacion": "China",
            "nombre_producto": f"ChatProd {idx}",
            "descripcion_cliente": f"Negociacion chat carga {idx}",
            "linea_producto": "Textiles",
            "tipo_calidad": "estandar",
            "cantidad_minima": 80,
            "incoterm": "FOB",
        },
    )
    result.timings.append(t)
    if not t.ok:
        result.stage_failed = "crear_cotizacion"
        return result
    cot_id = r.json()["id"]

    r, t = await timed_async(
        client,
        "POST",
        "/propuestas/",
        headers=due_h,
        json={
            "cotizacion_id": cot_id,
            "precio_ofrecido_usd": 15.0,
            "tiempo_estimado_entrega": "20 días",
            "incoterm": "FOB",
        },
    )
    result.timings.append(t)
    if not t.ok:
        result.stage_failed = "propuesta"
        return result

    r, t = await timed_async(
        client,
        "PUT",
        f"/cotizaciones/{cot_id}/propuestas/aceptar",
        headers=sol_h,
        json={"importador_id": imp_id},
    )
    result.timings.append(t)
    if not t.ok:
        result.stage_failed = "negociacion"
        return result

    r, t = await timed_async(client, "GET", "/chat/conversaciones", headers=sol_h)
    result.timings.append(t)
    if not t.ok or not r.json():
        result.stage_failed = "listar_chat"
        return result
    conv = r.json()[0]["id"]
    for i in range(5):
        r, t = await timed_async(
            client,
            "POST",
            f"/chat/conversaciones/{conv}/mensajes",
            headers=sol_h,
            json={"contenido": f"burst {idx}-{i}", "tipo": "texto"},
        )
        result.timings.append(t)
        if not t.ok:
            result.stage_failed = "chat_burst"
            return result
    result.success = True
    return result


async def scenario_auth_refresh(client: httpx.AsyncClient, email: str, idx: int) -> UserResult:
    result = UserResult(user_index=idx, scenario="auth_refresh")
    r, t = await timed_async(client, "POST", "/auth/login", json={"email": email, "password": PASSWORD})
    result.timings.append(t)
    if not t.ok:
        result.stage_failed = "login"
        return result
    new_token = r.json()["access_token"]
    h = {"Authorization": f"Bearer {new_token}"}
    r, t = await timed_async(client, "POST", "/auth/refresh", headers=h)
    result.timings.append(t)
    if not t.ok:
        result.stage_failed = "refresh"
        return result
    r, t = await timed_async(client, "GET", "/usuarios/me", headers=h)
    result.timings.append(t)
    result.success = t.ok
    if not t.ok:
        result.stage_failed = "me"
    return result


async def run_one_peak(
    client: httpx.AsyncClient,
    provisioned: Dict[str, Any],
    firms: List[Dict[str, str]],
    barrier: asyncio.Barrier,
    sem: asyncio.Semaphore,
) -> UserResult:
    idx = provisioned["user_index"]
    token = provisioned["token"]
    email = provisioned["email"]
    firm = firms[idx % len(firms)]
    scenario = pick_scenario(idx)

    await barrier.wait()
    async with sem:
        if scenario == "full_deal":
            return await scenario_full_deal(client, token, firm, idx)
        if scenario == "browse":
            return await scenario_browse(client, token, idx)
        if scenario == "cotizacion_abierta":
            return await scenario_cotizacion_abierta(client, token, idx)
        if scenario == "chat_negociacion":
            return await scenario_chat_negociacion(client, token, firm, idx)
        return await scenario_auth_refresh(client, email, idx)


async def run_peak_async(
    base_url: str,
    provisioned: List[Dict[str, Any]],
    firms: List[Dict[str, str]],
    concurrency: int,
) -> Tuple[List[UserResult], float]:
    n = len(provisioned)
    barrier = asyncio.Barrier(n)
    sem = asyncio.Semaphore(concurrency)
    limits = httpx.Limits(max_connections=concurrency, max_keepalive_connections=min(200, concurrency))
    t0 = time.perf_counter()
    async with httpx.AsyncClient(base_url=base_url, timeout=TIMEOUT, limits=limits) as client:
        tasks = [run_one_peak(client, u, firms, barrier, sem) for u in provisioned]
        results = await asyncio.gather(*tasks, return_exceptions=True)
    wall_ms = (time.perf_counter() - t0) * 1000

    out: List[UserResult] = []
    for i, r in enumerate(results):
        if isinstance(r, Exception):
            out.append(
                UserResult(
                    user_index=provisioned[i]["user_index"],
                    scenario=pick_scenario(provisioned[i]["user_index"]),
                    stage_failed=f"exception:{type(r).__name__}:{r}",
                )
            )
        else:
            out.append(r)
    return out, wall_ms


def summarize(results: List[UserResult], wall_ms: float, phase: str) -> Dict[str, Any]:
    ok = [r for r in results if r.success]
    fail = [r for r in results if not r.success]
    timings = [t for r in results for t in r.timings]
    ok_ms = [t.ms for t in timings if t.ok]
    by_scenario: Dict[str, Dict[str, int]] = {}
    for r in results:
        slot = by_scenario.setdefault(r.scenario or "unknown", {"ok": 0, "fail": 0})
        slot["ok" if r.success else "fail"] += 1
    fail_stages: Dict[str, int] = {}
    for r in fail:
        key = (r.stage_failed or "unknown")[:80]
        fail_stages[key] = fail_stages.get(key, 0) + 1

    by_ep: Dict[str, List[float]] = {}
    for t in timings:
        key = t.name
        for part in key.split("/"):
            if len(part) == 36 and part.count("-") == 4:
                key = key.replace(part, "{id}")
        by_ep.setdefault(key, []).append(t.ms)
    endpoint_stats = [
        {
            "endpoint": name,
            "count": len(samples),
            "avg_ms": round(statistics.mean(samples), 2),
            "p95_ms": round(percentile(samples, 95), 2),
            "max_ms": round(max(samples), 2),
        }
        for name, samples in sorted(by_ep.items(), key=lambda x: -len(x[1]))[:40]
    ]

    return {
        "phase": phase,
        "users_total": len(results),
        "users_ok": len(ok),
        "users_fail": len(fail),
        "success_rate_pct": round(100.0 * len(ok) / max(len(results), 1), 2),
        "wall_time_ms": round(wall_ms, 2),
        "throughput_users_per_sec": round(len(results) / max(wall_ms / 1000.0, 0.001), 2),
        "request_count": len(timings),
        "request_ok": len(ok_ms),
        "latency_avg_ms": round(statistics.mean(ok_ms), 2) if ok_ms else 0,
        "latency_p50_ms": round(percentile(ok_ms, 50), 2) if ok_ms else 0,
        "latency_p95_ms": round(percentile(ok_ms, 95), 2) if ok_ms else 0,
        "latency_p99_ms": round(percentile(ok_ms, 99), 2) if ok_ms else 0,
        "latency_max_ms": round(max(ok_ms), 2) if ok_ms else 0,
        "scenarios": by_scenario,
        "fail_stages": fail_stages,
        "endpoint_stats": endpoint_stats,
        "sample_errors": [
            {
                "user": r.user_index,
                "scenario": r.scenario,
                "stage": r.stage_failed,
                "status": next((t.status for t in reversed(r.timings) if not t.ok), 0),
                "error": next((t.error for t in reversed(r.timings) if t.error), ""),
            }
            for r in fail[:20]
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--users", type=int, default=1000)
    parser.add_argument("--concurrency", type=int, default=1000, help="Máx. requests in-flight en peak")
    parser.add_argument("--provision-concurrency", type=int, default=100)
    parser.add_argument("--companies", type=int, default=5)
    parser.add_argument("--admin-email", default="admin_load@example.com")
    parser.add_argument("--admin-password", default=PASSWORD)
    parser.add_argument("--output", default="scripts/load_results_1000.json")
    args = parser.parse_args()

    run_id = uuid.uuid4().hex[:8]
    print(f"[{run_id}] Bootstrap ({args.companies} empresas)...", flush=True)
    boot = ensure_bootstrap(args.base_url, args.admin_email, args.admin_password, args.companies)
    print(f"Empresas OK: {len(boot['firms'])}", flush=True)

    print(f"Fase provision: registrando {args.users} usuarios (conc={args.provision_concurrency})...", flush=True)
    provisioned: List[Dict[str, Any]] = []
    provision_timings: List[Timing] = []
    t0 = time.perf_counter()
    done = 0
    with ThreadPoolExecutor(max_workers=args.provision_concurrency) as pool:
        futs = [pool.submit(register_user, args.base_url, i, run_id) for i in range(args.users)]
        for fut in as_completed(futs):
            row = fut.result()
            provision_timings.append(row["timing"])
            if row["ok"]:
                provisioned.append(row)
            done += 1
            if done % 100 == 0 or done == args.users:
                print(f"  provision {done}/{args.users} (ok={len(provisioned)})", flush=True)
    provision_ms = (time.perf_counter() - t0) * 1000
    print(
        f"Provisionados {len(provisioned)}/{args.users} en {provision_ms/1000:.1f}s "
        f"(register p95={percentile([t.ms for t in provision_timings if t.ok], 95):.0f}ms)",
        flush=True,
    )
    if len(provisioned) < max(1, args.users // 2):
        print("ABORT: menos del 50% de registros OK", flush=True)
        return 2

    conc = min(args.concurrency, len(provisioned))
    print(f"Fase peak async: {len(provisioned)} usuarios, max_in_flight={conc}, barrier=all...", flush=True)
    peak_results, peak_wall = asyncio.run(run_peak_async(args.base_url, provisioned, boot["firms"], conc))

    summary = {
        "run_id": run_id,
        "target_concurrent_users": args.users,
        "max_in_flight": conc,
        "provision": {
            "registered_ok": len(provisioned),
            "registered_total": args.users,
            "wall_time_ms": round(provision_ms, 2),
            "register_p95_ms": round(percentile([t.ms for t in provision_timings if t.ok], 95), 2),
            "register_fail": sum(1 for t in provision_timings if not t.ok),
        },
        "peak": summarize(peak_results, peak_wall, "peak_mixed_async"),
    }
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    peak = summary["peak"]
    print(json.dumps({**summary, "peak": {k: peak[k] for k in peak if k != "endpoint_stats"}}, indent=2, ensure_ascii=False), flush=True)
    print("\nTop endpoints:", flush=True)
    for row in peak["endpoint_stats"][:12]:
        print(f"  {row['endpoint']}: n={row['count']} avg={row['avg_ms']} p95={row['p95_ms']}", flush=True)
    print(
        f"\nRESUMEN PEAK: {peak['users_ok']}/{peak['users_total']} OK "
        f"({peak['success_rate_pct']}%) | p95={peak['latency_p95_ms']}ms | "
        f"reqs={peak['request_count']} | wall={peak['wall_time_ms']/1000:.1f}s",
        flush=True,
    )
    print(f"Guardado en {args.output}", flush=True)
    return 0 if peak["success_rate_pct"] >= 95.0 else 1


if __name__ == "__main__":
    sys.exit(main())
