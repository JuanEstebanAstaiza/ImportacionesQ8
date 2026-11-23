"""Zarpi Maquilas (fase 1): registro de la maquiladora, expediente y verificación.

Corre contra el Mongo real del compose (`MONGO_DB_MAQUILAS=zarpi_maquilas_test`),
igual que Liquidaciones: GridFS y los índices únicos se prueban tal cual.
"""
from uuid import uuid4

import pytest

from conftest import auth_headers_for, capturar_otp_envio, crear_usuario_con_token
from maquilas import db as mongo
from models.usuario import Usuario

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
PDF = b"%PDF-1.4\n" + b"0" * 64


@pytest.fixture(autouse=True)
def mongo_maq():
    base = mongo.obtener_db()
    for nombre in base.list_collection_names():
        base.drop_collection(nombre)
    mongo.asegurar_indices(base)
    yield base


def _registro(email=None, nit=None, **cambios):
    datos = {
        "empresa": {
            "razon_social": "Confecciones Prueba S.A.S.", "nombre_comercial": "Confecciones Prueba",
            "nit": nit or f"900{uuid4().int % 10**6:06d}-1", "ciudad": "Medellín",
        },
        "representante": {
            "nombre": "Sofía", "apellido": "Arango", "tipo_documento": "CC", "numero_documento": "1020304050",
            "indicativo_pais_telefono": "+57", "telefono": "3001234567",
            "email": email or f"maquila_{uuid4().hex[:8]}@example.com", "password": "ClaveSegura1",
        },
        "fabricacion": {"categorias": ["textil"], "procesos": ["Corte", "Confección"], "pedido_minimo": 100},
        "acepto_politica_datos": True,
    }
    for clave, valor in cambios.items():
        datos[clave] = {**datos[clave], **valor} if isinstance(valor, dict) else valor
    return datos


def _registrar_verificada(client, monkeypatch, **kw):
    """Registra una maquiladora, confirma el correo y devuelve sus headers."""
    capturado = capturar_otp_envio(monkeypatch)
    datos = _registro(**kw)
    r = client.post("/maquilas/registro", json=datos)
    assert r.status_code == 201, r.text
    v = client.post("/auth/verificar-email", json={"email": datos["representante"]["email"], "otp": capturado["otp"]})
    assert v.status_code == 200, v.text
    assert v.json()["rol"] == "maquiladora"
    return {"Authorization": f"Bearer {v.json()['access_token']}"}, datos


