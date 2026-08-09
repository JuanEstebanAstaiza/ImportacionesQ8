"""Reparto de tickets entre la mesa de soporte.

La regla es la de una mesa de ayuda por niveles: un caso de nivel 3 no puede
caer en manos de alguien que acaba de entrar en el nivel 1. A la vez, tampoco
conviene gastar a los agentes con más experiencia en cualquier consulta
corriente, así que entre los que sí pueden atenderlo se prefiere al de menor
nivel suficiente, y dentro de ese grupo se elige al azar para repartir la carga.
"""
from __future__ import annotations

import random
from typing import Optional

from sqlalchemy.orm import Session

from models.usuario import NIVEL_SOPORTE_MAXIMO, NIVEL_SOPORTE_MINIMO, Usuario

# Con qué nivel entra un ticket según la urgencia que marcó quien pide ayuda.
#
# Es una estimación de partida, no un diagnóstico: el usuario describe cuánto le
# corre prisa, no lo difícil que es de resolver. Por eso el agente que lo recibe
# puede escalarlo (`escalar_ticket`) en cuanto lo lee.
NIVEL_POR_URGENCIA = {
    "critica": 3,
    "alta": 2,
    "media": 1,
    "baja": 1,
}


def nivel_inicial(urgencia: Optional[str]) -> int:
    return NIVEL_POR_URGENCIA.get(str(urgencia or ""), NIVEL_SOPORTE_MINIMO)


def acotar_nivel(nivel: Optional[int]) -> int:
    """Deja el nivel dentro del rango de la mesa."""
    try:
        valor = int(nivel)
    except (TypeError, ValueError):
        return NIVEL_SOPORTE_MINIMO
    return max(NIVEL_SOPORTE_MINIMO, min(NIVEL_SOPORTE_MAXIMO, valor))


def agentes_disponibles(db: Session, nivel: int) -> list:
    """Agentes activos que pueden atender un caso de este nivel."""
    return (
        db.query(Usuario)
        .filter(
            Usuario.rol == "soporte",
            Usuario.activo.is_(True),
            Usuario.nivel_soporte.isnot(None),
            Usuario.nivel_soporte >= nivel,
        )
        .all()
    )


def elegir_agente(db: Session, nivel: int) -> Optional[Usuario]:
    """Agente al que asignar un ticket de este nivel, o None si no hay ninguno.

    Devolver None es un resultado válido y no un error: si la mesa todavía no
    tiene a nadie de ese nivel, el ticket queda sin asignar y a la vista de
    administración, que es mejor que asignárselo a quien no puede resolverlo.
    """
    candidatos = agentes_disponibles(db, nivel)
    if not candidatos:
        return None

    # Entre los que pueden, el de menor nivel suficiente: reservar a los de
    # nivel 3 para lo que de verdad lo necesita.
    menor_nivel = min(a.nivel_soporte for a in candidatos)
    del_nivel = [a for a in candidatos if a.nivel_soporte == menor_nivel]

    # Al azar dentro del grupo: reparte la carga sin necesidad de llevar la
    # cuenta de cuántos tickets lleva cada uno.
    return random.choice(del_nivel)
