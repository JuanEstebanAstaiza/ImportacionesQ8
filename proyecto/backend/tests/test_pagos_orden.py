"""Pago del cliente a la empresa por cada orden (services/pagos_orden.py).

La orden nace como «orden generada · pago pendiente»; el cliente sube el
comprobante a la carpeta de pagos de la operación y, hasta que la empresa lo
confirma, la orden no pasa a producción.
"""
from datetime import datetime
from uuid import uuid4

import pytest

from conftest import auth_headers_for, crear_empresa_importadora
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.documental import Archivo, Carpeta
from models.notificacion import Notificacion
from models.orden import EstadoOrden, Orden
from models.usuario import Usuario
from utils.security import hash_password


@pytest.fixture()
def escenario(db_session):
    cliente = Usuario(
        id=str(uuid4()), email="cliente_pago@example.com", password_hash=hash_password("123456789"),
        rol="solicitante", perfil_completo=True, fecha_creacion=datetime.utcnow(),
    )
    db_session.add(cliente)
    empresa, dueño = crear_empresa_importadora(db_session, nombre_empresa="Pagos SAS", email_dueño="dueno_pago@example.com")
    asesor = Usuario(
        id=str(uuid4()), email="asesor_pago@example.com", password_hash=hash_password("123456789"),
        rol="asesor", importador_id=empresa.id, perfil_completo=True, fecha_creacion=datetime.utcnow(),
    )
    db_session.add(asesor)
    cotizacion = Cotizacion(
        id=str(uuid4()), solicitante_id=cliente.id, importador_id=empresa.id, modalidad="dirigida",
        pais_importacion="China", nombre_producto="Termos de acero", descripcion_cliente="Termos de acero de 500 ml",
        linea_producto="Hogar", tipo_calidad="estandar", cantidad_minima=500, precio_objetivo_usd=3.5,
        incoterm="FOB", estado=EstadoCotizacion.orden_activa,
    )
    db_session.add(cotizacion)
    db_session.flush()
    orden = Orden(
        id=str(uuid4()), cotizacion_id=cotizacion.id, importador_id=empresa.id, solicitante_id=cliente.id,
        estado=EstadoOrden.cotizacion_aceptada.value, precio_acordado_usd=1750.0,
    )
    db_session.add(orden)
    db_session.commit()
    return {"cliente": cliente, "dueño": dueño, "asesor": asesor, "orden": orden}


def _archivo(db_session, dueño_id, nombre="transferencia.pdf"):
    archivo = Archivo(
        owner_user_id=dueño_id, nombre=nombre, extension="pdf", mime_type="application/pdf",
        tipo_recurso="documento", origen="comprobante-pago",
    )
    db_session.add(archivo)
    db_session.commit()
    return archivo


def test_sin_pago_confirmado_la_orden_no_pasa_a_produccion(client, db_session, escenario):
    orden, cliente, dueño = escenario["orden"], escenario["cliente"], escenario["dueño"]
    h_cliente, h_dueño = auth_headers_for(cliente), auth_headers_for(dueño)

    # El cliente tiene su carpeta de pagos de la operación.
    r = client.get(f"/ordenes/{orden.id}/pagos", headers=h_cliente)
    assert r.status_code == 200, r.text
    pagos = r.json()
    assert pagos["pago_confirmado"] is False and pagos["puede_subir"] is True and pagos["puede_revisar"] is False
    carpeta = db_session.query(Carpeta).filter(Carpeta.id == pagos["carpeta_id"]).one()
    assert carpeta.owner_user_id == cliente.id
    assert carpeta.nombre == f"ORD-{orden.id[:8].upper()} · Termos de acero"
    assert carpeta.parent.nombre == "Operaciones" and carpeta.parent.parent.nombre == "Pagos"

    r = client.put(f"/ordenes/{orden.id}/estado", json={"estado": "en_produccion"}, headers=h_dueño)
    assert r.status_code == 409 and "confirma el pago" in r.text

    # Envía el comprobante: queda en la carpeta y la empresa recibe el aviso.
    archivo = _archivo(db_session, cliente.id)
    r = client.post(f"/ordenes/{orden.id}/pagos", json={"archivo_id": archivo.id, "monto_cop": 7000000}, headers=h_cliente)
    assert r.status_code == 201, r.text
    comprobante = r.json()
    assert comprobante["estado"] == "pendiente"
    db_session.refresh(archivo)
    assert archivo.carpeta_id == carpeta.id
    aviso = db_session.query(Notificacion).filter(Notificacion.usuario_id == dueño.id).all()
    assert any("Comprobante de pago por confirmar" in n.titulo for n in aviso)

    # Mientras la empresa revisa no se manda otro.
    otro = _archivo(db_session, cliente.id, "otra.pdf")
    assert client.post(f"/ordenes/{orden.id}/pagos", json={"archivo_id": otro.id}, headers=h_cliente).status_code == 409

    # La empresa lo ve y lo puede revisar; la descarga del archivo le está permitida.
    r = client.get(f"/ordenes/{orden.id}/pagos", headers=h_dueño)
    assert r.json()["puede_revisar"] is True and r.json()["carpeta_id"] is None
    from services import pagos_orden

    assert pagos_orden.puede_ver_archivo(db_session, archivo.id, dueño.id, "importador", dueño.importador_id)
    assert not pagos_orden.puede_ver_archivo(db_session, archivo.id, str(uuid4()), "importador", str(uuid4()))

    r = client.post(f"/ordenes/{orden.id}/pagos/{comprobante['id']}/confirmar", headers=h_dueño)
    assert r.status_code == 200 and r.json()["estado"] == "confirmado"
    assert client.get(f"/ordenes/{orden.id}/pagos", headers=h_cliente).json()["pago_confirmado"] is True

    # Confirmado el pago, ya no se suben más comprobantes y la orden pasa a producción.
    assert client.post(f"/ordenes/{orden.id}/pagos", json={"archivo_id": otro.id}, headers=h_cliente).status_code == 409
    r = client.put(f"/ordenes/{orden.id}/estado", json={"estado": "en_produccion"}, headers=h_dueño)
    assert r.status_code == 200, r.text
    db_session.refresh(orden)
    assert orden.estado == EstadoOrden.en_produccion.value


