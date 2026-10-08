"""Reto comunitario de Tendencias: «te pagamos por subir los productos más virales».

Rondas de cupos limitados (por ejemplo, 20 personas). Cada participante sube
enlaces; cuando el equipo le aprueba `umbral_aprobados` (10), puede reclamar
una recompensa: $50.000 por transferencia o un saldo de cotizaciones gratis.
Una recompensa por persona y ronda. Al llenarse los cupos, la ronda deja de
aceptar inscripciones y, si así está configurada, se abre la siguiente.

La plataforma no mueve dinero: el pago se hace a mano por transferencia y aquí
solo queda a quién, cuánto, cuándo y con qué referencia.
"""
import enum
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint

from database import Base


class EstadoRonda(str, enum.Enum):
    abierta = "abierta"   # acepta inscripciones
    llena = "llena"       # sin cupos; los inscritos siguen enviando hasta la fecha límite
    cerrada = "cerrada"   # terminó (vencida o cerrada por el admin)


class EleccionRecompensa(str, enum.Enum):
    efectivo = "efectivo"
    cotizaciones = "cotizaciones"


class EstadoRecompensa(str, enum.Enum):
    pendiente = "pendiente"        # aún no llega al umbral
    reclamable = "reclamable"      # llegó: puede elegir
    solicitada = "solicitada"      # eligió efectivo: falta pagar
    pagada = "pagada"              # transferida o acreditada


class RetoRonda(Base):
    __tablename__ = "reto_rondas"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    nombre = Column(String(80), nullable=False)
    max_participantes = Column(Integer, nullable=False, default=20)
    umbral_aprobados = Column(Integer, nullable=False, default=10)
    recompensa_cop = Column(Integer, nullable=False, default=50000)
    recompensa_cotizaciones = Column(Integer, nullable=False, default=5)
    fecha_limite = Column(DateTime, nullable=False)
    estado = Column(String(20), nullable=False, default=EstadoRonda.abierta.value, index=True)
    abrir_siguiente_al_llenarse = Column(Boolean, nullable=False, default=True, server_default="1")
    creada_por = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    fecha_creacion = Column(DateTime, nullable=False, default=datetime.utcnow)


class RetoParticipacion(Base):
    __tablename__ = "reto_participaciones"
    __table_args__ = (UniqueConstraint("ronda_id", "usuario_id", name="uq_reto_participacion"),)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    ronda_id = Column(String(36), ForeignKey("reto_rondas.id"), nullable=False, index=True)
    usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False, index=True)
    aprobados = Column(Integer, nullable=False, default=0, server_default="0")
    eleccion = Column(String(20), nullable=True)
    estado_recompensa = Column(String(20), nullable=False, default=EstadoRecompensa.pendiente.value)
    pagado_en = Column(DateTime, nullable=True)
    referencia_pago = Column(String(120), nullable=True)
    aviso_faltan_pocos = Column(Boolean, nullable=False, default=False, server_default="0")
    ultimo_envio_en = Column(DateTime, nullable=True)
    ultimo_aviso_inactividad = Column(DateTime, nullable=True)
    fecha_inscripcion = Column(DateTime, nullable=False, default=datetime.utcnow)


class CuentaPago(Base):
    """Datos bancarios para transferir la recompensa. Número de cuenta y
    documento van cifrados (Fernet); solo los ve el rol admin."""
    __tablename__ = "cuentas_pago"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False, unique=True)
    banco = Column(String(80), nullable=False)
    tipo_cuenta = Column(String(20), nullable=False)
    numero_cifrado = Column(Text, nullable=False)
    ultimos_digitos = Column(String(4), nullable=False)
    titular = Column(String(150), nullable=False)
    documento_cifrado = Column(Text, nullable=False)
    fecha_actualizacion = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class RetoListaEspera(Base):
    """«Ronda cerrada. Avisame de la próxima»."""
    __tablename__ = "reto_lista_espera"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    email = Column(String(255), nullable=False, unique=True)
    usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    avisado_en = Column(DateTime, nullable=True)
    fecha = Column(DateTime, nullable=False, default=datetime.utcnow)
