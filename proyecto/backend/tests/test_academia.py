"""Tests del módulo académico: cursos, compra (solo solicitante) y progreso."""
from uuid import uuid4
from datetime import datetime

import pytest
from fastapi import status

from conftest import crear_empresa_importadora, crear_usuario_con_token, auth_headers_for
from models.usuario import Usuario
from utils.security import hash_password, create_access_token


@pytest.fixture()
def empresa_y_dueño(db_session):
    return crear_empresa_importadora(db_session, email_dueño="imp_academia@example.com")


@pytest.fixture()
def solicitante(db_session):
    u = Usuario(
        id=str(uuid4()),
        email="sol_academia@example.com",
        password_hash=hash_password("ClaveSegura1"),
        rol="solicitante",
        perfil_completo=True,
        activo=True,
        email_verificado=True,
        fecha_creacion=datetime.utcnow(),
    )
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u


def _headers(user):
    return auth_headers_for(user)


def _crear_curso_con_lecciones(client, h_imp, n_lecciones=10, precio=29.99, publicar=True):
    r = client.post(
        "/academia/cursos",
        json={
            "titulo": "Curso de importación desde China",
            "descripcion": "Aprende a importar paso a paso",
            "categoria": "importacion",
            "precio_usd": precio,
        },
        headers=h_imp,
    )
    assert r.status_code == 201, r.text
    curso_id = r.json()["id"]
    leccion_ids = []
    for i in range(1, n_lecciones + 1):
        lr = client.post(
            f"/academia/cursos/{curso_id}/lecciones",
            json={
                "titulo": f"Video {i}",
                "tipo": "video",
                "contenido_url": f"https://cdn.example.com/v{i}.mp4",
                "orden": i,
            },
            headers=h_imp,
        )
        assert lr.status_code == 201, lr.text
        leccion_ids.append(lr.json()["id"])
    if publicar:
        pr = client.post(f"/academia/cursos/{curso_id}/publicar", headers=h_imp)
        assert pr.status_code == 200, pr.text
        assert pr.json()["estado"] == "publicado"
    return curso_id, leccion_ids


class TestGestionCursosImportadora:
    def test_crear_y_listar_mis_cursos(self, client, empresa_y_dueño):
        _, dueño = empresa_y_dueño
        h = _headers(dueño)
        r = client.post(
            "/academia/cursos",
            json={"titulo": "Productos ganadores 2026", "categoria": "productos_ganadores", "precio_usd": 49},
            headers=h,
        )
        assert r.status_code == 201
        assert r.json()["estado"] == "borrador"
        assert r.json()["total_lecciones"] == 0

        lista = client.get("/academia/mis-cursos", headers=h)
        assert lista.status_code == 200
        assert any(c["id"] == r.json()["id"] for c in lista.json())

    def test_no_publicar_sin_lecciones(self, client, empresa_y_dueño):
        _, dueño = empresa_y_dueño
        h = _headers(dueño)
        curso_id = client.post(
            "/academia/cursos",
            json={"titulo": "Curso vacío demo", "precio_usd": 10},
            headers=h,
        ).json()["id"]
        r = client.post(f"/academia/cursos/{curso_id}/publicar", headers=h)
        assert r.status_code == 400

    def test_solicitante_no_crea_curso(self, client, solicitante):
        r = client.post(
            "/academia/cursos",
            json={"titulo": "Hackeo", "precio_usd": 1},
            headers=_headers(solicitante),
        )
        assert r.status_code == 403


