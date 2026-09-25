"""
Kimlik doğrulama: bcrypt ile parola hash'i + JWT token.

- İlk kayıt olan kullanıcı otomatik 'admin' olur, sonrakiler 'member'.
- Token'ı Authorization: Bearer <jwt> başlığıyla gönderilir.
- get_current_user  -> giriş yapılmış olmayı zorunlu kılar
- require_admin     -> ayrıca admin rolü ister
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import db
from config import settings

_bearer = HTTPBearer(auto_error=False)


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "role": user["role"],
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _decode(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Oturum süresi doldu, tekrar giriş yapın")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Geçersiz token")


def new_refresh_token() -> tuple[str, str, "datetime"]:
    """(ham token, sha256 hash, bitiş zamanı) döndürür. Ham token yalnız istemciye verilir."""
    raw = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    expires = datetime.now(timezone.utc) + timedelta(days=settings.refresh_expire_days)
    return raw, token_hash, expires


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


async def user_from_token(token: str) -> dict | None:
    """WebSocket için: token'ı doğrula, kullanıcıyı döndür (geçersizse None)."""
    try:
        payload = _decode(token)
    except HTTPException:
        return None
    return await db.get_user_by_id(int(payload["sub"]))


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> dict:
    if creds is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Giriş gerekli",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = _decode(creds.credentials)
    user = await db.get_user_by_id(int(payload["sub"]))
    if not user:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Bu işlem için admin yetkisi gerekli")
    return user
