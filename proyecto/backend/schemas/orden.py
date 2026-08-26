from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class EstadoOrdenItem(BaseModel):
    id: str
    orden_id: str
    estado_anterior: Optional[str]
    estado_nuevo: str
    fecha_cambio: datetime

    model_config = {"from_attributes": True}

class DocumentoOrdenItem(BaseModel):
    id: str
    orden_id: str
    nombre: str
    url: str
    tipo: str  # "factura_proforma", "factura_comercial", "packing_list", "comprobante_pago"

    model_config = {"from_attributes": True}

class OrdenCreate(BaseModel):
    cotizacion_id: str
    importador_id: str
    solicitante_id: str
    asesor_asignado_id: Optional[str] = None

class OrdenResponse(BaseModel):
    id: str
    cotizacion_id: str
    importador_id: str
    solicitante_id: str
    asesor_asignado_id: Optional[str]
    estado: str  # "cotizacion_aceptada", "en_produccion", etc.
    precio_acordado_usd: float
    tiempo_estimado_entrega: Optional[str]
    condiciones_adicionales: Optional[str]
    # Marca de embarque congelada al crear la orden ("ctl-prendascontrol"): es lo
    # que va rotulado en las cajas de este embarque.
    shipping_mark: Optional[str] = None
    en_disputa: bool = False
    motivo_disputa: Optional[str] = None
    # Navegación cruzada (Fase 7): enlace directo al chat de esta orden, si existe
    conversacion_id: Optional[str] = None
    historial_estados: List[EstadoOrdenItem]
    documentos_adjuntos: List[DocumentoOrdenItem]

    model_config = {"from_attributes": True}

class ReportarProblemaRequest(BaseModel):
    motivo: str = Field(..., min_length=10, description="Descripción del problema reportado")

class ResolverDisputaRequest(BaseModel):
    resolucion: str = Field(..., min_length=5, description="Notas de la resolución aplicada por el admin")

class EstadoOrdenUpdate(BaseModel):
    estado: str  # Nuevo estado de la orden

class DocumentoOrdenCreate(BaseModel):
    nombre: str
    url: str
    tipo: str  # "factura_proforma", "factura_comercial", "packing_list", "comprobante_pago"