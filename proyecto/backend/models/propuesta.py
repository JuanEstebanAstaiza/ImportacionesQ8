from sqlalchemy import Column, String, Float, Boolean, DateTime, Text, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship, object_session
from uuid import uuid4
from datetime import datetime
import enum
from database import Base

class EstadoPropuesta(str, enum.Enum):
    borrador = "borrador"  # El asesor la redacta/edita; el solicitante todavía no la ve
    pendiente = "pendiente"  # El dueño la envió (categoría OK); visible para el solicitante
    aceptada = "aceptada"
    rechazada = "rechazada"

class Propuesta(Base):
    __tablename__ = "propuestas"

    # Usar String(36) para UUID portable entre MySQL y SQLite
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    cotizacion_id = Column(String(36), ForeignKey("cotizaciones.id"), nullable=False)
    importador_id = Column(String(36), nullable=False)
    precio_ofrecido_usd = Column(Float, nullable=False)
    tiempo_estimado_entrega = Column(String(100), nullable=False)  # ej: "45 días"
    incoterm = Column(String(50), nullable=False)  # Incoterm propuesto por el importador (FOB, CIF, EXW, DDP...)
    condiciones_adicionales = Column(Text, nullable=True)
    estado = Column(String(20), default=EstadoPropuesta.pendiente)  # "borrador", "pendiente", "aceptada", "rechazada"
    fecha_envio = Column(DateTime, default=datetime.utcnow)
    # Cantidad que cubre el precio (en la unidad de la cotización). NULL = la
    # cantidad pedida por el cliente.
    cantidad = Column(Float, nullable=True)

    # --- Descarte: el cliente eligió otra propuesta ---
    motivo_descarte = Column(String(20), nullable=True)  # precio, tiempo, condiciones, otro
    motivo_descarte_detalle = Column(Text, nullable=True)
    fecha_descarte = Column(DateTime, nullable=True)

    # --- Redacción por asesor / envío por dueño (Semana 4) ---
    # Cuenta (asesor o dueño) que redactó/editó por última vez esta propuesta.
    creado_por_usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=True)

    # --- Doble aceptación mutua (Semana 4) ---
    # Ambos flags deben quedar en True (en cualquier orden) para que la propuesta
    # pase a "aceptada" y se cree la Orden automáticamente (ver routers/cotizaciones.py).
    preaceptada_por_solicitante = Column(Boolean, default=False, nullable=False)
    preaceptada_por_empresa = Column(Boolean, default=False, nullable=False)

    # Restricción única: un importador solo puede enviar UNA propuesta por cotización
    __table_args__ = (
        UniqueConstraint("cotizacion_id", "importador_id", name="unique_propuesta_cotizacion_importador"),
    )

    # Relaciones
    cotizacion = relationship("Cotizacion", back_populates="propuestas")

    # --- Navegación cruzada (Semana 4 - Fase 7) ---
    @property
    def contacto_asesor(self):
        """Contacto de quien redactó esta propuesta (asesor) o, en su defecto, el
        dueño de la empresa que la envió."""
        session = object_session(self)
        if session is None:
            return None

        from models.usuario import Usuario

        usuario = None
        if self.creado_por_usuario_id:
            usuario = session.query(Usuario).filter(Usuario.id == self.creado_por_usuario_id).first()
        if usuario is None:
            usuario = session.query(Usuario).filter(
                Usuario.importador_id == self.importador_id,
                Usuario.rol == "importador"
            ).first()

        if usuario is None:
            return None

        return {
            "usuario_id": str(usuario.id),
            "nombre": usuario.nombre,
            "foto_url": usuario.foto_url,
            "whatsapp": usuario.whatsapp,
        }

    def __repr__(self):
        return f"<Propuesta(id={self.id}, cotizacion_id={self.cotizacion_id}, importador_id={self.importador_id}, estado={self.estado})>"