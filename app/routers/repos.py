"""Kod repoları (GitHub / Azure DevOps) yönetimi (admin)."""
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core import security as auth
from app.db import repos as db
from app.schemas.repo import RepoIn
from app.services import ingest as ingest_service

router = APIRouter(tags=["repos"])


@router.get("/repos")
async def repos_list(project_id: int = Query(...), admin: dict = Depends(auth.require_admin)):
    return await db.list_repos(project_id)


@router.post("/repos")
async def repo_add(body: RepoIn, project_id: int = Query(...),
                   admin: dict = Depends(auth.require_admin)):
    repo = await db.create_repo(
        project_id=project_id, provider=body.provider, full_name=body.full_name,
        default_branch=body.default_branch, token=body.token,
        path_prefix=body.path_prefix,
    )
    ingest_service.clear_source_caches()
    return repo


@router.delete("/repos/{repo_id}")
async def repo_delete(repo_id: int, admin: dict = Depends(auth.require_admin)):
    if not await db.delete_repo(repo_id):
        raise HTTPException(status_code=404, detail="repo bulunamadı")
    ingest_service.clear_source_caches()
    return {"deleted": repo_id}
