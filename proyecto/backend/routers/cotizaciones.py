from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from typing import List, Optional
from uuid import UUID

from schemas.cotizacion import CotizacionCreate, CotizacionResponse
from models.cotizacion import Cotizacion
from utils.dependencies import get_db, get_current_user, require_rol

# Importar motor de matching (después de los routers para evitar circular imports)
matching_cotizacion_abierta = None

def json_contains_column(column, value):
    """Helper para buscar en columnas JSON - compatible con MySQL y SQLite"""
    return column.like(f'%"{value}"%')

router = APIRouter(prefix="/cotizaciones", tags=["Cotizaciones"])

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
        importador_id = current_user.get("importador_id")  # Se puede agregar en el token
        if not importador_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No se encontró el ID del importador en el token"
            )
        
        importador_id_str = str(UUID(importador_id))  # Convertir a string para SQLite
        
        # Importador ve cotizaciones dirigidas a su empresa + abiertas que le aplican
        cotizaciones = db.query(Cotizacion).filter(
            or_(
                Cotizacion.importador_id == importador_id_str,  # Dirigidas
                and_(
                    Cotizacion.modalidad == "abierta",
                    json_contains_column(Cotizacion.pais_importacion, importador_id)  # Simplificado para MVP
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
    
    # Importador solo puede ver si es dirigida a su empresa o es abierta que le aplica
    if rol == "importador":
        importador_id = current_user.get("importador_id")
        if not importador_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No se encontró el ID del importador en el token"
            )
        
        importador_id_str = str(UUID(importador_id))  # Convertir a string para SQLite
        if cotizacion.importador_id != importador_id_str and cotizacion.modalidad != "abierta":
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