"""Bitácora de eventos del negocio (tabla `eventos`).

Cada cambio de estado deja una fila con fecha y hora, el monto en su moneda, en
USD y en pesos (con la TRM del momento) y la cantidad con su unidad:
solicitud creada, asignada, vista; propuesta enviada, editada, aceptada o
descartada (con motivo); y cada hito del pedido.
"""
from unittest.mock import patch
from uuid import uuid4

import pytest

from conftest import auth_headers_for, crear_empresa_importadora, crear_usuario_con_token
from models.evento import Evento
from services import configuracion, trm
from services.eventos import ETAPA_POR_ESTADO_ORDEN, convertir_montos

TRM_PRUEBA = 4000.0


@pytest.fixture(autouse=True)
def trm_fija(db_session):
    """TRM conocida para poder comprobar los montos en pesos."""
    trm.reiniciar_cache()
    for clave in (trm.CLAVE_OFICIAL_VALOR, trm.CLAVE_OFICIAL_CONSULTA, trm.CLAVE_OFICIAL_VIGENCIA):
        configuracion.guardar(db_session, clave, None)
    configuracion.guardar(db_session, trm.CLAVE_RESPALDO, str(TRM_PRUEBA))
    db_session.commit()
    yield
    trm.reiniciar_cache()


def _empresa(db_session, pais):
    importador, dueño = crear_empresa_importadora(
        db_session,
        nombre_empresa=f"Empresa {uuid4().hex[:6]}",
        email_dueño=f"dueno_{uuid4().hex[:8]}@example.com",
        especialidad_producto=["Textiles"],
        paises_origen=[pais],
    )
    return importador, dueño


def _payload(importador_id=None, pais="China", **extra):
    payload = {
        "modalidad": "dirigida" if importador_id else "abierta",
        "pais_importacion": pais,
        "nombre_producto": "Camisetas",
        "descripcion_cliente": "Camisetas de algodón con logo bordado en el pecho",
        "linea_producto": "Textiles",
        "tipo_calidad": "estandar",
        "cantidad_minima": 500,
        "precio_objetivo_usd": 1000,
        "incoterm": "FOB",
    }
    if importador_id:
        payload["importador_id"] = importador_id
    payload.update(extra)
    return payload


def _eventos(db_session, cotizacion_id, tipo=None):
    db_session.expire_all()
    consulta = db_session.query(Evento).filter(Evento.cotizacion_id == cotizacion_id)
    if tipo:
        consulta = consulta.filter(Evento.tipo == tipo)
    return consulta.order_by(Evento.fecha).all()


