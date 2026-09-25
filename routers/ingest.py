"""Log alımı (public — dış SDK/Firebase/webhook token istemez)."""
from fastapi import APIRouter, HTTPException, Query

import db
import services
from schemas import LogIn

router = APIRouter(tags=["ingest"])


async def _resolve_project(project_id: int | None) -> int:
    """Verilmişse onu, yoksa varsayılan (ilk) projeyi kullan."""
    pid = project_id or await db.default_project_id()
    if pid is None:
        raise HTTPException(status_code=400, detail="Önce bir proje oluşturun")
    return pid


@router.post("/ingest")
async def ingest(log: LogIn, project_id: int | None = Query(None)):
    return await services.process_log(await _resolve_project(project_id), log)


@router.post("/ingest/batch")
async def ingest_batch(logs: list[LogIn], project_id: int | None = Query(None)):
    pid = await _resolve_project(project_id)
    results = [await services.process_log(pid, log) for log in logs]
    return {"processed": len(results), "results": results}


async def _active_webhook(token: str) -> dict:
    webhook = await db.get_webhook_by_token(token)
    if not webhook or not webhook["active"]:
        raise HTTPException(status_code=404, detail="Webhook bulunamadı veya pasif")
    return webhook


def _apply_source(log: LogIn, webhook: dict) -> None:
    if webhook.get("source") and not log.source:
        log.source = webhook["source"]


@router.post("/ingest/hook/{token}")
async def ingest_hook(token: str, log: LogIn):
    """Token'lı public webhook: dış servisler kimlik doğrulaması olmadan bu URL'e
    hata POST'lar. Log, webhook'un ait olduğu projeye düşer. Token geçersiz/pasifse
    reddedilir; webhook'un 'source' etiketi payload'da kaynak boşsa yazılır."""
    webhook = await _active_webhook(token)
    _apply_source(log, webhook)
    await db.touch_webhook(webhook["id"])
    return await services.process_log(webhook["project_id"], log)


@router.post("/ingest/hook/{token}/batch")
async def ingest_hook_batch(token: str, logs: list[LogIn]):
    """Token'lı batch drain: log toplayıcılar (Vector/Fluent Bit) bir istekte çok
    sayıda hata gönderir. Hepsi webhook'un projesine düşer."""
    webhook = await _active_webhook(token)
    await db.touch_webhook(webhook["id"], n=len(logs))
    results = []
    for log in logs:
        _apply_source(log, webhook)
        results.append(await services.process_log(webhook["project_id"], log))
    return {"processed": len(results), "results": results}
