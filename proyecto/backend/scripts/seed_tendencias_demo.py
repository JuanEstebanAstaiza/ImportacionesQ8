#!/usr/bin/env python3
"""Contenido de prueba para Tendencias y los catálogos de empresas.

    docker compose exec backend sh -c 'cd /app && PYTHONPATH=/app python scripts/seed_tendencias_demo.py'

Requiere las cuentas de scripts/seed_usuarios_prueba.py. Deja:

- Una edición de Tendencias publicada con cuatro productos (uno destacado),
  armada por admin@q8demo.com, con fotos generadas de un color.
- La suscripción a la venta en modo de prueba (precio y días solo si el admin
  todavía no los fijó), para recorrer el pago simulado.
- Un catálogo de Control Textil con dos productos, criterio manual, abierto a
  cliente@q8demo.com.

cliente@q8demo.com queda **sin** acceso a Tendencias a propósito: así se ve el
muro de suscripción y se puede probar el pago simulado. Para regalarle acceso,
usar el panel de Tendencias › Administración.

Es idempotente: reemplaza la edición y el catálogo de demo en lugar de duplicarlos.
"""
from __future__ import annotations

import sys
from datetime import date, datetime, timedelta
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(BACKEND_DIR / "scripts"))

from database import SessionLocal  # noqa: E402
from models.catalogo import AccesoCatalogo, CatalogoEmpresa, ProductoCatalogo  # noqa: E402
from models.importador import Importador  # noqa: E402
from models.tendencias import (  # noqa: E402
    EdicionProducto, EdicionTendencias, EstadoEdicion, ProductoTendencia, Temporada,
)
from models.usuario import Usuario  # noqa: E402
from seed_presentacion_demo import _png, _registrar_archivo  # noqa: E402
from services import configuracion, tendencias  # noqa: E402

TITULO_EDICION = "Pídelo hoy"
TITULO_CATALOGO = "Selección textil para clientes"


def _foto(db, owner_id: str, nombre: str, rgb: tuple) -> str:
    archivo = _registrar_archivo(
        db, owner_id=owner_id, nombre=f"{nombre}.png", contenido=_png(600, 600, rgb),
        extension="png", mime="image/png",
    )
    return f"/documentos/archivos/{archivo.id}/descargar"


def _temporada(db, nombre: str) -> Temporada | None:
    return (
        db.query(Temporada)
        .filter(Temporada.nombre == nombre, Temporada.fecha >= date.today())
        .order_by(Temporada.fecha)
        .first()
    )


def sembrar_tendencias(db, admin: Usuario) -> None:
    if tendencias.precio_suscripcion(db) is None:
        configuracion.guardar(db, tendencias.CLAVE_PRECIO_COP, "49000", admin.id)
        configuracion.guardar(db, tendencias.CLAVE_DIAS_SUSCRIPCION, "30", admin.id)

    # Reemplaza la edición de demo anterior y sus productos.
    for vieja in db.query(EdicionTendencias).filter(EdicionTendencias.titulo_linea1 == TITULO_EDICION).all():
        ids = [ep.producto_id for ep in db.query(EdicionProducto).filter(EdicionProducto.edicion_id == vieja.id)]
        db.query(EdicionProducto).filter(EdicionProducto.edicion_id == vieja.id).delete(synchronize_session=False)
        db.delete(vieja)
        db.flush()
        if ids:
            db.query(ProductoTendencia).filter(ProductoTendencia.id.in_(ids)).delete(synchronize_session=False)
    db.commit()

    año_nuevo = _temporada(db, "Año nuevo · propósitos")
    clases = _temporada(db, "Regreso a clases (calendario A)")
    madre = _temporada(db, "Día de la Madre")
    productos = [
        dict(nombre="Bandas de resistencia", categoria_visible="Fitness · Año nuevo", linea_producto="Deportes",
             por_que_ahora="Los propósitos de año nuevo disparan las búsquedas de entrenamiento en casa en enero.",
             temporada_id=año_nuevo.id if año_nuevo else None, para_negocio=False,
             guia_para_quien="Personas que empiezan a entrenar en casa y entrenadores personales.",
             guia_angulos=["Gimnasio en una bolsa", "5 niveles de resistencia", "Rutina impresa incluida"],
             guia_donde="Instagram, TikTok y marketplaces en la primera quincena de enero.",
             que_pedir_en_cotizacion="Juego de 5 bandas de látex con bolsa de tela y guía impresa en español.",
             color=(79, 6, 235)),
        dict(nombre="Lonchera térmica infantil", categoria_visible="Regreso a clases", linea_producto="Hogar",
             por_que_ahora="Las familias compran loncheras dos o tres semanas antes de entrar a clases.",
             temporada_id=clases.id if clases else None, para_negocio=False,
             guia_angulos=["Mantiene frío 4 horas", "Personalizable con nombre"],
             que_pedir_en_cotizacion="Lonchera térmica con aislante de aluminio, 3 diseños infantiles, cierre YKK.",
             color=(237, 249, 83)),
        dict(nombre="Set de organizadores de cocina", categoria_visible="Hogar · Día de la Madre",
             linea_producto="Hogar",
             por_que_ahora="Regalo práctico que crece cada año en la temporada del Día de la Madre.",
             temporada_id=madre.id if madre else None, para_negocio=True, revisar_requisitos=True,
             que_pedir_en_cotizacion="Set de 6 recipientes herméticos de vidrio con tapa de bambú, apto para alimentos.",
             color=(207, 200, 246)),
        dict(nombre="Bolsas kraft con logo", categoria_visible="Empaque · Todo el año", linea_producto="Empaques",
             por_que_ahora="Las tiendas en línea buscan empaque propio para diferenciarse sin subir costos.",
             temporada_id=None, para_negocio=True,
             que_pedir_en_cotizacion="Bolsas kraft de 25 × 30 cm con asa de papel y logo a una tinta.",
             color=(17, 17, 19)),
    ]
    edicion = EdicionTendencias(
        numero=tendencias.numero_siguiente(db),
        semana_inicio=tendencias.lunes_de(date.today()),
        titulo_linea1=TITULO_EDICION,
        titulo_linea2="llega a tiempo",
        subtitulo="Cuatro productos con fecha ideal de pedido para las temporadas que vienen.",
        preset_estilo="violeta",
        estado=EstadoEdicion.programada.value,
        publicar_en=datetime.utcnow() - timedelta(minutes=1),
        creado_por=admin.id,
        actualizado_por=admin.id,
    )
    db.add(edicion)
    db.flush()
    for orden, datos in enumerate(productos):
        color = datos.pop("color")
        producto = ProductoTendencia(
            fotos=[_foto(db, admin.id, f"tendencia-{orden}", color)],
            pais_origen="China",
            creado_por=admin.id,
            actualizado_por=admin.id,
            **datos,
        )
        db.add(producto)
        db.flush()
        db.add(EdicionProducto(edicion_id=edicion.id, producto_id=producto.id, orden=orden, destacado=orden == 0))
    db.commit()
    tendencias.publicar_pendientes(db)
    print(f"Edición de Tendencias #{edicion.numero} publicada con {len(productos)} productos.")


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
        admin = db.query(Usuario).filter(Usuario.email == "admin@q8demo.com").first()
        if admin is None:
            print("Falta admin@q8demo.com: corre antes scripts/seed_usuarios_prueba.py")
            return
        sembrar_tendencias(db, admin)
        sembrar_catalogo(db)
        precio = tendencias.precio_suscripcion(db)
        print(f"Suscripción a Tendencias: COP {precio:,} por {tendencias.dias_suscripcion(db)} días (pago simulado en local).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
