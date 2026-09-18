import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import config

logger = logging.getLogger("importacionesq8")


def enviar_correo(destinatario: str, asunto: str, cuerpo_texto: str, cuerpo_html: str = None) -> bool:
    """
    Envía un correo real vía SMTP usando las credenciales configuradas en
    variables de entorno (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`,
    `SMTP_FROM`, `SMTP_USE_TLS`).

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
            if config.SMTP_USER and config.SMTP_PASSWORD:
                servidor.login(config.SMTP_USER, config.SMTP_PASSWORD)
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
    return enviar_correo(destinatario, asunto, cuerpo_texto)


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
    cuerpo_html = (
        f"<p><strong>{titulo}</strong></p>"
        f"<p>{mensaje}</p>"
        f'<p><a href="{enlace}">Entrar a la plataforma</a></p>'
        f"<p>— Zarpi</p>"
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
    return enviar_correo(destinatario, asunto, cuerpo_texto)

