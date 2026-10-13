"""Quién atiende en cada empresa, para su ficha pública.

La ficha del catálogo mostraba «Asesor asignado» (texto de relleno cuando la
empresa no escribía un contacto en su perfil) y un «Suplente / Asesor Jr.»
inventado en el frontend. Aquí se resuelven las personas reales: los asesores
activos de la empresa y, si todavía no tiene ninguno, la cuenta responsable.

Solo sale el nombre: la ficha es pública, así que ni correo ni teléfono.
"""
from __future__ import annotations

from typing import Dict, Iterable, List

from sqlalchemy.orm import Session

from models.usuario import Usuario


def _nombre(usuario: Usuario) -> str:
    return " ".join(p.strip() for p in (usuario.nombre, usuario.apellido) if p and p.strip())[:120]


def asesores_publicos_por_importador(db: Session, importador_ids: Iterable[str]) -> Dict[str, List[dict]]:
    """`{importador_id: [{id, nombre, rol}]}` en una sola consulta.

    `rol` es "asesor" o "importador" (la cuenta responsable, que solo aparece
    cuando la empresa no tiene asesores activos)."""
    ids = [str(i) for i in importador_ids if i]
    if not ids:
        return {}
    filas = (
        db.query(Usuario)
        .filter(
            Usuario.importador_id.in_(ids),
            Usuario.rol.in_(("asesor", "importador")),
            Usuario.activo.is_(True),
        )
        .order_by(Usuario.fecha_creacion.asc())
        .all()
    )
    asesores: Dict[str, List[dict]] = {}
    responsables: Dict[str, List[dict]] = {}
    for usuario in filas:
        nombre = _nombre(usuario)
        if not nombre:
            continue
        destino = asesores if usuario.rol == "asesor" else responsables
        destino.setdefault(str(usuario.importador_id), []).append(
            {"id": usuario.id, "nombre": nombre, "rol": usuario.rol})
    return {i: asesores.get(i) or responsables.get(i, [])[:1] for i in ids}
