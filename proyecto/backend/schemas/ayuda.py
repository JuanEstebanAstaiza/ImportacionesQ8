from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ArticuloAyudaResponse(BaseModel):
    """Artículo tal como lo lee un usuario de la plataforma."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    titulo: str
    resumen: str
    contenido: Optional[str] = None
    categoria: str
    roles: Optional[List[str]] = None
    orden: int = 100
    publicado: bool = True
    vistas: int = 0
    votos_util: int = 0
    votos_inutil: int = 0
    fecha_actualizacion: Optional[datetime] = None


class ArticulosAyudaResponse(BaseModel):
    """Lo que necesita la pantalla de ayuda en una sola llamada."""
    articulos: List[ArticuloAyudaResponse]
    categorias: List[str]
    total: int


class ArticuloAyudaCreate(BaseModel):
    titulo: str = Field(..., min_length=5, max_length=200)
    resumen: str = Field(..., min_length=10, max_length=400)
    contenido: Optional[str] = Field(None, max_length=20000)
    categoria: str = Field(..., min_length=2, max_length=60)
    # Vacío o ausente significa "sirve a todos los perfiles".
    roles: Optional[List[str]] = None
    orden: int = Field(100, ge=0, le=1000)
    publicado: bool = True


class ArticuloAyudaUpdate(BaseModel):
    """Todo opcional: se edita solo lo que cambia."""
    titulo: Optional[str] = Field(None, min_length=5, max_length=200)
    resumen: Optional[str] = Field(None, min_length=10, max_length=400)
    contenido: Optional[str] = Field(None, max_length=20000)
    categoria: Optional[str] = Field(None, min_length=2, max_length=60)
    roles: Optional[List[str]] = None
    orden: Optional[int] = Field(None, ge=0, le=1000)
    publicado: Optional[bool] = None


class VotoArticuloRequest(BaseModel):
    """Si el artículo resolvió la duda o no."""
    util: bool
