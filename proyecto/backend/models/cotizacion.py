from sqlalchemy import Column, String, Integer, Float, DateTime, Text, JSON, ForeignKey, Boolean
from sqlalchemy.orm import relationship, object_session
from uuid import uuid4
from datetime import datetime
import enum
from database import Base
from models.usuario import ORDEN_TIERS_COTIZANTE, TierCotizante, Usuario

class ModalidadCotizacion(str, enum.Enum):
    dirigida = "dirigida"
    abierta = "abierta"

class NivelPersonalizacion(str, enum.Enum):
    estandar = "estandar"
    personalizacion_marca = "personalizacion_marca"
    personalizacion_diseno_completo = "personalizacion_diseno_completo"

class TipoCalidad(str, enum.Enum):
    economica = "economica"
    estandar = "estandar"
    premium = "premium"

class ModalidadImportacion(str, enum.Enum):
    ecommerce = "ecommerce"
    corporativo = "corporativo"

class EstadoCotizacion(str, enum.Enum):
    creada = "creada"
    dirigida = "dirigida"
    abierta = "abierta"
    propuestas_recibidas = "propuestas_recibidas"
    cotizacion_aceptada = "cotizacion_aceptada"
    orden_activa = "orden_activa"
    cancelada = "cancelada"  # Semana 4: anulada por error tras una SolicitudRecreacion aprobada

