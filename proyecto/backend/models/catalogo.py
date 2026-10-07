"""Catálogos selectos de las empresas importadoras.

Una empresa arma uno o varios catálogos con productos que ofrece importar y
decide a quién se los desbloquea. Para el comprador son gratuitos: no los
cobra Zarpi ni la empresa. Desde un producto del catálogo el comprador pide
propuesta con una solicitud dirigida a esa empresa, prellenada.

El acceso se concede si se cumple el criterio del catálogo **o** si la empresa
agregó al comprador a mano (`AccesoCatalogo`). La lista manual siempre suma:
sirve para invitar a alguien que todavía no cumple el criterio.
"""
import enum
from datetime import datetime
from uuid import uuid4

from sqlalchemy import (
    JSON, Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text,
    UniqueConstraint,
)

from database import Base


class CriterioCatalogo(str, enum.Enum):
    # Solo los compradores que la empresa elige.
    manual = "manual"
    # Compradores con tier igual o superior a `tier_minimo`.
    tier_minimo = "tier_minimo"
    # Compradores con al menos una orden con la empresa.
    clientes_con_orden = "clientes_con_orden"
    # Compradores con suscripción vigente a Tendencias (los premium de Zarpi).
    suscriptores_zarpi = "suscriptores_zarpi"


class CatalogoEmpresa(Base):
    __tablename__ = "catalogos_empresa"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    importador_id = Column(String(36), ForeignKey("importadores.id"), nullable=False, index=True)
    titulo = Column(String(80), nullable=False)
    descripcion = Column(String(300), nullable=True)
    criterio = Column(String(30), nullable=False, default=CriterioCatalogo.manual.value)
    tier_minimo = Column(String(10), nullable=True)
    activo = Column(Boolean, nullable=False, default=True, server_default="1")
    fecha_creacion = Column(DateTime, nullable=False, default=datetime.utcnow)
    fecha_actualizacion = Column(DateTime, nullable=False, default=datetime.utcnow)


class ProductoCatalogo(Base):
    __tablename__ = "catalogo_productos"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    catalogo_id = Column(String(36), ForeignKey("catalogos_empresa.id", ondelete="CASCADE"), nullable=False, index=True)
    nombre = Column(String(120), nullable=False)
    descripcion = Column(Text, nullable=True)
    fotos = Column(JSON, nullable=False, default=list)
    linea_producto = Column(String(100), nullable=True)
    pais_origen = Column(String(100), nullable=False, default="China")
    cantidad_minima = Column(Float, nullable=True)
    unidad_cantidad = Column(String(10), nullable=False, default="unidades")
    tiempo_estimado = Column(String(80), nullable=True)
    que_pedir_en_cotizacion = Column(Text, nullable=True)
    orden = Column(Integer, nullable=False, default=0)
    activo = Column(Boolean, nullable=False, default=True, server_default="1")
    fecha_creacion = Column(DateTime, nullable=False, default=datetime.utcnow)
    fecha_actualizacion = Column(DateTime, nullable=False, default=datetime.utcnow)


class AccesoCatalogo(Base):
    """Comprador al que la empresa le desbloqueó el catálogo a mano."""
    __tablename__ = "catalogo_accesos"
    __table_args__ = (UniqueConstraint("catalogo_id", "usuario_id", name="uq_catalogo_acceso"),)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    catalogo_id = Column(String(36), ForeignKey("catalogos_empresa.id", ondelete="CASCADE"), nullable=False, index=True)
    usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False, index=True)
    otorgado_por = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    fecha = Column(DateTime, nullable=False, default=datetime.utcnow)

