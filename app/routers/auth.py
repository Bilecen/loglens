"""Kimlik: kayıt (bootstrap) / giriş / ben / token yenileme (mobil)."""
from fastapi import APIRouter, Depends, HTTPException

from app.core import security as auth
from app.db import users as db
from app.schemas.auth import LoginIn, RefreshIn, RegisterIn

router = APIRouter(tags=["auth"])


async def _session(user: dict) -> dict:
    """Access + refresh token üret, refresh'i hash'leyerek sakla."""
    raw, token_hash, expires = auth.new_refresh_token()
    await db.create_refresh_token(user["id"], token_hash, expires)
    return {"token": auth.create_token(user), "refresh_token": raw, "user": user}


@router.get("/auth/bootstrap")
async def auth_bootstrap():
    """UI, hiç kullanıcı yoksa ilk-admin oluşturma ekranını göstermek için sorar."""
    return {"needs_bootstrap": await db.count_users() == 0}


@router.post("/auth/register")
async def register(body: RegisterIn):
    """Yalnızca İLK admin'i oluşturmak için (bootstrap). Kullanıcı varsa kapalı;
    yeni kullanıcılar admin tarafından POST /users ile oluşturulur."""
    if await db.count_users() > 0:
        raise HTTPException(status_code=403, detail="Kayıt kapalı. Yeni kullanıcıyı yönetici oluşturur.")
    user = await db.create_user(
        email=body.email, name=body.name,
        password_hash=auth.hash_password(body.password), role="admin",
    )
    return await _session(user)


@router.post("/auth/login")
async def login(body: LoginIn):
    user = await db.get_user_by_email(body.email)
    if not user or not auth.verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="E-posta veya parola hatalı")
    user.pop("password_hash", None)
    return await _session(user)


@router.post("/auth/refresh")
async def refresh(body: RefreshIn):
    """Refresh token ile yeni access token al (mobil, oturum sürekliliği)."""
    user_id = await db.get_refresh_user_id(auth.hash_token(body.refresh_token))
    if not user_id:
        raise HTTPException(status_code=401, detail="Geçersiz ya da süresi dolmuş refresh token")
    user = await db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
    return {"token": auth.create_token(user), "user": user}


@router.post("/auth/logout")
async def logout(body: RefreshIn):
    """Refresh token'ı iptal et (mobil çıkış / cihaz kaybı)."""
    await db.delete_refresh_token(auth.hash_token(body.refresh_token))
    return {"ok": True}


@router.get("/auth/me")
async def me(user: dict = Depends(auth.get_current_user)):
    return user
