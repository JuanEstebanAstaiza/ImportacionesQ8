#!/usr/bin/env python3
"""
Simulación de carga y transacciones de negocio para ImportacionesQ8.

Flujos cubiertos por usuario virtual:
  1. Registro / login de solicitante
  2. Creación de cotización dirigida
  3. Redacción/envío de propuesta (importador)
  4. Inicio de negociación + chat REST
  5. Doble pre-aceptación (solicitante + empresa)

Uso:
  python scripts/load_simulation.py --base-url http://localhost:8000 --users 20 --concurrency 10
"""
from __future__ import annotations

import argparse
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
    timings: List[Timing] = field(default_factory=list)
    success: bool = False
    stage_failed: str = ""

    @property
    def total_ms(self) -> float:
        return sum(t.ms for t in self.timings)


def timed(client: httpx.Client, method: str, path: str, **kwargs) -> Tuple[httpx.Response, Timing]:
    start = time.perf_counter()
    try:
        response = client.request(method, path, **kwargs)
        ms = (time.perf_counter() - start) * 1000
        return response, Timing(name=f"{method} {path}", ms=ms, ok=response.is_success, status=response.status_code)
    except Exception as exc:  # noqa: BLE001
        ms = (time.perf_counter() - start) * 1000
        fake = httpx.Response(599, request=httpx.Request(method, path))
        return fake, Timing(name=f"{method} {path}", ms=ms, ok=False, status=599, error=str(exc))


def seed_admin_and_company(base_url: str) -> Dict[str, str]:
    """Crea admin + empresa importadora vía exec interno si no existen."""
    # Seed se hace fuera (docker exec). Aquí solo login/admin bootstrap vía HTTP si ya hay tokens.
    raise NotImplementedError


def ensure_bootstrap(base_url: str, admin_email: str, admin_password: str) -> Dict[str, Any]:
    """
    Espera API healthy, login admin, crea empresa si hace falta.
    Retorna tokens/ids necesarios para la simulación.
    """
    with httpx.Client(base_url=base_url, timeout=30.0) as client:
        for _ in range(30):
            try:
                r = client.get("/health")
                if r.status_code == 200:
                    break
            except Exception:
                pass
            time.sleep(1)
        else:
            raise RuntimeError("API no respondió en /health")

        login = client.post("/auth/login", json={"email": admin_email, "password": admin_password})
        if login.status_code != 200:
            raise RuntimeError(
                f"Login admin falló ({login.status_code}): {login.text}. "
                "Ejecuta primero scripts/seed_load_admin.py dentro del contenedor."
            )
        admin_token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {admin_token}"}

        # Crear empresa dedicada a la corrida
        suffix = uuid.uuid4().hex[:8]
        email_dueno = f"dueno_load_{suffix}@example.com"
        create = client.post(
            "/admin/importadores",
            headers=headers,
            json={
                "nombre_empresa": f"Empresa Load {suffix}",
                "especialidad_producto": ["Textiles"],
                "paises_origen": ["China"],
                "tiempo_respuesta_promedio": "24h",
                "email_dueño": email_dueno,
                "password_dueño": PASSWORD,
                "nombre_dueño": "Dueño Load",
            },
        )
        if create.status_code not in (200, 201):
            raise RuntimeError(f"Crear importador falló: {create.status_code} {create.text}")

        data = create.json()
        importador_id = data["importador"]["id"]

        login_dueno = client.post("/auth/login", json={"email": email_dueno, "password": PASSWORD})
        if login_dueno.status_code != 200:
            raise RuntimeError(f"Login dueño falló: {login_dueno.text}")
        dueno_token = login_dueno.json()["access_token"]

        return {
            "admin_token": admin_token,
            "importador_id": importador_id,
            "dueno_token": dueno_token,
            "dueno_email": email_dueno,
        }


