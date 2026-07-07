import bcrypt
from jose import jwt, JWTError
from datetime import datetime, timedelta
from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE

def hash_password(password: str) -> str:
    """
    Genera el hash bcrypt de una contraseña.
    
    Args:
        password: Contraseña en texto plano
        
    Returns:
        Hash bcrypt de la contraseña (60 caracteres, empieza con $2b$)
        
    Note:
        bcrypt tiene un límite de 72 bytes. Si la contraseña es más larga,
        se trunca automáticamente antes del hash.
    """
    # Truncar a 72 bytes para evitar ValueError de bcrypt
    if isinstance(password, str):
        password_bytes = password.encode('utf-8')[:72]
    elif isinstance(password, bytes):
        password_bytes = password[:72]
    else:
        raise TypeError("Password must be a string or bytes")
    
    # Generar salt y hash
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica si una contraseña en texto plano coincide con un hash bcrypt.
    
    Args:
        plain_password: Contraseña en texto plano
        hashed_password: Hash bcrypt de la contraseña
        
    Returns:
        True si las contraseñas coinciden, False en caso contrario
    """
    # Truncar la contraseña antes de verificar para evitar ValueError
    if isinstance(plain_password, str):
        password_bytes = plain_password.encode('utf-8')[:72]
    elif isinstance(plain_password, bytes):
        password_bytes = plain_password[:72]
    else:
        raise TypeError("Password must be a string or bytes")
    
    if isinstance(hashed_password, str):
        hashed_password_bytes = hashed_password.encode('utf-8')
    elif isinstance(hashed_password, bytes):
        hashed_password_bytes = hashed_password
    else:
        raise TypeError("Hashed password must be a string or bytes")
    
    return bcrypt.checkpw(password_bytes, hashed_password_bytes)

def create_access_token(user_id: str, rol: str, expires_delta: timedelta = None, importador_id: str = None) -> str:
    """
    Genera un token JWT con los claims del usuario.
    
    Args:
        user_id: ID del usuario (UUID como string)
        rol: Rol del usuario ("solicitante", "importador", "trabajador" o "admin")
        expires_delta: Tiempo de expiración personalizado (opcional, usa el default si no se proporciona)
        importador_id: ID de la empresa importadora a la que pertenece la cuenta
            (solo para rol "importador"/"trabajador"; None para solicitante/admin).
            Se incluye en el token para no depender de que Usuario.id == Importador.id.
        
    Returns:
        Token JWT codificado en base64
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + ACCESS_TOKEN_EXPIRE
    
    # Payload del token JWT
    to_encode = {
        "sub": user_id,      # Subject: ID del usuario
        "rol": rol,          # Rol del usuario
        "importador_id": importador_id,  # Empresa importadora asociada (si aplica)
        "exp": expire,       # Fecha de expiración
        "iat": datetime.utcnow()  # Fecha de emisión
    }
    
    # Codificar el token
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> dict:
    """
    Decodifica y valida un token JWT.
    
    Args:
        token: Token JWT a decodificar
        
    Returns:
        Diccionario con los claims del token (sub, rol, exp, iat)
        
    Raises:
        JWTError: Si el token es inválido o está expirado
    """
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])