def _subir(client, headers, tipo, contenido=None):
    bucket = "medios" if tipo == "foto" else "documentos"
    nombre = f"{tipo}.png" if tipo == "foto" else f"{tipo}.pdf"
    r = client.post(f"/maquilas/archivos/{bucket}", data={"tipo": tipo},
                    files={"archivo": (nombre, contenido or (PNG if tipo == "foto" else PDF))}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _completar_expediente(client, headers):
    client.put("/maquilas/mi-maquiladora", json={"descripcion": "Taller de confección con 40 operarias y corte automático."},
               headers=headers)
    r = client.put("/maquilas/mi-maquiladora/documentos", json={
        "rut": _subir(client, headers, "rut")["id"],
        "camara_comercio": _subir(client, headers, "camara_comercio")["id"],
        "galeria": [_subir(client, headers, "foto")["id"]],
    }, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture()
def equipo(db_session):
    return crear_usuario_con_token(db_session, rol="admin")


# ==================== Registro ====================

def test_registro_crea_cuenta_y_empresa_y_pide_codigo(client, db_session, monkeypatch, mongo_maq):
    capturado = capturar_otp_envio(monkeypatch)
    datos = _registro()
    r = client.post("/maquilas/registro", json=datos)
    assert r.status_code == 201, r.text
    assert r.json()["requiere_verificacion"] is True
    assert capturado["otp"]

    usuario = db_session.query(Usuario).filter(Usuario.email == datos["representante"]["email"]).one()
    assert (usuario.rol, usuario.email_verificado, usuario.nit) == ("maquiladora", False, datos["empresa"]["nit"])
    miembro = mongo_maq.miembros.find_one({"_id": usuario.id})
    assert miembro["rol"] == "dueno"
    assert mongo_maq.maquiladoras.find_one({"_id": miembro["maquiladora_id"]})["estado"] == "registrada"

    # Sin confirmar el correo no entra.
    login = client.post("/auth/login", json={"email": datos["representante"]["email"], "password": "ClaveSegura1"})
    assert login.status_code == 403


def test_registro_rechaza_nit_repetido_y_datos_invalidos(client, monkeypatch, mongo_maq):
    capturar_otp_envio(monkeypatch)
    assert client.post("/maquilas/registro", json=_registro(nit="901222333-4")).status_code == 201
    repetido = client.post("/maquilas/registro", json=_registro(nit="901.222.333-4"))
    assert repetido.status_code == 409
    assert client.post("/maquilas/registro", json=_registro(fabricacion={"categorias": ["inventada"]})).status_code == 400
    assert client.post("/maquilas/registro", json=_registro(acepto_politica_datos=False)).status_code == 422
    sin_digito = _registro(representante={"password": "SoloLetrasLargas"})
    assert client.post("/maquilas/registro", json=sin_digito).status_code == 422
    assert mongo_maq.maquiladoras.count_documents({}) == 1


def test_registro_cerrado_responde_403(client, db_session):
    from services import modulos

    modulos.fijar(db_session, "registro", False, "test")
    db_session.commit()
    try:
        assert client.post("/maquilas/registro", json=_registro()).status_code == 403
    finally:
        modulos.fijar(db_session, "registro", True, "test")
        db_session.commit()


def test_el_admin_crea_maquiladoras_desde_el_panel(client, db_session, equipo, mongo_maq):
    _, h_admin = equipo
    datos = _registro()
    datos.pop("acepto_politica_datos")
    r = client.post("/maquilas/admin/maquiladoras", json=datos, headers=h_admin)
    assert r.status_code == 201, r.text
    assert r.json()["creada_por_equipo"] is True

    # Entra de una: el equipo ya responde por el correo.
    login = client.post("/auth/login", json={"email": datos["representante"]["email"], "password": "ClaveSegura1"})
    assert login.status_code == 200, login.text
    assert login.json()["rol"] == "maquiladora"

    # Solo el admin crea cuentas.
    _, h_soporte = crear_usuario_con_token(db_session, rol="soporte")
    otra = _registro()
    otra.pop("acepto_politica_datos")
    assert client.post("/maquilas/admin/maquiladoras", json=otra, headers=h_soporte).status_code == 403


# ==================== Expediente y verificación ====================

def test_no_se_envia_a_verificacion_con_el_expediente_incompleto(client, monkeypatch):
    headers, _ = _registrar_verificada(client, monkeypatch)
    r = client.post("/maquilas/mi-maquiladora/enviar-verificacion", headers=headers)
    assert r.status_code == 400
    assert "RUT" in r.json()["detail"]
    pendientes = client.get("/maquilas/mi-maquiladora", headers=headers).json()["pendientes"]
    assert len(pendientes) == 4  # RUT, cámara de comercio, descripción y galería


def test_ciclo_de_verificacion(client, db_session, monkeypatch, equipo):
    headers, datos = _registrar_verificada(client, monkeypatch)
    _, h_admin = equipo
    expediente = _completar_expediente(client, headers)
    assert expediente["pendientes"] == []
    assert expediente["documentos"]["rut"]["url"].startswith("/maquilas/archivos/documentos/")

    r = client.post("/maquilas/mi-maquiladora/enviar-verificacion", headers=headers)
    assert r.status_code == 200 and r.json()["estado"] == "en_revision"
    maquiladora_id = r.json()["id"]

    cola = client.get("/maquilas/admin/maquiladoras", params={"estado": "en_revision"}, headers=h_admin).json()
    assert [m["id"] for m in cola["maquiladoras"]] == [maquiladora_id]
    assert cola["contadores"]["en_revision"] == 1

    # Rechazo con motivo → corrige → vuelve a enviar → aprobación.
    r = client.post(f"/maquilas/admin/maquiladoras/{maquiladora_id}/rechazar",
                    json={"motivo": "La cámara de comercio está vencida"}, headers=h_admin)
    assert r.json()["estado"] == "rechazada" and r.json()["motivo"] == "La cámara de comercio está vencida"
    assert client.post("/maquilas/mi-maquiladora/enviar-verificacion", headers=headers).json()["estado"] == "en_revision"
    r = client.post(f"/maquilas/admin/maquiladoras/{maquiladora_id}/aprobar", headers=h_admin)
    assert r.status_code == 200 and r.json()["estado"] == "verificada"

    # Verificada: la razón social y el NIT ya no se cambian solos.
    assert client.put("/maquilas/mi-maquiladora", json={"nit": "900111222-3"}, headers=headers).status_code == 409
    assert client.put("/maquilas/mi-maquiladora", json={"ciudad": "Bello"}, headers=headers).json()["ciudad"] == "Bello"

    # Avisos en la campana para el dueño.
    from models.notificacion import Notificacion
    usuario = db_session.query(Usuario).filter(Usuario.email == datos["representante"]["email"]).one()
    titulos = {n.titulo for n in db_session.query(Notificacion).filter(Notificacion.usuario_id == usuario.id)}
    assert {"Tu expediente necesita cambios", "Tu maquiladora está verificada"} <= titulos

    # Suspender y reactivar (solo admin) la devuelve a verificada.
    r = client.post(f"/maquilas/admin/maquiladoras/{maquiladora_id}/suspender",
                    json={"motivo": "Queja grave de un cliente"}, headers=h_admin)
    assert r.json()["estado"] == "suspendida"
    assert client.post(f"/maquilas/admin/maquiladoras/{maquiladora_id}/reactivar",
                       headers=h_admin).json()["estado"] == "verificada"


def test_no_se_aprueba_lo_que_no_esta_en_revision(client, monkeypatch, equipo):
    headers, _ = _registrar_verificada(client, monkeypatch)
    _, h_admin = equipo
    maquiladora_id = client.get("/maquilas/mi-maquiladora", headers=headers).json()["id"]
    assert client.post(f"/maquilas/admin/maquiladoras/{maquiladora_id}/aprobar", headers=h_admin).status_code == 409


# ==================== Archivos ====================

def test_acceso_a_los_archivos_del_expediente(client, monkeypatch, equipo, db_session):
    headers, _ = _registrar_verificada(client, monkeypatch)
    _, h_admin = equipo
    expediente = _completar_expediente(client, headers)
    rut = expediente["documentos"]["rut"]["url"]
    foto = expediente["galeria"][0]["url"]
    _, h_otro = crear_usuario_con_token(db_session, rol="solicitante")

    assert client.get(rut, headers=headers).status_code == 200
    assert client.get(rut, headers=h_admin).status_code == 200
    assert client.get(rut, headers=h_otro).status_code == 404
    assert client.get(rut).status_code == 404
    # La galería se vuelve pública solo con la maquiladora verificada.
    assert client.get(foto).status_code == 404
    maquiladora_id = expediente["id"]
    client.post("/maquilas/mi-maquiladora/enviar-verificacion", headers=headers)
    client.post(f"/maquilas/admin/maquiladoras/{maquiladora_id}/aprobar", headers=h_admin)
    assert client.get(foto).status_code == 200


def test_no_se_adjunta_el_archivo_de_otro(client, monkeypatch):
    h1, _ = _registrar_verificada(client, monkeypatch)
    h2, _ = _registrar_verificada(client, monkeypatch)
    ajeno = _subir(client, h1, "rut")["id"]
    r = client.put("/maquilas/mi-maquiladora/documentos", json={"rut": ajeno}, headers=h2)
    assert r.status_code == 400


def test_archivo_con_formato_falso_se_rechaza(client, monkeypatch):
    headers, _ = _registrar_verificada(client, monkeypatch)
    r = client.post("/maquilas/archivos/documentos", data={"tipo": "rut"},
                    files={"archivo": ("rut.pdf", b"no soy un pdf")}, headers=headers)
    assert r.status_code == 400


# ==================== Roles y módulo ====================

def test_roles_y_modulo_apagado(client, db_session, monkeypatch):
    from services import modulos

    _, h_cliente = crear_usuario_con_token(db_session, rol="solicitante")
    assert client.get("/maquilas/mi-maquiladora", headers=h_cliente).status_code == 403
    assert client.get("/maquilas/admin/maquiladoras", headers=h_cliente).status_code == 403
    assert client.get("/maquilas/parametros").status_code == 200

    modulos.fijar(db_session, "maquilas", False, "test")
    db_session.commit()
    try:
        assert client.get("/maquilas/parametros").status_code == 404
        assert client.get("/configuracion-publica").json()["modulo_maquilas_habilitado"] is False
    finally:
        modulos.fijar(db_session, "maquilas", True, "test")
        db_session.commit()


def test_ticket_de_soporte_desde_maquilas(client, db_session):
    _, headers = crear_usuario_con_token(db_session, rol="solicitante")
    r = client.post("/chat/soporte", json={"asunto": "No puedo subir mi RUT", "modulo": "maquilas"}, headers=headers)
    assert r.status_code in (200, 201), r.text


def test_roles_sin_cotizaciones_no_ven_las_de_los_demas(client, db_session):
    """La rama «admin ve todo» de cotizaciones y órdenes ya no atrapa a otros roles."""
    from conftest import crear_empresa_importadora
    from models.cotizacion import Cotizacion

    _, h_cliente = crear_usuario_con_token(db_session, rol="solicitante")
    importador, _ = crear_empresa_importadora(db_session, nombre_empresa=f"Empresa {uuid4().hex[:6]}")
    cliente_id = db_session.query(Usuario).filter(Usuario.rol == "solicitante").first().id
    db_session.add(Cotizacion(id=str(uuid4()), solicitante_id=cliente_id, importador_id=importador.id,
                              modalidad="dirigida", nombre_producto="Camisetas", descripcion_cliente="Prueba",
                              cantidad_minima=100, incoterm="FOB", pais_importacion="China",
                              linea_producto="Textiles", tipo_calidad="estandar"))
    db_session.commit()

    for rol in ("maquiladora", "designer"):
        _, headers = crear_usuario_con_token(db_session, rol=rol)
        assert client.get("/cotizaciones", headers=headers).json() == [], rol
        assert client.get("/ordenes", headers=headers).json() == [], rol
    _, h_admin = crear_usuario_con_token(db_session, rol="admin")
    assert len(client.get("/cotizaciones", headers=h_admin).json()) >= 1
