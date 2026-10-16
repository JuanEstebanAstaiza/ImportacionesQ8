"""Avisos por correo (notificaciones@) de cotizaciones y órdenes, y el rechazo de
una cotización por la empresa con su motivo."""
from datetime import datetime
from uuid import uuid4

import pytest

from conftest import asignar_en_bd, auth_headers_for, crear_empresa_importadora
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.propuesta import EstadoPropuesta, Propuesta
from models.recepcion_cotizacion import RecepcionCotizacion
from models.usuario import Usuario
from utils.security import hash_password


@pytest.fixture
def correos(monkeypatch):
    import utils.email as correo

    enviados = []

    def falso(destinatario, titulo, mensaje="", enlace="", buzon="notificaciones"):
        enviados.append({"para": destinatario, "titulo": titulo, "mensaje": mensaje, "buzon": buzon})
        return True

    monkeypatch.setattr(correo, "enviar_correo_notificacion", falso)
    return enviados


def _usuario(db_session, rol, **extra):
    u = Usuario(id=str(uuid4()), email=f"{rol}_{uuid4().hex[:8]}@example.com", password_hash=hash_password("123456789"),
                rol=rol, activo=True, perfil_completo=True, fecha_creacion=datetime.utcnow(), **extra)
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u


@pytest.fixture
def escenario(db_session):
    solicitante = _usuario(db_session, "solicitante")
    importador, dueño = crear_empresa_importadora(db_session, nombre_empresa="Importa Rechazos",
                                                  email_dueño=f"dueno_{uuid4().hex[:8]}@example.com")
    asesor = _usuario(db_session, "asesor", importador_id=importador.id)
    return solicitante, importador, dueño, asesor


def _cotizacion(db_session, solicitante, *, modalidad="dirigida", importador_id=None, estado=None, asesor_id=None):
    c = Cotizacion(
        id=str(uuid4()), solicitante_id=solicitante.id, importador_id=importador_id, modalidad=modalidad,
        pais_importacion="China", nombre_producto="Termos de acero", descripcion_cliente="Termos de 500 ml",
        linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=100, incoterm="FOB",
        estado=estado or (EstadoCotizacion.dirigida.value if modalidad == "dirigida" else EstadoCotizacion.abierta.value),
        asesor_asignado_id=asesor_id,
    )
    db_session.add(c)
    db_session.commit()
    db_session.refresh(c)
    return c


MOTIVO = "No trabajamos este producto en este momento."


def test_dirigida_rechazada_con_motivo_por_correo(client, db_session, escenario, correos):
    solicitante, importador, dueño, _ = escenario
    c = _cotizacion(db_session, solicitante, importador_id=importador.id)
    borrador = Propuesta(id=str(uuid4()), cotizacion_id=c.id, importador_id=importador.id, precio_ofrecido_usd=3,
                         tiempo_estimado_entrega="30 días", incoterm="FOB", estado=EstadoPropuesta.borrador)
    db_session.add(borrador)
    db_session.commit()

    r = client.post(f"/cotizaciones/{c.id}/rechazar", json={"motivo": MOTIVO}, headers=auth_headers_for(dueño))
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "rechazada" and r.json()["motivo_rechazo"] == MOTIVO
    db_session.refresh(borrador)
    assert borrador.estado in (EstadoPropuesta.rechazada, EstadoPropuesta.rechazada.value)

    aviso = [x for x in correos if x["para"] == solicitante.email]
    assert len(aviso) == 1 and aviso[0]["buzon"] == "notificaciones"
    assert aviso[0]["titulo"] == "Importa Rechazos rechazó tu cotización" and MOTIVO in aviso[0]["mensaje"]

    # El cotizante ve el motivo; ya no se puede rechazar dos veces ni aparece en el pool.
    propia = client.get(f"/cotizaciones/{c.id}", headers=auth_headers_for(solicitante)).json()
    assert propia["estado"] == "rechazada" and propia["motivo_rechazo"] == MOTIVO
    assert client.post(f"/cotizaciones/{c.id}/rechazar", json={"motivo": MOTIVO},
                       headers=auth_headers_for(dueño)).status_code == 409
    pool = client.get("/cotizaciones/pool-empresa", headers=auth_headers_for(dueño)).json()
    assert c.id not in [x["id"] for x in pool]


def test_abierta_rechazada_sale_de_la_bandeja_y_sigue_para_otras(client, db_session, escenario, correos):
    solicitante, importador, dueño, asesor = escenario
    c = _cotizacion(db_session, solicitante, modalidad="abierta")
    asignar_en_bd(db_session, c.id, importador.id)

    r = client.post(f"/cotizaciones/{c.id}/rechazar", json={"motivo": MOTIVO}, headers=auth_headers_for(asesor))
    assert r.status_code == 200, r.text
    db_session.refresh(c)
    assert c.estado == EstadoCotizacion.abierta.value and c.motivo_rechazo is None
    recepcion = db_session.query(RecepcionCotizacion).filter(RecepcionCotizacion.cotizacion_id == c.id).one()
    assert recepcion.rechazada_en is not None and recepcion.motivo_rechazo == MOTIVO and recepcion.rechazada_por == asesor.id

    bandeja = client.get("/cotizaciones", headers=auth_headers_for(dueño)).json()
    assert c.id not in [x["id"] for x in bandeja]
    aviso = [x for x in correos if x["para"] == solicitante.email][0]
    assert aviso["titulo"] == "Importa Rechazos no tomará tu cotización" and "sigue abierta" in aviso["mensaje"]


