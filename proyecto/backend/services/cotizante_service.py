import re
from typing import Any, Iterable

from sqlalchemy import or_
from sqlalchemy.orm import Session

from models.campo_personalizado import CampoPersonalizado
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.orden import EstadoOrden, Orden
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


def _valores_con_etiqueta(valores: Any, etiquetas: dict) -> Any:
    """Las respuestas del formulario de la empresa se guardan por ID de campo
    ({"<uuid>": "120 kg"}); para reconocer qué es peso o volumen hace falta la
    etiqueta que le puso la empresa."""
    if not isinstance(valores, dict):
        return valores
    return {etiquetas.get(str(clave), clave): valor for clave, valor in valores.items()}


def _sum_logistics(db: Session, cotizaciones: list[Cotizacion]) -> VolumenImportacionesResponse:
    ids_campos = {
        str(clave)
        for c in cotizaciones if isinstance(c.campos_personalizados_valores, dict)
        for clave in c.campos_personalizados_valores
    }
    etiquetas = {}
    if ids_campos:
        etiquetas = dict(
            db.query(CampoPersonalizado.id, CampoPersonalizado.etiqueta)
            .filter(CampoPersonalizado.id.in_(ids_campos))
            .all()
        )
    valores = [_valores_con_etiqueta(c.campos_personalizados_valores, etiquetas) for c in cotizaciones]

    def total(keys: Iterable[str]) -> float:
        # Un valor negativo es un error de captura, no una carga que reste.
        return sum(max(0.0, v) for valor in valores for v in _values_by_key(valor, keys))

    return VolumenImportacionesResponse(
        peso_total_kg=round(total(_WEIGHT_KEYS), 2),
        volumen_total_m3=round(total(_VOLUME_KEYS), 2),
        contenedores_total=int(total(_CONTAINER_KEYS)),
    )


def _promedio(valores: Iterable[Any]) -> float:
    numeros = [float(v) for v in valores if v is not None]
    return round(sum(numeros) / len(numeros), 2) if numeros else 0.0


def obtener_perfil_publico_cotizante(db: Session, solicitante_id: str) -> CotizantePerfilPublicoResponse | None:
    """Métricas reales del cotizante, calculadas en cada consulta desde la BD."""
    usuario = db.query(Usuario).filter(
        Usuario.id == solicitante_id,
        Usuario.rol == "solicitante",
    ).first()
    if not usuario:
        return None

    # Las anuladas por error no son actividad real del cotizante.
    cotizaciones = db.query(Cotizacion).filter(
        Cotizacion.solicitante_id == solicitante_id,
        Cotizacion.cancelada_por_error.is_(None),
        or_(Cotizacion.estado.is_(None), Cotizacion.estado != EstadoCotizacion.cancelada.value),
    ).all()
    ordenes = db.query(Orden).filter(Orden.solicitante_id == solicitante_id).all()
    finalizadas = [o for o in ordenes if _estado(o.estado) == EstadoOrden.entregado.value]

    promedio_ordenes = _promedio(o.precio_acordado_usd for o in ordenes)
    promedio_cotizaciones = _promedio(
        c.precio_objetivo_usd for c in cotizaciones
        if (c.moneda_precio_objetivo or "USD").upper() == "USD"
    )
    dentro = len(ordenes)
    fuera = int(usuario.importaciones_fuera_plataforma or 0)

    return CotizantePerfilPublicoResponse(
        solicitante_id=str(usuario.id),
        nombre=usuario.nombre or usuario.razon_social or "Cotizante",
        tier=usuario.tier or "Bronze",
        # Peso, volumen y contenedores solo de lo que ya se entregó: una orden
        # en producción todavía puede cambiar de carga.
        volumen_total_importaciones=_sum_logistics(
            db,
            [orden.cotizacion for orden in finalizadas if orden.cotizacion is not None]
        ),
        cantidad_importaciones=CantidadImportacionesResponse(
            total=dentro + fuera,
            dentro_plataforma=dentro,
            fuera_plataforma=fuera,
            finalizadas=len(finalizadas),
        ),
        valor_promedio_importacion_usd=promedio_ordenes,
        actividad_plataforma=ActividadPlataformaResponse(
            cotizaciones_solicitadas=len(cotizaciones),
            ordenes_generadas=dentro,
            valor_promedio_operaciones_usd=promedio_ordenes,
            valor_promedio_cotizaciones_usd=promedio_cotizaciones,
            valor_promedio_ordenes_usd=promedio_ordenes,
        ),
    )


def _estado(valor: Any) -> str:
    return valor.value if isinstance(valor, EstadoOrden) else str(valor or "")
