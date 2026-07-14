# Colección Postman / Insomnia

> Solo documentación y artefactos HTTP. **No** hay cliente TypeScript en `proyecto/frontend`.

## Archivo

```text
ImportacionesQ8V/API-Frontend/ImportacionesQ8.postman_collection.json
```

- **94 requests** agrupados por tag OpenAPI (Auth, Cotizaciones, Chat, Admin, …).
- Variable de colección `base_url` = `http://localhost:8000`
- Variable `access_token` se rellena sola en Postman tras:
  - `POST /auth/verificar-email` (200)
  - `POST /auth/login` (200 con token, sin OTP)
- Path vars de colección: `cotizacion_id`, `conversacion_id`, `importador_id`, `orden_id`, etc.

## Importar en Postman

1. Postman → **Import** → elige el `.json`
2. Colección → pestaña **Variables** → confirma `base_url`
3. Smoke test sugerido:
   1. `Autenticación` → Registrar Usuario (cambia el email)
   2. Verificar Correo (OTP; en local sin SMTP hay que obtener el código de logs/DB o entorno de prueba)
   3. Rutas protegidas ya envían `Authorization: Bearer {{access_token}}`

## Importar en Insomnia

1. Insomnia → **Import/Export** → **Import Data** → **From File**
2. Selecciona el mismo `ImportacionesQ8.postman_collection.json`
3. Environment:
   - `base_url` → `http://localhost:8000`
   - `access_token` → pégalo tras login

## Regenerar (si cambia el backend)

Con el backend en marcha:

```powershell
curl.exe -s http://127.0.0.1:8000/openapi.json -o proyecto\backend\openapi_snapshot.json
python proyecto\backend\scripts\generate_postman_collection.py
python proyecto\backend\scripts\generate_frontend_api_docs.py
```

## Ver también

- [[00-Env-y-Arranque]] — plantillas `.env` backend y frontend
- [[01-Convenciones-Auth-y-Cliente]] — JWT, CORS, errores
- [[Catalogo-Completo]] — tabla de todos los endpoints
- [[08-Chat-y-WebSocket]] — ticket WS y protocolo
