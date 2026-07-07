from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class CheckoutRequest(BaseModel):
    cotizacion_id: str = Field(..., description="ID de la cotización aceptada a pagar")

class CheckoutResponse(BaseModel):
    checkout_url: str
    wompi_payment_id: str
    monto_comision_usd: float
    cotizacion_id: str

class PagoResponse(BaseModel):
    id: str
    orden_id: Optional[str]
    cotizacion_id: str
    wompi_payment_id: str
    monto_usd: float
    estado: str
    fecha_creacion: datetime
    fecha_confirmacion: Optional[datetime]

    model_config = {"from_attributes": True}

class WompiWebhookSignature(BaseModel):
    checksum: str
    properties: list[str]

class WompiWebhookEvent(BaseModel):
    """
    Modelo del payload que envía Wompi. Validar la forma del payload con Pydantic
    evita procesar eventos malformados o con tipos inesperados (defensa en profundidad
    adicional a la verificación de firma HMAC).
    """
    event: str
    data: dict
    timestamp: Optional[int] = None
    signature: Optional[WompiWebhookSignature] = None
