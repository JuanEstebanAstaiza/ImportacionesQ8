"""Zarpi Maquilas (fase 3): marca blanca, ficha técnica guiada, checklist y reporte de
calidad, reseñas con métricas públicas y repetir pedido. Contra el Mongo real del compose.
"""
from datetime import date, timedelta

import pytest

from conftest import crear_usuario_con_token
from tests.test_maquilas_fase2 import (  # noqa: F401 - `mongo_maq` y `cliente` son fixtures
    PROPUESTA, _maquila, _pagar, _solicitud, _subir, cliente, mongo_maq,
)


@pytest.fixture()
def admin_headers(db_session):
    return crear_usuario_con_token(db_session, rol="admin")[1]


CRITERIOS = [{"criterio": "Medidas según la tabla de tallas", "tolerancia": "± 1 cm"},
             {"criterio": "Bordado centrado", "tolerancia": ""}]


def _producto(client, hm, **cambios):
    datos = {
        "nombre": "Camiseta básica algodón", "categoria": "textil",
        "descripcion": "Camiseta cuello redondo, algodón 180 g, lista para tu logo.",
        "fotos": [_subir(client, hm, "producto")], "tramos": [{"cantidad_min": 50, "precio_unitario": 16000},
                                                            {"cantidad_min": 300, "precio_unitario": 13000}],
        "pedido_minimo": 50, "personalizable": ["logo", "etiqueta"], "costo_muestra": 30000,
        "dias_muestra": 5, "dias_produccion": 15, "activo": True,
    }
    datos.update(cambios)
    r = client.post("/maquilas/mi-maquiladora/productos", json=datos, headers=hm)
    assert r.status_code == 201, r.text
    return r.json()


def _hasta_calidad(client, cliente, hm, pedido_id):
    """Anticipo, muestra aprobada y etapas hasta el control de calidad."""
    _pagar(client, cliente, hm, pedido_id, "anticipo")
    client.post(f"/maquilas/pedidos/{pedido_id}/muestras", json={"archivos": [_subir(client, hm, "muestra")]}, headers=hm)
    client.post(f"/maquilas/pedidos/{pedido_id}/muestras/responder", json={"aprobada": True}, headers=cliente)
    for clave in ("insumos", "preparacion", "fabricacion", "acabado"):
        assert client.post(f"/maquilas/pedidos/{pedido_id}/etapas/{clave}", json={}, headers=hm).status_code == 200


def _pedido_con_criterios(client, db_session, mongo_maq, cliente):
    m, hm = _maquila(db_session, mongo_maq)
    sol = _solicitud(client, cliente)
    r = client.put(f"/maquilas/solicitudes/{sol['id']}/propuesta", json={**PROPUESTA, "criterios_calidad": CRITERIOS}, headers=hm)
    assert r.status_code == 200, r.text
    prop = client.get(f"/maquilas/solicitudes/{sol['id']}", headers=cliente).json()["propuestas"][0]
    assert prop["criterios_calidad"] == CRITERIOS
    pedido = client.post(f"/maquilas/propuestas/{prop['id']}/aceptar", json={}, headers=cliente).json()
    return pedido, hm, m


def _entregar(client, cliente, hm, pedido_id):
    _hasta_calidad(client, cliente, hm, pedido_id)
    client.post(f"/maquilas/pedidos/{pedido_id}/calidad", json={
        "unidades_inspeccionadas": 50, "resultados": [{"cumple": True}, {"cumple": True}],
        "fotos": [_subir(client, hm, "evidencia")]}, headers=hm)
    client.post(f"/maquilas/pedidos/{pedido_id}/calidad/responder", json={"aprobado": True}, headers=cliente)
    for clave in ("empaque", "despacho"):
        assert client.post(f"/maquilas/pedidos/{pedido_id}/etapas/{clave}", json={}, headers=hm).status_code == 200
    r = client.post(f"/maquilas/pedidos/{pedido_id}/recibido", headers=cliente)
    assert r.json()["estado"] == "entregado"
    return r.json()


# ==================== Marca blanca ====================

