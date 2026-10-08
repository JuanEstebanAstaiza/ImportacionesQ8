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
# Envío de enlaces a Tendencias y lista de espera del reto. En pruebas la suite
# entera manda muchos desde la misma IP, así que el valor por defecto se relaja.
_EN_PRUEBAS = os.getenv("APP_ENV", "").lower() == "test"
RATE_LIMIT_TENDENCIAS_ENVIO = os.getenv("RATE_LIMIT_TENDENCIAS_ENVIO", "1000/minute" if _EN_PRUEBAS else "20/minute")
RATE_LIMIT_RETO_LISTA = os.getenv("RATE_LIMIT_RETO_LISTA", "1000/minute" if _EN_PRUEBAS else "10/minute")
