"""Tendencias semanales: cálculo de fechas, acceso por suscripción, curaduría."""
import hashlib
from datetime import date, datetime, timedelta

import pytest

import config
from conftest import crear_usuario_con_token
from models.pago import EstadoPago, Pago
from models.tendencias import AccesoTendencias, EdicionTendencias, Temporada
from services import configuracion
from services import tendencias as svc
from services.tendencias_calculo import (
    Cierre, Parametros, calcular_fechas, estado_producto, fecha_en_bodega,
)


def firmar_evento(data: dict, timestamp: int, properties: list, secret: str) -> str:
    valores = "".join(str(data.get(prop)) for prop in properties)
    return hashlib.sha256(f"{valores}{timestamp}{secret}".encode("utf-8")).hexdigest()

CIERRE_2027 = Cierre(inicio=date(2027, 1, 20), fin=date(2027, 2, 28), fin_produccion_previa=date(2027, 1, 15))


# ── Cálculo (casos de la especificación, sección 04) ─────────────────────────

@pytest.mark.parametrize("en_bodega, mar, aereo, aviso_mar", [
    (date(2026, 12, 26), date(2026, 10, 12), date(2026, 11, 21), False),  # Bandas · año nuevo
    (date(2027, 1, 5), date(2026, 10, 22), date(2026, 12, 1), False),     # Lonchera · regreso a clases
    (date(2026, 11, 20), date(2026, 9, 6), date(2026, 10, 16), False),    # Luces · Navidad
    (date(2027, 4, 18), date(2026, 12, 26), date(2027, 3, 14), True),     # Día de la Madre
])
def test_casos_de_la_especificacion(en_bodega, mar, aereo, aviso_mar):
    fechas = calcular_fechas(
        fecha_en_bodega_explicita=en_bodega, fecha_temporada=None,
        parametros=Parametros(), cierres=[CIERRE_2027],
    )
    assert fechas.mar.fecha == mar
    assert fechas.aereo.fecha == aereo
    assert fechas.mar.aviso_cierre_fabricas is aviso_mar
    assert fechas.aereo.aviso_cierre_fabricas is False


def test_sin_fecha_en_bodega_se_toma_la_temporada_menos_21_dias():
    assert fecha_en_bodega(None, date(2027, 5, 9)) == date(2027, 4, 18)
    assert fecha_en_bodega(date(2027, 4, 1), date(2027, 5, 9)) == date(2027, 4, 1)
    assert fecha_en_bodega(None, None) is None


def test_dias_propios_del_producto_reemplazan_los_globales():
    fechas = calcular_fechas(
        fecha_en_bodega_explicita=date(2026, 12, 26), fecha_temporada=None,
        parametros=Parametros(), dias_mar=60,
    )
    assert fechas.mar.fecha == date(2026, 10, 27)
    assert fechas.mar.dias_puerta_a_puerta == 60


@pytest.mark.parametrize("hoy, codigo", [
    (date(2026, 10, 5), "pidelo_ya"),         # 7 días antes del límite por mar
    (date(2026, 10, 12), "pidelo_ya"),        # el mismo día
    (date(2026, 10, 4), "ventana_abierta"),   # 8 días
    (date(2026, 9, 12), "ventana_abierta"),   # 30 días
    (date(2026, 9, 11), "futura"),            # 31 días
    (date(2026, 10, 13), "solo_aereo"),
    (date(2026, 11, 21), "solo_aereo"),
    (date(2026, 11, 22), "fuera_de_tiempo"),
])
def test_estados_del_producto(hoy, codigo):
    fechas = calcular_fechas(
        fecha_en_bodega_explicita=date(2026, 12, 26), fecha_temporada=None, parametros=Parametros(),
    )
    assert estado_producto(fechas, hoy).codigo == codigo


def test_sin_temporada_es_todo_el_anio():
    fechas = calcular_fechas(fecha_en_bodega_explicita=None, fecha_temporada=None, parametros=Parametros())
    assert estado_producto(fechas, date(2026, 10, 5)).codigo == "todo_el_anio"


