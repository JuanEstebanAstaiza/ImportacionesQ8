#!/usr/bin/env python3
"""Cuentas de prueba para recorrer la plataforma a mano.

Crea (o reajusta, si ya existen) una cuenta por cada rol del sistema y dos
empresas importadoras de categorías distintas, para poder probar los cuatro
puntos de vista sin registrarse a mano ni pasar por la verificación por OTP.

    docker compose exec backend sh -c 'cd /app && PYTHONPATH=/app python scripts/seed_usuarios_prueba.py'

El dominio es `q8demo.com` y no `q8.test` porque el validador de correo
rechaza los dominios de uso especial de la RFC 2606 (.test, .invalid,
.localhost), y la cuenta no podría ni iniciar sesión.

Es idempotente: al reejecutarlo solo reajusta contraseña, rol, vínculo con la
empresa y banderas de acceso. No borra cotizaciones, órdenes ni chats, así que
se puede lanzar sobre una base con datos.

Las dos empresas tienen especialidades distintas a propósito: sirve para
comprobar que una empresa solo ve y responde cotizaciones de su categoría, y
que cada una rotula la carga con su propio prefijo de shipping mark.
"""
from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path
from uuid import uuid4

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from database import SessionLocal  # noqa: E402
from models.importador import Importador  # noqa: E402
from models.usuario import Usuario  # noqa: E402
from utils.security import hash_password  # noqa: E402

PASSWORD = "Prueba2026!"

EMPRESAS = [
    {
        "nombre_empresa": "Control Textil S.A.S.",
        "shipping_mark_prefijo": "ctl",
        "especialidad_producto": ["Textil", "Confección"],
        "paises_origen": ["China", "India"],
        "tiempo_respuesta_promedio": "~24h",
        "capacidad_volumen": 20000,
        "calificacion_promedio": 4.6,
        "verificado": True,
        "dueño": {"email": "empresa@q8demo.com", "nombre": "Marcela Ríos"},
        "asesores": [{"email": "asesor@q8demo.com", "nombre": "Julián Vega"}],
    },
    {
        "nombre_empresa": "Andes Química Ltda.",
        "shipping_mark_prefijo": "aq",
        "especialidad_producto": ["Química"],
        "paises_origen": ["China", "Alemania"],
        "tiempo_respuesta_promedio": "~48h",
        "capacidad_volumen": 8000,
        "calificacion_promedio": 4.1,
        "verificado": False,
        "dueño": {"email": "empresa2@q8demo.com", "nombre": "Hernán Cuéllar"},
        "asesores": [],
    },
]

SOLICITANTES = [
    {"email": "cliente@q8demo.com", "nombre": "Paula", "apellido": "Restrepo"},
]

ADMINS = [
    {"email": "admin@q8demo.com", "nombre": "Admin Q8"},
]

# Equipo de diseño: portadas e imágenes de Tendencias.
DESIGNERS = [
    {"email": "designer@q8demo.com", "nombre": "Dani Diseño"},
]


def _upsert_usuario(db, *, email, rol, nombre=None, apellido=None, importador_id=None):
    """Deja la cuenta en un estado utilizable sin tocar su historial."""
    usuario = db.query(Usuario).filter(Usuario.email == email).first()
    creado = usuario is None

    if creado:
        usuario = Usuario(id=str(uuid4()), email=email, fecha_creacion=datetime.utcnow())
        db.add(usuario)

    usuario.password_hash = hash_password(PASSWORD)
    usuario.rol = rol
    usuario.nombre = nombre
    usuario.apellido = apellido
    usuario.importador_id = importador_id
    usuario.activo = True
    # Sin esto el login responde "verifica tu correo con el código OTP" y no hay
    # SMTP configurado en local para recibirlo.
    usuario.email_verificado = True
    usuario.perfil_completo = True
    usuario.acepto_politica_datos = True
    usuario.fecha_aceptacion_politica = usuario.fecha_aceptacion_politica or datetime.utcnow()
    # Un `ultimo_login_at` reciente evita el OTP por "login tardío" (72 h).
    usuario.ultimo_login_at = datetime.utcnow()

    if rol == "solicitante":
        usuario.tipo_persona = usuario.tipo_persona or "natural"
        usuario.tipo_documento = usuario.tipo_documento or "cedula"
        usuario.numero_documento = usuario.numero_documento or "1020304050"

    db.commit()
    db.refresh(usuario)
    return usuario, creado


