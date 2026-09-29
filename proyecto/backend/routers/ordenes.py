import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from uuid import UUID as PyUUID, uuid4
from datetime import datetime

import config
from schemas.orden import (
    OrdenResponse, EstadoOrdenUpdate, DocumentoOrdenItem, DocumentoOrdenCreate,
    ReportarProblemaRequest, ResolverDisputaRequest
)
from models.orden import Orden, HistorialEstadosOrden, DocumentoOrden, EstadoOrden, TipoDocumentoOrden
from utils.dependencies import get_db, get_current_user, require_rol, require_rol_in

logger = logging.getLogger("importacionesq8")

router = APIRouter(prefix="/ordenes", tags=["Órdenes"])

# Transiciones de estado válidas para órdenes
ESTADOS_VALIDOS = {
    "cotizacion_aceptada": ["en_produccion"],
    "en_produccion": ["transito_internacional"],
    "transito_internacional": ["aduana_nacionalizacion"],
    "aduana_nacionalizacion": ["bodega_local"],
    "bodega_local": ["entregado"]
}

# Cómo se lee cada estado fuera del código: los mensajes que ve el cliente no
# pueden decir "aduana_nacionalizacion".
ETIQUETAS_ESTADO = {
    "cotizacion_aceptada": "cotización aceptada",
    "en_produccion": "en producción",
    "transito_internacional": "en tránsito internacional",
    "aduana_nacionalizacion": "en aduana / nacionalización",
    "bodega_local": "en bodega local",
    "entregado": "entregado",
}


def _anotar_cambio_estado_en_chat(
    db: Session,
    *,
    orden: Orden,
    remitente_id: str,
    estado_anterior: str,
    estado_nuevo: str,
) -> None:
    """Deja constancia del cambio de estado en el chat de seguimiento.

    Best-effort: si el hilo no existe (órdenes anteriores a que el chat se
    abriera al reclamar), el cambio de estado no debe fallar por eso.
    """
    try:
        from models.chat import ConversacionChat, MensajeChat, TipoMensajeChat

        conversacion = db.query(ConversacionChat).filter(
            ConversacionChat.cotizacion_id == orden.cotizacion_id
        ).first()
        if not conversacion:
            return

        db.add(MensajeChat(
            id=str(uuid4()),
            conversacion_id=conversacion.id,
            remitente_id=str(remitente_id),
            contenido=(
                f"Estado del embarque actualizado: "
                f"{ETIQUETAS_ESTADO.get(estado_anterior, estado_anterior)} → "
                f"{ETIQUETAS_ESTADO.get(estado_nuevo, estado_nuevo)}."
            ),
            tipo=TipoMensajeChat.sistema.value,
        ))
    except Exception:
        logger.warning("No se pudo anotar el cambio de estado en el chat de la orden %s", orden.id)


def get_db_now(db: Session) -> datetime:
    """Obtener la fecha/hora actual de forma compatible con SQLite y MySQL"""
    try:
        # Intentar usar db.func.now() (MySQL)
        result = db.execute(db.func.now())
        return result.scalar()
    except Exception:
        # Fallback a datetime.utcnow() (SQLite)
        return datetime.utcnow()