# ── Helpers ──────────────────────────────────────────────────────────────────

def _admin(db_session):
    return crear_usuario_con_token(db_session, rol="admin")


def _producto(client, headers, **extra):
    datos = {
        "nombre": "Bandas de resistencia",
        "categoria_visible": "Fitness · Año nuevo",
        "linea_producto": "Deportes",
        "fotos": ["/documentos/archivos/11111111-1111-1111-1111-111111111111/descargar"],
        "por_que_ahora": "Los propósitos de año nuevo disparan la demanda en enero.",
        # Lejos en el futuro para que no quede fuera de tiempo al correr los tests.
        "fecha_en_bodega": (date.today() + timedelta(days=200)).isoformat(),
        "que_pedir_en_cotizacion": "Juego de 5 bandas con bolsa y guía impresa.",
        **extra,
    }
    r = client.post("/tendencias/curaduria/productos", json=datos, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _edicion_publicada(client, headers, productos=None):
    productos = productos or [_producto(client, headers)]
    r = client.post("/tendencias/curaduria/ediciones", json={
        "semana_inicio": date.today().isoformat(),
        "titulo_linea1": "Lo que viene",
        "titulo_linea2": "para enero",
        "subtitulo": "Seis productos para pedir a tiempo.",
        "preset_estilo": "violeta",
    }, headers=headers)
    assert r.status_code == 201, r.text
    edicion = r.json()
    r = client.put(f"/tendencias/curaduria/ediciones/{edicion['id']}/productos", json={
        "productos": [{"producto_id": p["id"], "destacado": i == 0} for i, p in enumerate(productos)],
    }, headers=headers)
    assert r.status_code == 200, r.text
    r = client.post(f"/tendencias/curaduria/ediciones/{edicion['id']}/programar", json={}, headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "publicada"
    return r.json()


# ── Acceso ───────────────────────────────────────────────────────────────────

def test_sin_suscripcion_solo_se_ve_la_portada(client, db_session):
    _, admin = _admin(db_session)
    edicion = _edicion_publicada(client, admin)
    _, comprador = crear_usuario_con_token(db_session)

    assert client.get("/tendencias/edicion-actual", headers=comprador).status_code == 403
    portada = client.get("/tendencias/portada", headers=comprador).json()
    assert portada["edicion"]["id"] == edicion["id"]
    assert portada["total_productos"] == 1
    assert "productos" not in portada


def test_cortesia_del_admin_da_acceso_por_los_dias_indicados(client, db_session):
    _, admin = _admin(db_session)
    _edicion_publicada(client, admin)
    usuario, comprador = crear_usuario_con_token(db_session)

    r = client.post("/tendencias/admin/accesos", json={"email": usuario.email, "dias": 15}, headers=admin)
    assert r.status_code == 201, r.text
    assert r.json()["origen"] == "cortesia"

    actual = client.get("/tendencias/edicion-actual", headers=comprador)
    assert actual.status_code == 200
    producto = actual.json()["edicion"]["productos"][0]
    assert producto["destacado"] is True
    assert producto["fechas"]["texto_mar"].startswith("Pídelo antes del")

    acceso = client.get("/tendencias/acceso", headers=comprador).json()
    hasta = datetime.fromisoformat(acceso["vigente_hasta"].rstrip("Z"))
    assert timedelta(days=14) < hasta - datetime.utcnow() <= timedelta(days=15)

    client.post(f"/tendencias/admin/accesos/{r.json()['id']}/revocar", headers=admin)
    assert client.get("/tendencias/edicion-actual", headers=comprador).status_code == 403


def test_renovar_antes_de_vencer_no_pierde_dias(db_session):
    usuario, _ = crear_usuario_con_token(db_session)
    ahora = datetime(2026, 10, 6, 12, 0)
    svc.otorgar_acceso(db_session, usuario_id=usuario.id, dias=30, origen="cortesia", ahora=ahora)
    db_session.commit()
    segundo = svc.otorgar_acceso(db_session, usuario_id=usuario.id, dias=30, origen="pago",
                                 ahora=ahora + timedelta(days=10))
    db_session.commit()
    assert segundo.inicio == ahora + timedelta(days=30)
    assert segundo.fin == ahora + timedelta(days=60)


def test_sin_precio_la_suscripcion_no_se_vende(client, db_session):
    configuracion.guardar(db_session, svc.CLAVE_PRECIO_COP, None)
    db_session.commit()
    _, comprador = crear_usuario_con_token(db_session)
    r = client.post("/tendencias/suscripcion/checkout", headers=comprador)
    assert r.status_code == 409


def test_pago_confirmado_por_webhook_activa_la_suscripcion(client, db_session):
    _, admin = _admin(db_session)
    r = client.put("/tendencias/curaduria/parametros", json={
        "dias_mar": 75, "dias_aereo": 35, "dias_produccion": 20, "precio_cop": 49000, "dias_suscripcion": 30,
    }, headers=admin)
    assert r.status_code == 200, r.text
    usuario, comprador = crear_usuario_con_token(db_session)

    checkout = client.post("/tendencias/suscripcion/checkout", headers=comprador)
    assert checkout.status_code == 201, checkout.text
    assert checkout.json()["monto_cop"] == 49000

    data = {"id": checkout.json()["wompi_payment_id"], "status": "confirmed"}
    firma = firmar_evento(data, 1700000000, ["id", "status"], config.WOMPI_EVENTS_SECRET)
    r = client.post("/pagos/webhook/wompi", json={
        "event": "payment.confirmed", "data": data, "timestamp": 1700000000,
        "signature": {"checksum": firma, "properties": ["id", "status"]},
    })
    assert r.status_code == 200, r.text

    acceso = client.get("/tendencias/acceso", headers=comprador).json()
    assert acceso["tiene_acceso"] is True
    assert acceso["origen"] == "pago"
    # No se acreditan créditos por un pago de suscripción.
    db_session.refresh(usuario)
    assert (usuario.creditos_balance or 0) == 100.0

    # Un reembolso revoca el acceso.
    data_ref = {"id": data["id"], "status": "refunded"}
    firma = firmar_evento(data_ref, 1700000001, ["id", "status"], config.WOMPI_EVENTS_SECRET)
    client.post("/pagos/webhook/wompi", json={
        "event": "payment.refunded", "data": data_ref, "timestamp": 1700000001,
        "signature": {"checksum": firma, "properties": ["id", "status"]},
    })
    assert client.get("/tendencias/acceso", headers=comprador).json()["tiene_acceso"] is False


def test_simular_pago_en_desarrollo(client, db_session):
    configuracion.guardar(db_session, svc.CLAVE_PRECIO_COP, "29000")
    db_session.commit()
    _, comprador = crear_usuario_con_token(db_session)
    pago_id = client.post("/tendencias/suscripcion/checkout", headers=comprador).json()["pago_id"]

    r = client.post(f"/tendencias/suscripcion/simular-pago/{pago_id}", headers=comprador)
    assert r.status_code == 200, r.text
    assert client.post(f"/tendencias/suscripcion/simular-pago/{pago_id}", headers=comprador).status_code == 409
    pago = db_session.query(Pago).filter(Pago.id == pago_id).first()
    assert pago.estado == EstadoPago.confirmado.value


# ── Curaduría ────────────────────────────────────────────────────────────────

def test_solo_curadores_entran_al_panel(client, db_session):
    usuario, headers = crear_usuario_con_token(db_session, rol="soporte")
    assert client.get("/tendencias/curaduria/ediciones", headers=headers).status_code == 403

    _, admin = _admin(db_session)
    r = client.put(f"/tendencias/admin/curadores?email={usuario.email}", json={"es_curador": True}, headers=admin)
    assert r.status_code == 200
    assert client.get("/tendencias/curaduria/ediciones", headers=headers).status_code == 200
    # Un curador ve Tendencias sin suscripción.
    assert client.get("/tendencias/acceso", headers=headers).json()["tiene_acceso"] is True


def test_programar_exige_un_destacado(client, db_session):
    _, admin = _admin(db_session)
    p = _producto(client, admin)
    e = client.post("/tendencias/curaduria/ediciones", json={
        "semana_inicio": date.today().isoformat(), "titulo_linea1": "A", "titulo_linea2": "B", "subtitulo": "C",
    }, headers=admin).json()
    client.put(f"/tendencias/curaduria/ediciones/{e['id']}/productos",
               json={"productos": [{"producto_id": p["id"], "destacado": False}]}, headers=admin)
    r = client.post(f"/tendencias/curaduria/ediciones/{e['id']}/programar", json={}, headers=admin)
    assert r.status_code == 400
    assert "destacado" in r.json()["detail"]


def test_maximo_seis_productos(client, db_session):
    _, admin = _admin(db_session)
    e = client.post("/tendencias/curaduria/ediciones", json={
        "semana_inicio": date.today().isoformat(), "titulo_linea1": "A", "titulo_linea2": "B", "subtitulo": "C",
    }, headers=admin).json()
    productos = [_producto(client, admin, nombre=f"P{i}") for i in range(7)]
    r = client.put(f"/tendencias/curaduria/ediciones/{e['id']}/productos",
                   json={"productos": [{"producto_id": p["id"]} for p in productos]}, headers=admin)
    assert r.status_code == 422


def test_publicar_una_edicion_archiva_la_anterior(client, db_session):
    _, admin = _admin(db_session)
    primera = _edicion_publicada(client, admin)
    segunda = _edicion_publicada(client, admin)

    estados = {e["id"]: e["estado"] for e in client.get("/tendencias/curaduria/ediciones", headers=admin).json()}
    assert estados[primera["id"]] == "archivada"
    assert estados[segunda["id"]] == "publicada"
    assert segunda["numero"] == primera["numero"] + 1


def test_la_publicacion_programada_la_hace_el_job(client, db_session):
    _, admin = _admin(db_session)
    p = _producto(client, admin)
    e = client.post("/tendencias/curaduria/ediciones", json={
        "semana_inicio": date.today().isoformat(), "titulo_linea1": "A", "titulo_linea2": "B", "subtitulo": "C",
    }, headers=admin).json()
    client.put(f"/tendencias/curaduria/ediciones/{e['id']}/productos",
               json={"productos": [{"producto_id": p["id"], "destacado": True}]}, headers=admin)
    futuro = (datetime.utcnow() + timedelta(days=2)).replace(microsecond=0).isoformat()
    r = client.post(f"/tendencias/curaduria/ediciones/{e['id']}/programar", json={"publicar_en": futuro}, headers=admin)
    assert r.json()["estado"] == "programada"

    assert svc.publicar_pendientes(db_session) == []
    assert svc.publicar_pendientes(db_session, ahora=datetime.utcnow() + timedelta(days=3)) == [e["id"]]
    edicion = db_session.query(EdicionTendencias).filter(EdicionTendencias.id == e["id"]).first()
    db_session.refresh(edicion)
    assert edicion.estado == "publicada"


def test_editar_producto_de_edicion_publicada_queda_en_la_bitacora(client, db_session):
    _, admin = _admin(db_session)
    p = _producto(client, admin)
    edicion = _edicion_publicada(client, admin, [p])
    datos = {k: p[k] for k in ("nombre", "categoria_visible", "linea_producto", "fotos", "por_que_ahora")}
    datos["por_que_ahora"] = "Texto corregido."
    r = client.put(f"/tendencias/curaduria/productos/{p['id']}", json=datos, headers=admin)
    assert r.status_code == 200, r.text

    cambios = client.get(f"/tendencias/curaduria/cambios?edicion_id={edicion['id']}&solo_publicadas=true",
                         headers=admin).json()
    assert any(c["accion"] == "producto_editado" and "por_que_ahora" in c["datos"]["campos"] for c in cambios)


def test_producto_fuera_de_tiempo_no_se_muestra_al_comprador(client, db_session):
    _, admin = _admin(db_session)
    vigente = _producto(client, admin, nombre="Vigente")
    vencido = _producto(client, admin, nombre="Vencido",
                        fecha_en_bodega=(date.today() - timedelta(days=5)).isoformat())
    _edicion_publicada(client, admin, [vigente, vencido])
    usuario, comprador = crear_usuario_con_token(db_session)
    svc.otorgar_acceso(db_session, usuario_id=usuario.id, dias=10, origen="cortesia")
    db_session.commit()

    nombres = [p["nombre"] for p in client.get("/tendencias/edicion-actual", headers=comprador).json()["edicion"]["productos"]]
    assert nombres == ["Vigente"]


def test_pide_a_tiempo_lista_cuatro_temporadas(client, db_session):
    for i in range(6):
        db_session.add(Temporada(nombre=f"T{i}", fecha=date.today() + timedelta(days=120 + 30 * i)))
    db_session.commit()
    _, admin = _admin(db_session)
    r = client.get("/tendencias/edicion-actual", headers=admin)
    assert r.status_code == 200
    assert len(r.json()["pide_a_tiempo"]) == 4


# ── Guardados, aviso y solicitudes ───────────────────────────────────────────

def test_guardar_y_pedir_propuestas_desde_tendencias(client, db_session):
    _, admin = _admin(db_session)
    edicion = _edicion_publicada(client, admin)
    producto_id = edicion["productos"][0]["id"]
    usuario, comprador = crear_usuario_con_token(db_session)
    svc.otorgar_acceso(db_session, usuario_id=usuario.id, dias=10, origen="cortesia")
    db_session.commit()

    assert client.put(f"/tendencias/guardados/{producto_id}", json={"edicion_id": edicion["id"]},
                      headers=comprador).status_code == 204
    assert [g["id"] for g in client.get("/tendencias/guardados", headers=comprador).json()] == [producto_id]
    assert client.put("/tendencias/aviso", headers=comprador).status_code == 204
    assert client.post("/tendencias/eventos", json={"tipo": "producto_visto", "edicion_id": edicion["id"],
                                                    "producto_id": producto_id}, headers=comprador).status_code == 204

    r = client.post("/cotizaciones", json={
        "modalidad": "abierta", "pais_importacion": "China", "nombre_producto": "Bandas de resistencia",
        "descripcion_cliente": "Juego de 5 bandas con bolsa y guía impresa.", "linea_producto": "Deportes",
        "tipo_calidad": "estandar", "cantidad_minima": 200,
        "origen": "tendencias", "tendencia_edicion_id": edicion["id"], "tendencia_producto_id": producto_id,
    }, headers=comprador)
    assert r.status_code == 201, r.text
    assert r.json()["origen"] == "tendencias"

    metricas = client.get("/tendencias/curaduria/metricas", headers=admin).json()
    fila = next(m for m in metricas if m["id"] == edicion["id"])
    assert fila["solicitudes"] == 1
    assert fila["productos"][0]["guardados"] == 1
    assert fila["productos"][0]["vistas"] == 1


def test_no_se_puede_atribuir_una_solicitud_a_tendencias_sin_acceso(client, db_session):
    _, admin = _admin(db_session)
    edicion = _edicion_publicada(client, admin)
    _, comprador = crear_usuario_con_token(db_session)
    r = client.post("/cotizaciones", json={
        "modalidad": "abierta", "pais_importacion": "China", "nombre_producto": "Bandas",
        "descripcion_cliente": "Juego de 5 bandas con bolsa y guía impresa.", "linea_producto": "Deportes",
        "tipo_calidad": "estandar", "cantidad_minima": 200,
        "origen": "tendencias", "tendencia_edicion_id": edicion["id"],
        "tendencia_producto_id": edicion["productos"][0]["id"],
    }, headers=comprador)
    assert r.status_code == 403


def test_aviso_se_envia_solo_a_suscritos_con_acceso(client, db_session, monkeypatch):
    enviados = []
    import services.notificacion_service as ns
    monkeypatch.setattr(ns, "notificar", lambda db, **kw: enviados.append(kw["usuario_id"]))

    _, admin = _admin(db_session)
    con_acceso, h1 = crear_usuario_con_token(db_session)
    sin_acceso, h2 = crear_usuario_con_token(db_session)
    svc.otorgar_acceso(db_session, usuario_id=con_acceso.id, dias=10, origen="cortesia")
    db_session.commit()
    client.put("/tendencias/aviso", headers=h1)
    # Quien no tiene acceso no puede ni suscribirse al aviso.
    assert client.put("/tendencias/aviso", headers=h2).status_code == 403
    # Si su acceso vence después de suscribirse, deja de recibirlo.
    db_session.query(AccesoTendencias).filter(AccesoTendencias.usuario_id == con_acceso.id).update(
        {AccesoTendencias.fin: datetime.utcnow() + timedelta(days=10)})
    db_session.commit()

    _edicion_publicada(client, admin)
    assert enviados == [con_acceso.id]
    assert sin_acceso.id not in enviados


# ── Videos ───────────────────────────────────────────────────────────────────

def _video(db_session, owner_id):
    from pathlib import Path
    from uuid import uuid4
    from models.documental import Archivo

    archivo_id = str(uuid4())
    ruta = Path("uploads/documentos") / f"{archivo_id}_clip.mp4"
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_bytes(b"\x00\x00\x00\x18ftypmp42")
    db_session.add(Archivo(
        id=archivo_id, owner_user_id=owner_id, nombre="clip.mp4", extension="mp4", mime_type="video/mp4",
        tipo_recurso="video", size_bytes=12, storage_path=str(ruta),
        storage_url=f"/documentos/archivos/{archivo_id}/descargar", origen="tendencias",
    ))
    db_session.commit()
    return f"/documentos/archivos/{archivo_id}/descargar"


def test_producto_con_video_horizontal_y_vertical(client, db_session):
    curador, admin = _admin(db_session)
    horizontal = _video(db_session, curador.id)
    vertical = _video(db_session, curador.id)
    p = _producto(client, admin, video_horizontal=horizontal, video_vertical=vertical)
    assert (p["video_horizontal"], p["video_vertical"]) == (horizontal, vertical)
    _edicion_publicada(client, admin, [p])

    con_acceso, h_con = crear_usuario_con_token(db_session)
    _, h_sin = crear_usuario_con_token(db_session)
    svc.otorgar_acceso(db_session, usuario_id=con_acceso.id, dias=5, origen="cortesia")
    db_session.commit()

    producto = client.get("/tendencias/edicion-actual", headers=h_con).json()["edicion"]["productos"][0]
    assert producto["video_vertical"] == vertical
    assert client.get(vertical, headers=h_con).status_code == 200
    assert client.get(horizontal, headers=h_sin).status_code == 403


def test_quitar_un_video_lo_deja_vacio(client, db_session):
    curador, admin = _admin(db_session)
    p = _producto(client, admin, video_vertical=_video(db_session, curador.id))
    datos = {k: p[k] for k in ("nombre", "categoria_visible", "linea_producto", "fotos", "por_que_ahora")}
    r = client.put(f"/tendencias/curaduria/productos/{p['id']}", json={**datos, "video_vertical": "  "}, headers=admin)
    assert r.status_code == 200, r.text
    assert r.json()["video_vertical"] is None
