"""Inbound webhook yönetimi (admin). Servisler token'lı URL'e hata POST'lar."""
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.core import security as auth
from app.db import webhooks as db
from app.schemas.webhook import WebhookActiveIn, WebhookIn

router = APIRouter(tags=["webhooks"])


def _with_url(request: Request, webhook: dict) -> dict:
    url = f"{str(request.base_url).rstrip('/')}/ingest/hook/{webhook['token']}"
    return {**webhook, "ingest_url": url}


@router.get("/webhooks")
async def webhooks_list(request: Request, project_id: int = Query(...),
                        admin: dict = Depends(auth.require_admin)):
    return [_with_url(request, w) for w in await db.list_webhooks(project_id)]


@router.post("/webhooks")
async def webhook_create(body: WebhookIn, request: Request, project_id: int = Query(...),
                         admin: dict = Depends(auth.require_admin)):
    webhook = await db.create_webhook(
        project_id=project_id,
        name=body.name.strip(),
        token=secrets.token_urlsafe(24),
        source=(body.source or "").strip() or None,
    )
    return _with_url(request, webhook)


@router.patch("/webhooks/{webhook_id}")
async def webhook_toggle(webhook_id: int, body: WebhookActiveIn, request: Request,
                         admin: dict = Depends(auth.require_admin)):
    webhook = await db.set_webhook_active(webhook_id, body.active)
    if not webhook:
        raise HTTPException(status_code=404, detail="webhook bulunamadı")
    return _with_url(request, webhook)


@router.delete("/webhooks/{webhook_id}")
async def webhook_delete(webhook_id: int, admin: dict = Depends(auth.require_admin)):
    if not await db.delete_webhook(webhook_id):
        raise HTTPException(status_code=404, detail="webhook bulunamadı")
    return {"deleted": webhook_id}
