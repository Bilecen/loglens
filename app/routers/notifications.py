"""Kullanıcının bildirim inbox'ı (in-app). Web + mobil aynı uçları kullanır.
Push gelmese de buradan görülür; polling ile çekilir."""
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core import security as auth
from app.db import notifications as db

router = APIRouter(tags=["notifications"])


@router.get("/notifications")
async def notifications_list(limit: int = Query(50, le=100),
                             user: dict = Depends(auth.get_current_user)):
    """{items, unread} — giriş yapan kullanıcının bildirimleri + okunmamış sayısı."""
    return await db.list_notifications(user["id"], limit)


@router.post("/notifications/{notification_id}/read")
async def notification_read(notification_id: int,
                            user: dict = Depends(auth.get_current_user)):
    if not await db.mark_notification_read(notification_id, user["id"]):
        raise HTTPException(status_code=404, detail="bildirim bulunamadı")
    return {"ok": True}


@router.post("/notifications/read-all")
async def notifications_read_all(user: dict = Depends(auth.get_current_user)):
    return {"marked": await db.mark_all_notifications_read(user["id"])}
