#!/usr/bin/env python3
"""Crea (o promueve) la cuenta de administración de la plataforma.

El registro público solo admite solicitantes, así que el primer admin de un
servidor nuevo se crea aquí. Se ejecuta dentro del contenedor del backend:

    docker compose exec backend python scripts/crear_admin.py admin@tudominio.com

La contraseña se pide por teclado (no queda en el historial de la shell). Si el
correo ya existe, la cuenta pasa a rol "admin" y se le pone la contraseña nueva.
"""
import getpass
import os
import sys
from datetime import datetime
from uuid import uuid4

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal  # noqa: E402
from models.usuario import Usuario  # noqa: E402
from utils.password_policy import password_cumple_politica  # noqa: E402
from utils.security import hash_password  # noqa: E402


def _pedir_password() -> str:
    # Para automatizarlo sin teclado (CI, scripts) se acepta por variable de entorno.
    desde_entorno = os.environ.get("ADMIN_PASSWORD")
    if desde_entorno:
        return desde_entorno
    password = getpass.getpass("Contraseña del admin (mín. 9, con letras y números): ")
    if password != getpass.getpass("Repite la contraseña: "):
        sys.exit("Las contraseñas no coinciden.")
    return password


def main() -> None:
    if len(sys.argv) != 2 or "@" not in sys.argv[1]:
        sys.exit("Uso: python scripts/crear_admin.py admin@tudominio.com")
    email = sys.argv[1].strip().lower()

    password = _pedir_password()
    if not password_cumple_politica(password):
        sys.exit("La contraseña debe tener al menos 9 caracteres, con letras y números.")

    db = SessionLocal()
    try:
        ahora = datetime.utcnow()
        usuario = db.query(Usuario).filter(Usuario.email == email).first()
        if usuario:
            usuario.rol = "admin"
            usuario.importador_id = None
            usuario.password_hash = hash_password(password)
            usuario.activo = True
            usuario.email_verificado = True
            accion = "actualizada a admin"
        else:
            db.add(Usuario(
                id=str(uuid4()),
                email=email,
                password_hash=hash_password(password),
                rol="admin",
                nombre="Administración",
                activo=True,
                email_verificado=True,
                perfil_completo=True,
                acepto_politica_datos=True,
                fecha_aceptacion_politica=ahora,
                creditos_balance=0,
                fecha_creacion=ahora,
            ))
            accion = "creada"
        db.commit()
        print(f"Cuenta {email} {accion}. Ya puedes iniciar sesión en la web.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
