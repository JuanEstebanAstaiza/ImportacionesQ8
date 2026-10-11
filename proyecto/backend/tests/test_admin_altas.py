"""Altas desde el admin: cotizantes (natural y jurídica) con los datos del
registro público, sin OTP y con el registro cerrado; empresas con NIT, razón
social y representante legal."""
import pytest

from conftest import crear_usuario_con_token
from models.configuracion import ConfiguracionPlataforma
from models.usuario import Usuario

BASE = {"password": "ClaveSegura12", "indicativo_pais_telefono": "+57", "telefono": "3001234567"}


@pytest.fixture(autouse=True)
def config_limpia(db_session):
    yield
    db_session.query(ConfiguracionPlataforma).filter(ConfiguracionPlataforma.clave.like("modulos.%")).delete(
        synchronize_session=False)
    db_session.commit()


def test_admin_crea_cotizante_natural_aunque_el_registro_este_cerrado(client, db_session):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    client.put("/admin/modulos", json={"registro": False}, headers=admin)
    r = client.post("/admin/solicitantes", headers=admin, json={
        **BASE, "email": "natural@example.com", "tipo_persona": "natural", "nombre": "Ana",
        "apellido": "Gómez", "tipo_documento": "CC", "numero_documento": "1020304050", "tokens_iniciales": 3})
    assert r.status_code == 201, r.text
    u = db_session.query(Usuario).filter(Usuario.email == "natural@example.com").one()
    assert (u.rol, u.apellido, u.numero_documento, u.email_verificado, u.puntos_cotizacion) == \
        ("solicitante", "Gómez", "1020304050", True, 3)
    # Entra directo, sin OTP.
    login = client.post("/auth/login", json={"email": "natural@example.com", "password": "ClaveSegura12"})
    assert login.status_code == 200 and login.json().get("access_token")


def test_faltan_campos_del_registro(client, db_session):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    r = client.post("/admin/solicitantes", headers=admin, json={
        **BASE, "email": "sinapellido@example.com", "tipo_persona": "natural", "nombre": "Ana",
        "tipo_documento": "CC", "numero_documento": "1"})
    assert r.status_code == 422 and "apellido" in r.text
    r = client.post("/admin/solicitantes", headers=admin, json={
        **BASE, "email": "sinnit@example.com", "tipo_persona": "juridica", "razon_social": "Acme S.A.S."})
    assert r.status_code == 422 and "nit" in r.text
    _, soporte = crear_usuario_con_token(db_session, rol="soporte")
    assert client.post("/admin/solicitantes", headers=soporte, json={
        **BASE, "email": "x@example.com", "tipo_persona": "juridica", "nit": "1", "razon_social": "X"}).status_code == 403


def test_admin_crea_cotizante_juridico_con_su_organizacion(client, db_session):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    r = client.post("/admin/solicitantes", headers=admin, json={
        **BASE, "email": "acme@example.com", "tipo_persona": "juridica", "nit": "900123456-7",
        "razon_social": "Acme S.A.S."})
    assert r.status_code == 201, r.text
    u = db_session.query(Usuario).filter(Usuario.email == "acme@example.com").one()
    assert u.tipo_persona == "juridica" and u.nit == "900123456-7" and u.nombre == "Acme S.A.S."
    assert u.organizacion_id is not None


def test_empresa_guarda_datos_legales_y_del_representante(client, db_session):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    r = client.post("/admin/importadores", headers=admin, json={
        "nombre_empresa": "Andes Import", "especialidad_producto": ["Textil"], "paises_origen": ["China"],
        "tiempo_respuesta_promedio": "~24h", "email_dueño": "andes@example.com", "password_dueño": "ClaveSegura12",
        "nombre_dueño": "Marcela", "apellido_dueño": "Ríos", "tipo_documento_dueño": "CC",
        "numero_documento_dueño": "52123456", "nit": "901234567-1", "razon_social": "Andes Import S.A.S.",
        "indicativo_dueño": "+57", "telefono_dueño": "3109876543"})
    assert r.status_code == 201, r.text
    dueno = db_session.query(Usuario).filter(Usuario.email == "andes@example.com").one()
    assert (dueno.rol, dueno.nit, dueno.razon_social, dueno.apellido, dueno.numero_documento, dueno.telefono) == \
        ("importador", "901234567-1", "Andes Import S.A.S.", "Ríos", "52123456", "3109876543")


def test_admin_elige_el_tier_del_cotizante(client, db_session):
    from services.tier_service import recalcular_tier_cotizante

    _, admin = crear_usuario_con_token(db_session, rol="admin")
    natural = {**BASE, "tipo_persona": "natural", "nombre": "Leo", "apellido": "Ruiz",
               "tipo_documento": "CC", "numero_documento": "99887766"}
    r = client.post("/admin/solicitantes", headers=admin, json={**natural, "email": "gold@example.com", "tier": "Gold"})
    assert r.status_code == 201, r.text
    u = db_session.query(Usuario).filter(Usuario.email == "gold@example.com").one()
    assert (u.tier, u.tier_manual) == ("Gold", True)
    # Fijo: el recálculo por actividad no lo baja.
    recalcular_tier_cotizante(db_session, u.id)
    db_session.refresh(u)
    assert u.tier == "Gold"

    # Sin elegir: Bronze y automático.
    r = client.post("/admin/solicitantes", headers=admin, json={**natural, "email": "auto@example.com",
                                                                 "numero_documento": "11223344"})
    u = db_session.query(Usuario).filter(Usuario.email == "auto@example.com").one()
    assert (u.tier, u.tier_manual) == ("Bronze", False)

    assert client.post("/admin/solicitantes", headers=admin, json={
        **natural, "email": "x2@example.com", "tier": "Platino"}).status_code == 422
