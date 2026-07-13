"""Traducción asistida vía Google Cloud Translation API (REST v2 con API key)."""
from __future__ import annotations

import hashlib
import logging
from typing import Optional, Tuple
from uuid import uuid4

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

import config
from models.traduccion import TraduccionCache

logger = logging.getLogger("importacionesq8")

GOOGLE_TRANSLATE_URL = "https://translation.googleapis.com/language/translate/v2"
GOOGLE_DETECT_URL = "https://translation.googleapis.com/language/translate/v2/detect"


def _hash_texto(texto: str) -> str:
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()


def _mock_traducir(texto: str, idioma_destino: str, idioma_origen: str) -> str:
    return f"[{idioma_destino}] {texto}"


def detectar_idioma(texto: str) -> str:
    if not config.TRANSLATION_ENABLED or not config.GOOGLE_TRANSLATE_API_KEY:
        # Heurística mínima para tests/dev
        if any("\u4e00" <= c <= "\u9fff" for c in texto):
            return "zh-CN"
        if any(w in texto.lower() for w in (" the ", " and ", " is ")):
            return "en"
        return "es"

    with httpx.Client(timeout=15.0) as client:
        r = client.post(
            GOOGLE_DETECT_URL,
            params={"key": config.GOOGLE_TRANSLATE_API_KEY},
            json={"q": texto},
        )
        if r.status_code >= 400:
            logger.warning("Google detect failed: %s", r.text)
            raise HTTPException(status_code=503, detail="Servicio de traducción no disponible")
        data = r.json()
        detections = data.get("data", {}).get("detections", [[]])
        if detections and detections[0]:
            lang = detections[0][0].get("language", "es")
            if lang.startswith("zh"):
                return "zh-CN"
            return lang
    return "es"


def traducir_texto(
    db: Session,
    texto: str,
    idioma_destino: str,
    idioma_origen: Optional[str] = None,
) -> Tuple[str, str, str]:
    if idioma_destino not in config.TRANSLATION_IDIOMAS:
        raise HTTPException(status_code=400, detail="Idioma destino no soportado")

    origen = idioma_origen or detectar_idioma(texto)
    if origen == idioma_destino:
        return texto, texto, origen

    h = _hash_texto(texto)
    cached = db.query(TraduccionCache).filter(
        TraduccionCache.hash_texto == h,
        TraduccionCache.idioma_origen == origen,
        TraduccionCache.idioma_destino == idioma_destino,
    ).first()
    if cached:
        return texto, cached.texto_traducido, origen

    if not config.TRANSLATION_ENABLED or not config.GOOGLE_TRANSLATE_API_KEY:
        traducido = _mock_traducir(texto, idioma_destino, origen)
    else:
        with httpx.Client(timeout=20.0) as client:
            r = client.post(
                GOOGLE_TRANSLATE_URL,
                params={"key": config.GOOGLE_TRANSLATE_API_KEY},
                json={"q": texto, "source": origen, "target": idioma_destino, "format": "text"},
            )
            if r.status_code >= 400:
                logger.warning("Google translate failed: %s", r.text)
                raise HTTPException(status_code=503, detail="Servicio de traducción no disponible")
            translations = r.json().get("data", {}).get("translations", [])
            if not translations:
                raise HTTPException(status_code=503, detail="Respuesta de traducción vacía")
            traducido = translations[0]["translatedText"]

    db.add(TraduccionCache(
        id=str(uuid4()),
        hash_texto=h,
        idioma_origen=origen,
        idioma_destino=idioma_destino,
        texto_traducido=traducido,
    ))
    db.commit()
    return texto, traducido, origen
