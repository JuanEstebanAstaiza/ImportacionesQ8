import logging

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from slowapi.errors import RateLimitExceeded

from config import CORS_ORIGINS, APP_ENV
from routers.auth import router as auth_router
from routers.importadores import router as importadores_router
from routers.cotizaciones import router as cotizaciones_router, propuestas_router
from routers.ordenes import router as ordenes_router
from routers.pagos import router as pagos_router, creditos_router
from routers.usuarios import router as usuarios_router, asesores_router
from routers.chat import router as chat_router, ws_router as chat_ws_router
from routers.admin import router as admin_router
from routers.legal import router as legal_router
from routers.organizaciones import router as organizaciones_router
from routers.disputas import router as disputas_router
from routers.referidos import router as referidos_router
from routers.cursos import router as cursos_router
from routers.notificaciones import router as notificaciones_router
from utils.limiter import limiter
from utils.security_middleware import SecurityHeadersMiddleware, RequestSizeLimitMiddleware

logger = logging.getLogger("importacionesq8")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestiona el inicio y parada de la aplicación"""
    print("Iniciando servidor ImportacionesQ8...")
    try:
        from database import init_db
        init_db()
    except Exception as e:
        logger.exception("No se pudo inicializar la base de datos: %s", e)
    
    yield
    
    print("Apagando servidor ImportacionesQ8...")

# Crear la aplicación FastAPI
_docs = None if APP_ENV == "production" else "/docs"
_redoc = None if APP_ENV == "production" else "/redoc"
_openapi = None if APP_ENV == "production" else "/openapi.json"
app = FastAPI(
    title="ImportacionesQ8 API",
    description="API REST para la plataforma de importaciones Q8",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=_docs,
    redoc_url=_redoc,
    openapi_url=_openapi,
)

# Configurar CORS (métodos/headers acotados — no wildcard)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in CORS_ORIGINS if o.strip() and o.strip() != "*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)

# Comprime respuestas JSON grandes (catálogos, temarios, listas) → menos ancho de banda
# bajo 100–1000 clientes concurrentes. Umbral 500 bytes.
app.add_middleware(GZipMiddleware, minimum_size=500)

# Blindaje HTTP (orden: size limit antes de handlers pesados; headers al final de la cadena de salida)
app.add_middleware(RequestSizeLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

# Configurar rate limiting (fuerza bruta en /auth/login, abuso en /auth/register)
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        content={"success": False, "error": "Demasiados intentos. Intenta de nuevo más tarde."}
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Los errores de validación de Pydantic son seguros de exponer (no filtran internals).
    # Pydantic v2 incluye en `ctx` la excepción original (ej. ValueError de un
    # `model_validator`), que no es serializable a JSON directamente: se sanea con
    # `jsonable_encoder(..., exclude={"ctx"})` para quedarnos solo con el mensaje.
    errores_serializables = [
        {k: v for k, v in error.items() if k != "ctx"}
        for error in exc.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=jsonable_encoder({"success": False, "error": "Datos de solicitud inválidos", "detail": errores_serializables})
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Handler global: cualquier excepción no controlada se registra en logs con el
    detalle completo, pero al cliente solo se le informa un mensaje genérico para
    no filtrar stack traces, rutas de archivos, queries SQL ni otros detalles internos.
    """
    logger.exception("Error no controlado procesando %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"success": False, "error": "Error interno del servidor"}
    )

# Incluir routers
app.include_router(auth_router)
app.include_router(importadores_router)
app.include_router(cotizaciones_router)
app.include_router(propuestas_router)
app.include_router(ordenes_router)
app.include_router(pagos_router)
app.include_router(creditos_router)
app.include_router(usuarios_router)
app.include_router(asesores_router)
app.include_router(chat_router)
app.include_router(chat_ws_router)
app.include_router(admin_router)
app.include_router(legal_router)
app.include_router(organizaciones_router)
app.include_router(disputas_router)
app.include_router(referidos_router)
app.include_router(cursos_router)
app.include_router(notificaciones_router)

@app.get("/", tags=["Salud"])
async def root():
    """Endpoint de salud - verifica que el servidor está funcionando"""
    return {
        "success": True,
        "message": "API ImportacionesQ8 funcionando correctamente",
        "version": "1.0.0"
    }

@app.get("/health", tags=["Salud"])
async def health_check():
    """Liveness: el proceso responde (no valida dependencias)."""
    return {"status": "healthy"}

@app.get("/health/ready", tags=["Salud"])
async def readiness_check():
    """
    Readiness: MySQL y Redis deben responder.
    Útil para orquestadores (K8s / load balancers) antes de enviar tráfico.
    """
    from database import check_database
    from config import redis_client

    checks = {"database": False, "redis": False}

    checks["database"] = check_database()

    try:
        checks["redis"] = bool(redis_client and redis_client.ping())
    except Exception:
        checks["redis"] = False

    if checks["database"] and checks["redis"]:
        return {"status": "ready", "checks": checks}

    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"status": "not_ready", "checks": checks},
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )