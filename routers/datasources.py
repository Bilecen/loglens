"""Otomatik veri kaynakları (Firebase/BigQuery) yönetimi (admin). Backend zamanlanmış çeker."""
from fastapi import APIRouter, Depends, HTTPException, Query

import auth
import datasources
import db
from schemas import DataSourceIn, DataSourceToggleIn

router = APIRouter(tags=["datasources"])


@router.get("/datasources")
async def datasources_list(project_id: int = Query(...), admin: dict = Depends(auth.require_admin)):
    return await db.list_data_sources(project_id)


@router.post("/datasources")
async def datasource_create(body: DataSourceIn, project_id: int = Query(...),
                            admin: dict = Depends(auth.require_admin)):
    data = body.model_dump()
    data["project_id"] = project_id
    return await db.create_data_source(data)


@router.patch("/datasources/{ds_id}")
async def datasource_toggle(ds_id: int, body: DataSourceToggleIn,
                            admin: dict = Depends(auth.require_admin)):
    ds = await db.set_data_source_enabled(ds_id, body.enabled)
    if not ds:
        raise HTTPException(status_code=404, detail="veri kaynağı bulunamadı")
    return ds


@router.delete("/datasources/{ds_id}")
async def datasource_delete(ds_id: int, admin: dict = Depends(auth.require_admin)):
    if not await db.delete_data_source(ds_id):
        raise HTTPException(status_code=404, detail="veri kaynağı bulunamadı")
    return {"deleted": ds_id}


@router.post("/datasources/{ds_id}/run")
async def datasource_run(ds_id: int, admin: dict = Depends(auth.require_admin)):
    """Şimdi elle çalıştır (bağlantı/kimlik testi + ilk çekim)."""
    ds = await db.get_data_source(ds_id, with_creds=True)
    if not ds:
        raise HTTPException(status_code=404, detail="veri kaynağı bulunamadı")
    result = await datasources.run_source(ds)
    return {**result, "source": await db.get_data_source(ds_id)}
