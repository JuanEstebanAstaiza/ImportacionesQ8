from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from utils.urls import canonicalize_resource_url


class CertificacionBase(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=120)
    descripcion: str = Field(default="", max_length=2000)
    logo_url: Optional[str] = Field(default=None, max_length=500)
    # Peso en el algoritmo de orden del catálogo. Se acota para que un sello no
    # pueda monopolizar la portada por un cero de más al teclearlo.
    peso_publicidad: float = Field(default=0.0, ge=0, le=1000)
    activa: bool = True

    @field_validator("logo_url")
    @classmethod
    def logo_seguro(cls, v: Optional[str]) -> Optional[str]:
        return canonicalize_resource_url(v, campo="logo_url")


class CertificacionCreate(CertificacionBase):
    pass


class CertificacionUpdate(BaseModel):
    nombre: Optional[str] = Field(default=None, min_length=2, max_length=120)
    descripcion: Optional[str] = Field(default=None, max_length=2000)
    logo_url: Optional[str] = Field(default=None, max_length=500)
    peso_publicidad: Optional[float] = Field(default=None, ge=0, le=1000)
    activa: Optional[bool] = None

    @field_validator("logo_url")
    @classmethod
    def logo_seguro(cls, v: Optional[str]) -> Optional[str]:
        return canonicalize_resource_url(v, campo="logo_url")


class CertificacionResponse(CertificacionBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    fecha_creacion: Optional[datetime] = None
    # Cuántas empresas la tienen vigente: contexto para el admin al ajustar pesos.
    empresas_certificadas: int = 0


class CertificacionOtorgadaResponse(BaseModel):
    """Sello vigente de una empresa, tal como lo ve el solicitante."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    certificacion_id: str
    nombre: str
    descripcion: str = ""
    logo_url: Optional[str] = None
    peso_publicidad: float = 0.0
    fecha_otorgada: Optional[datetime] = None


class OtorgarCertificacionRequest(BaseModel):
    certificacion_id: str
    notas: Optional[str] = Field(default=None, max_length=1000)


class CertificacionesDeEmpresaResponse(BaseModel):
    importador_id: str
    puntaje_publicidad: float = 0.0
    certificaciones: List[CertificacionOtorgadaResponse] = Field(default_factory=list)
