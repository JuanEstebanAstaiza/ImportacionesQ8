"""Panel de la empresa (`GET /importadores/panel`), calculado desde la bitácora."""
from datetime import datetime, timedelta
from uuid import uuid4

import pytest

from conftest import auth_headers_for, crear_empresa_importadora, crear_usuario_con_token
from models.evento import Evento
from models.recepcion_cotizacion import RecepcionCotizacion
from services import configuracion, trm
from services.panel_empresa import nivel_espera

TRM = 4000.0


@pytest.fixture(autouse=True)
def trm_fija(db_session):
    trm.reiniciar_cache()
    for clave in (trm.CLAVE_OFICIAL_VALOR, trm.CLAVE_OFICIAL_CONSULTA):
        configuracion.guardar(db_session, clave, None)
    configuracion.guardar(db_session, trm.CLAVE_RESPALDO, str(TRM))
    db_session.commit()
    yield
    trm.reiniciar_cache()


def _empresa(db_session, pais):
    return crear_empresa_importadora(
        db_session,
        nombre_empresa=f"Empresa {uuid4().hex[:6]}",
        email_dueño=f"dueno_{uuid4().hex[:8]}@example.com",
        especialidad_producto=["Textiles"],
        paises_origen=[pais],
    )


def _cotizacion(client, headers, importador_id=None, pais="China", **extra):
    payload = {
        "modalidad": "dirigida" if importador_id else "abierta",
        "pais_importacion": pais,
        "nombre_producto": extra.pop("nombre", "Camisetas"),
        "descripcion_cliente": "Camisetas de algodón con logo bordado en el pecho",
        "linea_producto": "Textiles",
        "tipo_calidad": "estandar",
        "cantidad_minima": 500,
        "incoterm": "FOB",
        **extra,
    }
    if importador_id:
        payload["importador_id"] = str(importador_id)
    r = client.post("/cotizaciones", json=payload, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _propuesta(client, headers, cotizacion_id, precio):
    r = client.post("/propuestas", json={
        "cotizacion_id": cotizacion_id, "precio_ofrecido_usd": precio,
        "tiempo_estimado_entrega": "45 días", "incoterm": "FOB",
    }, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _cerrar(client, headers_solicitante, headers_dueño, propuesta_id, motivo=None):
    cuerpo = {"aceptar": True, **({"motivo_eleccion": motivo} if motivo else {})}
    assert client.post(f"/propuestas/{propuesta_id}/pre-aceptar", json=cuerpo, headers=headers_solicitante).status_code == 200
    assert client.post(f"/propuestas/{propuesta_id}/pre-aceptar", json={"aceptar": True}, headers=headers_dueño).status_code == 200


def test_nivel_de_espera():
    assert nivel_espera(2) == "a_tiempo"
    assert nivel_espera(30) == "atencion"
    assert nivel_espera(72) == "urgente"


def test_panel_completo(client, db_session):
    pais = f"P-{uuid4().hex[:6]}"
    yo, dueño = _empresa(db_session, pais)
    rival, dueño_rival = _empresa(db_session, pais)
    h_yo, h_rival = auth_headers_for(dueño), auth_headers_for(dueño_rival)
    _, h_cliente = crear_usuario_con_token(db_session, rol="solicitante")

    # 4 solicitudes recibidas: 3 dirigidas y 1 abierta (reparto automático en tests).
    ganada = _cotizacion(client, h_cliente, yo.id, pais, nombre="Ganada")
    abierta = _cotizacion(client, h_cliente, None, pais, nombre="Perdida")
    esperando = _cotizacion(client, h_cliente, yo.id, pais, nombre="Esperando")
    sin_responder = _cotizacion(client, h_cliente, yo.id, pais, nombre="Sin responder")

    # Ganada: 1.000 USD → pedido.
    p_ganada = _propuesta(client, h_yo, ganada, 1000)
    _cerrar(client, h_cliente, h_yo, p_ganada)

    # Perdida por precio frente a la empresa rival.
    _propuesta(client, h_yo, abierta, 3000)
    p_rival = _propuesta(client, h_rival, abierta, 2000)
    _cerrar(client, h_cliente, h_rival, p_rival, motivo="precio")

    # Esperando respuesta del comprador: 500 USD.
    _propuesta(client, h_yo, esperando, 500)

    # El pedido ganado avanza a "en producción" (etapa embarque).
    from models.orden import Orden
    orden = db_session.query(Orden).filter(Orden.cotizacion_id == ganada).one()
    assert client.put(f"/ordenes/{orden.id}/estado", json={"estado": "en_produccion"}, headers=h_yo).status_code == 200

    # La solicitud sin responder lleva 30 h esperando.
    recepcion = db_session.query(RecepcionCotizacion).filter(
        RecepcionCotizacion.cotizacion_id == sin_responder, RecepcionCotizacion.importador_id == str(yo.id)
    ).one()
    recepcion.fecha_recepcion = datetime.utcnow() - timedelta(hours=30)
    db_session.commit()

    r = client.get("/importadores/panel", headers=h_yo)
    assert r.status_code == 200, r.text
    panel = r.json()

    assert panel["moneda"] == "COP" and panel["trm"] == TRM
    assert panel["solicitudes_recibidas"] == 4
    assert panel["propuestas_enviadas"] == 3
    assert panel["propuestas_aceptadas"] == 1
    assert panel["propuestas_descartadas"] == 1
    assert panel["propuestas_esperando"] == 1
    assert panel["conversion_pct"] == pytest.approx(33.3)
    assert panel["cierre_uno_de_cada"] == 3.0
    assert panel["tasa_respuesta_pct"] == 75.0
    assert panel["valor_cerrado_cop"] == 4_000_000
    assert panel["valor_promedio_cerrado_cop"] == 4_000_000
    assert panel["valor_esperando_cop"] == 2_000_000
    assert panel["pedidos_por_etapa"] == {"compra": 0, "embarque": 1, "transito": 0, "nacionalizacion": 0, "entrega": 0}
    assert panel["pedidos_entregados"] == 0
    assert panel["motivos_perdida"]["precio"] == 1
    assert sum(panel["motivos_perdida"].values()) == 1
    assert panel["total_pendientes_responder"] == 1
    pendiente = panel["pendientes_responder"][0]
    assert pendiente["cotizacion_id"] == sin_responder
    assert pendiente["nivel"] == "atencion"
    assert 29 <= pendiente["horas_esperando"] <= 31

    # La empresa rival tiene su propio panel: no ve el de la otra.
    rival_panel = client.get("/importadores/panel", headers=h_rival).json()
    assert rival_panel["propuestas_aceptadas"] == 1
    assert rival_panel["motivos_perdida"]["precio"] == 0


def test_monto_editado_cuenta_para_lo_que_espera(client, db_session):
    pais = f"P-{uuid4().hex[:6]}"
    yo, dueño = _empresa(db_session, pais)
    _, h_cliente = crear_usuario_con_token(db_session, rol="solicitante")
    cotizacion = _cotizacion(client, h_cliente, yo.id, pais)
    propuesta = _propuesta(client, auth_headers_for(dueño), cotizacion, 500)
    client.put(f"/propuestas/{propuesta}", json={
        "cotizacion_id": cotizacion, "precio_ofrecido_usd": 800,
        "tiempo_estimado_entrega": "45 días", "incoterm": "FOB",
    }, headers=auth_headers_for(dueño))
    panel = client.get("/importadores/panel", headers=auth_headers_for(dueño)).json()
    assert panel["valor_esperando_cop"] == 3_200_000


def test_historico_sin_trm_se_convierte_con_la_vigente(client, db_session):
    yo, dueño = _empresa(db_session, f"P-{uuid4().hex[:6]}")
    ahora = datetime.utcnow()
    cid, pid = str(uuid4()), str(uuid4())
    db_session.add_all([
        Evento(tipo="solicitud_asignada", fecha=ahora - timedelta(days=5), cotizacion_id=cid, importador_id=str(yo.id)),
        Evento(tipo="propuesta_enviada", fecha=ahora - timedelta(days=4), cotizacion_id=cid, propuesta_id=pid,
               importador_id=str(yo.id), monto_usd=100, datos={"origen": "historico"}),
        Evento(tipo="propuesta_aceptada", fecha=ahora - timedelta(days=3), cotizacion_id=cid, propuesta_id=pid,
               importador_id=str(yo.id), monto_usd=100, datos={"origen": "historico"}),
    ])
    db_session.commit()
    panel = client.get("/importadores/panel", headers=auth_headers_for(dueño)).json()
    assert panel["valor_promedio_cerrado_cop"] == 400_000
    assert panel["tiempo_promedio_respuesta_horas"] == 24.0


def test_periodo(client, db_session):
    yo, dueño = _empresa(db_session, f"P-{uuid4().hex[:6]}")
    viejo = datetime.utcnow() - timedelta(days=200)
    db_session.add(Evento(tipo="solicitud_asignada", fecha=viejo, cotizacion_id=str(uuid4()), importador_id=str(yo.id)))
    db_session.commit()
    h = auth_headers_for(dueño)
    assert client.get("/importadores/panel?dias=90", headers=h).json()["solicitudes_recibidas"] == 0
    assert client.get("/importadores/panel?dias=0", headers=h).json()["solicitudes_recibidas"] == 1


def test_solo_empresas(client, db_session):
    _, h = crear_usuario_con_token(db_session, rol="solicitante")
    assert client.get("/importadores/panel", headers=h).status_code == 403
