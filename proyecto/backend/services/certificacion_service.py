"""Consultas de certificaciones de plataforma y su peso en el catálogo.

El "puntaje de publicidad" de una empresa es la suma de los pesos de sus sellos
vigentes. Es lo que decide el orden del catálogo que ve el solicitante, así que
se calcula en SQL (no en Python) para poder ordenar y paginar en la misma query.
"""
from __future__ import annotations

from typing import Dict, Iterable, List

from sqlalchemy import func
from sqlalchemy.orm import Session

from models.certificacion import Certificacion, CertificacionImportador
from schemas.certificacion import CertificacionOtorgadaResponse


def subconsulta_puntaje_publicidad(db: Session):
    """Subconsulta `(importador_id, puntaje)` con los sellos vigentes y activos.

    Se usa con `outerjoin` para que las empresas sin certificación también
    aparezcan en el catálogo, con puntaje 0.
    """
    return (
        db.query(
            CertificacionImportador.importador_id.label("importador_id"),
            func.coalesce(func.sum(Certificacion.peso_publicidad), 0.0).label("puntaje"),
        )
        .join(Certificacion, Certificacion.id == CertificacionImportador.certificacion_id)
        .filter(
            CertificacionImportador.revocada_at.is_(None),
            Certificacion.activa.is_(True),
        )
        .group_by(CertificacionImportador.importador_id)
        .subquery()
    )


def certificaciones_por_importador(
    db: Session,
    importador_ids: Iterable[str],
) -> Dict[str, List[CertificacionOtorgadaResponse]]:
    """Sellos vigentes de varias empresas en una sola query (evita N+1)."""
    ids = [str(i) for i in importador_ids if i]
    if not ids:
        return {}

    filas = (
        db.query(CertificacionImportador, Certificacion)
        .join(Certificacion, Certificacion.id == CertificacionImportador.certificacion_id)
        .filter(
            CertificacionImportador.importador_id.in_(ids),
            CertificacionImportador.revocada_at.is_(None),
            Certificacion.activa.is_(True),
        )
        .order_by(Certificacion.peso_publicidad.desc(), Certificacion.nombre.asc())
        .all()
    )

    resultado: Dict[str, List[CertificacionOtorgadaResponse]] = {}
    for otorgada, certificacion in filas:
        resultado.setdefault(str(otorgada.importador_id), []).append(
            CertificacionOtorgadaResponse(
                id=str(otorgada.id),
                certificacion_id=str(certificacion.id),
                nombre=certificacion.nombre,
                descripcion=certificacion.descripcion or "",
                logo_url=certificacion.logo_url,
                peso_publicidad=float(certificacion.peso_publicidad or 0.0),
                fecha_otorgada=otorgada.fecha_otorgada,
            )
        )
    return resultado


def puntaje_de(certificaciones: List[CertificacionOtorgadaResponse]) -> float:
    return round(sum(float(c.peso_publicidad or 0.0) for c in certificaciones), 4)


def adjuntar_certificaciones(db: Session, importadores: List) -> List:
    """Convierte filas `Importador` en `ImportadorResponse` con sus sellos.

    Vive aquí y no en el router para que el panel de administración devuelva
    exactamente la misma forma que el catálogo público.
    """
    from schemas.importador import ImportadorResponse

    por_empresa = certificaciones_por_importador(db, [imp.id for imp in importadores])
    respuestas = []
    for imp in importadores:
        certificaciones = por_empresa.get(str(imp.id), [])
        respuesta = ImportadorResponse.model_validate(imp)
        respuesta.certificaciones = certificaciones
        respuesta.puntaje_publicidad = puntaje_de(certificaciones)
        respuestas.append(respuesta)
    return respuestas
