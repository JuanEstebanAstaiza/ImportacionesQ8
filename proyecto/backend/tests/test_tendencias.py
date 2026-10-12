"""Tendencias: acceso por suscripción, cortesía, acceso libre y aprobadores.

El feed de productos virales (v2) se prueba en test_tendencias_virales.py. El
cálculo de fechas se conserva porque lo usan las migraciones y el sembrado.
"""
import hashlib
from datetime import date, datetime, timedelta

import pytest

import config
from conftest import crear_usuario_con_token
from models.pago import EstadoPago, Pago
from services import configuracion
from services import tendencias as svc
from services.tendencias_calculo import (
    Cierre, Parametros, calcular_fechas, estado_producto, fecha_en_bodega,
)


def firmar_evento(data: dict, timestamp: int, properties: list, secret: str) -> str:
    valores = "".join(str(data.get(prop)) for prop in properties)
    return hashlib.sha256(f"{valores}{timestamp}{secret}".encode("utf-8")).hexdigest()


def _admin(db_session):
    return crear_usuario_con_token(db_session, rol="admin")


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


# ── Suscripción y cortesía ───────────────────────────────────────────────────

def test_cortesia_del_admin_da_acceso_por_los_dias_indicados(client, db_session):
    _, admin = _admin(db_session)
    usuario, comprador = crear_usuario_con_token(db_session)

    r = client.post("/tendencias/admin/accesos", json={"email": usuario.email, "dias": 15}, headers=admin)
    assert r.status_code == 201, r.text
    assert r.json()["origen"] == "cortesia"
    assert client.get("/tendencias/acceso", headers=comprador).json()["tiene_acceso"] is True

    acceso = client.get("/tendencias/acceso", headers=comprador).json()
    hasta = datetime.fromisoformat(acceso["vigente_hasta"].rstrip("Z"))
    assert timedelta(days=14) < hasta - datetime.utcnow() <= timedelta(days=15)

    client.post(f"/tendencias/admin/accesos/{r.json()['id']}/revocar", headers=admin)
    assert client.get("/tendencias/acceso", headers=comprador).json()["tiene_acceso"] is False


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
    r = client.put("/tendencias/admin/suscripcion", json={"precio_cop": 49000, "dias_suscripcion": 30},
                   headers=admin)
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


# ── Acceso libre temporal ────────────────────────────────────────────────────

def test_acceso_libre_abre_tendencias_a_todos_hasta_que_vence(client, db_session):
    _, admin = _admin(db_session)
    _, comprador = crear_usuario_con_token(db_session)
    assert client.get("/tendencias/acceso", headers=comprador).json()["tiene_acceso"] is False

    r = client.put("/tendencias/admin/acceso-libre", json={"dias": 15}, headers=admin)
    assert r.status_code == 200, r.text
    acceso = client.get("/tendencias/acceso", headers=comprador).json()
    assert acceso["tiene_acceso"] is True and acceso["origen"] == "libre"
    assert acceso["vigente_hasta"] == acceso["acceso_libre_hasta"]

    # Vencido, vuelve a ser solo para suscriptores.
    assert svc.tiene_acceso(db_session, None) is False
    from models.usuario import Usuario
    usuario = db_session.query(Usuario).filter(Usuario.rol == "solicitante").first()
    assert svc.tiene_acceso(db_session, usuario, ahora=datetime.utcnow() + timedelta(days=16)) is False
    # La configuración no se limpia entre tests: se cierra para no afectar a otros.
    client.put("/tendencias/admin/acceso-libre", json={}, headers=admin)


def test_acceso_libre_hasta_una_fecha_y_cierre_manual(client, db_session):
    _, admin = _admin(db_session)
    _, comprador = crear_usuario_con_token(db_session)
    fin = (datetime.utcnow() + timedelta(days=3)).replace(microsecond=0).isoformat()
    assert client.put("/tendencias/admin/acceso-libre", json={"hasta": fin}, headers=admin).status_code == 200
    assert client.get("/tendencias/admin/suscripcion", headers=admin).json()["acceso_libre_hasta"]
    assert client.get("/tendencias/acceso", headers=comprador).json()["tiene_acceso"] is True

    assert client.put("/tendencias/admin/acceso-libre", json={}, headers=admin).json() == {"acceso_libre_hasta": None}
    assert client.get("/tendencias/acceso", headers=comprador).json()["tiene_acceso"] is False


def test_acceso_libre_validaciones_y_permisos(client, db_session):
    _, admin = _admin(db_session)
    _, comprador = crear_usuario_con_token(db_session)
    pasado = (datetime.utcnow() - timedelta(days=1)).isoformat()
    assert client.put("/tendencias/admin/acceso-libre", json={"hasta": pasado}, headers=admin).status_code == 400
    assert client.put("/tendencias/admin/acceso-libre", json={"dias": 0}, headers=admin).status_code == 422
    assert client.put("/tendencias/admin/acceso-libre", json={"dias": 5, "hasta": pasado}, headers=admin).status_code == 422
    assert client.put("/tendencias/admin/acceso-libre", json={"dias": 5}, headers=comprador).status_code == 403
    client.put("/tendencias/admin/acceso-libre", json={}, headers=admin)


def test_asignar_aprobador(client, db_session):
    usuario, _ = crear_usuario_con_token(db_session, rol="soporte")
    _, admin = _admin(db_session)
    r = client.put(f"/tendencias/admin/curadores?email={usuario.email}", json={"es_curador": True}, headers=admin)
    assert r.status_code == 200 and r.json()["es_curador"] is True
    assert [c["email"] for c in client.get("/tendencias/admin/curadores", headers=admin).json()] == [usuario.email]
    db_session.refresh(usuario)
    assert svc.puede_curar(usuario) is True
