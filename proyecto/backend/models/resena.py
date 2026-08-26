from sqlalchemy import Column, String, Integer, Text, DateTime, Boolean, ForeignKey, UniqueConstraint
from uuid import uuid4
from datetime import datetime
from database import Base


class ResenaImportador(Base):
    """Reseña de un solicitante sobre la empresa importadora que le atendió.

    Solo puede reseñar quien tuvo una **orden real** con esa empresa: sin ese
    requisito el catálogo se llena de opiniones de gente que nunca importó nada,
    y la calificación deja de significar algo. La restricción única por orden
    impide además que un mismo trato se puntúe varias veces.

    `Importador.calificacion_promedio` se recalcula a partir de estas filas
    (ver `services/resena_service.py`): antes era un número suelto que nadie
    alimentaba y que el catálogo mostraba como si fuera real.
    """

    __tablename__ = "resenas_importador"
    __table_args__ = (
        UniqueConstraint("orden_id", name="unique_resena_por_orden"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    importador_id = Column(String(36), ForeignKey("importadores.id"), nullable=False, index=True)
    # Quien escribe: el solicitante dueño de la orden.
    autor_usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False, index=True)
    # La orden que da derecho a opinar. Es 1:1 con la reseña.
    orden_id = Column(String(36), ForeignKey("ordenes.id"), nullable=False)

    calificacion = Column(Integer, nullable=False)  # 1..5
    comentario = Column(Text, nullable=True)

    # Desglose opcional: ayuda a que la nota global no dependa de una sola
    # impresión y a que la empresa sepa en qué falló.
    puntualidad = Column(Integer, nullable=True)      # 1..5
    calidad_producto = Column(Integer, nullable=True)  # 1..5
    comunicacion = Column(Integer, nullable=True)      # 1..5

    # Respuesta pública de la empresa. Una reseña sin derecho de réplica es
    # injusta para quien la recibe.
    respuesta_empresa = Column(Text, nullable=True)
    fecha_respuesta = Column(DateTime, nullable=True)

    # Moderación: el admin puede ocultar una reseña abusiva sin borrar el
    # historial ni alterar la trazabilidad de la orden.
    visible = Column(Boolean, default=True, nullable=False)
    motivo_ocultacion = Column(Text, nullable=True)

    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<ResenaImportador(id={self.id}, importador_id={self.importador_id}, calificacion={self.calificacion})>"