@router.get("", response_model=List[OrdenResponse])
async def listar_ordenes(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Listar órdenes del usuario autenticado.
    
    - Solicitante: solo sus propias órdenes
    - Importador: solo las órdenes asignadas a su empresa
    """
    user_id_str = str(PyUUID(current_user["user_id"]))  # Convertir a string para SQLite
    rol = current_user["rol"]
    
    if rol == "solicitante":
        # Solicitante ve solo sus propias órdenes
        ordenes = db.query(Orden).filter(
            Orden.solicitante_id == user_id_str
        ).order_by(Orden.fecha_creacion.desc()).all()
    elif rol in ("importador", "asesor"):
        # El importador_id de la empresa viene del claim del JWT, no del user_id.
        ordenes = db.query(Orden).filter(
            Orden.importador_id == current_user.get("importador_id")
        ).order_by(Orden.fecha_creacion.desc()).all()
    else:
        # Admin ve todas las órdenes (limitado)
        ordenes = db.query(Orden).order_by(
            Orden.fecha_creacion.desc()
        ).limit(50).all()
    
    return [
        OrdenResponse(
            id=str(o.id),
            cotizacion_id=o.cotizacion_id,
            importador_id=o.importador_id,
            solicitante_id=o.solicitante_id,
            asesor_asignado_id=o.asesor_asignado_id,
            estado=o.estado.value if isinstance(o.estado, EstadoOrden) else o.estado,
            precio_acordado_usd=o.precio_acordado_usd,
            tiempo_estimado_entrega=o.tiempo_estimado_entrega,
            condiciones_adicionales=o.condiciones_adicionales,
            shipping_mark=o.shipping_mark,
            en_disputa=o.en_disputa,
            motivo_disputa=o.motivo_disputa,
            conversacion_id=o.conversacion_id,
            historial_estados=[
                {
                    "id": str(h.id),
                    "orden_id": h.orden_id,
                    "estado_anterior": h.estado_anterior,
                    "estado_nuevo": h.estado_nuevo.value if isinstance(h.estado_nuevo, EstadoOrden) else h.estado_nuevo,
                    "fecha_cambio": h.fecha_cambio
                }
                for h in o.historial_estados
            ],
            documentos_adjuntos=[
                {
                    "id": str(d.id),
                    "orden_id": d.orden_id,
                    "nombre": d.nombre,
                    "url": d.url,
                    "tipo": d.tipo.value if isinstance(d.tipo, TipoDocumentoOrden) else d.tipo
                }
                for d in o.documentos_adjuntos
            ]
        )
        for o in ordenes
    ]

@router.get("/importador/{importador_id}/activas", response_model=List[OrdenResponse])
async def listar_ordenes_activas_importador(
    importador_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador"))
):
    """
    Listar órdenes activas asignadas al importador. Solo el importador puede verlas.
    
    - **importador_id**: ID del importador (UUID)
    """
    try:
        importador_id_str = str(PyUUID(importador_id))  # Validar UUID
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ID de importador inválido"
        )
    
    # Verificar que el usuario pertenece a la empresa indicada (evita IDOR entre empresas)
    if importador_id_str != current_user.get("importador_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado - Solo puede ver sus propias órdenes"
        )
    
    # Listar órdenes activas (estado diferente a "entregado")
    estados_activos = [e.value for e in EstadoOrden if e != EstadoOrden.entregado]
    ordenes = db.query(Orden).filter(
        Orden.importador_id == importador_id_str,
        Orden.estado.in_(estados_activos)
    ).order_by(Orden.fecha_creacion.desc()).all()
    
    return [
        OrdenResponse(
            id=str(o.id),
            cotizacion_id=o.cotizacion_id,
            importador_id=o.importador_id,
            solicitante_id=o.solicitante_id,
            asesor_asignado_id=o.asesor_asignado_id,
            estado=o.estado.value if isinstance(o.estado, EstadoOrden) else o.estado,
            precio_acordado_usd=o.precio_acordado_usd,
            tiempo_estimado_entrega=o.tiempo_estimado_entrega,
            condiciones_adicionales=o.condiciones_adicionales,
            shipping_mark=o.shipping_mark,
            en_disputa=o.en_disputa,
            motivo_disputa=o.motivo_disputa,
            conversacion_id=o.conversacion_id,
            historial_estados=[
                {
                    "id": str(h.id),
                    "orden_id": h.orden_id,
                    "estado_anterior": h.estado_anterior,
                    "estado_nuevo": h.estado_nuevo.value if isinstance(h.estado_nuevo, EstadoOrden) else h.estado_nuevo,
                    "fecha_cambio": h.fecha_cambio
                }
                for h in o.historial_estados
            ],
            documentos_adjuntos=[
                {
                    "id": str(d.id),
                    "orden_id": d.orden_id,
                    "nombre": d.nombre,
                    "url": d.url,
                    "tipo": d.tipo.value if isinstance(d.tipo, TipoDocumentoOrden) else d.tipo
                }
                for d in o.documentos_adjuntos
            ]
        )
        for o in ordenes
    ]

@router.get("/{orden_id}", response_model=OrdenResponse)
async def obtener_orden(
    orden_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Obtener detalles de una orden específica. Solo si el usuario tiene acceso.
    
    - **orden_id**: ID de la orden (UUID)
    """
    user_id_str = str(PyUUID(current_user["user_id"]))  # Convertir a string para SQLite
    
    try:
        orden_id_str = str(PyUUID(orden_id))  # Validar UUID
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ID de orden inválido"
        )
    
    orden = db.query(Orden).filter(Orden.id == orden_id_str).first()
    
    if not orden:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden no encontrada"
        )
    
    # Verificar que el usuario tiene acceso a esta orden
    rol = current_user["rol"]
    
    if rol == "solicitante" and orden.solicitante_id != user_id_str:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a esta orden"
        )
    
    # Importador/asesor solo puede ver si la orden es de su empresa
    if rol in ("importador", "asesor") and orden.importador_id != current_user.get("importador_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a esta orden"
        )
    
    return OrdenResponse(
        id=str(orden.id),
        cotizacion_id=orden.cotizacion_id,
        importador_id=orden.importador_id,
        solicitante_id=orden.solicitante_id,
        asesor_asignado_id=orden.asesor_asignado_id,
        estado=orden.estado.value if isinstance(orden.estado, EstadoOrden) else orden.estado,
        precio_acordado_usd=orden.precio_acordado_usd,
        tiempo_estimado_entrega=orden.tiempo_estimado_entrega,
        condiciones_adicionales=orden.condiciones_adicionales,
        shipping_mark=orden.shipping_mark,
        en_disputa=orden.en_disputa,
        motivo_disputa=orden.motivo_disputa,
        conversacion_id=orden.conversacion_id,
        historial_estados=[
            {
                "id": str(h.id),
                "orden_id": h.orden_id,
                "estado_anterior": h.estado_anterior,
                "estado_nuevo": h.estado_nuevo.value if isinstance(h.estado_nuevo, EstadoOrden) else h.estado_nuevo,
                "fecha_cambio": h.fecha_cambio
            }
            for h in orden.historial_estados
        ],
        documentos_adjuntos=[
            {
                "id": str(d.id),
                "orden_id": d.orden_id,
                "nombre": d.nombre,
                "url": d.url,
                "tipo": d.tipo.value if isinstance(d.tipo, TipoDocumentoOrden) else d.tipo
            }
            for d in orden.documentos_adjuntos
        ]
    )

