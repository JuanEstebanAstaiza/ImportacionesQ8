"""Entradas de la API del módulo. Las salidas son diccionarios (ver servicio.a_*)."""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

Condicion = Literal["nuevo", "devolucion", "empaque_abierto", "con_averias"]
Entrega = Literal["vendedor_despacha", "comprador_recoge"]
UnidadVenta = Literal["unidades", "juegos", "cajas", "paquetes", "pares", "kilos"]


class ActivacionEntrada(BaseModel):
    razon_social: str = Field(min_length=2, max_length=200)
    nit: str = Field(min_length=5, max_length=30)
    tipo_persona: Literal["juridica", "natural"] = "juridica"
    # Persona que atiende las operaciones; se muestra a la otra parte al reservar.
    contacto: str = Field(min_length=2, max_length=120)
    ciudad: str = Field(min_length=2, max_length=80)
    direccion: str = Field(min_length=4, max_length=200)
    telefono: str = Field(min_length=7, max_length=30)
    rut_archivo_id: str = Field(min_length=10, max_length=40)
    acepta_declaracion: bool

    @field_validator("acepta_declaracion")
    @classmethod
    def _debe_aceptar(cls, valor: bool) -> bool:
        if not valor:
            raise ValueError("Debes declarar que compras para tu actividad comercial")
        return valor


class LoteEntrada(BaseModel):
    nombre: str = Field(min_length=3, max_length=160)
    descripcion: str = Field(default="", max_length=2000)
    categoria: str = Field(min_length=2, max_length=60)
    unidades: int = Field(gt=0, le=10_000_000)
    unidad_venta: UnidadVenta = "unidades"
    condicion: Condicion
    detalle_condicion: Optional[str] = Field(default=None, max_length=500)
    fotos: List[str] = Field(default_factory=list)
    videos: List[str] = Field(default_factory=list)
    ficha_tecnica_id: Optional[str] = None
    precio_cop: int = Field(gt=0, le=100_000_000_000)
    ciudad: str = Field(min_length=2, max_length=80)
    entrega: Entrega
    requiere_registro_sanitario: bool = False
    registro_sanitario: Optional[str] = Field(default=None, max_length=80)
    dias_cierre: int = Field(ge=1, le=60)
    destacado: bool = False

    @model_validator(mode="after")
    def _coherencia(self) -> "LoteEntrada":
        if self.condicion != "nuevo" and not (self.detalle_condicion or "").strip():
            raise ValueError("Explica el estado de la mercancía")
        if self.requiere_registro_sanitario and not (self.registro_sanitario or "").strip():
            raise ValueError("Escribe el número de registro o notificación sanitaria INVIMA")
        if len(set(self.fotos)) != len(self.fotos) or len(set(self.videos)) != len(self.videos):
            raise ValueError("Hay archivos repetidos")
        return self


class RechazoEntrada(BaseModel):
    motivos: List[str] = Field(min_length=1, max_length=10)
    nota: Optional[str] = Field(default=None, max_length=1000)


class MensajeEntrada(BaseModel):
    contenido: str = Field(min_length=1, max_length=2000)

    @field_validator("contenido")
    @classmethod
    def _sin_vacio(cls, valor: str) -> str:
        if not valor.strip():
            raise ValueError("El mensaje está vacío")
        return valor.strip()


class AdjuntoEntrada(BaseModel):
    archivo_id: str = Field(min_length=10, max_length=40)


class MotivoEntrada(BaseModel):
    motivo: Optional[str] = Field(default=None, max_length=500)


class DespublicarEntrada(BaseModel):
    motivo: str = Field(min_length=5, max_length=500)


class DestacarEntrada(BaseModel):
    destacado: bool


class SuspensionEntrada(BaseModel):
    suspendida: bool
    motivo: Optional[str] = Field(default=None, max_length=500)


class ParametrosEntrada(BaseModel):
    dias_max_cierre: Optional[int] = None
    horas_para_confirmar: Optional[int] = None
    fotos_min: Optional[int] = None
    fotos_max: Optional[int] = None
    videos_max: Optional[int] = None
    mb_max_foto: Optional[int] = None
    mb_max_video: Optional[int] = None
    mb_max_documento: Optional[int] = None
    categorias: Optional[List[str]] = None
    motivos_rechazo: Optional[List[str]] = None
    checklist_revision: Optional[List[str]] = None
