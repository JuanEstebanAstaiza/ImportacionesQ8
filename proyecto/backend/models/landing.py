"""Contenido dinámico de la Landing Page (CMS por bloques).

El admin edita esto desde el panel sin desplegar código: bloques de texto,
imágenes, botones y el muro de aliados, más el miniblog de novedades. La vista
pública (`LandingScreen`) solo lee lo que esté `activo`.
"""
from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from uuid import uuid4
from datetime import datetime

from database import Base

# Página/sección a la que pertenece el bloque, mapeada a las pestañas públicas
# de LandingScreen.
SECCIONES_LANDING = ("home", "about", "how-it-works", "news", "contact")

TIPOS_BLOQUE_LANDING = ("heading", "paragraph", "image", "video", "button", "allies_grid", "video_rotativo")

# Carrusel de videos de "Quiénes somos": un único bloque de la sección "about"
# cuyo `contenido` es JSON (ver schemas/landing.py::VideosQuienesSomos). Se
# administra con su propio endpoint y "Guardar estructura" no lo toca.
TIPO_VIDEO_ROTATIVO = "video_rotativo"
SECCION_QUIENES_SOMOS = "about"

ALINEACIONES_BLOQUE = ("left", "center", "right")

ACCIONES_BOTON = ("open_login", "open_register", "external_link")

# Únicos tokens de marca seleccionables: se evita un picker HEX libre para no
# romper la identidad visual en modo claro/oscuro (ver Zarpi_Modelo_de_Monetizacion).
TOKENS_COLOR_MARCA = ("primary", "surface", "border", "foreground", "muted")
# Únicas dos familias de marca: Elvellon para títulos, AT Avenor para cuerpo/acentos.
FUENTES_BLOQUE_LANDING = ("elvellon", "avenor")

class LandingBlock(Base):
    """Un bloque de contenido de una sección pública de la Landing."""
    __tablename__ = "landing_blocks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    seccion = Column(String(30), nullable=False, default="home")
    tipo = Column(String(20), nullable=False)
    contenido = Column(Text, nullable=True)
    alineacion = Column(String(10), nullable=False, default="left")
    tamano_fuente = Column(String(10), nullable=False, default="md")
    accion_boton = Column(String(20), nullable=True)
    accion_url = Column(String(500), nullable=True)
    token_color = Column(String(20), nullable=False, default="foreground")
    fuente = Column(String(20), nullable=False, default="avenor")
    orden = Column(Integer, nullable=False, default=100)
    activo = Column(Boolean, nullable=False, default=True)

    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<LandingBlock(id={self.id}, tipo={self.tipo}, seccion={self.seccion})>"


class LandingAlly(Base):
    """Empresa o entidad aliada mostrada en el muro de aliados."""
    __tablename__ = "landing_allies"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    nombre = Column(String(150), nullable=False)
    logo_url = Column(String(500), nullable=True)
    categoria = Column(String(80), nullable=True)
    enlace = Column(String(500), nullable=True)
    orden = Column(Integer, nullable=False, default=100)
    activo = Column(Boolean, nullable=False, default=True)

    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<LandingAlly(id={self.id}, nombre={self.nombre})>"


class LandingNews(Base):
    """Publicación breve del miniblog de novedades de la Landing."""
    __tablename__ = "landing_news"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    titulo = Column(String(200), nullable=False)
    resumen = Column(String(400), nullable=False)
    contenido = Column(Text, nullable=True)
    imagen_url = Column(String(500), nullable=True)
    fecha_publicacion = Column(DateTime, default=datetime.utcnow)
    orden = Column(Integer, nullable=False, default=100)
    activo = Column(Boolean, nullable=False, default=True)

    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<LandingNews(id={self.id}, titulo={self.titulo})>"
