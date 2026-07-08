from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from uuid import uuid4
from datetime import datetime
import enum
from database import Base


class ParteAtribuida(str, enum.Enum):
    solicitante = "solicitante"
    importador = "importador"


class EstadoSolicitudRecreacion(str, enum.Enum):
    pendiente = "pendiente"
    aprobada = "aprobada"
    rechazada = "rechazada"


class SolicitudRecreacion(Base):
    """
    Solicitud de "anular y recrear" una cotización ya aceptada, cuando alguna de
    las partes cometió un error durante la negociación por chat (Semana 4).

    Un admin revisa el motivo y decide qué parte fue realmente responsable: si
    determina que fue la empresa importadora, el solicitante queda eximido del
    costo en créditos de la cotización de reemplazo (se le reembolsa el costo
    equivalente vía `MovimientoCredito` tipo "reembolso").
    """
    __tablename__ = "solicitudes_recreacion"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    cotizacion_origen_id = Column(String(36), ForeignKey("cotizaciones.id"), nullable=False)
    solicitado_por_usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    motivo = Column(Text, nullable=False)
    parte_atribuida_sugerida = Column(String(20), nullable=False)  # "solicitante" | "importador"
    estado = Column(String(20), default=EstadoSolicitudRecreacion.pendiente, nullable=False)
    parte_atribuida_final = Column(String(20), nullable=True)
    resuelto_por_admin_id = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_resolucion = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<SolicitudRecreacion(id={self.id}, cotizacion_origen_id={self.cotizacion_origen_id}, estado={self.estado})>"
