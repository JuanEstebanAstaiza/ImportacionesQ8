import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from fastapi import status

from utils.security import create_access_token

class TestListarCotizaciones:
    """Tests para el endpoint GET /cotizaciones"""
    
    def test_listar_cotizaciones_sin_autenticacion(self, client):
        """Intentar listar cotizaciones sin autenticación"""
        response = client.get("/cotizaciones")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_listar_cotizaciones_vacio(self, client, auth_headers_test_user):
        """Listar cotizaciones cuando no hay ninguna"""
        response = client.get("/cotizaciones", headers=auth_headers_test_user)
        
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.json(), list)
        assert len(response.json()) == 0

class TestCrearCotizacion:
    """Tests para el endpoint POST /cotizaciones"""
    
    def test_crear_cotizacion_sin_autenticacion(self, client):
        """Intentar crear cotización sin autenticación"""
        response = client.post("/cotizaciones", json={
            "modalidad": "abierta",
            "pais_importacion": "China",
            "nombre_producto": "Camisetas personalizadas",
            "descripcion_cliente": "Necesito 500 camisetas con mi logo impreso en algodón premium",
            "linea_producto": "Textiles",
            "tipo_calidad": "estandar",
            "cantidad_minima": 500,
            "incoterm": "FOB"
        })
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_crear_cotizacion_sin_role_solicitante(self, client):
        """Intentar crear cotización sin rol de solicitante"""
        # El auto-registro público de "importador" está cerrado por seguridad; se
        # genera el token directamente, como haría una cuenta creada por un admin.
        token = create_access_token(str(uuid4()), "importador")
        
        # Intentar crear cotización - debería fallar por rol insuficiente
        response = client.post("/cotizaciones", json={
            "modalidad": "abierta",
            "pais_importacion": "China",
            "nombre_producto": "Camisetas personalizadas",
            "descripcion_cliente": "Necesito 500 camisetas con mi logo impreso en algodón premium",
            "linea_producto": "Textiles",
            "tipo_calidad": "estandar",
            "cantidad_minima": 500,
            "incoterm": "FOB"
        }, headers={"Authorization": f"Bearer {token}"})
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_crear_cotizacion_dirigida_sin_importador_id(self, client):
        """Intentar crear cotización dirigida sin importador_id"""
        # Registrar usuario solicitante y obtener token
        register_response = client.post("/auth/register", json={
            "email": "solicitante@example.com",
            "password": "123456789",
            "rol": "solicitante"
        })
        
        token = register_response.json()["access_token"]
        
        # Intentar crear cotización dirigida sin importador_id - debería fallar
        response = client.post("/cotizaciones", json={
            "modalidad": "dirigida",
            "pais_importacion": "China",
            "nombre_producto": "Camisetas personalizadas",
            "descripcion_cliente": "Necesito 500 camisetas con mi logo impreso en algodón premium",
            "linea_producto": "Textiles",
            "tipo_calidad": "estandar",
            "cantidad_minima": 500,
            "incoterm": "FOB"
        }, headers={"Authorization": f"Bearer {token}"})
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "importador_id" in response.json()["detail"]
    
    def test_crear_cotizacion_dirigida_con_importador_no_existente(self, client):
        """Intentar crear cotización dirigida con importador que no existe"""
        from uuid import uuid4
        
        # Registrar usuario solicitante y obtener token
        register_response = client.post("/auth/register", json={
            "email": "solicitante2@example.com",
            "password": "123456789",
            "rol": "solicitante"
        })
        
        token = register_response.json()["access_token"]
        
        # Intentar crear cotización dirigida con importador inexistente - debería fallar
        response = client.post("/cotizaciones", json={
            "modalidad": "dirigida",
            "importador_id": str(uuid4()),
            "pais_importacion": "China",
            "nombre_producto": "Camisetas personalizadas",
            "descripcion_cliente": "Necesito 500 camisetas con mi logo impreso en algodón premium",
            "linea_producto": "Textiles",
            "tipo_calidad": "estandar",
            "cantidad_minima": 500,
            "incoterm": "FOB"
        }, headers={"Authorization": f"Bearer {token}"})
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_crear_cotizacion_dirigida_exitosa(self, client):
        """Crear cotización dirigida exitosamente"""
        token_admin = create_access_token(str(uuid4()), "admin")
        
        importador_response = client.post("/importadores", json={
            "nombre_empresa": "Importadora Test",
            "especialidad_producto": ["Textiles"],
            "paises_origen": ["China"],
            "tiempo_respuesta_promedio": "24h"
        }, headers={"Authorization": f"Bearer {token_admin}"})
        
        importador_id = importador_response.json()["id"]
        
        # Registrar usuario solicitante y obtener token
        register_solicitante = client.post("/auth/register", json={
            "email": "solicitante3@example.com",
            "password": "123456789",
            "rol": "solicitante"
        })
        
        token_solicitante = register_solicitante.json()["access_token"]
        
        # Crear cotización dirigida - debería funcionar
        response = client.post("/cotizaciones", json={
            "modalidad": "dirigida",
            "importador_id": importador_id,
            "pais_importacion": "China",
            "nombre_producto": "Camisetas personalizadas",
            "descripcion_cliente": "Necesito 500 camisetas con mi logo impreso en algodón premium",
            "linea_producto": "Textiles",
            "tipo_calidad": "estandar",
            "cantidad_minima": 500,
            "incoterm": "FOB"
        }, headers={"Authorization": f"Bearer {token_solicitante}"})
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["modalidad"] == "dirigida"
        assert data["estado"] == "dirigida"
    
    def test_crear_cotizacion_abierta_exitosa(self, client):
        """Crear cotización abierta exitosamente"""
        token_admin = create_access_token(str(uuid4()), "admin")
        
        importador_response = client.post("/importadores", json={
            "nombre_empresa": "China Textiles Co.",
            "especialidad_producto": ["Textiles"],
            "paises_origen": ["China"],
            "tiempo_respuesta_promedio": "12h"
        }, headers={"Authorization": f"Bearer {token_admin}"})
        
        # Registrar usuario solicitante y obtener token
        register_solicitante = client.post("/auth/register", json={
            "email": "solicitante4@example.com",
            "password": "123456789",
            "rol": "solicitante"
        })
        
        token_solicitante = register_solicitante.json()["access_token"]
        
        # Crear cotización abierta - debería funcionar
        response = client.post("/cotizaciones", json={
            "modalidad": "abierta",
            "pais_importacion": "China",
            "nombre_producto": "Camisetas personalizadas",
            "descripcion_cliente": "Necesito 500 camisetas con mi logo impreso en algodón premium",
            "linea_producto": "Textiles",
            "tipo_calidad": "estandar",
            "cantidad_minima": 500,
            "incoterm": "FOB"
        }, headers={"Authorization": f"Bearer {token_solicitante}"})
        
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["modalidad"] == "abierta"
        assert data["estado"] == "abierta"

