"""Utilidades compartidas por los servicios del módulo."""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException


def ahora() -> datetime:
    return datetime.utcnow()


def iso(fecha: Optional[datetime]) -> Optional[str]:
    return fecha.isoformat() + "Z" if fecha else None


def error(codigo: int, detalle: str) -> HTTPException:
    return HTTPException(status_code=codigo, detail=detalle)


def nuevo_id() -> str:
    return str(uuid4())


def codigo(prefijo: str, ident: str) -> str:
    """Código corto y legible para mostrar (p. ej. `MQ-3F9A2C`)."""
    return f"{prefijo}-{ident.replace('-', '')[:6].upper()}"
