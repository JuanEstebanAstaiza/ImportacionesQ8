"""Tests del panel de administración (Fase 4): creación de empresas + cuenta
dueña, monitoreo/activación de cuentas, disputas y métricas de éxito del PDF."""
import pytest
from uuid import uuid4
from datetime import datetime
from fastapi import status

from models.usuario import Usuario
from models.cotizacion import Cotizacion, EstadoCotizacion
from models.propuesta import Propuesta, EstadoPropuesta
from models.orden import Orden, EstadoOrden
from utils.security import hash_password, create_access_token
from conftest import crear_usuario_con_token, crear_empresa_importadora, auth_headers_for


@pytest.fixture()
def auth_headers_admin(db_session):
    _, h = crear_usuario_con_token(db_session, rol="admin", email="admin_panel@example.com")
    return h


@pytest.fixture()
def solicitante(db_session):
    user = Usuario(
        id=str(uuid4()),
        email="solicitante_admin@example.com",
        password_hash=hash_password("ClaveSegura1"),
        rol="solicitante",
        email_verificado=True,
        perfil_completo=True,
        fecha_creacion=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture()
def empresa(db_session):
    return crear_empresa_importadora(db_session, nombre_empresa="Empresa Admin Test", email_dueño="dueño_admin@example.com")


class TestCrearImportadorConDueño:
    def test_admin_crea_empresa_y_dueño_en_un_paso(self, client, auth_headers_admin):
        response = client.post(
            "/admin/importadores",
            json={
                "nombre_empresa": "Nueva Empresa desde Admin",
                "especialidad_producto": ["Textiles"],
                "paises_origen": ["China"],
                "tiempo_respuesta_promedio": "24h",
                "email_dueño": "nuevo_dueño@example.com",
                "password_dueño": "ClaveSegura1",
                "nombre_dueño": "Dueño Nuevo"
            },
            headers=auth_headers_admin
        )
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["importador"]["nombre_empresa"] == "Nueva Empresa desde Admin"
        assert data["email_dueño"] == "nuevo_dueño@example.com"

        # La cuenta dueña puede iniciar sesión de inmediato.
        login = client.post("/auth/login", json={"email": "nuevo_dueño@example.com", "password": "ClaveSegura1"})
        assert login.status_code == status.HTTP_200_OK
        assert login.json()["rol"] == "importador"

    def test_no_admin_no_puede_crear_empresas(self, client, solicitante):
        token = create_access_token(str(solicitante.id), "solicitante")
        response = client.post(
            "/admin/importadores",
            json={
                "nombre_empresa": "Empresa No Autorizada",
                "especialidad_producto": ["Textiles"],
                "paises_origen": ["China"],
                "tiempo_respuesta_promedio": "24h",
                "email_dueño": "no_autorizado@example.com",
                "password_dueño": "ClaveSegura1"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_sin_autenticacion_es_rechazado(self, client):
        response = client.post(
            "/admin/importadores",
            json={
                "nombre_empresa": "Empresa Anonima",
                "especialidad_producto": ["Textiles"],
                "paises_origen": ["China"],
                "tiempo_respuesta_promedio": "24h",
                "email_dueño": "anonimo@example.com",
                "password_dueño": "ClaveSegura1"
            },
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_campos_requeridos_faltantes(self, client, auth_headers_admin):
        response = client.post(
            "/admin/importadores",
            json={"nombre_empresa": ""},
            headers=auth_headers_admin
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_email_duplicado_es_rechazado(self, client, auth_headers_admin, empresa):
        importador, dueño = empresa
        response = client.post(
            "/admin/importadores",
            json={
                "nombre_empresa": "Empresa Duplicada",
                "especialidad_producto": ["Textiles"],
                "paises_origen": ["China"],
                "tiempo_respuesta_promedio": "24h",
                "email_dueño": dueño.email,
                "password_dueño": "ClaveSegura1"
            },
            headers=auth_headers_admin
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestVerificarYEstadoImportador:
    def test_verificar_importador(self, client, db_session, auth_headers_admin, empresa):
        importador, dueño = empresa
        # Verificar exige el expediente completo (ver test_verificacion_empresa):
        # el sello lo ve el cliente al elegir con quién contratar.
        importador.estado = "inactivo"
        importador.especialidad_producto = ["Textiles"]
        importador.paises_origen = ["China"]
        importador.shipping_mark_prefijo = "adm"
        dueño.email_verificado = True
        db_session.commit()

        response = client.post(f"/admin/importadores/{importador.id}/verificar", headers=auth_headers_admin)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["estado"] == "activo"

    def test_no_verifica_una_empresa_incompleta(self, client, auth_headers_admin, empresa):
        importador, _dueño = empresa
        response = client.post(f"/admin/importadores/{importador.id}/verificar", headers=auth_headers_admin)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_desactivar_importador(self, client, auth_headers_admin, empresa):
        importador, dueño = empresa
        response = client.put(f"/admin/importadores/{importador.id}/estado?estado=inactivo", headers=auth_headers_admin)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["estado"] == "inactivo"

    def test_estado_invalido_rechazado(self, client, auth_headers_admin, empresa):
        importador, dueño = empresa
        response = client.put(f"/admin/importadores/{importador.id}/estado?estado=raro", headers=auth_headers_admin)
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestMonitoreoUsuarios:
    def test_listar_usuarios_filtrado_por_rol(self, client, auth_headers_admin, empresa):
        importador, dueño = empresa
        response = client.get("/admin/usuarios?rol=importador", headers=auth_headers_admin)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert any(u["id"] == str(dueño.id) for u in data)
        assert all(u["rol"] == "importador" for u in data)

    def test_desactivar_cuenta_bloquea_login(self, client, db_session, auth_headers_admin, empresa):
        importador, dueño = empresa

        response = client.put(
            f"/admin/usuarios/{dueño.id}/estado",
            json={"activo": False},
            headers=auth_headers_admin
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["activo"] is False

        login = client.post("/auth/login", json={"email": dueño.email, "password": "ClaveSegura1"})
        assert login.status_code == status.HTTP_401_UNAUTHORIZED

    def test_no_admin_no_puede_listar_usuarios(self, client, solicitante):
        token = create_access_token(str(solicitante.id), "solicitante")
        response = client.get("/admin/usuarios", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestDisputas:
    def test_solicitante_reporta_problema_y_admin_lo_resuelve(self, client, db_session, solicitante, empresa, auth_headers_admin):
        importador, dueño = empresa
        cotizacion = Cotizacion(
            id=str(uuid4()), solicitante_id=solicitante.id, importador_id=importador.id,
            modalidad="dirigida", pais_importacion="China", nombre_producto="Producto Disputa",
            descripcion_cliente="Descripción de prueba para el flujo de disputa", linea_producto="Textiles",
            tipo_calidad="estandar", cantidad_minima=100, precio_objetivo_usd=1.0, incoterm="FOB",
            estado=EstadoCotizacion.orden_activa
        )
        db_session.add(cotizacion)

        orden = Orden(
            id=str(uuid4()), cotizacion_id=cotizacion.id, importador_id=importador.id,
            solicitante_id=solicitante.id, estado=EstadoOrden.cotizacion_aceptada,
            precio_acordado_usd=1.0
        )
        db_session.add(orden)
        db_session.commit()

        token_solicitante = create_access_token(str(solicitante.id), "solicitante")
        reportar = client.put(
            f"/ordenes/{orden.id}/reportar-problema",
            json={"motivo": "El producto llegó con daños en el empaque"},
            headers={"Authorization": f"Bearer {token_solicitante}"}
        )
        assert reportar.status_code == status.HTTP_200_OK
        assert reportar.json()["en_disputa"] is True

        listar_disputas = client.get("/admin/disputas", headers=auth_headers_admin)
        assert listar_disputas.status_code == status.HTTP_200_OK
        assert any(d["id"] == str(orden.id) for d in listar_disputas.json())

        resolver = client.put(
            f"/admin/disputas/{orden.id}/resolver",
            json={"resolucion": "Se coordinó reemplazo del producto dañado con la empresa"},
            headers=auth_headers_admin
        )
        assert resolver.status_code == status.HTTP_200_OK
        assert resolver.json()["en_disputa"] is False

    def test_otro_solicitante_no_puede_reportar_problema_de_orden_ajena(self, client, db_session, solicitante, empresa):
        importador, dueño = empresa
        otro = Usuario(
            id=str(uuid4()), email="otro_admin_test@example.com", password_hash=hash_password("123456789"),
            rol="solicitante", perfil_completo=True, fecha_creacion=datetime.utcnow()
        )
        db_session.add(otro)

        cotizacion = Cotizacion(
            id=str(uuid4()), solicitante_id=solicitante.id, importador_id=importador.id,
            modalidad="dirigida", pais_importacion="China", nombre_producto="Producto Ajeno",
            descripcion_cliente="Descripción de prueba para verificar IDOR en disputas", linea_producto="Textiles",
            tipo_calidad="estandar", cantidad_minima=100, precio_objetivo_usd=1.0, incoterm="FOB",
            estado=EstadoCotizacion.orden_activa
        )
        db_session.add(cotizacion)
        orden = Orden(
            id=str(uuid4()), cotizacion_id=cotizacion.id, importador_id=importador.id,
            solicitante_id=solicitante.id, estado=EstadoOrden.cotizacion_aceptada, precio_acordado_usd=1.0
        )
        db_session.add(orden)
        db_session.commit()

        token_otro = create_access_token(str(otro.id), "solicitante")
        response = client.put(
            f"/ordenes/{orden.id}/reportar-problema",
            json={"motivo": "Intento de reportar orden ajena"},
            headers={"Authorization": f"Bearer {token_otro}"}
        )
        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestMetricas:
    def test_obtener_metricas_estructura_correcta(self, client, auth_headers_admin):
        response = client.get("/admin/metricas", headers=auth_headers_admin)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        for campo in [
            "total_cotizaciones", "cotizaciones_dirigidas", "cotizaciones_abiertas",
            "tasa_respuesta_abiertas", "tasa_conversion_a_orden", "importadores_activos",
            "importadores_verificados", "ordenes_en_disputa"
        ]:
            assert campo in data

    def test_importadores_verificados_cuenta_solo_badge(self, client, db_session, auth_headers_admin):
        from models.importador import Importador

        activo = Importador(
            id=str(uuid4()), nombre_empresa="Activa No Verificada",
            especialidad_producto=["Textiles"], paises_origen=["China"],
            tiempo_respuesta_promedio="24h", estado="activo", verificado=False
        )
        verificado = Importador(
            id=str(uuid4()), nombre_empresa="Activa Verificada",
            especialidad_producto=["Textiles"], paises_origen=["China"],
            tiempo_respuesta_promedio="24h", estado="activo", verificado=True
        )
        db_session.add_all([activo, verificado])
        db_session.commit()

        response = client.get("/admin/metricas", headers=auth_headers_admin)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["importadores_verificados"] >= 1
        assert data["importadores_activos"] >= data["importadores_verificados"]
        assert data["importadores_activos"] > data["importadores_verificados"]

    def test_no_admin_no_puede_ver_metricas(self, client, solicitante):
        token = create_access_token(str(solicitante.id), "solicitante")
        response = client.get("/admin/metricas", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestCotizacionesAbiertasAdmin:
    def test_listar_cotizaciones_abiertas(self, client, db_session, solicitante, auth_headers_admin):
        cotizacion = Cotizacion(
            id=str(uuid4()), solicitante_id=solicitante.id, importador_id=None,
            modalidad="abierta", pais_importacion="China", nombre_producto="Producto Abierto Admin",
            descripcion_cliente="Descripción de prueba para vista admin de abiertas", linea_producto="Textiles",
            tipo_calidad="estandar", cantidad_minima=100, precio_objetivo_usd=1.0, incoterm="FOB",
            estado=EstadoCotizacion.abierta
        )
        db_session.add(cotizacion)
        db_session.commit()

        response = client.get("/admin/cotizaciones-abiertas", headers=auth_headers_admin)
        assert response.status_code == status.HTTP_200_OK
        assert any(c["id"] == str(cotizacion.id) for c in response.json())


class TestSoporteEnConversacion:
    """El panel no solo mira: soporte tiene que poder contestar en el hilo.

    Resolver una duda o mediar en un incidente fuera de la conversación obliga a
    las partes a reconstruir el contexto en otro sitio.
    """

    def _conversacion(self, db_session, solicitante, importador, dueño):
        from models.chat import ConversacionChat, TipoConversacion

        cotizacion = Cotizacion(
            id=str(uuid4()), solicitante_id=solicitante.id, importador_id=importador.id,
            modalidad="dirigida", pais_importacion="China", nombre_producto="Producto Soporte",
            descripcion_cliente="Descripción de prueba para la intervención de soporte",
            linea_producto="Textiles", tipo_calidad="estandar", cantidad_minima=100,
            precio_objetivo_usd=1.0, incoterm="FOB", estado=EstadoCotizacion.propuestas_recibidas,
        )
        db_session.add(cotizacion)

        conversacion = ConversacionChat(
            id=str(uuid4()), tipo=TipoConversacion.negociacion.value,
            cotizacion_id=cotizacion.id, solicitante_id=solicitante.id,
            importador_usuario_id=str(dueño.id),
        )
        db_session.add(conversacion)
        db_session.commit()
        return conversacion

    def test_admin_responde_y_queda_marcado_como_soporte(self, client, db_session, solicitante, empresa, auth_headers_admin):
        importador, dueño = empresa
        conversacion = self._conversacion(db_session, solicitante, importador, dueño)

        response = client.post(
            f"/admin/conversaciones/{conversacion.id}/mensajes",
            json={"contenido": "Revisamos el caso: la empresa reenvía el lote esta semana."},
            headers=auth_headers_admin,
        )
        assert response.status_code == status.HTTP_201_CREATED
        cuerpo = response.json()
        # Marcado como sistema para que no se confunda con la negociación.
        assert cuerpo["tipo"] == "sistema"
        assert cuerpo["contenido"].startswith("[Soporte ImportacionesQ8]")

    def test_ambas_partes_reciben_aviso(self, client, db_session, solicitante, empresa, auth_headers_admin):
        from models.notificacion import Notificacion

        importador, dueño = empresa
        conversacion = self._conversacion(db_session, solicitante, importador, dueño)

        client.post(
            f"/admin/conversaciones/{conversacion.id}/mensajes",
            json={"contenido": "Mediamos en el incidente."},
            headers=auth_headers_admin,
        )

        avisados = {
            str(fila[0])
            for fila in db_session.query(Notificacion.usuario_id).filter(
                Notificacion.tipo == "soporte"
            ).all()
        }
        assert str(solicitante.id) in avisados
        assert str(dueño.id) in avisados

    def test_el_mensaje_aparece_en_el_hilo_de_las_partes(self, client, db_session, solicitante, empresa, auth_headers_admin):
        importador, dueño = empresa
        conversacion = self._conversacion(db_session, solicitante, importador, dueño)

        client.post(
            f"/admin/conversaciones/{conversacion.id}/mensajes",
            json={"contenido": "Queda resuelto por nuestra parte."},
            headers=auth_headers_admin,
        )

        visto = client.get(
            f"/chat/conversaciones/{conversacion.id}/mensajes",
            headers=auth_headers_for(solicitante),
        )
        assert visto.status_code == status.HTTP_200_OK
        assert any("Soporte ImportacionesQ8" in m["contenido"] for m in visto.json())

    def test_una_empresa_no_puede_escribir_como_soporte(self, client, db_session, solicitante, empresa):
        importador, dueño = empresa
        conversacion = self._conversacion(db_session, solicitante, importador, dueño)

        response = client.post(
            f"/admin/conversaciones/{conversacion.id}/mensajes",
            json={"contenido": "Suplantando al equipo de la plataforma"},
            headers=auth_headers_for(dueño),
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN
