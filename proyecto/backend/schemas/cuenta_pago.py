"""Datos bancarios que carga el usuario (perfil o reclamo del reto)."""
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class CuentaPagoDatos(BaseModel):
    banco: str = Field(..., min_length=2, max_length=80)
    tipo_cuenta: Literal["ahorros", "corriente"]
    numero_cuenta: str = Field(..., min_length=6, max_length=30)
    titular: str = Field(..., min_length=3, max_length=150)
    documento_titular: str = Field(..., min_length=5, max_length=20)

    @field_validator("numero_cuenta")
    @classmethod
    def solo_digitos(cls, v: str) -> str:
        digitos = "".join(c for c in v if c.isdigit())
        if len(digitos) < 6:
            raise ValueError("El número de cuenta debe tener al menos 6 dígitos")
        return digitos
