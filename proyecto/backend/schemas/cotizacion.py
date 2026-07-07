from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime

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
    estado: str  # "creada", "dirigida", "abierta", etc.
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
    estado: str  # "pendiente", "aceptada", "rechazada"

    model_config = {"from_attributes": True}

class PropuestaAceptadaRequest(BaseModel):
    importador_id: str  # ID del importador cuya propuesta se acepta

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