def test_la_empresa_rechaza_el_comprobante_y_el_cliente_envia_otro(client, db_session, escenario):
    orden, cliente, dueño = escenario["orden"], escenario["cliente"], escenario["dueño"]
    h_cliente, h_dueño = auth_headers_for(cliente), auth_headers_for(dueño)

    primero = _archivo(db_session, cliente.id)
    c = client.post(f"/ordenes/{orden.id}/pagos", json={"archivo_id": primero.id}, headers=h_cliente).json()

    assert client.post(f"/ordenes/{orden.id}/pagos/{c['id']}/rechazar", json={"motivo": "no"}, headers=h_dueño).status_code == 422
    r = client.post(f"/ordenes/{orden.id}/pagos/{c['id']}/rechazar",
                    json={"motivo": "El valor no coincide con el total acordado."}, headers=h_dueño)
    assert r.status_code == 200 and r.json()["estado"] == "rechazado"
    avisos = db_session.query(Notificacion).filter(Notificacion.usuario_id == cliente.id).all()
    assert any("El valor no coincide" in (n.mensaje or "") for n in avisos)

    # Un comprobante revisado no se vuelve a revisar, y el rechazado no cuenta como pago.
    assert client.post(f"/ordenes/{orden.id}/pagos/{c['id']}/confirmar", headers=h_dueño).status_code == 409
    assert client.put(f"/ordenes/{orden.id}/estado", json={"estado": "en_produccion"}, headers=h_dueño).status_code == 409

    segundo = _archivo(db_session, cliente.id, "transferencia-2.pdf")
    r = client.post(f"/ordenes/{orden.id}/pagos", json={"archivo_id": segundo.id}, headers=h_cliente)
    assert r.status_code == 201
    pagos = client.get(f"/ordenes/{orden.id}/pagos", headers=h_cliente).json()
    assert [x["estado"] for x in pagos["comprobantes"]] == ["pendiente", "rechazado"]


def test_solo_el_cliente_envia_y_solo_la_empresa_confirma(client, db_session, escenario):
    orden, cliente, dueño, asesor = escenario["orden"], escenario["cliente"], escenario["dueño"], escenario["asesor"]

    # El archivo tiene que ser del cliente.
    ajeno = _archivo(db_session, dueño.id)
    assert client.post(f"/ordenes/{orden.id}/pagos", json={"archivo_id": ajeno.id},
                       headers=auth_headers_for(cliente)).status_code == 404

    archivo = _archivo(db_session, cliente.id)
    c = client.post(f"/ordenes/{orden.id}/pagos", json={"archivo_id": archivo.id},
                    headers=auth_headers_for(cliente)).json()

    # La empresa no sube comprobantes; el cliente no se confirma su propio pago.
    assert client.post(f"/ordenes/{orden.id}/pagos", json={"archivo_id": archivo.id},
                       headers=auth_headers_for(dueño)).status_code == 403
    assert client.post(f"/ordenes/{orden.id}/pagos/{c['id']}/confirmar",
                       headers=auth_headers_for(cliente)).status_code == 403

    # Un asesor de la empresa que no lleva la orden no confirma; el asignado sí.
    assert client.post(f"/ordenes/{orden.id}/pagos/{c['id']}/confirmar",
                       headers=auth_headers_for(asesor)).status_code == 403
    orden.asesor_asignado_id = asesor.id
    db_session.commit()
    assert client.post(f"/ordenes/{orden.id}/pagos/{c['id']}/confirmar",
                       headers=auth_headers_for(asesor)).status_code == 200

    # Otro cliente no ve los pagos de la operación.
    intruso = Usuario(
        id=str(uuid4()), email="intruso_pago@example.com", password_hash=hash_password("123456789"),
        rol="solicitante", perfil_completo=True, fecha_creacion=datetime.utcnow(),
    )
    db_session.add(intruso)
    db_session.commit()
    assert client.get(f"/ordenes/{orden.id}/pagos", headers=auth_headers_for(intruso)).status_code == 403
