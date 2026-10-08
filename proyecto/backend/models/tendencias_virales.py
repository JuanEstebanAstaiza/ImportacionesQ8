"""Tendencias v2: productos virales para importar.

Cada ficha nace de un enlace a un video de TikTok, Instagram o YouTube que
sube la comunidad, una importadora o el equipo. Una persona del equipo la
aprueba, le pone portada propia y ahí queda publicada. Nunca se descarga ni se
guarda el video ni su miniatura: solo la URL y el código de inserción oficial.

La ficha no muestra precio. Su única acción es pedir propuestas, y la
solicitud que nace de ahí queda atribuida (`cotizaciones.tendencia_item_id`):
esa es la métrica del módulo.

Ver docs/Tendencias · Guía de construcción.html.
"""
import enum
from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text

from database import Base


class Plataforma(str, enum.Enum):
    tiktok = "tiktok"
    instagram = "instagram"
    youtube = "youtube"


class RolRemitente(str, enum.Enum):
    comunidad = "comunidad"
    importadora = "importadora"
    equipo = "equipo"


class EstadoTendencia(str, enum.Enum):
    pendiente = "pendiente"
    duplicado = "duplicado"
    rechazado = "rechazado"
    aprobado_sin_portada = "aprobado_sin_portada"
    publicado = "publicado"
    caido = "caido"
    archivado = "archivado"


class MotivoRechazo(str, enum.Enum):
    marca_replica = "marca_replica"
    repetido = "repetido"
    no_es_producto = "no_es_producto"
    regulado_inviable = "regulado_inviable"
    calidad = "calidad"


class TendenciaItem(Base):
    __tablename__ = "tendencias_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    url_origen = Column(String(1000), nullable=False)
    # Forma canónica del enlace: lo que se compara para detectar repetidos.
    url_normalizada = Column(String(500), nullable=False, unique=True)
    plataforma = Column(String(20), nullable=False)
    id_video_plataforma = Column(String(120), nullable=True)
    autor_plataforma = Column(String(200), nullable=True)
    # Se muestra desde la plataforma; nunca se copia al servidor.
    miniatura_plataforma_url = Column(String(1000), nullable=True)
    # Solo como registro: la interfaz arma el reproductor desde el id del video.
    embed_html = Column(Text, nullable=True)

    enviado_por = Column(String(36), ForeignKey("usuarios.id"), nullable=False, index=True)
    rol_remitente = Column(String(20), nullable=False)
    importador_id = Column(String(36), ForeignKey("importadores.id"), nullable=True, index=True)
    participacion_id = Column(String(36), ForeignKey("reto_participaciones.id"), nullable=True, index=True)
    nota_remitente = Column(String(500), nullable=True)

    estado = Column(String(30), nullable=False, default=EstadoTendencia.pendiente.value, index=True)
    motivo_rechazo = Column(String(30), nullable=True)

    nombre = Column(String(120), nullable=True)
    categoria = Column(String(100), nullable=True, index=True)
    regulado = Column(Boolean, nullable=False, default=False, server_default="0")
    por_que_tendencia = Column(String(200), nullable=True)
    ojo_antes = Column(String(200), nullable=True)
    # Ruta de gestión documental (`/documentos/archivos/{id}/descargar`).
    portada_url = Column(String(500), nullable=True)

    # Lunes de la semana en que se publicó (hora de Bogotá): el feed es por semana.
    semana = Column(Date, nullable=True, index=True)
    publicado_en = Column(DateTime, nullable=True)
    aprobado_por = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    revisado_en = Column(DateTime, nullable=True)
    cotizaciones_count = Column(Integer, nullable=False, default=0, server_default="0")
    ultima_verificacion = Column(DateTime, nullable=True)

    fecha_creacion = Column(DateTime, nullable=False, default=datetime.utcnow)
    fecha_actualizacion = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
