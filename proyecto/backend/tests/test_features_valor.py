"""Tests: evidencias de importador, organizaciones/créditos, disputas, referidos, traducción."""
from uuid import uuid4
from datetime import datetime
from unittest.mock import patch

import pytest
from fastapi import status

from models.usuario import Usuario
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.orden import Orden, EstadoOrden
from models.propuesta import Propuesta, EstadoPropuesta
from models.evidencia import EvidenciaImportador, EstadoEvidenciaImportador
from models.chat import ConversacionChat, MensajeChat
from utils.security import hash_password, create_access_token
from conftest import crear_empresa_importadora, auth_headers_for, registro_payload, registrar_verificado, crear_usuario_con_token


@pytest.fixture()
def solicitante(db_session):
    u = Usuario(
        id=str(uuid4()), email="sol_feat@example.com", password_hash=hash_password("123456789"),
        rol="solicitante", tipo_persona="natural", creditos_balance=50.0, perfil_completo=True,
        activo=True, email_verificado=True, fecha_creacion=datetime.utcnow(),
    )
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u


class TestEvidenciasImportador:
    def test_dueño_crea_y_admin_aprueba(self, client, db_session):
        importador, dueño = crear_empresa_importadora(db_session)
        _, admin_h = crear_usuario_con_token(db_session, rol="admin")

        r = client.post(
            "/importadores/evidencias",
            json={"tipo": "certificado", "titulo": "ISO 9001", "url": "https://cdn.example.com/iso.pdf"},
            headers=auth_headers_for(dueño),
        )
        assert r.status_code == 201
        eid = r.json()["id"]
        assert r.json()["estado"] == "pendiente"

        r2 = client.put(
            f"/admin/evidencias/{eid}/revisar",
            json={"estado": "aprobada", "nota_revision": "OK"},
            headers=admin_h,
        )
        assert r2.status_code == 200
        assert r2.json()["estado"] == "aprobada"

        pub = client.get(f"/importadores/{importador.id}/evidencias")
        assert pub.status_code == 200
        assert any(e["id"] == eid for e in pub.json())


class TestOrganizacionCreditos:
    def test_registro_juridica_crea_org_wallet(self, client, db_session, monkeypatch):
        from conftest import capturar_otp_envio
        capturado = capturar_otp_envio(monkeypatch)
        r = client.post("/auth/register", json={
            "email": "corp@example.com",
            "password": "ClaveSegura1",
            "rol": "solicitante",
            "tipo_persona": "juridica",
            "nit": "900123456-1",
            "razon_social": "Compras SAS",
            "indicativo_pais_telefono": "+57",
            "telefono": "3001234567",
            "acepto_politica_datos": True,
        })
        assert r.status_code == 201
        v = client.post("/auth/verificar-email", json={"email": "corp@example.com", "otp": capturado["otp"]})
        assert v.status_code == 200
        token = v.json()["access_token"]
        h = {"Authorization": f"Bearer {token}"}

        org = client.get("/organizaciones/me", headers=h)
        assert org.status_code == 200
        # Sin cobro a solicitantes: no hay bono de registro en créditos
        assert org.json()["creditos_balance"] == 0.0

        saldo = client.get("/creditos/saldo", headers=h)
        assert saldo.status_code == 200
        assert saldo.json()["wallet_tipo"] == "organizacion"
        assert saldo.json()["creditos_balance"] == 0.0

    def test_miembro_crea_cotizacion_sin_consumir_wallet(self, client, db_session, monkeypatch):
        from conftest import capturar_otp_envio
        capturado = capturar_otp_envio(monkeypatch)
        r = client.post("/auth/register", json={
            "email": "owner_org@example.com",
            "password": "ClaveSegura1",
            "rol": "solicitante",
            "tipo_persona": "juridica",
            "nit": "900999888-1",
            "razon_social": "Team Buy SAS",
            "indicativo_pais_telefono": "+57",
            "telefono": "3009998887",
            "acepto_politica_datos": True,
        })
        assert r.status_code == 201
        v = client.post("/auth/verificar-email", json={"email": "owner_org@example.com", "otp": capturado["otp"]})
        assert v.status_code == 200
        owner_h = {"Authorization": f"Bearer {v.json()['access_token']}"}
        inv = client.post(
            "/organizaciones/me/invitar",
            json={"email": "member_org@example.com", "password": "ClaveSegura1", "rol_org": "member"},
            headers=owner_h,
        )
        assert inv.status_code == 201

        login = client.post("/auth/login", json={"email": "member_org@example.com", "password": "ClaveSegura1"})
        member_h = {"Authorization": f"Bearer {login.json()['access_token']}"}

        empresa, _ = crear_empresa_importadora(db_session, email_dueño="imp_org_cred@example.com")
        cot = client.post("/cotizaciones", json={
            "modalidad": "dirigida",
            "importador_id": empresa.id,
            "pais_importacion": "China",
            "nombre_producto": "Camisetas",
            "descripcion_cliente": "Necesito camisetas con logo personalizado en algodon",
            "linea_producto": "Textiles",
            "tipo_calidad": "estandar",
            "cantidad_minima": 100,
            "incoterm": "FOB",
        }, headers=member_h)
        assert cot.status_code == 201
        assert cot.json().get("costo_creditos") in (0, 0.0, None)

        saldo = client.get("/creditos/saldo", headers=owner_h)
        # Cotizar no descuenta créditos del solicitante / org
        assert saldo.json()["creditos_balance"] == 0.0


