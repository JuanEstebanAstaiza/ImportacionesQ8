"""Reto comunitario: cupos, inscripción, aprobados, reclamo, datos bancarios y pago."""
from datetime import datetime, timedelta

import pytest

from conftest import crear_usuario_con_token
from models.notificacion import Notificacion
from models.reto import CuentaPago, RetoListaEspera, RetoParticipacion, RetoRonda
from models.tendencias_virales import TendenciaItem
from services import enlaces_video as ev
from services import reto as svc


@pytest.fixture(autouse=True)
def oembed_simulado(monkeypatch):
    monkeypatch.setattr(ev, "consultar_oembed", lambda enlace, cliente=None: enlace)


def _ronda(client, admin, **extra):
    fin = (datetime.utcnow() + timedelta(days=14)).replace(microsecond=0).isoformat()
    r = client.post("/reto/rondas", json={"nombre": "Ronda 1", "max_participantes": 2, "fecha_limite": fin, **extra},
                    headers=admin)
    assert r.status_code == 201, r.text
    return r.json()


def _eventos(db_session, usuario_id):
    return [n.data.get("evento") for n in db_session.query(Notificacion).filter(
        Notificacion.usuario_id == usuario_id, Notificacion.tipo == "reto").all()]


def test_cupos_en_vivo_y_ronda_llena_abre_la_siguiente(client, db_session):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    ronda = _ronda(client, admin)
    assert client.get("/reto/rondas/abierta").json()["ronda"]["cupos_restantes"] == 2  # público

    _, a = crear_usuario_con_token(db_session)
    _, b = crear_usuario_con_token(db_session)
    _, c = crear_usuario_con_token(db_session)
    assert client.post(f"/reto/rondas/{ronda['id']}/inscribirme", headers=a).status_code == 201
    # Inscribirse dos veces no ocupa otro cupo.
    client.post(f"/reto/rondas/{ronda['id']}/inscribirme", headers=a)
    assert client.get("/reto/rondas/abierta").json()["ronda"]["cupos_restantes"] == 1
    assert client.post(f"/reto/rondas/{ronda['id']}/inscribirme", headers=b).status_code == 201

    # Llena: no admite más y se abrió la siguiente con los mismos parámetros.
    r = client.post(f"/reto/rondas/{ronda['id']}/inscribirme", headers=c)
    assert r.status_code == 409
    assert db_session.query(RetoParticipacion).filter(RetoParticipacion.ronda_id == ronda["id"]).count() == 2
    abierta = client.get("/reto/rondas/abierta").json()["ronda"]
    assert abierta["id"] != ronda["id"] and abierta["max_participantes"] == 2 and abierta["cupos_restantes"] == 2


def test_lista_de_espera_recibe_aviso_de_la_nueva_ronda(client, db_session, monkeypatch):
    enviados = []
    import utils.email as correo
    monkeypatch.setattr(correo, "enviar_correo_notificacion", lambda d, t, m="", e="": enviados.append(d) or True)
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    assert client.post("/reto/lista-espera", json={"email": "Espera@Example.com"}).status_code == 204
    _ronda(client, admin)
    assert enviados == ["espera@example.com"]
    assert db_session.query(RetoListaEspera).one().avisado_en is not None


def test_diez_aprobados_dejan_la_recompensa_reclamable(client, db_session):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    ronda = _ronda(client, admin, max_participantes=20)
    usuario, participante = crear_usuario_con_token(db_session)
    client.post(f"/reto/rondas/{ronda['id']}/inscribirme", headers=participante)

    for i in range(10):
        r = client.post("/tendencias/enviar", json={"url": f"https://youtu.be/video{i:06d}"}, headers=participante)
        assert r.status_code == 200, r.text
        assert r.json()["reto"]["aprobados"] == 0
    items = db_session.query(TendenciaItem).filter(TendenciaItem.enviado_por == usuario.id).all()
    assert all(i.participacion_id for i in items)
    for item in items:
        client.patch(f"/tendencias/items/{item.id}", json={"nombre": "Producto", "categoria": "Hogar"}, headers=admin)
        assert client.post(f"/tendencias/items/{item.id}/aprobar", json={"sin_portada": True}, headers=admin).status_code == 200

    mia = client.get("/reto/mi-participacion", headers=participante).json()["participacion"]
    assert mia["aprobados"] == 10 and mia["estado_recompensa"] == "reclamable"
    eventos = _eventos(db_session, usuario.id)
    assert eventos.count("faltan_pocos") == 1 and eventos.count("recompensa_lista") == 1


def _con_recompensa(client, db_session, admin):
    ronda = _ronda(client, admin, max_participantes=20, umbral_aprobados=1)
    usuario, participante = crear_usuario_con_token(db_session)
    client.post(f"/reto/rondas/{ronda['id']}/inscribirme", headers=participante)
    item_id = client.post("/tendencias/enviar", json={"url": "https://youtu.be/dQw4w9WgXcQ"}, headers=participante).json()["id"]
    client.patch(f"/tendencias/items/{item_id}", json={"nombre": "P", "categoria": "Hogar"}, headers=admin)
    client.post(f"/tendencias/items/{item_id}/aprobar", json={"sin_portada": True}, headers=admin)
    participacion = client.get("/reto/mi-participacion", headers=participante).json()["participacion"]
    return usuario, participante, participacion


