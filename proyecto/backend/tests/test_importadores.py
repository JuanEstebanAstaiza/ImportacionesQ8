import pytest
from fastapi.testclient import TestClient
from fastapi import status
from uuid import uuid4
from datetime import datetime
from unittest.mock import MagicMock

from models.usuario import Usuario
from models.cotizacion import Cotizacion, EstadoCotizacion
from utils.security import hash_password, create_access_token
from conftest import crear_empresa_importadora, auth_headers_for, registro_payload


class TestListarImportadores:
    """Tests para el endpoint GET /importadores"""
    
    def test_listar_importadores_vacio(self, client):
        """Listar importadores cuando no hay ninguno"""
        response = client.get("/importadores")
        
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.json(), list)
        assert len(response.json()) == 0
    
    def test_listar_importadores_con_datos(self, client, test_importador):
        """Listar importadores con datos existentes"""
        response = client.get("/importadores")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        
        # Verificar que el importador de prueba está en la lista
        importador_encontrado = next((i for i in data if i["nombre_empresa"] == "Importadora Test"), None)
        assert importador_encontrado is not None
    
    def test_listar_importadores_filtro_especialidad(self, client, test_importador_china):
        """Listar importadores filtrando por especialidad"""
        response = client.get("/importadores?especialidad=Textiles")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        
        # Todos los importadores deben tener Textiles como especialidad
        for imp in data:
            assert "Textiles" in imp["especialidad_producto"]
    
    def test_listar_importadores_filtro_pais(self, client, test_importador_china):
        """Listar importadores filtrando por país"""
        response = client.get("/importadores?pais=China")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        
        # Todos los importadores deben tener China como país de origen
        for imp in data:
            assert "China" in imp["paises_origen"]
    
    def test_listar_importadores_filtro_multiple(self, client, test_importador_china):
        """Listar importadores con múltiples filtros"""
        response = client.get("/importadores?especialidad=Textiles&pais=China")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        
        # Todos deben cumplir ambas condiciones
        for imp in data:
            assert "Textiles" in imp["especialidad_producto"]
            assert "China" in imp["paises_origen"]

class TestObtenerImportador:
    """Tests para el endpoint GET /importadores/{id}"""
    
    def test_obtener_importador_existente(self, client, test_importador):
        """Obtener detalles de un importador existente"""
        response = client.get(f"/importadores/{test_importador.id}")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["nombre_empresa"] == "Importadora Test"
        assert data["especialidad_producto"] == ["Textiles", "Ropa"]
        assert data["paises_origen"] == ["China", "Vietnam"]
    
    def test_obtener_importador_no_existente(self, client):
        """Intentar obtener un importador que no existe"""
        from uuid import uuid4
        
        response = client.get(f"/importadores/{uuid4()}")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_obtener_importador_id_invalido(self, client):
        """Intentar obtener un importador con ID inválido"""
        response = client.get("/importadores/invalid-id")
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

class TestCrearImportador:
    """Tests para el endpoint POST /importadores"""
    
    def test_crear_importador_sin_autenticacion(self, client):
        """Intentar crear importador sin autenticación"""
        response = client.post("/importadores", json={
            "nombre_empresa": "Importadora Test",
            "especialidad_producto": ["Textiles"],
            "paises_origen": ["China"],
            "tiempo_respuesta_promedio": "24h"
        })
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_crear_importador_sin_role_admin(self, client):
        """Intentar crear importador sin rol de admin"""
        # Registrar usuario solicitante y obtener token
        register_response = client.post("/auth/register", json=registro_payload("solicitante@example.com"))
        
        token = register_response.json()["access_token"]
        
        # Intentar crear importador - debería fallar por rol insuficiente
        response = client.post("/importadores", json={
            "nombre_empresa": "Importadora Test",
            "especialidad_producto": ["Textiles"],
            "paises_origen": ["China"],
            "tiempo_respuesta_promedio": "24h"
        }, headers={"Authorization": f"Bearer {token}"})
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_crear_importador_con_role_admin(self, client):
        """Crear importador con rol de admin"""
        # El auto-registro público de "admin" está cerrado por seguridad; en tests
        # se genera el token directamente, igual que haría un admin ya existente.
        token = create_access_token(str(uuid4()), "admin")
        
        # Crear importador - debería funcionar
        response = client.post("/importadores", json={
            "nombre_empresa": "Importadora Test Admin",
            "especialidad_producto": ["Textiles", "Electrónica"],
            "paises_origen": ["China", "Vietnam", "Tailandia"],
            "tiempo_respuesta_promedio": "12h",
            "calificacion_promedio": 4.5,
            "capacidad_volumen": 50000
        }, headers={"Authorization": f"Bearer {token}"})
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["nombre_empresa"] == "Importadora Test Admin"
        assert data["estado"] == "activo"
    
    def test_crear_importador_campos_requeridos(self, client):
        """Crear importador con campos requeridos faltantes"""
        token = create_access_token(str(uuid4()), "admin")
        
        # Intentar crear sin campos requeridos - debería fallar
        response = client.post("/importadores", json={
            "nombre_empresa": ""  # Campo vacío
        }, headers={"Authorization": f"Bearer {token}"})
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

