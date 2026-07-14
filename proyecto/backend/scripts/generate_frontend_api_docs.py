"""
Genera documentación Obsidian de TODAS las APIs para el equipo frontend.
Fuente: openapi_snapshot.json (exportado de /openapi.json en desarrollo).
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]  # ImportacionesQ8
OPENAPI = Path(__file__).resolve().parents[1] / "openapi_snapshot.json"
OUT = ROOT / "ImportacionesQ8V" / "API-Frontend"

TAG_FILES = {
    "Salud": "13-Legal-y-Salud.md",
    "Legal": "13-Legal-y-Salud.md",
    "Autenticación": "02-Auth.md",
    "Usuarios": "03-Usuarios-Asesores-y-Perfil.md",
    "Asesores": "03-Usuarios-Asesores-y-Perfil.md",
    "Importadores": "04-Importadores.md",
    "Cotizaciones": "05-Cotizaciones-y-Propuestas.md",
    "Propuestas": "05-Cotizaciones-y-Propuestas.md",
    "Órdenes": "06-Ordenes.md",
    "Créditos": "07-Creditos-y-Pagos.md",
    "Pagos": "07-Creditos-y-Pagos.md",
    "Chat": "08-Chat-y-WebSocket.md",
    "Organizaciones solicitantes": "09-Organizaciones.md",
    "Disputas": "10-Disputas.md",
    "Referidos": "11-Referidos.md",
    "Administración": "12-Admin.md",
}

PUBLIC_PATHS = {
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
    ("GET", "/legal/politica-tratamiento-datos"),
    ("GET", "/legal/terminos-condiciones"),
    ("POST", "/pagos/webhook/wompi"),
    ("GET", "/importadores/"),
    ("GET", "/importadores/destacados"),
    ("GET", "/importadores/por-categoria"),
    ("GET", "/importadores/certificados"),
    ("GET", "/importadores/{importador_id}"),
    ("GET", "/importadores/{importador_id}/formulario"),
    ("GET", "/importadores/{importador_id}/evidencias"),
}


def resolve_ref(ref: str | None) -> str | None:
    if not ref or not ref.startswith("#/components/schemas/"):
        return None
    return ref.split("/")[-1]


def type_of(v: dict) -> str:
    if "$ref" in v:
        return resolve_ref(v["$ref"]) or "?"
    if "anyOf" in v:
        parts = []
        nullable = False
        for a in v["anyOf"]:
            if a.get("type") == "null":
                nullable = True
            elif "$ref" in a:
                parts.append(resolve_ref(a["$ref"]) or "?")
            else:
                parts.append(a.get("type", "?"))
        t = " | ".join(parts) if parts else "?"
        return f"Optional[{t}]" if nullable else t
    if v.get("type") == "array":
        it = v.get("items") or {}
        if "$ref" in it:
            return f"array[{resolve_ref(it['$ref'])}]"
        return f"array[{it.get('type', '?')}]"
    if v.get("type") == "object" and "additionalProperties" in v:
        return "object"
    return str(v.get("type") or "?")


def schema_fields(schemas: dict, name: str | None, depth: int = 0) -> list[tuple[str, str, str, str]]:
    if not name or name not in schemas or depth > 1:
        return []
    s = schemas[name]
    props = s.get("properties") or {}
    required = set(s.get("required") or [])
    rows = []
    for k, v in props.items():
        desc = (v.get("description") or "").replace("\n", " ").strip()
        if len(desc) > 140:
            desc = desc[:137] + "..."
        rows.append((k, type_of(v), "sí" if k in required else "no", desc))
    return rows


def body_schema_name(op: dict) -> str | None:
    rb = op.get("requestBody") or {}
    content = rb.get("content") or {}
    js = content.get("application/json") or {}
    sch = js.get("schema") or {}
    return resolve_ref(sch.get("$ref"))


def response_schema_name(op: dict) -> str | None:
    for code in ("200", "201", "202"):
        resp = (op.get("responses") or {}).get(code) or {}
        content = resp.get("content") or {}
        js = content.get("application/json") or {}
        sch = js.get("schema") or {}
        if "$ref" in sch:
            return resolve_ref(sch["$ref"])
        if sch.get("type") == "array" and "$ref" in (sch.get("items") or {}):
            return f"array[{resolve_ref(sch['items']['$ref'])}]"
        if sch.get("type"):
            return sch.get("type")
    return None


def is_public(method: str, path: str) -> bool:
    if (method, path) in PUBLIC_PATHS:
        return True
    # list paths without trailing slash variants
    alt = path.rstrip("/") or "/"
    return (method, alt) in PUBLIC_PATHS or (method, alt + "/") in PUBLIC_PATHS


def md_table_fields(rows: list[tuple[str, str, str, str]]) -> str:
    if not rows:
        return "_Sin campos detallados en OpenAPI._\n"
    lines = [
        "| Campo | Tipo | Req | Descripción |",
        "|-------|------|-----|-------------|",
    ]
    for name, typ, req, desc in rows:
        desc = desc.replace("|", "\\|")
        lines.append(f"| `{name}` | `{typ}` | {req} | {desc} |")
    return "\n".join(lines) + "\n"


def example_json_from_schema(schemas: dict, name: str | None) -> str | None:
    """Ejemplos manuales de alta utilidad para el frontend."""
    examples = {
        "RegistroRequest": {
            "email": "cliente@ejemplo.com",
            "password": "ClaveSegura1",
            "rol": "solicitante",
            "tipo_persona": "natural",
            "tipo_documento": "cedula",
            "numero_documento": "1234567890",
            "nombre": "Ana",
            "apellido": "Pérez",
            "indicativo_pais_telefono": "+57",
            "telefono": "3001234567",
            "acepto_politica_datos": True,
            "codigo_referido": None,
        },
        "LoginRequest": {"email": "cliente@ejemplo.com", "password": "ClaveSegura1"},
        "VerificarEmailRequest": {"email": "cliente@ejemplo.com", "otp": "123456"},
        "ReenviarOtpRequest": {"email": "cliente@ejemplo.com", "proposito": "verificacion_email"},
        "LoginOtpRequest": {"challenge_token": "<challenge del login tardío>", "otp": "123456"},
        "ForgotPasswordRequest": {"email": "cliente@ejemplo.com"},
        "ResetPasswordRequest": {
            "token": "<token del correo>",
            "otp": "123456",
            "nueva_password": "NuevaClave9",
        },
        "CotizacionCreate": {
            "modalidad": "abierta",
            "pais_importacion": "China",
            "nombre_producto": "Botellas PET 500ml",
            "descripcion_cliente": "Botellas transparentes con tapa rosca, uso alimentario.",
            "linea_producto": "Empaques",
            "tipo_calidad": "estandar",
            "cantidad_minima": 5000,
            "precio_objetivo_usd": 0.12,
            "incoterm": "FOB",
            "notas_adicionales": "Preferencia de puerto Shanghai",
        },
        "PropuestaCreate": {
            "cotizacion_id": "<uuid-cotizacion>",
            "precio_ofrecido_usd": 0.11,
            "tiempo_estimado_entrega": "35-45 días",
            "incoterm": "FOB",
            "condiciones_adicionales": "Incluye inspección pre-embarque",
        },
        "CompraCreditosRequest": {"paquete_creditos": 100},
    }
    if name in examples:
        return json.dumps(examples[name], ensure_ascii=False, indent=2)
    if not name or name not in schemas:
        return None
    # minimal skeleton from required fields
    s = schemas[name]
    props = s.get("properties") or {}
    req = s.get("required") or list(props.keys())[:6]
    obj = {}
    for k in req:
        v = props.get(k) or {}
        t = type_of(v)
        if "email" in k:
            obj[k] = "user@ejemplo.com"
        elif t in ("string", "Optional[string]"):
            obj[k] = f"<{k}>"
        elif t in ("integer", "number") or t.startswith("Optional[integer]") or t.startswith("Optional[number]"):
            obj[k] = 0
        elif t in ("boolean", "Optional[boolean]"):
            obj[k] = True
        else:
            obj[k] = None
    return json.dumps(obj, ensure_ascii=False, indent=2) if obj else None


def render_endpoint(method: str, path: str, op: dict, schemas: dict) -> str:
    summary = op.get("summary") or op.get("description") or ""
    summary = summary.strip().split("\n")[0]
    auth = "Público" if is_public(method, path) else "Bearer JWT"
    params = op.get("parameters") or []
    path_params = [p for p in params if p.get("in") == "path"]
    query_params = [p for p in params if p.get("in") == "query"]
    body_name = body_schema_name(op)
    resp_name = response_schema_name(op)
    codes = ", ".join(sorted((op.get("responses") or {}).keys()))

    lines = [
        f"### `{method} {path}`",
        "",
        f"- **Resumen:** {summary or '—'}",
        f"- **Auth:** {auth}",
        f"- **Códigos:** {codes or '—'}",
    ]
    if path_params:
        lines.append(
            "- **Path params:** "
            + ", ".join(f"`{p['name']}`" for p in path_params)
        )
    if query_params:
        qp = []
        for p in query_params:
            req = "*" if p.get("required") else ""
            qp.append(f"`{p['name']}`{req}")
        lines.append("- **Query:** " + ", ".join(qp))
    lines.append("")

    if body_name:
        lines.append(f"**Body (`{body_name}`)**")
        lines.append("")
        lines.append(md_table_fields(schema_fields(schemas, body_name)))
        ex = example_json_from_schema(schemas, body_name)
        if ex:
            lines.append("```json")
            lines.append(ex)
            lines.append("```")
            lines.append("")

    if resp_name:
        lines.append(f"**Respuesta (`{resp_name}`)**")
        lines.append("")
        if resp_name.startswith("array["):
            inner = resp_name[6:-1]
            lines.append(f"Array de `{inner}`:")
            lines.append("")
            lines.append(md_table_fields(schema_fields(schemas, inner)))
        else:
            lines.append(md_table_fields(schema_fields(schemas, resp_name)))

    lines.append("---")
    lines.append("")
    return "\n".join(lines)


def write_tag_file(path: Path, title: str, body: str) -> None:
    path.write_text(
        f"# {title}\n\n"
        f"> Generado desde OpenAPI en vivo (`/openapi.json`). Base URL local: `http://localhost:8000`.\n\n"
        f"{body}",
        encoding="utf-8",
    )


def main() -> None:
    d = json.loads(OPENAPI.read_text(encoding="utf-8"))
    schemas = d.get("components", {}).get("schemas", {})
    by_file: dict[str, list[tuple[str, str, dict]]] = defaultdict(list)
    catalog_rows = []

    for path, methods in sorted(d["paths"].items()):
        for method, op in sorted(methods.items()):
            if method not in ("get", "post", "put", "patch", "delete"):
                continue
            m = method.upper()
            tags = op.get("tags") or ["Otros"]
            tag = tags[0]
            fname = TAG_FILES.get(tag, "99-Otros.md")
            by_file[fname].append((m, path, op))
            auth = "Público" if is_public(m, path) else "JWT"
            summary = (op.get("summary") or "").replace("|", "\\|").replace("\n", " ")[:100]
            catalog_rows.append((m, path, tag, auth, summary))

    OUT.mkdir(parents=True, exist_ok=True)

    # Per-file docs
    file_titles = {
        "02-Auth.md": "APIs — Autenticación",
        "03-Usuarios-Asesores-y-Perfil.md": "APIs — Usuarios, asesores y perfil",
        "04-Importadores.md": "APIs — Importadores",
        "05-Cotizaciones-y-Propuestas.md": "APIs — Cotizaciones y propuestas",
        "06-Ordenes.md": "APIs — Órdenes",
        "07-Creditos-y-Pagos.md": "APIs — Créditos y pagos",
        "08-Chat-y-WebSocket.md": "APIs — Chat y WebSocket",
        "09-Organizaciones.md": "APIs — Organizaciones solicitantes",
        "10-Disputas.md": "APIs — Disputas",
        "11-Referidos.md": "APIs — Referidos",
        "12-Admin.md": "APIs — Administración",
        "13-Legal-y-Salud.md": "APIs — Legal y salud",
        "99-Otros.md": "APIs — Otros",
    }

    for fname, ops in sorted(by_file.items()):
        chunks = []
        for m, path, op in ops:
            chunks.append(render_endpoint(m, path, op, schemas))
        write_tag_file(OUT / fname, file_titles.get(fname, fname), "\n".join(chunks))

    # Catalogo completo
    cat = [
        "# Catálogo completo de endpoints",
        "",
        f"Total: **{len(catalog_rows)}** operaciones REST exportadas desde OpenAPI.",
        "",
        "| Método | Ruta | Tag | Auth | Resumen |",
        "|--------|------|-----|------|---------|",
    ]
    for m, path, tag, auth, summary in catalog_rows:
        cat.append(f"| `{m}` | `{path}` | {tag} | {auth} | {summary} |")
    cat.append("")
    cat.append("## Índice por módulo")
    cat.append("")
    for fname, title in file_titles.items():
        if (OUT / fname).exists():
            note = fname.replace(".md", "")
            cat.append(f"- [[{note}|{title}]]")
    (OUT / "Catalogo-Completo.md").write_text("\n".join(cat) + "\n", encoding="utf-8")

    print(f"Wrote docs to {OUT}")
    print(f"Files: {sorted(p.name for p in OUT.glob('*.md'))}")
    print(f"Endpoints: {len(catalog_rows)}")


if __name__ == "__main__":
    main()