@router.put("/{orden_id}/estado", response_model=dict)
async def actualizar_estado_orden(
    orden_id: str,
    nuevo_estado: EstadoOrdenUpdate,
    current_user: dict = Depends(require_rol_in("importador", "asesor")),
    db: Session = Depends(get_db)
):
    """
    Actualizar el estado de una orden.

    Lo mueve la empresa dueña o el **asesor asignado** a esa orden: es quien
    hace el seguimiento del embarque y quien recibe por el canal interno la
    indicación de cuándo marcarlo (despachado, en aduana...).

    - **orden_id**: ID de la orden (UUID)
    - **nuevo_estado**: Nuevo estado de la orden

    Validaciones:
    1. La orden debe existir y ser de la empresa del usuario autenticado
    2. Si quien la mueve es un asesor, debe ser el asignado a esa orden
    3. El nuevo estado debe ser una transición válida según el ciclo de vida del pedido
    """
    try:
        orden_id_str = str(PyUUID(orden_id))  # Validar UUID
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ID de orden inválido"
        )

    # Verificar que la orden existe y pertenece a la empresa del usuario autenticado
    orden = db.query(Orden).filter(
        Orden.id == orden_id_str,
        Orden.importador_id == current_user.get("importador_id")
    ).first()

    if not orden:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden no encontrada o no asignada a este importador"
        )

    if current_user["rol"] == "asesor" and str(orden.asesor_asignado_id or "") != str(current_user["user_id"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el asesor asignado a esta orden puede actualizar su estado"
        )

    # Verificar que el nuevo estado es válido (transición permitida)
    estado_actual = orden.estado.value if isinstance(orden.estado, EstadoOrden) else orden.estado
    nuevo_estado_valor = nuevo_estado.estado
    
    estados_permitidos = ESTADOS_VALIDOS.get(estado_actual, [])
    
    if nuevo_estado_valor not in estados_permitidos:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Transición de estado inválida: {estado_actual} → {nuevo_estado_valor}. Estados permitidos: {estados_permitidos}"
        )
    
    # Actualizar el estado de la orden
    orden.estado = nuevo_estado_valor
    orden.fecha_actualizacion = get_db_now(db)
    
    # Registrar cambio en historial de estados
    nuevo_historial = HistorialEstadosOrden(
        orden_id=orden_id_str,
        estado_anterior=estado_actual,
        estado_nuevo=nuevo_estado_valor,
        fecha_cambio=get_db_now(db)
    )
    db.add(nuevo_historial)

    # El hilo de la cotización pasó a ser el del seguimiento al crearse la orden:
    # dejar ahí el cambio de estado evita que el cliente tenga que ir a otra
    # pantalla a enterarse, y da pie a preguntar por el mismo canal.
    _anotar_cambio_estado_en_chat(
        db,
        orden=orden,
        remitente_id=current_user["user_id"],
        estado_anterior=estado_actual,
        estado_nuevo=nuevo_estado_valor,
    )

    # Notificación in-app + WhatsApp + correo, y Redis Pub/Sub (best-effort).
    from services.notificacion_service import notificar
    notificar(
        db,
        usuario_id=orden.solicitante_id,
        tipo="orden",
        titulo="Actualización de tu orden",
        mensaje=f"La orden pasó de {estado_actual} a {nuevo_estado_valor}.",
        data={
            "orden_id": orden_id_str,
            "estado_anterior": estado_actual,
            "estado_nuevo": nuevo_estado_valor,
        },
        enlace_relativo="/ordenes",
    )

    if config.redis_client:
        try:
            config.redis_client.publish(
                f"orden:{orden_id_str}:notificaciones",
                str({
                    "tipo": "cambio_estado",
                    "orden_id": orden_id_str,
                    "estado_anterior": estado_actual,
                    "estado_nuevo": nuevo_estado_valor,
                    "fecha_cambio": get_db_now(db).isoformat() if hasattr(get_db_now(db), 'isoformat') else str(get_db_now(db))
                })
            )
        except Exception:
            logger.warning("No se pudo publicar notificación Redis para orden %s", orden_id_str)

    if nuevo_estado_valor == EstadoOrden.entregado.value:
        # Cierre del pedido: momento natural para reevaluar el tier.
        from services.tier_service import recalcular_tier_best_effort

        recalcular_tier_best_effort(db, orden.solicitante_id)

    db.commit()
    
    return {"success": True, "nuevo_estado": nuevo_estado_valor}

