"""Asignación de solicitudes abiertas en lugar de difusión a toda la red.

- En modo manual (piloto) la abierta no llega a nadie hasta que el admin la
  asigna; cada solicitud admite como mucho `cupo_por_solicitud` empresas.
- Una empresa solo ve, reclama y responde lo que tiene asignado.
- Propuestas selladas: ninguna empresa ve las de las otras ni quién compite.
- El comprador recibe las propuestas en orden de llegada, con el cumplimiento
  de cada empresa.
"""
from uuid import uuid4

import pytest

from conftest import auth_headers_for, crear_empresa_importadora, crear_usuario_con_token
from models.configuracion import ConfiguracionPlataforma
from models.evento import Evento
from models.notificacion import Notificacion
from services import configuracion


@pytest.fixture()
def modo(db_session):
    """Fija modo y cupo de asignación para el test y los deja como estaban."""
    def fijar(nombre="manual", cupo=3):
        configuracion.guardar(db_session, configuracion.CLAVE_MODO_ASIGNACION, nombre)
        configuracion.guardar(db_session, configuracion.CLAVE_CUPO_POR_SOLICITUD, str(cupo))
        db_session.commit()

    fijar()
    yield fijar
    db_session.query(ConfiguracionPlataforma).filter(ConfiguracionPlataforma.clave.in_([
        configuracion.CLAVE_MODO_ASIGNACION, configuracion.CLAVE_CUPO_POR_SOLICITUD,
    ])).delete(synchronize_session=False)
    db_session.commit()


@pytest.fixture()
def admin(db_session):
    return crear_usuario_con_token(db_session, rol="admin")


def _empresa(db_session, pais, **extra):
    return crear_empresa_importadora(
        db_session,
        nombre_empresa=extra.pop("nombre", f"Empresa {uuid4().hex[:6]}"),
        email_dueño=f"dueno_{uuid4().hex[:8]}@example.com",
        especialidad_producto=extra.pop("especialidad_producto", ["Textiles"]),
        paises_origen=[pais],
        **extra,
    )


