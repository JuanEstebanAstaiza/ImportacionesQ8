import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from uuid import UUID

import config
from schemas.cotizacion import (
    CotizacionCreate, CotizacionResponse, PropuestaCreate, PropuestaResponse,
    PropuestaAceptadaRequest, ImportadorPendienteResponse, MatchingStatusResponse
)
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.propuesta import Propuesta, EstadoPropuesta
from models.importador import Importador
from utils.dependencies import get_db, get_current_user, require_rol

logger = logging.getLogger("importacionesq8")

# Importar motor de matching (después de los routers para evitar circular imports)
matching_cotizacion_abierta = None

def json_contains_column(column, value):
    """Helper para buscar en columnas JSON - compatible con MySQL y SQLite"""
    return column.like(f'%"{value}"%')

router = APIRouter(prefix="/cotizaciones", tags=["Cotizaciones"])

# Router independiente para /propuestas (no anidado bajo /cotizaciones) - ver Tarea 2.1
propuestas_router = APIRouter(prefix="/propuestas", tags=["Propuestas"])

@router.get("/", response_model=List[CotizacionResponse])
async def listar_cotizaciones(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Lista las cotizaciones del usuario autenticado.
    
    - Solicitante: solo sus propias cotizaciones
    - Importador: cotizaciones dirigidas a su empresa + cotizaciones abiertas que le aplican
    """
    user_id_str = str(UUID(current_user["user_id"]))  # Convertir a string para SQLite
    rol = current_user["rol"]
    
    if rol == "solicitante":
        # Solicitante ve solo sus propias cotizaciones
        cotizaciones = db.query(Cotizacion).filter(
            Cotizacion.solicitante_id == user_id_str
        ).order_by(Cotizacion.fecha_creacion.desc()).all()
    elif rol == "importador":
        # En este MVP el id de usuario del importador ES el importador_id usado en
        # cotizaciones dirigidas, propuestas y órdenes (no existe una tabla de mapeo
        # separada). Ver Propuesta.importador_id / Orden.importador_id para más contexto.
        importador_id_str = user_id_str
        
        # Importador ve cotizaciones dirigidas a él + abiertas disponibles para propuestas
        cotizaciones = db.query(Cotizacion).filter(
            or_(
                Cotizacion.importador_id == importador_id_str,  # Dirigidas
                and_(
                    Cotizacion.modalidad == "abierta",
                    Cotizacion.estado.in_([
                        EstadoCotizacion.abierta.value,
                        EstadoCotizacion.propuestas_recibidas.value
                    ])
                )
            )
        ).order_by(Cotizacion.fecha_creacion.desc()).all()
    else:
        # Admin ve todas las cotizaciones
        cotizaciones = db.query(Cotizacion).order_by(
            Cotizacion.fecha_creacion.desc()
        ).limit(50).all()
    
    return cotizaciones

@router.get("/{cotizacion_id}", response_model=CotizacionResponse)
async def obtener_cotizacion(
    cotizacion_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Obtiene los detalles de una cotización específica. Solo si el usuario tiene acceso.
    
    - **cotizacion_id**: ID de la cotización (UUID)
    """
    try:
        # Validar que el ID sea un UUID válido
        cotizacion_id_str = str(UUID(cotizacion_id))  # Convertir a string para SQLite
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ID de cotización inválido"
        )
    
    cotizacion = db.query(Cotizacion).filter(
        Cotizacion.id == cotizacion_id_str  # Usar string para SQLite
    ).first()
    
    if not cotizacion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cotización no encontrada"
        )
    
    # Verificar que el usuario tiene acceso a esta cotización
    user_id_str = str(UUID(current_user["user_id"]))  # Convertir a string para SQLite
    rol = current_user["rol"]
    
    if rol == "solicitante" and cotizacion.solicitante_id != user_id_str:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a esta cotización"
        )
    
    # Importador solo puede ver si es dirigida a él o es abierta
    if rol == "importador" and cotizacion.importador_id != user_id_str and cotizacion.modalidad != "abierta":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a esta cotización"
        )
    
    return cotizacion

