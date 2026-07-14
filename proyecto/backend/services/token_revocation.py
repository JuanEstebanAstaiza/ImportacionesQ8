"""Revocación de JWT (logout) y tickets de corto plazo para WebSocket."""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy.orm import Session

import config
from models.jwt_blacklist import JwtBlacklist


def revocar_jti(db: Session, jti: str, usuario_id: str, expira_en: datetime) -> None:
    if not jti:
        return
    existente = db.query(JwtBlacklist).filter(JwtBlacklist.jti == jti).first()
    if existente:
        return
    db.add(JwtBlacklist(
        jti=jti,
        usuario_id=str(usuario_id),
        expira_en=expira_en,
    ))
    db.commit()
    if config.redis_client:
        try:
            ttl = max(1, int((expira_en - datetime.utcnow()).total_seconds()))
            config.redis_client.setex(f"jwt:revoked:{jti}", ttl, "1")
        except Exception:
            pass


def jti_revocado(db: Session, jti: Optional[str]) -> bool:
    if not jti:
        return False
    if config.redis_client:
        try:
            # Solo valores explícitos de revocación (evita MagicMock truthy en tests)
            val = config.redis_client.get(f"jwt:revoked:{jti}")
            if val in ("1", b"1"):
                return True
        except Exception:
            pass
    row = db.query(JwtBlacklist).filter(JwtBlacklist.jti == jti).first()
    if not row:
        return False
    if row.expira_en < datetime.utcnow():
        return False
    return True


def crear_ticket_ws(usuario_id: str, conversacion_id: str, ttl_seconds: int = 60) -> str:
    """Ticket opaco de un solo uso para conectar WS sin poner el JWT en la query."""
    ticket = uuid4().hex
    payload = f"{usuario_id}:{conversacion_id}"
    if config.redis_client:
        try:
            config.redis_client.setex(f"ws:ticket:{ticket}", ttl_seconds, payload)
            return ticket
        except Exception:
            pass
    # Fallback en memoria de proceso (tests / sin Redis)
    if not hasattr(crear_ticket_ws, "_mem"):
        crear_ticket_ws._mem = {}
    crear_ticket_ws._mem[ticket] = (payload, datetime.utcnow().timestamp() + ttl_seconds)
    return ticket


def consumir_ticket_ws(ticket: str) -> Optional[tuple[str, str]]:
    """Devuelve (usuario_id, conversacion_id) o None. Un solo uso."""
    if not ticket:
        return None
    if config.redis_client:
        try:
            key = f"ws:ticket:{ticket}"
            raw = config.redis_client.get(key)
            if raw:
                config.redis_client.delete(key)
                user_id, conv_id = raw.split(":", 1)
                return user_id, conv_id
        except Exception:
            pass
    mem = getattr(crear_ticket_ws, "_mem", {})
    entry = mem.pop(ticket, None)
    if not entry:
        return None
    payload, exp = entry
    if datetime.utcnow().timestamp() > exp:
        return None
    user_id, conv_id = payload.split(":", 1)
    return user_id, conv_id