def test_catalogo_solo_muestra_lo_publicado_de_maquilas_verificadas(client, db_session, mongo_maq, cliente):
    _, hm = _maquila(db_session, mongo_maq, nombre="Textil Uno")
    publicado = _producto(client, hm)
    _producto(client, hm, nombre="Borrador de hoodie", activo=False)
    _, hm_sin = _maquila(db_session, mongo_maq, nombre="Sin verificar", estado="registrada")
    r = client.post("/maquilas/mi-maquiladora/productos", json={
        "nombre": "Gorra", "categoria": "textil", "descripcion": "Gorra bordada lista para tu marca.", "fotos": [],
        "tramos": [{"cantidad_min": 50, "precio_unitario": 9000}], "pedido_minimo": 50, "dias_muestra": 3,
        "dias_produccion": 10, "activo": True}, headers=hm_sin)
    assert r.status_code == 409  # sin verificar solo guarda borradores

    catalogo = client.get("/maquilas/catalogo", headers=cliente).json()
    assert [p["nombre"] for p in catalogo] == ["Camiseta básica algodón"]
    assert catalogo[0]["precio_desde"] == 13000 and catalogo[0]["maquiladora"]["nombre_comercial"] == "Textil Uno"
    assert client.get("/maquilas/catalogo?cantidad=10", headers=cliente).json() == []
    # La foto del producto es vitrina: la ve cualquier cliente.
    assert client.get(publicado["fotos"][0]["url"], headers=cliente).status_code == 200
    # La maquila ve también sus borradores.
    mios = client.get("/maquilas/mi-maquiladora/productos", headers=hm).json()
    assert {p["nombre"]: p["visible"] for p in mios} == {"Camiseta básica algodón": True, "Borrador de hoodie": False}


def test_producto_valida_categoria_y_precios(client, db_session, mongo_maq):
    _, hm = _maquila(db_session, mongo_maq)
    base = {"nombre": "Crema", "categoria": "cosmetica", "descripcion": "Crema hidratante lista para tu marca.",
            "fotos": [], "tramos": [{"cantidad_min": 100, "precio_unitario": 9000}], "pedido_minimo": 100,
            "dias_muestra": 3, "dias_produccion": 10}
    assert client.post("/maquilas/mi-maquiladora/productos", json=base, headers=hm).status_code == 400  # no fabrica cosmética
    malo = {**base, "categoria": "textil", "tramos": [{"cantidad_min": 500, "precio_unitario": 9000}]}
    assert client.post("/maquilas/mi-maquiladora/productos", json=malo, headers=hm).status_code == 400
    assert client.post("/maquilas/mi-maquiladora/productos", json={**base, "categoria": "textil", "activo": True},
                       headers=hm).status_code == 400  # publicar exige foto


def test_pedido_de_marca_blanca(client, db_session, mongo_maq, cliente):
    m, hm = _maquila(db_session, mongo_maq, pedido_minimo=1000)
    producto = _producto(client, hm)
    datos = {"modalidad": "marca_blanca", "producto_id": producto["id"], "categoria": "otros", "titulo": "Camisetas Mi Marca",
             "descripcion": "Logo en el pecho a un color y etiqueta tejida en el cuello.", "cantidad": 60,
             "ciudad_entrega": "Cali", "personalizacion": ["logo"], "referencias": [_subir(client, cliente, "referencia")]}
    # Menos del mínimo del producto, o una personalización que no ofrece: no.
    assert client.post("/maquilas/solicitudes", json={**datos, "cantidad": 10}, headers=cliente).status_code == 400
    assert client.post("/maquilas/solicitudes", json={**datos, "personalizacion": ["empaque"]}, headers=cliente).status_code == 400
    # El mínimo de la maquila (1000) no aplica: manda el del producto.
    r = client.post("/maquilas/solicitudes", json=datos, headers=cliente)
    assert r.status_code == 201, r.text
    sol = r.json()
    assert sol["modalidad"] == "marca_blanca" and sol["categoria"] == "textil"
    assert sol["producto"]["nombre"] == "Camiseta básica algodón" and sol["personalizacion"] == [{"clave": "logo", "nombre": "Logo"}]
    assert sol["destinos"][0]["maquiladora_id"] == m
    # Le llega a la maquila y, al aceptarse, suma al contador del producto.
    assert client.get("/maquilas/recibidas", headers=hm).json()[0]["modalidad"] == "marca_blanca"
    client.put(f"/maquilas/solicitudes/{sol['id']}/propuesta", json={**PROPUESTA, "tramos": [{"cantidad_min": 50, "precio_unitario": 16000}]}, headers=hm)
    prop = client.get(f"/maquilas/solicitudes/{sol['id']}", headers=cliente).json()["propuestas"][0]
    pedido = client.post(f"/maquilas/propuestas/{prop['id']}/aceptar", json={}, headers=cliente).json()
    assert pedido["producto_mb_id"] == producto["id"]
    assert client.get(f"/maquilas/catalogo/{producto['id']}", headers=cliente).json()["pedidos"] == 1


