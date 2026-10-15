"""Propuesta rápida (services/formulario_propuesta.py), que reemplaza la
calculadora del chat: dos precios, entrega, tiempo y permisos, con las
condiciones de la empresa llenadas una vez.

Sin migración: el formulario y sus totales van como JSON en
`condiciones_adicionales`, las condiciones en `configuracion_plataforma` y la
ciudad de entrega en el JSON de campos de la cotización.
"""
import json
from datetime import datetime
from uuid import uuid4

import pytest

from conftest import auth_headers_for, crear_empresa_importadora
from models.chat import ConversacionChat, MensajeChat, TipoMensajeChat
from models.configuracion import ConfiguracionPlataforma
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.orden import Orden
from models.usuario import Usuario
from services.formulario_propuesta import FormularioPropuesta, calcular
from utils.security import hash_password

# El ejemplo del diseño: 600 perfumes a USD 4,80, logística USD 1.700, TRM 3.920.
FORMULARIO = {
    "precio_unitario_usd": 4.8, "cantidad": 600, "logistica_valor": 1700, "logistica_moneda": "USD",
    "trm": 3920, "iva_pct": 19,
    "bodega_ciudad": "Cali", "bodega_direccion": "Calle 10 # 5-20", "ciudad_destino": "Medellín",
    "entrega_modo": "cliente", "flete_aprox_cop": 220000,
    "via": "maritimo", "dias_min": 40, "dias_max": 50,
    "requiere_permisos": True, "permiso_cual": "Notificación sanitaria INVIMA", "permiso_gestiona": "importadora",
}


def _usuario(db, **campos):
    u = Usuario(id=str(uuid4()), password_hash=hash_password("123456789"), activo=True, perfil_completo=True,
                fecha_creacion=datetime.utcnow(), **campos)
    db.add(u)
    db.commit()
    return u


@pytest.fixture()
def escenario(db_session):
    importador, dueño = crear_empresa_importadora(db_session, nombre_empresa="Primos SAS",
                                                  email_dueño="dueno_primos@example.com")
    asesor = _usuario(db_session, email="asesor_primos@example.com", rol="asesor", importador_id=importador.id)
    cliente = _usuario(db_session, email="cliente_primos@example.com", rol="solicitante", nombre="Juan Esteban",
                       creditos_balance=1000.0)
    cotizacion = Cotizacion(
        id=str(uuid4()), solicitante_id=cliente.id, importador_id=importador.id, modalidad="dirigida",
        pais_importacion="China", nombre_producto="Perfume veneno FA",
        descripcion_cliente="Perfume en caja individual, presentación de 100 ml",
        linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=600, incoterm="DDP",
        estado=EstadoCotizacion.dirigida, campos_personalizados_valores={"_ciudad_entrega": "Medellín"},
    )
    db_session.add(cotizacion)
    db_session.commit()
    yield importador, dueño, asesor, cliente, cotizacion
    db_session.query(ConfiguracionPlataforma).filter(
        ConfiguracionPlataforma.clave.like("empresa.%.condiciones_propuesta")).delete(synchronize_session=False)
    db_session.commit()


def _tarjetas(db, cotizacion):
    return (
        db.query(MensajeChat)
        .join(ConversacionChat, ConversacionChat.id == MensajeChat.conversacion_id)
        .filter(ConversacionChat.cotizacion_id == cotizacion.id, MensajeChat.tipo == TipoMensajeChat.propuesta.value)
        .order_by(MensajeChat.fecha_envio)
        .all()
    )


def test_el_calculo_da_lo_mismo_que_el_diseño():
    t = calcular(FormularioPropuesta(**FORMULARIO))
    assert t["producto_cop"] == 11_289_600 and t["logistica_cop"] == 6_664_000
    assert t["subtotal_cop"] == 17_953_600 and t["iva_cop"] == 3_411_184
    assert t["total_cop"] == 21_364_784 and t["unitario_cop"] == 35_608 and t["unitario_usd"] == 9.08
    # Entrega con valor fijo: se suma al subtotal. Logística en pesos: no se convierte.
    fijo = calcular(FormularioPropuesta(**{**FORMULARIO, "entrega_modo": "fijo", "entrega_valor_cop": 100_000,
                                           "logistica_moneda": "COP", "logistica_valor": 1_000_000, "iva_pct": 0}))
    assert fijo["total_cop"] == 11_289_600 + 1_000_000 + 100_000


@pytest.mark.parametrize("cambio", [
    {"entrega_modo": "fijo"},                       # sin el valor de la entrega
    {"dias_min": 50, "dias_max": 40},              # rango al revés
    {"requiere_permisos": True, "permiso_cual": ""},  # permiso sin decir cuál
    {"iva_pct": 16},                               # solo 19, 5 o 0
])
def test_lo_incompleto_no_se_envia(client, escenario, cambio):
    _, dueño, _, _, cotizacion = escenario
    r = client.post("/propuestas", headers=auth_headers_for(dueño),
                    json={"cotizacion_id": cotizacion.id, "formulario": {**FORMULARIO, **cambio}})
    assert r.status_code == 422, r.text


