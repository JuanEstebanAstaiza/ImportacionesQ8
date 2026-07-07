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
    historial_estados: List[EstadoOrdenItem]
    documentos_adjuntos: List[DocumentoOrdenItem]

    model_config = {"from_attributes": True}

class EstadoOrdenUpdate(BaseModel):
    estado: str  # Nuevo estado de la orden

class DocumentoOrdenCreate(BaseModel):
    nombre: str
    url: str
    tipo: str  # "factura_proforma", "factura_comercial", "packing_list", "comprobante_pago"