def test_el_equipo_oculta_un_producto(client, db_session, mongo_maq, cliente, admin_headers):
    _, hm = _maquila(db_session, mongo_maq)
    producto = _producto(client, hm)
    r = client.post(f"/maquilas/admin/productos/{producto['id']}/ocultar", json={"motivo": "Fotos de otra marca"}, headers=admin_headers)
    assert r.status_code == 200 and r.json()["oculto"]["motivo"] == "Fotos de otra marca"
    assert client.get("/maquilas/catalogo", headers=cliente).json() == []
    assert client.get(f"/maquilas/catalogo/{producto['id']}", headers=cliente).status_code == 404
    assert client.get("/maquilas/admin/productos?ocultos=true", headers=admin_headers).json()[0]["id"] == producto["id"]
    client.post(f"/maquilas/admin/productos/{producto['id']}/mostrar", headers=admin_headers)
    assert len(client.get("/maquilas/catalogo", headers=cliente).json()) == 1
    assert client.get("/maquilas/admin/productos", headers=cliente).status_code == 403


# ==================== Ficha técnica guiada ====================

def test_ficha_guiada_genera_el_pdf_y_queda_en_la_solicitud(client, db_session, mongo_maq, cliente):
    _, hm = _maquila(db_session, mongo_maq)
    ficha = {"medidas": "S: 48 x 68 cm · M: 51 x 71 cm", "materiales": "Algodón peinado 180 g", "colores": "Negro 19-4007 TCX"}
    previa = client.post("/maquilas/fichas/vista-previa", json={"titulo": "Camiseta", "categoria": "textil", "ficha": ficha}, headers=cliente)
    assert previa.status_code == 200 and previa.content.startswith(b"%PDF") and previa.headers["content-type"] == "application/pdf"
    assert client.post("/maquilas/fichas/vista-previa", json={"titulo": "Camiseta", "categoria": "textil", "ficha": {}},
                       headers=cliente).status_code == 422

    sol = _solicitud(client, cliente, ficha_guiada=ficha)
    assert [c["clave"] for c in sol["ficha_guiada"]] == ["medidas", "materiales", "colores"]
    assert sol["ficha_tecnica"]["content_type"] == "application/pdf"
    # La maquila destino ve la ficha y descarga el PDF.
    vista = client.get(f"/maquilas/solicitudes/{sol['id']}", headers=hm).json()
    assert vista["ficha_guiada"][1]["valor"] == "Algodón peinado 180 g"
    pdf = client.get(vista["ficha_tecnica"]["url"], headers=hm)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")


# ==================== Calidad ====================

