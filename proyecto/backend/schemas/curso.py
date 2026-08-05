from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import Optional, List, Literal
from datetime import datetime

from utils.urls import canonicalize_resource_url


NivelCursoLiteral = Literal["Principiante", "Avanzado"]
TipoRecursoLiteral = Literal["archivo", "plantilla", "checklist", "guia"]

# Límites anti-DoS en payload de publicación
MAX_MODULOS = 30
MAX_LECCIONES_POR_MODULO = 50
MAX_RECURSOS_POR_LECCION = 20


def _validar_url_http(value: Optional[str], *, campo: str = "url") -> Optional[str]:
    """Acepta rutas del backend o URLs http(s) externas y las deja canónicas.

    Guarda `/documentos/archivos/<id>/descargar` en vez de una URL absoluta atada
    al host donde se publicó el curso, para que siga resolviendo desde localhost,
    Dev Tunnel o producción. Sigue bloqueando `javascript:`/`data:` y YouTube.
    """
    return canonicalize_resource_url(value, campo=campo)


class RecursoLeccionCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=255)
    url: str = Field(..., min_length=5, max_length=500)
    tipo: TipoRecursoLiteral = "archivo"

    @field_validator("url")
    @classmethod
    def url_segura(cls, v: str) -> str:
        return _validar_url_http(v, campo="url de recurso")  # type: ignore[return-value]


class LeccionCreate(BaseModel):
    titulo: str = Field(..., min_length=1, max_length=255)
    duracion: str = Field(default="10 min", max_length=30)
    video_url: str = Field(..., min_length=5, max_length=500)
    es_preview: bool = False
    recursos: List[RecursoLeccionCreate] = Field(default_factory=list, max_length=MAX_RECURSOS_POR_LECCION)

    @field_validator("video_url")
    @classmethod
    def video_url_segura(cls, v: str) -> str:
        return _validar_url_http(v, campo="video_url")  # type: ignore[return-value]


class ModuloCreate(BaseModel):
    titulo: str = Field(..., min_length=1, max_length=255)
    lecciones: List[LeccionCreate] = Field(default_factory=list, max_length=MAX_LECCIONES_POR_MODULO)

    @field_validator("lecciones")
    @classmethod
    def al_menos_una_leccion(cls, v: List[LeccionCreate]) -> List[LeccionCreate]:
        if not v:
            raise ValueError("Cada módulo debe tener al menos una lección")
        return v


class CursoCreate(BaseModel):
    titulo: str = Field(..., min_length=3, max_length=255)
    descripcion: str = Field(default="", max_length=5000)
    portada_url: Optional[str] = Field(default=None, max_length=500)
    precio: float = Field(default=0.0, ge=0, le=1_000_000)
    nivel: NivelCursoLiteral = "Principiante"
    categoria: str = Field(default="General", min_length=1, max_length=120)
    modulos: List[ModuloCreate] = Field(..., min_length=1, max_length=MAX_MODULOS)

    @field_validator("portada_url")
    @classmethod
    def portada_segura(cls, v: Optional[str]) -> Optional[str]:
        return _validar_url_http(v, campo="portada_url")

    @field_validator("modulos")
    @classmethod
    def al_menos_un_modulo(cls, v: List[ModuloCreate]) -> List[ModuloCreate]:
        if not v:
            raise ValueError("El curso debe tener al menos un módulo")
        return v


class CursoUpdate(BaseModel):
    titulo: Optional[str] = Field(default=None, min_length=3, max_length=255)
    descripcion: Optional[str] = Field(default=None, max_length=5000)
    portada_url: Optional[str] = Field(default=None, max_length=500)
    precio: Optional[float] = Field(default=None, ge=0, le=1_000_000)
    nivel: Optional[NivelCursoLiteral] = None
    categoria: Optional[str] = Field(default=None, min_length=1, max_length=120)
    estado: Optional[Literal["borrador", "publicado", "archivado"]] = None

    @field_validator("portada_url")
    @classmethod
    def portada_segura_update(cls, v: Optional[str]) -> Optional[str]:
        return _validar_url_http(v, campo="portada_url")


class RecursoLeccionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    nombre: str
    url: str
    tipo: str


class LeccionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    titulo: str
    duracion: str
    video_url: str
    es_preview: bool = False
    orden: int = 0
    recursos: List[RecursoLeccionResponse] = Field(default_factory=list)


class ModuloResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    titulo: str
    orden: int = 0
    lecciones: List[LeccionResponse] = Field(default_factory=list)


class CursoListItem(BaseModel):
    """Item del catálogo público (sin temario completo)."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    titulo: str
    descripcion: str
    portada_url: Optional[str] = None
    precio: float
    nivel: str
    categoria: str
    importador_id: str
    importadora_nombre: Optional[str] = None
    rating: float
    estudiantes_count: int
    estado: str
    fecha_creacion: Optional[datetime] = None


class CursoDetailResponse(CursoListItem):
    """Detalle con temario y módulos."""
    modulos: List[ModuloResponse] = Field(default_factory=list)
    comprado: bool = False
    lecciones_completadas: List[str] = Field(default_factory=list)
    progreso_pct: float = 0.0


class CompraCursoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    curso_id: str
    usuario_id: str
    precio_pagado: float
    fecha_compra: datetime
    curso: Optional[CursoListItem] = None


class ProgresoLeccionRequest(BaseModel):
    completada: bool = True


class ProgresoLeccionResponse(BaseModel):
    curso_id: str
    leccion_id: str
    completada: bool
    lecciones_completadas: List[str]
    total_lecciones: int
    progreso_pct: float
    fecha_completado: Optional[datetime] = None