def run_one_user(base_url: str, user_index: int, importador_id: str, dueno_token: str) -> UserResult:
    result = UserResult(user_index=user_index)
    email = f"solicitante_load_{user_index}_{uuid.uuid4().hex[:6]}@example.com"

    with httpx.Client(base_url=base_url, timeout=45.0) as client:
        # 1) Registro
        reg_body = {
            "email": email,
            "password": PASSWORD,
            "rol": "solicitante",
            "tipo_persona": "natural",
            "tipo_documento": "cedula",
            "numero_documento": f"10{user_index:08d}",
            "nombre": f"User{user_index}",
            "apellido": "Load",
            "indicativo_pais_telefono": "+57",
            "telefono": f"300{user_index:07d}"[-10:],
            "acepto_politica_datos": True,
        }
        r, t = timed(client, "POST", "/auth/register", json=reg_body)
        result.timings.append(t)
        if not t.ok:
            result.stage_failed = "register"
            return result
        sol_token = r.json()["access_token"]
        sol_headers = {"Authorization": f"Bearer {sol_token}"}
        dueno_headers = {"Authorization": f"Bearer {dueno_token}"}

        # 2) Crear cotización dirigida
        cot_body = {
            "modalidad": "dirigida",
            "importador_id": importador_id,
            "pais_importacion": "China",
            "nombre_producto": f"Producto Load {user_index}",
            "descripcion_cliente": f"Necesito producto de prueba para carga usuario {user_index}",
            "linea_producto": "Textiles",
            "tipo_calidad": "estandar",
            "cantidad_minima": 100,
            "incoterm": "FOB",
        }
        r, t = timed(client, "POST", "/cotizaciones/", headers=sol_headers, json=cot_body)
        result.timings.append(t)
        if not t.ok:
            result.stage_failed = "crear_cotizacion"
            t.error = r.text[:200]
            return result
        cotizacion_id = r.json()["id"]

        # 3) Importador envía propuesta
        prop_body = {
            "cotizacion_id": cotizacion_id,
            "precio_ofrecido_usd": 12.5 + (user_index % 10),
            "tiempo_estimado_entrega": "30 días",
            "incoterm": "FOB",
            "condiciones_adicionales": "Simulación de carga",
        }
        r, t = timed(client, "POST", "/propuestas/", headers=dueno_headers, json=prop_body)
        result.timings.append(t)
        if not t.ok:
            result.stage_failed = "enviar_propuesta"
            t.error = r.text[:200]
            return result
        propuesta_id = r.json()["id"]

        # 4) Solicitante inicia negociación (abre chat)
        r, t = timed(
            client,
            "PUT",
            f"/cotizaciones/{cotizacion_id}/propuestas/aceptar",
            headers=sol_headers,
            json={"importador_id": importador_id},
        )
        result.timings.append(t)
        if not t.ok:
            result.stage_failed = "iniciar_negociacion"
            t.error = r.text[:200]
            return result

        # 5) Listar conversaciones + enviar mensajes chat
        r, t = timed(client, "GET", "/chat/conversaciones", headers=sol_headers)
        result.timings.append(t)
        if not t.ok or not r.json():
            result.stage_failed = "listar_chat"
            t.error = (r.text if t.ok else r.text)[:200]
            return result
        conversacion_id = r.json()[0]["id"]

        for i in range(3):
            r, t = timed(
                client,
                "POST",
                f"/chat/conversaciones/{conversacion_id}/mensajes",
                headers=sol_headers if i % 2 == 0 else dueno_headers,
                json={"contenido": f"Mensaje carga {user_index}-{i}", "tipo": "texto"},
            )
            result.timings.append(t)
            if not t.ok:
                result.stage_failed = "enviar_mensaje_chat"
                t.error = r.text[:200]
                return result

        # 6) Doble pre-aceptación
        r, t = timed(
            client,
            "POST",
            f"/propuestas/{propuesta_id}/pre-aceptar",
            headers=sol_headers,
            json={"aceptar": True},
        )
        result.timings.append(t)
        if not t.ok:
            result.stage_failed = "preaceptar_solicitante"
            t.error = r.text[:200]
            return result

        r, t = timed(
            client,
            "POST",
            f"/propuestas/{propuesta_id}/pre-aceptar",
            headers=dueno_headers,
            json={"aceptar": True},
        )
        result.timings.append(t)
        if not t.ok:
            result.stage_failed = "preaceptar_empresa"
            t.error = r.text[:200]
            return result

        # 7) Verificar orden creada
        r, t = timed(client, "GET", "/ordenes/", headers=sol_headers)
        result.timings.append(t)
        if not t.ok:
            result.stage_failed = "listar_ordenes"
            t.error = r.text[:200]
            return result

        result.success = True
        return result


