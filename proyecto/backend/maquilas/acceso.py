"""Quién puede ver o tocar cada cosa del flujo de fabricación.

Lo usan los servicios (solicitudes, pedidos, chat) y la descarga de archivos,
para que la regla sea una sola:
- El equipo de Zarpi ve todo (monitoreo y soporte).
- El cliente ve su solicitud completa y sus pedidos.
- La maquiladora ve las solicitudes que le llegaron; si son confidenciales, el
  detalle (descripción, referencias, ficha) solo después de aceptar el acuerdo.
- Un pedido y su chat son de sus dos partes.
"""
from __future__ import annotations

from typing import Dict, Optional

from pymongo.database import Database

from maquilas.identidad import ROLES_CLIENTE, cuenta_de, es_equipo, es_maquiladora, maquiladora_id_de


def cuenta_cliente(usuario: dict) -> Optional[str]:
    """Cuenta del módulo de un cliente (cotizante o empresa); None si no es cliente."""
    if usuario.get("rol") not in ROLES_CLIENTE:
        return None
    if usuario.get("rol") in ("importador", "asesor") and usuario.get("importador_id"):
        return f"empresa:{usuario['importador_id']}"
    return f"usuario:{usuario['user_id']}"


def destino_de(solicitud: Dict, maquiladora_id: Optional[str]) -> Optional[Dict]:
    if not maquiladora_id:
        return None
    return next((d for d in solicitud.get("destinos") or [] if d.get("maquiladora_id") == maquiladora_id), None)


def es_cliente_de(solicitud: Dict, usuario: dict) -> bool:
    return bool(cuenta_cliente(usuario)) and cuenta_cliente(usuario) == solicitud.get("cuenta_cliente")


def acuerdo_ok(solicitud: Dict, destino: Optional[Dict]) -> bool:
    """Sin confidencialidad, o con el acuerdo ya aceptado por esa maquiladora."""
    return bool(destino) and (not solicitud.get("confidencial") or bool(destino.get("nda_aceptado_en")))


def puede_ver_resumen_solicitud(db: Database, solicitud: Dict, usuario: dict) -> bool:
    if es_equipo(usuario) or es_cliente_de(solicitud, usuario):
        return True
    return es_maquiladora(usuario) and destino_de(solicitud, maquiladora_id_de(db, usuario)) is not None


def puede_ver_detalle_solicitud(db: Database, solicitud: Dict, usuario: dict) -> bool:
    if es_equipo(usuario) or es_cliente_de(solicitud, usuario):
        return True
    if not es_maquiladora(usuario):
        return False
    return acuerdo_ok(solicitud, destino_de(solicitud, maquiladora_id_de(db, usuario)))


def es_parte_del_pedido(db: Database, pedido: Dict, usuario: dict, *, incluir_equipo: bool = True) -> bool:
    if incluir_equipo and es_equipo(usuario):
        return True
    if es_maquiladora(usuario):
        return maquiladora_id_de(db, usuario) == pedido.get("maquiladora_id")
    return bool(cuenta_cliente(usuario)) and cuenta_cliente(usuario) == pedido.get("cuenta_cliente")


def puede_usar_hilo(db: Database, hilo: str, usuario: dict, *, incluir_equipo: bool = True) -> bool:
    """El hilo `<solicitud_id>:<maquiladora_id>` es la conversación entre el cliente y
    esa maquiladora, desde la negociación hasta el pedido."""
    solicitud_id, _, maquiladora_id = (hilo or "").partition(":")
    solicitud = db.solicitudes.find_one({"_id": solicitud_id}) if solicitud_id else None
    if not solicitud or not destino_de(solicitud, maquiladora_id):
        return False
    if incluir_equipo and es_equipo(usuario):
        return True
    if es_cliente_de(solicitud, usuario):
        return True
    if es_maquiladora(usuario) and maquiladora_id_de(db, usuario) == maquiladora_id:
        return acuerdo_ok(solicitud, destino_de(solicitud, maquiladora_id))
    return False


def cuenta_de_usuario(db: Database, usuario: dict) -> str:
    return cuenta_de(db, usuario)
