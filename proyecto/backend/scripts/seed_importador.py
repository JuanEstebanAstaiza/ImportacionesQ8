#!/usr/bin/env python3
"""Script para crear directamente una empresa importadora y su dueño."""
from uuid import uuid4
from datetime import datetime

from database import SessionLocal
from models.usuario import Usuario
from models.empresa import Empresa  # Asegúrate de ajustar la importación si tu modelo se llama distinto
from utils.security import hash_password

IMPORTADOR_EMAIL = "importador.test@ejemplo.com"
IMPORTADOR_PASSWORD = "TestPassword123!"

def main() -> None:
    db = SessionLocal()
    try:
        # 1. Verificar si el usuario ya existe
        existing_user = db.query(Usuario).filter(Usuario.email == IMPORTADOR_EMAIL).first()
        if existing_user:
            print(f"El importador ya existe: {IMPORTADOR_EMAIL}")
            return

        # 2. Crear la empresa
        empresa_id = str(uuid4())
        empresa = Empresa(
            id=empresa_id,
            nombre_empresa="Importaciones Test S.A.S",
            especialidad_producto=["Electrónica"],
            paises_origen=["China"],
            calificacion_promedio=5.0,
            tiempo_respuesta_promedio="12h",
            estado="activo",
            fecha_creacion=datetime.utcnow()
        )
        db.add(empresa)

        # 3. Crear el usuario dueño (con email_verificado=True)
        usuario = Usuario(
            id=str(uuid4()),
            email=IMPORTADOR_EMAIL,
            password_hash=hash_password(IMPORTADOR_PASSWORD),
            rol="importador",
            nombre="Importador Prueba",
            empresa_id=empresa_id,
            activo=True,
            email_verificado=True,  # <--- EVITA LA RESTRICCIÓN DE OTP
            perfil_completo=True,
            acepto_politica_datos=True,
            fecha_aceptacion_politica=datetime.utcnow(),
            creditos_balance=0,
            fecha_creacion=datetime.utcnow()
        )
        db.add(usuario)

        db.commit()
        print(f"✅ Importador creado con éxito:")
        print(f"   Email: {IMPORTADOR_EMAIL}")
        print(f"   Password: {IMPORTADOR_PASSWORD}")
    finally:
        db.close()

if __name__ == "__main__":
    main()