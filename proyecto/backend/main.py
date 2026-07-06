from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import CORS_ORIGINS
from routers.auth import router as auth_router
from routers.importadores import router as importadores_router
from routers.cotizaciones import router as cotizaciones_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gestiona el inicio y parada de la aplicación"""
    # Inicio - inicializar recursos (ej. conectar a Redis)
    print("🚀 Iniciando servidor ImportacionesQ8...")
    
    yield
    
    # Parada - limpiar recursos
    print("🛑 Apagando servidor ImportacionesQ8...")

# Crear la aplicación FastAPI
app = FastAPI(
    title="ImportacionesQ8 API",
    description="API REST para la plataforma de importaciones Q8",
    version="1.0.0",
    lifespan=lifespan
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir routers
app.include_router(auth_router)
app.include_router(importadores_router)
app.include_router(cotizaciones_router)

@app.get("/", tags=["Salud"])
async def root():
    """Endpoint de salud - verifica que el servidor está funcionando"""
    return {
        "success": True,
        "message": "API ImportacionesQ8 funcionando correctamente",
        "version": "1.0.0"
    }

@app.get("/health", tags=["Salud"])
async def health_check():
    """Endpoint de verificación de salud para monitoreo"""
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )