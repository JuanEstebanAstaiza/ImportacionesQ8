from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime

class ImportadorCreate(BaseModel):
    nombre_empresa: str = Field(..., min_length=1, description="Nombre de la empresa importadora")
    logo_url: Optional[str] = None
    especialidad_producto: List[str] = Field(..., description="Categorías de producto (ej: ['Textiles', 'Electrónica'])")
    paises_origen: List[str] = Field(..., description="Países de origen (ej: ['China', 'Vietnam'])")
    calificacion_promedio: float = 0.0
    tiempo_respuesta_promedio: str = Field(..., min_length=1, description="Tiempo promedio de respuesta (ej: '24h')")
    capacidad_volumen: Optional[int] = None

class ImportadorResponse(BaseModel):
    id: str
    nombre_empresa: str
    logo_url: Optional[str]
    especialidad_producto: List[str]
    paises_origen: List[str]
    calificacion_promedio: float
    tiempo_respuesta_promedio: str
    capacidad_volumen: Optional[int]
    estado: str  # "activo" o "inactivo"
    solo_cotizaciones_directas: bool = False
    fecha_registro: datetime

    model_config = {"from_attributes": True}

class ImportadorUpdate(BaseModel):
    """Autoservicio de personalización del perfil de la empresa (Fase 2)."""
    nombre_empresa: Optional[str] = Field(None, min_length=1)
    logo_url: Optional[str] = None
    especialidad_producto: Optional[List[str]] = None
    paises_origen: Optional[List[str]] = None
    tiempo_respuesta_promedio: Optional[str] = Field(None, min_length=1)
    capacidad_volumen: Optional[int] = None
    solo_cotizaciones_directas: Optional[bool] = None

class AdminCrearImportadorRequest(BaseModel):
    """El admin crea la empresa Y la cuenta dueña ('rol=importador') en un solo paso."""
    nombre_empresa: str = Field(..., min_length=1)
    logo_url: Optional[str] = None
    especialidad_producto: List[str] = Field(...)
    paises_origen: List[str] = Field(...)
    calificacion_promedio: float = 0.0
    tiempo_respuesta_promedio: str = Field(..., min_length=1)
    capacidad_volumen: Optional[int] = None
    solo_cotizaciones_directas: bool = False
    email_dueño: EmailStr = Field(..., description="Email de la cuenta dueña de la empresa")
    password_dueño: str = Field(..., min_length=9, description="Contraseña inicial de la cuenta dueña")
    nombre_dueño: Optional[str] = None

class AdminCrearImportadorResponse(BaseModel):
    importador: ImportadorResponse
    usuario_dueño_id: str
    email_dueño: str
