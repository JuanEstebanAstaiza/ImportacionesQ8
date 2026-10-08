"""Valida de dónde viene una solicitud: formulario, Tendencias o un catálogo.

Una solicitud que dice venir de Tendencias queda atribuida a esa ficha (la
métrica del módulo); si la ficha la recomienda una importadora, la solicitud
va solo a ella: el cliente que la cotiza es suyo, no de la competencia. Desde
un catálogo, solo si el comprador tiene acceso a él.
"""
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.catalogo import CatalogoEmpresa, ProductoCatalogo
from models.tendencias_virales import EstadoTendencia, TendenciaItem
from models.usuario import Usuario
from services import catalogos


def validar_origen(db: Session, solicitante: Usuario, datos) -> dict:
    """Devuelve los campos de origen a guardar en la cotización."""
    origen = datos.origen or "directa"
    vacio = {"origen": "directa", "tendencia_item_id": None, "catalogo_producto_id": None}

    if origen == "tendencias":
        item = None
        if datos.tendencia_item_id:
            item = db.query(TendenciaItem).filter(TendenciaItem.id == datos.tendencia_item_id).first()
        if item is None or item.estado != EstadoTendencia.publicado.value:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="El producto de Tendencias no existe o ya no está publicado")
        if item.importador_id and (datos.modalidad != "dirigida" or datos.importador_id != item.importador_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Este producto lo recomienda una importadora: la solicitud va dirigida a ella")
        return {**vacio, "origen": "tendencias", "tendencia_item_id": item.id}

    if origen == "catalogo":
        fila = None
        if datos.catalogo_producto_id:
            fila = (
                db.query(ProductoCatalogo, CatalogoEmpresa)
                .join(CatalogoEmpresa, CatalogoEmpresa.id == ProductoCatalogo.catalogo_id)
                .filter(ProductoCatalogo.id == datos.catalogo_producto_id,
                        ProductoCatalogo.activo.is_(True))
                .first()
            )
        if fila is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="El producto del catálogo no existe")
        producto, catalogo = fila
        if not catalogos.puede_ver(db, solicitante, catalogo):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Este catálogo no está disponible para tu cuenta")
        if datos.modalidad != "dirigida" or datos.importador_id != catalogo.importador_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Una solicitud desde un catálogo va dirigida a la empresa dueña del catálogo")
        return {**vacio, "origen": "catalogo", "catalogo_producto_id": producto.id}

    return vacio


def contar_solicitud(db: Session, campos_origen: dict) -> None:
    """Suma la solicitud al contador de la ficha (UPDATE atómico)."""
    item_id = campos_origen.get("tendencia_item_id")
    if item_id:
        db.query(TendenciaItem).filter(TendenciaItem.id == item_id).update(
            {TendenciaItem.cotizaciones_count: TendenciaItem.cotizaciones_count + 1}, synchronize_session=False)