def _abierta(client, headers, pais, **extra):
    payload = {
        "modalidad": "abierta",
        "pais_importacion": pais,
        "nombre_producto": "Camisetas",
        "descripcion_cliente": "Camisetas de algodón con logo bordado en el pecho",
        "linea_producto": "Textiles",
        "tipo_calidad": "estandar",
        "cantidad_minima": 500,
        "incoterm": "FOB",
        **extra,
    }
    r = client.post("/cotizaciones", json=payload, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _propuesta(client, headers, cotizacion_id, precio=2000.0, tiempo="45 días"):
    return client.post("/propuestas", json={
        "cotizacion_id": cotizacion_id, "precio_ofrecido_usd": precio,
        "tiempo_estimado_entrega": tiempo, "incoterm": "FOB",
    }, headers=headers)


def _asignar(client, admin_headers, cotizacion_id, *importadores):
    return client.post(
        f"/admin/solicitudes-abiertas/{cotizacion_id}/asignar",
        json={"importador_ids": [str(i.id) for i in importadores]},
        headers=admin_headers,
    )


class TestModoManual:
    def test_la_abierta_espera_al_admin(self, client, db_session, modo, admin):
        pais = f"P-{uuid4().hex[:6]}"
        importador, dueño = _empresa(db_session, pais)
        admin_user, admin_headers = admin
        _, headers = crear_usuario_con_token(db_session, rol="solicitante")
        cotizacion_id = _abierta(client, headers, pais)

        # No le llegó a nadie.
        assert client.get("/cotizaciones", headers=auth_headers_for(dueño)).json() == []
        assert client.get(f"/cotizaciones/{cotizacion_id}", headers=auth_headers_for(dueño)).status_code == 403
        assert _propuesta(client, auth_headers_for(dueño), cotizacion_id).status_code == 403
        assert db_session.query(Evento).filter(
            Evento.cotizacion_id == cotizacion_id, Evento.tipo == "solicitud_asignada"
        ).count() == 0

        # El admin recibe el aviso y la ve por asignar.
        aviso = db_session.query(Notificacion).filter(Notificacion.usuario_id == admin_user.id).all()
        assert any(n.data and n.data.get("cotizacion_id") == cotizacion_id for n in aviso)
        pendientes = client.get("/admin/solicitudes-abiertas?filtro=por_asignar", headers=admin_headers).json()
        assert cotizacion_id in [s["id"] for s in pendientes]

    def test_asignar_da_acceso_y_registra_el_evento(self, client, db_session, modo, admin):
        pais = f"P-{uuid4().hex[:6]}"
        importador, dueño = _empresa(db_session, pais)
        admin_user, admin_headers = admin
        _, headers = crear_usuario_con_token(db_session, rol="solicitante")
        cotizacion_id = _abierta(client, headers, pais)

        r = _asignar(client, admin_headers, cotizacion_id, importador)
        assert r.status_code == 200, r.text
        assert r.json()["asignadas"] == 1
        assert r.json()["empresas"][0]["origen"] == "manual"

        assert [c["id"] for c in client.get("/cotizaciones", headers=auth_headers_for(dueño)).json()] == [cotizacion_id]
        assert client.get(f"/cotizaciones/{cotizacion_id}", headers=auth_headers_for(dueño)).status_code == 200
        assert _propuesta(client, auth_headers_for(dueño), cotizacion_id).status_code == 201

        evento = db_session.query(Evento).filter(
            Evento.cotizacion_id == cotizacion_id, Evento.tipo == "solicitud_asignada"
        ).one()
        assert evento.importador_id == str(importador.id)
        assert evento.usuario_id == str(admin_user.id) and evento.rol_usuario == "admin"
        assert evento.datos["origen_asignacion"] == "manual"

        aviso = db_session.query(Notificacion).filter(Notificacion.usuario_id == dueño.id).all()
        assert any(n.titulo == "Nueva solicitud asignada" for n in aviso)

    def test_no_pasa_del_cupo_por_solicitud(self, client, db_session, modo, admin):
        modo("manual", 2)
        pais = f"P-{uuid4().hex[:6]}"
        a, b, c = (_empresa(db_session, pais)[0] for _ in range(3))
        _, admin_headers = admin
        _, headers = crear_usuario_con_token(db_session, rol="solicitante")
        cotizacion_id = _abierta(client, headers, pais)

        assert _asignar(client, admin_headers, cotizacion_id, a, b, c).status_code == 409
        assert _asignar(client, admin_headers, cotizacion_id, a, b).status_code == 200
        r = _asignar(client, admin_headers, cotizacion_id, c)
        assert r.status_code == 409
        assert "máximo 2" in r.json()["detail"]
        # Repetir una ya asignada no cuenta dos veces.
        assert _asignar(client, admin_headers, cotizacion_id, a).status_code == 200

    def test_rechaza_empresas_que_no_podrian_responder(self, client, db_session, modo, admin):
        pais = f"P-{uuid4().hex[:6]}"
        otra_categoria, _ = _empresa(db_session, pais, especialidad_producto=["Electrónica"])
        solo_directas, _ = _empresa(db_session, pais, solo_cotizaciones_directas=True)
        sin_cupo, _ = _empresa(db_session, pais)
        sin_cupo.limite_cotizaciones_diarias = 1
        db_session.commit()
        _, admin_headers = admin
        _, headers = crear_usuario_con_token(db_session, rol="solicitante")
        client.post("/cotizaciones", json={
            "modalidad": "dirigida", "importador_id": str(sin_cupo.id), "pais_importacion": pais,
            "nombre_producto": "X", "descripcion_cliente": "Descripción suficientemente larga",
            "linea_producto": "Textiles", "tipo_calidad": "estandar", "cantidad_minima": 10, "incoterm": "FOB",
        }, headers=headers)
        cotizacion_id = _abierta(client, headers, pais)

        assert _asignar(client, admin_headers, cotizacion_id, otra_categoria).status_code == 400
        assert _asignar(client, admin_headers, cotizacion_id, solo_directas).status_code == 400
        assert _asignar(client, admin_headers, cotizacion_id, sin_cupo).status_code == 409

    def test_quitar_asignacion_solo_sin_propuesta(self, client, db_session, modo, admin):
        pais = f"P-{uuid4().hex[:6]}"
        (a, dueño_a), (b, _) = _empresa(db_session, pais), _empresa(db_session, pais)
        _, admin_headers = admin
        _, headers = crear_usuario_con_token(db_session, rol="solicitante")
        cotizacion_id = _abierta(client, headers, pais)
        _asignar(client, admin_headers, cotizacion_id, a, b)
        assert _propuesta(client, auth_headers_for(dueño_a), cotizacion_id).status_code == 201

        r = client.delete(f"/admin/solicitudes-abiertas/{cotizacion_id}/asignaciones/{a.id}", headers=admin_headers)
        assert r.status_code == 409
        r = client.delete(f"/admin/solicitudes-abiertas/{cotizacion_id}/asignaciones/{b.id}", headers=admin_headers)
        assert r.status_code == 200, r.text
        assert r.json()["asignadas"] == 1
        assert db_session.query(Evento).filter(
            Evento.cotizacion_id == cotizacion_id, Evento.tipo == "solicitud_desasignada",
            Evento.importador_id == str(b.id),
        ).count() == 1

    def test_candidatos_con_encaje_y_desempeno(self, client, db_session, modo, admin):
        pais = f"P-{uuid4().hex[:6]}"
        encaja, _ = _empresa(db_session, pais, nombre="Encaja SAS")
        minimo_alto, _ = _empresa(db_session, pais, nombre="Mínimo alto")
        minimo_alto.pedido_minimo = 5000
        minimo_alto.pedido_minimo_unidad = "unidades"
        db_session.commit()
        _, admin_headers = admin
        _, headers = crear_usuario_con_token(db_session, rol="solicitante")
        cotizacion_id = _abierta(client, headers, pais)

        r = client.get(f"/admin/solicitudes-abiertas/{cotizacion_id}/candidatos?solo_que_encajan=true", headers=admin_headers)
        assert r.status_code == 200, r.text
        candidatos = {c["nombre_empresa"]: c for c in r.json()["candidatos"]}
        assert set(candidatos) == {"Encaja SAS", "Mínimo alto"}
        assert candidatos["Mínimo alto"]["encaje"]["pedido_minimo"]["cumple"] is False
        assert candidatos["Encaja SAS"]["encaje"]["pedido_minimo"]["cumple"] is True
        assert candidatos["Encaja SAS"]["encaje"]["categoria"] is True
        assert "tasa_respuesta_pct" in candidatos["Encaja SAS"]["desempeno"]
        assert candidatos["Encaja SAS"]["puntaje"] > candidatos["Mínimo alto"]["puntaje"]
        assert r.json()["solicitud"]["cupo_por_solicitud"] == 3

    def test_solo_el_admin(self, client, db_session, modo):
        importador, dueño = _empresa(db_session, "China")
        assert client.get("/admin/solicitudes-abiertas", headers=auth_headers_for(dueño)).status_code == 403
        assert client.get("/admin/configuracion-operacion", headers=auth_headers_for(dueño)).status_code == 403


class TestModoAutomatico:
    def test_reparte_solo_hasta_el_cupo_y_por_encaje(self, client, db_session, modo):
        modo("automatica", 2)
        pais = f"P-{uuid4().hex[:6]}"
        buena_1, _ = _empresa(db_session, pais)
        buena_2, _ = _empresa(db_session, pais)
        no_encaja, _ = _empresa(db_session, pais)
        no_encaja.pedido_minimo = 10000
        no_encaja.pedido_minimo_unidad = "unidades"
        db_session.commit()
        _, headers = crear_usuario_con_token(db_session, rol="solicitante")
        cotizacion_id = _abierta(client, headers, pais)

        asignadas = {
            e.importador_id for e in db_session.query(Evento).filter(
                Evento.cotizacion_id == cotizacion_id, Evento.tipo == "solicitud_asignada"
            )
        }
        assert asignadas == {str(buena_1.id), str(buena_2.id)}


class TestPropuestasSelladas:
    def test_ninguna_empresa_ve_a_la_competencia(self, client, db_session, modo, admin):
        pais = f"P-{uuid4().hex[:6]}"
        (a, dueño_a), (b, dueño_b) = _empresa(db_session, pais), _empresa(db_session, pais)
        _, admin_headers = admin
        _, headers = crear_usuario_con_token(db_session, rol="solicitante")
        cotizacion_id = _abierta(client, headers, pais)
        _asignar(client, admin_headers, cotizacion_id, a, b)

        assert _propuesta(client, auth_headers_for(dueño_a), cotizacion_id, precio=1800).status_code == 201

        # B no ve la propuesta de A, ni a su responsable, ni que ya hay propuestas.
        propuestas_b = client.get(f"/cotizaciones/{cotizacion_id}/propuestas", headers=auth_headers_for(dueño_b)).json()
        assert propuestas_b == []
        vista_b = client.get(f"/cotizaciones/{cotizacion_id}", headers=auth_headers_for(dueño_b)).json()
        assert vista_b["asesor_asignado_id"] is None
        assert vista_b["contacto_asignado"] is None
        assert vista_b["conversacion_id"] is None
        assert vista_b["estado"] == "abierta"
        listado_b = client.get("/cotizaciones", headers=auth_headers_for(dueño_b)).json()
        assert listado_b[0]["asesor_asignado_id"] is None and listado_b[0]["estado"] == "abierta"

        # A sí ve lo suyo.
        vista_a = client.get(f"/cotizaciones/{cotizacion_id}", headers=auth_headers_for(dueño_a)).json()
        assert vista_a["asesor_asignado_id"] == str(dueño_a.id)
        assert vista_a["estado"] == "propuestas_recibidas"
        propuestas_a = client.get(f"/cotizaciones/{cotizacion_id}/propuestas", headers=auth_headers_for(dueño_a)).json()
        assert [p["importador_id"] for p in propuestas_a] == [str(a.id)]
        assert propuestas_a[0]["empresa"] is None  # el resumen es para el comprador


class TestComparadorDelComprador:
    def test_orden_de_llegada_y_cumplimiento_de_cada_empresa(self, client, db_session, modo, admin):
        pais = f"P-{uuid4().hex[:6]}"
        (a, dueño_a), (b, dueño_b) = _empresa(db_session, pais, nombre="Primera"), _empresa(db_session, pais, nombre="Segunda")
        _, admin_headers = admin
        _, headers = crear_usuario_con_token(db_session, rol="solicitante")
        cotizacion_id = _abierta(client, headers, pais)
        _asignar(client, admin_headers, cotizacion_id, a, b)
        _propuesta(client, auth_headers_for(dueño_a), cotizacion_id, precio=3000)  # más cara, llega primero
        _propuesta(client, auth_headers_for(dueño_b), cotizacion_id, precio=1000)

        propuestas = client.get(f"/cotizaciones/{cotizacion_id}/propuestas", headers=headers).json()
        assert [p["empresa"]["nombre_empresa"] for p in propuestas] == ["Primera", "Segunda"]
        empresa = propuestas[0]["empresa"]
        assert set(empresa) >= {"calificacion_promedio", "total_resenas", "pedidos_entregados", "pedidos_en_curso", "verificado"}
        assert propuestas[0]["fecha_envio"]


class TestConfiguracion:
    def test_admin_cambia_modo_cupo_y_trm_de_respaldo(self, client, db_session, modo, admin):
        _, admin_headers = admin
        r = client.put("/admin/configuracion-operacion/asignacion", json={"modo": "automatica", "cupo_por_solicitud": 5}, headers=admin_headers)
        assert r.status_code == 200, r.text
        assert r.json()["asignacion"] == {"modo": "automatica", "cupo_por_solicitud": 5}

        assert client.put("/admin/configuracion-operacion/asignacion", json={"cupo_por_solicitud": 0}, headers=admin_headers).status_code == 422
        assert client.put("/admin/configuracion-operacion/asignacion", json={"modo": "otro"}, headers=admin_headers).status_code == 422

        r = client.put("/admin/configuracion-operacion/trm", json={"respaldo": 4123.5}, headers=admin_headers)
        assert r.status_code == 200, r.text
        assert r.json()["respaldo_admin"] == 4123.5
        assert client.put("/admin/configuracion-operacion/trm", json={"respaldo": 3}, headers=admin_headers).status_code == 422

        r = client.get("/admin/configuracion-operacion", headers=admin_headers)
        assert r.json()["trm"]["respaldo_admin"] == 4123.5
        assert r.json()["trm"]["fuente"] in ("respaldo_admin", "oficial", "ultima_oficial")


def test_trm_vigente_para_cualquier_usuario(client, db_session):
    _, headers = crear_usuario_con_token(db_session, rol="solicitante")
    r = client.get("/trm", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json()["valor"] > 0 and r.json()["fuente"]
    assert client.get("/trm").status_code in (401, 403)
