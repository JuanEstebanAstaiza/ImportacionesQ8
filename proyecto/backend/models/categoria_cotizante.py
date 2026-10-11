"""Categorías de cotizante: paquetes que arma el admin para la lista privada.

Al crear un cotizante (o después, desde Cotizantes) se le asigna una categoría
y se le aplica lo que trae: el tier (queda fijo, como un tier puesto a mano) y
días de acceso a Tendencias (una cortesía que empieza ese día). Cambiar la
categoría después no le quita lo que ya se le dio.
"""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, Integer, String

from database import Base


class CategoriaCotizante(Base):
    __tablename__ = "categorias_cotizante"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    nombre = Column(String(60), nullable=False, unique=True)
    descripcion = Column(String(300), nullable=True)
    # Tier con el que queda (Bronze, Silver, Gold o Élite). Vacío: no lo toca.
    tier = Column(String(10), nullable=True)
    # Días de acceso a Tendencias al aplicarla. Vacío: sin Tendencias.
    dias_tendencias = Column(Integer, nullable=True)
    # Archivada: no se ofrece al crear cotizantes; los que la tienen la conservan.
    activa = Column(Boolean, nullable=False, default=True, server_default="1")
    creado_por = Column(String(36), nullable=True)
    fecha_creacion = Column(DateTime, nullable=False, default=datetime.utcnow)
