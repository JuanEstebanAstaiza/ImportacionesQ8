"""Planes de acceso con pago manual: sección pública, inscripción con
comprobante, cupos y lista de espera, activación desde el admin, cobro con las
solicitudes del plan y devolución de la unidad a las 72 horas sin propuestas."""
import json
from datetime import datetime, timedelta
from uuid import uuid4

import pytest

from conftest import crear_empresa_importadora, crear_usuario_con_token
from models.configuracion import ConfiguracionPlataforma
from models.cotizacion import Cotizacion
from models.password_reset import PasswordResetToken
from models.plan import InscripcionPlan, Plan
from models.propuesta import EstadoPropuesta, Propuesta
from models.usuario import Usuario
from services import planes as planes_svc
from services import tendencias as tendencias_svc
from services import tokens_cotizacion

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
COTIZACION = {"modalidad": "abierta", "pais_importacion": "China", "nombre_producto": "Termo",
              "descripcion_cliente": "Termo de acero 500 ml", "linea_producto": "Hogar",
              "tipo_calidad": "estandar", "cantidad_minima": 100}
PERSONA = {"email": "Ana@Example.com", "tipo_persona": "natural", "nombre": "Ana", "apellido": "Gómez",
           "tipo_documento": "CC", "numero_documento": "123456", "telefono": "3001234567",
           "ciudad": "Cali", "sector": "Textil", "acepto_condiciones": True, "acepto_datos": True}


# Lista de espera: nombre, WhatsApp, correo, sector y qué quiere importar.
ESPERA = {"email": "Luis@Example.com", "nombre": "Luis Pérez", "telefono": "3109876543", "sector": "  Televenta ",
          "interes": "Termos  de acero\npara regalos corporativos", "acepto_datos": True}


@pytest.fixture(autouse=True)
def config_limpia(db_session):
    yield
    for prefijo in ("modulos.%", "lista_espera.%", "inscripcion_plan.%"):
        db_session.query(ConfiguracionPlataforma).filter(ConfiguracionPlataforma.clave.like(prefijo)).delete(
            synchronize_session=False)
    db_session.commit()


@pytest.fixture
def correos(monkeypatch):
    import routers.landing  # noqa: F401 — asegura que utils.email ya esté cargado
    import utils.email as email

    enviados = []

    def falso(destinatario, asunto, texto, html=None, **kw):
        enviados.append({"para": destinatario, "asunto": asunto, "texto": texto, **kw})
        return True

    monkeypatch.setattr(email, "enviar_correo", falso)
    monkeypatch.setattr(email, "enviar_correo_notificacion",
                        lambda d, t, m="", e="", buzon="notificaciones": enviados.append(
                            {"para": d, "asunto": t, "texto": m, "buzon": buzon}) or True)
    return enviados


@pytest.fixture
def planes(db_session):
    importador = Plan(clave="importador", nombre="Paquete Importador", precio_cop=500000, iva_pct=19,
                      solicitudes_incluidas=10, vigencia_meses=12, cupos_totales=2, orden=1,
                      incluye=["10 solicitudes de cotización"], para_quien="Para quien ya sabe qué quiere traer.")
    vip = Plan(clave="vip", nombre="Plan VIP", precio_cop=2000000, iva_pct=19, solicitudes_incluidas=10,
               vigencia_meses=12, dias_tendencias=180, precio_solicitud_adicional_cop=25000, destacado=True,
               orden=2)
    oculto = Plan(clave="viejo", nombre="Plan viejo", precio_cop=1, activo=False)
    db_session.add_all([importador, vip, oculto])
    db_session.commit()
    return {"importador": importador, "vip": vip}


def _inscribir(client, clave="importador", persona=None, archivo=PNG, nombre="pago.png", headers=None):
    return client.post(f"/planes/{clave}/inscripcion", headers=headers or {},
                       data={"datos": json.dumps(persona or PERSONA)},
                       files={"comprobante": (nombre, archivo, "image/png")})


def _modulo(client, admin, **valores):
    assert client.put("/admin/modulos", json=valores, headers=admin).status_code == 200


def test_la_seccion_publica_lee_los_planes_del_admin(client, planes):
    r = client.get("/planes")
    assert r.status_code == 200
    datos = r.json()["planes"]
    assert [p["clave"] for p in datos] == ["importador", "vip"]  # el inactivo no sale
    importador, vip = datos
    assert importador["total_cop"] == 595000 and importador["iva_cop"] == 95000
    assert importador["cupos_restantes"] == 2
    assert vip["total_cop"] == 2380000 and vip["cupos_restantes"] is None  # sin límite
    assert vip["total_solicitud_adicional_cop"] == 29750 and vip["destacado"] is True


