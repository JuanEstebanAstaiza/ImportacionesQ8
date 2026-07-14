from sqlalchemy import Column, String, DateTime, ForeignKey
from datetime import datetime
from database import Base


class JwtBlacklist(Base):
    """Tokens JWT revocados (logout). jti = claim único del token."""
    __tablename__ = "jwt_blacklist"

    jti = Column(String(64), primary_key=True)
    usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False, index=True)
    expira_en = Column(DateTime, nullable=False, index=True)
    fecha_revocacion = Column(DateTime, default=datetime.utcnow)
