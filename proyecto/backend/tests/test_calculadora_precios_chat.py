"""Calculadora de precios del chat de negociación.

1. El cálculo (servicio puro) sigue las bases descritas en el módulo.
2. `POST /chat/calculadora/calcular` da la vista previa solo a la empresa.
3. `POST /chat/conversaciones/{id}/estimaciones` publica la estimación en el
   chat con el desglose recalculado en el servidor y la reparte en vivo.
4. Nadie puede forjar un mensaje `estimacion` por los canales genéricos.
"""
from datetime import datetime
from uuid import uuid4

import pytest

from conftest import auth_headers_for, crear_empresa_importadora, crear_usuario_con_token
from models.chat import ConversacionChat, MensajeChat
from models.usuario import Usuario
from services.calculadora_precios import calcular_estimacion
from utils.security import hash_password

ENTRADA = {
    "moneda": "USD",
    "cantidad": 500,
    "precio_unitario": 4,
    "flete_internacional": 800,
    "seguro_pct": 1,
    "arancel_pct": 10,
    "iva_pct": 19,
    "gastos_destino": 300,
    "margen_pct": 10,
    "rango_pct": 5,
    "tasa_cambio_cop": 4000,
    "incoterm": "DDP",
    "tiempo_entrega": "45 días",
    "validez_dias": 15,
}


def _escenario(db_session, *, tipo="negociacion"):
    importador, dueño = crear_empresa_importadora(
        db_session,
        nombre_empresa=f"Empresa {uuid4().hex[:6]}",
        email_dueño=f"dueno_{uuid4().hex[:8]}@example.com",
    )
    asesor = Usuario(
        id=str(uuid4()), email=f"asesor_{uuid4().hex[:8]}@example.com",
        password_hash=hash_password("123456789"), rol="asesor",
        importador_id=importador.id, activo=True, fecha_creacion=datetime.utcnow(),
    )
    db_session.add(asesor)
    solicitante, _ = crear_usuario_con_token(db_session, rol="solicitante")
    if tipo == "interna":
        conversacion = ConversacionChat(
            id=str(uuid4()), tipo="interna", importador_id=importador.id, importador_usuario_id=asesor.id,
        )
    else:
        conversacion = ConversacionChat(
            id=str(uuid4()), cotizacion_id=str(uuid4()), solicitante_id=solicitante.id,
            importador_usuario_id=asesor.id,
        )
    db_session.add(conversacion)
    db_session.commit()
    return conversacion, asesor, dueño, solicitante


class TestCalculo:
    def test_desglose_completo(self):
        r = calcular_estimacion(
            cantidad=500, precio_unitario=4, flete_internacional=800, seguro_pct=1,
            arancel_pct=10, iva_pct=19, gastos_destino=300, margen_pct=10, rango_pct=5,
            tasa_cambio_cop=4000, moneda="USD",
        )
        # mercancía 2000; seguro (2000+800)·1% = 28; CIF 2828
        assert r["valor_mercancia"] == 2000.0
        assert r["seguro"] == 28.0
        assert r["valor_cif"] == 2828.0
        # arancel 10% de CIF; IVA 19% de (CIF + arancel)
        assert r["arancel"] == 282.8
        assert r["iva"] == 591.05  # 3110.8 × 0.19 = 591.052
        # margen 10% de (CIF + arancel + gastos) = 10% de 3410.8; el IVA no entra
        assert r["margen"] == 341.08
        assert r["total"] == 4342.93  # 2828 + 282.8 + 591.052 + 300 + 341.08
        assert r["costo_unitario"] == 8.69
        assert r["total_minimo"] == 4125.79  # 4342.932 × 0.95
        assert r["total_maximo"] == 4560.08
        assert r["total_cop"] == 17371728.0

    def test_sin_extras_el_total_es_la_mercancia(self):
        r = calcular_estimacion(cantidad=3, precio_unitario="0.1")
        assert r["total"] == 0.3
        assert r["total_minimo"] == r["total_maximo"] == 0.3

    def test_en_cop_no_se_duplica_la_conversion(self):
        r = calcular_estimacion(cantidad=1, precio_unitario=1000, tasa_cambio_cop=4000, moneda="COP")
        assert r["total_cop"] is None


class TestVistaPrevia:
    def test_la_empresa_obtiene_el_desglose(self, client, db_session):
        _, asesor, _, _ = _escenario(db_session)
        r = client.post("/chat/calculadora/calcular", json=ENTRADA, headers=auth_headers_for(asesor))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["desglose"]["total"] == 4342.93
        assert body["resumen"].startswith("Estimación de precio: USD 4,342.93")
        assert "Rango posible" in body["resumen"]

    def test_el_cliente_no_usa_la_calculadora(self, client, db_session):
        _, _, _, solicitante = _escenario(db_session)
        r = client.post("/chat/calculadora/calcular", json=ENTRADA, headers=auth_headers_for(solicitante))
        assert r.status_code == 403

    @pytest.mark.parametrize("campo,valor", [
        ("cantidad", 0), ("precio_unitario", -1), ("arancel_pct", 101), ("rango_pct", 60), ("moneda", "BTC"),
    ])
    def test_valida_la_entrada(self, client, db_session, campo, valor):
        _, asesor, _, _ = _escenario(db_session)
        r = client.post("/chat/calculadora/calcular", json={**ENTRADA, campo: valor}, headers=auth_headers_for(asesor))
        assert r.status_code == 422


