from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from uuid import uuid4
from datetime import datetime
from database import Base

# Roles válidos del sistema:
# - "solicitante": cliente final que pide cotizaciones (único rol auto-registrable vía /auth/register)
# - "importador": cuenta "dueña" de una empresa importadora (creada solo por un admin, junto con su Importador)
# - "trabajador": empleado de una empresa importadora, creado por la cuenta dueña (Usuario.importador_id la vincula)
# - "admin": equipo de la plataforma (creado solo por otro admin o por script de seed)
ROLES_VALIDOS = ("solicitante", "importador", "trabajador", "admin")

class Usuario(Base):
    __tablename__ = "usuarios"

    # Usar String(36) para UUID portable entre MySQL y SQLite
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    rol = Column(String(20), nullable=False)  # "solicitante", "importador", "trabajador" o "admin"
    # Vincula la cuenta a una empresa importadora (dueño o trabajador). NULL para
    # solicitante/admin. Se usa para toda la lógica de autorización de la empresa,
    # en lugar de asumir que Usuario.id == Importador.id.
    importador_id = Column(String(36), ForeignKey("importadores.id"), nullable=True)
    nombre = Column(String(255), nullable=True)
    telefono = Column(String(30), nullable=True)
    foto_url = Column(String(500), nullable=True)
    whatsapp = Column(String(20), nullable=True)
    # Permite desactivar una cuenta (por el dueño de la empresa a un trabajador, o
    # por un admin a cualquier cuenta) sin borrar su historial. Una cuenta inactiva
    # no puede iniciar sesión.
    activo = Column(Boolean, default=True, nullable=False)
    perfil_completo = Column(Boolean, default=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Usuario(id={self.id}, email={self.email}, rol={self.rol})>"
