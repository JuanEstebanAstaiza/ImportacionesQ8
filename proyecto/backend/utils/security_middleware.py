"""Middleware de blindaje HTTP: headers de seguridad y tope de body."""
from __future__ import annotations

import logging

from starlette.responses import JSONResponse, Response
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger("importacionesq8")

# 2 MiB: suficiente para JSON de negocio; evita body bombs DoS
MAX_BODY_BYTES = 2 * 1024 * 1024


class SecurityHeadersMiddleware:
    """Añade headers defensivos (OWASP A05)."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers.setdefault("X-Content-Type-Options", "nosniff")
                headers.setdefault("X-Frame-Options", "DENY")
                headers.setdefault("Referrer-Policy", "no-referrer")
                headers.setdefault(
                    "Permissions-Policy",
                    "geolocation=(), microphone=(), camera=()",
                )
                headers.setdefault("X-XSS-Protection", "0")  # desactivado a favor de CSP
                headers.setdefault("Cache-Control", "no-store")

                path = scope.get("path", "")
                if not path.startswith(("/docs", "/redoc", "/openapi")):
                    headers.setdefault(
                        "Content-Security-Policy",
                        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
                    )

                try:
                    from config import APP_ENV
                    if APP_ENV == "production":
                        headers.setdefault(
                            "Strict-Transport-Security",
                            "max-age=31536000; includeSubDomains",
                        )
                except Exception:
                    pass

            await send(message)

        await self.app(scope, receive, send_wrapper)


class TrailingSlashNormalizationMiddleware:
    """Colapsa el slash final para que `/importadores/` y `/importadores` sean la misma ruta.

    La app corre con `redirect_slashes=False` (sin 307 automáticos), así que sin
    esto cada ruta solo respondería en la forma exacta con que fue registrada.
    Todas se registran sin slash final; aquí se normaliza lo que llegue con él,
    de modo que clientes viejos siguen funcionando sin un redirect de por medio.
    """

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        if len(path) > 1 and path.endswith("/"):
            normalized = path.rstrip("/") or "/"
            scope = dict(scope)
            scope["path"] = normalized
            # `raw_path` lo consultan algunos componentes ASGI: se mantiene coherente.
            raw_path = scope.get("raw_path")
            if isinstance(raw_path, bytes):
                scope["raw_path"] = normalized.encode("latin1")

        await self.app(scope, receive, send)


class RequestSizeLimitMiddleware:
    """Rechaza bodies > MAX_BODY_BYTES (anti DoS)."""

    def __init__(self, app: ASGIApp, max_bytes: int = MAX_BODY_BYTES):
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = {
            key.decode("latin1").lower(): value.decode("latin1")
            for key, value in scope.get("headers", [])
        }
        cl = headers.get("content-length")
        if cl:
            try:
                if int(cl) > self.max_bytes:
                    response = JSONResponse(
                        status_code=413,
                        content={
                            "success": False,
                            "error": "Payload demasiado grande",
                        },
                    )
                    await response(scope, receive, send)
                    return
            except ValueError:
                pass

        await self.app(scope, receive, send)