def test_reporte_de_calidad_con_objecion_y_aprobacion(client, db_session, mongo_maq, cliente):
    pedido, hm, _ = _pedido_con_criterios(client, db_session, mongo_maq, cliente)
    pid = pedido["id"]
    assert pedido["calidad"]["criterios"] == CRITERIOS
    _hasta_calidad(client, cliente, hm, pid)

    detalle = client.get(f"/maquilas/pedidos/{pid}", headers=hm).json()
    assert detalle["acciones"]["completar_etapa"] is None and detalle["acciones"]["enviar_reporte_calidad"] is True
    assert "reporte de calidad" in detalle["bloqueo"]
    # La etapa no se cierra a mano, y el reporte trae un resultado por criterio.
    assert client.post(f"/maquilas/pedidos/{pid}/etapas/control_calidad", json={}, headers=hm).status_code == 409
    foto = _subir(client, hm, "evidencia")
    assert client.post(f"/maquilas/pedidos/{pid}/calidad", json={"unidades_inspeccionadas": 50, "resultados": [{"cumple": True}],
                                                                  "fotos": [foto]}, headers=hm).status_code == 400
    r = client.post(f"/maquilas/pedidos/{pid}/calidad", json={
        "unidades_inspeccionadas": 50, "fotos": [foto], "nota": "Lote 1",
        "resultados": [{"cumple": True}, {"cumple": False, "observacion": "3 piezas descentradas"}]}, headers=hm)
    assert r.status_code == 200, r.text
    assert r.json()["calidad"]["reportes"][0]["resultados"][1]["criterio"] == "Bordado centrado"
    # Mientras el cliente revisa, no se sube otro; sin calidad aprobada no hay empaque ni despacho.
    assert client.post(f"/maquilas/pedidos/{pid}/calidad", json={"unidades_inspeccionadas": 5, "fotos": [_subir(client, hm, "evidencia")],
                                                                  "resultados": [{"cumple": True}, {"cumple": True}]}, headers=hm).status_code == 409
    assert client.post(f"/maquilas/pedidos/{pid}/etapas/empaque", json={}, headers=hm).status_code == 409

    vista = client.get(f"/maquilas/pedidos/{pid}", headers=cliente).json()
    assert vista["acciones"]["responder_calidad"] is True
    assert client.post(f"/maquilas/pedidos/{pid}/calidad/responder", json={"aprobado": False}, headers=cliente).status_code == 400
    r = client.post(f"/maquilas/pedidos/{pid}/calidad/responder", json={"aprobado": False, "comentario": "Corrijan el bordado"}, headers=cliente)
    assert r.json()["calidad"]["reportes"][0]["estado"] == "objetado"

    client.post(f"/maquilas/pedidos/{pid}/calidad", json={"unidades_inspeccionadas": 50, "fotos": [_subir(client, hm, "evidencia")],
                                                           "resultados": [{"cumple": True}, {"cumple": True}]}, headers=hm)
    r = client.post(f"/maquilas/pedidos/{pid}/calidad/responder", json={"aprobado": True}, headers=cliente)
    etapa = next(e for e in r.json()["etapas"] if e["clave"] == "control_calidad")
    assert etapa["estado"] == "hecha" and "ronda 2" in etapa["nota"] and r.json()["etapa_siguiente"] == "empaque"
    assert client.post(f"/maquilas/pedidos/{pid}/etapas/empaque", json={}, headers=hm).status_code == 200


# ==================== Reseñas y métricas ====================

