"""Projeler + üye görevlendirmesi. Liste herkese açık (görünürlük global);
oluşturma/silme ve üye yönetimi admin'e aittir."""
from fastapi import APIRouter, Depends, HTTPException

import auth
import db
from schemas import MemberIn, ProjectIn

router = APIRouter(tags=["projects"])


@router.get("/projects")
async def projects_list(user: dict = Depends(auth.get_current_user)):
    return await db.list_projects()


@router.post("/projects")
async def project_create(body: ProjectIn, admin: dict = Depends(auth.require_admin)):
    try:
        return await db.create_project(name=body.name.strip(), key=body.key.strip())
    except Exception:
        raise HTTPException(status_code=409, detail="Bu anahtar (key) zaten kullanımda")


@router.delete("/projects/{project_id}")
async def project_delete(project_id: int, admin: dict = Depends(auth.require_admin)):
    if not await db.delete_project(project_id):
        raise HTTPException(status_code=404, detail="proje bulunamadı")
    return {"deleted": project_id}


@router.get("/projects/{project_id}/members")
async def project_members(project_id: int, user: dict = Depends(auth.get_current_user)):
    return await db.list_project_members(project_id)


@router.post("/projects/{project_id}/members")
async def project_add_member(project_id: int, body: MemberIn,
                             admin: dict = Depends(auth.require_admin)):
    if not await db.project_exists(project_id):
        raise HTTPException(status_code=404, detail="proje bulunamadı")
    await db.add_project_member(project_id, body.user_id)
    return await db.list_project_members(project_id)


@router.delete("/projects/{project_id}/members/{user_id}")
async def project_remove_member(project_id: int, user_id: int,
                                admin: dict = Depends(auth.require_admin)):
    if not await db.remove_project_member(project_id, user_id):
        raise HTTPException(status_code=404, detail="üye bulunamadı")
    return {"removed": user_id}