class TestImportadorModel:
    """Tests para el modelo ORM Importador"""
    
    def test_modelo_importador_campos(self, db_session):
        """Verificar que el modelo Importador tiene todos los campos necesarios"""
        from models.importador import Importador
        
        importador = Importador(
            id="550e8400-e29b-41d4-a716-446655440000",
            nombre_empresa="Test Importador",
            logo_url=None,
            especialidad_producto=["Textiles"],
            paises_origen=["China"],
            calificacion_promedio=4.5,
            tiempo_respuesta_promedio="24h",
            capacidad_volumen=10000,
            estado="activo"
        )
        
        db_session.add(importador)
        db_session.commit()
        
        # Verificar que se guardó correctamente
        saved = db_session.query(Importador).filter_by(id=importador.id).first()
        assert saved is not None
        assert saved.nombre_empresa == "Test Importador"
        assert saved.especialidad_producto == ["Textiles"]
        assert saved.paises_origen == ["China"]

class TestMatchingService:
    """Tests para el motor de matching"""
    
    def test_matching_por_pais_y_categoria(self, db_session):
        """Verificar que el matching encuentra importadores por país y categoría"""
        from services.matching_service import matching_cotizacion_abierta
        from models.importador import Importador
        
        # Crear importadores con diferentes especialidades (tiempo_respuesta_promedio es requerido)
        importador_china_textiles = Importador(
            id="550e8400-e29b-41d4-a716-446655440000",
            nombre_empresa="China Textiles Co.",
            especialidad_producto=["Textiles"],
            paises_origen=["China"],
            tiempo_respuesta_promedio="12h",  # Campo requerido
            estado="activo"
        )
        
        importador_china_electronica = Importador(
            id="660f9500-f39c-52e5-b827-557766551111",
            nombre_empresa="China Electronics",
            especialidad_producto=["Electrónica"],
            paises_origen=["China"],
            tiempo_respuesta_promedio="12h",  # Campo requerido
            estado="activo"
        )
        
        importador_vietnam_textiles = Importador(
            id="770f9500-f39c-52e5-b827-557766551112",
            nombre_empresa="Vietnam Textiles",
            especialidad_producto=["Textiles"],
            paises_origen=["Vietnam"],
            tiempo_respuesta_promedio="36h",  # Campo requerido
            estado="activo"
        )
        
        db_session.add_all([importador_china_textiles, importador_china_electronica, importador_vietnam_textiles])
        db_session.commit()
        
        # Mock del cliente Redis para evitar conexión real
        from unittest.mock import MagicMock
        import config
        
        mock_redis = MagicMock()
        original_redis = config.redis_client
        config.redis_client = mock_redis
        
        try:
            # Ejecutar matching para cotización de Textiles desde China
            result = matching_cotizacion_abierta(
                "cotizacion-test-id",
                "China",
                "Textiles",
                db_session
            )
            
            # Debería encontrar solo el importador de China con especialidad en Textiles
            assert len(result) == 1
            assert result[0].nombre_empresa == "China Textiles Co."
        finally:
            config.redis_client = original_redis
    
    def test_matching_sin_resultados(self, db_session):
        """Verificar que el matching no encuentra resultados cuando no hay coincidencias"""
        from services.matching_service import matching_cotizacion_abierta
        from models.importador import Importador
        
        # Crear importador con especialidad diferente (tiempo_respuesta_promedio es requerido)
        importador_electronica = Importador(
            id="550e8400-e29b-41d4-a716-446655440000",
            nombre_empresa="China Electronics",
            especialidad_producto=["Electrónica"],
            paises_origen=["China"],
            tiempo_respuesta_promedio="24h",  # Campo requerido
            estado="activo"
        )
        
        db_session.add(importador_electronica)
        db_session.commit()
        
        # Mock del cliente Redis
        from unittest.mock import MagicMock
        import config
        
        mock_redis = MagicMock()
        original_redis = config.redis_client
        config.redis_client = mock_redis
        
        try:
            result = matching_cotizacion_abierta(
                "cotizacion-test-id",
                "China",
                "Textiles",  # No hay importadores de Textiles en China
                db_session
            )
            
            assert len(result) == 0
        finally:
            config.redis_client = original_redis
    
    def test_obtener_importadores_matching(self, mock_redis_client):
        """Verificar la función obtener_importadores_matching"""
        from services.matching_service import obtener_importadores_matching
        
        # Configurar mock para simular datos en Redis
        mock_redis_client.hgetall.return_value = {
            "id1": "pendiente",
            "id2": "respondido",
            "id3": "pendiente"
        }
        
        result = obtener_importadores_matching("cotizacion-test-id")
        
        assert result["total_matching"] == 3
        assert result["pendientes"] == 2
        assert result["respondidos"] == 1
    
    def test_registrar_respuesta_importador(self, mock_redis_client):
        """Verificar la función registrar_respuesta_importador"""
        from services.matching_service import registrar_respuesta_importador
        
        result = registrar_respuesta_importador("cotizacion-test-id", "importador-1")
        
        assert result is True
        mock_redis_client.hset.assert_called_once_with(
            "cotizacion_abierta:cotizacion-test-id",
            "importador-1",
            "respondido"
        )
    
    def test_verificar_cotizacion_activa(self, mock_redis_client):
        """Verificar la función verificar_cotizacion_abierta_activa"""
        from services.matching_service import verificar_cotizacion_abierta_activa
        
        # Configurar mock para cotización activa
        mock_redis_client.exists.return_value = True
        mock_redis_client.ttl.return_value = 100000
        mock_redis_client.get.return_value = "3"
        
        result = verificar_cotizacion_abierta_activa("cotizacion-test-id")
        
        assert result["esta_activa"] is True
        assert result["expirada"] is False
        assert result["propuestas_recibidas"] == 3
    
    def test_verificar_cotizacion_expirada(self, mock_redis_client):
        """Verificar la función verificar_cotizacion_abierta_activa con cotización expirada"""
        from services.matching_service import verificar_cotizacion_abierta_activa
        
        # Configurar mock para cotización inactiva (no existe en Redis)
        mock_redis_client.exists.return_value = False
        
        result = verificar_cotizacion_abierta_activa("cotizacion-test-id")
        
        assert result["esta_activa"] is False
        assert result["expirada"] is True
    
    def test_expirar_cotizacion_abierta(self, mock_redis_client):
        """Verificar la función expirar_cotizacion_abierta"""
        from services.matching_service import expirar_cotizacion_abierta
        
        result = expirar_cotizacion_abierta("cotizacion-test-id")
        
        assert result is True
        mock_redis_client.delete.assert_any_call("cotizacion_abierta:cotizacion-test-id")
    
    def test_obtener_propuestas_recibidas(self, mock_redis_client):
        """Verificar la función obtener_propuestas_recibidas"""
        from services.matching_service import obtener_propuestas_recibidas
        
        # Configurar mock para 5 propuestas recibidas
        mock_redis_client.get.return_value = "5"
        
        result = obtener_propuestas_recibidas("cotizacion-test-id")
        
        assert result == 5
    
    def test_obtener_propuestas_recibidas_cero(self, mock_redis_client):
        """Verificar la función obtener_propuestas_recibidas cuando no hay propuestas"""
        from services.matching_service import obtener_propuestas_recibidas
        
        # Configurar mock para 0 propuestas recibidas
        mock_redis_client.get.return_value = None
        
        result = obtener_propuestas_recibidas("cotizacion-test-id")
        
        assert result == 0


