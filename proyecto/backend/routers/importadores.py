import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from typing import List, Optional
from uuid import UUID
import json

import config
from schemas.importador import ImportadorCreate, ImportadorResponse
from models.importador import Importador
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.propuesta import Propuesta, EstadoPropuesta
from utils.dependencies import get_db, require_rol, get_current_user

logger = logging.getLogger("importacionesq8")

router = APIRouter(prefix="/importadores", tags=["Importadores"])

def json_contains_column(column, value):
    """Helper para buscar en columnas JSON - compatible con MySQL y SQLite
    
    En MySQL usa json_contains. En SQLite usa LIKE porque no tiene json_contains.
    """
    # Usar LIKE para buscar el valor dentro del JSON (compatible con ambos)
    return column.like(f'%"{value}"%')

@router.get("/", response_model=List[ImportadorResponse])
async def listar_importadores(
    especialidad: Optional[str] = Query(None, description="Filtrar por especialidad de producto"),
    pais: Optional[str] = Query(None, description="Filtrar por país de origen"),
    db: Session = Depends(get_db)
):
    """
    Lista todos los importadores activos con filtros opcionales.
    
    - **especialidad**: Filtrar por especialidad de producto (ej: "Textiles")
    - **pais**: Filtrar por país de origen (ej: "China")
    """
    query = db.query(Importador).filter(Importador.estado == "activo")
    
    if especialidad:
        # Buscar en JSON usando LIKE (compatible con MySQL y SQLite)
        query = query.filter(json_contains_column(Importador.especialidad_producto, especialidad))
    
    if pais:
        query = query.filter(json_contains_column(Importador.paises_origen, pais))
    
    importadores = query.all()
    return importadores

@router.get("/{importador_id}", response_model=ImportadorResponse)
async def obtener_importador(
    importador_id: str,
    db: Session = Depends(get_db)
):
    """
    Obtiene los detalles de un importador específico.
    
    - **importador_id**: ID del importador (UUID)
    """
    try:
        # Validar que el ID sea un UUID válido
        uuid_obj = UUID(importador_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ID de importador inválido"
        )
    
    importador = db.query(Importador).filter(
        Importador.id == str(uuid_obj),  # Convertir a string para SQLite
        Importador.estado == "activo"
    ).first()
    
    if not importador:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Importador no encontrado"
        )
    
    return importador

@router.post("/", response_model=ImportadorResponse, status_code=status.HTTP_201_CREATED)
async def crear_importador(
    importador_data: ImportadorCreate,
    current_user: dict = Depends(require_rol("admin")),
    db: Session = Depends(get_db)
):
    """
    Crea un nuevo importador en el sistema. Solo administradores pueden crear importadores.
    
    - **nombre_empresa**: Nombre de la empresa importadora
    - **logo_url**: URL del logo (opcional)
    - **especialidad_producto**: Lista de categorías de producto
    - **paises_origen**: Lista de países de origen
    - **tiempo_respuesta_promedio**: Tiempo promedio de respuesta (ej: "24h")
    - **calificacion_promedio**: Calificación promedio (default: 0.0)
    - **capacidad_volumen**: Capacidad máxima de volumen por pedido (opcional)
    """
    from uuid import uuid4
    
    nuevo_importador = Importador(
        id=str(uuid4()),  # Convertir a string para SQLite
        nombre_empresa=importador_data.nombre_empresa,
        logo_url=importador_data.logo_url,
        especialidad_producto=importador_data.especialidad_producto,
        paises_origen=importador_data.paises_origen,
        calificacion_promedio=importador_data.calificacion_promedio,
        tiempo_respuesta_promedio=importador_data.tiempo_respuesta_promedio,
        capacidad_volumen=importador_data.capacidad_volumen,
        estado="activo"
    )
    
    db.add(nuevo_importador)
    db.commit()
    db.refresh(nuevo_importador)
    
    return nuevo_importador

# ==================== Endpoints de la bandeja de solicitudes del importador (Tarea 2.5) ====================

@router.get("/{importador_id}/solicitudes-dirigidas", response_model=List[dict])
async def listar_solicitudes_dirigidas(
    importador_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador"))
):
    """
    Listar cotizaciones dirigidas al importador con estado "dirigida" o "propuestas_recibidas".
    
    - **importador_id**: ID del importador (UUID)
    """
    user_id_str = str(UUID(current_user["user_id"]))  # Convertir a string para SQLite
    
    try:
        importador_id_str = str(UUID(importador_id))  # Validar UUID
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ID de importador inválido"
        )
    
    # Verificar que el usuario es el importador indicado (evita IDOR entre importadores)
    if importador_id_str != user_id_str:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado - Solo puede ver sus propias solicitudes"
        )
    
    # Listar cotizaciones dirigidas al importador con estado "dirigida" o "propuestas_recibidas"
    cotizaciones = db.query(Cotizacion).filter(
        Cotizacion.importador_id == importador_id_str,
        Cotizacion.estado.in_([EstadoCotizacion.dirigida.value, EstadoCotizacion.propuestas_recibidas.value])
    ).order_by(Cotizacion.fecha_creacion.desc()).all()
    
    return [
        {
            "id": str(c.id),
            "solicitante_id": c.solicitante_id,
            "modalidad": c.modalidad,
            "nombre_producto": c.nombre_producto,
            "descripcion_cliente": c.descripcion_cliente,
            "cantidad_minima": c.cantidad_minima,
            "precio_objetivo_usd": c.precio_objetivo_usd,
            "incoterm": c.incoterm,
            "estado": c.estado.value if isinstance(c.estado, EstadoCotizacion) else c.estado,
            "fecha_creacion": c.fecha_creacion.isoformat() if hasattr(c.fecha_creacion, 'isoformat') else str(c.fecha_creacion),
            # Información de la propuesta si existe
            "propuesta_enviada": any(
                p.importador_id == importador_id_str and p.estado == EstadoPropuesta.pendiente.value
                for p in c.propuestas
            ) if hasattr(c, 'propuestas') else False
        }
        for c in cotizaciones
    ]

