"""Tests del módulo LMS de cursos."""
import pytest
from uuid import uuid4
from datetime import datetime
from fastapi import status

from models.usuario import Usuario
from utils.security import hash_password
from conftest import crear_empresa_importadora, auth_headers_for


CURSO_PAYLOAD = {
    "titulo": "Incoterms 2020 para importar",
    "descripcion": "Aprende a negociar Incoterms sin sobrecostos.",
    "portada_url": "https://images.example.com/curso.jpg",
    "precio": 149.0,
    "nivel": "Principiante",
    "categoria": "Logistica Internacional",
    "modulos": [
        {
            "titulo": "Fundamentos",
            "lecciones": [
                {
                    "titulo": "Qué cubren los Incoterms",
                    "duracion": "12 min",
                    "video_url": "https://www.youtube.com/embed/abc123",
                    "recursos": [
                        {
                            "nombre": "Matriz.xlsx",
                            "url": "https://example.com/matriz.xlsx",
                            "tipo": "plantilla",
                        }
                    ],
                },
                {
                    "titulo": "Errores frecuentes FOB vs CIF",
                    "duracion": "16 min",
                    "video_url": "https://www.youtube.com/embed/def456",
                    "recursos": [],
                },
            ],
        }
    ],
}


@pytest.fixture()
def empresa(db_session):
    return crear_empresa_importadora(
        db_session, nombre_empresa="Importadora LMS", email_dueño="dueño_lms@example.com"
    )


@pytest.fixture()
def solicitante(db_session):
    user = Usuario(
        id=str(uuid4()),
        email="alumno@example.com",
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


class TestCatalogoYCreacion:
    def test_catalogo_publico_vacio(self, client):
        r = client.get("/cursos")
        assert r.status_code == status.HTTP_200_OK
        assert r.json() == []

    def test_crear_curso_solo_importador(self, client, empresa, solicitante):
        _, dueño = empresa
        r = client.post("/cursos", json=CURSO_PAYLOAD, headers=auth_headers_for(solicitante))
        assert r.status_code == status.HTTP_403_FORBIDDEN

        r = client.post("/cursos", json=CURSO_PAYLOAD, headers=auth_headers_for(dueño))
        assert r.status_code == status.HTTP_201_CREATED
        data = r.json()
        assert data["titulo"] == CURSO_PAYLOAD["titulo"]
        assert data["slug"]
        assert len(data["modulos"]) == 1
        assert len(data["modulos"][0]["lecciones"]) == 2
        assert data["importadora_nombre"] == "Importadora LMS"

    def test_listar_y_filtrar(self, client, empresa):
        _, dueño = empresa
        unique_cat = f"Aduanas-{uuid4().hex[:8]}"
        unique_cat2 = f"Logistica-{uuid4().hex[:8]}"
        payload1 = {**CURSO_PAYLOAD, "titulo": f"Curso A {uuid4().hex[:6]}", "categoria": unique_cat2, "nivel": "Principiante"}
        payload2 = {**CURSO_PAYLOAD, "titulo": f"Curso B {uuid4().hex[:6]}", "categoria": unique_cat, "nivel": "Avanzado"}
        client.post("/cursos", json=payload1, headers=auth_headers_for(dueño))
        client.post("/cursos", json=payload2, headers=auth_headers_for(dueño))

        r = client.get("/cursos", params={"categoria": unique_cat})
        assert r.status_code == 200
        assert len(r.json()) == 1
        assert r.json()[0]["categoria"] == unique_cat

        r = client.get("/cursos", params={"categoria": unique_cat2, "nivel": "Principiante"})
        assert len(r.json()) == 1

        r = client.get("/cursos", params={"recomendados": True})
        assert r.status_code == 200
        assert len(r.json()) >= 2

    def test_detalle_por_slug(self, client, empresa):
        _, dueño = empresa
        created = client.post("/cursos", json=CURSO_PAYLOAD, headers=auth_headers_for(dueño)).json()
        r = client.get(f"/cursos/{created['slug']}")
        assert r.status_code == 200
        assert r.json()["id"] == created["id"]
        assert r.json()["comprado"] is False


class TestCompraYProgreso:
    def test_comprar_y_mis_cursos(self, client, empresa, solicitante):
        _, dueño = empresa
        curso = client.post("/cursos", json=CURSO_PAYLOAD, headers=auth_headers_for(dueño)).json()

        r = client.post(f"/cursos/{curso['id']}/comprar", headers=auth_headers_for(solicitante))
        assert r.status_code == status.HTTP_201_CREATED
        assert r.json()["precio_pagado"] == 149.0

        # Idempotente
        r2 = client.post(f"/cursos/{curso['id']}/comprar", headers=auth_headers_for(solicitante))
        assert r2.status_code == 201
        assert r2.json()["id"] == r.json()["id"]

        r = client.get("/mis-cursos", headers=auth_headers_for(solicitante))
        assert r.status_code == 200
        assert len(r.json()) == 1
        assert r.json()[0]["comprado"] is True

        # estudiantes_count incrementado
        det = client.get(f"/cursos/{curso['id']}").json()
        assert det["estudiantes_count"] == 1

    def test_progreso_requiere_compra(self, client, empresa, solicitante):
        _, dueño = empresa
        curso = client.post("/cursos", json=CURSO_PAYLOAD, headers=auth_headers_for(dueño)).json()
        leccion_id = curso["modulos"][0]["lecciones"][0]["id"]

        r = client.post(
            f"/cursos/{curso['id']}/lecciones/{leccion_id}/progreso",
            json={"completada": True},
            headers=auth_headers_for(solicitante),
        )
        assert r.status_code == status.HTTP_403_FORBIDDEN

        client.post(f"/cursos/{curso['id']}/comprar", headers=auth_headers_for(solicitante))
        r = client.post(
            f"/cursos/{curso['id']}/lecciones/{leccion_id}/progreso",
            json={"completada": True},
            headers=auth_headers_for(solicitante),
        )
        assert r.status_code == 200
        data = r.json()
        assert data["completada"] is True
        assert leccion_id in data["lecciones_completadas"]
        assert data["total_lecciones"] == 2
        assert data["progreso_pct"] == 50.0