class TestBandejaSolicitudesImportador:
    """Tests para GET /importadores/{id}/solicitudes-dirigidas y /solicitudes-abiertas (Tarea 2.5)"""

    @pytest.fixture()
    def importador_user(self, db_session):
        importador, dueño = crear_empresa_importadora(db_session, nombre_empresa="Importadora Bandeja Test", email_dueño="importador_bandeja@example.com")
        dueño.empresa = importador
        return dueño

    @pytest.fixture()
    def otro_importador_user(self, db_session):
        importador, dueño = crear_empresa_importadora(db_session, nombre_empresa="Otra Importadora Bandeja Test", email_dueño="otro_importador_bandeja@example.com")
        dueño.empresa = importador
        return dueño

    @pytest.fixture()
    def solicitante_user(self, db_session):
        user = Usuario(
            id=str(uuid4()),
            email="solicitante_bandeja@example.com",
            password_hash=hash_password("123456789"),
            rol="solicitante",
            perfil_completo=True,
            fecha_creacion=datetime.utcnow()
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    def _auth_headers(self, user_id, rol):
        token = create_access_token(str(user_id), rol)
        return {"Authorization": f"Bearer {token}"}

    def test_solicitudes_dirigidas_solo_propias(self, client, db_session, importador_user, solicitante_user):
        """GET /importadores/{id}/solicitudes-dirigidas retorna solo las cotizaciones dirigidas a ese importador"""
        cotizacion = Cotizacion(
            id=str(uuid4()),
            solicitante_id=solicitante_user.id,
            importador_id=importador_user.importador_id,
            modalidad="dirigida",
            pais_importacion="China",
            nombre_producto="Camisetas personalizadas",
            descripcion_cliente="Necesito 500 camisetas con logo impreso en algodón",
            linea_producto="Textiles",
            tipo_calidad="estandar",
            cantidad_minima=500,
            precio_objetivo_usd=3.5,
            incoterm="FOB",
            estado=EstadoCotizacion.dirigida
        )
        db_session.add(cotizacion)
        db_session.commit()

        response = client.get(
            f"/importadores/{importador_user.importador_id}/solicitudes-dirigidas",
            headers=auth_headers_for(importador_user)
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == str(cotizacion.id)

    def test_solicitudes_dirigidas_idor_rechazado(self, client, db_session, importador_user, otro_importador_user):
        """Un importador no puede consultar la bandeja de solicitudes de otro importador (IDOR)"""
        response = client.get(
            f"/importadores/{importador_user.importador_id}/solicitudes-dirigidas",
            headers=auth_headers_for(otro_importador_user)
        )

        assert response.status_code == 403

    def test_solicitudes_abiertas_con_matching(self, client, db_session, importador_user, solicitante_user):
        """GET /importadores/{id}/solicitudes-abiertas solo muestra cotizaciones donde el importador
        aparece en la lista de matching de Redis (no todas las cotizaciones abiertas)."""
        cotizacion_con_matching = Cotizacion(
            id=str(uuid4()),
            solicitante_id=solicitante_user.id,
            importador_id=None,
            modalidad="abierta",
            pais_importacion="China",
            nombre_producto="Camisetas personalizadas",
            descripcion_cliente="Necesito 500 camisetas con logo impreso en algodón",
            linea_producto="Textiles",
            tipo_calidad="estandar",
            cantidad_minima=500,
            precio_objetivo_usd=3.5,
            incoterm="FOB",
            estado=EstadoCotizacion.abierta
        )
        cotizacion_sin_matching = Cotizacion(
            id=str(uuid4()),
            solicitante_id=solicitante_user.id,
            importador_id=None,
            modalidad="abierta",
            pais_importacion="Vietnam",
            nombre_producto="Zapatos deportivos",
            descripcion_cliente="Necesito 300 pares de zapatos deportivos personalizados",
            linea_producto="Calzado",
            tipo_calidad="premium",
            cantidad_minima=300,
            precio_objetivo_usd=12.0,
            incoterm="FOB",
            estado=EstadoCotizacion.abierta
        )
        db_session.add_all([cotizacion_con_matching, cotizacion_sin_matching])
        db_session.commit()

        import config
        redis_mock = MagicMock()
        # Solo la primera cotización tiene a este importador en su lista de matching de Redis
        redis_mock.keys.return_value = [f"cotizacion_abierta:{cotizacion_con_matching.id}"]
        redis_mock.hgetall.return_value = {str(importador_user.importador_id): "pendiente"}
        original_redis = config.redis_client
        config.redis_client = redis_mock

        try:
            response = client.get(
                f"/importadores/{importador_user.importador_id}/solicitudes-abiertas",
                headers=auth_headers_for(importador_user)
            )

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["id"] == str(cotizacion_con_matching.id)
        finally:
            config.redis_client = original_redis

    def test_solicitudes_abiertas_idor_rechazado(self, client, db_session, importador_user, otro_importador_user):
        """Un importador no puede consultar la bandeja de solicitudes abiertas de otro importador (IDOR)"""
        response = client.get(
            f"/importadores/{importador_user.importador_id}/solicitudes-abiertas",
            headers=auth_headers_for(otro_importador_user)
        )

        assert response.status_code == 403


class TestCatalogoEnriquecido:
    """Semana 4 - Fase 6: catálogo enriquecido del dashboard del solicitante
    (destacados, por categoría, certificados)."""

    def _crear(self, db_session, **kwargs):
        importador, _dueño = crear_empresa_importadora(db_session, **kwargs)
        return importador

    def test_destacados_ordena_por_calificacion_desc(self, client, db_session):
        self._crear(db_session, nombre_empresa="Baja Calificación", email_dueño="baja@example.com", calificacion_promedio=2.0)
        self._crear(db_session, nombre_empresa="Alta Calificación", email_dueño="alta@example.com", calificacion_promedio=4.9)

        response = client.get("/importadores/destacados")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
        nombres = [i["nombre_empresa"] for i in data]
        assert nombres.index("Alta Calificación") < nombres.index("Baja Calificación")

    def test_destacados_respeta_limite(self, client, db_session):
        for i in range(5):
            self._crear(db_session, nombre_empresa=f"Empresa Destacada {i}", email_dueño=f"destacada{i}@example.com")

        response = client.get("/importadores/destacados?limite=2")
        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_por_categoria_agrupa_correctamente(self, client, db_session):
        self._crear(
            db_session, nombre_empresa="Empresa Textil", email_dueño="textil_cat@example.com",
            especialidad_producto=["Textiles"]
        )
        self._crear(
            db_session, nombre_empresa="Empresa Multi", email_dueño="multi_cat@example.com",
            especialidad_producto=["Textiles", "Electrónica"]
        )

        response = client.get("/importadores/por-categoria")
        assert response.status_code == 200
        data = response.json()
        assert "Textiles" in data
        assert "Electrónica" in data
        nombres_textiles = [i["nombre_empresa"] for i in data["Textiles"]]
        assert "Empresa Textil" in nombres_textiles
        assert "Empresa Multi" in nombres_textiles
        nombres_electronica = [i["nombre_empresa"] for i in data["Electrónica"]]
        assert "Empresa Textil" not in nombres_electronica

    def test_certificados_solo_incluye_verificados(self, client, db_session):
        self._crear(db_session, nombre_empresa="Empresa Sin Certificar", email_dueño="sincert@example.com", verificado=False)
        self._crear(db_session, nombre_empresa="Empresa Certificada", email_dueño="cert@example.com", verificado=True)

        response = client.get("/importadores/certificados")
        assert response.status_code == 200
        data = response.json()
        nombres = [i["nombre_empresa"] for i in data]
        assert "Empresa Certificada" in nombres
        assert "Empresa Sin Certificar" not in nombres

    def test_listar_importadores_filtro_certificado(self, client, db_session):
        self._crear(db_session, nombre_empresa="Empresa Sin Certificar 2", email_dueño="sincert2@example.com", verificado=False)
        self._crear(db_session, nombre_empresa="Empresa Certificada 2", email_dueño="cert2@example.com", verificado=True)

        response = client.get("/importadores?certificado=true")
        assert response.status_code == 200
        data = response.json()
        assert all(i["verificado"] is True for i in data)
        nombres = [i["nombre_empresa"] for i in data]
        assert "Empresa Certificada 2" in nombres

    def test_listar_importadores_orden_calificacion(self, client, db_session):
        self._crear(db_session, nombre_empresa="Baja Orden", email_dueño="bajaorden@example.com", calificacion_promedio=1.5)
        self._crear(db_session, nombre_empresa="Alta Orden", email_dueño="altaorden@example.com", calificacion_promedio=5.0)

        response = client.get("/importadores?orden=calificacion")
        assert response.status_code == 200
        data = response.json()
        nombres = [i["nombre_empresa"] for i in data]
        assert nombres.index("Alta Orden") < nombres.index("Baja Orden")

    def test_admin_verificar_marca_verificado_true(self, client, db_session, admin_user):
        importador = self._crear(db_session, nombre_empresa="Empresa A Verificar", email_dueño="averificar@example.com")

        response = client.post(
            f"/admin/importadores/{importador.id}/verificar",
            headers=auth_headers_for(admin_user)
        )
        assert response.status_code == 200
        assert response.json()["verificado"] is True