def test_inscripcion_sin_sesion_con_comprobante_llega_a_pagos(client, db_session, planes, correos):
    _, admin_h = crear_usuario_con_token(db_session, rol="admin")
    r = _inscribir(client)
    assert r.status_code == 201, r.text
    assert r.json()["total_cop"] == 595000
    ins = db_session.query(InscripcionPlan).one()
    assert ins.email == "ana@example.com" and ins.estado == "pendiente"
    assert planes_svc.ruta_comprobante(ins).read_bytes() == PNG

    a_pagos = next(c for c in correos if c["para"] == "pagos@zarpi.co")
    assert a_pagos["responder_a"] == "ana@example.com"
    nombres = [a[0] for a in a_pagos["adjuntos"]]
    assert "pago.png" in nombres and any(n.endswith(".pdf") for n in nombres)
    assert "Sector: Textil" in a_pagos["texto"]
    assert any(c["para"] == "ana@example.com" for c in correos)  # acuse

    # Los cupos disponibles son los que puso el admin: inscribirse no los descuenta.
    importador = client.get("/planes").json()["planes"][0]
    assert importador["cupos_restantes"] == 2
    assert "cupos_por_activar" not in importador and "cupos_activos" not in importador
    # No se puede mandar dos veces la misma.
    assert _inscribir(client).status_code == 409

    # Solo el admin descarga el comprobante.
    url = f"/planes/admin/inscripciones/{ins.id}/comprobante"
    assert client.get(url).status_code in (401, 403)
    assert client.get(url, headers=admin_h).content == PNG
    fila = client.get("/planes/admin/inscripciones?estado=pendiente", headers=admin_h).json()[0]
    assert fila["sector"] == "Textil" and fila["interes"] is None


def test_valida_datos_y_archivo(client, planes, correos):
    assert _inscribir(client, persona={**PERSONA, "acepto_condiciones": False}).status_code == 422
    assert _inscribir(client, persona={**PERSONA, "numero_documento": ""}).status_code == 422
    juridica = {**PERSONA, "tipo_persona": "juridica", "razon_social": "Importa SAS", "nit": "900123"}
    assert _inscribir(client, persona=juridica, archivo=b"%PDF-1.4 x", nombre="pago.pdf").status_code == 201
    assert _inscribir(client, persona={**PERSONA, "email": "b@x.com"}, nombre="pago.exe").status_code == 422
    # Dice ser PNG pero no lo es.
    assert _inscribir(client, persona={**PERSONA, "email": "c@x.com"}, archivo=b"hola").status_code == 422
    assert _inscribir(client, clave="viejo").status_code == 404
    assert _inscribir(client, persona={**PERSONA, "email": "d@x.com", "sector": " "}).status_code == 422


def test_el_admin_cambia_a_mano_los_cupos_disponibles(client, db_session, planes, correos):
    _, admin_h = crear_usuario_con_token(db_session, rol="admin")
    url = f"/planes/admin/planes/{planes['importador'].id}"

    def disponibles():
        return client.get("/planes").json()["planes"][0]["cupos_restantes"]

    # Hoy quedan 19, mañana 1, luego 10: es el número que escribe el admin.
    for cupos in (19, 1, 10):
        assert client.put(url, json={"cupos_totales": cupos}, headers=admin_h).status_code == 200
        assert disponibles() == cupos

    # En 0, la inscripción pasa a la lista de espera.
    assert client.put(url, json={"cupos_totales": 0}, headers=admin_h).status_code == 200
    lleno = _inscribir(client)
    assert lleno.status_code == 409 and lleno.json()["detail"]["codigo"] == "sin_cupos"
    espera = client.post("/planes/importador/lista-espera", json={**ESPERA, "email": "ana@example.com"})
    assert espera.status_code == 201
    assert client.post("/planes/importador/lista-espera", json={**ESPERA, "email": "ana@example.com"}).status_code == 409

    # Al volver a abrir cupos, se puede inscribir.
    assert client.put(url, json={"cupos_totales": 10}, headers=admin_h).status_code == 200
    assert _inscribir(client).status_code == 201
    assert disponibles() == 10

    # El rechazo le llega con el motivo.
    pendiente = client.get("/planes/admin/inscripciones?estado=pendiente", headers=admin_h).json()
    r = client.post(f"/planes/admin/inscripciones/{pendiente[0]['id']}/rechazar",
                    json={"motivo": "La transferencia no aparece"}, headers=admin_h)
    assert r.status_code == 200 and r.json()["estado"] == "rechazada"
    assert any("no aparece" in c["texto"] for c in correos if c["para"] == "ana@example.com")


