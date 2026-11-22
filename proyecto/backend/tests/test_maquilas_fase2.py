"""Zarpi Maquilas (fase 2): directorio, solicitudes, confidencialidad, propuestas,
pedido con muestra, etapas y pagos por hitos, y chat. Contra el Mongo real del compose.
"""
from datetime import date, timedelta
from uuid import uuid4

import pytest

from conftest import crear_empresa_importadora, auth_headers_for, crear_usuario_con_token
from maquilas import db as mongo

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
PDF = b"%PDF-1.4\n" + b"0" * 64


@pytest.fixture(autouse=True)
def mongo_maq():
    base = mongo.obtener_db()
    for nombre in base.list_collection_names():
        base.drop_collection(nombre)
    mongo.asegurar_indices(base)
    yield base


def _maquila(db_session, mongo_maq, *, nombre="Maquila", categorias=("textil",), pedido_minimo=100, ciudad="Medellín",
             estado="verificada"):
    """Una maquiladora con su cuenta dueña, directo en las bases (sin pasar por el registro)."""
    usuario, headers = crear_usuario_con_token(db_session, rol="maquiladora", nombre=nombre)
    maquiladora_id = str(uuid4())
    mongo_maq.maquiladoras.insert_one({
        "_id": maquiladora_id, "estado": estado, "razon_social": f"{nombre} S.A.S.", "nombre_comercial": nombre,
        "nit": f"9{uuid4().int % 10**8:08d}", "nit_normalizado": f"9{uuid4().int % 10**8:08d}", "ciudad": ciudad,
        "categorias": list(categorias), "procesos": ["Corte", "Confección"], "pedido_minimo": pedido_minimo,
        "capacidad_mensual": 10000, "certificaciones": [], "galeria": [], "documentos": {}, "descripcion": "x" * 40,
        "verificada_en": None,
    })
    mongo_maq.miembros.insert_one({"_id": usuario.id, "maquiladora_id": maquiladora_id, "rol": "dueno"})
    return maquiladora_id, headers


@pytest.fixture()
def cliente(db_session):
    _, headers = crear_usuario_con_token(db_session, rol="solicitante", nombre="Paula")
    return headers


