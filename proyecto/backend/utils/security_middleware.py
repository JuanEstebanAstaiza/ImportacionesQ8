"""Middleware de blindaje HTTP: headers de seguridad y tope de body."""
from __future__ import annotations

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

logger = logging.getLogger("importacionesq8")

# 2 MiB: suficiente para JSON de negocio; evita body bombs DoS
MAX_BODY_BYTES = 2 * 1024 * 1024


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Añade headers defensivos (OWASP A05)."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault(
            "Permissions-Policy",
            "geolocation=(), microphone=(), camera=()",
        )
        response.headers.setdefault("X-XSS-Protection", "0")  # desactivado a favor de CSP
        response.headers.setdefault("Cache-Control", "no-store")
        # CSP estricta solo en API JSON (sin HTML servido); no rompe /docs en dev
        if not request.url.path.startswith(("/docs", "/redoc", "/openapi")):
            response.headers.setdefault(
                "Content-Security-Policy",
                "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
            )
        # HSTS solo detrás de TLS real (producción)
        try:
            from config import APP_ENV
            if APP_ENV == "production":
                response.headers.setdefault(
                    "Strict-Transport-Security",
                    "max-age=31536000; includeSubDomains",
                )
        except Exception:
            pass
        return response


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """Rechaza bodies > MAX_BODY_BYTES (anti DoS)."""

    def __init__(self, app, max_bytes: int = MAX_BODY_BYTES):
        super().__init__(app)
        self.max_bytes = max_bytes

    async def dispatch(self, request: Request, call_next) -> Response:
        cl = request.headers.get("content-length")
        if cl is not None:
            try:
                if int(cl) > self.max_bytes:
                    return JSONResponse(
                        status_code=413,
                        content={
                            "success": False,
                            "error": "Payload demasiado grande",
                        },
                    )
            except ValueError:
                pass
        return await call_next(request)
