"""Fecha ideal de pedido y estado de un producto de Tendencias.

Funciones puras, sin base de datos, para poder probarlas con los cuatro casos
de la especificación (sección 04):

    fecha_limite  = fecha_en_bodega − dias_puerta_a_puerta
    fin_produccion = fecha_limite + dias_produccion
    si fin_produccion cae dentro de un cierre de fábricas:
        fecha_limite = cierre.fin_produccion_previa − dias_produccion
        aviso_cierre_fabricas = True

Las fechas son días sin hora, en hora de Bogotá. Todo se presenta como
estimado: el tiempo real lo da cada nacionalizadora en su propuesta.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Iterable, Optional, Sequence

import config

# Valores por defecto de la especificación. El admin puede cambiarlos (ver
# services/configuracion.py); estos son el respaldo.
DIAS_MAR_DEFECTO = 75
DIAS_AEREO_DEFECTO = 35
DIAS_PRODUCCION_DEFECTO = 20
# La mercancía debe estar en bodega este tiempo antes del día de la temporada.
DIAS_BODEGA_ANTES_DE_TEMPORADA = 21
# "Pídelo desde": la ventana se anuncia este tiempo antes de la fecha límite.
DIAS_VENTANA_PREVIA = 21


@dataclass(frozen=True)
class Parametros:
    dias_mar: int = DIAS_MAR_DEFECTO
    dias_aereo: int = DIAS_AEREO_DEFECTO
    dias_produccion: int = DIAS_PRODUCCION_DEFECTO


@dataclass(frozen=True)
class Cierre:
    inicio: date
    fin: date
    fin_produccion_previa: date


@dataclass(frozen=True)
class Limite:
    fecha: date
    dias_puerta_a_puerta: int
    aviso_cierre_fabricas: bool


@dataclass(frozen=True)
class FechasProducto:
    fecha_en_bodega: Optional[date]
    mar: Optional[Limite]
    aereo: Optional[Limite]

    @property
    def todo_el_anio(self) -> bool:
        return self.fecha_en_bodega is None


def hoy_bogota(ahora_utc: Optional[datetime] = None) -> date:
    ahora = ahora_utc or datetime.utcnow()
    return (ahora + timedelta(hours=config.CUPO_COTIZACIONES_UTC_OFFSET_HORAS)).date()


def bogota_a_utc(local: datetime) -> datetime:
    """Hora de Bogotá (sin zona) a UTC (sin zona), como se guarda en la BD."""
    return local - timedelta(hours=config.CUPO_COTIZACIONES_UTC_OFFSET_HORAS)


def utc_a_bogota(utc: datetime) -> datetime:
    return utc + timedelta(hours=config.CUPO_COTIZACIONES_UTC_OFFSET_HORAS)


def fecha_en_bodega(fecha_explicita: Optional[date], fecha_temporada: Optional[date]) -> Optional[date]:
    """Si el curador no fija la fecha en bodega, se toma la de la temporada
    menos 21 días. Sin ninguna de las dos, el producto es de todo el año."""
    if fecha_explicita:
        return fecha_explicita
    if fecha_temporada:
        return fecha_temporada - timedelta(days=DIAS_BODEGA_ANTES_DE_TEMPORADA)
    return None


def calcular_limite(
    en_bodega: date,
    dias_puerta_a_puerta: int,
    dias_produccion: int,
    cierres: Iterable[Cierre] = (),
) -> Limite:
    limite = en_bodega - timedelta(days=dias_puerta_a_puerta)
    fin_produccion = limite + timedelta(days=dias_produccion)
    for cierre in cierres:
        if cierre.inicio <= fin_produccion <= cierre.fin:
            return Limite(
                fecha=cierre.fin_produccion_previa - timedelta(days=dias_produccion),
                dias_puerta_a_puerta=dias_puerta_a_puerta,
                aviso_cierre_fabricas=True,
            )
    return Limite(fecha=limite, dias_puerta_a_puerta=dias_puerta_a_puerta, aviso_cierre_fabricas=False)


def calcular_fechas(
    *,
    fecha_en_bodega_explicita: Optional[date],
    fecha_temporada: Optional[date],
    parametros: Parametros,
    cierres: Sequence[Cierre] = (),
    dias_mar: Optional[int] = None,
    dias_aereo: Optional[int] = None,
) -> FechasProducto:
    """Fechas límite por mar y por aéreo. Los días propios del producto, si
    los tiene, reemplazan a los globales."""
    en_bodega = fecha_en_bodega(fecha_en_bodega_explicita, fecha_temporada)
    if en_bodega is None:
        return FechasProducto(fecha_en_bodega=None, mar=None, aereo=None)
    return FechasProducto(
        fecha_en_bodega=en_bodega,
        mar=calcular_limite(en_bodega, dias_mar or parametros.dias_mar, parametros.dias_produccion, cierres),
        aereo=calcular_limite(en_bodega, dias_aereo or parametros.dias_aereo, parametros.dias_produccion, cierres),
    )


# Estados para el comprador (sección 05). Se aplica la primera regla que se cumpla.
TODO_EL_ANIO = "todo_el_anio"
PIDELO_YA = "pidelo_ya"
VENTANA_ABIERTA = "ventana_abierta"
FUTURA = "futura"
SOLO_AEREO = "solo_aereo"
FUERA_DE_TIEMPO = "fuera_de_tiempo"

# El filtro "Pídelo ya" de la pantalla incluye estos tres.
ESTADOS_PIDELO_YA = (PIDELO_YA, VENTANA_ABIERTA, SOLO_AEREO)


@dataclass(frozen=True)
class EstadoProducto:
    codigo: str
    texto: str
    dias_restantes: Optional[int] = None


_MESES = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
          "agosto", "septiembre", "octubre", "noviembre", "diciembre")


def fecha_larga(d: date) -> str:
    return f"{d.day} de {_MESES[d.month - 1]}"


def estado_producto(fechas: FechasProducto, hoy: date) -> EstadoProducto:
    if fechas.todo_el_anio or fechas.mar is None or fechas.aereo is None:
        return EstadoProducto(TODO_EL_ANIO, "Todo el año")

    dias_mar = (fechas.mar.fecha - hoy).days
    if 0 <= dias_mar <= 7:
        return EstadoProducto(PIDELO_YA, "Pídelo esta semana", dias_mar)
    if 8 <= dias_mar <= 30:
        return EstadoProducto(VENTANA_ABIERTA, f"Ventana abierta · quedan {dias_mar} días", dias_mar)
    if dias_mar > 30:
        desde = fechas.mar.fecha - timedelta(days=DIAS_VENTANA_PREVIA)
        return EstadoProducto(FUTURA, f"Pídelo desde el {fecha_larga(desde)}", dias_mar)
    if hoy <= fechas.aereo.fecha:
        return EstadoProducto(SOLO_AEREO, "Solo aéreo", (fechas.aereo.fecha - hoy).days)
    return EstadoProducto(FUERA_DE_TIEMPO, "Fuera de tiempo")


# Calendario inicial, editable por el admin. La 0028 lo siembra y
# `database._sembrar_datos_de_migraciones` también, para las BD que arrancan
# vacías. Las fechas de bodega de la especificación salen de aquí:
# Navidad 11 dic − 21 = 20 nov; Año nuevo 16 ene − 21 = 26 dic; etc.
TEMPORADAS_INICIALES = (
    ("Halloween", date(2026, 10, 31), "Disfraces, decoración, dulceros"),
    ("Black Friday", date(2026, 11, 27), "Tecnología, hogar, regalos"),
    ("Navidad", date(2026, 12, 11), "Luces, decoración, regalos, novenas"),
    ("Año nuevo · propósitos", date(2027, 1, 16), "Fitness, organización, agendas"),
    ("Regreso a clases (calendario A)", date(2027, 1, 26), "Loncheras, morrales, útiles"),
    ("San Valentín", date(2027, 2, 14), "Regalos, detalles, empaques"),
    ("Día de la Mujer", date(2027, 3, 8), "Belleza, accesorios, detalles"),
    ("Día de la Madre", date(2027, 5, 9), "Hogar, belleza, cocina"),
    ("Día del Padre", date(2027, 6, 20), "Tecnología, herramientas, deporte"),
    ("Regreso a clases (calendario B)", date(2027, 8, 17), "Loncheras, morrales, útiles"),
    ("Amor y Amistad", date(2027, 9, 18), "Regalos, detalles, empaques"),
    ("Halloween", date(2027, 10, 31), "Disfraces, decoración, dulceros"),
    ("Black Friday", date(2027, 11, 26), "Tecnología, hogar, regalos"),
    ("Navidad", date(2027, 12, 11), "Luces, decoración, regalos, novenas"),
)

# Año Nuevo Lunar 2027. Los años siguientes los agrega el admin.
CIERRES_INICIALES = (
    (date(2027, 1, 20), date(2027, 2, 28), date(2027, 1, 15)),
)