def test_avisame_cuando_abra_deja_en_lista_de_espera_con_lo_que_quiere_importar(client, db_session, planes, correos):
    _, admin_h = crear_usuario_con_token(db_session, rol="admin")
    r = client.post("/planes/lista-espera", json=ESPERA)
    assert r.status_code == 201, r.text
    assert r.json()["estado"] == "lista_espera"
    # No ocupa cupo y no se repite.
    assert client.get("/planes").json()["planes"][0]["cupos_restantes"] == 2
    assert client.post("/planes/lista-espera", json=ESPERA).status_code == 409

    # Solo pide nombre, WhatsApp, correo, sector, qué quiere importar y la autorización de datos.
    assert client.post("/planes/lista-espera", json={**ESPERA, "email": "b@x.com", "sector": ""}).status_code == 422
    assert client.post("/planes/lista-espera", json={**ESPERA, "email": "b@x.com", "interes": ""}).status_code == 422
    assert client.post("/planes/lista-espera", json={**ESPERA, "email": "b@x.com", "acepto_datos": False}).status_code == 422
    assert client.post("/planes/lista-espera", json={**ESPERA, "email": "b@x.com", "telefono": "123"}).status_code == 422

    # Llega a la pestaña «Lista de espera» del admin, con fecha.
    filas = client.get("/planes/admin/inscripciones?estado=lista_espera", headers=admin_h).json()
    assert len(filas) == 1
    fila = filas[0]
    assert fila["email"] == "luis@example.com" and fila["nombre"] == "Luis Pérez"
    assert fila["telefono"] == "+57 3109876543" and fila["fecha"]
    assert fila["interes"] == "Termos de acero para regalos corporativos"
    assert fila["sector"] == "Televenta"
    assert fila["origen_espera"] == "apertura"
    acuse = next(c for c in correos if c["para"] == "luis@example.com")
    assert "abramos al público" in acuse["texto"]


def test_activar_crea_la_cuenta_y_acredita_el_plan(client, db_session, planes, correos):
    admin, admin_h = crear_usuario_con_token(db_session, rol="admin")
    assert _inscribir(client, clave="vip").status_code == 201
    ins = db_session.query(InscripcionPlan).one()

    r = client.post(f"/planes/admin/inscripciones/{ins.id}/activar", headers=admin_h)
    assert r.status_code == 200, r.text
    usuario = db_session.query(Usuario).filter(Usuario.email == "ana@example.com").one()
    assert usuario.rol == "solicitante" and usuario.email_verificado
    assert usuario.solicitudes_plan == 10 and usuario.plan_id == planes["vip"].id
    assert 360 <= (usuario.plan_vence_en - datetime.utcnow()).days <= 366
    assert tendencias_svc.acceso_hasta(db_session, usuario.id) is not None  # VIP: Tendencias
    # Enlace para crear la contraseña, con días de vigencia.
    token = db_session.query(PasswordResetToken).filter(PasswordResetToken.usuario_id == usuario.id).one()
    assert (token.expira_en - datetime.utcnow()).days >= 6
    bienvenida = next(c for c in correos if c["para"] == "ana@example.com" and "activo" in c["asunto"])
    assert "restablecer-password?token=" in bienvenida["texto"]

    assert client.post(f"/planes/admin/inscripciones/{ins.id}/activar", headers=admin_h).status_code == 409
    # Con sesión: el resumen de pagos muestra el plan y el precio VIP de la solicitud adicional.
    from utils.security import create_access_token
    h = {"Authorization": f"Bearer {create_access_token(usuario.id, 'solicitante')}"}
    resumen = client.get("/comprobantes/resumen", headers=h).json()
    assert resumen["plan"]["solicitudes"] == 10 and resumen["plan"]["nombre"] == "Plan VIP"
    assert resumen["precio_token_cop"] == 29750


