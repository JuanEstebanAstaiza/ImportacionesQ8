"""Cada módulo de `models/` se importa en `models/__init__.py`.

Una BD vacía se crea con `create_all` a partir de `import models` y se marca en
head (`database.bootstrap_si_vacia`): un modelo que no esté ahí se queda sin
tabla y su migración ya no corre. Así le faltó `articulos_ayuda` a producción
(500 en /ayuda/articulos).
"""
import re
from pathlib import Path

MODELS = Path(__file__).resolve().parent.parent / "models"


def test_todos_los_modelos_se_importan_en_el_paquete():
    init = (MODELS / "__init__.py").read_text(encoding="utf-8")
    importados = set(re.findall(r"^from \.(\w+) import", init, flags=re.M))
    con_tablas = {
        archivo.stem for archivo in MODELS.glob("*.py")
        if archivo.stem != "__init__" and "__tablename__" in archivo.read_text(encoding="utf-8")
    }
    assert con_tablas - importados == set()
