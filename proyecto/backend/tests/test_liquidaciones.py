"""Zarpi Liquidaciones: lotes, revisión, reserva, operación y archivos en MongoDB.

Corre contra el Mongo real del compose (`MONGO_DB=zarpi_liquidaciones_test`):
el módulo depende de GridFS, del índice único parcial y de
`find_one_and_update`, que un simulador no garantiza igual.
"""
from datetime import datetime, timedelta
from uuid import uuid4

import pytest

from conftest import crear_empresa_importadora, crear_usuario_con_token, auth_headers_for
from liquidaciones import db as mongo

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
PDF = b"%PDF-1.4\n" + b"0" * 64
MP4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * (3 * 1024 * 1024)


@pytest.fixture(autouse=True)
def mongo_liq():
    base = mongo.obtener_db()
    for nombre in base.list_collection_names():
        base.drop_collection(nombre)
    mongo.asegurar_indices(base)
    yield base


@pytest.fixture()
def empresa(db_session):
    importador, dueño = crear_empresa_importadora(
        db_session, nombre_empresa=f"Importadora {uuid4().hex[:6]}",
        email_dueño=f"dueno_{uuid4().hex[:8]}@example.com")
    return importador, dueño, auth_headers_for(dueño)


@pytest.fixture()
def comprador(db_session):
    usuario, headers = crear_usuario_con_token(db_session, rol="solicitante", nombre="Laura")
    return usuario, headers


@pytest.fixture()
def equipo(db_session):
    usuario, headers = crear_usuario_con_token(db_session, rol="admin")
    return usuario, headers


