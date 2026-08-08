from datetime import datetime
from typing import Dict, Optional

from pydantic import BaseModel, Field, field_validator


class ResenaCreate(BaseModel):
    """Reseña que escribe el solicitante sobre la empresa que le atendió."""

    orden_id: str = Field(..., description="Orden que da derecho a opinar: solo se reseña lo que se importó")
    calificacion: int = Field(..., ge=1, le=5, description="Valoración global, de 1 a 5 estrellas")
    comentario: Optional[str] = Field(
        None,
        max_length=2000,
        description="Qué tal fue la experiencia. Opcional, pero es lo que de verdad le sirve al siguiente cliente.",
    )
    puntualidad: Optional[int] = Field(None, ge=1, le=5)
    calidad_producto: Optional[int] = Field(None, ge=1, le=5)
    comunicacion: Optional[int] = Field(None, ge=1, le=5)

    @field_validator("comentario")
    @classmethod
    def comentario_no_vacio(cls, v: Optional[str]) -> Optional[str]:
        """Un comentario en blanco es lo mismo que no dejarlo: se normaliza a None
        para no llenar la ficha de tarjetas vacías."""
        if v is None:
            return None
        limpio = v.strip()
        return limpio or None


class ResenaUpdate(BaseModel):
    calificacion: Optional[int] = Field(None, ge=1, le=5)
    comentario: Optional[str] = Field(None, max_length=2000)
    puntualidad: Optional[int] = Field(None, ge=1, le=5)
    calidad_producto: Optional[int] = Field(None, ge=1, le=5)
    comunicacion: Optional[int] = Field(None, ge=1, le=5)


class RespuestaEmpresaRequest(BaseModel):
    """Derecho de réplica de la empresa reseñada."""

    respuesta: str = Field(..., min_length=1, max_length=2000)


class OcultarResenaRequest(BaseModel):
    """Moderación: se oculta, no se borra, para no perder la trazabilidad."""

    visible: bool = True
    motivo: Optional[str] = Field(None, max_length=500)


class ResenaResponse(BaseModel):
    id: str
    importador_id: str
    orden_id: str
    calificacion: int
    comentario: Optional[str] = None
    puntualidad: Optional[int] = None
    calidad_producto: Optional[int] = None
    comunicacion: Optional[int] = None
    respuesta_empresa: Optional[str] = None
    fecha_respuesta: Optional[datetime] = None
    visible: bool = True
    # Nombre de pila de quien la escribió. No se expone el correo ni el id: la
    # reseña es pública y no hace falta identificar a la persona para que sirva.
    autor_nombre: Optional[str] = None
    fecha_creacion: datetime

    model_config = {"from_attributes": True}


class ResumenResenasResponse(BaseModel):
    """Lo que se pinta en la cabecera de la ficha pública."""

    promedio: float = 0.0
    total: int = 0
    # {"5": 12, "4": 3, ...} — el reparto por estrellas.
    reparto: Dict[int, int] = Field(default_factory=dict)
    puntualidad: Optional[float] = None
    calidad_producto: Optional[float] = None
    comunicacion: Optional[float] = None


class OrdenResenableItem(BaseModel):
    """Orden ya entregada que todavía no tiene reseña."""

    orden_id: str
    importador_id: str
    nombre_empresa: str
    producto: str
    fecha_creacion: datetime
