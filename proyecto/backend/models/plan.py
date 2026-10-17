"""Planes de acceso para compradores (pago manual por transferencia).

Un plan es lo que se publica en la sección «Planes» del home: precio sin IVA,
lo que incluye (solicitudes de cotización, vigencia, días de Tendencias, precio
de las solicitudes adicionales) y los cupos. Todo lo edita el admin en
*Admin › Planes*: nada de esto se escribe en el código del frontend.

Una inscripción es la compra de un plan desde `/planes/inscripcion`: la
persona deja sus datos y el comprobante de la transferencia; el equipo la
revisa y, al activarla, se crea la cuenta (si no existe) y se le acredita el
plan. Los cupos disponibles los fija el admin a mano (`cupos_totales`): las
inscripciones no los descuentan. En 0, se entra a la lista de espera (sin
comprobante).
"""
import enum
from datetime import datetime
from uuid import uuid4

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String, Text

from database import Base


class Plan(Base):
    __tablename__ = "planes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    # Lo que va en la URL: /planes/inscripcion?plan=importador
    clave = Column(String(40), nullable=False, unique=True)
    nombre = Column(String(80), nullable=False)
    # «Para quien ya sabe qué quiere traer.»
    para_quien = Column(String(200), nullable=True)
    precio_cop = Column(Integer, nullable=False)  # sin IVA
    iva_pct = Column(Integer, nullable=False, default=19, server_default="19")
    solicitudes_incluidas = Column(Integer, nullable=False, default=0, server_default="0")
    vigencia_meses = Column(Integer, nullable=False, default=12, server_default="12")
    # Días de Tendencias que trae (VIP: 6 meses). Vacío: sin Tendencias.
    dias_tendencias = Column(Integer, nullable=True)
    # Precio (sin IVA) de cada solicitud adicional mientras el plan esté vigente.
    # Vacío: el precio general del token (Admin › Pagos).
    precio_solicitud_adicional_cop = Column(Integer, nullable=True)
    # Lo que se lista en la tarjeta, en orden.
    incluye = Column(JSON, nullable=True)
    # Cupos disponibles que muestra la tarjeta, puestos a mano por el admin
    # (no se descuentan al inscribirse). Vacío: sin límite.
    cupos_totales = Column(Integer, nullable=True)
    destacado = Column(Boolean, nullable=False, default=False, server_default="0")
    orden = Column(Integer, nullable=False, default=0, server_default="0")
    activo = Column(Boolean, nullable=False, default=True, server_default="1")
    fecha_creacion = Column(DateTime, nullable=False, default=datetime.utcnow)
    fecha_actualizacion = Column(DateTime, nullable=True, onupdate=datetime.utcnow)


class EstadoInscripcionPlan(str, enum.Enum):
    pendiente = "pendiente"      # comprobante enviado, por revisar
    activa = "activa"            # pago confirmado y plan acreditado
    rechazada = "rechazada"
    lista_espera = "lista_espera"


class InscripcionPlan(Base):
    __tablename__ = "inscripciones_plan"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    plan_id = Column(String(36), ForeignKey("planes.id"), nullable=False, index=True)
    estado = Column(String(20), nullable=False, default=EstadoInscripcionPlan.pendiente.value, index=True)
    # Cuenta a la que se acredita: la de quien se inscribió con sesión, o la que
    # se crea (o se encuentra por correo) al activarla.
    usuario_id = Column(String(36), ForeignKey("usuarios.id"), nullable=True, index=True)

    # Datos para crear la cuenta y facturar.
    email = Column(String(255), nullable=False, index=True)
    tipo_persona = Column(String(10), nullable=False, default="natural")
    nombre = Column(String(120), nullable=True)
    apellido = Column(String(120), nullable=True)
    tipo_documento = Column(String(30), nullable=True)
    numero_documento = Column(String(50), nullable=True)
    razon_social = Column(String(255), nullable=True)
    nit = Column(String(50), nullable=True)
    indicativo_pais_telefono = Column(String(6), nullable=False, default="+57")
    telefono = Column(String(30), nullable=False)
    ciudad = Column(String(100), nullable=True)

    # Lo que costaba al inscribirse (el admin puede cambiar el precio después).
    precio_cop = Column(Integer, nullable=True)
    iva_cop = Column(Integer, nullable=True)
    total_cop = Column(Integer, nullable=True)

    # Comprobante: se guarda aparte de gestión documental porque quien lo sube
    # todavía no tiene cuenta. Solo lo descarga el admin.
    comprobante_ruta = Column(String(500), nullable=True)
    comprobante_nombre = Column(String(255), nullable=True)
    comprobante_mime = Column(String(120), nullable=True)

    acepto_condiciones = Column(Boolean, nullable=False, default=False)
    acepto_datos = Column(Boolean, nullable=False, default=False)
    fecha_aceptacion = Column(DateTime, nullable=True)

    motivo_rechazo = Column(Text, nullable=True)
    revisado_por = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    revisado_en = Column(DateTime, nullable=True)
    # Hasta cuándo valen las solicitudes del plan (desde la activación).
    vence_en = Column(DateTime, nullable=True)
    fecha_creacion = Column(DateTime, nullable=False, default=datetime.utcnow)
