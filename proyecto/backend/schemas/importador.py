from pydantic import BaseModel, Field
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
    fecha_registro: datetime

    model_config = {"from_attributes": True}
