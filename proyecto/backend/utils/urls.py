"""Normalización de URLs de recursos almacenados.

Los routers del backend se montan en la raíz (`/documentos`, `/cursos`, ...).
El prefijo `/api` existe solo como proxy del dev server de Vite, que lo elimina
antes de llegar a FastAPI. Guardar URLs absolutas (`http://localhost:5173/api/...`)
ata el registro al entorno donde se creó y lo rompe al servir la app desde un
Dev Tunnel u otro host.

Este módulo reduce cualquier forma recibida a la ruta canónica del backend, y
deja intactas las URLs verdaderamente externas (CDN, almacenamiento remoto).
"""

import re
from typing import Optional
from urllib.parse import urlparse, urlunparse

PROXY_PREFIXES = ("/api",)

LOOPBACK_HOSTNAMES = {"localhost", "127.0.0.1", "0.0.0.0", "::1"}

# Rutas servidas por este backend: si una URL absoluta apunta a una de ellas,
# el host guardado es ruido de entorno y se descarta.
INTERNAL_PATH_RE = re.compile(r"^/(documentos|cursos|ordenes|chat)(/|$)")


def _strip_proxy_prefixes(path: str) -> str:
    """Quita `/api` del inicio tantas veces como aparezca (`/api/api/...`)."""
    result = path or "/"
    changed = True
    while changed:
        changed = False
        for prefix in PROXY_PREFIXES:
            if result.lower() == prefix or result.lower().startswith(f"{prefix}/"):
                result = result[len(prefix):] or "/"
                changed = True
    return result if result.startswith("/") else f"/{result}"


def canonicalize_path(path: str, query: str = "", fragment: str = "") -> str:
    normalized = path if path.startswith("/") else f"/{path}"
    normalized = re.sub(r"/{2,}", "/", normalized)
    normalized = _strip_proxy_prefixes(normalized)

    if query:
        normalized = f"{normalized}?{query}"
    if fragment:
        normalized = f"{normalized}#{fragment}"
    return normalized


def is_internal_resource(parsed) -> bool:
    hostname = (parsed.hostname or "").lower()
    if hostname in LOOPBACK_HOSTNAMES:
        return True
    return bool(INTERNAL_PATH_RE.match(_strip_proxy_prefixes(parsed.path or "/")))


def canonicalize_resource_url(value: Optional[str], *, campo: str = "url") -> Optional[str]:
    """Valida y normaliza una URL de recurso.

    - Ruta relativa (`/documentos/...`, `/api/documentos/...`) → ruta canónica.
    - URL absoluta hacia este backend (o hacia loopback) → ruta canónica.
    - URL absoluta externa http(s) → se conserva tal cual.
    - Cualquier otro esquema (`javascript:`, `data:`) → error.
    """
    if value is None or value == "":
        return value

    raw = value.strip()
    if not raw:
        raise ValueError(f"{campo} no puede estar vacío")

    # Protocol-relative (`//host/...`): ambiguo y no aporta nada aquí.
    if raw.startswith("//"):
        raise ValueError(f"{campo} debe ser una ruta del backend o una URL http(s) absoluta")

    if raw.startswith("/"):
        parsed = urlparse(raw)
        return canonicalize_path(parsed.path, parsed.query, parsed.fragment)

    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError(f"{campo} debe ser una ruta del backend o una URL http(s) absoluta")

    host = parsed.netloc.lower()
    if "youtube.com" in host or "youtu.be" in host:
        raise ValueError(f"{campo} no permite enlaces de YouTube; usa recursos de gestión documental")

    if is_internal_resource(parsed):
        return canonicalize_path(parsed.path, parsed.query, parsed.fragment)

    return urlunparse(parsed)
