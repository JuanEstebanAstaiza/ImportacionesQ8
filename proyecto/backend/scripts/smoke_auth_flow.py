import os
import sqlite3
import time
from uuid import uuid4

import requests

BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./importacionesq8.db")


def sqlite_path_from_database_url(database_url: str) -> str:
    if not database_url.startswith("sqlite:///"):
        raise RuntimeError("Este script rapido soporta solo SQLite (sqlite:///...).")
    raw = database_url.replace("sqlite:///", "", 1)
    return os.path.abspath(raw)


def activate_user_email_locally(email: str) -> None:
    db_path = sqlite_path_from_database_url(DATABASE_URL)
    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE usuarios SET email_verificado = 1 WHERE email = ?",
            (email,),
        )
        if cur.rowcount == 0:
            raise RuntimeError("No se encontro el usuario para activar email_verificado.")
        conn.commit()
    finally:
        conn.close()


def assert_status(resp: requests.Response, expected: int, label: str) -> None:
    if resp.status_code != expected:
        raise AssertionError(
            f"{label} fallo: esperado {expected}, obtenido {resp.status_code}. body={resp.text}"
        )


def main() -> None:
    unique = str(uuid4())[:8]
    email = f"smoke_{unique}@example.com"
    password = "SmokePass123"

    register_payload = {
        "email": email,
        "password": password,
        "rol": "solicitante",
        "tipo_persona": "natural",
        "tipo_documento": "CC",
        "numero_documento": f"10{int(time.time())}",
        "nombre": "Smoke",
        "apellido": "Test",
        "indicativo_pais_telefono": "+57",
        "telefono": "3001234567",
        "acepto_politica_datos": True,
    }

    register_resp = requests.post(
        f"{BASE_URL}/auth/register",
        json=register_payload,
        headers={"Content-Type": "application/json"},
        timeout=20,
    )
    assert_status(register_resp, 201, "registro")

    activate_user_email_locally(email)

    login_resp = requests.post(
        f"{BASE_URL}/auth/login",
        json={"email": email, "password": password},
        headers={"Content-Type": "application/json"},
        timeout=20,
    )
    assert_status(login_resp, 200, "login")

    login_json = login_resp.json()
    token = login_json.get("access_token")
    rol = login_json.get("rol")
    if not token:
        raise AssertionError(f"login sin access_token: {login_json}")

    me_resp = requests.get(
        f"{BASE_URL}/usuarios/me",
        headers={"Authorization": f"Bearer {token}"},
        timeout=20,
    )
    assert_status(me_resp, 200, "endpoint protegido /usuarios/me")

    print("SMOKE OK")
    print(f"email={email}")
    print(f"rol={rol}")
    print(f"token_prefix={token[:16]}...")


if __name__ == "__main__":
    main()
