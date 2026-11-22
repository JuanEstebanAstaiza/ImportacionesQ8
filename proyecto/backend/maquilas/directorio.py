"""Directorio de maquiladoras verificadas: lo que ven los clientes para elegir."""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from fastapi import status
from pymongo.database import Database

from maquilas import parametros
from maquilas.comun import error
from maquilas.servicio import a_maquiladora


def _filtro(categoria: Optional[str], proceso: Optional[str], ciudad: Optional[str], q: Optional[str],
            cantidad: Optional[int]) -> Dict[str, Any]:
    filtro: Dict[str, Any] = {"estado": "verificada"}
    if categoria:
        filtro["categorias"] = categoria
    if proceso:
        filtro["procesos"] = proceso
    if ciudad and ciudad.strip():
        filtro["ciudad"] = {"$regex": re.escape(ciudad.strip()[:80]), "$options": "i"}
    if cantidad:
        # Que su pedido mínimo quepa en la cantidad que se quiere fabricar.
        filtro["$or"] = [{"pedido_minimo": {"$lte": cantidad}}, {"pedido_minimo": None}]
    if q and q.strip():
        patron = {"$regex": re.escape(q.strip()[:80]), "$options": "i"}
        filtro.setdefault("$and", []).append(
            {"$or": [{"nombre_comercial": patron}, {"descripcion": patron}, {"procesos": patron}]})
    return filtro


def listar(db: Database, *, categoria: Optional[str] = None, proceso: Optional[str] = None,
           ciudad: Optional[str] = None, q: Optional[str] = None, cantidad: Optional[int] = None) -> List[Dict]:
    filas = db.maquiladoras.find(_filtro(categoria, proceso, ciudad, q, cantidad)).sort("verificada_en", -1).limit(200)
    return [a_maquiladora(doc, privado=False) for doc in filas]


def perfil(db: Database, maquiladora_id: str) -> Dict:
    doc = db.maquiladoras.find_one({"_id": maquiladora_id, "estado": "verificada"})
    if not doc:
        raise error(status.HTTP_404_NOT_FOUND, "Esa maquila no está disponible")
    return a_maquiladora(doc, privado=False)


def candidatas_para(db: Database, *, categoria: str, cantidad: int, ciudad: str, cupo: Optional[int] = None) -> List[Dict]:
    """Las maquiladoras a las que se reparte una solicitud abierta.

    Verificadas, de esa categoría y con un pedido mínimo que quepa en la
    cantidad. Primero las de la misma ciudad, luego las que tienen capacidad
    para el volumen y las que tienen más certificaciones.
    """
    cupo = cupo or int(parametros.leer(db)["cupo_abierta"])
    filas = list(db.maquiladoras.find(_filtro(categoria, None, None, None, cantidad)).limit(500))
    ciudad_n = (ciudad or "").strip().lower()

    def puntaje(doc: Dict) -> tuple:
        misma_ciudad = (doc.get("ciudad") or "").strip().lower() == ciudad_n
        con_capacidad = not doc.get("capacidad_mensual") or doc["capacidad_mensual"] >= cantidad
        return (misma_ciudad, con_capacidad, len(doc.get("certificaciones") or []), str(doc.get("verificada_en") or ""))

    filas.sort(key=puntaje, reverse=True)
    return filas[:cupo]
