"""Pago manual de cursos: con el módulo encendido, un curso con precio se paga
subiendo el comprobante en Pagos. A pagos@ le llega copia (comprobante y
concepto adjuntos), y al aprobarlo, o al dar el acceso a mano desde «Accesos a
cursos», el usuario puede entrar. Apagado, la compra vuelve a ser directa."""
import pytest

from conftest import auth_headers_for, crear_empresa_importadora, crear_usuario_con_token
from models.comprobante import ComprobantePago
from models.configuracion import ConfiguracionPlataforma
from models.curso import CompraCurso, Curso
from tests.test_cursos import CURSO_PAYLOAD

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


@pytest.fixture(autouse=True)
def config_limpia(db_session):
    yield
    db_session.query(ConfiguracionPlataforma).filter(ConfiguracionPlataforma.clave.like("modulos.%")).delete(
        synchronize_session=False)
    db_session.commit()


@pytest.fixture
def correos(monkeypatch):
    """Captura todo lo que sale por correo (con sus adjuntos)."""
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
def escenario(client, db_session):
    _, dueño = crear_empresa_importadora(db_session, nombre_empresa="Zarpi Academia",
                                         email_dueño="academia@example.com")
    curso = client.post("/cursos", json={**CURSO_PAYLOAD, "titulo": "Cómo importar de manera profesional",
                                         "precio": 2_000_000}, headers=auth_headers_for(dueño))
    assert curso.status_code == 201, curso.text
    admin, admin_h = crear_usuario_con_token(db_session, rol="admin")
    alumno, alumno_h = crear_usuario_con_token(db_session)
    assert client.put("/admin/modulos", json={"pago_manual_cursos": True}, headers=admin_h).status_code == 200
    return curso.json(), admin_h, alumno, alumno_h


def _subir(client, headers):
    r = client.post("/documentos/archivos/upload", headers=headers,
                    files={"archivo": ("transferencia.png", PNG, "image/png")}, data={"origen": "comprobante-pago"})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_con_pago_manual_no_se_compra_directo(client, escenario):
    curso, _, _, alumno_h = escenario
    detalle = client.get(f"/cursos/{curso['id']}", headers=alumno_h).json()
    assert detalle["pago_manual"] is True and detalle["precio"] == 2_000_000
    assert client.get("/cursos").json()[0]["pago_manual"] is True

    r = client.post(f"/cursos/{curso['id']}/comprar", headers=alumno_h)
    assert r.status_code == 402 and "comprobante" in r.json()["detail"]
    assert client.get(f"/cursos/{curso['id']}", headers=alumno_h).json()["comprado"] is False


def test_comprobante_del_curso_llega_a_pagos_y_al_aprobar_da_acceso(client, db_session, escenario, correos):
    curso, admin_h, alumno, alumno_h = escenario
    assert client.get("/comprobantes/resumen", headers=alumno_h).json()["cursos_pago_manual"] is True
    por_pagar = client.get("/comprobantes/cursos", headers=alumno_h).json()
    assert [(c["id"], c["precio"], c["pendiente"]) for c in por_pagar] == [(curso["id"], 2_000_000, False)]

    r = client.post("/comprobantes", headers=alumno_h, json={
        "tipo": "curso", "curso_id": curso["id"], "archivo_id": _subir(client, alumno_h), "monto_cop": 1})
    assert r.status_code == 201, r.text
    c = r.json()
    # El valor es el del curso, no lo que mande el usuario.
    assert c["monto_cop"] == 2_000_000 and c["curso"]["titulo"] == "Cómo importar de manera profesional"

    copia = [x for x in correos if x["para"] == "pagos@zarpi.co"]
    assert len(copia) == 1
    assert copia[0]["responder_a"] == alumno.email
    assert "Concepto: El acceso al curso «Cómo importar de manera profesional»" in copia[0]["texto"]
    assert "$2.000.000 COP" in copia[0]["texto"]
    nombres = [a[0] for a in copia[0]["adjuntos"]]
    assert nombres[0] == "transferencia.png" and nombres[1].startswith("Concepto de pago")
    assert copia[0]["adjuntos"][0][1] == PNG and copia[0]["adjuntos"][1][1].startswith(b"%PDF")
    acuse = [x for x in correos if x["para"] == alumno.email]
    assert acuse[0]["buzon"] == "pagos" and "curso «Cómo importar de manera profesional»" in acuse[0]["texto"]

    # Mientras se revisa: no se puede mandar otro, y el curso lo muestra.
    assert client.get(f"/cursos/{curso['id']}", headers=alumno_h).json()["comprobante_pendiente"] is True
    assert client.get("/comprobantes/cursos", headers=alumno_h).json()[0]["pendiente"] is True
    otro = client.post("/comprobantes", headers=alumno_h, json={
        "tipo": "curso", "curso_id": curso["id"], "archivo_id": _subir(client, alumno_h)})
    assert otro.status_code == 409

    correos.clear()
    aprobado = client.post(f"/comprobantes/{c['id']}/aprobar", json={}, headers=admin_h)
    assert aprobado.status_code == 200, aprobado.text
    assert aprobado.json()["estado"] == "aprobado"
    detalle = client.get(f"/cursos/{curso['id']}", headers=alumno_h).json()
    assert detalle["comprado"] is True and detalle["estudiantes_count"] == 1
    acceso = db_session.query(CompraCurso).filter(CompraCurso.usuario_id == alumno.id).one()
    assert acceso.origen == "comprobante" and acceso.comprobante_id == c["id"] and acceso.precio_pagado == 2_000_000
    aviso = [x for x in correos if x["para"] == alumno.email]
    assert aviso[0]["asunto"] == "Ya tienes acceso a tu curso" and aviso[0]["buzon"] == "pagos"
    # Ya no aparece para pagar.
    assert client.get("/comprobantes/cursos", headers=alumno_h).json() == []