@router.get("/{importador_id}/solicitudes-abiertas", response_model=List[dict])
async def listar_solicitudes_abiertas(
    importador_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador"))
):
    """
    Listar cotizaciones abiertas que aplican al importador (usando el motor de matching).
    
    - **importador_id**: ID del importador (UUID)
    """
    user_id_str = str(UUID(current_user["user_id"]))  # Convertir a string para SQLite
    
    try:
        importador_id_str = str(UUID(importador_id))  # Validar UUID
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ID de importador inválido"
        )
    
    # Verificar que el usuario es el importador indicado (evita IDOR entre importadores)
    if importador_id_str != user_id_str:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado - Solo puede ver sus propias solicitudes"
        )
    
    # Listar cotizaciones abiertas que aplican al importador (estado "abierta" o "propuestas_recibidas")
    cotizaciones = db.query(Cotizacion).filter(
        Cotizacion.modalidad == "abierta",
        Cotizacion.estado.in_([EstadoCotizacion.abierta.value, EstadoCotizacion.propuestas_recibidas.value])
    ).order_by(Cotizacion.fecha_creacion.desc()).all()
    
    # Filtrar por matching real usando Redis: solo mostrar cotizaciones donde este
    # importador específico aparece en la lista de matching (país + categoría).
    # Si Redis no está disponible, se degrada a "sin resultados" en vez de un error 500.
    cotizaciones_matching = {}
    if config.redis_client:
        try:
            all_keys = config.redis_client.keys("cotizacion_abierta:*")
            for key in all_keys:
                # Ignorar claves auxiliares (":expiracion", ":respuestas")
                partes = key.split(":")
                if len(partes) != 2:
                    continue
                cid = partes[1]
                importadores_hash = config.redis_client.hgetall(key)
                cotizaciones_matching[cid] = list(importadores_hash.keys())
        except Exception:
            logger.warning("Redis no disponible al listar solicitudes abiertas para importador %s", importador_id_str)
    
    resultados = []
    for c in cotizaciones:
        # Verificar si este importador está en la lista de matching para esta cotización
        if config.redis_client and importador_id_str not in cotizaciones_matching.get(str(c.id), []):
            continue
        
        # Verificar si el importador ya envió una propuesta a esta cotización
        propuesta_enviada = any(
            p.importador_id == importador_id_str and p.estado == EstadoPropuesta.pendiente.value
            for p in c.propuestas
        ) if hasattr(c, 'propuestas') else False
        
        resultados.append({
            "id": str(c.id),
            "solicitante_id": c.solicitante_id,
            "modalidad": c.modalidad,
            "nombre_producto": c.nombre_producto,
            "descripcion_cliente": c.descripcion_cliente,
            "cantidad_minima": c.cantidad_minima,
            "precio_objetivo_usd": c.precio_objetivo_usd,
            "incoterm": c.incoterm,
            "estado": c.estado.value if isinstance(c.estado, EstadoCotizacion) else c.estado,
            "fecha_creacion": c.fecha_creacion.isoformat() if hasattr(c.fecha_creacion, 'isoformat') else str(c.fecha_creacion),
            "propuesta_enviada": propuesta_enviada
        })
    
    return resultados

@router.get("/{importador_id}/ordenes-activas", response_model=List[dict])
async def listar_ordenes_activas_importador(
    importador_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_rol("importador"))
):
    """
    Listar órdenes asignadas al importador con estado diferente a "entregado".
    
    - **importador_id**: ID del importador (UUID)
    """
    user_id_str = str(UUID(current_user["user_id"]))  # Convertir a string para SQLite
    
    try:
        importador_id_str = str(UUID(importador_id))  # Validar UUID
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ID de importador inválido"
        )
    
    # Verificar que el usuario es el importador indicado (evita IDOR entre importadores)
    if importador_id_str != user_id_str:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No autorizado - Solo puede ver sus propias órdenes"
        )
    
    from models.orden import Orden, EstadoOrden
    
    # Listar órdenes activas (estado diferente a "entregado")
    estados_activos = [e.value for e in EstadoOrden if e != EstadoOrden.entregado]
    ordenes = db.query(Orden).filter(
        Orden.importador_id == importador_id_str,
        Orden.estado.in_(estados_activos)
    ).order_by(Orden.fecha_creacion.desc()).all()
    
    return [
        {
            "id": str(o.id),
            "cotizacion_id": o.cotizacion_id,
            "solicitante_id": o.solicitante_id,
            "estado": o.estado.value if isinstance(o.estado, EstadoOrden) else o.estado,
            "precio_acordado_usd": o.precio_acordado_usd,
            "tiempo_estimado_entrega": o.tiempo_estimado_entrega,
            "fecha_creacion": o.fecha_creacion.isoformat() if hasattr(o.fecha_creacion, 'isoformat') else str(o.fecha_creacion),
            # Información de la cotización asociada
            "nombre_producto": o.cotizacion.nombre_producto if o.cotizacion else None,
            "cantidad_minima": o.cotizacion.cantidad_minima if o.cotizacion else None
        }
        for o in ordenes
    ]
