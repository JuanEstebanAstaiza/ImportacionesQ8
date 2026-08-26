from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Any, Dict, List, Optional
from datetime import datetime

from schemas.certificacion import CertificacionOtorgadaResponse
from utils.shipping_mark import LONGITUD_MAX_PREFIJO, normalizar_segmento
from utils.urls import canonicalize_resource_url

# Claves de `perfil_publico` que guardan imágenes y se normalizan igual que
# `logo_url`: si quedaran como URL absoluta al host donde se editó el perfil,
# dejarían de resolver desde otro entorno (Dev Tunnel, producción).
CLAVES_IMAGEN_PERFIL = ("banner_url", "banner")

# El alta de empresas usa `AdminCrearImportadorRequest` (empresa + cuenta dueño).
# No existe un esquema de "crear solo la ficha": ese camino dejaba importadoras
# sin representante legal y por eso no se expone.

class ImportadorResponse(BaseModel):
    id: str
    nombre_empresa: str
    logo_url: Optional[str]
    # Sellos que la plataforma le otorgó y su peso agregado. `puntaje_publicidad`
    # es lo que ordena el catálogo del solicitante.
    certificaciones: List["CertificacionOtorgadaResponse"] = Field(default_factory=list)
    puntaje_publicidad: float = 0.0
    especialidad_producto: List[str]
    paises_origen: List[str]
    calificacion_promedio: float
    tiempo_respuesta_promedio: str
    capacidad_volumen: Optional[int]
    perfil_publico: Optional[Dict[str, Any]] = None
    estado: str  # "activo" o "inactivo"
    solo_cotizaciones_directas: bool = False
    verificado: bool = False
    # Prefijo de la empresa en el shipping mark (ej. "ctl"). Es público a
    # propósito: el solicitante lo ve al elegir empresa y así entiende cómo
    # quedará rotulada su carga antes de pedir la cotización.
    shipping_mark_prefijo: Optional[str] = None
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
    perfil_publico: Optional[Dict[str, Any]] = None
    solo_cotizaciones_directas: Optional[bool] = None
    shipping_mark_prefijo: Optional[str] = Field(
        None,
        max_length=LONGITUD_MAX_PREFIJO,
        description="Prefijo de la empresa en el shipping mark (ej. 'ctl'). Cadena vacía para quitarlo.",
    )

    @field_validator("shipping_mark_prefijo")
    @classmethod
    def prefijo_normalizado(cls, v: Optional[str]) -> Optional[str]:
        """El prefijo sí se guarda ya normalizado: es un dato de la empresa que
        se repite en todos sus embarques, y conviene que sea el mismo texto que
        acaba impreso en la caja. El sufijo del cliente, en cambio, se conserva
        tal cual lo escribió para poder mostrárselo."""
        if v is None:
            return None
        if not v.strip():
            return None  # cadena vacía = quitar el prefijo
        normalizado = normalizar_segmento(v)
        if not normalizado:
            raise ValueError("El prefijo del shipping mark debe contener al menos una letra o un número")
        return normalizado

    @field_validator("logo_url")
    @classmethod
    def logo_seguro(cls, v: Optional[str]) -> Optional[str]:
        return canonicalize_resource_url(v, campo="logo_url")

    @field_validator("perfil_publico")
    @classmethod
    def imagenes_perfil_seguras(cls, v: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not v:
            return v
        limpio = dict(v)
        for clave in CLAVES_IMAGEN_PERFIL:
            valor = limpio.get(clave)
            if isinstance(valor, str) and valor.strip():
                limpio[clave] = canonicalize_resource_url(valor, campo=clave)
        return limpio

class AdminCrearImportadorRequest(BaseModel):
    """El admin crea la empresa Y la cuenta dueña ('rol=importador') en un solo paso."""
    nombre_empresa: str = Field(..., min_length=1)
    logo_url: Optional[str] = None
    especialidad_producto: List[str] = Field(...)
    paises_origen: List[str] = Field(...)
    calificacion_promedio: float = 0.0
    tiempo_respuesta_promedio: str = Field(..., min_length=1)
    capacidad_volumen: Optional[int] = None
    perfil_publico: Optional[Dict[str, Any]] = None
    solo_cotizaciones_directas: bool = False
    shipping_mark_prefijo: Optional[str] = Field(
        None,
        max_length=LONGITUD_MAX_PREFIJO,
        description="Prefijo de la empresa en el shipping mark (ej. 'ctl'). La empresa puede cambiarlo después.",
    )
    email_dueño: EmailStr = Field(..., description="Email de la cuenta dueña de la empresa")
    password_dueño: str = Field(..., min_length=9, description="Contraseña inicial de la cuenta dueña")
    nombre_dueño: Optional[str] = None

    @field_validator("shipping_mark_prefijo")
    @classmethod
    def prefijo_normalizado(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        normalizado = normalizar_segmento(v)
        if not normalizado:
            raise ValueError("El prefijo del shipping mark debe contener al menos una letra o un número")
        return normalizado

class AdminCrearImportadorResponse(BaseModel):
    importador: ImportadorResponse
    usuario_dueño_id: str
    email_dueño: str