def test_renovar_suma_lo_que_quedaba_y_cuenta_existente_no_se_duplica(client, db_session, planes, correos):
    _, admin_h = crear_usuario_con_token(db_session, rol="admin")
    usuario, headers = crear_usuario_con_token(db_session, email="ana@example.com")
    usuario.plan_id, usuario.solicitudes_plan = planes["importador"].id, 3
    usuario.plan_vence_en = datetime.utcnow() + timedelta(days=30)
    db_session.commit()
    assert _inscribir(client, headers=headers).status_code == 201
    ins = db_session.query(InscripcionPlan).one()
    assert ins.usuario_id == usuario.id
    assert client.post(f"/planes/admin/inscripciones/{ins.id}/activar", headers=admin_h).status_code == 200
    db_session.refresh(usuario)
    assert usuario.solicitudes_plan == 13
    assert (usuario.plan_vence_en - datetime.utcnow()).days >= 390
    assert db_session.query(Usuario).filter(Usuario.email == "ana@example.com").count() == 1
    # Las cuentas que no son de comprador no compran planes.
    _, importador_h = crear_usuario_con_token(db_session, rol="importador")
    assert _inscribir(client, persona={**PERSONA, "email": "otra@x.com"}, headers=importador_h).status_code == 403


def test_otorgar_plan_a_comprador_que_ya_tiene_cuenta(client, db_session, planes):
    _, admin_h = crear_usuario_con_token(db_session, rol="admin")
    cliente, _ = crear_usuario_con_token(db_session, email="cliente@q8demo.com")
    r = client.post("/planes/admin/otorgar", headers=admin_h,
                    json={"usuario_id": cliente.id, "plan_id": planes["importador"].id})
    assert r.status_code == 201, r.text
    assert r.json()["email"] == "cliente@q8demo.com" and r.json()["estado"] == "activa"
    db_session.refresh(cliente)
    assert cliente.plan_id == planes["importador"].id and cliente.solicitudes_plan == 10
    assert db_session.query(Usuario).filter(Usuario.email == "cliente@q8demo.com").count() == 1
    # Una empresa no se puede elegir como comprador del plan.
    empresa, _ = crear_usuario_con_token(db_session, rol="importador", email="empresa@q8demo.com")
    assert client.post("/planes/admin/otorgar", headers=admin_h,
                       json={"usuario_id": empresa.id, "plan_id": planes["importador"].id}).status_code == 404


def test_el_admin_edita_los_planes(client, db_session, planes):
    _, admin_h = crear_usuario_con_token(db_session, rol="admin")
    _, comprador_h = crear_usuario_con_token(db_session)
    assert client.get("/planes/admin/planes", headers=comprador_h).status_code == 403
    r = client.put(f"/planes/admin/planes/{planes['importador'].id}",
                   json={"precio_cop": 600000, "cupos_totales": 50, "incluye": ["Uno", " ", "Dos"]}, headers=admin_h)
    assert r.status_code == 200 and r.json()["total_cop"] == 714000 and r.json()["incluye"] == ["Uno", "Dos"]
    nuevo = client.post("/planes/admin/planes", json={"clave": "empresa", "nombre": "Plan Empresa",
                                                     "precio_cop": 5000000, "solicitudes_incluidas": 40},
                        headers=admin_h)
    assert nuevo.status_code == 201
    assert client.post("/planes/admin/planes", json={"clave": "empresa", "nombre": "Otro", "precio_cop": 1},
                       headers=admin_h).status_code == 409
    assert [p["clave"] for p in client.get("/planes/admin/planes", headers=admin_h).json()] == [
        "viejo", "empresa", "importador", "vip"]


def test_el_cobro_gasta_primero_el_plan_y_luego_los_tokens(client, db_session, planes):
    _, admin_h = crear_usuario_con_token(db_session, rol="admin")
    _modulo(client, admin_h, cobro_cotizaciones=True)
    usuario, headers = crear_usuario_con_token(db_session)
    usuario.plan_id, usuario.solicitudes_plan, usuario.puntos_cotizacion = planes["importador"].id, 1, 1
    usuario.plan_vence_en = datetime.utcnow() + timedelta(days=10)
    db_session.commit()

    r = client.post("/cotizaciones", json=COTIZACION, headers=headers)
    assert r.status_code == 201
    assert db_session.query(Cotizacion).filter(Cotizacion.id == r.json()["id"]).one().unidad_cobrada == "plan"
    r = client.post("/cotizaciones", json=COTIZACION, headers=headers)
    assert db_session.query(Cotizacion).filter(Cotizacion.id == r.json()["id"]).one().unidad_cobrada == "token"

    # Plan vencido: sus solicitudes ya no valen.
    db_session.refresh(usuario)
    usuario.solicitudes_plan, usuario.plan_vence_en = 5, datetime.utcnow() - timedelta(days=1)
    db_session.commit()
    assert tokens_cotizacion.saldo(usuario) == 0
    assert client.post("/cotizaciones", json=COTIZACION, headers=headers).status_code == 402