def _subir(client, headers, tipo, contenido=PNG, nombre=None):
    bucket = "medios" if tipo in ("foto", "video") else "documentos"
    extension = {"foto": "png", "video": "mp4"}.get(tipo, "pdf")
    r = client.post(
        f"/liquidaciones/archivos/{bucket}",
        data={"tipo": tipo},
        files={"archivo": (nombre or f"{tipo}.{extension}", contenido)},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


def _activar(client, headers, razon="Tecnohogar S.A.S."):
    rut = _subir(client, headers, "rut", PDF, "rut.pdf")
    r = client.post("/liquidaciones/activacion", json={
        "razon_social": razon, "nit": "900123456-7", "tipo_persona": "juridica", "contacto": "Laura Rincón",
        "ciudad": "Pasto", "direccion": "Cl 18 # 25-40", "telefono": "+57 315 555 0199",
        "rut_archivo_id": rut["id"], "acepta_declaracion": True,
    }, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def _lote(client, headers, **extra):
    fotos = [_subir(client, headers, "foto")["id"] for _ in range(3)]
    payload = {
        "nombre": "Termos de acero inoxidable 1 L", "descripcion": "Ideal para temporada de fin de año",
        "categoria": "Hogar", "unidades": 600, "unidad_venta": "unidades", "condicion": "nuevo",
        "fotos": fotos, "videos": [], "precio_cop": 9_000_000, "ciudad": "Bogotá",
        "entrega": "vendedor_despacha", "requiere_registro_sanitario": False, "dias_cierre": 10,
        "destacado": False, **extra,
    }
    r = client.post("/liquidaciones/mis-lotes", json=payload, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _lote_publicado(client, empresa_headers, equipo_headers, **extra):
    lote = _lote(client, empresa_headers, **extra)
    r = client.post(f"/liquidaciones/admin/lotes/{lote['id']}/aprobar", headers=equipo_headers)
    assert r.status_code == 200, r.text
    return r.json()


# ==================== Activación ====================

def test_sin_activar_no_publica_ni_reserva(client, empresa, comprador, equipo):
    _, _, h_empresa = empresa
    _, h_comprador = comprador
    fotos = [_subir(client, h_empresa, "foto")["id"] for _ in range(3)]
    r = client.post("/liquidaciones/mis-lotes", json={
        "nombre": "Lote", "categoria": "Hogar", "unidades": 10, "condicion": "nuevo", "fotos": fotos,
        "precio_cop": 100_000, "ciudad": "Cali", "entrega": "comprador_recoge", "dias_cierre": 5,
    }, headers=h_empresa)
    assert r.status_code == 403
    assert "Activa" in r.json()["detail"]

    estado = client.get("/liquidaciones/activacion", headers=h_comprador).json()
    assert estado["activa"] is False
    assert estado["prellenado"]["contacto"] == "Laura"


def test_activacion_exige_declaracion(client, comprador):
    _, headers = comprador
    rut = _subir(client, headers, "rut", PDF)
    r = client.post("/liquidaciones/activacion", json={
        "razon_social": "Tecnohogar", "nit": "900123456", "contacto": "Laura", "ciudad": "Pasto",
        "direccion": "Cl 18 # 25-40", "telefono": "3155550199", "rut_archivo_id": rut["id"],
        "acepta_declaracion": False,
    }, headers=headers)
    assert r.status_code == 422


def test_asesor_hereda_activacion_de_su_empresa(client, db_session, empresa):
    importador, _, h_empresa = empresa
    _activar(client, h_empresa, "Importadora Andina")
    _, h_asesor = crear_usuario_con_token(db_session, rol="asesor", importador_id=importador.id)
    assert client.get("/liquidaciones/activacion", headers=h_asesor).json()["activa"] is True
    lote = _lote(client, h_asesor)
    mis = client.get("/liquidaciones/mis-lotes", headers=h_empresa).json()
    assert [l["id"] for l in mis["lotes"]] == [lote["id"]]


# ==================== Publicación y revisión ====================

def test_publicar_revisar_y_aprobar(client, empresa, comprador, equipo):
    _, _, h_empresa = empresa
    _, h_equipo = equipo
    _, h_comprador = comprador
    _activar(client, h_empresa, "Importadora Andina")
    lote = _lote(client, h_empresa)
    assert lote["estado"] == "en_revision"
    assert lote["precio_unidad_cop"] == 15_000

    # En revisión no aparece en el catálogo ni en la landing.
    assert client.get("/liquidaciones/publico/lotes").json() == []
    cola = client.get("/liquidaciones/admin/revision", headers=h_equipo).json()
    assert [l["id"] for l in cola["lotes"]] == [lote["id"]]
    assert cola["parametros"]["checklist_revision"]

    aprobado = client.post(f"/liquidaciones/admin/lotes/{lote['id']}/aprobar", headers=h_equipo).json()
    assert aprobado["estado"] == "publicado"
    assert aprobado["cierra_en"].endswith("Z")

    publicos = client.get("/liquidaciones/publico/lotes").json()
    assert [l["id"] for l in publicos] == [lote["id"]]
    catalogo = client.get("/liquidaciones/lotes", headers=h_comprador).json()
    assert catalogo["disponibles"] == 1
    assert catalogo["lotes"][0]["vendedor"]["razon_social"] == "Importadora Andina"


def test_rechazo_con_motivos_y_reenvio(client, empresa, equipo):
    _, _, h_empresa = empresa
    _, h_equipo = equipo
    _activar(client, h_empresa)
    lote = _lote(client, h_empresa)
    r = client.post(f"/liquidaciones/admin/lotes/{lote['id']}/rechazar", json={
        "motivos": ["Precio incoherente con el lote"], "nota": "Revisa el precio por unidad"}, headers=h_equipo)
    assert r.status_code == 200
    mis = client.get("/liquidaciones/mis-lotes", headers=h_empresa).json()
    assert mis["lotes"][0]["estado"] == "rechazado"
    assert mis["lotes"][0]["rechazo"]["motivos"] == ["Precio incoherente con el lote"]

    datos = {k: lote[k] for k in ("nombre", "descripcion", "categoria", "unidades", "unidad_venta", "condicion",
                                  "ciudad", "entrega", "requiere_registro_sanitario", "dias_cierre", "destacado")}
    datos.update(fotos=[f["id"] for f in lote["fotos"]], videos=[], precio_cop=7_000_000)
    r = client.put(f"/liquidaciones/mis-lotes/{lote['id']}", json=datos, headers=h_empresa)
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "en_revision"
    assert r.json()["rechazo"] is None


def test_validaciones_de_publicacion(client, empresa, comprador):
    _, _, h_empresa = empresa
    _, h_comprador = comprador
    _activar(client, h_empresa)
    foto = _subir(client, h_empresa, "foto")["id"]
    base = {"nombre": "Lote", "categoria": "Hogar", "unidades": 10, "condicion": "nuevo", "fotos": [foto],
            "precio_cop": 100_000, "ciudad": "Cali", "entrega": "comprador_recoge", "dias_cierre": 5}
    r = client.post("/liquidaciones/mis-lotes", json=base, headers=h_empresa)
    assert r.status_code == 400 and "fotos" in r.json()["detail"]

    r = client.post("/liquidaciones/mis-lotes", json={**base, "condicion": "devolucion"}, headers=h_empresa)
    assert r.status_code == 422  # «Explica el estado»

    fotos = [_subir(client, h_empresa, "foto")["id"] for _ in range(3)]
    r = client.post("/liquidaciones/mis-lotes", json={**base, "fotos": fotos, "dias_cierre": 30}, headers=h_empresa)
    assert r.status_code == 400 and "15 días" in r.json()["detail"]

    # Un cotizante no publica, y nadie adjunta fotos de otra cuenta.
    _activar(client, h_comprador)
    assert client.post("/liquidaciones/mis-lotes", json={**base, "fotos": fotos}, headers=h_comprador).status_code == 403
    assert _subir_rechazado(client, h_comprador, "foto") == 403


def _subir_rechazado(client, headers, tipo):
    r = client.post("/liquidaciones/archivos/medios", data={"tipo": tipo},
                    files={"archivo": ("a.png", PNG)}, headers=headers)
    return r.status_code


def test_archivo_con_firma_falsa_se_rechaza(client, empresa):
    _, _, h_empresa = empresa
    r = client.post("/liquidaciones/archivos/medios", data={"tipo": "foto"},
                    files={"archivo": ("foto.png", b"esto no es una imagen")}, headers=h_empresa)
    assert r.status_code == 400


# ==================== Reserva y operación ====================

def test_reserva_primero_en_dar_clic(client, db_session, empresa, comprador, equipo):
    _, _, h_empresa = empresa
    _, h_equipo = equipo
    _, h_comprador = comprador
    _activar(client, h_empresa, "Importadora Andina")
    _activar(client, h_comprador, "Tecnohogar")
    lote = _lote_publicado(client, h_empresa, h_equipo)

    r = client.post(f"/liquidaciones/lotes/{lote['id']}/reservar", headers=h_comprador)
    assert r.status_code == 201, r.text
    operacion = r.json()
    assert operacion["estado"] == "activa"
    assert operacion["contactos"]["vendedor"]["telefono"]
    assert operacion["mensajes"][0]["tipo"] == "sistema"

    _, h_otro = crear_usuario_con_token(db_session, rol="solicitante")
    _activar(client, h_otro, "Otro comercio")
    r = client.post(f"/liquidaciones/lotes/{lote['id']}/reservar", headers=h_otro)
    assert r.status_code == 409

    # La empresa no compra lo suyo.
    assert client.post(f"/liquidaciones/lotes/{lote['id']}/reservar", headers=h_empresa).status_code in (400, 409)
    # El equipo no compra.
    assert client.post(f"/liquidaciones/lotes/{lote['id']}/reservar", headers=h_equipo).status_code == 403


def test_chat_documentos_y_vendido(client, empresa, comprador, equipo):
    _, _, h_empresa = empresa
    _, h_equipo = equipo
    _, h_comprador = comprador
    _activar(client, h_empresa)
    _activar(client, h_comprador)
    lote = _lote_publicado(client, h_empresa, h_equipo)
    op = client.post(f"/liquidaciones/lotes/{lote['id']}/reservar", headers=h_comprador).json()

    r = client.post(f"/liquidaciones/operaciones/{op['id']}/mensajes", json={"contenido": "¿Despachan a Pasto?"},
                    headers=h_comprador)
    assert r.status_code == 201 and r.json()["autor"] == "yo"

    comprobante = _subir(client, h_comprador, "comprobante_pago", PDF)
    r = client.post(f"/liquidaciones/operaciones/{op['id']}/comprobante", json={"archivo_id": comprobante["id"]},
                    headers=h_comprador)
    assert r.status_code == 200, r.text
    assert r.json()["comprobantes_pago"][0]["id"] == comprobante["id"]
    # El vendedor no sube comprobantes ni el comprador facturas.
    factura = _subir(client, h_empresa, "factura", PDF)
    assert client.post(f"/liquidaciones/operaciones/{op['id']}/comprobante", json={"archivo_id": factura["id"]},
                       headers=h_empresa).status_code == 403
    assert client.post(f"/liquidaciones/operaciones/{op['id']}/factura", json={"archivo_id": factura["id"]},
                       headers=h_empresa).status_code == 200

    # El comprobante lo ven las dos partes y nadie más.
    url = f"/liquidaciones/archivos/documentos/{comprobante['id']}"
    assert client.get(url, headers=h_empresa).status_code == 200
    assert client.get(url).status_code == 404

    vista = client.get(f"/liquidaciones/operaciones/{op['id']}", headers=h_empresa).json()
    assert vista["lado"] == "vendedor"
    assert [m["autor"] for m in vista["mensajes"]][:2] == ["sistema", "contraparte"]

    assert client.post(f"/liquidaciones/operaciones/{op['id']}/vendido", headers=h_comprador).status_code == 403
    r = client.post(f"/liquidaciones/operaciones/{op['id']}/vendido", headers=h_empresa)
    assert r.status_code == 200 and r.json()["estado"] == "vendida"
    assert client.get(f"/liquidaciones/lotes/{lote['id']}", headers=h_comprador).json()["estado"] == "vendido"


def test_cancelar_devuelve_el_lote(client, empresa, comprador, equipo):
    _, _, h_empresa = empresa
    _, h_equipo = equipo
    _, h_comprador = comprador
    _activar(client, h_empresa)
    _activar(client, h_comprador)
    lote = _lote_publicado(client, h_empresa, h_equipo)
    op = client.post(f"/liquidaciones/lotes/{lote['id']}/reservar", headers=h_comprador).json()
    r = client.post(f"/liquidaciones/operaciones/{op['id']}/cancelar", json={"motivo": "Cambio de planes"},
                    headers=h_comprador)
    assert r.status_code == 200 and r.json()["estado"] == "cancelada"
    assert client.get(f"/liquidaciones/lotes/{lote['id']}", headers=h_comprador).json()["estado"] == "publicado"
    # Se puede volver a reservar.
    assert client.post(f"/liquidaciones/lotes/{lote['id']}/reservar", headers=h_comprador).status_code == 201


def test_vencimientos_perezosos(client, empresa, comprador, equipo, mongo_liq):
    _, _, h_empresa = empresa
    _, h_equipo = equipo
    _, h_comprador = comprador
    _activar(client, h_empresa)
    _activar(client, h_comprador)
    lote = _lote_publicado(client, h_empresa, h_equipo)
    op = client.post(f"/liquidaciones/lotes/{lote['id']}/reservar", headers=h_comprador).json()

    # Pasan las 48 h sin marcar vendido: la reserva vence y el lote vuelve.
    mongo_liq.operaciones.update_one({"_id": op["id"]}, {"$set": {"vence_en": datetime.utcnow() - timedelta(minutes=1)}})
    assert client.get(f"/liquidaciones/lotes/{lote['id']}", headers=h_comprador).json()["estado"] == "publicado"
    assert client.get(f"/liquidaciones/operaciones/{op['id']}", headers=h_comprador).json()["estado"] == "vencida"

    # Llega la fecha de cierre: sale del catálogo.
    mongo_liq.lotes.update_one({"_id": lote["id"]}, {"$set": {"cierra_en": datetime.utcnow() - timedelta(minutes=1)}})
    catalogo = client.get("/liquidaciones/lotes", headers=h_comprador).json()
    assert catalogo["lotes"] == [] and catalogo["destacados"] == []
    mis = client.get("/liquidaciones/mis-lotes", headers=h_empresa).json()
    assert mis["lotes"][0]["estado"] == "cerrado_sin_venta"


def test_horas_para_confirmar_las_fija_el_admin(client, empresa, comprador, equipo):
    _, _, h_empresa = empresa
    _, h_equipo = equipo
    _, h_comprador = comprador
    r = client.put("/liquidaciones/admin/configuracion", json={"horas_para_confirmar": 24}, headers=h_equipo)
    assert r.status_code == 200 and r.json()["horas_para_confirmar"] == 24
    _activar(client, h_empresa)
    _activar(client, h_comprador)
    lote = _lote_publicado(client, h_empresa, h_equipo)
    op = client.post(f"/liquidaciones/lotes/{lote['id']}/reservar", headers=h_comprador).json()
    reservada = datetime.fromisoformat(op["reservada_en"].rstrip("Z"))
    vence = datetime.fromisoformat(op["vence_en"].rstrip("Z"))
    assert vence - reservada == timedelta(hours=24)

    assert client.put("/liquidaciones/admin/configuracion", json={"horas_para_confirmar": 0},
                      headers=h_equipo).status_code == 400


# ==================== Archivos ====================

def test_video_por_trozos_y_descarga_con_range(client, empresa, equipo):
    _, _, h_empresa = empresa
    _, h_equipo = equipo
    _activar(client, h_empresa)
    video = _subir(client, h_empresa, "video", MP4)
    assert video["tamano"] == len(MP4)
    lote = _lote_publicado(client, h_empresa, h_equipo, videos=[video["id"]])

    r = client.get(f"/liquidaciones/archivos/medios/{video['id']}", headers={"Range": "bytes=4-11"})
    assert r.status_code == 206
    assert r.content == b"ftypmp42"
    assert r.headers["content-range"] == f"bytes 4-11/{len(MP4)}"
    assert lote["videos"][0]["id"] == video["id"]


def test_fotos_de_lote_en_revision_no_son_publicas(client, empresa, comprador, equipo):
    _, _, h_empresa = empresa
    _, h_comprador = comprador
    _, h_equipo = equipo
    _activar(client, h_empresa)
    lote = _lote(client, h_empresa)
    url = lote["fotos"][0]["url"]
    assert client.get(url).status_code == 404
    assert client.get(url, headers=h_comprador).status_code == 404
    assert client.get(url, headers=h_empresa).status_code == 200
    assert client.get(url, headers=h_equipo).status_code == 200
    client.post(f"/liquidaciones/admin/lotes/{lote['id']}/aprobar", headers=h_equipo)
    assert client.get(url).status_code == 200


# ==================== Panel del equipo ====================

def test_monitoreo_e_intervencion(client, empresa, comprador, equipo, db_session):
    _, _, h_empresa = empresa
    _, h_equipo = equipo
    _, h_comprador = comprador
    _activar(client, h_empresa, "Importadora Andina")
    _activar(client, h_comprador, "Tecnohogar")
    lote = _lote_publicado(client, h_empresa, h_equipo)
    op = client.post(f"/liquidaciones/lotes/{lote['id']}/reservar", headers=h_comprador).json()

    listado = client.get("/liquidaciones/admin/operaciones?q=tecnohogar", headers=h_equipo).json()
    assert listado["total"] == 1 and listado["operaciones"][0]["id"] == op["id"]

    r = client.post(f"/liquidaciones/admin/operaciones/{op['id']}/intervenir",
                    json={"contenido": "Recuerden adjuntar la factura"}, headers=h_equipo)
    assert r.status_code == 200
    vista = client.get(f"/liquidaciones/operaciones/{op['id']}", headers=h_comprador).json()
    assert vista["mensajes"][-1]["contenido"].startswith("[Soporte Zarpi]")
    assert vista["mensajes"][-1]["autor"] == "equipo"

    # Soporte monitorea, pero las métricas y la configuración son del admin.
    _, h_soporte = crear_usuario_con_token(db_session, rol="soporte")
    assert client.get("/liquidaciones/admin/operaciones", headers=h_soporte).status_code == 200
    assert client.get("/liquidaciones/admin/metricas", headers=h_soporte).status_code == 403
    metricas = client.get("/liquidaciones/admin/metricas", headers=h_equipo).json()
    assert metricas["reservas_activas"] == 1 and metricas["publicados"] == 0


def test_suspender_cuenta_bloquea_reservar(client, empresa, comprador, equipo):
    _, _, h_empresa = empresa
    _, h_equipo = equipo
    _, h_comprador = comprador
    _activar(client, h_empresa)
    activacion = _activar(client, h_comprador)
    lote = _lote_publicado(client, h_empresa, h_equipo)
    r = client.put(f"/liquidaciones/admin/cuentas/{activacion['cuenta']}/suspension",
                   json={"suspendida": True, "motivo": "Revisión de documentos"}, headers=h_equipo)
    assert r.status_code == 200 and r.json()["suspendida"] is True
    r = client.post(f"/liquidaciones/lotes/{lote['id']}/reservar", headers=h_comprador)
    assert r.status_code == 403 and "suspendida" in r.json()["detail"]


def test_despublicar_y_destacar(client, empresa, comprador, equipo):
    _, _, h_empresa = empresa
    _, h_equipo = equipo
    _, h_comprador = comprador
    _activar(client, h_empresa)
    lote = _lote_publicado(client, h_empresa, h_equipo)
    r = client.post(f"/liquidaciones/admin/lotes/{lote['id']}/destacar", json={"destacado": True}, headers=h_equipo)
    assert r.json()["destacado"] is True
    catalogo = client.get("/liquidaciones/lotes", headers=h_comprador).json()
    assert [l["id"] for l in catalogo["destacados"]] == [lote["id"]]

    r = client.post(f"/liquidaciones/admin/lotes/{lote['id']}/despublicar",
                    json={"motivo": "Marca sin autorización"}, headers=h_equipo)
    assert r.status_code == 200 and r.json()["estado"] == "rechazado"
    assert client.get("/liquidaciones/publico/lotes").json() == []


def test_modulo_apagado_responde_404(client, db_session, comprador):
    from services import modulos

    _, headers = comprador
    modulos.fijar(db_session, "liquidaciones", False, "test")
    db_session.commit()
    try:
        assert client.get("/liquidaciones/lotes", headers=headers).status_code == 404
        assert client.get("/configuracion-publica").json()["modulo_liquidaciones_habilitado"] is False
    finally:
        modulos.fijar(db_session, "liquidaciones", True, "test")
        db_session.commit()