class TestDisputaRoom:
    def test_reportar_crea_disputa_y_evidencia(self, client, db_session, solicitante):
        empresa, dueño = crear_empresa_importadora(db_session, email_dueño="imp_disp@example.com")
        cot = Cotizacion(
            id=str(uuid4()), solicitante_id=solicitante.id, importador_id=empresa.id,
            modalidad="dirigida", pais_importacion="China", nombre_producto="Prod",
            descripcion_cliente="Descripcion larga de producto para disputa room test",
            linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=10,
            incoterm="FOB", estado=EstadoCotizacion.orden_activa.value,
        )
        db_session.add(cot)
        db_session.flush()
        orden = Orden(
            id=str(uuid4()), cotizacion_id=cot.id, importador_id=empresa.id,
            solicitante_id=solicitante.id, estado=EstadoOrden.cotizacion_aceptada,
            precio_acordado_usd=10.0,
        )
        db_session.add(orden)
        db_session.commit()

        r = client.put(
            f"/ordenes/{orden.id}/reportar-problema",
            json={"motivo": "El producto llegó defectuoso y no coincide"},
            headers=auth_headers_for(solicitante),
        )
        assert r.status_code == 200
        disputa_id = r.json()["disputa_id"]

        ev = client.post(
            f"/disputas/{disputa_id}/evidencias",
            json={"url": "https://cdn.example.com/foto.jpg", "tipo": "imagen", "descripcion": "Foto daño"},
            headers=auth_headers_for(solicitante),
        )
        assert ev.status_code == 201

        detalle = client.get(f"/disputas/{disputa_id}", headers=auth_headers_for(dueño))
        assert detalle.status_code == 200
        assert len(detalle.json()["evidencias"]) == 1


class TestReferidos:
    def test_codigo_y_bono_al_registrar(self, client, db_session, monkeypatch):
        d1 = registrar_verificado(client, monkeypatch, "ref_owner@example.com")
        h1 = {"Authorization": f"Bearer {d1['access_token']}"}
        codigo = client.get("/referidos/mi-codigo", headers=h1).json()["codigo"]

        from conftest import capturar_otp_envio
        capturado2 = capturar_otp_envio(monkeypatch)
        r2 = client.post("/auth/register", json={
            **registro_payload("ref_amigo@example.com"),
            "codigo_referido": codigo,
        })
        assert r2.status_code == 201
        v2 = client.post("/auth/verificar-email", json={"email": "ref_amigo@example.com", "otp": capturado2["otp"]})
        assert v2.status_code == 200

        saldo1 = client.get("/creditos/saldo", headers=h1).json()["creditos_balance"]
        # Sin cobro a solicitantes: referidos no otorgan bonos de créditos
        assert saldo1 == 0.0

        h2 = {"Authorization": f"Bearer {v2.json()['access_token']}"}
        saldo2 = client.get("/creditos/saldo", headers=h2).json()["creditos_balance"]
        assert saldo2 == 0.0

        # El vínculo de referido sí se registra
        from models.referido import ReferidoUso
        usos = db_session.query(ReferidoUso).filter(
            ReferidoUso.usuario_referido_id == v2.json()["user_id"]
        ).all()
        assert len(usos) == 1


class TestTraduccion:
    def test_traducir_preview_mock(self, client, db_session, solicitante):
        r = client.post(
            "/chat/traducir",
            json={"texto": "Hola mundo", "idioma_destino": "en"},
            headers=auth_headers_for(solicitante),
        )
        assert r.status_code == 200
        assert r.json()["traducido"].startswith("[en]")

    def test_traducir_mensaje_cachea_metadata(self, client, db_session, solicitante):
        empresa, dueño = crear_empresa_importadora(db_session, email_dueño="imp_tr@example.com")
        cot = Cotizacion(
            id=str(uuid4()), solicitante_id=solicitante.id, importador_id=empresa.id,
            modalidad="dirigida", pais_importacion="China", nombre_producto="Prod",
            descripcion_cliente="Descripcion larga suficiente para crear conversacion chat",
            linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=10,
            incoterm="FOB", estado=EstadoCotizacion.propuestas_recibidas.value,
        )
        db_session.add(cot)
        db_session.flush()
        conv = ConversacionChat(
            id=str(uuid4()), cotizacion_id=cot.id,
            solicitante_id=solicitante.id, importador_usuario_id=dueño.id,
        )
        db_session.add(conv)
        db_session.flush()
        msg = MensajeChat(
            id=str(uuid4()), conversacion_id=conv.id,
            remitente_id=solicitante.id, contenido="Precio demasiado alto",
        )
        db_session.add(msg)
        db_session.commit()

        r = client.post(
            f"/chat/mensajes/{msg.id}/traducir",
            json={"idioma_destino": "en"},
            headers=auth_headers_for(solicitante),
        )
        assert r.status_code == 200
        db_session.refresh(msg)
        assert msg.metadata_json is not None
        assert "en" in msg.metadata_json.get("traducciones", {})