def test_quien_puede_rechazar(client, db_session, escenario):
    solicitante, importador, dueño, asesor = escenario
    otro_asesor = _usuario(db_session, "asesor", importador_id=importador.id)
    ajena, _ = crear_empresa_importadora(db_session, nombre_empresa="Otra SAS", email_dueño=f"otra_{uuid4().hex[:6]}@example.com")
    c = _cotizacion(db_session, solicitante, importador_id=importador.id, asesor_id=otro_asesor.id)

    # Motivo obligatorio; el cotizante no rechaza; un asesor no rechaza lo que atiende otro.
    assert client.post(f"/cotizaciones/{c.id}/rechazar", json={"motivo": "corto"},
                       headers=auth_headers_for(dueño)).status_code == 422
    assert client.post(f"/cotizaciones/{c.id}/rechazar", json={"motivo": MOTIVO},
                       headers=auth_headers_for(solicitante)).status_code == 403
    assert client.post(f"/cotizaciones/{c.id}/rechazar", json={"motivo": MOTIVO},
                       headers=auth_headers_for(asesor)).status_code == 403
    # Una abierta que no se le asignó a la empresa no existe para ella.
    abierta = _cotizacion(db_session, solicitante, modalidad="abierta")
    dueño_ajeno = db_session.query(Usuario).filter(Usuario.importador_id == ajena.id).first()
    assert client.post(f"/cotizaciones/{abierta.id}/rechazar", json={"motivo": MOTIVO},
                       headers=auth_headers_for(dueño_ajeno)).status_code == 404
    # Con orden ya no.
    con_orden = _cotizacion(db_session, solicitante, importador_id=importador.id, estado=EstadoCotizacion.orden_activa.value)
    assert client.post(f"/cotizaciones/{con_orden.id}/rechazar", json={"motivo": MOTIVO},
                       headers=auth_headers_for(dueño)).status_code == 409


def test_orden_de_compra_y_cambios_de_estado_por_correo(client, db_session, escenario, correos):
    solicitante, importador, dueño, _ = escenario
    c = _cotizacion(db_session, solicitante, importador_id=importador.id, estado=EstadoCotizacion.propuestas_recibidas.value)
    p = Propuesta(id=str(uuid4()), cotizacion_id=c.id, importador_id=importador.id, precio_ofrecido_usd=1250,
                  tiempo_estimado_entrega="30 días", incoterm="FOB", estado=EstadoPropuesta.pendiente)
    db_session.add(p)
    db_session.commit()

    assert client.post(f"/propuestas/{p.id}/pre-aceptar", json={"aceptar": True},
                       headers=auth_headers_for(solicitante)).status_code == 200
    correos.clear()
    # La empresa cierra: al cotizante le llega la orden, no «La empresa confirmó…».
    assert client.post(f"/propuestas/{p.id}/pre-aceptar", json={"aceptar": True},
                       headers=auth_headers_for(dueño)).status_code == 200
    al_cotizante = [x for x in correos if x["para"] == solicitante.email]
    assert [x["titulo"] for x in al_cotizante] == ["Orden generada: pago pendiente"]
    assert "Importa Rechazos" in al_cotizante[0]["mensaje"] and "US$1,250.00" in al_cotizante[0]["mensaje"]
    assert al_cotizante[0]["buzon"] == "notificaciones"

    from models.orden import Orden

    orden = db_session.query(Orden).filter(Orden.cotizacion_id == c.id).one()
    from conftest import confirmar_pago_orden

    confirmar_pago_orden(db_session, orden)
    correos.clear()
    r = client.put(f"/ordenes/{orden.id}/estado", json={"estado": "en_produccion"}, headers=auth_headers_for(dueño))
    assert r.status_code == 200, r.text
    estado = [x for x in correos if x["para"] == solicitante.email]
    assert estado[0]["titulo"] == "Nuevo estado de tu operación: orden en producción" and estado[0]["buzon"] == "notificaciones"
    assert "Termos de acero" in estado[0]["mensaje"] and "«orden generada · pago pendiente»" in estado[0]["mensaje"]


def test_cotizacion_nueva_avisa_a_empresa_y_asesores(db_session, escenario, correos):
    from routers.cotizaciones import _notificar_cotizacion_en_pool

    solicitante, importador, dueño, asesor = escenario
    c = _cotizacion(db_session, solicitante, importador_id=importador.id)
    _notificar_cotizacion_en_pool(db_session, cotizacion=c, importadores=[])
    recibidos = {(x["para"], x["titulo"], x["buzon"]) for x in correos}
    assert recibidos == {
        (dueño.email, "Tienes una nueva solicitud de cotización", "notificaciones"),
        (asesor.email, "Tienes una nueva solicitud de cotización", "notificaciones"),
    }
