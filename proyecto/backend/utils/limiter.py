import os

from slowapi import Limiter
from slowapi.util import get_remote_address

# Limiter compartido por toda la app, basado en la IP del cliente.
# Auth (login/register) y endpoints de escritura/listados públicos caros (anti-DDoS).
limiter = Limiter(key_func=get_remote_address)

# Límites configurables por env (valores por defecto pensados para producción
# multi-tenant; en load tests elevarlos vía variables de entorno).
RATE_LIMIT_PUBLIC_READ = os.getenv("RATE_LIMIT_PUBLIC_READ", "120/minute")
RATE_LIMIT_PUBLIC_WRITE = os.getenv("RATE_LIMIT_PUBLIC_WRITE", "30/minute")
RATE_LIMIT_CHAT_MESSAGE = os.getenv("RATE_LIMIT_CHAT_MESSAGE", "60/minute")
RATE_LIMIT_NOTIFICACIONES = os.getenv("RATE_LIMIT_NOTIFICACIONES", "90/minute")
