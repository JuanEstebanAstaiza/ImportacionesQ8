from sqlalchemy import Column, String, Float, DateTime, Boolean, ForeignKey, UniqueConstraint
from uuid import uuid4
from datetime import datetime
import enum
from database import Base


class RolOrganizacion(str, enum.Enum):
    owner = "owner"
    admin = "admin"
    member = "member"


class OrganizacionSolicitante(Base):
    """
    Empresa solicitante (persona jurídica que cotiza) con wallet corporativo.
    Las importadoras NO tienen créditos: pagan por contrato externo.
    """
    __tablename__ = "organizaciones_solicitantes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    razon_social = Column(String(255), nullable=False)
    nit = Column(String(50), nullable=False, index=True)
    creditos_balance = Column(Float, default=0.0, nullable=False)
    owner_usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    activo = Column(Boolean, default=True, nullable=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<OrganizacionSolicitante(id={self.id}, nit={self.nit})>"


class MiembroOrganizacion(Base):
    __tablename__ = "miembros_organizacion"
    __table_args__ = (
        UniqueConstraint("organizacion_id", "usuario_id", name="unique_miembro_org_usuario"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    organizacion_id = Column(String(36), ForeignKey("organizaciones_solicitantes.id"), nullable=False, index=True)
    usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False, index=True)
    rol_org = Column(String(20), nullable=False, default=RolOrganizacion.member.value)
    activo = Column(Boolean, default=True, nullable=False)
    fecha_alta = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<MiembroOrganizacion(org={self.organizacion_id}, user={self.usuario_id}, rol={self.rol_org})>"
