from sqlalchemy import Column, String, Boolean, DateTime, Float, ForeignKey, Integer
from uuid import uuid4
from datetime import datetime
import enum
from database import Base

# Roles válidos del sistema:
# - "solicitante": cliente final que pide cotizaciones (único rol auto-registrable vía /auth/register)
# - "importador": cuenta "dueña" de una empresa importadora (creada solo por un admin, junto con su Importador)
# - "asesor": empleado/asesor de una empresa importadora, creado por la cuenta dueña (Usuario.importador_id la
#   vincula). Antes llamado "asesor" (Semana 3); renombrado en la Semana 4 para reflejar su rol real:
#   reclama cotizaciones del pool de su empresa, redacta y negocia propuestas por chat.
# - "admin": equipo de la plataforma (creado solo por otro admin o por script de seed)
# - "soporte": agente de atención al cliente de la plataforma, creado por un admin. Atiende los
#   tickets de soporte y resuelve incidentes de órdenes, pero NO administra la plataforma: no da
#   de alta empresas ni usuarios, no toca certificaciones ni copias de seguridad.
ROLES_VALIDOS = ("solicitante", "importador", "asesor", "admin", "soporte")

# Cuentas del equipo de la plataforma: comparten la bandeja de soporte y las
# acciones de resolución. Se agrupan aquí para no repetir la pareja por todo el
# código y que añadir un rol interno mañana sea un solo cambio.
ROLES_PLATAFORMA = ("admin", "soporte")

# Mesa de soporte por niveles: 1 atiende lo corriente, 3 lo que requiere más
# experiencia. Un agente puede atender su nivel y todos los inferiores; nunca
# uno superior, que es justamente lo que evita mandarle un caso difícil a
# alguien que acaba de entrar.
NIVEL_SOPORTE_MINIMO = 1
NIVEL_SOPORTE_MAXIMO = 3

TIPOS_PERSONA_VALIDOS = ("natural", "juridica")


class TierCotizante(str, enum.Enum):
    bronze = "Bronze"
    silver = "Silver"
    gold = "Gold"
    elite = "Élite"


ORDEN_TIERS_COTIZANTE = {
    TierCotizante.bronze.value: 0,
    TierCotizante.silver.value: 1,
    TierCotizante.gold.value: 2,
    TierCotizante.elite.value: 3,
}

class Usuario(Base):
    __tablename__ = "usuarios"

    # Usar String(36) para UUID portable entre MySQL y SQLite
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    rol = Column(String(20), nullable=False)  # "solicitante", "importador", "asesor" o "admin"
    # Vincula la cuenta a una empresa importadora (dueño o asesor). NULL para
    # solicitante/admin. Se usa para toda la lógica de autorización de la empresa,
    # en lugar de asumir que Usuario.id == Importador.id.
    importador_id = Column(String(36), ForeignKey("importadores.id"), nullable=True)
    # Organización solicitante (solo quien cotiza). Si está set, el wallet efectivo
    # es el de la organización (créditos corporativos). Las importadoras no usan esto.
    organizacion_id = Column(
        String(36),
        ForeignKey("organizaciones_solicitantes.id", use_alter=True, name="fk_usuarios_organizacion_id"),
        nullable=True,
        index=True,
    )
    nombre = Column(String(255), nullable=True)
    apellido = Column(String(255), nullable=True)  # Solo persona natural
    telefono = Column(String(30), nullable=True)
    indicativo_pais_telefono = Column(String(6), nullable=True)  # Ej. "+57"
    foto_url = Column(String(500), nullable=True)
    whatsapp = Column(String(20), nullable=True)

    # --- Datos de registro (Semana 4): distinción persona natural / jurídica ---
    # Solo aplica al rol "solicitante"; las cuentas "importador"/"asesor"/"admin" se
    # crean por vías administrativas y no pasan por este formulario.
    tipo_persona = Column(String(10), nullable=True)  # "natural" | "juridica"
    tipo_documento = Column(String(30), nullable=True)  # cédula, pasaporte, cédula de extranjería, etc.
    numero_documento = Column(String(50), nullable=True)  # persona natural
    nit = Column(String(50), nullable=True)  # persona jurídica
    razon_social = Column(String(255), nullable=True)  # persona jurídica (nombre de la empresa)
    acepto_politica_datos = Column(Boolean, default=False, nullable=False)
    fecha_aceptacion_politica = Column(DateTime, nullable=True)

    # Saldo de créditos personal (solicitante natural). Si pertenece a una
    # organización, el saldo efectivo es OrganizacionSolicitante.creditos_balance.
    creditos_balance = Column(Float, default=0.0, nullable=False)
    tier = Column(String(10), default=TierCotizante.bronze.value, server_default=TierCotizante.bronze.value, nullable=False)
    tier_manual = Column(Boolean, default=False, server_default="0", nullable=False)
    puntos_cotizacion = Column(Integer, default=0, server_default="0", nullable=False)

    # Nivel de la mesa de soporte al que pertenece esta cuenta (solo rol
    # "soporte"). Determina qué tickets se le pueden asignar. NULL en el resto.
    nivel_soporte = Column(Integer, nullable=True)

    # Permite desactivar una cuenta (por el dueño de la empresa a un asesor, o
    # por un admin a cualquier cuenta) sin borrar su historial. Una cuenta inactiva
    # no puede iniciar sesión.
    activo = Column(Boolean, default=True, nullable=False)
    # Auto-registro: False hasta OTP de verificación. Cuentas admin/asesor/importador: True.
    email_verificado = Column(Boolean, default=False, nullable=False)
    # Último login exitoso (JWT emitido). Si supera LOGIN_TARDIO_HORAS → OTP.
    ultimo_login_at = Column(DateTime, nullable=True)
    perfil_completo = Column(Boolean, default=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Usuario(id={self.id}, email={self.email}, rol={self.rol})>"
