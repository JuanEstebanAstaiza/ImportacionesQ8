"""Esquemas del acceso a Tendencias (suscripción, cortesía, acceso libre, aprobadores)."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, model_validator


class OtorgarAcceso(BaseModel):
    email: EmailStr
    dias: int = Field(..., ge=1, le=3650)
    nota: Optional[str] = Field(None, max_length=255)


class AccesoLibre(BaseModel):
    """Periodo de acceso libre. Uno de los dos, o ninguno para cerrarlo."""
    dias: Optional[int] = Field(None, ge=1, le=365)
    # Fecha y hora de fin, en hora de Bogotá.
    hasta: Optional[datetime] = None

    @model_validator(mode="after")
    def uno_solo(self):
        if self.dias is not None and self.hasta is not None:
            raise ValueError("Indica los días o la fecha de fin, no ambos")
        return self


class Curador(BaseModel):
    es_curador: bool
