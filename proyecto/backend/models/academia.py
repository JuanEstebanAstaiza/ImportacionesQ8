"""Módulo académico: cursos de importadoras, compras de solicitantes y progreso."""
from sqlalchemy import (
    Column, String, Text, DateTime, ForeignKey, Integer, Float, Boolean, UniqueConstraint,
)
from uuid import uuid4
from datetime import datetime
import enum
from database import Base


class EstadoCurso(str, enum.Enum):
    borrador = "borrador"
    publicado = "publicado"
    archivado = "archivado"


class TipoLeccion(str, enum.Enum):
    video = "video"
    texto = "texto"
    recurso = "recurso"


class EstadoCompraCurso(str, enum.Enum):
    pendiente = "pendiente"
    confirmada = "confirmada"
    fallida = "fallida"
    reembolsada = "reembolsada"


class Curso(Base):
    """Curso ofrecido por una empresa importadora."""
    __tablename__ = "cursos"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    importador_id = Column(String(36), ForeignKey("importadores.id"), nullable=False, index=True)
    creado_por_usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    titulo = Column(String(255), nullable=False)
    descripcion = Column(Text, nullable=True)
    categoria = Column(String(100), nullable=True, index=True)  # ej. importacion, productos_ganadores
    precio_usd = Column(Float, nullable=False, default=0.0)
    imagen_url = Column(String(500), nullable=True)
    estado = Column(String(20), nullable=False, default=EstadoCurso.borrador.value, index=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Curso(id={self.id}, titulo={self.titulo}, estado={self.estado})>"


class CursoLeccion(Base):
    """Lección/video de un curso (unidad de progreso)."""
    __tablename__ = "curso_lecciones"
    __table_args__ = (
        UniqueConstraint("curso_id", "orden", name="uq_curso_leccion_orden"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    curso_id = Column(String(36), ForeignKey("cursos.id"), nullable=False, index=True)
    titulo = Column(String(255), nullable=False)
    descripcion = Column(Text, nullable=True)
    tipo = Column(String(20), nullable=False, default=TipoLeccion.video.value)
    contenido_url = Column(String(500), nullable=True)  # URL video/recurso
    contenido_texto = Column(Text, nullable=True)  # lección tipo texto
    orden = Column(Integer, nullable=False, default=1)
    duracion_segundos = Column(Integer, nullable=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<CursoLeccion(id={self.id}, curso_id={self.curso_id}, orden={self.orden})>"


class CompraCurso(Base):
    """Compra de un curso por un solicitante."""
    __tablename__ = "compras_curso"
    __table_args__ = (
        UniqueConstraint("curso_id", "comprador_id", name="uq_compra_curso_comprador"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    curso_id = Column(String(36), ForeignKey("cursos.id"), nullable=False, index=True)
    comprador_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False, index=True)
    precio_pagado_usd = Column(Float, nullable=False, default=0.0)
    estado = Column(String(20), nullable=False, default=EstadoCompraCurso.pendiente.value, index=True)
    wompi_payment_id = Column(String(100), unique=True, nullable=True, index=True)
    checkout_url = Column(String(500), nullable=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_confirmacion = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<CompraCurso(id={self.id}, curso_id={self.curso_id}, estado={self.estado})>"


class ProgresoLeccion(Base):
    """Marca una lección como completada por un solicitante (tras compra confirmada)."""
    __tablename__ = "progreso_lecciones"
    __table_args__ = (
        UniqueConstraint("usuario_id", "leccion_id", name="uq_progreso_usuario_leccion"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False, index=True)
    curso_id = Column(String(36), ForeignKey("cursos.id"), nullable=False, index=True)
    leccion_id = Column(String(36), ForeignKey("curso_lecciones.id"), nullable=False, index=True)
    compra_id = Column(String(36), ForeignKey("compras_curso.id"), nullable=False, index=True)
    completada = Column(Boolean, nullable=False, default=True)
    fecha_completada = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<ProgresoLeccion(usuario={self.usuario_id}, leccion={self.leccion_id})>"
