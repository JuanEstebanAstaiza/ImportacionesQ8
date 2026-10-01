"""Calculadora de precios de importación para el chat de negociación.

La empresa importadora la usa mientras conversa con el cliente para darle un
precio estimado de la cotización u orden. El cálculo vive solo aquí: la vista
previa del panel y el mensaje que llega al cliente salen de la misma función,
así que lo que la empresa ve es exactamente lo que recibe el cliente, y nadie
puede mandar al chat cifras que no cuadren con su desglose.

Orden del cálculo (bases habituales de la DIAN para la nacionalización):

    mercancía       = cantidad × precio unitario
    seguro          = (mercancía + flete) × % seguro
    valor CIF       = mercancía + flete + seguro
    arancel         = CIF × % arancel
    IVA             = (CIF + arancel) × % IVA
    margen empresa  = (CIF + arancel + gastos en destino) × % margen   ← el IVA no entra en la base
    total           = CIF + arancel + IVA + gastos en destino + margen

El rango (± %) expresa la incertidumbre de la estimación: fletes y tasas cambian
entre el momento de cotizar y el de embarcar.
"""
from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Dict, Optional

CENTAVO = Decimal("0.01")
CIEN = Decimal("100")


def _dec(valor: Any) -> Decimal:
    return Decimal(str(valor or 0))


def _redondear(valor: Decimal) -> float:
    return float(valor.quantize(CENTAVO, rounding=ROUND_HALF_UP))


def calcular_estimacion(
    *,
    cantidad: int,
    precio_unitario: Any,
    flete_internacional: Any = 0,
    seguro_pct: Any = 0,
    arancel_pct: Any = 0,
    iva_pct: Any = 0,
    gastos_destino: Any = 0,
    margen_pct: Any = 0,
    rango_pct: Any = 0,
    tasa_cambio_cop: Optional[Any] = None,
    moneda: str = "USD",
) -> Dict[str, Any]:
    """Desglose completo. Todos los importes, en `moneda` y redondeados a centavos."""
    unidades = Decimal(cantidad)
    mercancia = unidades * _dec(precio_unitario)
    flete = _dec(flete_internacional)
    seguro = (mercancia + flete) * _dec(seguro_pct) / CIEN
    cif = mercancia + flete + seguro
    arancel = cif * _dec(arancel_pct) / CIEN
    iva = (cif + arancel) * _dec(iva_pct) / CIEN
    gastos = _dec(gastos_destino)
    margen = (cif + arancel + gastos) * _dec(margen_pct) / CIEN
    total = cif + arancel + iva + gastos + margen
    rango = _dec(rango_pct) / CIEN

    resultado = {
        "valor_mercancia": _redondear(mercancia),
        "flete_internacional": _redondear(flete),
        "seguro": _redondear(seguro),
        "valor_cif": _redondear(cif),
        "arancel": _redondear(arancel),
        "iva": _redondear(iva),
        "gastos_destino": _redondear(gastos),
        "margen": _redondear(margen),
        "total": _redondear(total),
        "costo_unitario": _redondear(total / unidades),
        "total_minimo": _redondear(total * (1 - rango)),
        "total_maximo": _redondear(total * (1 + rango)),
        "total_cop": None,
    }
    if tasa_cambio_cop and moneda != "COP":
        resultado["total_cop"] = _redondear(total * _dec(tasa_cambio_cop))
    return resultado


def resumen_texto(moneda: str, desglose: Dict[str, Any], rango_pct: Any = 0) -> str:
    """Texto plano del mensaje: lo que se ve en la lista de chats y en los avisos."""
    total = f"{moneda} {desglose['total']:,.2f}"
    unitario = f"{moneda} {desglose['costo_unitario']:,.2f}"
    if _dec(rango_pct) > 0:
        rango = f"{moneda} {desglose['total_minimo']:,.2f} – {desglose['total_maximo']:,.2f}"
        return f"Estimación de precio: {total} ({unitario} por unidad). Rango posible: {rango}."
    return f"Estimación de precio: {total} ({unitario} por unidad)."