def test_con_lista_cerrada_solo_publica_quien_tiene_plan_vigente(client, db_session, planes):
    _, admin_h = crear_usuario_con_token(db_session, rol="admin")
    _modulo(client, admin_h, solo_con_plan=True)
    assert client.get("/configuracion-publica").json()["solo_con_plan"] is True
    usuario, headers = crear_usuario_con_token(db_session)
    usuario.puntos_cotizacion = 3  # tokens sueltos no bastan: hace falta el plan
    db_session.commit()

    r = client.post("/cotizaciones", json=COTIZACION, headers=headers)
    assert r.status_code == 403 and "plan activo" in r.text
    assert client.get("/usuarios/me", headers=headers).json()["plan_vigente"] is False

    usuario.plan_id, usuario.solicitudes_plan = planes["vip"].id, 10
    usuario.plan_vence_en = datetime.utcnow() + timedelta(days=30)
    db_session.commit()
    yo = client.get("/usuarios/me", headers=headers).json()
    assert yo["plan_vigente"] is True and yo["solicitudes_plan_vigentes"] == 10
    assert client.post("/cotizaciones", json=COTIZACION, headers=headers).status_code == 201

    # Vencido, vuelve a quedar por fuera.
    db_session.refresh(usuario)
    usuario.plan_vence_en = datetime.utcnow() - timedelta(days=1)
    db_session.commit()
    assert client.post("/cotizaciones", json=COTIZACION, headers=headers).status_code == 403

    # Al abrir al público se apaga y vuelve a publicar cualquiera.
    _modulo(client, admin_h, solo_con_plan=False)
    assert client.post("/cotizaciones", json=COTIZACION, headers=headers).status_code == 201


def test_el_admin_apaga_las_cotizaciones_abiertas(client, db_session, planes):
    _, admin_h = crear_usuario_con_token(db_session, rol="admin")
    _, headers = crear_usuario_con_token(db_session)
    assert client.get("/configuracion-publica").json()["cotizaciones_abiertas"] is True
    assert client.post("/cotizaciones", json=COTIZACION, headers=headers).status_code == 201

    _modulo(client, admin_h, cotizaciones_abiertas=False)
    assert client.get("/configuracion-publica").json()["cotizaciones_abiertas"] is False
    r = client.post("/cotizaciones", json=COTIZACION, headers=headers)
    assert r.status_code == 400 and "abiertas están desactivadas" in r.text

    _modulo(client, admin_h, cotizaciones_abiertas=True)
    assert client.post("/cotizaciones", json=COTIZACION, headers=headers).status_code == 201


def test_sin_propuestas_en_72_horas_la_unidad_vuelve(client, db_session, planes, correos):
    usuario, _ = crear_usuario_con_token(db_session)
    importador, _ = crear_empresa_importadora(db_session)
    hace = datetime.utcnow() - timedelta(hours=73)

    def cotizacion(unidad, cuando=hace):
        c = Cotizacion(id=str(uuid4()), solicitante_id=usuario.id, modalidad="abierta", pais_importacion="China",
                       nombre_producto="Termo", descripcion_cliente="Termo de acero", linea_producto="Hogar",
                       tipo_calidad="estandar", cantidad_minima=10, estado="abierta", unidad_cobrada=unidad,
                       fecha_creacion=cuando)
        db_session.add(c)
        return c

    sin_propuestas = cotizacion("plan")
    gratis = cotizacion("gratis")
    con_propuesta = cotizacion("token")
    reciente = cotizacion("token", datetime.utcnow() - timedelta(hours=10))
    db_session.add(Propuesta(id=str(uuid4()), cotizacion_id=con_propuesta.id, importador_id=importador.id,
                             precio_ofrecido_usd=1.0, tiempo_estimado_entrega="30 días", incoterm="FOB",
                             estado=EstadoPropuesta.pendiente))
    db_session.commit()

    assert tokens_cotizacion.devolver_sin_propuestas(db_session)["devueltas"] == 2
    db_session.refresh(usuario)
    assert usuario.solicitudes_plan == 1 and usuario.cotizaciones_gratis == 1 and usuario.puntos_cotizacion == 0
    for c in (sin_propuestas, gratis):
        db_session.refresh(c)
        assert c.unidad_devuelta_en is not None
    db_session.refresh(reciente)
    assert reciente.unidad_devuelta_en is None
    # Una segunda vuelta no devuelve otra vez.
    assert tokens_cotizacion.devolver_sin_propuestas(db_session)["devueltas"] == 0