def test_condiciones_de_la_empresa(client, db_session, escenario):
    importador, dueño, asesor, cliente, _ = escenario
    r = client.get("/condiciones-propuesta", headers=auth_headers_for(asesor))
    assert r.status_code == 200 and r.json()["configuradas"] is False and r.json()["vigencia_dias"] == 15

    nuevas = {**r.json(), "bodega_ciudad": "Cali", "ciudades_entrega_incluida": ["Cali", "Yumbo", "cali"],
              "vigencia_dias": 20, "forma_pago": "30-70"}
    nuevas.pop("configuradas")
    assert client.put("/condiciones-propuesta", json=nuevas, headers=auth_headers_for(asesor)).status_code == 403
    assert client.put("/condiciones-propuesta", json=nuevas, headers=auth_headers_for(cliente)).status_code == 403
    r = client.put("/condiciones-propuesta", json=nuevas, headers=auth_headers_for(dueño))
    assert r.status_code == 200, r.text
    assert r.json()["configuradas"] is True and r.json()["ciudades_entrega_incluida"] == ["Cali", "Yumbo"]

    # Otra empresa no las ve: cada una tiene las suyas.
    _, otro = crear_empresa_importadora(db_session, nombre_empresa="Otra", email_dueño="dueno_otra@example.com")
    assert client.get("/condiciones-propuesta", headers=auth_headers_for(otro)).json()["configuradas"] is False


def test_la_dueña_envia_y_el_cliente_la_recibe_en_el_chat(client, db_session, escenario):
    importador, dueño, _, cliente, cotizacion = escenario
    r = client.post("/propuestas", headers=auth_headers_for(dueño),
                    json={"cotizacion_id": cotizacion.id, "formulario": FORMULARIO,
                          # Lo que mande el navegador como precio no cuenta.
                          "precio_ofrecido_usd": 1, "incoterm": "EXW", "tiempo_estimado_entrega": "x"})
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["incoterm"] == "DDP" and p["precio_ofrecido_usd"] == round(21_364_784 / 3920, 2)
    assert p["tiempo_estimado_entrega"] == "De 40 a 50 días desde el anticipo, marítimo"
    datos = json.loads(p["condiciones_adicionales"])
    assert datos["schema"] == "propuesta-v2" and datos["totales"]["total_cop"] == 21_364_784
    assert datos["condiciones"]["forma_pago"] == "50-50" and datos["vigencia_hasta"]

    tarjetas = _tarjetas(db_session, cotizacion)
    assert len(tarjetas) == 1
    assert tarjetas[0].metadata_json["version"] == 1
    assert tarjetas[0].metadata_json["propuesta"]["totales"]["total_cop"] == 21_364_784
    assert "$21.364.784 con IVA" in tarjetas[0].contenido

    # El cliente la ve en su chat.
    conv = db_session.query(ConversacionChat).filter(ConversacionChat.id == tarjetas[0].conversacion_id).first()
    assert conv.solicitante_id == cliente.id
    mensajes = client.get(f"/chat/conversaciones/{conv.id}/mensajes", headers=auth_headers_for(cliente)).json()
    assert [m["tipo"] for m in mensajes] == ["propuesta"]

    # Editarla le manda la versión 2.
    r = client.put(f"/propuestas/{p['id']}", headers=auth_headers_for(dueño),
                   json={"cotizacion_id": cotizacion.id, "formulario": {**FORMULARIO, "precio_unitario_usd": 4.5}})
    assert r.status_code == 200, r.text
    assert [t.metadata_json["version"] for t in _tarjetas(db_session, cotizacion)] == [1, 2]


def test_el_asesor_deja_borrador_y_la_dueña_lo_envia(client, db_session, escenario):
    _, dueño, asesor, _, cotizacion = escenario
    cotizacion.asesor_asignado_id = asesor.id
    db_session.commit()
    r = client.post("/propuestas/borrador", headers=auth_headers_for(asesor),
                    json={"cotizacion_id": cotizacion.id, "formulario": FORMULARIO})
    assert r.status_code == 201, r.text
    assert _tarjetas(db_session, cotizacion) == []  # el borrador no le llega al cliente
    assert client.post(f"/propuestas/{r.json()['id']}/enviar", headers=auth_headers_for(dueño)).status_code == 200
    assert len(_tarjetas(db_session, cotizacion)) == 1


def test_al_cerrar_la_orden_se_cobra_en_pesos(client, db_session, escenario):
    _, dueño, _, cliente, cotizacion = escenario
    p = client.post("/propuestas", headers=auth_headers_for(dueño),
                    json={"cotizacion_id": cotizacion.id, "formulario": FORMULARIO}).json()
    client.post(f"/propuestas/{p['id']}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(cliente))
    r = client.post(f"/propuestas/{p['id']}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(dueño))
    assert r.status_code == 200 and r.json()["estado"] == "aceptada", r.text

    orden = db_session.query(Orden).filter(Orden.cotizacion_id == cotizacion.id).first()
    assert json.loads(orden.condiciones_adicionales)["totales"]["total_cop"] == 21_364_784
    pago = next(m for m in db_session.query(MensajeChat).all()
                if (m.metadata_json or {}).get("tipo_evento") == "solicitud_pago_orden"
                and (m.metadata_json or {}).get("orden_id") == orden.id)
    assert "$21.364.784 (COP, IVA incluido)" in pago.contenido


def test_la_ciudad_de_entrega_viaja_con_la_cotizacion(client, db_session, escenario):
    _, _, _, cliente, cotizacion = escenario
    r = client.get(f"/cotizaciones/{cotizacion.id}", headers=auth_headers_for(cliente))
    assert r.status_code == 200, r.text
    assert r.json()["ciudad_entrega"] == "Medellín"
    # La clave reservada no se cuela entre las respuestas del formulario de la empresa.
    assert "_ciudad_entrega" not in (r.json()["campos_personalizados_valores"] or {})


def test_ya_no_existe_la_calculadora(client, escenario):
    _, dueño, _, _, _ = escenario
    assert client.post("/chat/calculadora/calcular", json={"cantidad": 1, "precio_unitario": 1},
                       headers=auth_headers_for(dueño)).status_code in (404, 405)
