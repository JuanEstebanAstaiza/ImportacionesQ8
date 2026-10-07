"""Valida de dónde viene una solicitud: formulario, Tendencias o un catálogo.

Una solicitud que dice venir de Tendencias o de un catálogo solo se acepta si
el comprador de verdad tiene acceso a ese producto. Si no, cualquiera podría
inflar las métricas de una edición o colarse en el catálogo de una empresa.
"""
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.catalogo import CatalogoEmpresa, ProductoCatalogo
from models.tendencias import EdicionProducto, EdicionTendencias, EstadoEdicion, ProductoTendencia
from models.usuario import Usuario
from services import catalogos, tendencias


def validar_origen(db: Session, solicitante: Usuario, datos) -> dict:
    """Devuelve los campos de origen a guardar en la cotización."""
    origen = datos.origen or "directa"
    vacio = {"origen": "directa", "tendencia_edicion_id": None,
             "tendencia_producto_id": None, "catalogo_producto_id": None}

    if origen == "tendencias":
        producto = None
        if datos.tendencia_producto_id:
            producto = db.query(ProductoTendencia).filter(ProductoTendencia.id == datos.tendencia_producto_id).first()
        if producto is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="El producto de Tendencias no existe")
        if not tendencias.tiene_acceso(db, solicitante):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Necesitas una suscripción vigente a Tendencias")
        edicion_id: Optional[str] = datos.tendencia_edicion_id
        if edicion_id:
            en_edicion = (
                db.query(EdicionProducto)
                .join(EdicionTendencias, EdicionTendencias.id == EdicionProducto.edicion_id)
                .filter(EdicionProducto.edicion_id == edicion_id,
                        EdicionProducto.producto_id == producto.id,
                        EdicionTendencias.estado.in_((EstadoEdicion.publicada.value, EstadoEdicion.archivada.value)))
                .first()
            )
            if en_edicion is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail="El producto no pertenece a esa edición de Tendencias")
        return {**vacio, "origen": "tendencias", "tendencia_edicion_id": edicion_id,
                "tendencia_producto_id": producto.id}

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
