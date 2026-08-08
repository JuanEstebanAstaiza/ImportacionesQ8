"""Reseñas de empresas importadoras y la calificación que alimentan.

`Importador.calificacion_promedio` llevaba desde el esquema inicial como una
columna que el catálogo mostraba pero que nadie escribía. Estas pruebas fijan
las dos cosas que hacen que esa nota signifique algo:

- solo reseña quien importó de verdad (hay una orden entregada de por medio),
- el promedio del catálogo se deriva de las reseñas visibles, no de un valor
  suelto que alguien dejó en un seed.
"""
from datetime import datetime
from uuid import uuid4

import pytest
from fastapi import status

from models.cotizacion import Cotizacion
from models.orden import EstadoOrden, Orden
from models.importador import Importador
from conftest import auth_headers_for, crear_empresa_importadora, crear_usuario_con_token


@pytest.fixture()
def solicitante(db_session):
    return crear_usuario_con_token(db_session, rol="solicitante", nombre="Paula")


@pytest.fixture()
def empresa(db_session):
    return crear_empresa_importadora(
        db_session,
        nombre_empresa=f"Empresa Resenada {uuid4().hex[:6]}",
        email_dueño=f"duena_{uuid4().hex[:6]}@example.com",
    )


def _orden(db_session, solicitante_id, importador_id, estado=EstadoOrden.entregado.value):
    cotizacion = Cotizacion(
        id=str(uuid4()),
        solicitante_id=solicitante_id,
        importador_id=importador_id,
        modalidad="dirigida",
        pais_importacion="China",
        nombre_producto="Camisetas personalizadas",
        descripcion_cliente="500 camisetas con logo impreso en algodon premium",
        linea_producto="Textiles",
        tipo_calidad="estandar",
        cantidad_minima=500,
        incoterm="FOB",
        estado="orden_activa",
    )
    db_session.add(cotizacion)
    db_session.commit()

    orden = Orden(
        id=str(uuid4()),
        cotizacion_id=cotizacion.id,
        importador_id=importador_id,
        solicitante_id=solicitante_id,
        estado=estado,
        precio_acordado_usd=1500.0,
        fecha_creacion=datetime.utcnow(),
    )
    db_session.add(orden)
    db_session.commit()
    db_session.refresh(orden)
    return orden


def _payload(orden_id, **overrides):
    datos = {
        "orden_id": str(orden_id),
        "calificacion": 5,
        "comentario": "Cumplieron el plazo y la calidad fue la acordada.",
        "puntualidad": 5,
        "calidad_producto": 4,
        "comunicacion": 5,
    }
    datos.update(overrides)
    return datos


