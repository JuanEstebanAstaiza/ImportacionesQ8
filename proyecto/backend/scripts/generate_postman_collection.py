"""Genera colección Postman v2.1 desde openapi_snapshot.json."""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OPENAPI = Path(__file__).resolve().parents[1] / "openapi_snapshot.json"
OUT_DIR = ROOT / "ImportacionesQ8V" / "02-Integracion-API"
OUT = OUT_DIR / "Zarpi.postman_collection.json"

PUBLIC_PREFIXES = (
    ("GET", "/"),
    ("GET", "/health"),
    ("POST", "/auth/register"),
    ("POST", "/auth/login"),
    ("POST", "/auth/verificar-email"),
    ("POST", "/auth/reenviar-otp"),
    ("POST", "/auth/login/verificar-otp"),
    ("POST", "/auth/forgot-password"),
    ("POST", "/auth/reset-password"),
    ("GET", "/legal/"),
    ("POST", "/pagos/webhook/wompi"),
)


def is_public(method: str, path: str) -> bool:
    key = (method.upper(), path)
    if key in {
        ("GET", "/"),
        ("GET", "/health"),
        ("GET", "/health/ready"),
        ("POST", "/auth/register"),
        ("POST", "/auth/login"),
        ("POST", "/auth/verificar-email"),
        ("POST", "/auth/reenviar-otp"),
        ("POST", "/auth/login/verificar-otp"),
        ("POST", "/auth/forgot-password"),
        ("POST", "/auth/reset-password"),
        ("POST", "/pagos/webhook/wompi"),
        ("GET", "/legal/politica-tratamiento-datos"),
        ("GET", "/legal/terminos-condiciones"),
        ("GET", "/importadores/"),
        ("GET", "/importadores/destacados"),
        ("GET", "/importadores/por-categoria"),
        ("GET", "/importadores/certificados"),
        ("GET", "/importadores/{importador_id}"),
        ("GET", "/importadores/{importador_id}/formulario"),
        ("GET", "/importadores/{importador_id}/evidencias"),
    }:
        return True
    return False


def path_to_postman(path: str) -> tuple[list[str], list[dict]]:
    """Convierte /foo/{id}/bar en segments y variables de path."""
    segments = []
    variables = []
    for part in path.strip("/").split("/"):
        if not part:
            continue
        if part.startswith("{") and part.endswith("}"):
            name = part[1:-1]
            segments.append(f":{name}")
            variables.append({"key": name, "value": f"{{{{{name}}}}}"})
        else:
            segments.append(part)
    return segments, variables


EXAMPLES = {
    "/auth/register": {
        "email": "dev.frontend@ejemplo.com",
        "password": "ClaveSegura1",
        "rol": "solicitante",
        "tipo_persona": "natural",
        "tipo_documento": "cedula",
        "numero_documento": "1234567890",
        "nombre": "Dev",
        "apellido": "Frontend",
        "indicativo_pais_telefono": "+57",
        "telefono": "3001234567",
        "acepto_politica_datos": True,
    },
    "/auth/login": {"email": "dev.frontend@ejemplo.com", "password": "ClaveSegura1"},
    "/auth/verificar-email": {"email": "dev.frontend@ejemplo.com", "otp": "123456"},
    "/auth/reenviar-otp": {"email": "dev.frontend@ejemplo.com", "proposito": "verificacion_email"},
    "/auth/login/verificar-otp": {"challenge_token": "{{challenge_token}}", "otp": "123456"},
    "/auth/forgot-password": {"email": "dev.frontend@ejemplo.com"},
    "/auth/reset-password": {
        "token": "{{reset_token}}",
        "otp": "123456",
        "nueva_password": "NuevaClave9",
    },
    "/cotizaciones/": {
        "modalidad": "abierta",
        "pais_importacion": "China",
        "nombre_producto": "Botellas PET 500ml",
        "descripcion_cliente": "Botellas transparentes con tapa rosca, uso alimentario.",
        "linea_producto": "Empaques",
        "tipo_calidad": "estandar",
        "cantidad_minima": 5000,
        "precio_objetivo_usd": 0.12,
        "incoterm": "FOB",
    },
    "/propuestas/": {
        "cotizacion_id": "{{cotizacion_id}}",
        "precio_ofrecido_usd": 0.11,
        "tiempo_estimado_entrega": "35-45 días",
        "incoterm": "FOB",
        "condiciones_adicionales": "Incluye inspección",
    },
    "/propuestas/borrador": {
        "cotizacion_id": "{{cotizacion_id}}",
        "precio_ofrecido_usd": 0.11,
        "tiempo_estimado_entrega": "35-45 días",
        "incoterm": "FOB",
    },
    "/creditos/comprar": {"paquete_creditos": 100},
    "/chat/ws-ticket": {"conversacion_id": "{{conversacion_id}}"},
}


def body_for(path: str, method: str) -> dict | None:
    if method.upper() not in ("POST", "PUT", "PATCH"):
        return None
    # exact path or without trailing slash
    raw = EXAMPLES.get(path) or EXAMPLES.get(path.rstrip("/") + "/") or EXAMPLES.get(path.rstrip("/"))
    if raw is None:
        raw = {}
    return {
        "mode": "raw",
        "raw": json.dumps(raw, ensure_ascii=False, indent=2),
        "options": {"raw": {"language": "json"}},
    }


