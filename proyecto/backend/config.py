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
