"""Verificación de empresas: expediente, sello y retirada.

El botón de verificar existía, pero cambiaba el flag sin más: quien lo pulsaba
no tenía delante nada sobre lo que decidir, y una vez puesto el sello no había
forma de quitarlo.
"""
import pytest
from uuid import uuid4
from datetime import datetime

from fastapi import status

from models.importador import Importador
from models.orden import EstadoOrden, Orden
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.usuario import Usuario
from utils.security import hash_password
from conftest import auth_headers_for, crear_empresa_importadora


@pytest.fixture()
def admin(db_session):
    user = Usuario(
        id=str(uuid4()), email="admin_verif@example.com", password_hash=hash_password("123456789"),
        rol="admin", nombre="Admin Verificación", activo=True, fecha_creacion=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def empresa(db_session):
    """Empresa que cumple todo lo obligatorio."""
    importador, dueño = crear_empresa_importadora(
        db_session, nombre_empresa="Empresa Verificable", email_dueño="dueño_verif@example.com"
    )
    importador.especialidad_producto = ["Textil"]
    importador.paises_origen = ["China"]
    importador.shipping_mark_prefijo = "evf"
    dueño.email_verificado = True
    dueño.activo = True
    db_session.commit()
    db_session.refresh(importador)
    return importador, dueño


class TestExpediente:
    def test_devuelve_los_requisitos_con_su_estado(self, client, empresa, admin):
        importador, _dueño = empresa

        response = client.get(f"/admin/importadores/{importador.id}/expediente", headers=auth_headers_for(admin))
        assert response.status_code == 200
        cuerpo = response.json()

        assert cuerpo["nombre_empresa"] == "Empresa Verificable"
        assert len(cuerpo["obligatorios"]) == cuerpo["obligatorios_totales"]
        assert all({"clave", "titulo", "detalle", "cumple", "valor"} <= set(r) for r in cuerpo["obligatorios"])

    def test_una_empresa_completa_esta_lista(self, client, empresa, admin):
        importador, _dueño = empresa
        cuerpo = client.get(
            f"/admin/importadores/{importador.id}/expediente", headers=auth_headers_for(admin)
        ).json()

        assert cuerpo["listo_para_verificar"] is True
        assert cuerpo["pendientes"] == []

    def test_señala_exactamente_lo_que_falta(self, client, db_session, empresa, admin):
        importador, _dueño = empresa
        importador.shipping_mark_prefijo = None
        importador.especialidad_producto = []
        db_session.commit()

        cuerpo = client.get(
            f"/admin/importadores/{importador.id}/expediente", headers=auth_headers_for(admin)
        ).json()

        assert cuerpo["listo_para_verificar"] is False
        assert "Prefijo de marca de embarque" in cuerpo["pendientes"]
        assert "Especialidad declarada" in cuerpo["pendientes"]

    def test_una_orden_en_disputa_bloquea(self, client, db_session, empresa, admin):
        """No se avala a quien tiene un problema sin resolver encima de la mesa."""
        importador, _dueño = empresa
        cliente = Usuario(
            id=str(uuid4()), email="cli_verif@example.com", password_hash=hash_password("123456789"),
            rol="solicitante", perfil_completo=True, fecha_creacion=datetime.utcnow(),
        )
        db_session.add(cliente)
        cotizacion = Cotizacion(
            id=str(uuid4()), solicitante_id=cliente.id, importador_id=importador.id,
            modalidad="dirigida", pais_importacion="China", nombre_producto="Producto Verif",
            descripcion_cliente="Descripción de prueba para la disputa de verificación",
            linea_producto="Textil", tipo_calidad="estandar", cantidad_minima=10,
            precio_objetivo_usd=1.0, incoterm="FOB", estado=EstadoCotizacion.orden_activa,
        )
        db_session.add(cotizacion)
        db_session.add(Orden(
            id=str(uuid4()), cotizacion_id=cotizacion.id, importador_id=importador.id,
            solicitante_id=cliente.id, estado=EstadoOrden.cotizacion_aceptada,
            precio_acordado_usd=1.0, en_disputa=True, motivo_disputa="Llegó incompleto",
        ))
        db_session.commit()

        cuerpo = client.get(
            f"/admin/importadores/{importador.id}/expediente", headers=auth_headers_for(admin)
        ).json()
        assert "Sin incidentes abiertos" in cuerpo["pendientes"]

    def test_lo_recomendable_no_bloquea(self, client, empresa, admin):
        """Una empresa nueva sin reseñas ni logo puede verificarse igual."""
        importador, _dueño = empresa
        cuerpo = client.get(
            f"/admin/importadores/{importador.id}/expediente", headers=auth_headers_for(admin)
        ).json()

        assert cuerpo["recomendables_cumplidos"] < cuerpo["recomendables_totales"]
        assert cuerpo["listo_para_verificar"] is True

    def test_solo_administracion_lo_consulta(self, client, empresa):
        importador, dueño = empresa
        response = client.get(
            f"/admin/importadores/{importador.id}/expediente", headers=auth_headers_for(dueño)
        )
        assert response.status_code == 403

    def test_empresa_inexistente(self, client, admin):
        response = client.get(
            f"/admin/importadores/{uuid4()}/expediente", headers=auth_headers_for(admin)
        )
        assert response.status_code == 404


class TestVerificar:
    def test_se_verifica_cuando_cumple(self, client, db_session, empresa, admin):
        importador, _dueño = empresa

        response = client.post(
            f"/admin/importadores/{importador.id}/verificar", headers=auth_headers_for(admin)
        )
        assert response.status_code == 200
        assert response.json()["verificado"] is True

        db_session.refresh(importador)
        assert importador.verificado is True

    def test_no_se_verifica_a_medias(self, client, db_session, empresa, admin):
        """El sello lo ve el cliente al elegir: ponerlo sobre una ficha
        incompleta es lo que lo vacía de significado."""
        importador, _dueño = empresa
        importador.shipping_mark_prefijo = None
        db_session.commit()

        response = client.post(
            f"/admin/importadores/{importador.id}/verificar", headers=auth_headers_for(admin)
        )
        assert response.status_code == 400
        assert "Prefijo de marca de embarque" in response.json()["detail"]

        db_session.refresh(importador)
        assert importador.verificado is False

    def test_el_mensaje_dice_todo_lo_que_falta(self, client, db_session, empresa, admin):
        importador, dueño = empresa
        importador.paises_origen = []
        dueño.email_verificado = False
        db_session.commit()

        detalle = client.post(
            f"/admin/importadores/{importador.id}/verificar", headers=auth_headers_for(admin)
        ).json()["detail"]

        assert "Países de origen" in detalle
        assert "Correo del representante verificado" in detalle

    def test_una_empresa_no_se_verifica_a_si_misma(self, client, empresa):
        importador, dueño = empresa
        response = client.post(
            f"/admin/importadores/{importador.id}/verificar", headers=auth_headers_for(dueño)
        )
        assert response.status_code == 403


class TestRetirarVerificacion:
    def test_se_retira_con_motivo(self, client, db_session, empresa, admin):
        importador, _dueño = empresa
        client.post(f"/admin/importadores/{importador.id}/verificar", headers=auth_headers_for(admin))

        response = client.post(
            f"/admin/importadores/{importador.id}/retirar-verificacion",
            json={"motivo": "Dejó de responder a sus clientes durante un mes"},
            headers=auth_headers_for(admin),
        )
        assert response.status_code == 200
        assert response.json()["verificado"] is False

    def test_retirar_no_desactiva_la_empresa(self, client, db_session, empresa, admin):
        """Deja de estar avalada, pero sigue operando."""
        importador, _dueño = empresa
        client.post(f"/admin/importadores/{importador.id}/verificar", headers=auth_headers_for(admin))
        client.post(
            f"/admin/importadores/{importador.id}/retirar-verificacion",
            json={"motivo": "Incumplimientos reiterados en los plazos"},
            headers=auth_headers_for(admin),
        )

        db_session.refresh(importador)
        assert importador.verificado is False
        assert importador.estado == "activo"

    def test_avisa_al_dueño_con_el_motivo(self, client, db_session, empresa, admin):
        from models.notificacion import Notificacion

        importador, dueño = empresa
        client.post(f"/admin/importadores/{importador.id}/verificar", headers=auth_headers_for(admin))
        client.post(
            f"/admin/importadores/{importador.id}/retirar-verificacion",
            json={"motivo": "Documentación caducada"},
            headers=auth_headers_for(admin),
        )

        aviso = db_session.query(Notificacion).filter(
            Notificacion.usuario_id == str(dueño.id), Notificacion.tipo == "empresa"
        ).first()
        assert aviso is not None
        assert "Documentación caducada" in aviso.mensaje

    def test_no_se_retira_a_quien_no_lo_tiene(self, client, empresa, admin):
        importador, _dueño = empresa
        response = client.post(
            f"/admin/importadores/{importador.id}/retirar-verificacion",
            json={"motivo": "Un motivo cualquiera"},
            headers=auth_headers_for(admin),
        )
        assert response.status_code == 400

    def test_el_motivo_es_obligatorio(self, client, empresa, admin):
        importador, _dueño = empresa
        client.post(f"/admin/importadores/{importador.id}/verificar", headers=auth_headers_for(admin))

        response = client.post(
            f"/admin/importadores/{importador.id}/retirar-verificacion",
            json={"motivo": "x"},
            headers=auth_headers_for(admin),
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_una_empresa_no_se_retira_el_sello_a_otra(self, client, db_session, empresa, admin):
        importador, _dueño = empresa
        client.post(f"/admin/importadores/{importador.id}/verificar", headers=auth_headers_for(admin))

        otra, otro_dueño = crear_empresa_importadora(
            db_session, nombre_empresa="Empresa Rival Verif", email_dueño="rival_verif@example.com"
        )
        response = client.post(
            f"/admin/importadores/{importador.id}/retirar-verificacion",
            json={"motivo": "Quiero quitarle el sello a la competencia"},
            headers=auth_headers_for(otro_dueño),
        )
        assert response.status_code == 403
