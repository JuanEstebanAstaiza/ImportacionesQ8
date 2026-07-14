import enum
from uuid import uuid4
from datetime import datetime

from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey

from database import Base


class PropositoOtp(str, enum.Enum):
    verificacion_email = "verificacion_email"
    login_tardio = "login_tardio"


class CodigoOtp(Base):
    """
    OTP de un solo uso para verificación de email al registrarse y para
    re-autenticación cuando el último login supera LOGIN_TARDIO_HORAS (72h).
    El código se guarda hasheado; en login tardío también un challenge_token.
    """
    __tablename__ = "codigos_otp"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False, index=True)
    proposito = Column(String(30), nullable=False, index=True)
    otp_hash = Column(String(64), nullable=False)
    challenge_token_hash = Column(String(64), nullable=True, unique=True, index=True)
    expira_en = Column(DateTime, nullable=False)
    usado = Column(Boolean, default=False, nullable=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<CodigoOtp(id={self.id}, proposito={self.proposito}, usado={self.usado})>"
