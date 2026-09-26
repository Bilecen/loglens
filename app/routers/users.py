"""Kullanıcı yönetimi (admin)."""
from fastapi import APIRouter, Depends, HTTPException

from app.core import security as auth
from app.db import users as db
from app.schemas.user import RoleIn, UpdateMeIn, UserCreateIn

router = APIRouter(tags=["users"])


@router.get("/users")
async def users_list(admin: dict = Depends(auth.require_admin)):
    return await db.list_users()


@router.patch("/users/me")
async def update_me(body: UpdateMeIn, user: dict = Depends(auth.get_current_user)):
    """Kendi profilini düzenle: ad, parola, fotoğraf (data-URI). Herkes kendi hesabını."""
    fields = body.model_dump(exclude_unset=True)
    if fields.get("password"):
        fields["password_hash"] = auth.hash_password(fields.pop("password"))
    else:
        fields.pop("password", None)
    updated = await db.update_me(user["id"], fields)
    updated.pop("password_hash", None)
    return updated


@router.post("/users")
async def user_create(body: UserCreateIn, admin: dict = Depends(auth.require_admin)):
    if await db.get_user_by_email(body.email):
        raise HTTPException(status_code=409, detail="Bu e-posta zaten kayıtlı")
    return await db.create_user(
        email=body.email, name=body.name,
        password_hash=auth.hash_password(body.password), role=body.role,
    )


@router.patch("/users/{user_id}/role")
async def user_role(user_id: int, body: RoleIn, admin: dict = Depends(auth.require_admin)):
    updated = await db.update_user_role(user_id, body.role)
    if not updated:
        raise HTTPException(status_code=404, detail="kullanıcı bulunamadı")
    return updated


@router.delete("/users/{user_id}")
async def user_delete(user_id: int, admin: dict = Depends(auth.require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Kendinizi silemezsiniz")
    if not await db.delete_user(user_id):
        raise HTTPException(status_code=404, detail="kullanıcı bulunamadı")
    return {"deleted": user_id}