class TestCompraSoloSolicitante:
    def test_comprar_y_ver_contenido(self, client, empresa_y_dueño, solicitante):
        _, dueño = empresa_y_dueño
        curso_id, lecciones = _crear_curso_con_lecciones(client, _headers(dueño), n_lecciones=3, precio=19.99)

        # Sin compra: catálogo ok, contenido de lección oculto
        cat = client.get("/academia/catalogo", headers=_headers(solicitante))
        assert cat.status_code == 200
        assert any(c["id"] == curso_id for c in cat.json())

        det = client.get(f"/academia/cursos/{curso_id}", headers=_headers(solicitante))
        assert det.status_code == 200
        assert det.json()["comprado"] is False
        assert det.json()["lecciones"][0]["contenido_url"] is None

        # Importador no compra
        r_imp = client.post(f"/academia/cursos/{curso_id}/comprar", headers=_headers(dueño))
        assert r_imp.status_code == 403

        # Solicitante compra (simulado confirmado)
        compra = client.post(f"/academia/cursos/{curso_id}/comprar", headers=_headers(solicitante))
        assert compra.status_code == 201, compra.text
        assert compra.json()["estado"] == "confirmada"

        det2 = client.get(f"/academia/cursos/{curso_id}", headers=_headers(solicitante))
        assert det2.json()["comprado"] is True
        assert det2.json()["lecciones"][0]["contenido_url"] is not None

        # Doble compra
        dup = client.post(f"/academia/cursos/{curso_id}/comprar", headers=_headers(solicitante))
        assert dup.status_code == 409

    def test_curso_gratis(self, client, empresa_y_dueño, solicitante):
        _, dueño = empresa_y_dueño
        curso_id, _ = _crear_curso_con_lecciones(client, _headers(dueño), n_lecciones=2, precio=0)
        compra = client.post(f"/academia/cursos/{curso_id}/comprar", headers=_headers(solicitante))
        assert compra.status_code == 201
        assert compra.json()["estado"] == "confirmada"
        assert compra.json()["precio_pagado_usd"] == 0


class TestProgreso:
    def test_progreso_80_por_ciento_con_8_de_10(self, client, empresa_y_dueño, solicitante):
        _, dueño = empresa_y_dueño
        h_sol = _headers(solicitante)
        curso_id, leccion_ids = _crear_curso_con_lecciones(
            client, _headers(dueño), n_lecciones=10, precio=9.99
        )
        assert client.post(f"/academia/cursos/{curso_id}/comprar", headers=h_sol).status_code == 201

        for lid in leccion_ids[:8]:
            r = client.post(
                f"/academia/cursos/{curso_id}/lecciones/{lid}/completar",
                headers=h_sol,
            )
            assert r.status_code == 200, r.text

        prog = client.get(f"/academia/cursos/{curso_id}/progreso", headers=h_sol)
        assert prog.status_code == 200
        data = prog.json()
        assert data["total_lecciones"] == 10
        assert data["lecciones_completadas"] == 8
        assert data["progreso_pct"] == 80.0
        assert sum(1 for l in data["lecciones"] if l["completada"]) == 8

        # Completar el resto
        for lid in leccion_ids[8:]:
            client.post(f"/academia/cursos/{curso_id}/lecciones/{lid}/completar", headers=h_sol)
        full = client.get(f"/academia/cursos/{curso_id}/progreso", headers=h_sol).json()
        assert full["progreso_pct"] == 100.0
        assert full["lecciones_completadas"] == 10

    def test_progreso_sin_compra_403(self, client, empresa_y_dueño, solicitante):
        _, dueño = empresa_y_dueño
        curso_id, lecciones = _crear_curso_con_lecciones(client, _headers(dueño), n_lecciones=2)
        r = client.post(
            f"/academia/cursos/{curso_id}/lecciones/{lecciones[0]}/completar",
            headers=_headers(solicitante),
        )
        assert r.status_code == 403

    def test_desmarcar_leccion(self, client, empresa_y_dueño, solicitante):
        _, dueño = empresa_y_dueño
        h = _headers(solicitante)
        curso_id, lecciones = _crear_curso_con_lecciones(client, _headers(dueño), n_lecciones=2, precio=0)
        client.post(f"/academia/cursos/{curso_id}/comprar", headers=h)
        client.post(f"/academia/cursos/{curso_id}/lecciones/{lecciones[0]}/completar", headers=h)
        assert client.get(f"/academia/cursos/{curso_id}/progreso", headers=h).json()["progreso_pct"] == 50.0
        client.delete(f"/academia/cursos/{curso_id}/lecciones/{lecciones[0]}/completar", headers=h)
        assert client.get(f"/academia/cursos/{curso_id}/progreso", headers=h).json()["progreso_pct"] == 0.0

    def test_mis_compras(self, client, empresa_y_dueño, solicitante):
        _, dueño = empresa_y_dueño
        curso_id, _ = _crear_curso_con_lecciones(client, _headers(dueño), n_lecciones=1, precio=5)
        client.post(f"/academia/cursos/{curso_id}/comprar", headers=_headers(solicitante))
        mis = client.get("/academia/mis-compras", headers=_headers(solicitante))
        assert mis.status_code == 200
        assert len(mis.json()) >= 1
        assert mis.json()[0]["curso"]["id"] == curso_id
