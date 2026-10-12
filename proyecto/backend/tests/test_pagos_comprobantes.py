"""Cargue y descargue de pagos, cobro de tokens por cotización, registro
cerrado desde Módulos y carpetas por módulo en gestión documental."""
from datetime import datetime, timedelta

import pytest

from conftest import crear_usuario_con_token, registro_payload
from models.configuracion import ConfiguracionPlataforma
from models.documental import Archivo, Carpeta
from models.usuario import Usuario
from services import enlaces_video as ev
from services import tendencias as tendencias_svc

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
COTIZACION = {"modalidad": "abierta", "pais_importacion": "China", "nombre_producto": "Termo",
              "descripcion_cliente": "Termo de acero 500 ml", "linea_producto": "Hogar",
              "tipo_calidad": "estandar", "cantidad_minima": 100}


@pytest.fixture(autouse=True)
def config_limpia(db_session):
    yield
    db_session.query(ConfiguracionPlataforma).filter(ConfiguracionPlataforma.clave.like("modulos.%")).delete(
        synchronize_session=False)
    db_session.query(ConfiguracionPlataforma).filter(ConfiguracionPlataforma.clave.like("pagos.%")).delete(
        synchronize_session=False)
    db_session.commit()


def _subir(client, headers, origen="manual", nombre="comprobante.png"):
    r = client.post("/documentos/archivos/upload", headers=headers,
                    files={"archivo": (nombre, PNG, "image/png")}, data={"origen": origen})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _ruta_carpeta(db_session, archivo_id):
    archivo = db_session.query(Archivo).filter(Archivo.id == archivo_id).one()
    nombres, carpeta_id = [], archivo.carpeta_id
    while carpeta_id:
        carpeta = db_session.query(Carpeta).filter(Carpeta.id == carpeta_id).one()
        nombres.insert(0, carpeta.nombre)
        carpeta_id = carpeta.parent_id
    return nombres


def _modulo(client, admin, **valores):
    r = client.put("/admin/modulos", json=valores, headers=admin)
    assert r.status_code == 200, r.text


# ── Gestión documental ───────────────────────────────────────────────────────

@pytest.mark.parametrize("origen,carpeta", [
    ("tendencias", ["Tendencias"]), ("catalogo", ["Catálogos"]), ("perfil-usuario", ["Perfil"]),
    ("presentacion-empresa", ["Presentación de empresa"]), ("manual", []),
])
def test_lo_que_suben_los_modulos_va_a_su_carpeta(client, db_session, origen, carpeta):
    _, headers = crear_usuario_con_token(db_session)
    assert _ruta_carpeta(db_session, _subir(client, headers, origen)) == carpeta


# ── Registro cerrado ─────────────────────────────────────────────────────────

def test_el_admin_cierra_el_registro(client, db_session):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    _modulo(client, admin, registro=False)
    assert client.get("/configuracion-publica").json()["registro_abierto"] is False
    r = client.post("/auth/register", json=registro_payload("cerrado@example.com"))
    assert r.status_code == 403 and "registro está cerrado" in r.json()["detail"]
    _modulo(client, admin, registro=True)
    assert client.get("/configuracion-publica").json()["registro_abierto"] is True


# ── Tokens por cotización ────────────────────────────────────────────────────

def test_cada_cotizacion_consume_un_token_y_primero_las_gratis(client, db_session):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    _modulo(client, admin, cobro_cotizaciones=True)
    usuario, headers = crear_usuario_con_token(db_session)

    r = client.post("/cotizaciones", json=COTIZACION, headers=headers)
    assert r.status_code == 402 and "tokens" in r.json()["detail"]

    usuario.cotizaciones_gratis = 1
    usuario.puntos_cotizacion = 1
    db_session.commit()
    assert client.post("/cotizaciones", json=COTIZACION, headers=headers).status_code == 201
    db_session.refresh(usuario)
    assert usuario.cotizaciones_gratis == 0 and usuario.puntos_cotizacion == 1  # primero la gratis
    assert client.post("/cotizaciones", json=COTIZACION, headers=headers).status_code == 201
    db_session.refresh(usuario)
    assert usuario.puntos_cotizacion == 0
    assert client.post("/cotizaciones", json=COTIZACION, headers=headers).status_code == 402

    _modulo(client, admin, cobro_cotizaciones=False)
    assert client.post("/cotizaciones", json=COTIZACION, headers=headers).status_code == 201


# ── Comprobantes ─────────────────────────────────────────────────────────────

