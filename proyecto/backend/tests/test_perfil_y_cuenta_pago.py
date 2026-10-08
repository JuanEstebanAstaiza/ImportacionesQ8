"""Editor de perfil (cualquier rol), cambio de contraseña, cuenta bancaria del
perfil y presupuesto dinámico del reto."""
from datetime import datetime, timedelta
from uuid import uuid4

import pytest

from conftest import crear_usuario_con_token
from models.documental import Archivo
from models.notificacion import Notificacion
from models.reto import CuentaPago
from services import enlaces_video as ev
from utils.security import verify_password

CUENTA = {"banco": "Bancolombia", "tipo_cuenta": "ahorros", "numero_cuenta": "123-456-789012",
          "titular": "Paula Restrepo", "documento_titular": "1020304050"}


@pytest.fixture(autouse=True)
def oembed_simulado(monkeypatch):
    monkeypatch.setattr(ev, "consultar_oembed", lambda enlace, cliente=None: enlace)


def _imagen(db_session, owner_id, tipo="imagen"):
    archivo = Archivo(id=str(uuid4()), owner_user_id=owner_id, nombre="foto.png", extension="png",
                      mime_type="image/png", tipo_recurso=tipo, origen="perfil-usuario")
    db_session.add(archivo)
    db_session.commit()
    return f"/documentos/archivos/{archivo.id}/descargar"


# ── Perfil ───────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("rol", ["solicitante", "importador", "asesor", "admin"])
def test_cualquier_rol_edita_su_perfil(client, db_session, rol):
    usuario, headers = crear_usuario_con_token(db_session, rol=rol)
    foto = _imagen(db_session, usuario.id)
    r = client.put("/usuarios/me", headers=headers, json={
        "nombre": " Paula ", "apellido": "Restrepo", "indicativo_pais_telefono": "+57",
        "telefono": "300 123 4567", "whatsapp": "+57 300 123 4567", "foto_url": foto,
    })
    assert r.status_code == 200, r.text
    datos = r.json()
    assert datos["nombre"] == "Paula" and datos["apellido"] == "Restrepo"
    assert datos["indicativo_pais_telefono"] == "+57" and datos["foto_url"] == foto

    # Vacío quita la foto.
    assert client.put("/usuarios/me", headers=headers, json={"foto_url": ""}).json()["foto_url"] is None


def test_foto_ajena_o_insegura_se_rechaza(client, db_session):
    usuario, headers = crear_usuario_con_token(db_session)
    otro, _ = crear_usuario_con_token(db_session)
    for foto in ("javascript:alert(1)", "data:image/png;base64,AAAA", "http://example.com/a.png",
                 _imagen(db_session, otro.id), _imagen(db_session, usuario.id, tipo="documento")):
        r = client.put("/usuarios/me", headers=headers, json={"foto_url": foto})
        assert r.status_code == 400, foto
    assert client.put("/usuarios/me", headers=headers, json={"indicativo_pais_telefono": "57"}).status_code == 422


def test_documento_no_se_edita_desde_el_perfil(client, db_session):
    usuario, headers = crear_usuario_con_token(db_session)
    usuario.numero_documento = "1020304050"
    db_session.commit()
    client.put("/usuarios/me", headers=headers, json={"numero_documento": "999", "rol": "admin"})
    db_session.refresh(usuario)
    assert usuario.numero_documento == "1020304050" and usuario.rol == "solicitante"
    assert client.get("/usuarios/me", headers=headers).json()["numero_documento"] == "1020304050"


