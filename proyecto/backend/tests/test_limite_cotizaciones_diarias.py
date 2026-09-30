"""Límite diario de cotizaciones recibidas por empresa importadora.

1. La empresa fija (o quita) `limite_cotizaciones_diarias` en su perfil.
2. `POST /cotizaciones` dirigida responde 409 cuando la empresa ya llegó al tope.
3. El matching de abiertas deja fuera a la empresa con el cupo agotado, y esa
   abierta no le aparece en la bandeja ni la puede reclamar o responder.
4. El contador se reinicia a medianoche de Colombia.
5. `GET /importadores/cupo-diario` informa del uso.
"""
from datetime import datetime, timedelta
from uuid import uuid4

import pytest

from conftest import auth_headers_for, crear_empresa_importadora, crear_usuario_con_token
from models.cotizacion import Cotizacion
from models.recepcion_cotizacion import RecepcionCotizacion
from services.cupo_cotizaciones import inicio_dia_utc, recibidas_hoy


def _payload(importador_id=None, **extra):
    payload = {
        "modalidad": "dirigida" if importador_id else "abierta",
        "pais_importacion": "China",
        "nombre_producto": "Camisetas personalizadas",
        "descripcion_cliente": "Necesito 500 camisetas con mi logo impreso en algodón premium",
        "linea_producto": "Textiles",
        "tipo_calidad": "estandar",
        "cantidad_minima": 500,
        "incoterm": "FOB",
    }
    if importador_id:
        payload["importador_id"] = importador_id
    payload.update(extra)
    return payload


def _empresa(db_session, limite=None, pais=None):
    # País propio por empresa: así el matching de cada test solo ve a las suyas
    # y no a las que dejaron creadas otros tests en la misma base.
    importador, dueño = crear_empresa_importadora(
        db_session,
        nombre_empresa=f"Empresa {uuid4().hex[:6]}",
        email_dueño=f"dueno_{uuid4().hex[:8]}@example.com",
    )
    importador.limite_cotizaciones_diarias = limite
    importador.especialidad_producto = ["Textiles"]
    importador.paises_origen = [pais or "China"]
    db_session.commit()
    return importador, dueño


def _solicitante(db_session):
    return crear_usuario_con_token(db_session, rol="solicitante")


class TestConfiguracionDelLimite:
    def test_la_empresa_fija_y_quita_su_limite(self, client, db_session):
        importador, dueño = _empresa(db_session)
        headers = auth_headers_for(dueño)

        r = client.put(f"/importadores/{importador.id}", json={"limite_cotizaciones_diarias": 5}, headers=headers)
        assert r.status_code == 200, r.text
        assert r.json()["limite_cotizaciones_diarias"] == 5

        r = client.put(f"/importadores/{importador.id}", json={"limite_cotizaciones_diarias": None}, headers=headers)
        assert r.status_code == 200, r.text
        assert r.json()["limite_cotizaciones_diarias"] is None
        db_session.refresh(importador)
        assert importador.limite_cotizaciones_diarias is None

    def test_omitir_el_campo_no_toca_el_limite(self, client, db_session):
        importador, dueño = _empresa(db_session, limite=3)
        r = client.put(f"/importadores/{importador.id}", json={"nombre_empresa": "Otro nombre"}, headers=auth_headers_for(dueño))
        assert r.status_code == 200, r.text
        assert r.json()["limite_cotizaciones_diarias"] == 3

    @pytest.mark.parametrize("valor", [0, -1, 10001])
    def test_rechaza_limites_fuera_de_rango(self, client, db_session, valor):
        importador, dueño = _empresa(db_session)
        r = client.put(
            f"/importadores/{importador.id}",
            json={"limite_cotizaciones_diarias": valor},
            headers=auth_headers_for(dueño),
        )
        assert r.status_code == 422


class TestCotizacionesDirigidas:
    def test_al_llegar_al_limite_rechaza_con_409(self, client, db_session):
        importador, _ = _empresa(db_session, limite=2)
        solicitante, headers = _solicitante(db_session)

        for _ in range(2):
            r = client.post("/cotizaciones", json=_payload(importador.id), headers=headers)
            assert r.status_code == 201, r.text

        r = client.post("/cotizaciones", json=_payload(importador.id), headers=headers)
        assert r.status_code == 409
        assert "límite de cotizaciones" in r.json()["detail"]
        assert importador.nombre_empresa in r.json()["detail"]

        db_session.expire_all()
        assert db_session.query(Cotizacion).filter(Cotizacion.solicitante_id == str(solicitante.id)).count() == 2

    def test_sin_limite_no_se_rechaza(self, client, db_session):
        importador, _ = _empresa(db_session, limite=None)
        _, headers = _solicitante(db_session)
        for _ in range(3):
            r = client.post("/cotizaciones", json=_payload(importador.id), headers=headers)
            assert r.status_code == 201, r.text
        assert recibidas_hoy(db_session, [importador.id])[str(importador.id)] == 3

    def test_las_recepciones_de_ayer_no_cuentan(self, client, db_session):
        importador, _ = _empresa(db_session, limite=1)
        _, headers = _solicitante(db_session)
        r = client.post("/cotizaciones", json=_payload(importador.id), headers=headers)
        assert r.status_code == 201, r.text

        recepcion = db_session.query(RecepcionCotizacion).filter(
            RecepcionCotizacion.importador_id == str(importador.id)
        ).one()
        recepcion.fecha_recepcion = inicio_dia_utc() - timedelta(minutes=1)
        db_session.commit()

        r = client.post("/cotizaciones", json=_payload(importador.id), headers=headers)
        assert r.status_code == 201, r.text


