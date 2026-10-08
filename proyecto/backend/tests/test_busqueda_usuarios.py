"""Autocompletado de usuarios: admin y clientes de una empresa."""
from datetime import datetime
from uuid import uuid4

from conftest import auth_headers_for, crear_empresa_importadora, crear_usuario_con_token
from models.cotizacion import Cotizacion
from utils.busqueda_usuarios import enmascarar_correo


def _usuario(db_session, email, nombre=None, apellido=None, rol="solicitante", activo=True):
    usuario, _ = crear_usuario_con_token(db_session, rol=rol, email=email, nombre=nombre)
    usuario.apellido = apellido
    usuario.activo = activo
    db_session.commit()
    return usuario


def test_admin_busca_por_parte_del_correo_o_del_nombre(client, db_session):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    _usuario(db_session, "paula.restrepo@gmail.com", "Paula", "Restrepo")
    _usuario(db_session, "jrestrepo@empresa.co", "Julián", "Vega")
    _usuario(db_session, "otra@correo.com", "Marta", "Gómez")

    correos = lambda q: [u["email"] for u in client.get(f"/admin/usuarios/buscar?q={q}", headers=admin).json()]
    assert set(correos("restrepo")) == {"paula.restrepo@gmail.com", "jrestrepo@empresa.co"}
    # Quien empieza por lo escrito va primero.
    assert correos("jres")[0] == "jrestrepo@empresa.co"
    # Varias palabras: todas deben aparecer (nombre + parte del correo).
    assert correos("paula gmail") == ["paula.restrepo@gmail.com"]
    assert correos("julián") == ["jrestrepo@empresa.co"]
    # Con menos de dos letras no busca.
    assert correos("p") == []


def test_admin_busqueda_filtra_rol_y_cuentas_inactivas(client, db_session):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    _usuario(db_session, "comprador.uno@x.com")
    _usuario(db_session, "comprador.dos@x.com", activo=False)
    _usuario(db_session, "comprador.soporte@x.com", rol="soporte")

    r = client.get("/admin/usuarios/buscar?q=comprador&rol=solicitante", headers=admin).json()
    assert [u["email"] for u in r] == ["comprador.uno@x.com"]
    r = client.get("/admin/usuarios/buscar?q=comprador&solo_activos=false", headers=admin).json()
    assert len(r) == 3


def test_los_comodines_de_sql_no_traen_a_todos(client, db_session):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    _usuario(db_session, "alguien@x.com")
    assert client.get("/admin/usuarios/buscar?q=%25%25", headers=admin).json() == []


def test_solo_el_admin_busca_usuarios(client, db_session):
    _, comprador = crear_usuario_con_token(db_session)
    assert client.get("/admin/usuarios/buscar?q=ab", headers=comprador).status_code == 403


def test_empresa_busca_clientes_por_correo_sin_verlo_completo(client, db_session):
    importador, dueno = crear_empresa_importadora(db_session)
    empresa = auth_headers_for(dueno)
    cliente = _usuario(db_session, "maria.lopez@gmail.com", "María", "López")
    _usuario(db_session, "ajeno@gmail.com", "María", "Ajena")  # nunca cotizó con la empresa
    db_session.add(Cotizacion(
        id=str(uuid4()), solicitante_id=cliente.id, importador_id=importador.id, modalidad="dirigida",
        pais_importacion="China", nombre_producto="X", descripcion_cliente="Descripción de prueba larga",
        linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=10, estado="dirigida",
        fecha_creacion=datetime.utcnow(),
    ))
    db_session.commit()

    for q in ("maria.lo", "lopez", "gmail"):
        r = client.get(f"/catalogos/clientes?q={q}", headers=empresa).json()
        assert [c["usuario_id"] for c in r] == [cliente.id], q
    assert r[0]["email_parcial"] == "ma•••••••ez@gmail.com"
    assert "maria.lopez@gmail.com" not in str(r)
    assert client.get("/catalogos/clientes?q=ajena", headers=empresa).json() == []


def test_enmascarar_correo():
    assert enmascarar_correo("juanastaiza@gmail.com") == "ju•••••••za@gmail.com"
    assert enmascarar_correo("ana@x.co") == "a••@x.co"
    assert enmascarar_correo("") == ""
