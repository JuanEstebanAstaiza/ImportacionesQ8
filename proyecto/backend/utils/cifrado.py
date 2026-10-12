"""Cifrado simétrico de datos sensibles en reposo (números de cuenta, documentos).

Fernet (AES-128-CBC + HMAC-SHA256) con la clave de `CLAVE_CIFRADO_DATOS`: 32
bytes en base64 url-safe, generada con
`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`.

En desarrollo y pruebas, si la variable no está, se deriva de SECRET_KEY para
no bloquear el arranque. En producción es obligatoria: perder o rotar la clave
sin re-cifrar deja ilegibles los datos guardados.
"""
from __future__ import annotations

import base64
import hashlib
import os
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

import config


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    clave = os.getenv("CLAVE_CIFRADO_DATOS", "").strip()
    if not clave:
        if config.APP_ENV == "production":
            raise RuntimeError("Falta CLAVE_CIFRADO_DATOS para cifrar datos sensibles")
        semilla = (config.SECRET_KEY or "zarpi-desarrollo").encode("utf-8")
        clave = base64.urlsafe_b64encode(hashlib.sha256(b"cifrado-datos:" + semilla).digest()).decode()
    return Fernet(clave.encode() if isinstance(clave, str) else clave)


def cifrar(texto: str) -> str:
    return _fernet().encrypt(texto.encode("utf-8")).decode("ascii")


def descifrar(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("No se pudo descifrar el dato (clave distinta o dato alterado)") from exc