def test_reclamar_cotizaciones_acredita_el_saldo(client, db_session):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    usuario, participante, p = _con_recompensa(client, db_session, admin)
    r = client.post(f"/reto/participaciones/{p['id']}/reclamar", json={"eleccion": "cotizaciones"}, headers=participante)
    assert r.status_code == 200 and r.json()["estado_recompensa"] == "pagada"
    db_session.refresh(usuario)
    assert usuario.cotizaciones_gratis == 5
    assert client.get("/usuarios/me", headers=participante).json()["cotizaciones_gratis"] == 5
    # No se puede reclamar dos veces.
    assert client.post(f"/reto/participaciones/{p['id']}/reclamar", json={"eleccion": "efectivo"},
                       headers=participante).status_code == 409


def test_efectivo_con_cuenta_cifrada_y_pago_del_admin(client, db_session):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    usuario, participante, p = _con_recompensa(client, db_session, admin)
    _, otro = crear_usuario_con_token(db_session)

    cuenta = {"banco": "Bancolombia", "tipo_cuenta": "ahorros", "numero_cuenta": "123-456-789012",
              "titular": "Paula Restrepo", "documento_titular": "1020304050"}
    # Los datos se piden solo después de elegir efectivo.
    assert client.put(f"/reto/participaciones/{p['id']}/cuenta-pago", json=cuenta, headers=participante).status_code == 409
    client.post(f"/reto/participaciones/{p['id']}/reclamar", json={"eleccion": "efectivo"}, headers=participante)
    assert client.put(f"/reto/participaciones/{p['id']}/cuenta-pago", json=cuenta, headers=otro).status_code == 404
    r = client.put(f"/reto/participaciones/{p['id']}/cuenta-pago", json=cuenta, headers=participante)
    assert r.status_code == 200, r.text
    assert r.json()["cuenta"] == {"banco": "Bancolombia", "tipo_cuenta": "ahorros", "ultimos_digitos": "9012"}
    assert "123456789012" not in r.text and "1020304050" not in r.text

    guardada = db_session.query(CuentaPago).filter(CuentaPago.usuario_id == usuario.id).one()
    assert "123456789012" not in guardada.numero_cifrado and "1020304050" not in guardada.documento_cifrado

    ronda_id = p["ronda"]["id"]
    assert client.get(f"/reto/rondas/{ronda_id}/participantes", headers=participante).status_code == 403
    filas = client.get(f"/reto/rondas/{ronda_id}/participantes", headers=admin).json()
    assert filas[0]["cuenta"]["numero"] == "123456789012" and filas[0]["cuenta"]["documento"] == "1020304050"

    r = client.patch(f"/reto/participaciones/{p['id']}/pagado", json={"referencia": "TRX-998877"}, headers=admin)
    assert r.status_code == 200
    final = client.get("/reto/mi-participacion", headers=participante).json()
    assert final["participacion"] is None or final["participacion"]["estado_recompensa"] == "pagada"
    pago = db_session.query(Notificacion).filter(Notificacion.usuario_id == usuario.id,
                                                 Notificacion.titulo == "Te transferimos tu recompensa").one()
    assert "9012" in pago.mensaje and "TRX-998877" in pago.mensaje and "$50.000" in pago.mensaje

    rondas = client.get("/reto/rondas", headers=admin).json()
    # Presupuesto dinámico: inscritos × recompensa; el máximo, cupos × recompensa.
    assert rondas[0]["presupuesto_cop"] == 50000 and rondas[0]["presupuesto_maximo_cop"] == 20 * 50000
    assert rondas[0]["pagado_cop"] == 50000 and rondas[0]["por_pagar_cop"] == 0


def test_tarea_diaria_cierra_vencidas_y_avisa_inactivos(client, db_session):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    ronda = _ronda(client, admin, max_participantes=20)
    usuario, participante = crear_usuario_con_token(db_session)
    client.post(f"/reto/rondas/{ronda['id']}/inscribirme", headers=participante)

    ahora = datetime.utcnow() + timedelta(days=8)
    assert svc.avisar_inactivos(db_session, ahora=ahora) == 1
    assert svc.avisar_inactivos(db_session, ahora=ahora + timedelta(hours=1)) == 0  # no repite
    assert "inactivo" in _eventos(db_session, usuario.id)

    assert svc.cerrar_vencidas(db_session, ahora=datetime.utcnow() + timedelta(days=15)) == 1
    assert db_session.query(RetoRonda).filter(RetoRonda.id == ronda["id"]).one().estado == "cerrada"


def test_solo_una_ronda_abierta_y_validaciones(client, db_session):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    _, comprador = crear_usuario_con_token(db_session)
    _ronda(client, admin)
    fin = (datetime.utcnow() + timedelta(days=3)).isoformat()
    assert client.post("/reto/rondas", json={"nombre": "Otra", "fecha_limite": fin}, headers=admin).status_code == 409
    assert client.post("/reto/rondas", json={"nombre": "X", "fecha_limite": fin}, headers=comprador).status_code == 403