def _upsert_empresa(db, datos):
    empresa = db.query(Importador).filter(Importador.nombre_empresa == datos["nombre_empresa"]).first()
    creada = empresa is None

    if creada:
        empresa = Importador(id=str(uuid4()), fecha_registro=datetime.utcnow())
        db.add(empresa)

    empresa.nombre_empresa = datos["nombre_empresa"]
    empresa.shipping_mark_prefijo = datos["shipping_mark_prefijo"]
    empresa.especialidad_producto = datos["especialidad_producto"]
    empresa.paises_origen = datos["paises_origen"]
    empresa.tiempo_respuesta_promedio = datos["tiempo_respuesta_promedio"]
    empresa.capacidad_volumen = datos["capacidad_volumen"]
    empresa.calificacion_promedio = datos["calificacion_promedio"]
    empresa.verificado = datos["verificado"]
    empresa.solo_cotizaciones_directas = False
    empresa.estado = "activo"

    db.commit()
    db.refresh(empresa)
    return empresa, creada


def main() -> None:
    db = SessionLocal()
    filas = []
    try:
        for datos in ADMINS:
            usuario, creado = _upsert_usuario(db, email=datos["email"], rol="admin", nombre=datos["nombre"])
            filas.append(("admin", datos["email"], "—", creado))

        for datos in DESIGNERS:
            usuario, creado = _upsert_usuario(db, email=datos["email"], rol="designer", nombre=datos["nombre"])
            filas.append(("designer", datos["email"], "—", creado))

        for datos in SOLICITANTES:
            usuario, creado = _upsert_usuario(
                db, email=datos["email"], rol="solicitante",
                nombre=datos["nombre"], apellido=datos["apellido"],
            )
            filas.append(("solicitante", datos["email"], "—", creado))

        for datos_empresa in EMPRESAS:
            empresa, creada = _upsert_empresa(db, datos_empresa)
            etiqueta = f"{empresa.nombre_empresa} ({empresa.shipping_mark_prefijo})"
            if creada:
                print(f"Empresa creada: {etiqueta}")

            dueño = datos_empresa["dueño"]
            _, creado = _upsert_usuario(
                db, email=dueño["email"], rol="importador",
                nombre=dueño["nombre"], importador_id=empresa.id,
            )
            filas.append(("importador (empresa)", dueño["email"], etiqueta, creado))

            for asesor in datos_empresa["asesores"]:
                _, creado = _upsert_usuario(
                    db, email=asesor["email"], rol="asesor",
                    nombre=asesor["nombre"], importador_id=empresa.id,
                )
                filas.append(("asesor (empleado)", asesor["email"], etiqueta, creado))
    finally:
        db.close()

    ancho_rol = max(len(f[0]) for f in filas)
    ancho_email = max(len(f[1]) for f in filas)
    print(f"\nContraseña para todas las cuentas: {PASSWORD}\n")
    print(f"{'ROL'.ljust(ancho_rol)}  {'EMAIL'.ljust(ancho_email)}  EMPRESA")
    print(f"{'-' * ancho_rol}  {'-' * ancho_email}  {'-' * 30}")
    for rol, email, empresa, creado in filas:
        marca = "" if creado else "  (ya existía, actualizada)"
        print(f"{rol.ljust(ancho_rol)}  {email.ljust(ancho_email)}  {empresa}{marca}")


if __name__ == "__main__":
    main()
