from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from uuid import UUID
import json

from schemas.importador import ImportadorCreate, ImportadorResponse
from models.importador import Importador
from utils.dependencies import get_db, require_rol, get_current_user

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