"""Entradas de la API del módulo (las salidas las arma `servicio.a_*`)."""
from __future__ import annotations

from datetime import date
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

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


# ── Fase 2: solicitudes, propuestas, pedidos y chat ──────────────────────────

class FichaTecnicaEntrada(BaseModel):
    """Ficha técnica guiada: se guarda estructurada y se genera su PDF."""
    medidas: str = Field("", max_length=1500)
    materiales: str = Field("", max_length=1500)
    colores: str = Field("", max_length=1500)
    acabados: str = Field("", max_length=1500)
    empaque: str = Field("", max_length=1500)
    etiquetado: str = Field("", max_length=1500)
    notas: str = Field("", max_length=1500)

    @model_validator(mode="after")
    def algo_escrito(self) -> "FichaTecnicaEntrada":
        if not any(v.strip() for v in self.model_dump().values()):
            raise ValueError("La ficha técnica está vacía")
        return self


class FichaVistaPreviaEntrada(BaseModel):
    titulo: str = Field(..., min_length=3, max_length=160)
    categoria: str = Field(..., min_length=2, max_length=40)
    cantidad: Optional[int] = Field(None, ge=1, le=10_000_000)
    ficha: FichaTecnicaEntrada


class SolicitudEntrada(BaseModel):
    """Brief de fabricación. `campos` lleva las respuestas de la plantilla de la categoría.
    Marca blanca: sale de un producto del catálogo (`producto_id`) y la categoría es la del producto."""
    modalidad: Literal["dirigida", "abierta", "marca_blanca"]
    maquiladora_id: Optional[str] = Field(None, max_length=40)
    producto_id: Optional[str] = Field(None, max_length=40)
    personalizacion: List[str] = Field(default_factory=list, max_length=10)
    ficha_guiada: Optional[FichaTecnicaEntrada] = None
    categoria: str = Field(..., min_length=2, max_length=40)
    titulo: str = Field(..., min_length=3, max_length=160)
    descripcion: str = Field(..., min_length=10, max_length=4000)
    cantidad: int = Field(..., ge=1, le=10_000_000)
    presupuesto_unitario: Optional[int] = Field(None, ge=0, le=1_000_000_000)
    fecha_objetivo: Optional[date] = None
    ciudad_entrega: str = Field(..., min_length=2, max_length=80)
    campos: Dict[str, str] = Field(default_factory=dict)
    referencias: List[str] = Field(default_factory=list, max_length=10)
    ficha_tecnica: Optional[str] = Field(None, max_length=40)
    confidencial: bool = False

    @field_validator("campos")
    @classmethod
    def campos_acotados(cls, v: Dict[str, str]) -> Dict[str, str]:
        if len(v) > 20:
            raise ValueError("Demasiados campos en el brief")
        return {k[:40]: (valor or "").strip()[:1000] for k, valor in v.items() if (valor or "").strip()}


class TramoEntrada(BaseModel):
    cantidad_min: int = Field(..., ge=1, le=10_000_000)
    precio_unitario: int = Field(..., ge=1, le=1_000_000_000)


class CriterioCalidadEntrada(BaseModel):
    criterio: str = Field(..., min_length=3, max_length=200)
    tolerancia: str = Field("", max_length=120)


class PropuestaEntrada(BaseModel):
    """Precio por unidad según la cantidad (tramos), muestra, tiempos, cómo se paga y
    el checklist de calidad con el que se inspecciona el lote antes de despachar."""
    tramos: List[TramoEntrada] = Field(..., min_length=1, max_length=5)
    costo_muestra: int = Field(0, ge=0, le=1_000_000_000)
    dias_muestra: int = Field(..., ge=1, le=120)
    dias_produccion: int = Field(..., ge=1, le=365)
    hitos: Dict[str, int]
    condiciones: str = Field("", max_length=2000)
    validez_dias: int = Field(15, ge=1, le=60)
    criterios_calidad: List[CriterioCalidadEntrada] = Field(default_factory=list, max_length=15)

    @field_validator("hitos")
    @classmethod
    def hitos_suman_cien(cls, v: Dict[str, int]) -> Dict[str, int]:
        if any(p < 0 or p > 100 for p in v.values()):
            raise ValueError("Cada hito va de 0 % a 100 %")
        if sum(v.values()) != 100:
            raise ValueError("Los hitos de pago deben sumar 100 %")
        return {k: p for k, p in v.items() if p > 0}


class AceptarPropuestaEntrada(BaseModel):
    motivo: Optional[str] = Field(None, max_length=300)


class MuestraEntrada(BaseModel):
    archivos: List[str] = Field(..., min_length=1, max_length=8)
    nota: str = Field("", max_length=1000)


class RespuestaMuestraEntrada(BaseModel):
    aprobada: bool
    comentario: str = Field("", max_length=1000)


class EtapaEntrada(BaseModel):
    nota: str = Field("", max_length=1000)
    fotos: List[str] = Field(default_factory=list, max_length=8)


class ComprobanteEntrada(BaseModel):
    archivo_id: str = Field(..., max_length=40)
    nota: str = Field("", max_length=500)


class MensajeEntrada(BaseModel):
    contenido: str = Field("", max_length=4000)
    archivo_id: Optional[str] = Field(None, max_length=40)


# ── Fase 3: marca blanca, calidad, reseñas y repetir ────────────────────────

class ProductoEntrada(BaseModel):
    """Producto de marca blanca: listo para que el cliente le ponga su marca."""
    nombre: str = Field(..., min_length=3, max_length=120)
    categoria: str = Field(..., min_length=2, max_length=40)
    descripcion: str = Field(..., min_length=10, max_length=2000)
    fotos: List[str] = Field(default_factory=list, max_length=6)
    tramos: List[TramoEntrada] = Field(..., min_length=1, max_length=5)
    pedido_minimo: int = Field(..., ge=1, le=10_000_000)
    personalizable: List[str] = Field(default_factory=list, max_length=10)
    costo_muestra: int = Field(0, ge=0, le=1_000_000_000)
    dias_muestra: int = Field(..., ge=1, le=120)
    dias_produccion: int = Field(..., ge=1, le=365)
    activo: bool = False


class ResultadoCriterioEntrada(BaseModel):
    cumple: bool
    observacion: str = Field("", max_length=500)


class ReporteCalidadEntrada(BaseModel):
    """Inspección del lote antes de despachar: un resultado por criterio acordado, en orden."""
    unidades_inspeccionadas: int = Field(..., ge=1, le=10_000_000)
    resultados: List[ResultadoCriterioEntrada] = Field(default_factory=list, max_length=15)
    fotos: List[str] = Field(..., min_length=1, max_length=10)
    nota: str = Field("", max_length=1000)


class RespuestaCalidadEntrada(BaseModel):
    aprobado: bool
    comentario: str = Field("", max_length=1000)


class ResenaEntrada(BaseModel):
    calificacion: int = Field(..., ge=1, le=5)
    puntualidad: int = Field(..., ge=1, le=5)
    calidad: int = Field(..., ge=1, le=5)
    comunicacion: int = Field(..., ge=1, le=5)
    comentario: str = Field("", max_length=1000)


class RespuestaResenaEntrada(BaseModel):
    respuesta: str = Field(..., min_length=2, max_length=1000)


class RepetirEntrada(BaseModel):
    cantidad: int = Field(..., ge=1, le=10_000_000)
    fecha_objetivo: Optional[date] = None