def _subir(client, headers, tipo, contenido=None):
    bucket = "medios" if tipo in ("referencia", "muestra", "evidencia", "foto") else "documentos"
    nombre = f"{tipo}.png" if bucket == "medios" else f"{tipo}.pdf"
    r = client.post(f"/maquilas/archivos/{bucket}", data={"tipo": tipo},
                    files={"archivo": (nombre, contenido or (PNG if bucket == "medios" else PDF))}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _solicitud(client, headers, **cambios):
    datos = {
        "modalidad": "abierta", "categoria": "textil", "titulo": "Camisetas con mi marca",
        "descripcion": "Camiseta básica de algodón con logo bordado en el pecho.", "cantidad": 500,
        "ciudad_entrega": "Medellín", "campos": {"tallas": "S a XL", "tela": "Algodón 180 g"},
        "fecha_objetivo": (date.today() + timedelta(days=60)).isoformat(),
    }
    datos.update(cambios)
    r = client.post("/maquilas/solicitudes", json=datos, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


PROPUESTA = {
    "tramos": [{"cantidad_min": 100, "precio_unitario": 18000}, {"cantidad_min": 500, "precio_unitario": 15000}],
    "costo_muestra": 50000, "dias_muestra": 7, "dias_produccion": 20,
    "hitos": {"anticipo": 50, "contra_entrega": 50}, "condiciones": "Incluye bordado y empaque individual.",
}


# ==================== Directorio y reparto ====================

def test_directorio_muestra_solo_verificadas_y_filtra(client, db_session, mongo_maq, cliente):
    _maquila(db_session, mongo_maq, nombre="Textil Uno")
    _maquila(db_session, mongo_maq, nombre="Cosmética", categorias=("cosmetica",))
    _maquila(db_session, mongo_maq, nombre="Sin verificar", estado="en_revision")
    _maquila(db_session, mongo_maq, nombre="Grande", pedido_minimo=5000)
    nombres = {m["nombre_comercial"] for m in client.get("/maquilas/directorio", headers=cliente).json()}
    assert nombres == {"Textil Uno", "Cosmética", "Grande"}
    textil = client.get("/maquilas/directorio", params={"categoria": "textil", "cantidad": 500}, headers=cliente).json()
    assert [m["nombre_comercial"] for m in textil] == ["Textil Uno"]
    # El perfil público no expone NIT ni documentos.
    perfil = client.get(f"/maquilas/directorio/{textil[0]['id']}", headers=cliente).json()
    assert "nit" not in perfil and "documentos" not in perfil


def test_solicitud_abierta_se_reparte_a_las_compatibles(client, db_session, mongo_maq, cliente):
    a, ha = _maquila(db_session, mongo_maq, nombre="A")
    b, hb = _maquila(db_session, mongo_maq, nombre="B", ciudad="Bogotá")
    _, hc = _maquila(db_session, mongo_maq, nombre="C", categorias=("calzado",))
    _, hd = _maquila(db_session, mongo_maq, nombre="D", pedido_minimo=1000)
    sol = _solicitud(client, cliente)
    assert {d["maquiladora_id"] for d in sol["destinos"]} == {a, b}
    assert len(client.get("/maquilas/recibidas", headers=ha).json()) == 1
    assert client.get("/maquilas/recibidas", headers=hc).json() == []
    assert client.get("/maquilas/recibidas", headers=hd).json() == []
    # Una maquila a la que no le llegó no la ve.
    assert client.get(f"/maquilas/solicitudes/{sol['id']}", headers=hc).status_code == 404


def test_solicitud_dirigida_valida_la_maquila(client, db_session, mongo_maq, cliente):
    m, _ = _maquila(db_session, mongo_maq, pedido_minimo=300)
    sin_verificar, _ = _maquila(db_session, mongo_maq, estado="registrada")
    r = client.post("/maquilas/solicitudes", json={**_payload_min(), "modalidad": "dirigida", "maquiladora_id": sin_verificar}, headers=cliente)
    assert r.status_code == 404
    r = client.post("/maquilas/solicitudes", json={**_payload_min(), "modalidad": "dirigida", "maquiladora_id": m, "cantidad": 100}, headers=cliente)
    assert r.status_code == 400 and "300" in r.json()["detail"]
    sol = _solicitud(client, cliente, modalidad="dirigida", maquiladora_id=m)
    assert [d["maquiladora_id"] for d in sol["destinos"]] == [m]


def _payload_min():
    return {"modalidad": "abierta", "categoria": "textil", "titulo": "Camisetas", "descripcion": "Camisetas con logo bordado.",
            "cantidad": 500, "ciudad_entrega": "Medellín"}


def test_sin_maquilas_compatibles_la_abierta_no_se_publica(client, cliente):
    r = client.post("/maquilas/solicitudes", json=_payload_min(), headers=cliente)
    assert r.status_code == 409


def test_la_maquila_no_publica_solicitudes(client, db_session, mongo_maq):
    _, h = _maquila(db_session, mongo_maq)
    assert client.post("/maquilas/solicitudes", json=_payload_min(), headers=h).status_code == 403


# ==================== Confidencialidad ====================

def test_confidencialidad_oculta_el_detalle_hasta_aceptar(client, db_session, mongo_maq, cliente):
    m, hm = _maquila(db_session, mongo_maq)
    ref = _subir(client, cliente, "referencia")
    sol = _solicitud(client, cliente, confidencial=True, referencias=[ref])
    vista = client.get(f"/maquilas/solicitudes/{sol['id']}", headers=hm).json()
    assert vista["detalle_visible"] is False and "descripcion" not in vista
    assert vista["mi_destino"]["acuerdo_pendiente"] is True
    assert client.get(f"/maquilas/archivos/medios/{ref}", headers=hm).status_code == 404
    assert client.put(f"/maquilas/solicitudes/{sol['id']}/propuesta", json=PROPUESTA, headers=hm).status_code == 403
    hilo = f"{sol['id']}:{m}"
    assert client.post(f"/maquilas/hilos/{hilo}/mensajes", json={"contenido": "Hola"}, headers=hm).status_code == 404

    vista = client.post(f"/maquilas/solicitudes/{sol['id']}/acuerdo", headers=hm).json()
    assert vista["detalle_visible"] is True and vista["descripcion"]
    assert {c["etiqueta"] for c in vista["campos"]} == {"Tallas y curva", "Tela o material"}
    assert client.get(f"/maquilas/archivos/medios/{ref}", headers=hm).status_code == 200
    assert client.put(f"/maquilas/solicitudes/{sol['id']}/propuesta", json=PROPUESTA, headers=hm).status_code == 200


# ==================== Propuestas ====================

def test_propuestas_comparables_y_aceptacion(client, db_session, mongo_maq, cliente):
    a, ha = _maquila(db_session, mongo_maq, nombre="A")
    b, hb = _maquila(db_session, mongo_maq, nombre="B")
    sol = _solicitud(client, cliente)

    # El primer tramo tiene que cubrir la cantidad pedida; los hitos suman 100.
    malo = {**PROPUESTA, "tramos": [{"cantidad_min": 1000, "precio_unitario": 10000}]}
    assert client.put(f"/maquilas/solicitudes/{sol['id']}/propuesta", json=malo, headers=ha).status_code == 400
    assert client.put(f"/maquilas/solicitudes/{sol['id']}/propuesta",
                      json={**PROPUESTA, "hitos": {"anticipo": 50}}, headers=ha).status_code == 422

    assert client.put(f"/maquilas/solicitudes/{sol['id']}/propuesta", json=PROPUESTA, headers=ha).status_code == 200
    # Editar no duplica.
    assert client.put(f"/maquilas/solicitudes/{sol['id']}/propuesta", json={**PROPUESTA, "costo_muestra": 0}, headers=ha).status_code == 200
    otra = {**PROPUESTA, "tramos": [{"cantidad_min": 200, "precio_unitario": 16000}], "costo_muestra": 0}
    client.put(f"/maquilas/solicitudes/{sol['id']}/propuesta", json=otra, headers=hb)
    # Rechazar después de proponer no aplica.
    assert client.post(f"/maquilas/solicitudes/{sol['id']}/rechazar", json={"motivo": "No tenemos cupo"}, headers=hb).status_code == 409

    vista = client.get(f"/maquilas/solicitudes/{sol['id']}", headers=cliente).json()
    assert vista["estado"] == "con_propuestas"
    props = {p["maquiladora"]["id"]: p for p in vista["propuestas"]}
    assert len(props) == 2
    # 500 unidades caen en el tramo de 500: 15.000 c/u, sin costo de muestra.
    assert props[a]["precio_unitario"] == 15000 and props[a]["total"] == 7_500_000
    assert [h["monto"] for h in props[a]["hitos"]] == [3_750_000, 3_750_000]
    assert props[b]["precio_unitario"] == 16000

    r = client.post(f"/maquilas/propuestas/{props[a]['id']}/aceptar", json={"motivo": "Mejor precio"}, headers=cliente)
    assert r.status_code == 200, r.text
    pedido = r.json()
    assert pedido["estado"] == "muestra" and pedido["total"] == 7_500_000
    vista = client.get(f"/maquilas/solicitudes/{sol['id']}", headers=cliente).json()
    assert vista["estado"] == "aceptada" and vista["pedido_id"] == pedido["id"]
    assert {p["estado"] for p in vista["propuestas"]} == {"aceptada", "descartada"}
    # Un segundo clic no crea otro pedido.
    assert client.post(f"/maquilas/propuestas/{props[b]['id']}/aceptar", json={}, headers=cliente).status_code == 409
    assert mongo_maq.pedidos.count_documents({}) == 1


def test_propuesta_vencida_no_se_acepta(client, db_session, mongo_maq, cliente):
    from datetime import datetime

    _, hm = _maquila(db_session, mongo_maq)
    sol = _solicitud(client, cliente)
    client.put(f"/maquilas/solicitudes/{sol['id']}/propuesta", json=PROPUESTA, headers=hm)
    mongo_maq.propuestas.update_many({}, {"$set": {"valida_hasta": datetime.utcnow() - timedelta(days=1)}})
    prop = client.get(f"/maquilas/solicitudes/{sol['id']}", headers=cliente).json()["propuestas"][0]
    assert prop["vencida"] is True
    assert client.post(f"/maquilas/propuestas/{prop['id']}/aceptar", json={}, headers=cliente).status_code == 409


# ==================== Pedido completo ====================

def _pedido(client, db_session, mongo_maq, cliente, hitos=None):
    m, hm = _maquila(db_session, mongo_maq)
    sol = _solicitud(client, cliente)
    client.put(f"/maquilas/solicitudes/{sol['id']}/propuesta", json={**PROPUESTA, "hitos": hitos or PROPUESTA["hitos"]}, headers=hm)
    prop = client.get(f"/maquilas/solicitudes/{sol['id']}", headers=cliente).json()["propuestas"][0]
    pedido = client.post(f"/maquilas/propuestas/{prop['id']}/aceptar", json={}, headers=cliente).json()
    return pedido, hm, m


def _pagar(client, cliente, hm, pedido_id, clave):
    archivo = _subir(client, cliente, "comprobante")
    r = client.post(f"/maquilas/pedidos/{pedido_id}/hitos/{clave}/comprobante", json={"archivo_id": archivo}, headers=cliente)
    assert r.status_code == 200, r.text
    r = client.post(f"/maquilas/pedidos/{pedido_id}/hitos/{clave}/confirmar", headers=hm)
    assert r.status_code == 200, r.text
    return r.json()


def test_pedido_de_punta_a_punta(client, db_session, mongo_maq, cliente):
    pedido, hm, m = _pedido(client, db_session, mongo_maq, cliente,
                            hitos={"anticipo": 40, "contra_muestra": 30, "contra_entrega": 30})
    pid = pedido["id"]
    muestra = [_subir(client, hm, "muestra")]

    # Sin anticipo confirmado no hay muestra.
    r = client.post(f"/maquilas/pedidos/{pid}/muestras", json={"archivos": muestra}, headers=hm)
    assert r.status_code == 409 and "anticipo" in r.json()["detail"]
    # Rechazo de comprobante y nuevo envío.
    archivo = _subir(client, cliente, "comprobante")
    client.post(f"/maquilas/pedidos/{pid}/hitos/anticipo/comprobante", json={"archivo_id": archivo}, headers=cliente)
    r = client.post(f"/maquilas/pedidos/{pid}/hitos/anticipo/rechazar", json={"motivo": "No veo el valor completo"}, headers=hm)
    assert next(h for h in r.json()["hitos"] if h["clave"] == "anticipo")["estado"] == "rechazado"
    _pagar(client, cliente, hm, pid, "anticipo")

    # Muestra → ajustes → ronda 2 → aprobada.
    assert client.post(f"/maquilas/pedidos/{pid}/muestras", json={"archivos": muestra, "nota": "Primera muestra"}, headers=hm).status_code == 200
    assert client.post(f"/maquilas/pedidos/{pid}/muestras", json={"archivos": [_subir(client, hm, "muestra")]}, headers=hm).status_code == 409
    r = client.post(f"/maquilas/pedidos/{pid}/muestras/responder", json={"aprobada": False, "comentario": "El bordado más pequeño"}, headers=cliente)
    assert r.json()["muestras"][0]["estado"] == "ajustes"
    client.post(f"/maquilas/pedidos/{pid}/muestras", json={"archivos": [_subir(client, hm, "muestra")]}, headers=hm)
    r = client.post(f"/maquilas/pedidos/{pid}/muestras/responder", json={"aprobada": True}, headers=cliente)
    assert r.json()["estado"] == "produccion" and len(r.json()["muestras"]) == 2

    # Sin el pago contra muestra no avanza la producción.
    r = client.post(f"/maquilas/pedidos/{pid}/etapas/insumos", json={}, headers=hm)
    assert r.status_code == 409 and "contra muestra" in r.json()["detail"]
    _pagar(client, cliente, hm, pid, "contra_muestra")
    # En orden.
    assert client.post(f"/maquilas/pedidos/{pid}/etapas/fabricacion", json={}, headers=hm).status_code == 409
    for clave in ("insumos", "preparacion", "fabricacion", "acabado", "control_calidad", "empaque"):
        r = client.post(f"/maquilas/pedidos/{pid}/etapas/{clave}", json={"nota": f"Listo {clave}", "fotos": [_subir(client, hm, "evidencia")]}, headers=hm)
        assert r.status_code == 200, (clave, r.text)
    r = client.post(f"/maquilas/pedidos/{pid}/etapas/despacho", json={"nota": "Guía 123"}, headers=hm)
    assert r.json()["estado"] == "despachado"

    # El cliente confirma que lo recibió; el contra entrega se puede pagar después.
    r = client.post(f"/maquilas/pedidos/{pid}/recibido", headers=cliente)
    assert r.json()["estado"] == "entregado"
    final = _pagar(client, cliente, hm, pid, "contra_entrega")
    assert final["pagado"] == final["total"]

    # El chat cuenta la historia y los dos lados lo ven.
    mensajes = client.get(f"/maquilas/hilos/{pedido['hilo']}/mensajes", headers=cliente).json()
    assert any("aprobó la muestra" in x["contenido"] for x in mensajes)
    assert len(client.get(f"/maquilas/hilos/{pedido['hilo']}/mensajes", headers=hm).json()) == len(mensajes)
    # Listados de cada lado.
    assert client.get("/maquilas/pedidos", headers=cliente).json()[0]["estado"] == "entregado"
    assert client.get("/maquilas/pedidos", headers=hm).json()[0]["etapas_hechas"] == 7


def test_el_despacho_exige_los_pagos_previos(client, db_session, mongo_maq, cliente):
    pedido, hm, _ = _pedido(client, db_session, mongo_maq, cliente, hitos={"contra_muestra": 50, "contra_entrega": 50})
    pid = pedido["id"]
    client.post(f"/maquilas/pedidos/{pid}/muestras", json={"archivos": [_subir(client, hm, "muestra")]}, headers=hm)
    client.post(f"/maquilas/pedidos/{pid}/muestras/responder", json={"aprobada": True}, headers=cliente)
    assert client.post(f"/maquilas/pedidos/{pid}/etapas/insumos", json={}, headers=hm).status_code == 409
    _pagar(client, cliente, hm, pid, "contra_muestra")
    for clave in ("insumos", "preparacion", "fabricacion", "acabado", "control_calidad", "empaque", "despacho"):
        assert client.post(f"/maquilas/pedidos/{pid}/etapas/{clave}", json={}, headers=hm).status_code == 200


def test_acceso_al_pedido_y_al_chat(client, db_session, mongo_maq, cliente):
    pedido, hm, _ = _pedido(client, db_session, mongo_maq, cliente)
    _, otro_cliente = crear_usuario_con_token(db_session, rol="solicitante")
    _, otra_maquila = _maquila(db_session, mongo_maq, nombre="Otra")
    _, h_admin = crear_usuario_con_token(db_session, rol="admin")
    for h in (otro_cliente, otra_maquila):
        assert client.get(f"/maquilas/pedidos/{pedido['id']}", headers=h).status_code == 404
        assert client.get(f"/maquilas/hilos/{pedido['hilo']}/mensajes", headers=h).status_code == 404
    # El equipo de Zarpi ve (monitoreo) pero no escribe.
    assert client.get(f"/maquilas/pedidos/{pedido['id']}", headers=h_admin).status_code == 200
    assert client.post(f"/maquilas/hilos/{pedido['hilo']}/mensajes", json={"contenido": "x"}, headers=h_admin).status_code == 403
    # Cada parte hace solo lo suyo.
    assert client.post(f"/maquilas/pedidos/{pedido['id']}/muestras", json={"archivos": ["x"]}, headers=cliente).status_code == 403
    assert client.post(f"/maquilas/pedidos/{pedido['id']}/recibido", headers=hm).status_code == 403


def test_chat_con_adjunto_y_aviso(client, db_session, mongo_maq, cliente):
    from models.notificacion import Notificacion

    pedido, hm, m = _pedido(client, db_session, mongo_maq, cliente)
    adjunto = _subir(client, cliente, "adjunto")
    r = client.post(f"/maquilas/hilos/{pedido['hilo']}/mensajes", json={"contenido": "Te paso el logo", "archivo_id": adjunto}, headers=cliente)
    assert r.status_code == 201 and r.json()["archivo"]["url"]
    assert client.get(r.json()["archivo"]["url"], headers=hm).status_code == 200
    usuario_maquila = mongo_maq.miembros.find_one({"maquiladora_id": m})["_id"]
    assert db_session.query(Notificacion).filter(Notificacion.usuario_id == usuario_maquila,
                                                 Notificacion.tipo == "maquila_mensaje").count() == 1


def test_cancelar_en_la_muestra(client, db_session, mongo_maq, cliente):
    pedido, hm, _ = _pedido(client, db_session, mongo_maq, cliente)
    r = client.post(f"/maquilas/pedidos/{pedido['id']}/cancelar", json={"motivo": "Cambiamos el diseño"}, headers=cliente)
    assert r.json()["estado"] == "cancelado" and r.json()["cancelacion"]["por"] == "cliente"
    assert client.post(f"/maquilas/pedidos/{pedido['id']}/cancelar", json={"motivo": "Otra vez"}, headers=hm).status_code == 409


def test_empresa_importadora_tambien_es_cliente(client, db_session, mongo_maq):
    """La cuenta dueña y sus asesores comparten las solicitudes de la empresa."""
    _maquila(db_session, mongo_maq)
    importador, dueno = crear_empresa_importadora(db_session, nombre_empresa=f"Imp {uuid4().hex[:5]}")
    from models.usuario import Usuario
    asesor = Usuario(id=str(uuid4()), email=f"asesor_{uuid4().hex[:6]}@example.com", password_hash="x", rol="asesor",
                     importador_id=importador.id, email_verificado=True, perfil_completo=True)
    db_session.add(asesor)
    db_session.commit()
    sol = _solicitud(client, auth_headers_for(dueno))
    assert [s["id"] for s in client.get("/maquilas/solicitudes", headers=auth_headers_for(asesor)).json()] == [sol["id"]]
    assert sol["cliente"]["empresa"] == importador.nombre_empresa


def test_el_aviso_del_pedido_le_dice_a_cada_lado_que_hacer(client, db_session, mongo_maq, cliente):
    pedido, hm, _ = _pedido(client, db_session, mongo_maq, cliente)
    assert "Sube el comprobante" in client.get(f"/maquilas/pedidos/{pedido['id']}", headers=cliente).json()["bloqueo"]
    assert "Esperando el pago" in client.get(f"/maquilas/pedidos/{pedido['id']}", headers=hm).json()["bloqueo"]
    _pagar(client, cliente, hm, pedido["id"], "anticipo")
    assert client.get(f"/maquilas/pedidos/{pedido['id']}", headers=hm).json()["bloqueo"] == "Envía la muestra al cliente."
