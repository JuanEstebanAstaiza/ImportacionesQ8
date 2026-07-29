"""Utilidades anti-abuso en consultas y payloads (LIKE injection, longitudes)."""
from __future__ import annotations

import re
from typing import Optional


# Caracteres LIKE de SQL: % y _ actúan como wildcards si no se escapan.
_LIKE_SPECIAL = re.compile(r"([%_\\])")


def escape_like(value: str) -> str:
    """Escapa % _ \\ para usar en ILIKE/LIKE con escape='\\\\'."""
    if not value:
        return value
    return _LIKE_SPECIAL.sub(r"\\\1", value)


def clamp_str(value: Optional[str], max_len: int = 120) -> Optional[str]:
    if value is None:
        return None
    v = value.strip()
    if not v:
        return None
    return v[:max_len]


def like_contains_pattern(value: str, max_len: int = 120) -> str:
    """Patrón seguro para 'contiene' sin wildcards del usuario."""
    safe = escape_like(clamp_str(value, max_len) or "")
    return f"%{safe}%"
