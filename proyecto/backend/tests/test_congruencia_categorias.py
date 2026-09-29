"""Congruencia de categorías entre la cotización y la especialidad de la empresa.

Este es el origen del "error de roles" que reportaba el equipo: el formulario de
cotización y el perfil de empresa ofrecían vocabularios distintos ("Químicos"
frente a "Química", "Textiles" frente a "Textil") y la comparación era de cadena
exacta. La empresa veía la cotización en su bandeja, pulsaba "Responder" y
recibía un 400 que parecía un problema de permisos.

Se cubren las tres piezas del arreglo:
- la comparación normalizada (`utils.categorias`),
- el aviso al cliente al dirigir una cotización a una empresa que no trabaja esa
  línea, en lugar de dejar el callejón sin salida para la empresa,
- la bandeja de la empresa, que ya solo muestra abiertas que puede responder.
"""
from datetime import datetime
from uuid import uuid4

import pytest
from fastapi import status

from models.cotizacion import Cotizacion
from models.usuario import Usuario
from utils.categorias import CATEGORIAS_CANONICAS, categoria_en, clave_categoria, texto_en
from utils.security import hash_password
from conftest import auth_headers_for, crear_empresa_importadora, crear_usuario_con_token


class TestClaveCategoria:
    @pytest.mark.parametrize(
        "a, b",
        [
            ("Químicos", "Química"),
            ("Textiles", "Textil"),
            ("TEXTIL", "textil"),
            ("  Alimentos  ", "alimento"),
            ("Tecnología", "tecnologia"),
            ("Electrónicos", "Electrónica"),
            ("Farmacéuticos", "Farmacéutico"),
            ("Confecciones", "Confección"),
            ("Máquinas", "Maquinaria"),
            ("Consumo", "Consumo masivo"),
            ("Industria", "Industrial"),
        ],
    )
    def test_variantes_que_deben_coincidir(self, a, b):
        assert clave_categoria(a) == clave_categoria(b)

    @pytest.mark.parametrize(
        "a, b",
        [
            ("Textil", "Alimentos"),
            ("Tecnología", "Maquinaria"),
            ("Química", "Construcción"),
            ("Software", "Seguridad"),
        ],
    )
    def test_categorias_distintas_no_se_mezclan(self, a, b):
        assert clave_categoria(a) != clave_categoria(b)

    def test_valores_vacios_no_generan_clave(self):
        assert clave_categoria(None) == ""
        assert clave_categoria("") == ""
        assert clave_categoria("   ") == ""
        assert clave_categoria(123) == ""


class TestCategoriaEn:
    def test_encaja_pese_a_la_variante_lexica(self):
        assert categoria_en("Químicos", ["Química", "Alimentos"]) is True

    def test_no_encaja_con_otra_categoria(self):
        assert categoria_en("Textil", ["Química", "Alimentos"]) is False

    def test_empresa_sin_especialidad_no_queda_bloqueada(self):
        """Sin especialidad declarada no hay motivo para afirmar que no le compete."""
        assert categoria_en("Textil", []) is True
        assert categoria_en("Textil", None) is True

    def test_pais_tolera_tildes_y_mayusculas(self):
        assert texto_en("Japón", ["japon", "China"]) is True
        assert texto_en("Japón", ["China"]) is False
        assert texto_en("China", None) is False


# --------------------------------------------------------------------------
# Escenarios de API
# --------------------------------------------------------------------------

def _payload_cotizacion(**overrides):
    payload = {
        "modalidad": "abierta",
        "pais_importacion": "China",
        "nombre_producto": "Bidones de solvente industrial",
        "descripcion_cliente": "Necesito 500 bidones de solvente para uso industrial",
        "linea_producto": "Químicos",
        "tipo_calidad": "estandar",
        "cantidad_minima": 500,
        "incoterm": "FOB",
    }
    payload.update(overrides)
    return payload


def _payload_propuesta(cotizacion_id):
    return {
        "cotizacion_id": cotizacion_id,
        "precio_ofrecido_usd": 1500.0,
        "tiempo_estimado_entrega": "45 días",
        "incoterm": "FOB",
    }


def _crear_cotizacion_en_bd(db_session, solicitante_id, **overrides):
    """Cotización insertada directamente, para montar escenarios heredados."""
    datos = {
        "modalidad": "abierta",
        "pais_importacion": "China",
        "nombre_producto": "Producto de prueba",
        "descripcion_cliente": "Descripción suficientemente larga para el esquema",
        "linea_producto": "Químicos",
        "tipo_calidad": "estandar",
        "cantidad_minima": 100,
        "incoterm": "FOB",
        "estado": "abierta",
    }
    datos.update(overrides)
    cotizacion = Cotizacion(id=str(uuid4()), solicitante_id=solicitante_id, **datos)
    db_session.add(cotizacion)
    db_session.commit()
    db_session.refresh(cotizacion)
    return cotizacion


