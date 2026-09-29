"""Hata gruplarını okuma + CMS yönetimi (giriş ister)."""
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core import security as auth
from app.db import clusters as db
from app.db import notifications as db_notifications
from app.db import settings as db_settings
from app.schemas.cluster import ClusterUpdateIn, NoteIn, OpinionIn
from app.services import llm, realtime, settings_store

router = APIRouter(tags=["clusters"])

# Terminal (nihai) durumlar: buraya geçtikten sonra geri almak yalnızca admin'e açık.
TERMINAL_STATUS = {"resolved", "ignored"}


@router.get("/clusters")
async def clusters(
    project_id: int = Query(..., description="hangi projenin hataları"),
    q: str | None = Query(None, description="başlık/özet arama"),
    severity: str | None = Query(None),
    origin: str | None = Query(None, pattern="^(mobile|web|service|unknown)$"),
    status: str | None = Query(None, pattern="^(open|investigating|resolved|ignored)$"),
    sort: str = Query("last_seen", pattern="^(last_seen|count|first_seen)$"),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    user: dict = Depends(auth.get_current_user),
):
    items = await db.list_clusters(project_id, q=q, severity=severity, origin=origin,
                                   status=status, sort=sort, limit=limit, offset=offset)
    total = await db.count_clusters(project_id, q=q, severity=severity, origin=origin, status=status)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/clusters/{cluster_id}")
async def cluster_detail(cluster_id: int, user: dict = Depends(auth.get_current_user)):
    cluster = await db.get_cluster(cluster_id)
    if not cluster:
        raise HTTPException(status_code=404, detail="cluster bulunamadı")
    occurrences = await db.list_occurrences(cluster_id, limit=100)
    notes = await db.list_notes(cluster_id)
    opinions = await db.list_opinions(cluster_id)
    return {"cluster": cluster, "occurrences": occurrences, "notes": notes, "opinions": opinions}


_API_KEY_FIELD = {"claude": "anthropic_api_key", "openai": "openai_api_key", "gemini": "gemini_api_key"}


@router.get("/llm/providers")
async def llm_providers(user: dict = Depends(auth.get_current_user)):
    """İkinci görüş için kullanılabilir (yapılandırılmış) sağlayıcılar."""
    eff = await settings_store.effective()
    providers = ["local", "ollama"]
    if eff.get("openai_api_key"):
        providers.append("openai")
    if eff.get("gemini_api_key"):
        providers.append("gemini")
    if eff.get("anthropic_api_key"):
        providers.append("claude")
    active = eff["llm_provider"]
    if active in _API_KEY_FIELD:
        configured = bool(eff.get(_API_KEY_FIELD[active]))
    else:
        # local/ollama anahtar istemez — kod içindeki placeholder varsayılanlar hep "dolu"
        # görünür, o yüzden admin Ayarlar'dan bilinçli olarak base_url/model KAYDETMİŞ mi ona bak.
        ov = await db_settings.get_settings()
        configured = bool(ov.get(f"{active}_base_url") or ov.get(f"{active}_model"))
    return {"providers": providers, "active": active, "configured": configured}


@router.patch("/clusters/{cluster_id}")
async def cluster_update(cluster_id: int, body: ClusterUpdateIn,
                         user: dict = Depends(auth.get_current_user)):
    fields = body.model_dump(exclude_unset=True)
    if "status" in fields:
        await _guard_status_reversal(cluster_id, fields["status"], user)
    updated = await db.update_cluster_meta(cluster_id, fields)
    if not updated:
        raise HTTPException(status_code=404, detail="cluster bulunamadı")
    # Başkasına atama → atanana bildirim (kendine atamada bildirim yok)
    assignee = fields.get("assignee_id")
    if assignee and assignee != user["id"]:
        await db_notifications.create_notifications(
            [assignee], type="assigned", title="Sana bir hata atandı",
            body=updated.get("title"), cluster_id=cluster_id, project_id=None)
        await realtime.manager.broadcast({"type": "notification", "user_ids": [assignee]})
    return updated


async def _guard_status_reversal(cluster_id: int, new_status: str, user: dict) -> None:
    """Nihai bir durumdan (çözüldü/yok sayıldı) çıkış GERİ ALMADIR; yalnızca admin
    yapabilir. İleri yönlü akış herkese açık."""
    current = await db.get_cluster(cluster_id)
    if not current:
        raise HTTPException(status_code=404, detail="cluster bulunamadı")
    is_reversal = new_status != current["status"] and current["status"] in TERMINAL_STATUS
    if is_reversal and user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Nihai bir durumu (çözüldü/yok sayıldı) geri almak için admin yetkisi gerekir.",
        )


@router.post("/clusters/{cluster_id}/notes")
async def cluster_add_note(cluster_id: int, body: NoteIn,
                           user: dict = Depends(auth.get_current_user)):
    if not await db.get_cluster(cluster_id):
        raise HTTPException(status_code=404, detail="cluster bulunamadı")
    return await db.add_note(cluster_id, author_id=user["id"], body=body.body.strip())


@router.post("/clusters/{cluster_id}/interpret")
async def cluster_reinterpret(cluster_id: int, user: dict = Depends(auth.get_current_user)):
    """LLM erişilemediği için yorumlanmamış grubu elle yeniden yorumlat."""
    data = await db.get_cluster_reinterpret_input(cluster_id)
    if data is None:
        raise HTTPException(status_code=404, detail="cluster bulunamadı")
    if not data["template"]:
        raise HTTPException(status_code=400, detail="Bu grup yeniden yorumlanamaz (kayıtlı girdi yok)")
    try:
        interp = await llm.interpret(data["template"], None, data["source_snippet"])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM hâlâ yanıt vermiyor: {type(e).__name__}")
    return await db.set_cluster_interpretation(cluster_id, interp)


@router.post("/clusters/{cluster_id}/opinion")
async def cluster_opinion(cluster_id: int, body: OpinionIn,
                          user: dict = Depends(auth.get_current_user)):
    """Belirli bir sağlayıcıdan (GPT/Gemini/Claude…) bu hataya özel ikinci görüş al."""
    data = await db.get_cluster_reinterpret_input(cluster_id)
    if data is None:
        raise HTTPException(status_code=404, detail="cluster bulunamadı")
    if not data["template"]:
        raise HTTPException(status_code=400, detail="Bu grup için yorum girdisi yok")
    try:
        interp = await llm.interpret(data["template"], None, data["source_snippet"], provider=body.provider)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"{body.provider} yanıt vermedi: {type(e).__name__}")
    return await db.add_opinion(cluster_id, body.provider, interp)


async def _note_or_404(cluster_id: int, note_id: int) -> dict:
    note = await db.get_note(note_id)
    if not note or note["cluster_id"] != cluster_id:
        raise HTTPException(status_code=404, detail="not bulunamadı")
    return note


@router.patch("/clusters/{cluster_id}/notes/{note_id}")
async def cluster_edit_note(cluster_id: int, note_id: int, body: NoteIn,
                            user: dict = Depends(auth.get_current_user)):
    note = await _note_or_404(cluster_id, note_id)
    if note["author_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Yalnızca kendi notunu düzenleyebilirsin")
    return await db.update_note(note_id, body.body.strip())


@router.delete("/clusters/{cluster_id}/notes/{note_id}")
async def cluster_delete_note(cluster_id: int, note_id: int,
                              user: dict = Depends(auth.get_current_user)):
    note = await _note_or_404(cluster_id, note_id)
    if note["author_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Bu notu silme yetkin yok")
    await db.delete_note(note_id)
    return {"deleted": note_id}
