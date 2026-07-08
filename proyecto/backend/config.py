from dotenv import load_dotenv
import os
import redis
from datetime import timedelta

# Cargar variables de entorno desde .env
load_dotenv()

# Configuración de la base de datos
DATABASE_URL = os.getenv("DATABASE_URL")

# Configuración de JWT
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
ACCESS_TOKEN_EXPIRE = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

# Configuración de CORS
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

# Configuración de Wompi (pasarela de pagos)
WOMPI_PUBLIC_KEY = os.getenv("WOMPI_PUBLIC_KEY")
WOMPI_SECRET_KEY = os.getenv("WOMPI_SECRET_KEY")
# Secreto usado para verificar la firma HMAC de los webhooks entrantes de Wompi
WOMPI_EVENTS_SECRET = os.getenv("WOMPI_EVENTS_SECRET")

# Rate limiting de endpoints sensibles (intentos por IP)
RATE_LIMIT_LOGIN = os.getenv("RATE_LIMIT_LOGIN", "5/minute")
RATE_LIMIT_REGISTER = os.getenv("RATE_LIMIT_REGISTER", "10/minute")
RATE_LIMIT_FORGOT_PASSWORD = os.getenv("RATE_LIMIT_FORGOT_PASSWORD", "5/minute")

# --- Correo saliente (SMTP real) para recuperación de contraseña (OTP + enlace) ---
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_FROM", "no-reply@importacionesq8.com")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
# URL base del frontend para construir el enlace de restablecimiento de contraseña
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Expiración del token/OTP de recuperación de contraseña (minutos)
PASSWORD_RESET_EXPIRE_MINUTES = int(os.getenv("PASSWORD_RESET_EXPIRE_MINUTES", "15"))

# --- Créditos (Semana 4): el solicitante compra créditos y los consume al crear
# cotizaciones. Reemplaza la comisión sobre la orden. Montos configurables porque
# son una decisión de negocio pendiente de ajuste fino por el equipo comercial. ---
CREDITO_COSTO_COTIZACION_ABIERTA = float(os.getenv("CREDITO_COSTO_COTIZACION_ABIERTA", "10"))
CREDITO_COSTO_COTIZACION_DIRIGIDA = float(os.getenv("CREDITO_COSTO_COTIZACION_DIRIGIDA", "5"))
# Tasa de conversión USD -> créditos al comprar un paquete (ej. 1 USD = 10 créditos)
CREDITO_USD_POR_UNIDAD = float(os.getenv("CREDITO_USD_POR_UNIDAD", "0.1"))
# Bono de créditos gratis al registrarse, para que un solicitante nuevo pueda
# probar la plataforma sin pagar de entrada (ajustable/eliminable por negocio).
CREDITO_BONO_REGISTRO = float(os.getenv("CREDITO_BONO_REGISTRO", "20"))

# Configuración de Redis (opcional para tests con SQLite)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Redis síncrono para operaciones simples (suficiente para MVP)
try:
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
except Exception:
    # En modo test sin Redis, usar None como fallback
    redis_client = None

# TTL para cotizaciones abiertas (72 horas en segundos)
COTIZACION_ABIERTA_TTL = 259200  # 72 * 60 * 60