def main() -> None:
    # utf-8-sig: el snapshot se exporta desde PowerShell, que antepone BOM.
    # También lee correctamente un archivo sin BOM (curl, bash).
    d = json.loads(OPENAPI.read_text(encoding="utf-8-sig"))
    by_tag: dict[str, list] = defaultdict(list)

    for path, methods in sorted(d["paths"].items()):
        for method, op in sorted(methods.items()):
            if method not in ("get", "post", "put", "patch", "delete"):
                continue
            tag = (op.get("tags") or ["Otros"])[0]
            by_tag[tag].append((method.upper(), path, op))

    folders = []
    for tag in sorted(by_tag.keys()):
        items = []
        for method, path, op in by_tag[tag]:
            segments, path_vars = path_to_postman(path)
            name = op.get("summary") or f"{method} {path}"
            headers = [{"key": "Content-Type", "value": "application/json"}]
            if not is_public(method, path):
                headers.append(
                    {
                        "key": "Authorization",
                        "value": "Bearer {{access_token}}",
                        "type": "text",
                    }
                )
            req: dict = {
                "name": name,
                "request": {
                    "method": method,
                    "header": headers,
                    "url": {
                        "raw": "{{base_url}}" + path.replace("{", "{{").replace("}", "}}")
                        if False
                        else None,
                        "host": ["{{base_url}}"],
                        "path": segments,
                    },
                    "description": (op.get("description") or op.get("summary") or "")[:500],
                },
                "response": [],
            }
            # Postman raw URL with :param style
            raw_path = "/" + "/".join(segments) if segments else "/"
            req["request"]["url"] = {
                "raw": "{{base_url}}" + raw_path,
                "host": ["{{base_url}}"],
                "path": segments,
            }
            if path_vars:
                req["request"]["url"]["variable"] = [
                    {"key": v["key"], "value": f"{{{{{v['key']}}}}}"} for v in path_vars
                ]
            # query params
            qparams = [p for p in (op.get("parameters") or []) if p.get("in") == "query"]
            if qparams:
                req["request"]["url"]["query"] = [
                    {
                        "key": p["name"],
                        "value": "",
                        "disabled": not p.get("required", False),
                        "description": p.get("description") or "",
                    }
                    for p in qparams
                ]
            body = body_for(path, method)
            if body is not None and (op.get("requestBody") or body["raw"] != "{}"):
                if op.get("requestBody"):
                    req["request"]["body"] = body
            # auth login: save token script
            if path == "/auth/login" and method == "POST":
                req["event"] = [
                    {
                        "listen": "test",
                        "script": {
                            "type": "text/javascript",
                            "exec": [
                                "if (pm.response.code === 200) {",
                                "  const j = pm.response.json();",
                                "  if (j.access_token) pm.collectionVariables.set('access_token', j.access_token);",
                                "  if (j.challenge_token) pm.collectionVariables.set('challenge_token', j.challenge_token);",
                                "  if (j.user_id) pm.collectionVariables.set('user_id', j.user_id);",
                                "}",
                            ],
                        },
                    }
                ]
            if path == "/auth/verificar-email" and method == "POST":
                req["event"] = [
                    {
                        "listen": "test",
                        "script": {
                            "type": "text/javascript",
                            "exec": [
                                "if (pm.response.code === 200) {",
                                "  const j = pm.response.json();",
                                "  if (j.access_token) pm.collectionVariables.set('access_token', j.access_token);",
                                "  if (j.user_id) pm.collectionVariables.set('user_id', j.user_id);",
                                "}",
                            ],
                        },
                    }
                ]
            items.append(req)
        folders.append({"name": tag, "item": items})

    collection = {
        "info": {
            "name": "Zarpi API",
            "description": (
                "Colección generada desde OpenAPI del backend.\n\n"
                "1. Importa en Postman o Insomnia.\n"
                "2. Variable base_url = http://localhost:8000\n"
                "3. Tras login/verificar-email se guarda access_token automáticamente (Postman).\n"
                "4. Completa path vars: cotizacion_id, conversacion_id, etc.\n\n"
                "Docs: ImportacionesQ8V/02-Integracion-API/"
            ),
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
        },
        "variable": [
            {"key": "base_url", "value": "http://localhost:8000"},
            {"key": "access_token", "value": ""},
            {"key": "challenge_token", "value": ""},
            {"key": "user_id", "value": ""},
            {"key": "cotizacion_id", "value": ""},
            {"key": "propuesta_id", "value": ""},
            {"key": "orden_id", "value": ""},
            {"key": "importador_id", "value": ""},
            {"key": "conversacion_id", "value": ""},
            {"key": "pago_id", "value": ""},
            {"key": "disputa_id", "value": ""},
            {"key": "reset_token", "value": ""},
        ],
        "item": folders,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(collection, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT} ({sum(len(f['item']) for f in folders)} requests)")


if __name__ == "__main__":
    main()