@pytest.fixture()
def solicitante(db_session):
    return crear_usuario_con_token(db_session, rol="solicitante")


@pytest.fixture()
def empresa_quimica(db_session):
    """Empresa cuya especialidad se escribió "Química" (perfil de empresa)."""
    return crear_empresa_importadora(
        db_session,
        nombre_empresa=f"Química {uuid4().hex[:6]}",
        email_dueño=f"quimica_{uuid4().hex[:6]}@example.com",
        especialidad_producto=["Química"],
    )


@pytest.fixture()
def empresa_textil(db_session):
    return crear_empresa_importadora(
        db_session,
        nombre_empresa=f"Textil {uuid4().hex[:6]}",
        email_dueño=f"textil_{uuid4().hex[:6]}@example.com",
        especialidad_producto=["Textil"],
    )


class TestResponderPeseALaVarianteLexica:
    def test_la_empresa_responde_una_linea_escrita_distinto(self, client, db_session, solicitante, empresa_quimica):
        """El cliente elige "Químicos" y la empresa declaró "Química": debe poder responder."""
        _, headers_solicitante = solicitante
        importador, dueño = empresa_quimica

        creada = client.post("/cotizaciones", json=_payload_cotizacion(), headers=headers_solicitante)
        assert creada.status_code == status.HTTP_201_CREATED, creada.text

        respuesta = client.post(
            "/propuestas",
            json=_payload_propuesta(creada.json()["id"]),
            headers=auth_headers_for(dueño),
        )
        assert respuesta.status_code == status.HTTP_201_CREATED, respuesta.text

    def test_la_empresa_de_otra_categoria_sigue_sin_poder_responder(self, client, solicitante, empresa_textil):
        _, headers_solicitante = solicitante
        _, dueño = empresa_textil

        creada = client.post("/cotizaciones", json=_payload_cotizacion(), headers=headers_solicitante)
        assert creada.status_code == status.HTTP_201_CREATED

        respuesta = client.post(
            "/propuestas",
            json=_payload_propuesta(creada.json()["id"]),
            headers=auth_headers_for(dueño),
        )
        assert respuesta.status_code == status.HTTP_400_BAD_REQUEST
        assert "congruente" in respuesta.json()["detail"]


class TestCotizacionDirigida:
    def test_no_se_puede_dirigir_a_una_empresa_de_otra_linea(self, client, solicitante, empresa_textil):
        """El aviso llega al cliente al crearla, no a la empresa al responderla."""
        _, headers_solicitante = solicitante
        importador, _ = empresa_textil

        respuesta = client.post(
            "/cotizaciones",
            json=_payload_cotizacion(modalidad="dirigida", importador_id=str(importador.id)),
            headers=headers_solicitante,
        )

        assert respuesta.status_code == status.HTTP_400_BAD_REQUEST
        detalle = respuesta.json()["detail"]
        assert importador.nombre_empresa in detalle
        assert "Químicos" in detalle

    def test_se_puede_dirigir_con_la_variante_lexica(self, client, solicitante, empresa_quimica):
        _, headers_solicitante = solicitante
        importador, _ = empresa_quimica

        respuesta = client.post(
            "/cotizaciones",
            json=_payload_cotizacion(modalidad="dirigida", importador_id=str(importador.id)),
            headers=headers_solicitante,
        )

        assert respuesta.status_code == status.HTTP_201_CREATED, respuesta.text