class TestObtenerCotizacion:
    """Tests para el endpoint GET /cotizaciones/{id}"""
    
    def test_obtener_cotizacion_sin_autenticacion(self, client):
        """Intentar obtener cotización sin autenticación"""
        response = client.get("/cotizaciones/cualquier-id")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_obtener_cotizacion_no_existente(self, client, auth_headers_test_user):
        """Intentar obtener una cotización que no existe"""
        from uuid import uuid4
        
        response = client.get(f"/cotizaciones/{uuid4()}", headers=auth_headers_test_user)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND

class TestCotizacionModel:
    """Tests para el modelo ORM Cotización"""
    
    def test_modelo_cotizacion_campos(self, db_session):
        """Verificar que el modelo Cotización tiene todos los campos necesarios"""
        from models.cotizacion import Cotizacion
        
        cotizacion = Cotizacion(
            id="550e8400-e29b-41d4-a716-446655440000",
            solicitante_id="660f9500-f39c-52e5-b827-557766551111",
            importador_id=None,
            modalidad="abierta",
            pais_importacion="China",
            nombre_producto="Camisetas personalizadas",
            descripcion_cliente="Necesito 500 camisetas con mi logo impreso en algodón premium",
            linea_producto="Textiles",
            tipo_calidad="estandar",
            cantidad_minima=500,
            incoterm="FOB",
            estado="abierta"
        )
        
        db_session.add(cotizacion)
        db_session.commit()
        
        # Verificar que se guardó correctamente
        saved = db_session.query(Cotizacion).filter_by(id=cotizacion.id).first()
        assert saved is not None
        assert saved.modalidad == "abierta"
        assert saved.estado == "abierta"

class TestCotizacionSchemas:
    """Tests para los esquemas Pydantic de Cotización"""
    
    def test_cotizacion_create_valid(self):
        """Validar esquema CotizacionCreate con datos válidos"""
        from schemas.cotizacion import CotizacionCreate
        
        cotizacion = CotizacionCreate(
            modalidad="abierta",
            pais_importacion="China",
            nombre_producto="Camisetas personalizadas",
            descripcion_cliente="Necesito 500 camisetas con mi logo impreso en algodón premium",
            linea_producto="Textiles",
            tipo_calidad="estandar",
            cantidad_minima=500,
            incoterm="FOB"
        )
        
        assert cotizacion.modalidad == "abierta"
        assert cotizacion.cantidad_minima >= 1
    
    def test_cotizacion_create_invalid_modalidad(self):
        """Validar esquema CotizacionCreate con modalidad inválida"""
        from schemas.cotizacion import CotizacionCreate
        
        # Modalidad no válida - debería fallar la validación
        with pytest.raises(Exception):
            cotizacion = CotizacionCreate(
                modalidad="invalida",  # No es "dirigida" ni "abierta"
                pais_importacion="China",
                nombre_producto="Camisetas personalizadas",
                descripcion_cliente="Necesito 500 camisetas con mi logo impreso en algodón premium",
                linea_producto="Textiles",
                tipo_calidad="estandar",
                cantidad_minima=500,
                incoterm="FOB"
            )
    
    def test_cotizacion_create_invalid_cantidad(self):
        """Validar esquema CotizacionCreate con cantidad inválida"""
        from schemas.cotizacion import CotizacionCreate
        
        # Cantidad mínima menor a 1 - debería fallar la validación
        with pytest.raises(Exception):
            cotizacion = CotizacionCreate(
                modalidad="abierta",
                pais_importacion="China",
                nombre_producto="Camisetas personalizadas",
                descripcion_cliente="Necesito 500 camisetas con mi logo impreso en algodón premium",
                linea_producto="Textiles",
                tipo_calidad="estandar",
                cantidad_minima=0,  # Cantidad inválida
                incoterm="FOB"
            )

