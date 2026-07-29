"""Tests de notificaciones in-app."""
import pytest
from uuid import uuid4
from datetime import datetime
from fastapi import status

from models.usuario import Usuario
from models.notificacion import Notificacion
from utils.security import hash_password
from conftest import auth_headers_for


@pytest.fixture()
def usuario(db_session):
    user = Usuario(
        id=str(uuid4()),
        email="notif_user@example.com",
        password_hash=hash_password("123456789"),
        rol="solicitante",
        email_verificado=True,
        perfil_completo=True,
        fecha_creacion=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def notificaciones(db_session, usuario):
    items = []
    for i in range(3):
        n = Notificacion(
            id=str(uuid4()),
            usuario_id=usuario.id,
            tipo="sistema",
            titulo=f"Aviso {i}",
            mensaje=f"Mensaje {i}",
            data={"i": i},
            leida=False,
            fecha_creacion=datetime.utcnow(),
        )
        db_session.add(n)
        items.append(n)
    db_session.commit()
    return items


class TestNotificaciones:
    def test_listar_vacias(self, client, usuario):
        r = client.get("/notificaciones", headers=auth_headers_for(usuario))
        assert r.status_code == 200
        body = r.json()
        assert body["total"] == 0
        assert body["no_leidas"] == 0
        assert body["items"] == []

    def test_listar_y_marcar_una(self, client, usuario, notificaciones):
        r = client.get("/notificaciones", headers=auth_headers_for(usuario))
        assert r.status_code == 200
        assert r.json()["no_leidas"] == 3
        assert len(r.json()["items"]) == 3

        nid = notificaciones[0].id
        r = client.put(f"/notificaciones/{nid}/leer", headers=auth_headers_for(usuario))
        assert r.status_code == 200
        assert r.json()["leida"] is True

        r = client.get("/notificaciones", headers=auth_headers_for(usuario))
        assert r.json()["no_leidas"] == 2

    def test_marcar_todas(self, client, usuario, notificaciones):
        r = client.put("/notificaciones/leer-todas", headers=auth_headers_for(usuario))
        assert r.status_code == 200
        assert r.json()["actualizadas"] == 3

        r = client.get("/notificaciones", headers=auth_headers_for(usuario))
        assert r.json()["no_leidas"] == 0
        assert all(i["leida"] for i in r.json()["items"])

    def test_no_puede_leer_ajena(self, client, db_session, usuario, notificaciones):
        otro = Usuario(
            id=str(uuid4()),
            email="otro_notif@example.com",
            password_hash=hash_password("123456789"),
            rol="solicitante",
            email_verificado=True,
            fecha_creacion=datetime.utcnow(),
        )
        db_session.add(otro)
        db_session.commit()

        r = client.put(
            f"/notificaciones/{notificaciones[0].id}/leer",
            headers=auth_headers_for(otro),
        )
        assert r.status_code == status.HTTP_404_NOT_FOUND
