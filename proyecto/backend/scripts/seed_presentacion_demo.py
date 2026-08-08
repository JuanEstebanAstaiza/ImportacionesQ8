#!/usr/bin/env python3
"""Rellena banner, logo y presentación de las empresas de prueba.

Sin esto las fichas se ven vacías y parece que el banner o el video no
funcionan, cuando lo que pasa es que nadie subió nada todavía.

    docker compose exec backend sh -c 'cd /app && PYTHONPATH=/app python scripts/seed_presentacion_demo.py'

Genera las imágenes y el video con Python (sin dependencias externas), los
registra en gestión documental como haría una subida real, y deja las
evidencias ya **aprobadas** para que se sirvan sin sesión en la ficha pública.

Es idempotente: al reejecutarlo reemplaza el material anterior de esas empresas
en lugar de acumular copias.
"""
from __future__ import annotations

import struct
import sys
import zlib
from datetime import datetime
from pathlib import Path
from uuid import uuid4

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from database import SessionLocal  # noqa: E402
from models.documental import Archivo  # noqa: E402
from models.evidencia import EstadoEvidenciaImportador, EvidenciaImportador  # noqa: E402
from models.importador import Importador  # noqa: E402
from models.usuario import Usuario  # noqa: E402
from services.documental_service import create_document_file  # noqa: E402

UPLOADS = BACKEND_DIR / "uploads" / "documentos"

# (nombre de la empresa, color del banner, color del logo)
EMPRESAS = [
    ("Control Textil S.A.S.", (37, 99, 235), (14, 116, 144)),
    ("Andes Química Ltda.", (16, 122, 87), (5, 150, 105)),
]


def _png(ancho: int, alto: int, rgb: tuple) -> bytes:
    """PNG mínimo de un color plano, construido a mano.

    Se genera aquí en vez de traer un binario al repositorio: son datos de
    prueba, no un recurso del producto.
    """
    fila = bytes([0]) + bytes(rgb) * ancho
    crudo = fila * alto

    def bloque(tipo: bytes, datos: bytes) -> bytes:
        contenido = tipo + datos
        return struct.pack(">I", len(datos)) + contenido + struct.pack(">I", zlib.crc32(contenido))

    return (
        b"\x89PNG\r\n\x1a\n"
        + bloque(b"IHDR", struct.pack(">IIBBBBB", ancho, alto, 8, 2, 0, 0, 0))
        + bloque(b"IDAT", zlib.compress(crudo, 9))
        + bloque(b"IEND", b"")
    )


def _mp4_minimo() -> bytes:
    """Contenedor MP4 válido en cabecera pero sin pistas.

    El navegador lo reconoce como video y muestra el reproductor; no reproduce
    imagen porque no hay ninguna. Sirve para comprobar el circuito completo
    (subida, moderación, servicio sin sesión) sin meter decenas de MB de datos
    de prueba en el disco.
    """
    def caja(tipo: bytes, datos: bytes = b"") -> bytes:
        return struct.pack(">I", len(datos) + 8) + tipo + datos

    ftyp = caja(b"ftyp", b"isom" + struct.pack(">I", 512) + b"isomiso2avc1mp41")
    return ftyp + caja(b"free") + caja(b"mdat")


def _registrar_archivo(db, *, owner_id: str, nombre: str, contenido: bytes, extension: str, mime: str) -> Archivo:
    """Deja el binario en disco y crea su fila con el mismo servicio que usa la
    subida real, para que el archivo sembrado sea indistinguible de uno subido
    por la interfaz (deriva `tipo_recurso`, arma el `storage_url`, etc.)."""
    UPLOADS.mkdir(parents=True, exist_ok=True)
    almacenado = f"{uuid4()}_{nombre}"
    ruta = UPLOADS / almacenado
    ruta.write_bytes(contenido)

    fila = create_document_file(
        db,
        owner_user_id=owner_id,
        nombre=nombre,
        carpeta_id=None,
        extension=extension,
        mime_type=mime,
        size_bytes=len(contenido),
        storage_url=None,
        storage_path=str(ruta.relative_to(BACKEND_DIR)),
        origen="presentacion-empresa",
    )
    db.flush()
    return fila


def main() -> None:
    db = SessionLocal()
    try:
        for nombre_empresa, color_banner, color_logo in EMPRESAS:
            empresa = db.query(Importador).filter(Importador.nombre_empresa == nombre_empresa).first()
            if not empresa:
                print(f"(omitida) no existe la empresa {nombre_empresa}")
                continue

            dueño = (
                db.query(Usuario)
                .filter(Usuario.importador_id == empresa.id, Usuario.rol == "importador")
                .first()
            )
            if not dueño:
                print(f"(omitida) {nombre_empresa} no tiene cuenta dueña")
                continue

            # Reemplazar lo anterior en vez de acumular copias al reejecutar.
            db.query(EvidenciaImportador).filter(
                EvidenciaImportador.importador_id == empresa.id,
                EvidenciaImportador.tipo.in_(("video_presentacion", "foto_producto", "foto_fabrica")),
            ).delete(synchronize_session=False)

            banner = _registrar_archivo(
                db, owner_id=str(dueño.id), nombre="banner.png",
                contenido=_png(160, 40, color_banner), extension="png", mime="image/png",
            )
            logo = _registrar_archivo(
                db, owner_id=str(dueño.id), nombre="logo.png",
                contenido=_png(48, 48, color_logo), extension="png", mime="image/png",
            )
            video = _registrar_archivo(
                db, owner_id=str(dueño.id), nombre="presentacion.mp4",
                contenido=_mp4_minimo(), extension="mp4", mime="video/mp4",
            )
            foto = _registrar_archivo(
                db, owner_id=str(dueño.id), nombre="taller.png",
                contenido=_png(120, 68, color_logo), extension="png", mime="image/png",
            )

            perfil = dict(empresa.perfil_publico or {})
            perfil.update({
                "banner": banner.storage_url,
                "description": perfil.get("description")
                or f"{nombre_empresa} trabaja con taller propio y control de calidad en origen.",
                "year": perfil.get("year") or "2014",
                "website": perfil.get("website") or "https://ejemplo-importacionesq8.com",
            })
            empresa.perfil_publico = perfil
            empresa.logo_url = logo.storage_url

            for tipo, titulo, descripcion, archivo in (
                ("video_presentacion", "Recorrido por nuestro taller",
                 "Medio minuto por la planta: corte, confección y control de calidad.", video),
                ("foto_producto", "Muestras de producción",
                 "Lote de referencia entregado el mes pasado.", foto),
            ):
                db.add(EvidenciaImportador(
                    id=str(uuid4()),
                    importador_id=empresa.id,
                    tipo=tipo,
                    titulo=titulo,
                    descripcion=descripcion,
                    url=archivo.storage_url,
                    # Ya aprobadas: solo las aprobadas se sirven sin sesión, que es
                    # lo que permite verlas en la ficha pública.
                    estado=EstadoEvidenciaImportador.aprobada.value,
                    fecha_revision=datetime.utcnow(),
                ))

            print(f"{nombre_empresa}: banner, logo, video y foto publicados")

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
