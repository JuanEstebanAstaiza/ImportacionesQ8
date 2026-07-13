from slowapi import Limiter
from slowapi.util import get_remote_address

# Limiter compartido por toda la app, basado en la IP del cliente.
# Se usa para frenar fuerza bruta en /auth/login y abuso en /auth/register.
limiter = Limiter(key_func=get_remote_address)