def test_cambiar_contrasena(client, db_session):
    usuario, headers = crear_usuario_con_token(db_session, password="ClaveSegura1")
    r = client.post("/usuarios/me/contrasena", headers=headers, json={"actual": "otra", "nueva": "NuevaClave22"})
    assert r.status_code == 400
    r = client.post("/usuarios/me/contrasena", headers=headers, json={"actual": "ClaveSegura1", "nueva": "corta"})
    assert r.status_code == 422
    r = client.post("/usuarios/me/contrasena", headers=headers,
                    json={"actual": "ClaveSegura1", "nueva": "ClaveSegura1"})
    assert r.status_code == 400
    r = client.post("/usuarios/me/contrasena", headers=headers,
                    json={"actual": "ClaveSegura1", "nueva": "NuevaClave22"})
    assert r.status_code == 204
    db_session.refresh(usuario)
    assert verify_password("NuevaClave22", usuario.password_hash)


# ── Cuenta bancaria del perfil ───────────────────────────────────────────────

def test_cuenta_del_perfil_se_guarda_cifrada_y_enmascarada(client, db_session):
    usuario, headers = crear_usuario_con_token(db_session)
    assert client.get("/usuarios/me/cuenta-pago", headers=headers).json() == {"cuenta": None}

    r = client.put("/usuarios/me/cuenta-pago", headers=headers, json=CUENTA)
    assert r.status_code == 200, r.text
    cuenta = r.json()["cuenta"]
    assert cuenta["banco"] == "Bancolombia" and cuenta["ultimos_digitos"] == "9012"
    assert cuenta["documento"] == "•••••••050"
    assert "123456789012" not in r.text and "1020304050" not in r.text
    fila = db_session.query(CuentaPago).filter(CuentaPago.usuario_id == usuario.id).one()
    assert "123456789012" not in fila.numero_cifrado

    # Cambiarla reemplaza la misma fila.
    client.put("/usuarios/me/cuenta-pago", headers=headers, json={**CUENTA, "banco": "Nequi", "numero_cuenta": "3001234567"})
    assert db_session.query(CuentaPago).filter(CuentaPago.usuario_id == usuario.id).count() == 1
    assert client.get("/usuarios/me/cuenta-pago", headers=headers).json()["cuenta"]["ultimos_digitos"] == "4567"

    assert client.delete("/usuarios/me/cuenta-pago", headers=headers).status_code == 204
    assert client.get("/usuarios/me/cuenta-pago", headers=headers).json() == {"cuenta": None}


# ── Reto: cuenta del perfil y presupuesto dinámico ───────────────────────────

def _ronda(client, admin, **extra):
    fin = (datetime.utcnow() + timedelta(days=14)).replace(microsecond=0).isoformat()
    r = client.post("/reto/rondas", headers=admin, json={
        "nombre": "Ronda", "max_participantes": 20, "umbral_aprobados": 1, "fecha_limite": fin, **extra})
    assert r.status_code == 201, r.text
    return r.json()


def _participante_con_aprobado(client, db_session, admin, ronda, video="dQw4w9WgXcQ"):
    usuario, headers = crear_usuario_con_token(db_session)
    client.post(f"/reto/rondas/{ronda['id']}/inscribirme", headers=headers)
    item_id = client.post("/tendencias/enviar", json={"url": f"https://youtu.be/{video}"}, headers=headers).json()["id"]
    client.patch(f"/tendencias/items/{item_id}", json={"nombre": "P", "categoria": "Hogar"}, headers=admin)
    client.post(f"/tendencias/items/{item_id}/aprobar", json={"sin_portada": True}, headers=admin)
    return usuario, headers


