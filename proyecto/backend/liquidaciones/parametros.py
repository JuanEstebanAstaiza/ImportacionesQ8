"""Parámetros del módulo que el admin cambia desde el panel, sin redesplegar.

Viven en un único documento de la colección `configuracion` de la base del
módulo. Lo que no esté guardado toma el valor por defecto de aquí, así que un
parámetro nuevo funciona desde el primer arranque sin migrar nada.
"""
from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from typing import Any, Dict

from pymongo.database import Database

_ID = "parametros"

POR_DEFECTO: Dict[str, Any] = {
    # Plazo máximo entre la publicación y el cierre del lote.
    "dias_max_cierre": 15,
    # Tiempo que tiene el vendedor para marcar vendido un lote reservado.
    "horas_para_confirmar": 48,
    "fotos_min": 3,
    "fotos_max": 8,
    "videos_max": 2,
    "mb_max_foto": 10,
    "mb_max_video": 200,
    "mb_max_documento": 15,
    "categorias": [
        "Tecnología", "Hogar", "Textil", "Ferretería", "Cuidado personal", "Alimentos",
        "Juguetería", "Papelería", "Deportes", "Belleza", "Autopartes", "Otros",
    ],
    "motivos_rechazo": [
        "Fotos de catálogo o que no muestran el lote real",
        "Estado de la mercancía mal declarado",
        "Producto no permitido: réplica, marca sin autorización, vencido o regulado",
        "Exige registro sanitario y no lo tiene",
        "Precio incoherente con el lote",
    ],
    "checklist_revision": [
        "Las fotos son reales, no de catálogo",
        "El estado está bien declarado",
        "El producto está permitido",
        "El precio es coherente",
    ],
}

# Límites de cordura para lo que el admin puede escribir: un 0 en las horas
# dejaría vencer las reservas al instante.
RANGOS: Dict[str, tuple] = {
    "dias_max_cierre": (1, 60),
    "horas_para_confirmar": (1, 336),
    "fotos_min": (1, 20),
    "fotos_max": (1, 20),
    "videos_max": (0, 5),
    "mb_max_foto": (1, 50),
    "mb_max_video": (10, 1024),
    "mb_max_documento": (1, 100),
}


def leer(db: Database) -> Dict[str, Any]:
    guardado = db.configuracion.find_one({"_id": _ID}) or {}
    valores = deepcopy(POR_DEFECTO)
    for clave in POR_DEFECTO:
        if clave in guardado:
            valores[clave] = guardado[clave]
    return valores


def guardar(db: Database, cambios: Dict[str, Any], usuario_id: str) -> Dict[str, Any]:
    limpios: Dict[str, Any] = {}
    for clave, valor in cambios.items():
        if clave not in POR_DEFECTO or valor is None:
            continue
        if clave in RANGOS:
            minimo, maximo = RANGOS[clave]
            valor = int(valor)
            if not minimo <= valor <= maximo:
                raise ValueError(f"«{clave}» debe estar entre {minimo} y {maximo}")
        elif isinstance(POR_DEFECTO[clave], list):
            valor = [str(v).strip() for v in valor if str(v).strip()]
            if not valor:
                raise ValueError(f"«{clave}» no puede quedar vacío")
        limpios[clave] = valor

    actuales = leer(db)
    actuales.update(limpios)
    if actuales["fotos_min"] > actuales["fotos_max"]:
        raise ValueError("El mínimo de fotos no puede superar el máximo")

    db.configuracion.update_one(
        {"_id": _ID},
        {"$set": {**limpios, "actualizado_por": usuario_id, "actualizado_en": datetime.utcnow()}},
        upsert=True,
    )
    return leer(db)
