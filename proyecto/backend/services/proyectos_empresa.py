"""Proyectos completados de una empresa importadora.

La ficha pública y las tarjetas del catálogo muestran "N proyectos" como señal
de trayectoria. Ese número no estaba en ninguna parte: el frontend lo dibujaba
con un `0` fijo, así que todas las empresas aparecían como recién llegadas por
mucho trabajo que hubieran entregado.

Un "proyecto completado" es una orden que llegó a `entregado`, el estado final
de `EstadoOrden`. Se cuenta en SQL y por lotes (`IN`) para no disparar una
consulta por empresa al serializar el catálogo entero.
"""
from __future__ import annotations

from typing import Dict, Iterable

from sqlalchemy import func
from sqlalchemy.orm import Session

from models.orden import EstadoOrden, Orden


def proyectos_completados_por_importador(
    db: Session,
    importador_ids: Iterable[str],
) -> Dict[str, int]:
    """`{importador_id: órdenes entregadas}` para las empresas indicadas."""
    ids = [str(i) for i in importador_ids if i]
    if not ids:
        return {}

    filas = (
        db.query(Orden.importador_id, func.count(Orden.id))
        .filter(
            Orden.importador_id.in_(ids),
            Orden.estado == EstadoOrden.entregado.value,
        )
        .group_by(Orden.importador_id)
        .all()
    )
    return {str(importador_id): int(total) for importador_id, total in filas}