class TestCotizacionesAbiertas:
    def test_matching_salta_a_la_empresa_con_cupo_agotado(self, client, db_session, mock_redis_client):
        pais = f"Pais-{uuid4().hex[:6]}"
        llena, dueño_llena = _empresa(db_session, limite=1, pais=pais)
        libre, _ = _empresa(db_session, limite=1, pais=pais)
        _, headers = _solicitante(db_session)

        # Agota el cupo de `llena` con una dirigida.
        r = client.post("/cotizaciones", json=_payload(llena.id), headers=headers)
        assert r.status_code == 201, r.text

        r = client.post("/cotizaciones", json=_payload(pais_importacion=pais), headers=headers)
        assert r.status_code == 201, r.text
        abierta_id = r.json()["id"]

        filas = {
            fila.importador_id: fila.entregada
            for fila in db_session.query(RecepcionCotizacion).filter(RecepcionCotizacion.cotizacion_id == abierta_id)
        }
        assert filas == {str(llena.id): False, str(libre.id): True}

        # La empresa llena no la ve en su bandeja...
        r = client.get("/cotizaciones", headers=auth_headers_for(dueño_llena))
        assert r.status_code == 200
        assert abierta_id not in {c["id"] for c in r.json()}

        # ...ni puede reclamarla o responderla por la API.
        r = client.post(f"/cotizaciones/{abierta_id}/reclamar", headers=auth_headers_for(dueño_llena))
        assert r.status_code == 403
        r = client.post(
            "/propuestas",
            json={
                "cotizacion_id": abierta_id,
                "precio_ofrecido_usd": 1000,
                "tiempo_estimado_entrega": "30 días",
                "incoterm": "FOB",
            },
            headers=auth_headers_for(dueño_llena),
        )
        assert r.status_code == 403
        assert "límite de cotizaciones diarias" in r.json()["detail"]

    def test_la_abierta_entregada_consume_cupo(self, client, db_session, mock_redis_client):
        pais = f"Pais-{uuid4().hex[:6]}"
        importador, _ = _empresa(db_session, limite=1, pais=pais)
        _, headers = _solicitante(db_session)

        r = client.post("/cotizaciones", json=_payload(pais_importacion=pais), headers=headers)
        assert r.status_code == 201, r.text

        r = client.post("/cotizaciones", json=_payload(importador.id, pais_importacion=pais), headers=headers)
        assert r.status_code == 409


class TestConsultaDelCupo:
    def test_informa_uso_del_dia(self, client, db_session):
        importador, dueño = _empresa(db_session, limite=3)
        _, headers = _solicitante(db_session)
        client.post("/cotizaciones", json=_payload(importador.id), headers=headers)

        r = client.get("/importadores/cupo-diario", headers=auth_headers_for(dueño))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["limite_cotizaciones_diarias"] == 3
        assert body["recibidas_hoy"] == 1
        assert body["disponibles_hoy"] == 2
        assert body["cupo_agotado"] is False
        assert datetime.fromisoformat(body["reinicia_en"]) > datetime.utcnow()

    def test_sin_limite_no_hay_disponibles_calculados(self, client, db_session):
        importador, dueño = _empresa(db_session, limite=None)
        r = client.get("/importadores/cupo-diario", headers=auth_headers_for(dueño))
        assert r.status_code == 200, r.text
        assert r.json()["disponibles_hoy"] is None
        assert r.json()["cupo_agotado"] is False

    def test_solicitante_no_puede_consultarlo(self, client, db_session):
        _, headers = _solicitante(db_session)
        r = client.get("/importadores/cupo-diario", headers=headers)
        assert r.status_code == 403


class TestInicioDelDia:
    def test_medianoche_de_colombia(self):
        # 03:00 UTC del 1 de octubre = 22:00 del 30 de septiembre en Bogotá.
        assert inicio_dia_utc(datetime(2026, 10, 1, 3, 0)) == datetime(2026, 9, 30, 5, 0)
        # 06:00 UTC del 1 de octubre = 01:00 del 1 de octubre en Bogotá.
        assert inicio_dia_utc(datetime(2026, 10, 1, 6, 0)) == datetime(2026, 10, 1, 5, 0)
