from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey
from uuid import uuid4
from datetime import datetime
from database import Base


class PasswordResetToken(Base):
    """
    Token de un solo uso para recuperación de contraseña (Semana 4): combina un
    token opaco (para el enlace por correo) y un OTP de 6 dígitos (segundo
    factor, para blindar el flujo aunque el enlace se filtre). Ambos se guardan
    hasheados (SHA-256) — nunca en texto plano — y expiran a los pocos minutos.
    """
    __tablename__ = "password_reset_tokens"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    otp_hash = Column(String(64), nullable=False)
    expira_en = Column(DateTime, nullable=False)
    usado = Column(Boolean, default=False, nullable=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<PasswordResetToken(id={self.id}, usuario_id={self.usuario_id}, usado={self.usado})>"
