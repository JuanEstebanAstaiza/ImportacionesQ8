"""Módulo LMS de cursos (estilo Domestika): catálogo, compra/inscripción y progreso."""
from sqlalchemy import (
    Column, String, Text, DateTime, Float, Integer, Boolean, ForeignKey,
    UniqueConstraint, Index,
)
from sqlalchemy.orm import relationship
from uuid import uuid4
from datetime import datetime
import enum
from database import Base


class NivelCurso(str, enum.Enum):
    principiante = "Principiante"
    avanzado = "Avanzado"


class TipoRecursoLeccion(str, enum.Enum):
    archivo = "archivo"
    plantilla = "plantilla"
    checklist = "checklist"
    guia = "guia"


class EstadoCurso(str, enum.Enum):
    borrador = "borrador"
    publicado = "publicado"
    archivado = "archivado"


class Curso(Base):
    """Curso publicado por una empresa importadora."""
    __tablename__ = "cursos"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    slug = Column(String(280), unique=True, nullable=False, index=True)
    titulo = Column(String(255), nullable=False)
    descripcion = Column(Text, nullable=False, default="")
    portada_url = Column(String(500), nullable=True)
    precio = Column(Float, nullable=False, default=0.0)
    nivel = Column(String(30), nullable=False, default=NivelCurso.principiante.value)
    categoria = Column(String(120), nullable=False, default="General", index=True)
    importador_id = Column(String(36), ForeignKey("importadores.id"), nullable=False, index=True)
    creado_por_usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    rating = Column(Float, nullable=False, default=0.0)
    estudiantes_count = Column(Integer, nullable=False, default=0)
    estado = Column(String(20), nullable=False, default=EstadoCurso.publicado.value, index=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    modulos = relationship(
        "ModuloCurso",
        back_populates="curso",
        cascade="all, delete-orphan",
        order_by="ModuloCurso.orden",
    )
    compras = relationship("CompraCurso", back_populates="curso", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Curso(id={self.id}, slug={self.slug}, titulo={self.titulo})>"


class ModuloCurso(Base):
    __tablename__ = "modulos_curso"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    curso_id = Column(String(36), ForeignKey("cursos.id"), nullable=False, index=True)
    titulo = Column(String(255), nullable=False)
    orden = Column(Integer, nullable=False, default=0)

    curso = relationship("Curso", back_populates="modulos")
    lecciones = relationship(
        "LeccionCurso",
        back_populates="modulo",
        cascade="all, delete-orphan",
        order_by="LeccionCurso.orden",
    )

    def __repr__(self):
        return f"<ModuloCurso(id={self.id}, titulo={self.titulo})>"


class LeccionCurso(Base):
    __tablename__ = "lecciones_curso"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    modulo_id = Column(String(36), ForeignKey("modulos_curso.id"), nullable=False, index=True)
    curso_id = Column(String(36), ForeignKey("cursos.id"), nullable=False, index=True)
    titulo = Column(String(255), nullable=False)
    duracion = Column(String(30), nullable=False, default="10 min")
    video_url = Column(String(500), nullable=False)
    orden = Column(Integer, nullable=False, default=0)
    # Primera lección del curso puede usarse como vista previa pública
    es_preview = Column(Boolean, nullable=False, default=False)

    modulo = relationship("ModuloCurso", back_populates="lecciones")
    recursos = relationship(
        "RecursoLeccion",
        back_populates="leccion",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<LeccionCurso(id={self.id}, titulo={self.titulo})>"


class RecursoLeccion(Base):
    __tablename__ = "recursos_leccion"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    leccion_id = Column(String(36), ForeignKey("lecciones_curso.id"), nullable=False, index=True)
    nombre = Column(String(255), nullable=False)
    url = Column(String(500), nullable=False)
    tipo = Column(String(30), nullable=False, default=TipoRecursoLeccion.archivo.value)
    deleted_at = Column(DateTime, nullable=True)

    leccion = relationship("LeccionCurso", back_populates="recursos")

    def __repr__(self):
        return f"<RecursoLeccion(id={self.id}, nombre={self.nombre})>"


class CompraCurso(Base):
    """Inscripción/compra de un curso por un solicitante (u otro usuario autenticado)."""
    __tablename__ = "compras_curso"
    __table_args__ = (
        UniqueConstraint("curso_id", "usuario_id", name="unique_compra_curso_usuario"),
        Index("ix_compras_curso_usuario", "usuario_id"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    curso_id = Column(String(36), ForeignKey("cursos.id"), nullable=False, index=True)
    usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    precio_pagado = Column(Float, nullable=False, default=0.0)
    fecha_compra = Column(DateTime, default=datetime.utcnow)

    curso = relationship("Curso", back_populates="compras")

    def __repr__(self):
        return f"<CompraCurso(curso_id={self.curso_id}, usuario_id={self.usuario_id})>"


class CertificadoCurso(Base):
    """Certificado de finalización emitido a un alumno que completó el curso."""
    __tablename__ = "certificados_curso"
    __table_args__ = (
        UniqueConstraint("curso_id", "usuario_id", name="unique_certificado_curso_usuario"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    curso_id = Column(String(36), ForeignKey("cursos.id"), nullable=False, index=True)
    usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False, index=True)
    # Archivo PDF en gestión documental (propiedad del alumno).
    archivo_id = Column(String(36), ForeignKey("archivos.id"), nullable=False)
    fecha_emision = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<CertificadoCurso(curso_id={self.curso_id}, usuario_id={self.usuario_id})>"


class ProgresoLeccion(Base):
    """Marca de lección completada y última vista por usuario/curso."""
    __tablename__ = "progreso_lecciones"
    __table_args__ = (
        UniqueConstraint("usuario_id", "leccion_id", name="unique_progreso_usuario_leccion"),
        Index("ix_progreso_usuario_curso", "usuario_id", "curso_id"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    curso_id = Column(String(36), ForeignKey("cursos.id"), nullable=False)
    leccion_id = Column(String(36), ForeignKey("lecciones_curso.id"), nullable=False)
    completada = Column(Boolean, nullable=False, default=True)
    fecha_completado = Column(DateTime, nullable=True)
    fecha_ultima_vista = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<ProgresoLeccion(usuario_id={self.usuario_id}, leccion_id={self.leccion_id})>"
