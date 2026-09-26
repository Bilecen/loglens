"""İstatistik + grafik verileri (giriş ister)."""
from fastapi import APIRouter, Depends, Query

from app.core import security as auth
from app.db import clusters as db

router = APIRouter(tags=["stats"])


@router.get("/stats")
async def stats(project_id: int = Query(...), user: dict = Depends(auth.get_current_user)):
    return await db.stats(project_id)


@router.get("/stats/timeseries")
async def stats_timeseries(project_id: int = Query(...), days: int = Query(14, ge=1, le=90),
                           user: dict = Depends(auth.get_current_user)):
    return await db.timeseries(project_id, days)


@router.get("/stats/breakdown")
async def stats_breakdown(project_id: int = Query(...), user: dict = Depends(auth.get_current_user)):
    return await db.breakdown(project_id)