class TestCotizacionEndpointsIntegration:
    """Tests de integración para el flujo completo de cotizaciones"""
    
    def test_flujo_completo_cotizacion_dirigida(self, client):
        """Probar el flujo completo de una cotización dirigida"""
        # 1. Generar token admin (el auto-registro de admin está cerrado) y crear importador
        token_admin = create_access_token(str(uuid4()), "admin")
        
        importador_response = client.post("/importadores", json={
            "nombre_empresa": "Importadora Dirigida",
            "especialidad_producto": ["Textiles"],
            "paises_origen": ["China"],
            "tiempo_respuesta_promedio": "24h"
        }, headers={"Authorization": f"Bearer {token_admin}"})
        
        importador_id = importador_response.json()["id"]
        
        # 2. Registrar solicitante y obtener token
        register_solicitante = client.post("/auth/register", json={
            "email": "solicitante5@example.com",
            "password": "123456789",
            "rol": "solicitante"
        })
        
        token_solicitante = register_solicitante.json()["access_token"]
        
        # 3. Crear cotización dirigida
        response_cotizacion = client.post("/cotizaciones", json={
            "modalidad": "dirigida",
            "importador_id": importador_id,
            "pais_importacion": "China",
            "nombre_producto": "Pantalones con logo",
            "descripcion_cliente": "Necesito 1000 pantalones con mi marca bordada",
            "linea_producto": "Textiles",
            "tipo_calidad": "premium",
            "cantidad_minima": 1000,
            "incoterm": "CIF"
        }, headers={"Authorization": f"Bearer {token_solicitante}"})
        
        assert response_cotizacion.status_code == status.HTTP_201_CREATED
        cotizacion_id = response_cotizacion.json()["id"]
        
        # 4. Listar cotizaciones del solicitante (debería ver la nueva)
        response_listar = client.get("/cotizaciones", headers={"Authorization": f"Bearer {token_solicitante}"})
        
        assert response_listar.status_code == status.HTTP_200_OK
        cotizaciones = response_listar.json()
        assert len(cotizaciones) >= 1
        
        # 5. Obtener detalles de la cotización creada
        response_detalle = client.get(f"/cotizaciones/{cotizacion_id}", headers={"Authorization": f"Bearer {token_solicitante}"})
        
        assert response_detalle.status_code == status.HTTP_200_OK
        data = response_detalle.json()
        assert data["modalidad"] == "dirigida"
        assert data["estado"] == "dirigida"

class TestImportadoresEndpointsIntegration:
    """Tests de integración para el flujo completo de importadores"""
    
    def test_flujo_completo_importador(self, client):
        """Probar el flujo completo de un importador"""
        # 1. Generar token admin (el auto-registro de admin está cerrado)
        token_admin = create_access_token(str(uuid4()), "admin")
        
        # 2. Crear importador
        response_crear = client.post("/importadores", json={
            "nombre_empresa": "Importadora Completa",
            "especialidad_producto": ["Textiles", "Electrónica"],
            "paises_origen": ["China", "Vietnam"],
            "tiempo_respuesta_promedio": "12h",
            "calificacion_promedio": 4.5,
            "capacidad_volumen": 50000
        }, headers={"Authorization": f"Bearer {token_admin}"})
        
        assert response_crear.status_code == status.HTTP_201_CREATED
        importador_id = response_crear.json()["id"]
        
        # 3. Listar importadores (debería ver el nuevo)
        response_listar = client.get("/importadores")
        
        assert response_listar.status_code == status.HTTP_200_OK
        importadores = response_listar.json()
        assert len(importadores) >= 1
        
        # 4. Obtener detalles del importador creado
        response_detalle = client.get(f"/importadores/{importador_id}")
        
        assert response_detalle.status_code == status.HTTP_200_OK
        data = response_detalle.json()
        assert data["nombre_empresa"] == "Importadora Completa"
        assert data["estado"] == "activo"