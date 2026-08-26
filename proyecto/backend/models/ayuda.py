from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text
from uuid import uuid4
from datetime import datetime

from database import Base

# Categorías con las que se agrupa la documentación. Son las áreas por las que
# la gente pregunta, no las secciones del menú: alguien con un problema piensa
# en "mi pedido no avanza", no en "pantalla de órdenes".
CATEGORIAS_AYUDA = (
    "Primeros pasos",
    "Cotizaciones",
    "Propuestas y negociación",
    "Órdenes y seguimiento",
    "Documentos y archivos",
    "Cuenta y accesos",
    "Pagos y créditos",
    "Problemas frecuentes",
)


class ArticuloAyuda(Base):
    """Un artículo de la documentación de la plataforma.

    Antes esto vivía en un archivo de código: añadir una respuesta a una duda
    nueva exigía tocar el frontend y desplegar, así que en la práctica la
    documentación no crecía. Aquí la escribe y la corrige el equipo de soporte
    desde el panel, que es quien ve a diario qué no se entiende.

    `roles` acota a quién le sirve: un artículo sobre reclamar cotizaciones del
    pool no le dice nada a un solicitante y solo le añade ruido cuando busca.
    Vacío significa "a todos".
    """
    __tablename__ = "articulos_ayuda"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    titulo = Column(String(200), nullable=False)
    # Respuesta corta, la que se lee sin desplegar el artículo. Muchas dudas se
    # resuelven con una frase y no hace falta abrir nada.
    resumen = Column(String(400), nullable=False)
    # Explicación completa, con los pasos.
    contenido = Column(Text, nullable=True)
    categoria = Column(String(60), nullable=False)
    roles = Column(JSON, nullable=True)
    # Para poner primero lo que más se consulta dentro de cada categoría.
    orden = Column(Integer, nullable=False, default=100)
    # Despublicar en vez de borrar: un artículo retirado puede seguir siendo la
    # respuesta correcta a un ticket antiguo.
    publicado = Column(Boolean, nullable=False, default=True)

    # Señal de qué documentación funciona y cuál no, para que el equipo sepa qué
    # reescribir en lugar de adivinar.
    vistas = Column(Integer, nullable=False, default=0)
    votos_util = Column(Integer, nullable=False, default=0)
    votos_inutil = Column(Integer, nullable=False, default=0)

    autor_id = Column(String(36), ForeignKey("usuarios.id"), nullable=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)
    fecha_actualizacion = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<ArticuloAyuda(id={self.id}, titulo={self.titulo})>"
