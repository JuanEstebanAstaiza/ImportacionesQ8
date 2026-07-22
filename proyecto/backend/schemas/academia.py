from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime


class CursoCreate(BaseModel):
    titulo: str = Field(..., min_length=3, max_length=255)
    descripcion: Optional[str] = None
    categoria: Optional[str] = Field(None, max_length=100, description="ej. importacion, productos_ganadores")
    precio_usd: float = Field(0.0, ge=0)
    imagen_url: Optional[str] = Field(None, max_length=500)


class CursoUpdate(BaseModel):
    titulo: Optional[str] = Field(None, min_length=3, max_length=255)
    descripcion: Optional[str] = None
    categoria: Optional[str] = Field(None, max_length=100)
    precio_usd: Optional[float] = Field(None, ge=0)
    imagen_url: Optional[str] = Field(None, max_length=500)
    estado: Optional[str] = Field(None, description="borrador | publicado | archivado")

    @field_validator("estado")
    @classmethod
    def validar_estado(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if v not in ("borrador", "publicado", "archivado"):
            raise ValueError("estado debe ser borrador, publicado o archivado")
        return v


class LeccionCreate(BaseModel):
    titulo: str = Field(..., min_length=1, max_length=255)
    descripcion: Optional[str] = None
    tipo: str = Field("video", description="video | texto | recurso")
    contenido_url: Optional[str] = Field(None, max_length=500)
    contenido_texto: Optional[str] = None
    orden: Optional[int] = Field(None, ge=1, description="Si se omite, se asigna al final")
    duracion_segundos: Optional[int] = Field(None, ge=0)

    @field_validator("tipo")
    @classmethod
    def validar_tipo(cls, v: str) -> str:
        if v not in ("video", "texto", "recurso"):
            raise ValueError("tipo debe ser video, texto o recurso")
        return v


class LeccionUpdate(BaseModel):
    titulo: Optional[str] = Field(None, min_length=1, max_length=255)
    descripcion: Optional[str] = None
    tipo: Optional[str] = None
    contenido_url: Optional[str] = Field(None, max_length=500)
    contenido_texto: Optional[str] = None
    orden: Optional[int] = Field(None, ge=1)
    duracion_segundos: Optional[int] = Field(None, ge=0)

    @field_validator("tipo")
    @classmethod
    def validar_tipo(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if v not in ("video", "texto", "recurso"):
            raise ValueError("tipo debe ser video, texto o recurso")
        return v


class LeccionResponse(BaseModel):
    id: str
    curso_id: str
    titulo: str
    descripcion: Optional[str] = None
    tipo: str
    contenido_url: Optional[str] = None
    contenido_texto: Optional[str] = None
    orden: int
    duracion_segundos: Optional[int] = None
    completada: Optional[bool] = None  # solo en vistas con progreso

    model_config = {"from_attributes": True}


class CursoResponse(BaseModel):
    id: str
    importador_id: str
    creado_por_usuario_id: str
    titulo: str
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    precio_usd: float
    imagen_url: Optional[str] = None
    estado: str
    total_lecciones: int = 0
    fecha_creacion: Optional[datetime] = None
    fecha_actualizacion: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CursoDetalleResponse(CursoResponse):
    lecciones: List[LeccionResponse] = []
    comprado: bool = False
    progreso_pct: Optional[float] = None
    lecciones_completadas: Optional[int] = None


class CompraCursoResponse(BaseModel):
    id: str
    curso_id: str
    comprador_id: str
    precio_pagado_usd: float
    estado: str
    wompi_payment_id: Optional[str] = None
    checkout_url: Optional[str] = None
    fecha_creacion: Optional[datetime] = None
    fecha_confirmacion: Optional[datetime] = None
    curso: Optional[CursoResponse] = None

    model_config = {"from_attributes": True}


class ProgresoCursoResponse(BaseModel):
    curso_id: str
    total_lecciones: int
    lecciones_completadas: int
    progreso_pct: float
    lecciones: List[LeccionResponse] = []
