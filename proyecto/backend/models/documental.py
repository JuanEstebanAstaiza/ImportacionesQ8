from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, Index
from sqlalchemy.orm import relationship

from database import Base


class Carpeta(Base):
    __tablename__ = "carpetas"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    owner_user_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False, index=True)
    parent_id = Column(String(36), ForeignKey("carpetas.id"), nullable=True, index=True)
    nombre = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)

    parent = relationship("Carpeta", remote_side=[id], backref="children")


class Archivo(Base):
    __tablename__ = "archivos"
    __table_args__ = (
        Index("ix_archivos_owner_parent_deleted", "owner_user_id", "carpeta_id", "deleted_at"),
        Index("ix_archivos_owner_tipo_deleted", "owner_user_id", "tipo_recurso", "deleted_at"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    owner_user_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False, index=True)
    carpeta_id = Column(String(36), ForeignKey("carpetas.id"), nullable=True, index=True)
    nombre = Column(String(255), nullable=False)
    extension = Column(String(12), nullable=False)
    mime_type = Column(String(120), nullable=False)
    tipo_recurso = Column(String(20), nullable=False, index=True)
    size_bytes = Column(Integer, nullable=True)
    storage_url = Column(String(500), nullable=True)
    storage_path = Column(String(500), nullable=True)
    origen = Column(String(30), nullable=False, default="manual")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)


class Etiqueta(Base):
    __tablename__ = "etiquetas"
    __table_args__ = (
        UniqueConstraint("owner_user_id", "nombre", name="uq_etiqueta_owner_nombre"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    owner_user_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    color = Column(String(24), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)


class ArchivoEtiqueta(Base):
    __tablename__ = "archivo_etiquetas"
    __table_args__ = (
        UniqueConstraint("archivo_id", "etiqueta_id", name="uq_archivo_etiqueta"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    archivo_id = Column(String(36), ForeignKey("archivos.id"), nullable=False, index=True)
    etiqueta_id = Column(String(36), ForeignKey("etiquetas.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)


class Favorito(Base):
    __tablename__ = "favoritos"
    __table_args__ = (
        UniqueConstraint("owner_user_id", "recurso_tipo", "recurso_id", name="uq_favorito_recurso"),
        Index("ix_favorito_owner_deleted", "owner_user_id", "deleted_at"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    owner_user_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False, index=True)
    recurso_tipo = Column(String(20), nullable=False)
    recurso_id = Column(String(36), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)


class CursoRecurso(Base):
    __tablename__ = "curso_recursos"
    __table_args__ = (
        UniqueConstraint("curso_id", "leccion_id", "archivo_id", name="uq_curso_leccion_archivo"),
        Index("ix_curso_recurso_archivo_deleted", "archivo_id", "deleted_at"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    curso_id = Column(String(36), ForeignKey("cursos.id"), nullable=False, index=True)
    leccion_id = Column(String(36), ForeignKey("lecciones_curso.id"), nullable=True, index=True)
    archivo_id = Column(String(36), ForeignKey("archivos.id"), nullable=False, index=True)
    tipo = Column(String(30), nullable=False, default="material")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)


class MensajeAdjunto(Base):
    __tablename__ = "mensajes_adjuntos"
    __table_args__ = (
        UniqueConstraint("mensaje_id", "archivo_id", name="uq_mensaje_archivo"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    mensaje_id = Column(String(36), ForeignKey("mensajes_chat.id"), nullable=False, index=True)
    archivo_id = Column(String(36), ForeignKey("archivos.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)


class OrdenDocumento(Base):
    __tablename__ = "orden_documentos"
    __table_args__ = (
        UniqueConstraint("orden_id", "archivo_id", name="uq_orden_archivo"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    orden_id = Column(String(36), ForeignKey("ordenes.id"), nullable=False, index=True)
    archivo_id = Column(String(36), ForeignKey("archivos.id"), nullable=False, index=True)
    tipo = Column(String(40), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)
