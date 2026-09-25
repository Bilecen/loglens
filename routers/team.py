"""Ekip: presence (müsait/dışarıda/meşgul) + canlı sohbet (polling)."""
from fastapi import APIRouter, Depends, Query

import auth
import db
import realtime
from schemas import MessageIn, PresenceIn

router = APIRouter(tags=["team"])


@router.get("/team")
async def team(user: dict = Depends(auth.get_current_user)):
    """Tüm kullanıcılar + presence + online (aktif WS bağlantısı) durumu."""
    members = await db.list_team(user["id"])
    for m in members:
        m["online"] = realtime.manager.is_online(m["id"])
    return members


@router.patch("/team/presence")
async def set_presence(body: PresenceIn, user: dict = Depends(auth.get_current_user)):
    await db.set_presence(user["id"], body.presence)
    return {"presence": body.presence}


@router.get("/chat")
async def chat_list(after: int = Query(0, ge=0), user: dict = Depends(auth.get_current_user)):
    """Ekip sohbeti mesajları. Polling: after = son görülen mesaj id'si."""
    return await db.list_messages(after_id=after)


@router.post("/chat")
async def chat_send(body: MessageIn, user: dict = Depends(auth.get_current_user)):
    return await db.add_message(user["id"], body.body.strip())
