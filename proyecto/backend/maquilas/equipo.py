"""Colaboradores de una maquiladora.

La cuenta dueña crea cuentas para su gente (como la empresa importadora con sus
asesores): un `Usuario` de rol `maquiladora` con el correo ya verificado y una fila
en `miembros` con rol `colaborador`. El colaborador atiende solicitudes, propuestas,
pedidos, catálogo y reseñas; lo que es de la empresa (perfil legal, expediente,
verificación y equipo) queda para la dueña.

Desactivar no borra nada: la cuenta no puede entrar y deja de recibir avisos.
"""
from __future__ import annotations

from typing import Dict, List
from uuid import uuid4

from fastapi import status
from pymongo.database import Database
from sqlalchemy.orm import Session

from maquilas import parametros
from maquilas.comun import ahora, error, iso
from maquilas.esquemas import ColaboradorEntrada
from maquilas.identidad import membresia
from models.usuario import Usuario
from utils.security import hash_password


def _dueno(db: Database, usuario: dict) -> str:
    fila = membresia(db, usuario)
    if not fila:
        raise error(status.HTTP_404_NOT_FOUND, "Tu cuenta no está vinculada a ninguna maquiladora")
    if fila.get("rol") != "dueno":
        raise error(status.HTTP_403_FORBIDDEN, "Solo la cuenta dueña administra el equipo")
    return fila["maquiladora_id"]


def listar(db: Database, sql: Session, usuario: dict) -> List[Dict]:
    maquiladora_id = _dueno(db, usuario)
    miembros = {m["_id"]: m for m in db.miembros.find({"maquiladora_id": maquiladora_id})}
    filas = sql.query(Usuario).filter(Usuario.id.in_(list(miembros))).all() if miembros else []
    salida = []
    for u in filas:
        m = miembros[str(u.id)]
        salida.append({"id": str(u.id), "nombre": " ".join(x for x in (u.nombre, u.apellido) if x) or u.email, "email": u.email,
                       "telefono": u.telefono, "rol": m.get("rol", "colaborador"), "activo": bool(u.activo) and m.get("activo") is not False,
                       "creado_en": iso(m.get("creado_en"))})
    return sorted(salida, key=lambda x: (x["rol"] != "dueno", x["nombre"].lower()))


def crear(db: Database, sql: Session, usuario: dict, datos: ColaboradorEntrada) -> Dict:
    maquiladora_id = _dueno(db, usuario)
    maximo = int(parametros.leer(db)["colaboradores_max"])
    if db.miembros.count_documents({"maquiladora_id": maquiladora_id, "rol": "colaborador"}) >= maximo:
        raise error(status.HTTP_409_CONFLICT, f"Tu maquila puede tener hasta {maximo} colaboradores")
    if sql.query(Usuario.id).filter(Usuario.email == datos.email).first():
        raise error(status.HTTP_400_BAD_REQUEST, "Ese correo ya tiene una cuenta en Zarpi")
    nuevo = Usuario(id=str(uuid4()), email=datos.email, password_hash=hash_password(datos.password), rol="maquiladora",
                    nombre=datos.nombre.strip(), apellido=datos.apellido.strip() or None, telefono=datos.telefono,
                    activo=True, email_verificado=True, perfil_completo=True)
    sql.add(nuevo)
    sql.commit()
    try:
        db.miembros.insert_one({"_id": nuevo.id, "maquiladora_id": maquiladora_id, "rol": "colaborador", "activo": True,
                                "creado_por": usuario["user_id"], "creado_en": ahora()})
    except Exception:
        # Sin el vínculo la cuenta quedaría huérfana: se deshace.
        sql.delete(nuevo)
        sql.commit()
        raise
    return next(c for c in listar(db, sql, usuario) if c["id"] == nuevo.id)


def cambiar_estado(db: Database, sql: Session, usuario: dict, colaborador_id: str, activo: bool) -> Dict:
    maquiladora_id = _dueno(db, usuario)
    miembro = db.miembros.find_one({"_id": colaborador_id, "maquiladora_id": maquiladora_id})
    if not miembro:
        raise error(status.HTTP_404_NOT_FOUND, "Ese colaborador no es de tu maquila")
    if miembro.get("rol") == "dueno":
        raise error(status.HTTP_400_BAD_REQUEST, "La cuenta dueña no se puede desactivar")
    fila = sql.query(Usuario).filter(Usuario.id == colaborador_id).first()
    if fila:
        fila.activo = activo
        sql.commit()
    db.miembros.update_one({"_id": colaborador_id}, {"$set": {"activo": activo, "actualizado_en": ahora()}})
    return next(c for c in listar(db, sql, usuario) if c["id"] == colaborador_id)