def _propuesta(client, headers, cotizacion_id, precio=2500.0, **extra):
    r = client.post("/propuestas", json={
        "cotizacion_id": cotizacion_id,
        "precio_ofrecido_usd": precio,
        "tiempo_estimado_entrega": "45 días",
        "incoterm": "FOB",
        **extra,
    }, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


class TestConversion:
    def test_usd_y_cop(self):
        assert convertir_montos(10, "USD", 4000) == {"monto_usd": 10.0, "monto_cop": 40000.0}
        assert convertir_montos(40000, "cop", 4000) == {"monto_usd": 10.0, "monto_cop": 40000.0}

    def test_otra_moneda_no_inventa_tasa(self):
        assert convertir_montos(10, "EUR", 4000) == {"monto_usd": None, "monto_cop": None}

    def test_sin_monto(self):
        assert convertir_montos(None, "USD", 4000) == {"monto_usd": None, "monto_cop": None}


class TestSolicitud:
    def test_dirigida_registra_creada_y_asignada_con_montos_en_pesos(self, client, db_session):
        importador, _ = _empresa(db_session, "China")
        _, headers = crear_usuario_con_token(db_session, rol="solicitante")

        r = client.post("/cotizaciones", json=_payload(importador.id), headers=headers)
        assert r.status_code == 201, r.text
        cotizacion_id = r.json()["id"]

        creada, = _eventos(db_session, cotizacion_id, "solicitud_creada")
        assert creada.rol_usuario == "solicitante"
        assert creada.monto_usd == 1000
        assert creada.trm == TRM_PRUEBA
        assert creada.monto_cop == 4_000_000
        assert creada.cantidad == 500 and creada.unidad == "unidades"
        assert creada.datos["trm_fuente"] == "respaldo_admin"

        asignada, = _eventos(db_session, cotizacion_id, "solicitud_asignada")
        assert asignada.importador_id == str(importador.id)
        assert asignada.datos["origen_asignacion"] == "dirigida"
        assert asignada.fecha >= creada.fecha

    def test_precio_objetivo_en_pesos_no_se_reconvierte(self, client, db_session):
        importador, _ = _empresa(db_session, "China")
        _, headers = crear_usuario_con_token(db_session, rol="solicitante")
        r = client.post(
            "/cotizaciones",
            json=_payload(importador.id, precio_objetivo_usd=8_000_000, precio_objetivo_moneda="COP"),
            headers=headers,
        )
        assert r.status_code == 201, r.text
        creada, = _eventos(db_session, r.json()["id"], "solicitud_creada")
        assert creada.moneda == "COP"
        assert creada.monto_cop == 8_000_000
        assert creada.monto_usd == 2000

    def test_cantidad_en_metros_cubicos_admite_decimales(self, client, db_session):
        importador, _ = _empresa(db_session, "China")
        _, headers = crear_usuario_con_token(db_session, rol="solicitante")
        r = client.post(
            "/cotizaciones",
            json=_payload(importador.id, cantidad_minima=2.5, unidad_cantidad="m3"),
            headers=headers,
        )
        assert r.status_code == 201, r.text
        assert r.json()["unidad_cantidad"] == "m3"
        assert r.json()["cantidad_minima"] == 2.5
        creada, = _eventos(db_session, r.json()["id"], "solicitud_creada")
        assert creada.cantidad == 2.5 and creada.unidad == "m3"

    def test_unidades_deben_ser_enteras(self, client, db_session):
        importador, _ = _empresa(db_session, "China")
        _, headers = crear_usuario_con_token(db_session, rol="solicitante")
        r = client.post("/cotizaciones", json=_payload(importador.id, cantidad_minima=2.5), headers=headers)
        assert r.status_code == 422

    def test_abierta_registra_una_asignacion_por_empresa(self, client, db_session):
        pais = f"Pais-{uuid4().hex[:6]}"
        a, _ = _empresa(db_session, pais)
        b, _ = _empresa(db_session, pais)
        _, headers = crear_usuario_con_token(db_session, rol="solicitante")
        r = client.post("/cotizaciones", json=_payload(pais=pais), headers=headers)
        assert r.status_code == 201, r.text
        asignadas = _eventos(db_session, r.json()["id"], "solicitud_asignada")
        assert {e.importador_id for e in asignadas} == {str(a.id), str(b.id)}
        assert all(e.datos["origen_asignacion"] == "automatica" for e in asignadas)

    def test_vista_se_registra_una_sola_vez_por_empresa(self, client, db_session):
        importador, dueño = _empresa(db_session, "China")
        _, headers = crear_usuario_con_token(db_session, rol="solicitante")
        cotizacion_id = client.post("/cotizaciones", json=_payload(importador.id), headers=headers).json()["id"]

        for _ in range(2):
            assert client.get(f"/cotizaciones/{cotizacion_id}", headers=auth_headers_for(dueño)).status_code == 200
        # El propio solicitante no cuenta como "vista".
        client.get(f"/cotizaciones/{cotizacion_id}", headers=headers)

        vistas = _eventos(db_session, cotizacion_id, "solicitud_vista")
        assert len(vistas) == 1
        assert vistas[0].importador_id == str(importador.id)
        assert vistas[0].usuario_id == str(dueño.id)


class TestPropuestas:
    def test_enviada_y_editada_guardan_monto_y_cantidad(self, client, db_session):
        importador, dueño = _empresa(db_session, "China")
        _, headers = crear_usuario_con_token(db_session, rol="solicitante")
        cotizacion_id = client.post("/cotizaciones", json=_payload(importador.id), headers=headers).json()["id"]

        propuesta = _propuesta(client, auth_headers_for(dueño), cotizacion_id, precio=2500, cantidad=600)
        assert propuesta["cantidad"] == 600

        enviada, = _eventos(db_session, cotizacion_id, "propuesta_enviada")
        assert enviada.propuesta_id == propuesta["id"]
        assert enviada.importador_id == str(importador.id)
        assert enviada.monto_usd == 2500 and enviada.monto_cop == 10_000_000
        assert enviada.cantidad == 600 and enviada.unidad == "unidades"
        assert enviada.datos["tiempo_estimado_entrega"] == "45 días"

        r = client.put(f"/propuestas/{propuesta['id']}", json={
            "cotizacion_id": cotizacion_id, "precio_ofrecido_usd": 2300,
            "tiempo_estimado_entrega": "40 días", "incoterm": "FOB",
        }, headers=auth_headers_for(dueño))
        assert r.status_code == 200, r.text
        editada, = _eventos(db_session, cotizacion_id, "propuesta_editada")
        assert editada.monto_usd == 2300 and editada.monto_cop == 9_200_000
        assert editada.cantidad == 600  # la cantidad no enviada se conserva

    def test_sin_cantidad_usa_la_pedida(self, client, db_session):
        importador, dueño = _empresa(db_session, "China")
        _, headers = crear_usuario_con_token(db_session, rol="solicitante")
        cotizacion_id = client.post("/cotizaciones", json=_payload(importador.id), headers=headers).json()["id"]
        _propuesta(client, auth_headers_for(dueño), cotizacion_id)
        enviada, = _eventos(db_session, cotizacion_id, "propuesta_enviada")
        assert enviada.cantidad == 500

    def test_borrador_no_cuenta_hasta_que_se_envia(self, client, db_session):
        importador, dueño = _empresa(db_session, "China")
        _, headers = crear_usuario_con_token(db_session, rol="solicitante")
        cotizacion_id = client.post("/cotizaciones", json=_payload(importador.id), headers=headers).json()["id"]
        r = client.post("/propuestas/borrador", json={
            "cotizacion_id": cotizacion_id, "precio_ofrecido_usd": 900,
            "tiempo_estimado_entrega": "30 días", "incoterm": "FOB",
        }, headers=auth_headers_for(dueño))
        assert r.status_code == 201, r.text
        assert _eventos(db_session, cotizacion_id, "propuesta_enviada") == []

        r = client.post(f"/propuestas/{r.json()['id']}/enviar", headers=auth_headers_for(dueño))
        assert r.status_code == 200, r.text
        enviada, = _eventos(db_session, cotizacion_id, "propuesta_enviada")
        assert enviada.estado_anterior == "borrador" and enviada.estado_nuevo == "pendiente"


class TestCierreYPedido:
    def _abierta_con_dos_propuestas(self, client, db_session):
        pais = f"Pais-{uuid4().hex[:6]}"
        a, dueño_a = _empresa(db_session, pais)
        b, dueño_b = _empresa(db_session, pais)
        solicitante, headers = crear_usuario_con_token(db_session, rol="solicitante")
        cotizacion_id = client.post("/cotizaciones", json=_payload(pais=pais), headers=headers).json()["id"]
        ganadora = _propuesta(client, auth_headers_for(dueño_a), cotizacion_id, precio=2000)
        perdedora = _propuesta(client, auth_headers_for(dueño_b), cotizacion_id, precio=2600)
        return cotizacion_id, headers, (a, dueño_a, ganadora), (b, dueño_b, perdedora)

    def test_aceptar_registra_aceptada_descartada_con_motivo_y_pedido(self, client, db_session):
        cotizacion_id, headers, (a, dueño_a, ganadora), (b, _, perdedora) = self._abierta_con_dos_propuestas(client, db_session)

        r = client.post(
            f"/propuestas/{ganadora['id']}/pre-aceptar",
            json={"aceptar": True, "motivo_eleccion": "precio", "motivo_detalle": "Más barata"},
            headers=headers,
        )
        assert r.status_code == 200, r.text
        r = client.post(f"/propuestas/{ganadora['id']}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(dueño_a))
        assert r.status_code == 200, r.text
        assert r.json()["estado"] == "aceptada"

        aceptada, = _eventos(db_session, cotizacion_id, "propuesta_aceptada")
        assert aceptada.propuesta_id == ganadora["id"]
        assert aceptada.monto_cop == 8_000_000
        assert aceptada.orden_id

        descartada, = _eventos(db_session, cotizacion_id, "propuesta_descartada")
        assert descartada.propuesta_id == perdedora["id"]
        assert descartada.importador_id == str(b.id)
        assert descartada.motivo == "precio"
        assert descartada.motivo_detalle == "Más barata"
        assert descartada.monto_usd == 2600

        # La empresa perdedora ve el motivo en su propuesta.
        r = client.get(f"/cotizaciones/{cotizacion_id}/propuestas", headers=auth_headers_for(_dueño(db_session, b)))
        assert r.json()[0]["motivo_descarte"] == "precio"

        hito, = _eventos(db_session, cotizacion_id, "pedido_hito")
        assert hito.estado_nuevo == "cotizacion_aceptada"
        assert hito.datos["etapa"] == "compra"
        assert hito.orden_id == aceptada.orden_id

        r = client.put(f"/ordenes/{hito.orden_id}/estado", json={"estado": "en_produccion"}, headers=auth_headers_for(dueño_a))
        assert r.status_code == 200, r.text
        hitos = _eventos(db_session, cotizacion_id, "pedido_hito")
        assert [h.estado_nuevo for h in hitos] == ["cotizacion_aceptada", "en_produccion"]
        assert hitos[1].estado_anterior == "cotizacion_aceptada"
        assert hitos[1].datos["etapa"] == "embarque"
        assert hitos[1].monto_cop == 8_000_000

    def test_sin_motivo_queda_como_sin_motivo(self, client, db_session):
        cotizacion_id, headers, (_, dueño_a, ganadora), _ = self._abierta_con_dos_propuestas(client, db_session)
        client.post(f"/propuestas/{ganadora['id']}/pre-aceptar", json={"aceptar": True}, headers=headers)
        client.post(f"/propuestas/{ganadora['id']}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(dueño_a))
        descartada, = _eventos(db_session, cotizacion_id, "propuesta_descartada")
        assert descartada.motivo == "sin_motivo"

    def test_retirar_la_aceptacion_borra_el_motivo(self, client, db_session):
        cotizacion_id, headers, (_, dueño_a, ganadora), _ = self._abierta_con_dos_propuestas(client, db_session)
        client.post(f"/propuestas/{ganadora['id']}/pre-aceptar", json={"aceptar": True, "motivo_eleccion": "tiempo"}, headers=headers)
        client.post(f"/propuestas/{ganadora['id']}/pre-aceptar", json={"aceptar": False}, headers=headers)
        client.post(f"/propuestas/{ganadora['id']}/pre-aceptar", json={"aceptar": True}, headers=headers)
        client.post(f"/propuestas/{ganadora['id']}/pre-aceptar", json={"aceptar": True}, headers=auth_headers_for(dueño_a))
        descartada, = _eventos(db_session, cotizacion_id, "propuesta_descartada")
        assert descartada.motivo == "sin_motivo"

    def test_la_empresa_no_puede_dar_el_motivo(self, client, db_session):
        _, _, (_, dueño_a, ganadora), _ = self._abierta_con_dos_propuestas(client, db_session)
        r = client.post(
            f"/propuestas/{ganadora['id']}/pre-aceptar",
            json={"aceptar": True, "motivo_eleccion": "precio"},
            headers=auth_headers_for(dueño_a),
        )
        assert r.status_code == 400

    def test_motivo_invalido(self, client, db_session):
        _, headers, (_, _, ganadora), _ = self._abierta_con_dos_propuestas(client, db_session)
        r = client.post(f"/propuestas/{ganadora['id']}/pre-aceptar", json={"aceptar": True, "motivo_eleccion": "color"}, headers=headers)
        assert r.status_code == 422


def _dueño(db_session, importador):
    from models.usuario import Usuario

    return db_session.query(Usuario).filter(Usuario.importador_id == importador.id, Usuario.rol == "importador").first()


class TestEtapas:
    def test_cada_estado_de_la_orden_tiene_etapa(self):
        from models.orden import EstadoOrden

        assert set(ETAPA_POR_ESTADO_ORDEN) == {e.value for e in EstadoOrden}


class TestTrm:
    def test_usa_la_oficial_y_la_guarda(self, db_session, monkeypatch):
        configuracion.guardar(db_session, trm.CLAVE_RESPALDO, None)
        db_session.commit()
        monkeypatch.setattr(trm.config, "TRM_CONSULTA_AUTOMATICA", True)
        with patch.object(trm, "consultar_trm_oficial", return_value={"valor": 3912.45, "vigencia": "2026-10-03"}) as consulta:
            primera = trm.obtener_trm(db_session)
            segunda = trm.obtener_trm(db_session)
        assert primera["valor"] == 3912.45 and primera["fuente"] == "oficial"
        assert segunda == primera
        assert consulta.call_count == 1  # una consulta al día por proceso
        db_session.commit()
        assert configuracion.obtener(db_session, trm.CLAVE_OFICIAL_VALOR) == "3912.45"

    def test_si_falla_usa_el_respaldo_del_admin(self, db_session, monkeypatch):
        monkeypatch.setattr(trm.config, "TRM_CONSULTA_AUTOMATICA", True)
        with patch.object(trm, "consultar_trm_oficial", return_value=None) as consulta:
            resultado = trm.obtener_trm(db_session)
            trm.obtener_trm(db_session)
        assert resultado == {"valor": TRM_PRUEBA, "fuente": "respaldo_admin", "vigencia": None, "fecha_consulta": None}
        assert consulta.call_count == 1  # tras un fallo espera antes de reintentar

    def test_sin_respaldo_usa_la_ultima_oficial(self, db_session, monkeypatch):
        configuracion.guardar(db_session, trm.CLAVE_RESPALDO, None)
        configuracion.guardar(db_session, trm.CLAVE_OFICIAL_VALOR, "3850")
        configuracion.guardar(db_session, trm.CLAVE_OFICIAL_CONSULTA, "2026-01-01")
        db_session.commit()
        monkeypatch.setattr(trm.config, "TRM_CONSULTA_AUTOMATICA", False)
        resultado = trm.obtener_trm(db_session)
        assert resultado["valor"] == 3850 and resultado["fuente"] == "ultima_oficial"

    def test_sin_nada_usa_el_valor_por_defecto(self, db_session, monkeypatch):
        configuracion.guardar(db_session, trm.CLAVE_RESPALDO, None)
        db_session.commit()
        monkeypatch.setattr(trm.config, "TRM_CONSULTA_AUTOMATICA", False)
        resultado = trm.obtener_trm(db_session)
        assert resultado["fuente"] == "por_defecto"
        assert resultado["valor"] == trm.config.TRM_RESPALDO_COP

    @pytest.mark.parametrize("respuesta", [[], [{"valor": "abc"}], [{"valor": "12"}], {"error": True}])
    def test_descarta_respuestas_invalidas(self, respuesta):
        class Respuesta:
            def raise_for_status(self):
                pass

            def json(self):
                return respuesta

        with patch("httpx.get", return_value=Respuesta()):
            assert trm.consultar_trm_oficial() is None

    def test_lee_el_formato_de_datos_gov_co(self):
        class Respuesta:
            def raise_for_status(self):
                pass

            def json(self):
                return [{"valor": "3901.27", "unidad": "COP", "vigenciadesde": "2026-10-03T00:00:00.000",
                         "vigenciahasta": "2026-10-05T00:00:00.000"}]

        with patch("httpx.get", return_value=Respuesta()):
            assert trm.consultar_trm_oficial() == {"valor": 3901.27, "vigencia": "2026-10-03"}

    def test_error_de_red(self):
        with patch("httpx.get", side_effect=OSError("sin red")):
            assert trm.consultar_trm_oficial() is None


class TestVistaExplicita:
    def test_post_vista_y_reclamar(self, client, db_session):
        importador, dueño = _empresa(db_session, "China")
        _, headers = crear_usuario_con_token(db_session, rol="solicitante")
        cotizacion_id = client.post("/cotizaciones", json=_payload(importador.id), headers=headers).json()["id"]

        assert client.post(f"/cotizaciones/{cotizacion_id}/vista", headers=auth_headers_for(dueño)).status_code == 204
        assert client.post(f"/cotizaciones/{cotizacion_id}/vista", headers=auth_headers_for(dueño)).status_code == 204
        assert len(_eventos(db_session, cotizacion_id, "solicitud_vista")) == 1

        otra, otro_dueño = _empresa(db_session, "China")
        assert client.post(f"/cotizaciones/{cotizacion_id}/vista", headers=auth_headers_for(otro_dueño)).status_code == 403
        assert client.post(f"/cotizaciones/{cotizacion_id}/vista", headers=headers).status_code == 403

    def test_reclamar_cuenta_como_vista(self, client, db_session):
        importador, dueño = _empresa(db_session, "China")
        _, headers = crear_usuario_con_token(db_session, rol="solicitante")
        cotizacion_id = client.post("/cotizaciones", json=_payload(importador.id), headers=headers).json()["id"]
        assert client.post(f"/cotizaciones/{cotizacion_id}/reclamar", headers=auth_headers_for(dueño)).status_code == 200
        assert len(_eventos(db_session, cotizacion_id, "solicitud_vista")) == 1
