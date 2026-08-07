from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime

from utils.shipping_mark import LONGITUD_MAX_SUFIJO, normalizar_segmento

class ContactoAsignadoResponse(BaseModel):
    """Contacto de la empresa importadora a cargo de negociar una cotización
    (Semana 4 - Fase 7: navegación cruzada / contacto del asesor asignado)."""
    usuario_id: str
    nombre: Optional[str] = None
    foto_url: Optional[str] = None
    whatsapp: Optional[str] = None

    model_config = {"from_attributes": True}

class CotizacionCreate(BaseModel):
    modalidad: str = Field(..., description="Modalidad de cotización: 'dirigida' o 'abierta'")
    
    @field_validator("modalidad")
    @classmethod
    def validar_modalidad(cls, v):
        """Validar que la modalidad sea 'dirigida' o 'abierta'"""
        if v not in ("dirigida", "abierta"):
            raise ValueError(f"Modalidad inválida: '{v}'. Debe ser 'dirigida' o 'abierta'")
        return v
    
    @field_validator("tipo_calidad")
    @classmethod
    def validar_tipo_calidad(cls, v):
        """Validar que el tipo de calidad sea válido"""
        if v not in ("economica", "estandar", "premium"):
            raise ValueError(f"Tipo de calidad inválido: '{v}'. Debe ser 'economica', 'estandar' o 'premium'")
        return v
    
    importador_id: Optional[str] = None  # Solo para modalidad dirigida
    foto_producto: Optional[str] = None
    pais_importacion: str = Field(..., min_length=1, description="País desde donde se importa")
    nivel_personalizacion: Optional[str] = None
    nombre_producto: str = Field(..., min_length=1, max_length=255, description="Nombre del producto a importar")
    descripcion_cliente: str = Field(..., min_length=10, description="Descripción detallada del producto")
    link_referencia: Optional[str] = None
    linea_producto: str = Field(..., min_length=1, max_length=100, description="Categoría/línea del producto")
    tipo_calidad: str = Field(..., description="Tipo de calidad: 'economica', 'estandar' o 'premium'")
    modalidad_importacion: Optional[str] = None
    cantidad_minima: int = Field(..., ge=1, description="Cantidad mínima a importar")
    precio_objetivo_usd: Optional[float] = None
    incoterm: str = Field(..., min_length=1, max_length=50, description="Incoterm acordado (FOB, CIF, etc.)")
    notas_adicionales: Optional[str] = None
    shipping_mark_sufijo: Optional[str] = Field(
        None,
        max_length=LONGITUD_MAX_SUFIJO,
        description=(
            "Tu parte de la marca de embarque (ej. 'prendas control'). Se une al prefijo "
            "de la empresa importadora para rotular tus cajas: 'ctl-prendascontrol'."
        ),
    )
    campos_personalizados_valores: Optional[Dict[str, Any]] = Field(
        None, description="Valores de los campos personalizados del importador dirigido, si aplica: {campo_id: valor}"
    )

    @field_validator("shipping_mark_sufijo")
    @classmethod
    def sufijo_utilizable(cls, v: Optional[str]) -> Optional[str]:
        """Se guarda tal cual lo escribe el cliente, pero tiene que dejar algo
        rotulable: un sufijo de solo signos ("///") produciría un shipping mark
        vacío y es mejor rechazarlo aquí que descubrirlo en el puerto."""
        if v is None:
            return None
        if not v.strip():
            return None
        if not normalizar_segmento(v):
            raise ValueError(
                "El sufijo del shipping mark debe contener al menos una letra o un número"
            )
        return v.strip()

class CotizacionResponse(BaseModel):
    id: str
    solicitante_id: str
    importador_id: Optional[str]
    modalidad: str
    foto_producto: Optional[str]
    pais_importacion: str
    nivel_personalizacion: Optional[str]
    nombre_producto: str
    descripcion_cliente: str
    link_referencia: Optional[str]
    linea_producto: str
    tipo_calidad: str
    modalidad_importacion: Optional[str]
    cantidad_minima: int
    precio_objetivo_usd: Optional[float]
    incoterm: str
    notas_adicionales: Optional[str]
    shipping_mark_sufijo: Optional[str] = None
    # Marca de embarque ya compuesta ("ctl-prendascontrol"). Es None mientras no
    # se sepa qué empresa importará: en modalidad abierta, hasta que una gane.
    shipping_mark: Optional[str] = None
    campos_personalizados_valores: Optional[Dict[str, Any]] = None
    asesor_asignado_id: Optional[str] = None
    estado: str  # "creada", "dirigida", "abierta", etc.
    costo_creditos: Optional[float] = None
    cotizacion_origen_id: Optional[str] = None
    cancelada_por_error: Optional[str] = None
    motivo_cancelacion: Optional[str] = None
    # --- Navegación cruzada (Fase 7): saltar de la cotización al chat/contacto ---
    conversacion_id: Optional[str] = None
    contacto_asignado: Optional[ContactoAsignadoResponse] = None
    fecha_creacion: datetime
    fecha_actualizacion: datetime

    model_config = {"from_attributes": True}

# ==================== Propuesta Schemas ====================

class PropuestaCreate(BaseModel):
    cotizacion_id: str  # ID de la cotización a la que responde
    precio_ofrecido_usd: float = Field(..., gt=0, description="Precio ofrecido por el importador")
    tiempo_estimado_entrega: str = Field(..., min_length=1, max_length=100, description="Tiempo estimado (ej: '45 días')")
    incoterm: str = Field(..., min_length=1, max_length=50, description="Incoterm propuesto (FOB, CIF, EXW, DDP, etc.)")
    condiciones_adicionales: Optional[str] = None  # Condiciones adicionales

class PropuestaResponse(BaseModel):
    id: str
    cotizacion_id: str
    importador_id: str
    precio_ofrecido_usd: float
    tiempo_estimado_entrega: str
    incoterm: str
    condiciones_adicionales: Optional[str]
    estado: str  # "borrador", "pendiente", "aceptada", "rechazada"
    creado_por_usuario_id: Optional[str] = None
    preaceptada_por_solicitante: bool = False
    preaceptada_por_empresa: bool = False
    # --- Navegación cruzada (Fase 7): contacto de quien redactó/envió la propuesta ---
    contacto_asesor: Optional[ContactoAsignadoResponse] = None

    model_config = {"from_attributes": True}

class PropuestaAceptadaRequest(BaseModel):
    importador_id: str  # ID del importador cuya propuesta se acepta

class PreaceptarPropuestaRequest(BaseModel):
    """Marca (o revierte) la pre-aceptación de tu lado sobre una propuesta.

    Cuando ambos lados (solicitante y empresa) quedan en `aceptar=True`, la
    propuesta se finaliza automáticamente: se crea la Orden y el chat se
    traspasa al dueño de la empresa (ver `pre_aceptar_propuesta`).
    """
    aceptar: bool = True

# ==================== Estado de matching de cotizaciones abiertas ====================

class ImportadorPendienteResponse(BaseModel):
    """Datos mínimos de un importador que aún no respondió a una cotización abierta,
    usados en el panel de "Propuestas Recibidas" (wireframe Pantalla 6)."""
    importador_id: str
    nombre_empresa: str
    logo_url: Optional[str] = None

class MatchingStatusResponse(BaseModel):
    """Estado de difusión de una cotización abierta a la red de importadores."""
    total_matching: int
    respondidos: int
    pendientes: int
    importadores_pendientes: List[ImportadorPendienteResponse]

# ==================== Actualizar schemas/__init__.py exports ====================
