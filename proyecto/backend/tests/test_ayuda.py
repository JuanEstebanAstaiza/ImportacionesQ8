"""Documentación de ayuda: consulta filtrada por rol y mantenimiento.

Vivía en un archivo del frontend, así que responder a una duda nueva exigía
desplegar y en la práctica la documentación no crecía. Ahora la escribe el
equipo de soporte desde el panel.
"""
import pytest
from uuid import uuid4
from datetime import datetime

from models.ayuda import ArticuloAyuda
from models.usuario import Usuario
from utils.security import hash_password
from conftest import auth_headers_for, crear_empresa_importadora


def _articulo(db_session, titulo, *, categoria="Cotizaciones", roles=None, publicado=True, contenido="Paso a paso"):
    articulo = ArticuloAyuda(
        id=str(uuid4()), titulo=titulo, resumen=f"Resumen de {titulo}",
        contenido=contenido, categoria=categoria, roles=roles or [],
        orden=100, publicado=publicado,
    )
    db_session.add(articulo)
    db_session.commit()
    db_session.refresh(articulo)
    return articulo


@pytest.fixture()
def cliente(db_session):
    user = Usuario(
        id=str(uuid4()), email="cliente_ayuda@example.com", password_hash=hash_password("123456789"),
        rol="solicitante", nombre="Cliente Ayuda", perfil_completo=True, fecha_creacion=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def empresa(db_session):
    return crear_empresa_importadora(
        db_session, nombre_empresa="Empresa Ayuda", email_dueño="dueño_ayuda@example.com"
    )


@pytest.fixture()
def agente(db_session):
    user = Usuario(
        id=str(uuid4()), email="agente_ayuda@example.com", password_hash=hash_password("123456789"),
        rol="soporte", nombre="Agente Ayuda", nivel_soporte=2, activo=True, fecha_creacion=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


class TestConsulta:
    def test_cualquier_usuario_lee_la_documentacion(self, client, db_session, cliente):
        _articulo(db_session, "Cómo creo una cotización")

        response = client.get("/ayuda/articulos", headers=auth_headers_for(cliente))
        assert response.status_code == 200
        assert response.json()["total"] == 1

    def test_sin_sesion_no_se_lee(self, client, db_session):
        _articulo(db_session, "Artículo cualquiera de prueba")
        assert client.get("/ayuda/articulos").status_code == 401

    def test_cada_perfil_ve_lo_suyo(self, client, db_session, cliente, empresa):
        """Un artículo sobre el pool de cotizaciones no le dice nada a un cliente."""
        _importador, dueño = empresa
        _articulo(db_session, "Cómo tomo del pool", roles=["asesor"])
        _articulo(db_session, "Cómo confirmo una propuesta", roles=["importadora"])
        _articulo(db_session, "Qué es el shipping mark", roles=["solicitante"])
        _articulo(db_session, "Los estados de una orden", roles=[])

        del_cliente = client.get("/ayuda/articulos", headers=auth_headers_for(cliente)).json()
        titulos = {a["titulo"] for a in del_cliente["articulos"]}
        assert "Qué es el shipping mark" in titulos
        assert "Los estados de una orden" in titulos  # sin roles = para todos
        assert "Cómo tomo del pool" not in titulos
        assert "Cómo confirmo una propuesta" not in titulos

        de_la_empresa = client.get("/ayuda/articulos", headers=auth_headers_for(dueño)).json()
        titulos = {a["titulo"] for a in de_la_empresa["articulos"]}
        assert "Cómo confirmo una propuesta" in titulos
        assert "Qué es el shipping mark" not in titulos

    def test_el_equipo_de_soporte_ve_todo(self, client, db_session, agente):
        """Para ayudar a alguien hay que poder leer lo que esa persona lee."""
        _articulo(db_session, "Solo para asesores del pool", roles=["asesor"])
        _articulo(db_session, "Solo para solicitantes de prueba", roles=["solicitante"])

        filas = client.get("/ayuda/articulos", headers=auth_headers_for(agente)).json()
        assert filas["total"] == 2

    def test_lo_despublicado_no_se_muestra(self, client, db_session, cliente):
        _articulo(db_session, "Artículo retirado de prueba", publicado=False)

        filas = client.get("/ayuda/articulos", headers=auth_headers_for(cliente)).json()
        assert filas["total"] == 0

    def test_el_equipo_si_ve_lo_despublicado(self, client, db_session, agente):
        _articulo(db_session, "Artículo retirado de prueba", publicado=False)

        filas = client.get("/ayuda/articulos", headers=auth_headers_for(agente)).json()
        assert filas["total"] == 1

    def test_la_busqueda_mira_tambien_el_cuerpo(self, client, db_session, cliente):
        """La gente teclea lo que le pasa, no el título del artículo."""
        _articulo(
            db_session, "Problemas al publicar",
            contenido="Si ninguna empresa tiene tu línea de producto como especialidad, nadie la ve.",
        )

        filas = client.get("/ayuda/articulos?buscar=especialidad", headers=auth_headers_for(cliente)).json()
        assert filas["total"] == 1

    def test_filtro_por_categoria(self, client, db_session, cliente):
        _articulo(db_session, "Sobre cotizaciones abiertas", categoria="Cotizaciones")
        _articulo(db_session, "Sobre estados de la orden", categoria="Órdenes y seguimiento")

        filas = client.get("/ayuda/articulos?categoria=Cotizaciones", headers=auth_headers_for(cliente)).json()
        assert filas["total"] == 1
        assert filas["articulos"][0]["categoria"] == "Cotizaciones"

    def test_solo_se_ofrecen_categorias_con_contenido(self, client, db_session, cliente):
        """Un filtro que no devuelve nada es peor que no ofrecerlo."""
        _articulo(db_session, "Sobre cotizaciones abiertas", categoria="Cotizaciones")

        filas = client.get("/ayuda/articulos", headers=auth_headers_for(cliente)).json()
        assert filas["categorias"] == ["Cotizaciones"]


class TestSeñalDeUtilidad:
    def test_abrir_suma_una_lectura(self, client, db_session, cliente):
        articulo = _articulo(db_session, "Artículo que se consulta")

        assert client.post(
            f"/ayuda/articulos/{articulo.id}/visto", headers=auth_headers_for(cliente)
        ).status_code == 204

        db_session.refresh(articulo)
        assert articulo.vistas == 1

    def test_votar_util_e_inutil(self, client, db_session, cliente):
        articulo = _articulo(db_session, "Artículo que se vota")

        client.post(f"/ayuda/articulos/{articulo.id}/voto", json={"util": True}, headers=auth_headers_for(cliente))
        respuesta = client.post(
            f"/ayuda/articulos/{articulo.id}/voto", json={"util": False}, headers=auth_headers_for(cliente)
        )
        assert respuesta.status_code == 200
        assert respuesta.json()["votos_util"] == 1
        assert respuesta.json()["votos_inutil"] == 1

    def test_votar_algo_inexistente(self, client, cliente):
        respuesta = client.post(
            f"/ayuda/articulos/{uuid4()}/voto", json={"util": True}, headers=auth_headers_for(cliente)
        )
        assert respuesta.status_code == 404


class TestMantenimiento:
    def test_el_equipo_publica_un_articulo(self, client, db_session, agente):
        respuesta = client.post(
            "/ayuda/articulos",
            json={
                "titulo": "Qué hago si no me llega el correo de verificación",
                "resumen": "Revisa la carpeta de no deseado y pide el reenvío desde la pantalla de acceso.",
                "contenido": "Pasos detallados.",
                "categoria": "Cuenta y accesos",
                "roles": ["solicitante"],
            },
            headers=auth_headers_for(agente),
        )
        assert respuesta.status_code == 201
        assert respuesta.json()["publicado"] is True

        assert db_session.query(ArticuloAyuda).filter(
            ArticuloAyuda.titulo == "Qué hago si no me llega el correo de verificación"
        ).first() is not None

    def test_un_cliente_no_escribe_documentacion(self, client, cliente):
        respuesta = client.post(
            "/ayuda/articulos",
            json={
                "titulo": "Artículo escrito por un cliente",
                "resumen": "Esto no debería poder publicarse nunca.",
                "categoria": "Cotizaciones",
            },
            headers=auth_headers_for(cliente),
        )
        assert respuesta.status_code == 403

    def test_una_empresa_tampoco(self, client, empresa):
        _importador, dueño = empresa
        respuesta = client.post(
            "/ayuda/articulos",
            json={
                "titulo": "Artículo escrito por una empresa",
                "resumen": "Esto no debería poder publicarse nunca.",
                "categoria": "Cotizaciones",
            },
            headers=auth_headers_for(dueño),
        )
        assert respuesta.status_code == 403

    def test_editar_solo_cambia_lo_enviado(self, client, db_session, agente):
        articulo = _articulo(db_session, "Título original de prueba", contenido="Cuerpo original")

        respuesta = client.put(
            f"/ayuda/articulos/{articulo.id}",
            json={"titulo": "Título corregido de prueba"},
            headers=auth_headers_for(agente),
        )
        assert respuesta.status_code == 200
        assert respuesta.json()["titulo"] == "Título corregido de prueba"
        # El cuerpo no se envió: se queda como estaba.
        assert respuesta.json()["contenido"] == "Cuerpo original"

    def test_despublicar_no_borra(self, client, db_session, agente):
        """Un artículo retirado puede seguir siendo la respuesta a un ticket viejo."""
        articulo = _articulo(db_session, "Artículo que se retira")

        respuesta = client.delete(f"/ayuda/articulos/{articulo.id}", headers=auth_headers_for(agente))
        assert respuesta.status_code == 200
        assert respuesta.json()["publicado"] is False

        db_session.refresh(articulo)
        assert articulo is not None
        assert articulo.publicado is False

    def test_el_titulo_muy_corto_se_rechaza(self, client, agente):
        respuesta = client.post(
            "/ayuda/articulos",
            json={"titulo": "ab", "resumen": "Un resumen suficientemente largo", "categoria": "Cotizaciones"},
            headers=auth_headers_for(agente),
        )
        assert respuesta.status_code == 422

    def test_las_categorias_sugeridas_son_del_equipo(self, client, agente, cliente):
        assert client.get("/ayuda/categorias", headers=auth_headers_for(agente)).status_code == 200
        assert client.get("/ayuda/categorias", headers=auth_headers_for(cliente)).status_code == 403