class TestQuienPuedeResenar:
    def test_el_cliente_de_una_orden_entregada_puede(self, client, db_session, solicitante, empresa):
        usuario, headers = solicitante
        importador, _ = empresa
        orden = _orden(db_session, usuario.id, str(importador.id))

        respuesta = client.post("/resenas", json=_payload(orden.id), headers=headers)

        assert respuesta.status_code == status.HTTP_201_CREATED, respuesta.text
        cuerpo = respuesta.json()
        assert cuerpo["calificacion"] == 5
        assert cuerpo["importador_id"] == str(importador.id)
        # Se publica el nombre de pila, no el correo ni el id del autor.
        assert cuerpo["autor_nombre"] == "Paula"

    def test_no_se_resena_una_orden_ajena(self, client, db_session, solicitante, empresa):
        """Sin esto, cualquiera podria puntuar a cualquier empresa."""
        usuario, _ = solicitante
        importador, _ = empresa
        orden = _orden(db_session, usuario.id, str(importador.id))

        _, headers_intruso = crear_usuario_con_token(db_session, rol="solicitante")
        respuesta = client.post("/resenas", json=_payload(orden.id), headers=headers_intruso)

        assert respuesta.status_code == status.HTTP_403_FORBIDDEN

    def test_no_se_resena_antes_de_la_entrega(self, client, db_session, solicitante, empresa):
        """Reseñar una orden recien creada mide expectativas, no cumplimiento."""
        usuario, headers = solicitante
        importador, _ = empresa
        orden = _orden(db_session, usuario.id, str(importador.id), estado=EstadoOrden.en_produccion.value)

        respuesta = client.post("/resenas", json=_payload(orden.id), headers=headers)

        assert respuesta.status_code == status.HTTP_400_BAD_REQUEST
        assert "bodega" in respuesta.json()["detail"] or "entrega" in respuesta.json()["detail"]

    def test_una_orden_solo_se_resena_una_vez(self, client, db_session, solicitante, empresa):
        usuario, headers = solicitante
        importador, _ = empresa
        orden = _orden(db_session, usuario.id, str(importador.id))

        assert client.post("/resenas", json=_payload(orden.id), headers=headers).status_code == 201
        repetida = client.post("/resenas", json=_payload(orden.id), headers=headers)

        assert repetida.status_code == status.HTTP_409_CONFLICT

    def test_la_empresa_no_puede_resenarse(self, client, db_session, solicitante, empresa):
        usuario, _ = solicitante
        importador, dueño = empresa
        orden = _orden(db_session, usuario.id, str(importador.id))

        respuesta = client.post("/resenas", json=_payload(orden.id), headers=auth_headers_for(dueño))
        assert respuesta.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.parametrize("nota", [0, 6, -1])
    def test_la_calificacion_esta_acotada(self, client, db_session, solicitante, empresa, nota):
        usuario, headers = solicitante
        importador, _ = empresa
        orden = _orden(db_session, usuario.id, str(importador.id))

        respuesta = client.post("/resenas", json=_payload(orden.id, calificacion=nota), headers=headers)
        assert respuesta.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestCalificacionDelCatalogo:
    def _resenar(self, client, db_session, importador, nota):
        usuario, headers = crear_usuario_con_token(db_session, rol="solicitante")
        orden = _orden(db_session, usuario.id, str(importador.id))
        respuesta = client.post("/resenas", json=_payload(orden.id, calificacion=nota), headers=headers)
        assert respuesta.status_code == 201, respuesta.text

    def test_el_promedio_del_catalogo_sale_de_las_resenas(self, client, db_session, empresa):
        """Antes era una columna suelta que nadie escribia."""
        importador, _ = empresa
        assert importador.calificacion_promedio == 4.5  # valor del fixture

        for nota in (5, 4, 3):
            self._resenar(client, db_session, importador, nota)

        db_session.expire_all()
        fila = next(i for i in client.get("/importadores").json() if i["id"] == str(importador.id))
        assert fila["calificacion_promedio"] == 4.0

    def test_el_resumen_reparte_por_estrellas(self, client, db_session, empresa):
        importador, _ = empresa
        for nota in (5, 5, 3):
            self._resenar(client, db_session, importador, nota)

        resumen = client.get(f"/resenas/importador/{importador.id}/resumen").json()
        assert resumen["total"] == 3
        assert resumen["promedio"] == pytest.approx(4.33, abs=0.01)
        assert resumen["reparto"]["5"] == 2
        assert resumen["reparto"]["3"] == 1
        assert resumen["reparto"]["1"] == 0

    def test_una_resena_oculta_deja_de_contar(self, client, db_session, empresa):
        importador, _ = empresa
        usuario, headers = crear_usuario_con_token(db_session, rol="solicitante")
        orden = _orden(db_session, usuario.id, str(importador.id))
        resena = client.post("/resenas", json=_payload(orden.id, calificacion=1), headers=headers).json()
        self._resenar(client, db_session, importador, 5)

        _, headers_admin = crear_usuario_con_token(db_session, rol="admin")
        oculta = client.put(
            f"/resenas/{resena['id']}/moderar",
            json={"visible": False, "motivo": "Lenguaje ofensivo"},
            headers=headers_admin,
        )
        assert oculta.status_code == status.HTTP_200_OK

        resumen = client.get(f"/resenas/importador/{importador.id}/resumen").json()
        assert resumen["total"] == 1
        assert resumen["promedio"] == 5.0