@router.post("/", response_model=CotizacionResponse, status_code=status.HTTP_201_CREATED)
async def crear_cotizacion(
    cotizacion_data: CotizacionCreate,
    current_user: dict = Depends(require_rol("solicitante")),
    db: Session = Depends(get_db)
):
    """
    Crea una nueva cotización. Solo los solicitantes pueden crear cotizaciones.
    
    - **modalidad**: "dirigida" o "abierta"
    - **importador_id**: Solo para modalidad dirigida (opcional para abierta)
    - **pais_importacion**: País desde donde se importa
    - **nombre_producto**: Nombre del producto a importar
    - **descripcion_cliente**: Descripción detallada del producto
    - **linea_producto**: Categoría/línea del producto
    - **tipo_calidad**: Tipo de calidad ("economica", "estandar", "premium")
    - **cantidad_minima**: Cantidad mínima a importar
    - **incoterm**: Incoterm acordado (FOB, CIF, etc.)
    """
    from uuid import uuid4
    
    user_id_str = str(UUID(current_user["user_id"]))  # Convertir a string para SQLite
    
    # Validar modalidad dirigida
    if cotizacion_data.modalidad == "dirigida" and not cotizacion_data.importador_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La modalidad dirigida requiere un importador_id"
        )
    
    # Validar que el importador exista si es dirigida
    if cotizacion_data.modalidad == "dirigida" and cotizacion_data.importador_id:
        try:
            importador_id_str = str(UUID(cotizacion_data.importador_id))  # Convertir a string para SQLite
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ID de importador inválido"
            )
        
        from models.importador import Importador
        importador = db.query(Importador).filter(
            Importador.id == importador_id_str,  # Usar string para SQLite
            Importador.estado == "activo"
        ).first()
        
        if not importador:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Importador no encontrado o inactivo"
            )
    
    # Crear nueva cotización - usar el importador_id como string directamente
    nuevo_cotizacion = Cotizacion(
        id=str(uuid4()),  # Convertir a string para SQLite
        solicitante_id=user_id_str,
        importador_id=cotizacion_data.importador_id if cotizacion_data.importador_id else None,
        modalidad=cotizacion_data.modalidad,
        foto_producto=cotizacion_data.foto_producto,
        pais_importacion=cotizacion_data.pais_importacion,
        nivel_personalizacion=cotizacion_data.nivel_personalizacion,
        nombre_producto=cotizacion_data.nombre_producto,
        descripcion_cliente=cotizacion_data.descripcion_cliente,
        link_referencia=cotizacion_data.link_referencia,
        linea_producto=cotizacion_data.linea_producto,
        tipo_calidad=cotizacion_data.tipo_calidad,
        modalidad_importacion=cotizacion_data.modalidad_importacion,
        cantidad_minima=cotizacion_data.cantidad_minima,
        precio_objetivo_usd=cotizacion_data.precio_objetivo_usd,
        incoterm=cotizacion_data.incoterm,
        notas_adicionales=cotizacion_data.notas_adicionales,
        estado="dirigida" if cotizacion_data.modalidad == "dirigida" else "abierta"
    )
    
    db.add(nuevo_cotizacion)
    db.commit()
    db.refresh(nuevo_cotizacion)
    
    # Si es cotización abierta, ejecutar el motor de matching (después del commit para tener ID)
    if cotizacion_data.modalidad == "abierta":
        from services.matching_service import matching_cotizacion_abierta as mc
        mc(
            str(nuevo_cotizacion.id),
            nuevo_cotizacion.pais_importacion,
            nuevo_cotizacion.linea_producto,
            db
        )
    
    return nuevo_cotizacion

# ==================== Endpoints de Propuestas (Tarea 2.1) ====================