@router.post("/{orden_id}/documentos", response_model=DocumentoOrdenItem, status_code=status.HTTP_201_CREATED)
async def agregar_documento_orden(
    orden_id: str,
    documento: DocumentoOrdenCreate,
    current_user: dict = Depends(require_rol("importador")),
    db: Session = Depends(get_db)
):
    """
    Agregar un documento a una orden. Solo los importadores asignados pueden agregar documentos.
    
    - **orden_id**: ID de la orden (UUID)
    - **documento**: Datos del documento (nombre, url, tipo)
    """
    try:
        orden_id_str = str(PyUUID(orden_id))  # Validar UUID
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ID de orden inválido"
        )
    
    # Verificar que la orden existe y pertenece a la empresa del usuario autenticado
    orden = db.query(Orden).filter(
        Orden.id == orden_id_str,
        Orden.importador_id == current_user.get("importador_id")
    ).first()
    
    if not orden:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden no encontrada o no asignada a este importador"
        )
    
    # Crear nuevo documento
    nuevo_documento = DocumentoOrden(
        id=str(uuid4()),
        orden_id=orden_id_str,
        nombre=documento.nombre,
        url=documento.url,
        tipo=documento.tipo
    )
    db.add(nuevo_documento)
    db.commit()
    db.refresh(nuevo_documento)
    
    return DocumentoOrdenItem(
        id=str(nuevo_documento.id),
        orden_id=nuevo_documento.orden_id,
        nombre=nuevo_documento.nombre,
        url=nuevo_documento.url,
        tipo=nuevo_documento.tipo.value if isinstance(nuevo_documento.tipo, TipoDocumentoOrden) else nuevo_documento.tipo
    )

# NOTA (Semana 4 - Fase 5): `POST /ordenes/crear-orden` fue eliminado. La orden
# ahora se crea automáticamente cuando ambas partes (solicitante y empresa)
# pre-aceptan la misma propuesta - ver
# `routers/cotizaciones.py::pre_aceptar_propuesta` (`POST /propuestas/{id}/pre-aceptar`).
# La plataforma no depende de un pago para crear la orden: solo conecta a las
# partes y no se responsabiliza por el cumplimiento del negocio concretado.