class TestEnvioAlChat:
    def test_el_asesor_envia_la_estimacion_y_el_cliente_la_ve(self, client, db_session, mock_redis_client):
        conversacion, asesor, _, solicitante = _escenario(db_session)
        r = client.post(
            f"/chat/conversaciones/{conversacion.id}/estimaciones",
            json=ENTRADA,
            headers=auth_headers_for(asesor),
        )
        assert r.status_code == 201, r.text
        mensaje = r.json()
        assert mensaje["tipo"] == "estimacion"
        assert mensaje["contenido"].startswith("Estimación de precio")
        estimacion = mensaje["metadata"]["estimacion"]
        assert estimacion["desglose"]["total"] == 4342.93
        assert estimacion["entrada"]["tiempo_entrega"] == "45 días"
        assert estimacion["cotizacion_id"] == conversacion.cotizacion_id

        # Se reparte en vivo por el canal de la conversación.
        canal, payload = mock_redis_client.publish.call_args.args
        assert canal == f"chat:{conversacion.id}"
        assert '"tipo": "estimacion"' in payload

        r = client.get(f"/chat/conversaciones/{conversacion.id}/mensajes", headers=auth_headers_for(solicitante))
        assert r.status_code == 200
        assert [m["tipo"] for m in r.json()] == ["estimacion"]

    def test_el_dueño_de_la_empresa_tambien_puede(self, client, db_session, mock_redis_client):
        conversacion, _, dueño, _ = _escenario(db_session)
        r = client.post(f"/chat/conversaciones/{conversacion.id}/estimaciones", json=ENTRADA, headers=auth_headers_for(dueño))
        assert r.status_code == 201, r.text

    def test_el_cliente_no_puede_enviar_estimaciones(self, client, db_session):
        conversacion, _, _, solicitante = _escenario(db_session)
        r = client.post(
            f"/chat/conversaciones/{conversacion.id}/estimaciones", json=ENTRADA, headers=auth_headers_for(solicitante),
        )
        assert r.status_code == 403

    def test_otra_empresa_no_puede_escribir_en_el_hilo(self, client, db_session):
        conversacion, _, _, _ = _escenario(db_session)
        _, ajeno, _, _ = _escenario(db_session)
        r = client.post(f"/chat/conversaciones/{conversacion.id}/estimaciones", json=ENTRADA, headers=auth_headers_for(ajeno))
        assert r.status_code == 403

    def test_no_se_usa_en_el_chat_interno(self, client, db_session):
        conversacion, asesor, _, _ = _escenario(db_session, tipo="interna")
        r = client.post(f"/chat/conversaciones/{conversacion.id}/estimaciones", json=ENTRADA, headers=auth_headers_for(asesor))
        assert r.status_code == 400


class TestNoSePuedeForjar:
    def test_rest_generico_rechaza_el_tipo_estimacion(self, client, db_session):
        conversacion, asesor, _, _ = _escenario(db_session)
        r = client.post(
            f"/chat/conversaciones/{conversacion.id}/mensajes",
            json={"contenido": "Estimación de precio: USD 1", "tipo": "estimacion",
                  "metadata": {"estimacion": {"desglose": {"total": 1}}}},
            headers=auth_headers_for(asesor),
        )
        assert r.status_code == 422

    def test_websocket_descarta_tipos_reservados(self, client, db_session):
        conversacion, _, _, solicitante = _escenario(db_session)
        import config
        original = config.redis_client
        config.redis_client = None
        try:
            from utils.security import create_access_token
            token = create_access_token(str(solicitante.id), "solicitante")
            with client.websocket_connect(f"/ws/chat/{conversacion.id}?token={token}") as ws:
                ws.send_json({"contenido": "falsa", "tipo": "estimacion", "metadata": {"estimacion": {}}})
                ws.send_json({"contenido": "falsa", "tipo": "sistema"})
                ws.send_json({"contenido": "hola", "tipo": "texto"})
                # Solo vuelve el eco del mensaje válido.
                assert ws.receive_json()["contenido"] == "hola"
        finally:
            config.redis_client = original

        tipos = [m.tipo for m in db_session.query(MensajeChat).filter(MensajeChat.conversacion_id == conversacion.id)]
        assert tipos == ["texto"]
