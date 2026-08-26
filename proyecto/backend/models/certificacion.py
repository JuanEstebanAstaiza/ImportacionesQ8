"""Certificaciones que la plataforma otorga a las empresas importadoras.

Son un sello propio, no una certificación externa autodeclarada: solo un admin
puede crearlas y asignarlas, y cada una lleva un `peso_publicidad` que decide
qué tan arriba aparece la empresa en el catálogo del solicitante.
"""
from datetime import datetime
from uuid import uuid4

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Index, String, Text, UniqueConstraint,
)

from database import Base


class Certificacion(Base):
    """Catálogo de sellos creado desde el panel de administración."""
    __tablename__ = "certificaciones"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    nombre = Column(String(120), nullable=False, unique=True)
    descripcion = Column(Text, nullable=False, default="")
    # Ruta en gestión documental (`/documentos/archivos/<id>/descargar`).
    logo_url = Column(String(500), nullable=True)
    # Cuánto empuja a la empresa hacia arriba en el catálogo. El puntaje de una
    # empresa es la suma de los pesos de sus certificaciones vigentes.
    peso_publicidad = Column(Float, nullable=False, default=0.0)
    # Desactivar un sello lo retira del catálogo público sin borrar el historial
    # de a quién se le había otorgado.
    activa = Column(Boolean, nullable=False, default=True)
    creada_por_admin_id = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Certificacion(id={self.id}, nombre={self.nombre}, peso={self.peso_publicidad})>"


class CertificacionImportador(Base):
    """Otorgamiento de un sello a una empresa concreta."""
    __tablename__ = "certificaciones_importador"
    __table_args__ = (
        UniqueConstraint("certificacion_id", "importador_id", name="unique_certificacion_importador"),
        Index("ix_certificacion_importador_vigente", "importador_id", "revocada_at"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    certificacion_id = Column(String(36), ForeignKey("certificaciones.id"), nullable=False, index=True)
    importador_id = Column(String(36), ForeignKey("importadores.id"), nullable=False, index=True)
    otorgada_por_admin_id = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    notas = Column(Text, nullable=True)
    fecha_otorgada = Column(DateTime, default=datetime.utcnow)
    # Revocar en vez de borrar: queda la traza de que el sello estuvo vigente.
    revocada_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<CertificacionImportador(cert={self.certificacion_id}, imp={self.importador_id})>"
