from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class ComprarCreditosRequest(BaseModel):
    monto_usd: float = Field(..., gt=0, description="Monto en USD a pagar; se convierte a créditos con CREDITO_USD_POR_UNIDAD")

class ComprarCreditosResponse(BaseModel):
    checkout_url: str
    wompi_payment_id: str
    monto_usd: float
    creditos_a_acreditar: float

class PagoResponse(BaseModel):
    id: str
    usuario_id: str
    wompi_payment_id: str
    monto_usd: float
    creditos_comprados: float
    estado: str
    fecha_creacion: datetime
    fecha_confirmacion: Optional[datetime]

    model_config = {"from_attributes": True}

class SaldoCreditosResponse(BaseModel):
    creditos_balance: float

class MovimientoCreditoResponse(BaseModel):
    id: str
    tipo: str
    monto: float
    cotizacion_id: Optional[str]
    pago_id: Optional[str]
    descripcion: Optional[str]
    fecha: datetime

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
