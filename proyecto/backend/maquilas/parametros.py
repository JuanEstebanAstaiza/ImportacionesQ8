"""Parámetros del módulo: lo que el admin puede ajustar sin redesplegar.

Se guardan en la colección `configuracion` (documento `parametros`) y se mezclan
con los valores por defecto, así que un parámetro nuevo funciona aunque el
admin nunca lo haya tocado.
"""
from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict

from pymongo.database import Database

POR_DEFECTO: Dict[str, Any] = {
    # Qué se fabrica. La clave es estable (se guarda en las maquiladoras); el nombre se puede cambiar.
    "categorias": [
        {"clave": "textil", "nombre": "Textil y confección"},
        {"clave": "calzado", "nombre": "Calzado"},
        {"clave": "marroquineria", "nombre": "Marroquinería y accesorios"},
        {"clave": "cosmetica", "nombre": "Cosmética y cuidado personal"},
        {"clave": "alimentos", "nombre": "Alimentos y bebidas"},
        {"clave": "suplementos", "nombre": "Suplementos y nutrición"},
        {"clave": "aseo", "nombre": "Aseo y hogar"},
        {"clave": "empaques", "nombre": "Empaques y etiquetas"},
        {"clave": "muebles", "nombre": "Muebles y madera"},
        {"clave": "plasticos", "nombre": "Plásticos e inyección"},
        {"clave": "metalmecanica", "nombre": "Metalmecánica"},
        {"clave": "otros", "nombre": "Otros"},
    ],
    "procesos": [
        "Diseño y patronaje", "Corte", "Confección", "Estampado", "Sublimación", "Bordado", "Tejido",
        "Formulación", "Llenado y envasado", "Etiquetado", "Empaque", "Inyección", "Mecanizado",
        "Ensamble", "Control de calidad",
    ],
    "certificaciones": ["BPM", "INVIMA", "ISO 9001", "ISO 14001", "HACCP", "Orgánico"],
    "fotos_galeria_max": 12,
    "certificados_max": 10,
    "mb_max_foto": 10,
    "mb_max_documento": 15,
}


def leer(db: Database) -> Dict[str, Any]:
    guardado = db.configuracion.find_one({"_id": "parametros"}) or {}
    valores = deepcopy(POR_DEFECTO)
    valores.update({k: v for k, v in guardado.items() if k in POR_DEFECTO})
    return valores


def claves_categorias(db: Database) -> set:
    return {c["clave"] for c in leer(db)["categorias"]}


def publicos(db: Database) -> Dict[str, Any]:
    """Lo que necesitan los formularios (registro y perfil), sin sesión."""
    p = leer(db)
    return {k: p[k] for k in ("categorias", "procesos", "certificaciones", "fotos_galeria_max",
                              "certificados_max", "mb_max_foto", "mb_max_documento")}