def test_comprobante_de_tokens_aprobado_acredita(client, db_session):
    admin_user, admin = crear_usuario_con_token(db_session, rol="admin")
    usuario, headers = crear_usuario_con_token(db_session)
    otro_user, otro = crear_usuario_con_token(db_session)
    r = client.put("/comprobantes/admin/config", json={"precio_token_cop": 15000,
                                                       "datos_pago": "Bancolombia ahorros 123 · Zarpi S.A.S."},
                   headers=admin)
    assert r.status_code == 200
    resumen = client.get("/comprobantes/resumen", headers=headers).json()
    assert resumen["precio_token_cop"] == 15000 and resumen["datos_pago"].startswith("Bancolombia")

    archivo_id = _subir(client, headers, "comprobante-pago")
    r = client.post("/comprobantes", json={"tipo": "tokens", "archivo_id": archivo_id, "cantidad": 10,
                                           "monto_cop": 150000}, headers=headers)
    assert r.status_code == 201 and r.json()["estado"] == "pendiente"
    assert _ruta_carpeta(db_session, archivo_id) == ["Pagos", "Comprobantes de cotizaciones"]
    # El mismo archivo no se carga dos veces; el ajeno no se puede usar.
    assert client.post("/comprobantes", json={"tipo": "tokens", "archivo_id": archivo_id},
                       headers=headers).status_code == 409
    assert client.post("/comprobantes", json={"tipo": "tokens", "archivo_id": archivo_id},
                       headers=otro).status_code == 404

    # El archivo lo ven el dueño y el admin; nadie más.
    url = f"/documentos/archivos/{archivo_id}/descargar"
    assert client.get(url, headers=headers).status_code == 200
    assert client.get(url, headers=admin).status_code == 200
    assert client.get(url, headers=otro).status_code == 403

    pendientes = client.get("/comprobantes/admin?estado=pendiente", headers=admin).json()
    assert [p["id"] for p in pendientes] == [r.json()["id"]] and pendientes[0]["usuario"]["email"] == usuario.email
    assert client.get("/comprobantes/admin", headers=headers).status_code == 403

    r = client.post(f"/comprobantes/{pendientes[0]['id']}/aprobar", json={"cantidad": 10}, headers=admin)
    assert r.status_code == 200 and r.json()["estado"] == "aprobado"
    db_session.refresh(usuario)
    assert usuario.puntos_cotizacion == 10
    # No se aprueba dos veces.
    assert client.post(f"/comprobantes/{pendientes[0]['id']}/aprobar", json={"cantidad": 10},
                       headers=admin).status_code == 409


def test_comprobante_de_suscripcion_y_rechazo(client, db_session):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    usuario, headers = crear_usuario_con_token(db_session)
    a = client.post("/comprobantes", json={"tipo": "suscripcion", "archivo_id": _subir(client, headers)},
                    headers=headers).json()
    b = client.post("/comprobantes", json={"tipo": "suscripcion", "archivo_id": _subir(client, headers, nombre="b.png")},
                    headers=headers).json()
    r = client.post(f"/comprobantes/{a['id']}/rechazar", json={"motivo": "El monto no coincide"}, headers=admin)
    assert r.json()["estado"] == "rechazado"
    assert client.post(f"/comprobantes/{b['id']}/aprobar", json={"cantidad": 30}, headers=admin).status_code == 200
    assert tendencias_svc.tiene_acceso(db_session, usuario)
    mios = client.get("/comprobantes?tipo=suscripcion", headers=headers).json()
    assert {m["estado"] for m in mios} == {"rechazado", "aprobado"}
    assert any(m["motivo_rechazo"] == "El monto no coincide" for m in mios)
    # Una empresa no compra la suscripción.
    _, empresa = crear_usuario_con_token(db_session, rol="importador")
    assert client.post("/comprobantes", json={"tipo": "suscripcion", "archivo_id": _subir(client, empresa)},
                       headers=empresa).status_code == 403


def test_comprobante_del_reto_lo_sube_el_equipo_y_el_participante_solo_lo_ve(client, db_session, monkeypatch):
    monkeypatch.setattr(ev, "consultar_oembed", lambda enlace, cliente=None: enlace)
    admin_user, admin = crear_usuario_con_token(db_session, rol="admin")
    fin = (datetime.utcnow() + timedelta(days=14)).replace(microsecond=0).isoformat()
    ronda = client.post("/reto/rondas", json={"nombre": "Ronda", "max_participantes": 5, "umbral_aprobados": 1,
                                              "fecha_limite": fin}, headers=admin).json()
    usuario, headers = crear_usuario_con_token(db_session)
    client.post(f"/reto/rondas/{ronda['id']}/inscribirme", headers=headers)
    item = client.post("/tendencias/enviar", json={"url": "https://youtu.be/dQw4w9WgXcQ"}, headers=headers).json()
    client.patch(f"/tendencias/items/{item['id']}", json={"nombre": "P", "categoria": "Hogar"}, headers=admin)
    client.post(f"/tendencias/items/{item['id']}/aprobar", json={}, headers=admin)
    p = client.get("/reto/mi-participacion", headers=headers).json()["participacion"]
    client.post(f"/reto/participaciones/{p['id']}/reclamar", json={"eleccion": "efectivo"}, headers=headers)
    client.put(f"/reto/participaciones/{p['id']}/cuenta-pago", headers=headers, json={
        "banco": "Bancolombia", "tipo_cuenta": "ahorros", "numero_cuenta": "123456789",
        "titular": "Paula", "documento_titular": "1020304050"})

    comprobante = _subir(client, admin, nombre="transferencia.pdf")
    r = client.patch(f"/reto/participaciones/{p['id']}/pagado", json={"referencia": "TRX-1", "archivo_id": comprobante},
                     headers=admin)
    assert r.status_code == 200, r.text
    assert _ruta_carpeta(db_session, comprobante) == ["Pagos", "Reto pagados"]

    del_reto = client.get("/comprobantes?tipo=reto", headers=headers).json()
    assert len(del_reto) == 1 and del_reto[0]["estado"] == "enviado"
    assert client.get(f"/documentos/archivos/{comprobante}/descargar", headers=headers).status_code == 200
    # El participante no sube comprobantes del reto.
    assert client.post("/comprobantes", json={"tipo": "reto", "archivo_id": _subir(client, headers)},
                       headers=headers).status_code == 422