def test_los_tokens_siguen_pidiendo_cantidad_y_tambien_van_a_pagos(client, escenario, correos):
    _, admin_h, alumno, alumno_h = escenario
    c = client.post("/comprobantes", headers=alumno_h, json={
        "tipo": "tokens", "archivo_id": _subir(client, alumno_h), "cantidad": 10, "monto_cop": 150000}).json()
    copia = [x for x in correos if x["para"] == "pagos@zarpi.co"]
    assert len(copia) == 1 and "Cantidad: 10" in copia[0]["texto"]
    assert client.post(f"/comprobantes/{c['id']}/aprobar", json={}, headers=admin_h).status_code == 422


def test_si_no_sale_la_copia_el_comprobante_igual_queda(client, db_session, escenario, monkeypatch):
    import utils.email as email

    curso, _, _, alumno_h = escenario
    monkeypatch.setattr(email, "enviar_correo", lambda *a, **kw: False)
    r = client.post("/comprobantes", headers=alumno_h, json={
        "tipo": "curso", "curso_id": curso["id"], "archivo_id": _subir(client, alumno_h)})
    assert r.status_code == 201
    assert db_session.query(ComprobantePago).filter(ComprobantePago.id == r.json()["id"]).count() == 1


def test_el_admin_da_y_quita_el_acceso_a_mano(client, db_session, escenario, correos):
    curso, admin_h, alumno, alumno_h = escenario
    catalogo = client.get("/admin/cursos/catalogo", headers=admin_h).json()
    assert [(c["id"], c["importadora_nombre"]) for c in catalogo] == [(curso["id"], "Zarpi Academia")]

    r = client.post("/admin/cursos/accesos", headers=admin_h,
                    json={"curso_id": curso["id"], "email": alumno.email.upper(), "nota": "Pagó por transferencia"})
    assert r.status_code == 201, r.text
    acceso = r.json()
    assert acceso["origen"] == "manual" and acceso["usuario"]["email"] == alumno.email
    assert acceso["nota"] == "Pagó por transferencia" and acceso["otorgado_por"]
    assert client.get(f"/cursos/{curso['id']}", headers=alumno_h).json()["comprado"] is True
    assert [x["asunto"] for x in correos if x["para"] == alumno.email] == ["Ya tienes acceso a tu curso"]

    # Dos veces no; un correo sin cuenta tampoco.
    assert client.post("/admin/cursos/accesos", headers=admin_h,
                       json={"curso_id": curso["id"], "email": alumno.email}).status_code == 409
    assert client.post("/admin/cursos/accesos", headers=admin_h,
                       json={"curso_id": curso["id"], "email": "nadie@example.com"}).status_code == 404

    lista = client.get(f"/admin/cursos/accesos?curso_id={curso['id']}", headers=admin_h).json()
    assert [a["id"] for a in lista] == [acceso["id"]]
    assert client.get("/admin/cursos/accesos?q=nadie", headers=admin_h).json() == []

    assert client.delete(f"/admin/cursos/accesos/{acceso['id']}", headers=admin_h).status_code == 200
    assert client.get(f"/cursos/{curso['id']}", headers=alumno_h).json()["comprado"] is False
    assert db_session.query(Curso.estudiantes_count).filter(Curso.id == curso["id"]).scalar() == 0

    # Solo el admin.
    assert client.get("/admin/cursos/accesos", headers=alumno_h).status_code == 403


def test_apagado_la_compra_vuelve_a_ser_directa(client, escenario):
    curso, admin_h, _, alumno_h = escenario
    client.put("/admin/modulos", json={"pago_manual_cursos": False}, headers=admin_h)
    assert client.get(f"/cursos/{curso['id']}").json()["pago_manual"] is False
    assert client.post(f"/cursos/{curso['id']}/comprar", headers=alumno_h).status_code == 201
    assert client.get("/comprobantes/cursos", headers=alumno_h).json() == []
    r = client.post("/comprobantes", headers=alumno_h, json={
        "tipo": "curso", "curso_id": curso["id"], "archivo_id": _subir(client, alumno_h)})
    assert r.status_code == 409


def test_curso_gratis_sigue_siendo_inscripcion_directa(client, db_session, escenario):
    curso, _, _, alumno_h = escenario
    db_session.query(Curso).filter(Curso.id == curso["id"]).update({Curso.precio: 0})
    db_session.commit()
    assert client.get(f"/cursos/{curso['id']}").json()["pago_manual"] is False
    assert client.post(f"/cursos/{curso['id']}/comprar", headers=alumno_h).status_code == 201


def test_correo_con_adjuntos_por_resend(monkeypatch):
    import config
    import utils.email as email

    enviados = []

    class Ok:
        is_success = True

    monkeypatch.setattr(config, "SMTP_HOST", "smtp.resend.com")
    monkeypatch.setattr(config, "SMTP_API_KEY", "re_prueba_123")
    monkeypatch.setattr(config, "EMAIL_PROVIDER", "")
    monkeypatch.setattr(email.httpx, "post", lambda url, json=None, headers=None, timeout=None: enviados.append(json) or Ok())
    assert email.enviar_correo("pagos@zarpi.co", "Asunto", "Cuerpo", adjuntos=[("a.png", b"\x01\x02", "image/png")])
    assert enviados[0]["attachments"] == [{"filename": "a.png", "content": "AQI="}]
