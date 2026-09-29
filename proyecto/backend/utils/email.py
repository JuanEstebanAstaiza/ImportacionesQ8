import logging
import smtplib
from html import escape
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import config

logger = logging.getLogger("importacionesq8")


def construir_html_zarpi(titulo: str, contenido_html: str) -> str:
    """Envuelve cualquier contenido en la plantilla HTML común de Zarpi."""
    logo_url = f"{config.FRONTEND_URL.rstrip('/')}/brand/zarpi-wordmark.svg"
    return (
        '<!doctype html><html lang="es"><head><meta charset="utf-8"></head>'
        '<body style="margin:0;background:#f4f4f5;padding:32px 16px;'
        'font-family:Arial,sans-serif;color:#18181b;">'
        '<div style="max-width:640px;margin:0 auto;background:#ffffff;'
        'border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;">'
        '<div style="padding:24px 28px;border-bottom:1px solid #e4e4e7;">'
        f'<img src="{escape(logo_url, quote=True)}" alt="Zarpi" width="132" '
        'style="display:block;height:auto;max-width:132px;">'
        '</div><div style="padding:28px;">'
        f'<h1 style="margin:0 0 18px;font-size:21px;line-height:1.3;'
        f'color:#18181b;">{escape(titulo)}</h1>'
        f'{contenido_html}'
        '</div><div style="padding:18px 28px;border-top:1px solid #e4e4e7;'
        'color:#71717a;font-size:12px;line-height:1.5;">'
        'Este correo fue enviado por Zarpi.</div></div></body></html>'
    )


def enviar_correo(destinatario: str, asunto: str, cuerpo_texto: str, cuerpo_html: str = None) -> bool:
    """
    Envía un correo real vía SMTP usando las credenciales configuradas en
    variables de entorno (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_API_KEY`,
    `SMTP_FROM`, `SMTP_USE_TLS`). `SMTP_PASSWORD` se conserva como alias antiguo.

    Si no hay `SMTP_HOST` configurado (ej. entorno de desarrollo/tests sin
    credenciales reales), se registra el correo en el log en vez de fallar, para
    no bloquear el flujo de negocio por falta de configuración de correo. En
    producción, `SMTP_HOST` debe estar siempre configurado.

    Devuelve `True` si el correo se envió (o se simuló vía log), `False` si el
    envío SMTP real fue intentado pero falló.
    """
    if not config.SMTP_HOST:
        logger.warning(
            "SMTP no configurado (SMTP_HOST vacío): se omite el envío real. "
            "destinatario=%s asunto=%s (cuerpo omitido por seguridad)",
            destinatario, asunto,
        )
        return True

    mensaje = MIMEMultipart("alternative")
    mensaje["Subject"] = asunto
    mensaje["From"] = config.SMTP_FROM
    mensaje["To"] = destinatario
    mensaje.attach(MIMEText(cuerpo_texto, "plain"))
    if cuerpo_html:
        mensaje.attach(MIMEText(cuerpo_html, "html"))

    try:
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=10) as servidor:
            if config.SMTP_USE_TLS:
                servidor.starttls()
            if config.SMTP_USER and config.SMTP_API_KEY:
                servidor.login(config.SMTP_USER, config.SMTP_API_KEY)
            servidor.sendmail(config.SMTP_FROM, [destinatario], mensaje.as_string())
        return True
    except Exception:
        logger.exception("Error enviando correo SMTP a %s", destinatario)
        return False


def enviar_correo_recuperacion_password(destinatario: str, otp: str, token: str) -> bool:
    """Construye y envía el correo de recuperación de contraseña con el OTP y el enlace."""
    enlace = f"{config.FRONTEND_URL}/restablecer-password?token={token}"
    asunto = "Recupera tu contraseña — Zarpi"
    cuerpo_texto = (
        f"Recibimos una solicitud para restablecer tu contraseña.\n\n"
        f"Tu código de verificación (OTP) es: {otp}\n"
        f"Este código y el enlace vencen en {config.PASSWORD_RESET_EXPIRE_MINUTES} minutos.\n\n"
        f"Enlace para restablecer tu contraseña: {enlace}\n\n"
        f"Si no solicitaste este cambio, puedes ignorar este correo."
    )
    cuerpo_html = construir_html_zarpi(
        asunto,
        f"<p>Recibimos una solicitud para restablecer tu contraseña.</p>"
        f"<p>Tu código de verificación es:</p>"
        f'<p style="font-size:30px;font-weight:700;letter-spacing:6px;color:#4f46e5;">{escape(otp)}</p>'
        f"<p>Este código y el enlace vencen en {config.PASSWORD_RESET_EXPIRE_MINUTES} minutos.</p>"
        f'<p><a href="{escape(enlace, quote=True)}" style="color:#4f46e5;">Restablecer contraseña</a></p>',
    )
    return enviar_correo(destinatario, asunto, cuerpo_texto, cuerpo_html)


def enviar_correo_notificacion(
    destinatario: str,
    titulo: str,
    mensaje: str = "",
    enlace_relativo: str = "",
) -> bool:
    """Réplica por correo de una notificación in-app.

    `enlace_relativo` se resuelve contra `FRONTEND_URL` para que el usuario entre
    directo a la pantalla correspondiente.
    """
    enlace = f"{config.FRONTEND_URL}{enlace_relativo}" if enlace_relativo else config.FRONTEND_URL
    cuerpo_texto = (
        f"{titulo}\n\n"
        f"{mensaje}\n\n"
        f"Entra a la plataforma: {enlace}\n\n"
        f"— Zarpi"
    )
    cuerpo_html = construir_html_zarpi(
        titulo,
        f"<p>{escape(mensaje)}</p>"
        f'<p><a href="{escape(enlace, quote=True)}" style="color:#4f46e5;">Entrar a la plataforma</a></p>',
    )
    return enviar_correo(destinatario, f"{titulo} — Zarpi", cuerpo_texto, cuerpo_html)


def enviar_correo_otp(destinatario: str, otp: str, proposito: str) -> bool:
    """Envía OTP de verificación de email o de login tras inactividad prolongada."""
    if proposito == "verificacion_email":
        asunto = "Verifica tu cuenta — Zarpi"
        cuerpo_texto = (
            f"Gracias por registrarte en Zarpi.\n\n"
            f"Tu código de verificación es: {otp}\n"
            f"Caduca en {config.OTP_EXPIRE_MINUTES} minutos.\n\n"
            f"Si no creaste esta cuenta, ignora este correo."
        )
    else:
        asunto = "Confirma tu inicio de sesión — Zarpi"
        cuerpo_texto = (
            f"Detectamos un inicio de sesión tras un periodo de inactividad.\n\n"
            f"Tu código de verificación es: {otp}\n"
            f"Caduca en {config.OTP_EXPIRE_MINUTES} minutos.\n\n"
            f"Si no fuiste tú, cambia tu contraseña de inmediato."
        )
    cuerpo_html = construir_html_zarpi(
        asunto,
        f'<p style="font-size:30px;font-weight:700;letter-spacing:6px;color:#4f46e5;">{escape(otp)}</p>'
        f"<p>Caduca en {config.OTP_EXPIRE_MINUTES} minutos.</p>",
    )
    return enviar_correo(destinatario, asunto, cuerpo_texto, cuerpo_html)

