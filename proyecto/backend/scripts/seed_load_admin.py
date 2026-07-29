#!/usr/bin/env python3
"""Seed de admin para pruebas de carga (ejecutar dentro del contenedor backend)."""
from uuid import uuid4
from datetime import datetime

from database import SessionLocal
from models.usuario import Usuario
from utils.security import hash_password

ADMIN_EMAIL = "admin_load@example.com"
ADMIN_PASSWORD = "LoadTest123!"


def main() -> None:
    db = SessionLocal()
    try:
        existing = db.query(Usuario).filter(Usuario.email == ADMIN_EMAIL).first()
        if existing:
            print(f"Admin ya existe: {ADMIN_EMAIL} id={existing.id}")
            return

        admin = Usuario(
            id=str(uuid4()),
            email=ADMIN_EMAIL,
            password_hash=hash_password(ADMIN_PASSWORD),
            rol="admin",
            nombre="Admin Load",
            activo=True,
            email_verificado=True,  # requerido para login sin OTP
            perfil_completo=True,
            acepto_politica_datos=True,
            fecha_aceptacion_politica=datetime.utcnow(),
            creditos_balance=0,
            fecha_creacion=datetime.utcnow(),
        )
        db.add(admin)
        db.commit()
        print(f"Admin creado: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