def test_resena_unica_respuesta_y_metricas(client, db_session, mongo_maq, cliente, admin_headers):
    pedido, hm, m = _pedido_con_criterios(client, db_session, mongo_maq, cliente)
    pid = pedido["id"]
    resena = {"calificacion": 4, "puntualidad": 5, "calidad": 4, "comunicacion": 3, "comentario": "Muy buen bordado"}
    assert client.post(f"/maquilas/pedidos/{pid}/resena", json=resena, headers=cliente).status_code == 409  # aún no entregado
    final = _entregar(client, cliente, hm, pid)
    assert final["acciones"]["resenar"] is True and final["acciones"]["repetir"] is True

    r = client.post(f"/maquilas/pedidos/{pid}/resena", json=resena, headers=cliente)
    assert r.status_code == 201, r.text
    assert client.post(f"/maquilas/pedidos/{pid}/resena", json=resena, headers=cliente).status_code == 409
    perfil = client.get(f"/maquilas/directorio/{m}", headers=cliente).json()
    assert perfil["metricas"]["calificacion"] == 4.0 and perfil["metricas"]["resenas"] == 1
    assert perfil["metricas"]["pedidos_entregados"] == 1 and perfil["metricas"]["cumplimiento"] == 100

    # La maquila responde una vez.
    rid = r.json()["id"]
    assert client.get(f"/maquilas/pedidos/{pid}", headers=hm).json()["acciones"]["responder_resena"] is True
    assert client.post(f"/maquilas/resenas/{rid}/respuesta", json={"respuesta": "¡Gracias por confiar!"}, headers=hm).status_code == 200
    assert client.post(f"/maquilas/resenas/{rid}/respuesta", json={"respuesta": "Otra"}, headers=hm).status_code == 409
    publicas = client.get(f"/maquilas/directorio/{m}/resenas", headers=cliente).json()
    assert publicas[0]["respuesta"]["texto"] == "¡Gracias por confiar!" and publicas[0]["autor"] == "Paula"

    # El equipo la oculta: sale del perfil y de las métricas.
    client.post(f"/maquilas/admin/resenas/{rid}/ocultar", json={"motivo": "Datos personales en el texto"}, headers=admin_headers)
    assert client.get(f"/maquilas/directorio/{m}/resenas", headers=cliente).json() == []
    assert client.get(f"/maquilas/directorio/{m}", headers=cliente).json()["metricas"]["calificacion"] is None
    mias = client.get("/maquilas/mi-maquiladora/resenas", headers=hm).json()
    assert mias["resenas"][0]["oculta"]["motivo"] == "Datos personales en el texto"


def test_cumplimiento_cuenta_las_entregas_tardias(client, db_session, mongo_maq, cliente):
    from datetime import datetime

    pedido, hm, m = _pedido_con_criterios(client, db_session, mongo_maq, cliente)
    mongo_maq.pedidos.update_one({"_id": pedido["id"]}, {"$set": {"fecha_compromiso": datetime.utcnow() - timedelta(days=2)}})
    _entregar(client, cliente, hm, pedido["id"])
    assert client.get(f"/maquilas/directorio/{m}", headers=cliente).json()["metricas"]["cumplimiento"] == 0


# ==================== Repetir pedido ====================

def test_repetir_pedido_crea_una_dirigida_con_el_mismo_brief(client, db_session, mongo_maq, cliente):
    pedido, hm, m = _pedido_con_criterios(client, db_session, mongo_maq, cliente)
    pid = pedido["id"]
    assert client.post(f"/maquilas/pedidos/{pid}/repetir", json={"cantidad": 800}, headers=cliente).status_code == 409
    _entregar(client, cliente, hm, pid)
    assert client.post(f"/maquilas/pedidos/{pid}/repetir", json={"cantidad": 10}, headers=cliente).status_code == 400  # mínimo 100

    objetivo = (date.today() + timedelta(days=45)).isoformat()
    r = client.post(f"/maquilas/pedidos/{pid}/repetir", json={"cantidad": 800, "fecha_objetivo": objetivo}, headers=cliente)
    assert r.status_code == 201, r.text
    nueva = r.json()
    assert nueva["modalidad"] == "dirigida" and nueva["cantidad"] == 800 and nueva["titulo"] == "Camisetas con mi marca"
    assert nueva["repite_de"]["codigo"] == pedido["codigo"] and nueva["destinos"][0]["maquiladora_id"] == m
    assert nueva["campos"][0]["valor"] == "S a XL"
    # La maquila ve su propuesta anterior para partir de ella.
    vista = client.get(f"/maquilas/solicitudes/{nueva['id']}", headers=hm).json()
    assert vista["propuesta_anterior"]["criterios_calidad"] == CRITERIOS
    assert vista["propuesta_anterior"]["precio_unitario"] == 15000  # tramo de 500+ con la cantidad nueva
    # Otro cliente no puede repetir este pedido.
    _, otro = crear_usuario_con_token(db_session, rol="solicitante", nombre="Otro")
    assert client.post(f"/maquilas/pedidos/{pid}/repetir", json={"cantidad": 800}, headers=otro).status_code == 404
