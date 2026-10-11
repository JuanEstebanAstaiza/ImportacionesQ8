#!/usr/bin/env python3
"""Diagnóstico del envío de correo (OTP, notificaciones). Correr en el servidor:

    docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend \\
        python scripts/diagnostico_correo.py tu-correo@ejemplo.com

Revisa, en orden y sin imprimir la API key:
1. La configuración que ve el backend (proveedor, host, puerto, remitente).
2. Si el servidor deja salir conexiones a los puertos de correo y a la API HTTPS
   de Resend (muchos VPS bloquean 25/465/587).
3. El estado de los dominios en Resend (si la API key tiene permiso de leerlos).
4. Un envío de prueba real por el mismo camino que usa la plataforma.
"""
from __future__ import annotations

import logging
import socket
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx  # noqa: E402

import config  # noqa: E402
from utils import email  # noqa: E402

OK, MAL, AVISO = "✔", "✘", "!"


def _linea(estado: str, texto: str) -> None:
    print(f"  {estado} {texto}")


def _conecta(host: str, puerto: int, espera: float = 4.0) -> str:
    try:
        with socket.create_connection((host, puerto), timeout=espera):
            return "abierto"
    except socket.timeout:
        return "timeout (bloqueado por el servidor o el proveedor)"
    except OSError as error:
        return f"error: {error}"


def main() -> int:
    destino = sys.argv[1] if len(sys.argv) > 1 else None
    clave = config.SMTP_API_KEY or ""
    remitente = config.SMTP_FROM or ""
    dominio = remitente.rsplit("@", 1)[-1].strip(" >") if "@" in remitente else ""

    print("\n1. Configuración que ve el backend")
    _linea(OK, f"APP_ENV={config.APP_ENV}")
    _linea(OK if config.SMTP_HOST else MAL, f"SMTP_HOST={config.SMTP_HOST or '(vacío)'}  SMTP_PORT={config.SMTP_PORT}")
    _linea(OK, f"SMTP_USER={config.SMTP_USER or '(vacío)'}")
    if not clave:
        _linea(MAL, "SMTP_API_KEY vacía")
    else:
        _linea(OK if clave.startswith("re_") else AVISO,
               f"SMTP_API_KEY presente ({len(clave)} caracteres, empieza por '{clave[:3]}')"
               + ("" if clave.startswith("re_") else " — las de Resend empiezan por 're_'"))
        if clave.strip() != clave or clave.startswith(("'", '"')):
            _linea(MAL, "La API key tiene espacios o comillas alrededor: quítalas del .env")
    _linea(OK if dominio else MAL, f"SMTP_FROM={remitente or '(vacío)'}  → dominio remitente: {dominio or '?'}")
    via = "API HTTPS de Resend" if email.usa_api_resend() else "SMTP"
    _linea(OK, f"Transporte elegido: {via} (EMAIL_PROVIDER={config.EMAIL_PROVIDER or 'automático'})")

    print("\n2. Salida de red desde el servidor")
    host_smtp = config.SMTP_HOST or "smtp.resend.com"
    for puerto in (587, 465, 2587, 2465):
        resultado = _conecta(host_smtp, puerto)
        _linea(OK if resultado == "abierto" else MAL, f"{host_smtp}:{puerto} → {resultado}")
    resultado = _conecta("api.resend.com", 443)
    _linea(OK if resultado == "abierto" else MAL, f"api.resend.com:443 → {resultado}")

    if clave.startswith("re_"):
        print("\n3. Dominios en Resend")
        try:
            r = httpx.get("https://api.resend.com/domains", headers={"Authorization": f"Bearer {clave}"}, timeout=10)
            if r.status_code == 200:
                dominios = r.json().get("data", [])
                if not dominios:
                    _linea(MAL, "La cuenta de Resend no tiene dominios: agrega y verifica " + (dominio or "tu dominio"))
                for d in dominios:
                    estado = d.get("status")
                    _linea(OK if estado == "verified" else MAL, f"{d.get('name')}: {estado}")
                if dominio and not any(d.get("name") == dominio for d in dominios):
                    _linea(MAL, f"El remitente usa '{dominio}', que no está en Resend")
            elif r.status_code in (401, 403):
                motivo = (r.json() or {}).get("message", r.text) if r.headers.get("content-type", "").startswith("application/json") else r.text
                _linea(AVISO, f"No se pudieron leer los dominios (HTTP {r.status_code}): {motivo}. "
                              "Si la key es de 'solo envío' es normal; revisa el dominio en resend.com/domains.")
            else:
                _linea(MAL, f"Resend respondió HTTP {r.status_code}: {r.text[:200]}")
        except httpx.HTTPError as error:
            _linea(MAL, f"No se pudo consultar Resend: {type(error).__name__}: {error}")

    if destino:
        print(f"\n4. Envío de prueba a {destino} ({via})")
        logging.basicConfig(level=logging.INFO, format="     %(levelname)s %(message)s")
        enviado = email.enviar_correo(
            destino, "Prueba de correo — Zarpi",
            "Si lees esto, el correo de la plataforma funciona.",
            email.construir_html_zarpi("Prueba de correo", "<p>Si lees esto, el correo de la plataforma funciona.</p>"),
        )
        _linea(OK if enviado else MAL, "Enviado: revisa la bandeja (y spam)." if enviado
               else "No salió. El motivo está justo arriba.")
    else:
        print("\n4. Sin destinatario: pasa un correo como argumento para probar un envío real.")
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
