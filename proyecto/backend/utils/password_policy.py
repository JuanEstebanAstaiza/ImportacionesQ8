"""Política de contraseñas sin imports del resto del proyecto (evita ciclos)."""


def password_cumple_politica(password: str) -> bool:
    """Mínimo 9 chars, al menos una letra y un dígito."""
    if not password or len(password) < 9:
        return False
    tiene_letra = any(c.isalpha() for c in password)
    tiene_digito = any(c.isdigit() for c in password)
    return tiene_letra and tiene_digito