def test_reclamar_efectivo_usa_la_cuenta_del_perfil(client, db_session):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    ronda = _ronda(client, admin)
    usuario, headers = _participante_con_aprobado(client, db_session, admin, ronda)
    client.put("/usuarios/me/cuenta-pago", headers=headers, json=CUENTA)

    p = client.get("/reto/mi-participacion", headers=headers).json()["participacion"]
    assert p["estado_recompensa"] == "reclamable" and p["cuenta"]["ultimos_digitos"] == "9012"
    r = client.post(f"/reto/participaciones/{p['id']}/reclamar", json={"eleccion": "efectivo"}, headers=headers)
    assert r.status_code == 200 and r.json()["estado_recompensa"] == "solicitada"
    assert db_session.query(Notificacion).filter(
        Notificacion.usuario_id == usuario.id, Notificacion.titulo == "Recibimos tu solicitud de pago").count() == 1

    # Con un pago en camino, la cuenta se puede cambiar pero no borrar.
    assert client.delete("/usuarios/me/cuenta-pago", headers=headers).status_code == 409
    filas = client.get(f"/reto/rondas/{ronda['id']}/participantes", headers=admin).json()
    assert filas[0]["cuenta"]["numero"] == "123456789012"
    assert client.patch(f"/reto/participaciones/{p['id']}/pagado", json={"referencia": "TRX-1"},
                        headers=admin).status_code == 200


def test_presupuesto_crece_con_los_inscritos_y_lo_pagado_no_cambia(client, db_session):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    ronda = _ronda(client, admin, recompensa_cop=50000)

    def actual():
        return next(r for r in client.get("/reto/rondas", headers=admin).json() if r["id"] == ronda["id"])

    assert actual()["presupuesto_cop"] == 0 and actual()["presupuesto_maximo_cop"] == 1_000_000
    _, a = _participante_con_aprobado(client, db_session, admin, ronda, "video000001")
    _participante_con_aprobado(client, db_session, admin, ronda, "video000002")
    datos = actual()
    assert datos["inscritos"] == 2 and datos["presupuesto_cop"] == 100_000
    assert datos["por_pagar_cop"] == 100_000 and datos["pagado_cop"] == 0  # los dos llegaron al umbral

    p = client.get("/reto/mi-participacion", headers=a).json()["participacion"]
    client.post(f"/reto/participaciones/{p['id']}/reclamar", json={"eleccion": "efectivo"}, headers=a)
    client.put(f"/reto/participaciones/{p['id']}/cuenta-pago", json=CUENTA, headers=a)
    client.patch(f"/reto/participaciones/{p['id']}/pagado", json={"referencia": "TRX-1"}, headers=admin)
    assert actual()["pagado_cop"] == 50_000 and actual()["por_pagar_cop"] == 50_000

    # Subir la recompensa mueve el presupuesto y lo pendiente, no lo pagado.
    r = client.patch(f"/reto/rondas/{ronda['id']}", json={"recompensa_cop": 80000}, headers=admin)
    assert r.status_code == 200, r.text
    datos = actual()
    assert datos["presupuesto_cop"] == 160_000 and datos["presupuesto_maximo_cop"] == 1_600_000
    assert datos["pagado_cop"] == 50_000 and datos["por_pagar_cop"] == 80_000


def test_bajar_el_umbral_habilita_a_quien_ya_lo_alcanza(client, db_session):
    _, admin = crear_usuario_con_token(db_session, rol="admin")
    ronda = _ronda(client, admin, umbral_aprobados=3)
    _, headers = _participante_con_aprobado(client, db_session, admin, ronda)
    assert client.get("/reto/mi-participacion", headers=headers).json()["participacion"]["estado_recompensa"] == "pendiente"
    client.patch(f"/reto/rondas/{ronda['id']}", json={"umbral_aprobados": 1}, headers=admin)
    mia = client.get("/reto/mi-participacion", headers=headers).json()["participacion"]
    assert mia["estado_recompensa"] == "reclamable" and mia["umbral"] == 1


def test_la_foto_en_uso_se_ve_sin_sesion_y_lo_demas_sigue_privado(client, db_session, tmp_path):
    usuario, headers = crear_usuario_con_token(db_session)
    foto = _imagen(db_session, usuario.id)
    otra = _imagen(db_session, usuario.id)
    # Antes de ponerla como foto, es un archivo privado más.
    assert client.get(foto).status_code in (401, 403)
    client.put("/usuarios/me", headers=headers, json={"foto_url": foto})
    assert client.get(foto).status_code not in (401, 403)
    assert client.get(otra).status_code in (401, 403)
