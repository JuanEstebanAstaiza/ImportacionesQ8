"""Zarpi Maquilas (fase 4): estudio de marca, ruta legal, encargos de diseño,
colaboradores de la maquiladora y el panel del equipo (resumen, monitoreo y
configuración). Contra el Mongo real del compose.
"""
import pytest

from conftest import crear_usuario_con_token
from tests.test_maquilas_fase2 import (  # noqa: F401 - `mongo_maq` y `cliente` son fixtures
    PROPUESTA, _maquila, _solicitud, _subir, cliente, mongo_maq,
)


@pytest.fixture()
def admin_headers(db_session):
    return crear_usuario_con_token(db_session, rol="admin")[1]


@pytest.fixture()
def disenador(db_session):
    return crear_usuario_con_token(db_session, rol="designer", nombre="Dani")[1]


def _subir_como(client, headers, tipo, bucket, nombre, contenido):
    r = client.post(f"/maquilas/archivos/{bucket}", data={"tipo": tipo}, files={"archivo": (nombre, contenido)}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
PDF = b"%PDF-1.4\n" + b"0" * 64


def _marca(client, headers, **cambios):
    logo = _subir_como(client, headers, "marca", "medios", "logo.png", PNG)["id"]
    datos = {"nombre": "Paula Studio", "eslogan": "Ropa que dura", "categoria": "textil", "logo": logo,
             "paleta": [{"nombre": "Lila", "hex": "#7c3aed"}, {"nombre": "Negro", "hex": "#111111"}],
             "tipografias": ["Montserrat", "Inter"], "archivos": [_subir_como(client, headers, "marca_archivo", "documentos", "manual.pdf", PDF)["id"]]}
    datos.update(cambios)
    r = client.post("/maquilas/marcas", json=datos, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


# ==================== Estudio de marca y ruta legal ====================

def test_marca_con_kit_y_ruta_legal_por_categoria(client, db_session, cliente):
    marca = _marca(client, cliente)
    assert marca["paleta"][0]["hex"] == "#7C3AED" and marca["logo"]["url"]
    claves = [p["clave"] for p in marca["ruta_legal"]]
    assert "registro_marca" in claves and "invima" not in claves  # textil no necesita INVIMA
    cosmetica = client.put(f"/maquilas/marcas/{marca['id']}", json={
        "nombre": "Paula Studio", "categoria": "cosmetica", "logo": marca["logo"]["id"],
        "archivos": [a["id"] for a in marca["archivos"]]}, headers=cliente).json()
    assert "invima" in [p["clave"] for p in cosmetica["ruta_legal"]] and cosmetica["logo"]["id"] == marca["logo"]["id"]

    r = client.put(f"/maquilas/marcas/{marca['id']}/ruta/registro_marca", json={"estado": "en_curso", "nota": "Radicada"}, headers=cliente)
    paso = next(p for p in r.json()["ruta_legal"] if p["clave"] == "registro_marca")
    assert paso["estado"] == "en_curso" and paso["nota"] == "Radicada"
    client.put(f"/maquilas/marcas/{marca['id']}/ruta/rut", json={"estado": "hecho"}, headers=cliente)
    assert client.get("/maquilas/marcas", headers=cliente).json()[0]["ruta_avance"]["hechos"] == 1
    assert client.put(f"/maquilas/marcas/{marca['id']}/ruta/no_existe", json={"estado": "hecho"}, headers=cliente).status_code == 404
    # Color mal escrito
    assert client.post("/maquilas/marcas", json={"nombre": "X1", "paleta": [{"hex": "morado"}]}, headers=cliente).status_code == 422


def test_la_marca_es_privada(client, db_session, mongo_maq, cliente):
    marca = _marca(client, cliente)
    _, otro = crear_usuario_con_token(db_session, rol="solicitante")
    assert client.get(f"/maquilas/marcas/{marca['id']}", headers=otro).status_code == 404
    assert client.get(marca["logo"]["url"], headers=otro).status_code == 404
    _, hm = _maquila(db_session, mongo_maq)
    assert client.get("/maquilas/marcas", headers=hm).status_code == 403
    assert client.get(marca["logo"]["url"], headers=hm).status_code == 404


def test_la_maquila_ve_la_marca_adjunta_a_su_solicitud(client, db_session, mongo_maq, cliente):
    _, hm = _maquila(db_session, mongo_maq)
    _, hm_otra = _maquila(db_session, mongo_maq, nombre="Otra", categorias=("cosmetica",))
    marca = _marca(client, cliente)
    sol = _solicitud(client, cliente, marca_id=marca["id"], confidencial=True)
    assert sol["marca"]["nombre"] == "Paula Studio" and sol["marca"]["paleta"][1]["hex"] == "#111111"
    # Confidencial: antes del acuerdo solo el nombre.
    vista = client.get(f"/maquilas/solicitudes/{sol['id']}", headers=hm).json()
    assert vista["marca"] == {"nombre": "Paula Studio"}
    assert client.get(marca["logo"]["url"], headers=hm).status_code == 404
    client.post(f"/maquilas/solicitudes/{sol['id']}/acuerdo", headers=hm)
    vista = client.get(f"/maquilas/solicitudes/{sol['id']}", headers=hm).json()
    assert vista["marca"]["tipografias"] == ["Montserrat", "Inter"]
    assert client.get(vista["marca"]["logo"]["url"], headers=hm).status_code == 200
    assert client.get(vista["marca"]["archivos"][0]["url"], headers=hm).status_code == 200
    # Una maquila a la que no le llegó, no.
    assert client.get(marca["logo"]["url"], headers=hm_otra).status_code == 404


# ==================== Encargos de diseño ====================

def test_encargo_de_logo_por_versiones(client, db_session, cliente, disenador):
    marca = _marca(client, cliente, logo=None)
    ref = _subir_como(client, cliente, "marca_archivo", "documentos", "idea.png", PNG)["id"]
    r = client.post(f"/maquilas/marcas/{marca['id']}/encargos", json={
        "tipo": "logo", "brief": "Un logo minimalista con las iniciales PS y un hilo que las une.", "referencias": [ref]}, headers=cliente)
    assert r.status_code == 201, r.text
    encargo = r.json()
    assert encargo["estado"] == "nuevo" and encargo["acciones"]["cancelar"] is True

    # Diseño lo ve en su cola, ve la referencia y lo toma.
    cola = client.get("/maquilas/diseno/encargos?estado=abiertos", headers=disenador).json()
    assert cola[0]["id"] == encargo["id"] and cola[0]["pendiente_de_mi"] is True
    detalle = client.get(f"/maquilas/encargos/{encargo['id']}", headers=disenador).json()
    assert client.get(detalle["referencias"][0]["url"], headers=disenador).status_code == 200
    assert detalle["marca"]["paleta"][0]["hex"] == "#7C3AED"
    r = client.post(f"/maquilas/diseno/encargos/{encargo['id']}/tomar", headers=disenador)
    assert r.json()["estado"] == "en_proceso" and r.json()["disenador"]["nombre"] == "Dani"
    assert client.post(f"/maquilas/encargos/{encargo['id']}/cancelar", headers=cliente).status_code == 409
    # Otro diseñador no entrega en un encargo ajeno.
    _, otro_dis = crear_usuario_con_token(db_session, rol="designer")
    v_otro = _subir_como(client, otro_dis, "diseno", "documentos", "x.png", PNG)["id"]
    assert client.post(f"/maquilas/diseno/encargos/{encargo['id']}/versiones", json={"archivos": [v_otro]}, headers=otro_dis).status_code == 403

    v1 = _subir_como(client, disenador, "diseno", "documentos", "logo-v1.png", PNG)["id"]
    r = client.post(f"/maquilas/diseno/encargos/{encargo['id']}/versiones", json={"archivos": [v1], "nota": "Primera idea"}, headers=disenador)
    assert r.json()["estado"] == "entregado"
    vista = client.get(f"/maquilas/encargos/{encargo['id']}", headers=cliente).json()
    assert vista["acciones"]["responder"] is True
    assert client.get(vista["versiones"][0]["archivos"][0]["url"], headers=cliente).status_code == 200
    assert client.post(f"/maquilas/encargos/{encargo['id']}/responder", json={"aprobado": False}, headers=cliente).status_code == 400
    r = client.post(f"/maquilas/encargos/{encargo['id']}/responder", json={"aprobado": False, "comentario": "Más grueso el hilo"}, headers=cliente)
    assert r.json()["estado"] == "cambios"

    v2 = _subir_como(client, disenador, "diseno", "documentos", "logo-v2.png", PNG)["id"]
    v2pdf = _subir_como(client, disenador, "diseno", "documentos", "logo-v2.pdf", PDF)["id"]
    client.post(f"/maquilas/diseno/encargos/{encargo['id']}/versiones", json={"archivos": [v2, v2pdf]}, headers=disenador)
    r = client.post(f"/maquilas/encargos/{encargo['id']}/responder", json={"aprobado": True}, headers=cliente)
    assert r.json()["estado"] == "aprobado" and r.json()["versiones"][1]["estado"] == "aprobada"
    # Lo aprobado pasa a la marca: la imagen queda como logo y los archivos en su kit.
    marca = client.get(f"/maquilas/marcas/{marca['id']}", headers=cliente).json()
    assert marca["logo"]["id"] == v2 and {v2, v2pdf} <= {a["id"] for a in marca["archivos"]}
    # Y siguen ahí al editar la marca con los mismos ids.
    r = client.put(f"/maquilas/marcas/{marca['id']}", json={"nombre": "Paula Studio", "logo": v2,
                                                            "archivos": [a["id"] for a in marca["archivos"]]}, headers=cliente)
    assert r.status_code == 200 and r.json()["logo"]["id"] == v2


def test_accesos_de_los_encargos(client, db_session, mongo_maq, cliente, disenador):
    marca = _marca(client, cliente)
    encargo = client.post(f"/maquilas/marcas/{marca['id']}/encargos",
                          json={"tipo": "etiqueta", "brief": "Etiqueta tejida para el cuello con el logo y la talla."}, headers=cliente).json()
    _, otro = crear_usuario_con_token(db_session, rol="solicitante")
    assert client.get(f"/maquilas/encargos/{encargo['id']}", headers=otro).status_code == 404
    _, hm = _maquila(db_session, mongo_maq)
    assert client.get("/maquilas/diseno/encargos", headers=hm).status_code == 403
    assert client.get("/maquilas/diseno/encargos", headers=cliente).status_code == 403
    assert client.post(f"/maquilas/marcas/{marca['id']}/encargos", json={"tipo": "video", "brief": "x" * 30}, headers=cliente).status_code == 400
    # El cliente no sube entregas de diseño; Diseño no sube archivos del cliente.
    assert client.post("/maquilas/archivos/documentos", data={"tipo": "diseno"}, files={"archivo": ("a.pdf", PDF)}, headers=cliente).status_code == 400
    assert client.post("/maquilas/archivos/medios", data={"tipo": "marca"}, files={"archivo": ("a.png", PNG)}, headers=disenador).status_code == 400
    # Cancelar mientras nadie lo toma.
    assert client.post(f"/maquilas/encargos/{encargo['id']}/cancelar", headers=cliente).json()["estado"] == "cancelado"


# ==================== Colaboradores ====================

def test_colaboradores_de_la_maquila(client, db_session, mongo_maq, cliente):
    m, hm = _maquila(db_session, mongo_maq)
    datos = {"nombre": "Camilo", "apellido": "Ruiz", "email": "camilo.colab@example.com", "password": "ClaveSegura1"}
    r = client.post("/maquilas/mi-maquiladora/equipo", json=datos, headers=hm)
    assert r.status_code == 201, r.text
    colab_id = r.json()["id"]
    assert client.post("/maquilas/mi-maquiladora/equipo", json=datos, headers=hm).status_code == 400  # correo repetido
    equipo = client.get("/maquilas/mi-maquiladora/equipo", headers=hm).json()
    assert [x["rol"] for x in equipo] == ["dueno", "colaborador"]

    login = client.post("/auth/login", json={"email": datos["email"], "password": datos["password"]})
    assert login.status_code == 200, login.text
    hc = {"Authorization": f"Bearer {login.json()['access_token']}"}
    # El colaborador atiende solicitudes, pero no administra el equipo ni el perfil.
    assert client.get("/maquilas/mi-maquiladora", headers=hc).json()["mi_rol"] == "colaborador"
    assert client.get("/maquilas/mi-maquiladora/equipo", headers=hc).status_code == 403
    assert client.put("/maquilas/mi-maquiladora", json={"descripcion": "x" * 30}, headers=hc).status_code == 403
    sol = _solicitud(client, cliente, modalidad="dirigida", maquiladora_id=m)
    assert client.put(f"/maquilas/solicitudes/{sol['id']}/propuesta", json=PROPUESTA, headers=hc).status_code == 200

    from maquilas import avisos
    assert colab_id in avisos.usuarios_de_maquiladora(mongo_maq, m)
    r = client.post(f"/maquilas/mi-maquiladora/equipo/{colab_id}/desactivar", headers=hm)
    assert r.json()["activo"] is False
    assert colab_id not in avisos.usuarios_de_maquiladora(mongo_maq, m)
    assert client.get("/maquilas/mi-maquiladora", headers=hc).status_code == 401
    assert client.post(f"/maquilas/mi-maquiladora/equipo/{colab_id}/activar", headers=hm).json()["activo"] is True


# ==================== Panel del equipo ====================

def test_resumen_y_monitoreo(client, db_session, mongo_maq, cliente, admin_headers):
    _, hm = _maquila(db_session, mongo_maq)
    sol = _solicitud(client, cliente)
    client.put(f"/maquilas/solicitudes/{sol['id']}/propuesta", json=PROPUESTA, headers=hm)
    prop = client.get(f"/maquilas/solicitudes/{sol['id']}", headers=cliente).json()["propuestas"][0]
    pedido = client.post(f"/maquilas/propuestas/{prop['id']}/aceptar", json={}, headers=cliente).json()
    _solicitud(client, cliente, titulo="Gorras bordadas")

    resumen = client.get("/maquilas/admin/resumen", headers=admin_headers).json()
    assert resumen["pedidos_activos"] == 1 and resumen["valor_activo"] == pedido["total"]
    assert resumen["solicitudes"]["aceptada"] == 1 and resumen["solicitudes"]["abierta"] == 1
    assert resumen["maquiladoras"]["verificada"] == 1

    lista = client.get("/maquilas/admin/pedidos?q=PM-", headers=admin_headers).json()
    assert lista[0]["codigo"] == pedido["codigo"] and "anticipo" in lista[0]["aviso_cliente"].lower()
    assert client.get("/maquilas/admin/pedidos?retrasados=true", headers=admin_headers).json() == []
    assert len(client.get("/maquilas/admin/solicitudes?estado=abierta", headers=admin_headers).json()) == 1
    assert client.get("/maquilas/admin/solicitudes?q=gorras", headers=admin_headers).json()[0]["titulo"] == "Gorras bordadas"
    # El equipo ve el detalle (solo lectura); los clientes no ven el panel.
    assert client.get(f"/maquilas/pedidos/{pedido['id']}", headers=admin_headers).json()["lado"] == "equipo"
    assert client.get("/maquilas/admin/resumen", headers=cliente).status_code == 403


def test_configuracion_del_modulo(client, db_session, admin_headers):
    actual = client.get("/maquilas/admin/configuracion", headers=admin_headers).json()
    categorias = actual["categorias"] + [{"clave": "joyeria", "nombre": "Joyería y bisutería"}]
    ruta = actual["ruta_legal"] + [{"clave": "camara", "nombre": "Matrícula mercantil", "descripcion": "Renueva cada año",
                                    "enlace": "https://www.rues.org.co", "categorias": []}]
    r = client.put("/maquilas/admin/configuracion", json={"cambios": {"cupo_abierta": 7, "categorias": categorias, "ruta_legal": ruta,
                                                                       "procesos": ["Corte", "Corte", "Láser"]}}, headers=admin_headers)
    assert r.status_code == 200, r.text
    assert r.json()["cupo_abierta"] == 7 and r.json()["procesos"] == ["Corte", "Láser"]
    publicos = client.get("/maquilas/parametros").json()
    assert "joyeria" in [c["clave"] for c in publicos["categorias"]] and publicos["ruta_legal"][-1]["clave"] == "camara"

    malos = [
        {"cupo_abierta": 0},
        {"categorias": [c for c in categorias if c["clave"] != "textil"]},  # no se borran claves en uso
        {"categorias": categorias + [{"clave": "Con Espacio", "nombre": "X"}]},
        {"ruta_legal": ruta[:-1] + [{**ruta[-1], "enlace": "javascript:alert(1)"}]},
        {"procesos": []},
    ]
    for cambio in malos:
        assert client.put("/maquilas/admin/configuracion", json={"cambios": cambio}, headers=admin_headers).status_code == 400, cambio
    # Solo el admin (soporte no) cambia la configuración.
    _, soporte = crear_usuario_con_token(db_session, rol="soporte")
    assert client.put("/maquilas/admin/configuracion", json={"cambios": {"cupo_abierta": 3}}, headers=soporte).status_code == 403
