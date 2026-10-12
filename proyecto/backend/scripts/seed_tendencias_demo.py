#!/usr/bin/env python3
"""Contenido de prueba para Tendencias v2, el reto y los catálogos de empresas.

    docker compose exec backend sh -c 'cd /app && PYTHONPATH=/app python scripts/seed_tendencias_demo.py'

Requiere las cuentas de scripts/seed_usuarios_prueba.py. Deja:

- Una ronda del reto abierta (20 cupos, 30 días) con cliente@q8demo.com inscrito.
- Tres enlaces **pendientes** en la cola del aprobador, enviados por
  cliente@q8demo.com (cuentan para su reto), y uno recomendado por Control
  Textil (empresa@q8demo.com). No se publican solos a propósito: así se prueba
  el flujo completo con admin@q8demo.com (aprobar, poner portada, publicar).
- Un catálogo de Control Textil con dos productos, abierto a cliente@q8demo.com.

Los enlaces son videos públicos de YouTube usados solo como relleno. Para ver
productos reales, pega enlaces de TikTok/YouTube desde «Subir un producto viral».

Es idempotente: no duplica la ronda, los enlaces ni el catálogo.
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(BACKEND_DIR / "scripts"))

from database import SessionLocal  # noqa: E402
from models.catalogo import AccesoCatalogo, CatalogoEmpresa, ProductoCatalogo  # noqa: E402
from models.importador import Importador  # noqa: E402
from models.reto import RetoParticipacion, RetoRonda  # noqa: E402
from models.tendencias_virales import TendenciaItem  # noqa: E402
from models.usuario import Usuario  # noqa: E402
from seed_presentacion_demo import _png, _registrar_archivo  # noqa: E402
from services import enlaces_video, reto  # noqa: E402

TITULO_CATALOGO = "Selección textil para clientes"

# (url, nombre sugerido, categoría, nota) — videos públicos de YouTube de relleno.
ENLACES_CLIENTE = [
    ("https://www.youtube.com/watch?v=jNQXAC9IVRw", "Video de prueba 1", "Hogar", "Lo vi en un reel con muchas vistas."),
    ("https://youtu.be/dQw4w9WgXcQ", "Video de prueba 2", "Tecnología", None),
    ("https://www.youtube.com/watch?v=9bZkp7q19f0", "Video de prueba 3", "Deportes", None),
]
ENLACE_EMPRESA = ("https://www.youtube.com/watch?v=kJQP7kiw5Fk", "Video de prueba de importadora", "Textil")


def _foto(db, owner_id: str, nombre: str, rgb: tuple) -> str:
    archivo = _registrar_archivo(
        db, owner_id=owner_id, nombre=f"{nombre}.png", contenido=_png(600, 600, rgb),
        extension="png", mime="image/png",
    )
    return f"/documentos/archivos/{archivo.id}/descargar"


def _usuario(db, email: str):
    return db.query(Usuario).filter(Usuario.email == email).first()


def _enviar(db, usuario: Usuario, url: str, nombre: str, categoria: str, nota=None, portada=None) -> bool:
    """Crea la ficha pendiente sin consultar la red (el aprobador la ve igual)."""
    enlace = enlaces_video.normalizar(url)
    if db.query(TendenciaItem).filter(TendenciaItem.url_normalizada == enlace.normalizada).first():
        return False
    from services.tendencias_virales import rol_remitente

    rol = rol_remitente(usuario)
    participacion = reto.participacion_vigente(db, usuario.id) if rol == "comunidad" else None
    db.add(TendenciaItem(
        url_origen=enlace.url_publica, url_normalizada=enlace.normalizada, plataforma=enlace.plataforma,
        id_video_plataforma=enlace.id_video, enviado_por=usuario.id, rol_remitente=rol,
        importador_id=usuario.importador_id if rol == "importadora" else None,
        participacion_id=participacion.id if participacion else None,
        nombre=nombre, categoria=categoria, nota_remitente=nota, portada_url=portada, estado="pendiente",
    ))
    db.commit()
    return True


def sembrar_reto_y_enlaces(db) -> None:
    admin = _usuario(db, "admin@q8demo.com")
    cliente = _usuario(db, "cliente@q8demo.com")
    empresa = _usuario(db, "empresa@q8demo.com")
    if not (admin and cliente and empresa):
        print("Faltan las cuentas de prueba: corre antes scripts/seed_usuarios_prueba.py")
        return

    ronda = reto.ronda_abierta(db)
    if ronda is None:
        ronda = RetoRonda(nombre="Ronda 1", max_participantes=20, umbral_aprobados=10, recompensa_cop=50000,
                          recompensa_cotizaciones=5, fecha_limite=datetime.utcnow() + timedelta(days=30),
                          creada_por=admin.id)
        db.add(ronda)
        db.commit()
        print(f"Reto: abierta «{ronda.nombre}» (20 cupos, 30 días).")
    if not db.query(RetoParticipacion).filter(RetoParticipacion.ronda_id == ronda.id,
                                               RetoParticipacion.usuario_id == cliente.id).first():
        reto.inscribir(db, ronda.id, cliente)
        print(f"Reto: {cliente.email} inscrito.")

    nuevos = sum(_enviar(db, cliente, *datos) for datos in ENLACES_CLIENTE)
    portada = _foto(db, empresa.id, "termo-propuesto", (14, 116, 144))
    nuevos += _enviar(db, empresa, *ENLACE_EMPRESA, portada=portada)
    print(f"Tendencias: {nuevos} enlaces nuevos pendientes de aprobación.")


def sembrar_catalogo(db) -> None:
    empresa = db.query(Importador).filter(Importador.nombre_empresa == "Control Textil S.A.S.").first()
    dueño = db.query(Usuario).filter(Usuario.email == "empresa@q8demo.com").first()
    cliente = db.query(Usuario).filter(Usuario.email == "cliente@q8demo.com").first()
    if not (empresa and dueño and cliente):
        print("Faltan las cuentas de prueba: corre antes scripts/seed_usuarios_prueba.py")
        return

    for viejo in db.query(CatalogoEmpresa).filter(
        CatalogoEmpresa.importador_id == empresa.id, CatalogoEmpresa.titulo == TITULO_CATALOGO,
    ).all():
        db.query(AccesoCatalogo).filter(AccesoCatalogo.catalogo_id == viejo.id).delete(synchronize_session=False)
        db.query(ProductoCatalogo).filter(ProductoCatalogo.catalogo_id == viejo.id).delete(synchronize_session=False)
        db.delete(viejo)
    db.commit()

    catalogo = CatalogoEmpresa(
        importador_id=empresa.id, titulo=TITULO_CATALOGO,
        descripcion="Prendas y textiles que importamos con frecuencia, con tiempos ya probados.",
        criterio="manual", activo=True,
    )
    db.add(catalogo)
    db.flush()
    for orden, (nombre, descripcion, minimo, color) in enumerate([
        ("Camiseta de algodón 180 g", "Algodón peinado, tallas S a XXL, 8 colores. Estampado o bordado.", 300, (14, 116, 144)),
        ("Hoodie unisex con capucha", "Felpa perchada 280 g, cordón plano, bolsillo canguro.", 200, (37, 99, 235)),
    ]):
        db.add(ProductoCatalogo(
            catalogo_id=catalogo.id, nombre=nombre, descripcion=descripcion,
            fotos=[_foto(db, dueño.id, f"catalogo-{orden}", color)],
            linea_producto="Textil", pais_origen="China", cantidad_minima=minimo, unidad_cantidad="unidades",
            tiempo_estimado="45–60 días", orden=orden,
            que_pedir_en_cotizacion=f"{nombre}: tallas, colores y tipo de marcación que necesitas.",
        ))
    db.add(AccesoCatalogo(catalogo_id=catalogo.id, usuario_id=cliente.id, otorgado_por=dueño.id))
    db.commit()
    print(f"Catálogo «{TITULO_CATALOGO}» de {empresa.nombre_empresa}, abierto a {cliente.email}.")


def main() -> None:
    db = SessionLocal()
    try:
        sembrar_reto_y_enlaces(db)
        sembrar_catalogo(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
