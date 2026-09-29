from pydantic import BaseModel, Field


class VolumenImportacionesResponse(BaseModel):
    peso_total_kg: float = Field(default=0.0, ge=0)
    volumen_total_m3: float = Field(default=0.0, ge=0)
    contenedores_total: int = Field(default=0, ge=0)


class CantidadImportacionesResponse(BaseModel):
    total: int = Field(default=0, ge=0)
    # Órdenes gestionadas en la plataforma (cualquier estado).
    dentro_plataforma: int = Field(default=0, ge=0)
    # Declaradas por el cotizante en su perfil (`PUT /usuarios/me`).
    fuera_plataforma: int = Field(default=0, ge=0)
    # Órdenes que ya llegaron a "entregado"; son las que suman peso/volumen.
    finalizadas: int = Field(default=0, ge=0)


class ActividadPlataformaResponse(BaseModel):
    cotizaciones_solicitadas: int = Field(default=0, ge=0)
    ordenes_generadas: int = Field(default=0, ge=0)
    valor_promedio_operaciones_usd: float = Field(default=0.0, ge=0)
    # Precio objetivo medio de sus cotizaciones (solo las expresadas en USD).
    valor_promedio_cotizaciones_usd: float = Field(default=0.0, ge=0)
    # Precio acordado medio de sus órdenes (propuestas aprobadas).
    valor_promedio_ordenes_usd: float = Field(default=0.0, ge=0)


class CotizantePerfilPublicoResponse(BaseModel):
    solicitante_id: str
    nombre: str
    tier: str = "Bronze"
    volumen_total_importaciones: VolumenImportacionesResponse
    cantidad_importaciones: CantidadImportacionesResponse
    valor_promedio_importacion_usd: float = Field(default=0.0, ge=0)
    actividad_plataforma: ActividadPlataformaResponse
