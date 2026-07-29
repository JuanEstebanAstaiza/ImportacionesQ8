from dotenv import load_dotenv
import os
import warnings
import redis
from datetime import timedelta

load_dotenv()

APP_ENV = os.getenv("APP_ENV", "development").lower()

# Solo development/test: auto-verificar email en registro (campañas de carga).
# En production se ignora siempre aunque la env esté en true.
LOAD_TEST_AUTO_VERIFY = (
    APP_ENV != "production"
    and os.getenv("LOAD_TEST_AUTO_VERIFY", "false").lower() == "true"
)

DATABASE_URL = os.getenv("DATABASE_URL")

SECRET_KEY = os.getenv("SECRET_KEY")
_INSECURE_SECRET_MARKERS = (
    None,
    "",
    "cambiar-por-un-secreto-aleatorio-de-al-menos-32-caracteres",
    "clave-secreta-para-desarrollo-cambiar-en-produccion-2024",
)
if SECRET_KEY in _INSECURE_SECRET_MARKERS or (SECRET_KEY and len(SECRET_KEY) < 32):
    if APP_ENV == "production":
        raise RuntimeError(
            "SECRET_KEY insegura o ausente. En producción debe ser un valor aleatorio "
            "de al menos 32 caracteres (ej. `python -c \"import secrets; print(secrets.token_hex(32))\"`)."
        )
    if APP_ENV not in ("test",):
        warnings.warn(
            "SECRET_KEY insegura o corta: válido solo en development/test. "
            "Genera una nueva antes de desplegar.",
            UserWarning,
            stacklevel=1,
        )
    if not SECRET_KEY:
        SECRET_KEY = "dev-insecure-secret-key-do-not-use-in-production!!"

ALGORITHM = os.getenv("ALGORITHM", "HS256")
# TTL corto por defecto (OWASP): renovar vía /auth/refresh
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
ACCESS_TOKEN_EXPIRE = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

WOMPI_PUBLIC_KEY = os.getenv("WOMPI_PUBLIC_KEY")
WOMPI_SECRET_KEY = os.getenv("WOMPI_SECRET_KEY")
WOMPI_EVENTS_SECRET = os.getenv("WOMPI_EVENTS_SECRET")
# En production debe ser false y usarse la API real de Wompi
WOMPI_SIMULATE = os.getenv("WOMPI_SIMULATE", "true" if APP_ENV != "production" else "false").lower() == "true"

RATE_LIMIT_LOGIN = os.getenv("RATE_LIMIT_LOGIN", "5/minute")
RATE_LIMIT_REGISTER = os.getenv("RATE_LIMIT_REGISTER", "10/minute")
RATE_LIMIT_FORGOT_PASSWORD = os.getenv("RATE_LIMIT_FORGOT_PASSWORD", "5/minute")
# Catálogo / escritura general (anti-DDoS de lectura y spam de writes)
RATE_LIMIT_PUBLIC_READ = os.getenv("RATE_LIMIT_PUBLIC_READ", "120/minute")
RATE_LIMIT_PUBLIC_WRITE = os.getenv("RATE_LIMIT_PUBLIC_WRITE", "30/minute")
RATE_LIMIT_CHAT_MESSAGE = os.getenv("RATE_LIMIT_CHAT_MESSAGE", "60/minute")
RATE_LIMIT_NOTIFICACIONES = os.getenv("RATE_LIMIT_NOTIFICACIONES", "90/minute")

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_FROM", "no-reply@importacionesq8.com")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
PASSWORD_RESET_EXPIRE_MINUTES = int(os.getenv("PASSWORD_RESET_EXPIRE_MINUTES", "15"))
OTP_EXPIRE_MINUTES = int(os.getenv("OTP_EXPIRE_MINUTES", "15"))
LOGIN_TARDIO_HORAS = int(os.getenv("LOGIN_TARDIO_HORAS", "72"))
RATE_LIMIT_OTP = os.getenv("RATE_LIMIT_OTP", "10/minute")

# Cobro a quien cotiza (solicitante natural/jurídica). Por defecto OFF:
# el modelo actual cobra solo a empresas importadoras (contrato/suscripción),
# no al usuario que crea cotizaciones. Poner true solo si se reactiva el wallet.
COBRO_A_SOLICITANTES = os.getenv("COBRO_A_SOLICITANTES", "false").lower() == "true"

CREDITO_COSTO_COTIZACION_ABIERTA = float(os.getenv("CREDITO_COSTO_COTIZACION_ABIERTA", "10"))
CREDITO_COSTO_COTIZACION_DIRIGIDA = float(os.getenv("CREDITO_COSTO_COTIZACION_DIRIGIDA", "5"))
CREDITO_USD_POR_UNIDAD = float(os.getenv("CREDITO_USD_POR_UNIDAD", "0.1"))
CREDITO_BONO_REGISTRO = float(os.getenv("CREDITO_BONO_REGISTRO", "20"))
CREDITO_BONO_REFERIDO = float(os.getenv("CREDITO_BONO_REFERIDO", "10"))
CREDITO_BONO_REFERIDOR = float(os.getenv("CREDITO_BONO_REFERIDOR", "10"))

TRANSLATION_ENABLED = os.getenv("TRANSLATION_ENABLED", "false").lower() == "true"
GOOGLE_TRANSLATE_API_KEY = os.getenv("GOOGLE_TRANSLATE_API_KEY")
GOOGLE_TRANSLATE_PROJECT = os.getenv("GOOGLE_TRANSLATE_PROJECT")
TRANSLATION_IDIOMAS = ("es", "en", "zh-CN")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

try:
    redis_client = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=2)
except Exception:
    redis_client = None

COTIZACION_ABIERTA_TTL = 259200  # 72h
# Índice Redis (SET) de cotizaciones abiertas por importador — evita KEYS O(N)
INDICE_COTIZACIONES_ABIERTAS = "indice:cotizaciones_abiertas"

def indice_importador_abiertas(importador_id: str) -> str:
    return f"indice:importador:{importador_id}:abiertas"