@propuestas_router.post("/", response_model=PropuestaResponse, status_code=status.HTTP_201_CREATED)
async def enviar_propuesta(
    propuesta: PropuestaCreate,
    current_user: dict = Depends(require_rol("importador")),
    db: Session = Depends(get_db)
):
    """
    Enviar una propuesta a una cotización abierta. Solo los importadores pueden enviar propuestas.
    
    - **cotizacion_id**: ID de la cotización a la que responde
    - **precio_ofrecido_usd**: Precio ofrecido por el importador
    - **tiempo_estimado_entrega**: Tiempo estimado (ej: "45 días")
    - **incoterm**: Incoterm propuesto (FOB, CIF, EXW, DDP, etc.)
    - **condiciones_adicionales**: Condiciones adicionales (opcional)
    
    Validaciones:
    1. La cotización debe existir y estar en estado "abierta" o "propuestas_recibidas"
    2. El importador debe estar en la lista de matching para esta cotización
    3. El importador no puede enviar más de una propuesta por cotización
    """
    from uuid import UUID as PyUUID, uuid4
    
    user_id_str = str(PyUUID(current_user["user_id"]))  # Convertir a string para SQLite
    
    # 1. Verificar que la cotización existe y es abierta o tiene propuestas recibidas
    try:
        cotizacion_id_str = str(PyUUID(propuesta.cotizacion_id))  # Validar UUID
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ID de cotización inválido"
        )
    
    cotizacion = db.query(Cotizacion).filter(
        Cotizacion.id == cotizacion_id_str,
        Cotizacion.estado.in_(["abierta", "propuestas_recibidas"])
    ).first()
    
    if not cotizacion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cotización no encontrada o no está abierta a propuestas"
        )
    
    # 2. Verificar que el importador está en la lista de matching para esta cotización (Redis).
    # Fail-closed: si Redis no está disponible no podemos verificar la autorización,
    # así que se rechaza la solicitud en lugar de dejarla pasar sin control.
    if config.redis_client:
        try:
            importadores_matching = config.redis_client.hgetall(f"cotizacion_abierta:{cotizacion_id_str}")
        except Exception:
            logger.warning("Redis no disponible al verificar matching de cotización %s", cotizacion_id_str)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Servicio de matching temporalmente no disponible, intenta de nuevo"
            )
        if user_id_str not in importadores_matching:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No autorizado para responder esta cotización (no está en la lista de matching)"
            )
    
    # 3. Verificar que el importador no ha enviado ya una propuesta a esta cotización
    propuesta_existente = db.query(Propuesta).filter(
        Propuesta.cotizacion_id == cotizacion_id_str,
        Propuesta.importador_id == user_id_str
    ).first()
    
    if propuesta_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya has enviado una propuesta a esta cotización"
        )
    
    # 4. Crear nueva propuesta en la base de datos
    nueva_propuesta = Propuesta(
        id=str(uuid4()),  # Convertir a string para SQLite
        cotizacion_id=cotizacion_id_str,
        importador_id=user_id_str,
        precio_ofrecido_usd=propuesta.precio_ofrecido_usd,
        tiempo_estimado_entrega=propuesta.tiempo_estimado_entrega,
        incoterm=propuesta.incoterm,
        condiciones_adicionales=propuesta.condiciones_adicionales,
        estado=EstadoPropuesta.pendiente
    )
    db.add(nueva_propuesta)
    
    # 5. Actualizar estado de la cotización a "propuestas_recibidas" si es la primera propuesta
    if cotizacion.estado == "abierta":
        cotizacion.estado = EstadoCotizacion.propuestas_recibidas
    
    # 6. Confirmar en una única transacción atómica (ACID). La restricción única
    # unique_propuesta_cotizacion_importador es la garantía real contra condiciones
    # de carrera cuando dos solicitudes concurrentes pasan el check del paso 3 a la vez.
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya has enviado una propuesta a esta cotización"
        )
    db.refresh(nueva_propuesta)
    
    # 7. Actualizar estado en Redis (best-effort, después de confirmar en la base de datos).
    # Si Redis falla aquí ya no se debe revertir la propuesta, que ya quedó persistida en MySQL/SQLite.
    if config.redis_client:
        try:
            config.redis_client.hset(f"cotizacion_abierta:{cotizacion_id_str}", user_id_str, "respondido")
            config.redis_client.incr(f"cotizacion_abierta:{cotizacion_id_str}:respuestas")
        except Exception:
            logger.warning("No se pudo actualizar el estado de matching en Redis para %s", cotizacion_id_str)
    
    return PropuestaResponse(
        id=str(nueva_propuesta.id),
        cotizacion_id=propuesta.cotizacion_id,
        importador_id=user_id_str,
        precio_ofrecido_usd=nueva_propuesta.precio_ofrecido_usd,
        tiempo_estimado_entrega=nueva_propuesta.tiempo_estimado_entrega,
        incoterm=nueva_propuesta.incoterm,
        condiciones_adicionales=nueva_propuesta.condiciones_adicionales,
        estado=nueva_propuesta.estado.value if isinstance(nueva_propuesta.estado, EstadoPropuesta) else nueva_propuesta.estado
    )