class TestBandejaDeLaEmpresa:
    def test_no_se_listan_abiertas_de_otra_categoria(self, client, db_session, solicitante, empresa_textil):
        usuario_solicitante, _ = solicitante
        _, dueño = empresa_textil
        _crear_cotizacion_en_bd(db_session, usuario_solicitante.id, linea_producto="Químicos")

        listado = client.get("/cotizaciones", headers=auth_headers_for(dueño))
        assert listado.status_code == status.HTTP_200_OK
        assert listado.json() == []

    def test_si_se_listan_las_abiertas_de_su_categoria(self, client, db_session, solicitante, empresa_textil):
        usuario_solicitante, _ = solicitante
        _, dueño = empresa_textil
        propia = _crear_cotizacion_en_bd(db_session, usuario_solicitante.id, linea_producto="Textiles")

        listado = client.get("/cotizaciones", headers=auth_headers_for(dueño))
        assert [c["id"] for c in listado.json()] == [str(propia.id)]

    def test_las_dirigidas_a_la_empresa_se_listan_siempre(self, client, db_session, solicitante, empresa_textil):
        """Aunque sean heredadas e incongruentes: ocultarle algo que le enviaron es peor."""
        usuario_solicitante, _ = solicitante
        importador, dueño = empresa_textil
        dirigida = _crear_cotizacion_en_bd(
            db_session,
            usuario_solicitante.id,
            modalidad="dirigida",
            estado="dirigida",
            importador_id=str(importador.id),
            linea_producto="Químicos",
        )

        listado = client.get("/cotizaciones", headers=auth_headers_for(dueño))
        assert str(dirigida.id) in [c["id"] for c in listado.json()]

    def test_la_empresa_de_solo_directas_no_ve_el_pool_abierto(self, client, db_session, solicitante):
        usuario_solicitante, _ = solicitante
        _, dueño = crear_empresa_importadora(
            db_session,
            nombre_empresa=f"Solo directas {uuid4().hex[:6]}",
            email_dueño=f"directas_{uuid4().hex[:6]}@example.com",
            especialidad_producto=["Químicos"],
            solo_cotizaciones_directas=True,
        )
        _crear_cotizacion_en_bd(db_session, usuario_solicitante.id, linea_producto="Químicos")

        listado = client.get("/cotizaciones", headers=auth_headers_for(dueño))
        assert listado.json() == []

    def test_el_asesor_ve_la_misma_bandeja_filtrada(self, client, db_session, solicitante, empresa_textil):
        usuario_solicitante, _ = solicitante
        importador, _ = empresa_textil
        asesor = Usuario(
            id=str(uuid4()),
            email=f"asesor_{uuid4().hex[:6]}@example.com",
            password_hash=hash_password("ClaveSegura1"),
            rol="asesor",
            importador_id=importador.id,
            activo=True,
            email_verificado=True,
            fecha_creacion=datetime.utcnow(),
        )
        db_session.add(asesor)
        db_session.commit()

        _crear_cotizacion_en_bd(db_session, usuario_solicitante.id, linea_producto="Químicos")
        propia = _crear_cotizacion_en_bd(db_session, usuario_solicitante.id, linea_producto="Textiles")

        listado = client.get("/cotizaciones", headers=auth_headers_for(asesor))
        assert [c["id"] for c in listado.json()] == [str(propia.id)]


class TestMensajeDeBorradorExistente:
    def test_el_dueno_recibe_un_mensaje_util_si_ya_hay_borrador(self, client, db_session, solicitante, empresa_textil):
        """Antes decía "ya has enviado una propuesta" sobre un borrador sin enviar."""
        usuario_solicitante, _ = solicitante
        importador, dueño = empresa_textil
        asesor = Usuario(
            id=str(uuid4()),
            email=f"asesor_{uuid4().hex[:6]}@example.com",
            password_hash=hash_password("ClaveSegura1"),
            rol="asesor",
            importador_id=importador.id,
            activo=True,
            email_verificado=True,
            fecha_creacion=datetime.utcnow(),
        )
        db_session.add(asesor)
        db_session.commit()

        cotizacion = _crear_cotizacion_en_bd(
            db_session,
            usuario_solicitante.id,
            linea_producto="Textil",
            asesor_asignado_id=str(asesor.id),
        )

        borrador = client.post(
            "/propuestas/borrador",
            json=_payload_propuesta(str(cotizacion.id)),
            headers=auth_headers_for(asesor),
        )
        assert borrador.status_code == status.HTTP_201_CREATED, borrador.text

        respuesta = client.post(
            "/propuestas",
            json=_payload_propuesta(str(cotizacion.id)),
            headers=auth_headers_for(dueño),
        )
        assert respuesta.status_code == status.HTTP_400_BAD_REQUEST
        assert "borrador" in respuesta.json()["detail"].lower()


class TestTeleventa:
    """«Televenta» se añadió al vocabulario a petición del negocio."""

    def test_esta_en_el_vocabulario(self):
        assert "Televenta" in CATEGORIAS_CANONICAS

    @pytest.mark.parametrize(
        "escrito",
        ["Televenta", "televentas", "Tele Venta", "VENTAS TELEFÓNICAS", "Call Center"],
    )
    def test_variantes_encajan_con_la_especialidad(self, escrito):
        assert categoria_en(escrito, ["Televenta"]) is True

    def test_no_encaja_con_otra_especialidad(self):
        assert categoria_en("Televenta", ["Textil"]) is False