@router.get("/cotizacion/{cotizacion_id}", response_model=OrdenResponse)
async def obtener_orden_por_cotizacion(
    cotizacion_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Obtener la orden asociada a una cotización. Solo si el usuario tiene acceso.
    
    - **cotizacion_id**: ID de la cotización (UUID)
    """
    user_id_str = str(PyUUID(current_user["user_id"]))  # Convertir a string para SQLite
    
    try:
        cotizacion_id_str = str(PyUUID(cotizacion_id))  # Validar UUID
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ID de cotización inválido"
        )
    
    orden = db.query(Orden).filter(Orden.cotizacion_id == cotizacion_id_str).first()
    
    if not orden:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Orden no encontrada para esta cotización"
        )
    
    # Verificar que el usuario tiene acceso a esta orden
    rol = current_user["rol"]
    
    if rol == "solicitante" and orden.solicitante_id != user_id_str:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a esta orden"
        )
    
    # Importador/asesor solo puede ver si la orden es de su empresa
    if rol in ("importador", "asesor") and orden.importador_id != current_user.get("importador_id"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a esta orden"
        )
    
    return OrdenResponse(
        id=str(orden.id),
        cotizacion_id=orden.cotizacion_id,
        importador_id=orden.importador_id,
        solicitante_id=orden.solicitante_id,
        asesor_asignado_id=orden.asesor_asignado_id,
        estado=orden.estado.value if isinstance(orden.estado, EstadoOrden) else orden.estado,
        precio_acordado_usd=orden.precio_acordado_usd,
        tiempo_estimado_entrega=orden.tiempo_estimado_entrega,
        condiciones_adicionales=orden.condiciones_adicionales,
        shipping_mark=orden.shipping_mark,
        en_disputa=orden.en_disputa,
        motivo_disputa=orden.motivo_disputa,
        conversacion_id=orden.conversacion_id,
        historial_estados=[
            {
                "id": str(h.id),
                "orden_id": h.orden_id,
                "estado_anterior": h.estado_anterior,
                "estado_nuevo": h.estado_nuevo.value if isinstance(h.estado_nuevo, EstadoOrden) else h.estado_nuevo,
                "fecha_cambio": h.fecha_cambio
            }
            for h in orden.historial_estados
        ],
        documentos_adjuntos=[
            {
                "id": str(d.id),
                "orden_id": d.orden_id,
                "nombre": d.nombre,
                "url": d.url,
                "tipo": d.tipo.value if isinstance(d.tipo, TipoDocumentoOrden) else d.tipo
            }
            for d in orden.documentos_adjuntos
        ]
    )

# ==================== Disputas (dispute room) ====================

@router.put("/{orden_id}/reportar-problema", response_model=dict)
async def reportar_problema_orden(
    orden_id: str,
    datos: ReportarProblemaRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("solicitante"))
):
    """Abre una disputa (sala) sobre la orden y marca en_disputa=True."""
    from models.disputa import Disputa, EstadoDisputa, MensajeDisputa, TipoMensajeDisputa

    user_id_str = str(PyUUID(current_user["user_id"]))

    try:
        orden_id_str = str(PyUUID(orden_id))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ID de orden inválido")

    orden = db.query(Orden).filter(
        Orden.id == orden_id_str,
        Orden.solicitante_id == user_id_str
    ).first()

    if not orden:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Orden no encontrada")

    existente = db.query(Disputa).filter(Disputa.orden_id == orden_id_str).first()
    if existente and existente.estado not in (EstadoDisputa.resuelta.value, EstadoDisputa.cerrada.value):
        raise HTTPException(status_code=400, detail="Ya existe una disputa abierta para esta orden")

    orden.en_disputa = True
    orden.motivo_disputa = datos.motivo
    orden.fecha_actualizacion = get_db_now(db)

    disputa = Disputa(
        id=str(uuid4()),
        orden_id=orden_id_str,
        abierta_por_usuario_id=user_id_str,
        estado=EstadoDisputa.abierta.value,
        motivo=datos.motivo,
    )
    db.add(disputa)
    db.flush()
    db.add(MensajeDisputa(
        id=str(uuid4()),
        disputa_id=disputa.id,
        autor_id=user_id_str,
        contenido=f"Disputa abierta: {datos.motivo}",
        tipo=TipoMensajeDisputa.sistema.value,
    ))
    db.commit()

    return {"success": True, "en_disputa": True, "disputa_id": disputa.id}
