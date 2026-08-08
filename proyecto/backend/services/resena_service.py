"""Cálculo de la reputación de una empresa importadora a partir de sus reseñas.

`Importador.calificacion_promedio` existía como columna desde el principio, pero
nadie la escribía: el catálogo mostraba un 0.0 (o el número que hubiera dejado
un seed) como si fuera una valoración real. Aquí se deriva de las reseñas
verificadas, que son las únicas que cuentan.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from models.importador import Importador
from models.resena import ResenaImportador


def recalcular_calificacion(db: Session, importador_id: str) -> float:
    """Recalcula y persiste el promedio de una empresa. Devuelve el valor nuevo.

    Solo entran las reseñas visibles: una oculta por moderación no debe seguir
    arrastrando la nota hacia abajo (ni hacia arriba).
    """
    promedio = (
        db.query(func.avg(ResenaImportador.calificacion))
        .filter(
            ResenaImportador.importador_id == importador_id,
            ResenaImportador.visible.is_(True),
        )
        .scalar()
    )

    valor = round(float(promedio), 2) if promedio is not None else 0.0

    empresa = db.query(Importador).filter(Importador.id == importador_id).first()
    if empresa is not None:
        empresa.calificacion_promedio = valor

    return valor


def resumen_de(db: Session, importador_id: str) -> dict:
    """Promedio, total y reparto por estrellas, para pintar la ficha pública."""
    filas = (
        db.query(ResenaImportador.calificacion, func.count(ResenaImportador.id))
        .filter(
            ResenaImportador.importador_id == importador_id,
            ResenaImportador.visible.is_(True),
        )
        .group_by(ResenaImportador.calificacion)
        .all()
    )

    reparto = {estrellas: 0 for estrellas in range(1, 6)}
    total = 0
    suma = 0
    for estrellas, cantidad in filas:
        if estrellas in reparto:
            reparto[estrellas] = cantidad
        total += cantidad
        suma += estrellas * cantidad

    return {
        "promedio": round(suma / total, 2) if total else 0.0,
        "total": total,
        "reparto": reparto,
    }


def promedios_por_importador(db: Session, importador_ids: list) -> dict:
    """Resumen de varias empresas en una sola consulta (listados del catálogo)."""
    if not importador_ids:
        return {}

    filas = (
        db.query(
            ResenaImportador.importador_id,
            func.avg(ResenaImportador.calificacion),
            func.count(ResenaImportador.id),
        )
        .filter(
            ResenaImportador.importador_id.in_(importador_ids),
            ResenaImportador.visible.is_(True),
        )
        .group_by(ResenaImportador.importador_id)
        .all()
    )

    return {
        importador_id: {"promedio": round(float(promedio), 2), "total": total}
        for importador_id, promedio, total in filas
    }


def promedio_de_campo(db: Session, importador_id: str, campo) -> Optional[float]:
    """Promedio de una dimensión concreta (puntualidad, calidad, comunicación)."""
    valor = (
        db.query(func.avg(campo))
        .filter(
            ResenaImportador.importador_id == importador_id,
            ResenaImportador.visible.is_(True),
            campo.isnot(None),
        )
        .scalar()
    )
    return round(float(valor), 2) if valor is not None else None
