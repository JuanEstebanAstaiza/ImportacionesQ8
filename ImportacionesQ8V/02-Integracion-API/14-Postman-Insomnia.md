# Colección Postman / Insomnia

> Solo documentación y artefactos HTTP. **No** hay cliente TypeScript en `proyecto/frontend`.

## Archivo

```text
ImportacionesQ8V/02-Integracion-API/ImportacionesQ8.postman_collection.json
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

Levanta el backend **reconstruyendo la imagen**, o exportarás el código viejo que
quedó cacheado:

```powershell
cd proyecto\backend
docker compose build backend
docker compose up -d backend
```

Exporta el snapshot y regenera. El paso de Python no es cosmético: normaliza a
UTF-8 sin BOM con sangría estable, de modo que el diff entre exportaciones
muestre solo cambios reales de la API.

```powershell
curl.exe -s http://127.0.0.1:8000/openapi.json -o proyecto\backend\openapi_snapshot.json
python -c "import json,io; d=json.load(io.open(r'proyecto\backend\openapi_snapshot.json',encoding='utf-8')); io.open(r'proyecto\backend\openapi_snapshot.json','w',encoding='utf-8',newline='\n').write(json.dumps(d,ensure_ascii=False,indent=2)+'\n')"
python proyecto\backend\scripts\generate_postman_collection.py
python proyecto\backend\scripts\generate_frontend_api_docs.py
# Salida: ImportacionesQ8V/02-Integracion-API/
```

> **No redirijas la salida de curl con `>` ni uses `Invoke-RestMethod`.** PowerShell
> reescribe el archivo en su codificación y deja el texto acentuado corrupto
> (`CrÃ©ditos` en vez de `Créditos`). Los tags dejan de coincidir con `TAG_FILES`
> y el generador de docs aborta. Usa siempre `curl.exe -o`.

## Ver también

- [[00-Env-y-Arranque]] — plantillas `.env` backend y frontend
- [[01-Convenciones-Auth-y-Cliente]] — JWT, CORS, errores
- [[Catalogo-Completo]] — tabla de todos los endpoints
- [[08-Chat-y-WebSocket]] — ticket WS y protocolo