def percentile(values: List[float], p: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    k = (len(ordered) - 1) * (p / 100)
    f = int(k)
    c = min(f + 1, len(ordered) - 1)
    if f == c:
        return ordered[f]
    return ordered[f] + (ordered[c] - ordered[f]) * (k - f)


def summarize(results: List[UserResult], wall_ms: float) -> Dict[str, Any]:
    successes = [r for r in results if r.success]
    failures = [r for r in results if not r.success]
    all_timings = [t for r in results for t in r.timings]
    ok_timings = [t.ms for t in all_timings if t.ok]
    by_endpoint: Dict[str, List[float]] = {}
    for t in all_timings:
        by_endpoint.setdefault(t.name.split("?")[0], []).append(t.ms)

    endpoint_stats = []
    for name, samples in sorted(by_endpoint.items()):
        endpoint_stats.append({
            "endpoint": name,
            "count": len(samples),
            "avg_ms": round(statistics.mean(samples), 2),
            "p95_ms": round(percentile(samples, 95), 2),
            "max_ms": round(max(samples), 2),
        })

    fail_stages: Dict[str, int] = {}
    for r in failures:
        fail_stages[r.stage_failed or "unknown"] = fail_stages.get(r.stage_failed or "unknown", 0) + 1

    return {
        "users_total": len(results),
        "users_ok": len(successes),
        "users_fail": len(failures),
        "success_rate_pct": round(100.0 * len(successes) / max(len(results), 1), 2),
        "wall_time_ms": round(wall_ms, 2),
        "throughput_users_per_sec": round(len(results) / max(wall_ms / 1000, 0.001), 2),
        "request_count": len(all_timings),
        "request_ok": len(ok_timings),
        "latency_avg_ms": round(statistics.mean(ok_timings), 2) if ok_timings else 0,
        "latency_p50_ms": round(percentile(ok_timings, 50), 2) if ok_timings else 0,
        "latency_p95_ms": round(percentile(ok_timings, 95), 2) if ok_timings else 0,
        "latency_p99_ms": round(percentile(ok_timings, 99), 2) if ok_timings else 0,
        "latency_max_ms": round(max(ok_timings), 2) if ok_timings else 0,
        "fail_stages": fail_stages,
        "endpoint_stats": endpoint_stats,
        "sample_errors": [
            {
                "user": r.user_index,
                "stage": r.stage_failed,
                "error": next((t.error for t in reversed(r.timings) if t.error or not t.ok), ""),
                "status": next((t.status for t in reversed(r.timings) if not t.ok), 0),
            }
            for r in failures[:10]
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Load + transaction simulation for ImportacionesQ8")
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--users", type=int, default=20)
    parser.add_argument("--concurrency", type=int, default=10)
    parser.add_argument("--admin-email", default="admin_load@example.com")
    parser.add_argument("--admin-password", default=PASSWORD)
    parser.add_argument("--output", default="scripts/load_results.json")
    args = parser.parse_args()

    print(f"Bootstrap contra {args.base_url} ...")
    boot = ensure_bootstrap(args.base_url, args.admin_email, args.admin_password)
    print(f"Empresa lista: {boot['importador_id']}")

    print(f"Simulando {args.users} usuarios (concurrency={args.concurrency}) ...")
    wall_start = time.perf_counter()
    results: List[UserResult] = []
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        futures = [
            pool.submit(run_one_user, args.base_url, i, boot["importador_id"], boot["dueno_token"])
            for i in range(args.users)
        ]
        for fut in as_completed(futures):
            results.append(fut.result())
    wall_ms = (time.perf_counter() - wall_start) * 1000

    summary = summarize(results, wall_ms)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print(json.dumps(summary, indent=2, ensure_ascii=False))
    print(f"\nResultados guardados en {args.output}")
    return 0 if summary["users_fail"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
