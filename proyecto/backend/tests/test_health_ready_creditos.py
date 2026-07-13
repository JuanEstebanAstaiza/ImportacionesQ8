"""Tests de readiness y débito atómico de créditos."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from uuid import uuid4

import pytest
from fastapi import status
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import config
from models.usuario import Usuario
from models.cotizacion import Cotizacion
from utils.security import hash_password, create_access_token


class TestHealthReady:
    def test_liveness_ok(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

    def test_ready_with_mocked_redis(self, client, mock_redis_client, monkeypatch):
        # En tests la DB SQLite responde; Redis mock hace ping=True
        monkeypatch.setattr(config, "redis_client", mock_redis_client)
        response = client.get("/health/ready")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ready"
        assert body["checks"]["database"] is True
        assert body["checks"]["redis"] is True

    def test_ready_fails_when_redis_down(self, client, monkeypatch):
        monkeypatch.setattr(config, "redis_client", None)
        response = client.get("/health/ready")
        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        assert response.json()["status"] == "not_ready"
        assert response.json()["checks"]["redis"] is False


class TestDebitoAtomicoCreditos:
    def test_updates_concurrentes_no_dejan_saldo_negativo(self, db_session):
        """
        Dos débitos concurrentes con saldo justo para uno solo: como máximo uno
        debe aplicar (UPDATE WHERE balance >= costo).
        """
        from sqlalchemy import update
        from database import Base
        import os

        # Usar el mismo engine de tests (SQLite file) con dos sesiones
        db_url = os.environ["DATABASE_URL"]
        engine = create_engine(db_url, connect_args={"check_same_thread": False})
        Session = sessionmaker(bind=engine)

        user_id = str(uuid4())
        costo = 10.0
        user = Usuario(
            id=user_id,
            email=f"race_{user_id[:8]}@example.com",
            password_hash=hash_password("123456789"),
            rol="solicitante",
            creditos_balance=10.0,
            perfil_completo=True,
            fecha_creacion=datetime.utcnow(),
        )
        db_session.add(user)
        db_session.commit()

        def intentar_debito():
            s = Session()
            try:
                result = s.execute(
                    update(Usuario)
                    .where(Usuario.id == user_id, Usuario.creditos_balance >= costo)
                    .values(creditos_balance=Usuario.creditos_balance - costo)
                )
                s.commit()
                return result.rowcount
            finally:
                s.close()

        with ThreadPoolExecutor(max_workers=2) as pool:
            futuros = [pool.submit(intentar_debito) for _ in range(2)]
            rowcounts = [f.result() for f in as_completed(futuros)]

        assert sum(rowcounts) == 1
        db_session.expire_all()
        actualizado = db_session.query(Usuario).filter(Usuario.id == user_id).first()
        assert actualizado.creditos_balance == 0.0