class Cotizacion(Base):
    __tablename__ = "cotizaciones"

    # Usar String(36) para UUID portable entre MySQL y SQLite
    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    solicitante_id = Column(String(36), nullable=False)
    importador_id = Column(String(36), nullable=True)  # Solo para modalidad dirigida
    modalidad = Column(String(20), nullable=False)  # "dirigida" o "abierta"
    tier_minimo_requerido = Column(String(10), default=TierCotizante.bronze.value, server_default=TierCotizante.bronze.value, nullable=False)
    desbloqueada_por_puntos = Column(Boolean, default=False, server_default="0", nullable=False)
    foto_producto = Column(String(500), nullable=True)
    pais_importacion = Column(String(100), nullable=False)
    nivel_personalizacion = Column(String(50), nullable=True)
    nombre_producto = Column(String(255), nullable=False)
    descripcion_cliente = Column(Text, nullable=False)
    link_referencia = Column(String(500), nullable=True)
    linea_producto = Column(String(100), nullable=False)
    tipo_calidad = Column(String(20), nullable=False)
    modalidad_importacion = Column(String(20), nullable=True)
    cantidad_minima = Column(Integer, nullable=False)
    precio_objetivo_usd = Column(Float, nullable=True)
    moneda_precio_objetivo = Column(String(10), nullable=False, default="USD", server_default="USD")
    incoterm = Column(String(50), nullable=False, default="DDP", server_default="DDP")
    notas_adicionales = Column(Text, nullable=True)
    # Parte del shipping mark que aporta el cliente (ej. "prendas control"). Se
    # combina con el prefijo de la empresa importadora para rotular las cajas.
    # Ver `utils/shipping_mark.py`.
    shipping_mark_sufijo = Column(String(40), nullable=True)
    # Valores de los campos personalizados definidos por el importador (solo aplica
    # a empresas con solo_cotizaciones_directas=True), como {campo_id: valor}.
    campos_personalizados_valores = Column(JSON, nullable=True)
    # Asesor de la empresa que reclamó esta cotización ("el primero que hace
    # clic se la queda"). NULL mientras nadie de la empresa la ha tomado.
    asesor_asignado_id = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    estado = Column(String(30), default=EstadoCotizacion.creada)

    # --- Créditos y recreación por error (Semana 4) ---
    # Créditos descontados al crear esta cotización (trazabilidad; ver MovimientoCredito).
    costo_creditos = Column(Float, nullable=True)
    # Si esta cotización nace como reemplazo de una cancelada por error, referencia
    # a la original (trazabilidad de "recreaciones").
    cotizacion_origen_id = Column(String(36), ForeignKey("cotizaciones.id"), nullable=True)
    cancelada_por_error = Column(String(20), nullable=True)  # NULL, o quien fue responsable: "solicitante"/"importador"
    motivo_cancelacion = Column(Text, nullable=True)

    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    propuestas = relationship("Propuesta", back_populates="cotizacion")
    orden = relationship("Orden", back_populates="cotizacion", uselist=False)
    conversacion = relationship("ConversacionChat", back_populates="cotizacion", uselist=False)

    # --- Navegación cruzada (Semana 4 - Fase 7) ---
    # Estas properties permiten que `CotizacionResponse` (con `from_attributes`)
    # exponga automáticamente el enlace al chat y el contacto asignado, sin tener
    # que reconstruir la respuesta a mano en cada endpoint que ya hace
    # `return cotizacion`/`return cotizaciones`.

    @property
    def precio_objetivo_moneda(self):
        return self.moneda_precio_objetivo or "USD"

    @precio_objetivo_moneda.setter
    def precio_objetivo_moneda(self, value):
        self.moneda_precio_objetivo = value or "USD"

    @property
    def solicitante_tier(self):
        session = object_session(self)
        if session is None:
            return TierCotizante.bronze.value
        solicitante = session.query(Usuario).filter(Usuario.id == self.solicitante_id).first()
        return solicitante.tier if solicitante else TierCotizante.bronze.value

    @property
    def solicitante_puntos_cotizacion(self):
        session = object_session(self)
        if session is None:
            return 0
        solicitante = session.query(Usuario).filter(Usuario.id == self.solicitante_id).first()
        return int(solicitante.puntos_cotizacion or 0) if solicitante else 0

    @property
    def bloqueada(self):
        if self.desbloqueada_por_puntos:
            return False
        return ORDEN_TIERS_COTIZANTE.get(self.solicitante_tier, 0) < ORDEN_TIERS_COTIZANTE.get(self.tier_minimo_requerido, 0)

    @property
    def conversacion_id(self):
        if object_session(self) is None:
            return None
        return str(self.conversacion.id) if self.conversacion else None

    @property
    def shipping_mark(self):
        """Marca de embarque completa, o `None` si todavía no se puede formar.

        El prefijo lo pone la empresa importadora, así que en una cotización
        abierta no existe hasta que una empresa gana la propuesta y queda fijada
        en `importador_id`. La orden guarda su propia copia (`Orden.shipping_mark`)
        para que un cambio posterior de prefijo no reescriba embarques ya
        rotulados.
        """
        session = object_session(self)
        if session is None or not self.importador_id or not self.shipping_mark_sufijo:
            return None

        from models.importador import Importador
        from utils.shipping_mark import componer_shipping_mark

        empresa = session.query(Importador).filter(Importador.id == self.importador_id).first()
        if empresa is None:
            return None
        return componer_shipping_mark(empresa.shipping_mark_prefijo, self.shipping_mark_sufijo)

    @property
    def contacto_asignado(self):
        """Persona de la empresa con la que habla el cliente.

        Es el asesor asignado, antes y después de que la propuesta se acepte:
        quien negoció es quien hace luego el seguimiento del embarque, y
        cambiarle el interlocutor justo al cerrar el trato obligaba al cliente a
        recontar el caso desde cero. Solo se cae a la cuenta dueña cuando nadie
        reclamó la cotización. `None` si todavía no hay propuesta enviada."""
        session = object_session(self)
        if session is None:
            return None

        propuesta = next((p for p in self.propuestas if p.estado == "aceptada"), None)
        if propuesta is None:
            propuesta = next((p for p in self.propuestas if p.estado == "pendiente"), None)
        if propuesta is None:
            return None

        from models.usuario import Usuario

        usuario = None
        if self.asesor_asignado_id:
            usuario = session.query(Usuario).filter(Usuario.id == self.asesor_asignado_id).first()
        if usuario is None:
            usuario = session.query(Usuario).filter(
                Usuario.importador_id == propuesta.importador_id,
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
        return f"<Cotizacion(id={self.id}, solicitante_id={self.solicitante_id}, estado={self.estado})>"
