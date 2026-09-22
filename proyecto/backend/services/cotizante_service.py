import re
from typing import Any, Iterable

from sqlalchemy import func
from sqlalchemy.orm import Session

from models.cotizacion import Cotizacion
from models.orden import Orden
from models.usuario import Usuario
from schemas.cotizante import (
    ActividadPlataformaResponse,
    CantidadImportacionesResponse,
    CotizantePerfilPublicoResponse,
    VolumenImportacionesResponse,
)

_NUMBER_RE = re.compile(r"-?\d+(?:[.,]\d+)?")
_WEIGHT_KEYS = ("peso", "weight", "kg", "kilogram")
_VOLUME_KEYS = ("volumen", "volume", "cbm", "m3", "metro cubico")
_CONTAINER_KEYS = ("contenedor", "container", "containers")


def _number(value: Any) -> float:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    match = _NUMBER_RE.search(str(value or ""))
    return float(match.group(0).replace(",", ".")) if match else 0.0


def _values_by_key(value: Any, keys: Iterable[str]) -> Iterable[float]:
    if isinstance(value, dict):
        for key, nested in value.items():
            normalized_key = str(key).strip().lower()
            if any(alias in normalized_key for alias in keys):
                if isinstance(nested, dict):
                    nested_value = nested.get("valor", nested.get("value"))
                    if nested_value is not None:
                        yield _number(nested_value)
                elif isinstance(nested, list):
                    yield sum(_number(item) for item in nested)
                else:
                    yield _number(nested)
            yield from _values_by_key(nested, keys)
    elif isinstance(value, list):
        for item in value:
            yield from _values_by_key(item, keys)


def _sum_logistics(cotizaciones: list[Cotizacion]) -> VolumenImportacionesResponse:
    peso = sum(sum(_values_by_key(c.campos_personalizados_valores, _WEIGHT_KEYS)) for c in cotizaciones)
    volumen = sum(sum(_values_by_key(c.campos_personalizados_valores, _VOLUME_KEYS)) for c in cotizaciones)
    contenedores = sum(sum(_values_by_key(c.campos_personalizados_valores, _CONTAINER_KEYS)) for c in cotizaciones)
    return VolumenImportacionesResponse(
        peso_total_kg=round(peso, 2),
        volumen_total_m3=round(volumen, 2),
        contenedores_total=int(contenedores),
    )


def obtener_perfil_publico_cotizante(db: Session, solicitante_id: str) -> CotizantePerfilPublicoResponse | None:
    usuario = db.query(Usuario).filter(
        Usuario.id == solicitante_id,
        Usuario.rol == "solicitante",
    ).first()
    if not usuario:
        return None

    cotizaciones = db.query(Cotizacion).filter(
        Cotizacion.solicitante_id == solicitante_id,
        Cotizacion.cancelada_por_error.is_(None),
    ).all()
    ordenes = db.query(Orden).filter(Orden.solicitante_id == solicitante_id).all()
    promedio = db.query(func.avg(Orden.precio_acordado_usd)).filter(
        Orden.solicitante_id == solicitante_id,
    ).scalar() or 0.0
    total_ordenes = len(ordenes)

    return CotizantePerfilPublicoResponse(
        solicitante_id=str(usuario.id),
        nombre=usuario.nombre or usuario.razon_social or "Cotizante",
        volumen_total_importaciones=_sum_logistics(
            [orden.cotizacion for orden in ordenes if orden.cotizacion is not None]
        ),
        cantidad_importaciones=CantidadImportacionesResponse(
            total=total_ordenes,
            dentro_plataforma=total_ordenes,
            fuera_plataforma=0,
        ),
        valor_promedio_importacion_usd=round(float(promedio), 2),
        actividad_plataforma=ActividadPlataformaResponse(
            cotizaciones_solicitadas=len(cotizaciones),
            ordenes_generadas=total_ordenes,
            valor_promedio_operaciones_usd=round(float(promedio), 2),
        ),
    )