class TestLecturaYRespuesta:
    def test_el_listado_publico_no_exige_sesion(self, client, db_session, solicitante, empresa):
        """Quien esta eligiendo proveedor todavia puede no haberse registrado."""
        usuario, headers = solicitante
        importador, _ = empresa
        orden = _orden(db_session, usuario.id, str(importador.id))
        client.post("/resenas", json=_payload(orden.id), headers=headers)

        respuesta = client.get(f"/resenas/importador/{importador.id}")
        assert respuesta.status_code == status.HTTP_200_OK
        assert len(respuesta.json()) == 1

    def test_la_empresa_puede_responder(self, client, db_session, solicitante, empresa):
        usuario, headers = solicitante
        importador, dueño = empresa
        orden = _orden(db_session, usuario.id, str(importador.id))
        resena = client.post("/resenas", json=_payload(orden.id), headers=headers).json()

        respuesta = client.post(
            f"/resenas/{resena['id']}/responder",
            json={"respuesta": "Gracias por confiar en nosotros."},
            headers=auth_headers_for(dueño),
        )

        assert respuesta.status_code == status.HTTP_200_OK
        assert respuesta.json()["respuesta_empresa"] == "Gracias por confiar en nosotros."
        assert respuesta.json()["fecha_respuesta"] is not None

    def test_otra_empresa_no_puede_responder(self, client, db_session, solicitante, empresa):
        usuario, headers = solicitante
        importador, _ = empresa
        orden = _orden(db_session, usuario.id, str(importador.id))
        resena = client.post("/resenas", json=_payload(orden.id), headers=headers).json()

        _, ajena = crear_empresa_importadora(
            db_session, nombre_empresa=f"Ajena {uuid4().hex[:6]}", email_dueño=f"ajena_{uuid4().hex[:6]}@example.com"
        )
        respuesta = client.post(
            f"/resenas/{resena['id']}/responder",
            json={"respuesta": "Nada que ver conmigo"},
            headers=auth_headers_for(ajena),
        )
        assert respuesta.status_code == status.HTTP_403_FORBIDDEN

    def test_el_autor_puede_corregir_su_resena(self, client, db_session, solicitante, empresa):
        usuario, headers = solicitante
        importador, _ = empresa
        orden = _orden(db_session, usuario.id, str(importador.id))
        resena = client.post("/resenas", json=_payload(orden.id, calificacion=2), headers=headers).json()

        editada = client.put(f"/resenas/{resena['id']}", json={"calificacion": 5}, headers=headers)
        assert editada.status_code == status.HTTP_200_OK
        assert editada.json()["calificacion"] == 5

        resumen = client.get(f"/resenas/importador/{importador.id}/resumen").json()
        assert resumen["promedio"] == 5.0


class TestOrdenesPendientes:
    def test_lista_lo_que_falta_por_resenar(self, client, db_session, solicitante, empresa):
        usuario, headers = solicitante
        importador, _ = empresa
        orden = _orden(db_session, usuario.id, str(importador.id))

        pendientes = client.get("/resenas/pendientes", headers=headers).json()
        assert [p["orden_id"] for p in pendientes] == [str(orden.id)]
        assert pendientes[0]["nombre_empresa"] == importador.nombre_empresa
        assert pendientes[0]["producto"] == "Camisetas personalizadas"

    def test_la_orden_resenada_desaparece_de_la_lista(self, client, db_session, solicitante, empresa):
        usuario, headers = solicitante
        importador, _ = empresa
        orden = _orden(db_session, usuario.id, str(importador.id))
        client.post("/resenas", json=_payload(orden.id), headers=headers)

        assert client.get("/resenas/pendientes", headers=headers).json() == []

    def test_una_orden_en_produccion_no_aparece(self, client, db_session, solicitante, empresa):
        usuario, headers = solicitante
        importador, _ = empresa
        _orden(db_session, usuario.id, str(importador.id), estado=EstadoOrden.en_produccion.value)

        assert client.get("/resenas/pendientes", headers=headers).json() == []
