"""Tests del módulo LMS de cursos."""
import pytest
from uuid import uuid4
from datetime import datetime
from fastapi import status

from models.usuario import Usuario
from utils.security import hash_password
from conftest import crear_empresa_importadora, auth_headers_for


# Los videos y recursos de un curso salen de gestión documental, no de YouTube.
# Se referencian por su ruta canónica del backend, sin host ni prefijo de proxy.
VIDEO_LECCION_1 = "/documentos/archivos/11111111-1111-4111-8111-111111111111/descargar"
VIDEO_LECCION_2 = "/documentos/archivos/22222222-2222-4222-8222-222222222222/descargar"
RECURSO_MATRIZ = "/documentos/archivos/33333333-3333-4333-8333-333333333333/descargar"

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
                    "video_url": VIDEO_LECCION_1,
                    "recursos": [
                        {
                            "nombre": "Matriz.xlsx",
                            "url": RECURSO_MATRIZ,
                            "tipo": "plantilla",
                        }
                    ],
                },
                {
                    "titulo": "Errores frecuentes FOB vs CIF",
                    "duracion": "16 min",
                    "video_url": VIDEO_LECCION_2,
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

    def test_paywall_redacta_contenido_no_preview(self, client, empresa):
        """A01: sin compra, solo lecciones es_preview exponen video/recursos."""
        _, dueño = empresa
        created = client.post("/cursos", json=CURSO_PAYLOAD, headers=auth_headers_for(dueño)).json()
        r = client.get(f"/cursos/{created['id']}")
        assert r.status_code == 200
        lecciones = r.json()["modulos"][0]["lecciones"]
        preview = next(l for l in lecciones if l["es_preview"])
        locked = next(l for l in lecciones if not l["es_preview"])
        assert preview["video_url"]
        assert locked["video_url"] == ""
        assert locked["recursos"] == []

    def test_url_javascript_rechazada(self, client, empresa):
        _, dueño = empresa
        bad = {
            **CURSO_PAYLOAD,
            "modulos": [{
                "titulo": "M",
                "lecciones": [{
                    "titulo": "L",
                    "video_url": "javascript:alert(1)",
                    "recursos": [],
                }],
            }],
        }
        r = client.post("/cursos", json=bad, headers=auth_headers_for(dueño))
        assert r.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_video_de_youtube_rechazado(self, client, empresa):
        """El contenido debe venir de gestión documental, no de enlaces externos de video."""
        _, dueño = empresa
        bad = {
            **CURSO_PAYLOAD,
            "modulos": [{
                "titulo": "M",
                "lecciones": [{
                    "titulo": "L",
                    "video_url": "https://www.youtube.com/embed/abc123",
                    "recursos": [],
                }],
            }],
        }
        r = client.post("/cursos", json=bad, headers=auth_headers_for(dueño))
        assert r.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_urls_se_guardan_canonicas(self, client, empresa):
        """Una URL atada al entorno donde se publicó se reduce a la ruta del backend."""
        _, dueño = empresa
        legacy = {
            **CURSO_PAYLOAD,
            "titulo": f"Curso legacy {uuid4().hex[:6]}",
            "modulos": [{
                "titulo": "M",
                "lecciones": [{
                    "titulo": "L",
                    "duracion": "5 min",
                    "video_url": f"http://localhost:5173/api{VIDEO_LECCION_1}",
                    "recursos": [{
                        "nombre": "Matriz.xlsx",
                        "url": f"/api/api{RECURSO_MATRIZ}",
                        "tipo": "plantilla",
                    }],
                }],
            }],
        }

        created = client.post("/cursos", json=legacy, headers=auth_headers_for(dueño))
        assert created.status_code == status.HTTP_201_CREATED

        leccion = created.json()["modulos"][0]["lecciones"][0]
        assert leccion["video_url"] == VIDEO_LECCION_1
        assert leccion["recursos"][0]["url"] == RECURSO_MATRIZ

    def test_portada_externa_se_conserva(self, client, empresa):
        _, dueño = empresa
        created = client.post("/cursos", json=CURSO_PAYLOAD, headers=auth_headers_for(dueño))
        assert created.status_code == status.HTTP_201_CREATED
        assert created.json()["portada_url"] == CURSO_PAYLOAD["portada_url"]


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

        # Tras compra, el contenido completo es visible
        det_auth = client.get(
            f"/cursos/{curso['id']}", headers=auth_headers_for(solicitante)
        ).json()
        assert all(l["video_url"] for m in det_auth["modulos"] for l in m["lecciones"])

    def test_cuenta_de_empresa_tambien_puede_inscribirse(self, client, empresa):
        """Un dueño o asesor puede tomar cursos: limitar la compra al rol
        "solicitante" devolvía 403 a las cuentas de empresa."""
        _, dueño = empresa
        curso = client.post("/cursos", json=CURSO_PAYLOAD, headers=auth_headers_for(dueño)).json()
        r = client.post(f"/cursos/{curso['id']}/comprar", headers=auth_headers_for(dueño))
        assert r.status_code == status.HTTP_201_CREATED
        assert r.json()["curso_id"] == curso["id"]

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
