"""Entradas de la API del módulo (las salidas las arma `servicio.a_*`)."""
from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from utils.password_policy import password_cumple_politica

TipoDocumento = Literal["CC", "CE", "PPT", "Pasaporte", "NIT", "DNI"]


class EmpresaEntrada(BaseModel):
    """Los mismos datos legales que se piden a cualquier empresa de la plataforma."""
    razon_social: str = Field(..., min_length=2, max_length=200)
    nombre_comercial: str = Field(..., min_length=2, max_length=120)
    nit: str = Field(..., min_length=5, max_length=30)
    ciudad: str = Field(..., min_length=2, max_length=80)
    direccion: Optional[str] = Field(None, max_length=200)
    telefono: Optional[str] = Field(None, max_length=30)
    sitio_web: Optional[str] = Field(None, max_length=200)

    @field_validator("nit")
    @classmethod
    def nit_con_digitos(cls, v: str) -> str:
        if sum(c.isdigit() for c in v) < 5:
            raise ValueError("Escribe el NIT con sus dígitos")
        return v.strip()


class RepresentanteEntrada(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=120)
    apellido: str = Field(..., min_length=2, max_length=120)
    tipo_documento: TipoDocumento = "CC"
    numero_documento: str = Field(..., min_length=4, max_length=30)
    indicativo_pais_telefono: str = Field("+57", min_length=2, max_length=6)
    telefono: str = Field(..., min_length=6, max_length=20)
    email: EmailStr
    password: str = Field(..., min_length=9, max_length=128)

    @field_validator("password")
    @classmethod
    def validar_password(cls, v: str) -> str:
        if not password_cumple_politica(v):
            raise ValueError("La contraseña debe tener al menos 9 caracteres, una letra y un dígito")
        return v


class FabricacionEntrada(BaseModel):
    categorias: List[str] = Field(..., min_length=1, max_length=12)
    procesos: List[str] = Field(..., min_length=1, max_length=30)
    pedido_minimo: int = Field(..., ge=1, le=10_000_000)
    capacidad_mensual: Optional[int] = Field(None, ge=1, le=100_000_000)
    dias_muestra: Optional[int] = Field(None, ge=1, le=365)
    dias_produccion: Optional[int] = Field(None, ge=1, le=730)


class RegistroMaquilaEntrada(BaseModel):
    """Registro público de una maquiladora (formulario de 3 pasos)."""
    empresa: EmpresaEntrada
    representante: RepresentanteEntrada
    fabricacion: FabricacionEntrada
    acepto_politica_datos: bool

    @field_validator("acepto_politica_datos")
    @classmethod
    def debe_aceptar(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Debes aceptar la política de tratamiento de datos para registrarte")
        return v


class AdminCrearMaquilaEntrada(BaseModel):
    """Alta hecha por el equipo: la cuenta queda con el correo ya verificado."""
    empresa: EmpresaEntrada
    representante: RepresentanteEntrada
    fabricacion: FabricacionEntrada


class PerfilEntrada(BaseModel):
    """Lo que la maquiladora edita de su perfil. Razón social y NIT solo mientras
    no esté verificada (cambiarlos después exige otra verificación)."""
    razon_social: Optional[str] = Field(None, min_length=2, max_length=200)
    nit: Optional[str] = Field(None, min_length=5, max_length=30)
    nombre_comercial: Optional[str] = Field(None, min_length=2, max_length=120)
    ciudad: Optional[str] = Field(None, min_length=2, max_length=80)
    direccion: Optional[str] = Field(None, max_length=200)
    telefono: Optional[str] = Field(None, max_length=30)
    sitio_web: Optional[str] = Field(None, max_length=200)
    descripcion: Optional[str] = Field(None, max_length=2000)
    categorias: Optional[List[str]] = Field(None, min_length=1, max_length=12)
    procesos: Optional[List[str]] = Field(None, min_length=1, max_length=30)
    certificaciones: Optional[List[str]] = Field(None, max_length=20)
    pedido_minimo: Optional[int] = Field(None, ge=1, le=10_000_000)
    capacidad_mensual: Optional[int] = Field(None, ge=1, le=100_000_000)
    dias_muestra: Optional[int] = Field(None, ge=1, le=365)
    dias_produccion: Optional[int] = Field(None, ge=1, le=730)


class DocumentosEntrada(BaseModel):
    """Ids de archivos ya subidos (`POST /maquilas/archivos/...`). `None` deja lo que hay."""
    rut: Optional[str] = Field(None, max_length=40)
    camara_comercio: Optional[str] = Field(None, max_length=40)
    certificados: Optional[List[str]] = Field(None, max_length=10)
    galeria: Optional[List[str]] = Field(None, max_length=12)


class MotivoEntrada(BaseModel):
    motivo: str = Field(..., min_length=5, max_length=500)
