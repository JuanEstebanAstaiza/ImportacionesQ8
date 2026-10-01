"""Middleware de blindaje HTTP: headers de seguridad y tope de body."""
from __future__ import annotations

import logging
import os

from starlette.responses import JSONResponse, Response
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger("importacionesq8")

# 2 MiB: suficiente para JSON de negocio; evita body bombs DoS
MAX_BODY_BYTES = int(os.getenv("MAX_BODY_BYTES", str(2 * 1024 * 1024)))

# Los endpoints de subida necesitan otro orden de magnitud: la plataforma exige
# que los vídeos de los cursos se alojen aquí (no enlaces externos), y con el
# tope general de 2 MiB no entraba ninguno. El límite se comprueba por prefijo
# de ruta para no relajar el resto de la API.
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(300 * 1024 * 1024)))

PREFIJOS_DE_SUBIDA = ("/documentos/archivos/upload",)

# Restaurar una copia desde el panel sube el ZIP entero (base de datos +
# archivos), que puede superar con creces el tope de un vídeo.
MAX_BACKUP_UPLOAD_BYTES = int(os.getenv("MAX_BACKUP_UPLOAD_BYTES", str(2 * 1024 * 1024 * 1024)))
PREFIJO_RESTAURAR_BACKUP = "/admin/backup/restaurar"

# Lo único que sigue atendiendo durante una restauración: la salud (para el
# balanceador y el propio script de restauración) y la restauración misma.
RUTAS_DURANTE_MANTENIMIENTO = ("/health", "/admin/backup")


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
    """Rechaza bodies demasiado grandes (anti DoS), con un tope mayor para subidas.

    El tope general (`MAX_BODY_BYTES`) protege una API que solo intercambia JSON.
    Aplicárselo también a `POST /documentos/archivos/upload` hacía imposible subir
    un vídeo de curso, que es justo lo que la plataforma exige alojar aquí; por eso
    esas rutas usan `MAX_UPLOAD_BYTES`.

    Este middleware va **por dentro** de CORS a propósito: su 413 tiene que llevar
    los headers de CORS. Si no, el navegador no ve el 413 sino un
    "No 'Access-Control-Allow-Origin' header is present" y el motivo real
    (archivo demasiado grande) queda invisible para quien está subiendo.
    """

    def __init__(
        self,
        app: ASGIApp,
        max_bytes: int = MAX_BODY_BYTES,
        max_upload_bytes: int = MAX_UPLOAD_BYTES,
    ):
        self.app = app
        self.max_bytes = max_bytes
        self.max_upload_bytes = max_upload_bytes

    def _limite_para(self, path: str) -> int:
        if path.startswith(PREFIJO_RESTAURAR_BACKUP):
            return MAX_BACKUP_UPLOAD_BYTES
        if any(path.startswith(prefijo) for prefijo in PREFIJOS_DE_SUBIDA):
            return self.max_upload_bytes
        return self.max_bytes

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
            limite = self._limite_para(scope.get("path", ""))
            try:
                if int(cl) > limite:
                    mb = limite / (1024 * 1024)
                    response = JSONResponse(
                        status_code=413,
                        content={
                            "success": False,
                            "error": "Payload demasiado grande",
                            # El mensaje dice el tope: sin él, quien sube un vídeo
                            # solo sabe que "falló" y no cuánto tiene que recortar.
                            "detail": f"El tamaño máximo permitido para esta ruta es {mb:.0f} MB.",
                        },
                    )
                    await response(scope, receive, send)
                    return
            except ValueError:
                pass

        await self.app(scope, receive, send)


class MantenimientoMiddleware:
    """Responde 503 mientras se restaura una copia de seguridad.

    Ver `services/mantenimiento.py`. Va por dentro de CORS, como el límite de
    tamaño, para que el navegador vea el 503 con su motivo y no un error de CORS.
    """

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        if not path.startswith(RUTAS_DURANTE_MANTENIMIENTO):
            from services.mantenimiento import motivo_activo

            motivo = motivo_activo()
            if motivo:
                if scope["type"] == "websocket":
                    # 1013 = "Try Again Later": el cliente reintenta solo.
                    await send({"type": "websocket.close", "code": 1013})
                    return
                response = JSONResponse(
                    status_code=503,
                    content={
                        "success": False,
                        "error": "Mantenimiento",
                        "detail": f"La plataforma está en mantenimiento: {motivo}. Vuelve a intentarlo en unos minutos.",
                    },
                    headers={"Retry-After": "60"},
                )
                await response(scope, receive, send)
                return

        await self.app(scope, receive, send)