@router.get("/{cotizacion_id}/propuestas", response_model=List[PropuestaResponse])
async def listar_propuestas(
    cotizacion_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Listar todas las propuestas recibidas para una cotización. Solo el solicitante de la cotización puede verlas.
    
    - **cotizacion_id**: ID de la cotización (UUID)
    """
    from uuid import UUID as PyUUID
    
    # Verificar que el usuario es el solicitante de esta cotización
    user_id_str = str(PyUUID(current_user["user_id"]))  # Convertir a string para SQLite
    
    if current_user["rol"] != "solicitante":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado - Solo el solicitante puede ver las propuestas"
        )
    
    try:
        cotizacion_id_str = str(PyUUID(cotizacion_id))  # Validar UUID
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ID de cotización inválido"
        )
    
    # Verificar que el solicitante es el dueño de la cotización
    cotizacion = db.query(Cotizacion).filter(
        Cotizacion.id == cotizacion_id_str,
        Cotizacion.solicitante_id == user_id_str
    ).first()
    
    if not cotizacion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cotización no encontrada"
        )
    
    # Listar todas las propuestas para esta cotización
    propuestas = db.query(Propuesta).filter(
        Propuesta.cotizacion_id == cotizacion_id_str
    ).order_by(Propuesta.fecha_envio.desc()).all()
    
    return [
        PropuestaResponse(
            id=str(p.id),
            cotizacion_id=p.cotizacion_id,
            importador_id=p.importador_id,
            precio_ofrecido_usd=p.precio_ofrecido_usd,
            tiempo_estimado_entrega=p.tiempo_estimado_entrega,
            incoterm=p.incoterm,
            condiciones_adicionales=p.condiciones_adicionales,
            estado=p.estado.value if isinstance(p.estado, EstadoPropuesta) else p.estado
        )
        for p in propuestas
    ]

@router.get("/{cotizacion_id}/matching-status", response_model=MatchingStatusResponse)
async def obtener_estado_matching(
    cotizacion_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("solicitante"))
):
    """
    Obtiene el estado de difusión de una cotización abierta a la red de importadores:
    cuántos importadores la recibieron, cuántos ya respondieron con una propuesta y
    cuáles siguen pendientes. Corresponde al wireframe "Panel de Propuestas Recibidas"
    (Pantalla 6), que muestra el contador "X de Y importadores respondieron" y la
    sección "Pendientes de Responder".

    Solo el solicitante dueño de la cotización puede consultar este estado, y solo
    aplica a cotizaciones en modalidad "abierta".
    """
    from uuid import UUID as PyUUID
    from services.matching_service import obtener_estado_matching_detallado

    user_id_str = str(PyUUID(current_user["user_id"]))  # Convertir a string para SQLite

    try:
        cotizacion_id_str = str(PyUUID(cotizacion_id))  # Validar UUID
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ID de cotización inválido"
        )

    cotizacion = db.query(Cotizacion).filter(
        Cotizacion.id == cotizacion_id_str,
        Cotizacion.solicitante_id == user_id_str
    ).first()

    if not cotizacion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cotización no encontrada"
        )

    if cotizacion.modalidad != "abierta":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El estado de matching solo aplica a cotizaciones en modalidad abierta"
        )

    estado_matching = obtener_estado_matching_detallado(cotizacion_id_str)

    importadores_pendientes = []
    if estado_matching["ids_pendientes"]:
        importadores = db.query(Importador).filter(
            Importador.id.in_(estado_matching["ids_pendientes"])
        ).all()
        importadores_pendientes = [
            ImportadorPendienteResponse(
                importador_id=str(importador.id),
                nombre_empresa=importador.nombre_empresa,
                logo_url=importador.logo_url
            )
            for importador in importadores
        ]

    return MatchingStatusResponse(
        total_matching=estado_matching["total_matching"],
        respondidos=estado_matching["respondidos"],
        pendientes=estado_matching["pendientes"],
        importadores_pendientes=importadores_pendientes
    )

@router.put("/{cotizacion_id}/propuestas/aceptar", response_model=CotizacionResponse)
async def aceptar_propuesta(
    cotizacion_id: str,
    solicitud: PropuestaAceptadaRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("solicitante"))
):
    """
    Aceptar una propuesta de un importador. Solo el solicitante puede aceptar propuestas.
    
    - **cotizacion_id**: ID de la cotización (UUID)
    - **importador_id**: ID del importador cuya propuesta se acepta
    
    Al aceptar una propuesta, la cotización cambia a estado "cotizacion_aceptada".
    """
    from uuid import UUID as PyUUID
    
    user_id_str = str(PyUUID(current_user["user_id"]))  # Convertir a string para SQLite
    
    try:
        cotizacion_id_str = str(PyUUID(cotizacion_id))  # Validar UUID
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ID de cotización inválido"
        )
    
    # Verificar que el solicitante es el dueño de la cotización
    cotizacion = db.query(Cotizacion).filter(
        Cotizacion.id == cotizacion_id_str,
        Cotizacion.solicitante_id == user_id_str
    ).first()
    
    if not cotizacion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cotización no encontrada"
        )
    
    # Verificar que la cotización está en estado "propuestas_recibidas"
    if cotizacion.estado != EstadoCotizacion.propuestas_recibidas.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cotización no tiene propuestas pendientes para aceptar"
        )
    
    # Verificar que la propuesta existe y es del importador indicado
    try:
        importador_id_str = str(PyUUID(solicitud.importador_id))  # Validar UUID
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ID de importador inválido"
        )
    
    propuesta = db.query(Propuesta).filter(
        Propuesta.cotizacion_id == cotizacion_id_str,
        Propuesta.importador_id == importador_id_str,
        Propuesta.estado == EstadoPropuesta.pendiente.value
    ).first()
    
    if not propuesta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propuesta no encontrada o ya fue aceptada/rechazada"
        )
    
    # Marcar la propuesta como aceptada
    propuesta.estado = EstadoPropuesta.aceptada
    
    # Rechazar automáticamente las demás propuestas pendientes para esta cotización
    otras_propuestas = db.query(Propuesta).filter(
        Propuesta.cotizacion_id == cotizacion_id_str,
        Propuesta.id != propuesta.id,
        Propuesta.estado == EstadoPropuesta.pendiente.value
    ).all()
    
    for p in otras_propuestas:
        p.estado = EstadoPropuesta.rechazada
    
    # Actualizar estado de la cotización a "cotizacion_aceptada"
    cotizacion.estado = EstadoCotizacion.cotizacion_aceptada
    
    db.commit()
    db.refresh(cotizacion)
    
    return cotizacion
