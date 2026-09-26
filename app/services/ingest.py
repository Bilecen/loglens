"""
İş mantığı: log işleme hattı ve kaynak-kod çözümleme.
Endpoint'lerden ayrı tutulur; router'lar bu fonksiyonları çağırır.

Akış (yeni log geldiğinde):
  1) temizle + fingerprint üret
  2) fingerprint kesin eşleşme?  -> VAR: count+1, LLM YOK
  3) yoksa embedding + vektör arama -> benzer VAR: count+1, LLM YOK
  4) hiçbiri yoksa -> YENİ GRUP: (varsa) kaynak çek -> LLM -> küme
"""
import uuid

from app.core.config import settings
from app.db import clusters as db_clusters
from app.db import notifications as db_notifications
from app.db import projects as db_projects
from app.db import repos as db_repos
from app.schemas.cluster import LogIn
from app.services import azure_src, embedding, github_src, llm, realtime
from app.services.normalize import build_template, classify_origin, fingerprint


def source_module(provider: str | None):
    """Repo provider'ına göre kaynak-kod modülünü seç."""
    return azure_src if provider == "azure" else github_src


def clear_source_caches() -> None:
    github_src.clear_cache()
    azure_src.clear_cache()


async def resolve_source(project_id: int, stack_trace: str | None) -> dict | None:
    """Projenin bağlı repoları içinden stack trace'e uyan ilk kaynak snippet'ini bul."""
    if not stack_trace:
        return None
    try:
        repos = await db_repos.list_repos(project_id, include_token=True)
        for repo in repos:
            snippet = await source_module(repo.get("provider")).fetch_snippet(repo, stack_trace)
            if snippet:
                return snippet
    except Exception:
        return None  # entegrasyon best-effort; akışı bozma
    return None


async def process_log(project_id: int, log: LogIn) -> dict:
    template = build_template(log.error_type, log.message, log.stack_trace, settings.top_frames)
    fp = fingerprint(log.error_type, log.stack_trace, settings.top_frames)

    # --- 1. Katman: kesin eşleşme (proje bazında) ---
    hit = await db_clusters.find_by_fingerprint(project_id, fp)
    if hit:
        count = await db_clusters.bump_cluster(hit["id"], log.app_version, log.platform, log.message)
        return {"status": "duplicate", "match": "fingerprint",
                "group_key": hit["group_key"], "occurrence_count": count}

    # --- 2. Katman: vektör benzerlik (proje bazında) ---
    vec = embedding.embed(template)
    similar = await db_clusters.find_by_vector(project_id, vec, settings.similarity_threshold)
    if similar:
        count = await db_clusters.bump_cluster(similar["id"], log.app_version, log.platform, log.message)
        return {"status": "duplicate", "match": "vector",
                "group_key": similar["group_key"], "occurrence_count": count,
                "similarity": round(similar["similarity"], 4)}

    # --- 3. YENİ GRUP: (varsa) kaynak kodu çek -> LLM -> küme ---
    src = await resolve_source(project_id, log.stack_trace)
    try:
        interpretation = await llm.interpret(template, log.platform, src["snippet"] if src else None)
        llm_ok = True
    except Exception:
        # Dış model erişilemedi/yanıt vermedi → grup yine oluşur, sonra elle yorumlanır.
        interpretation = _fallback_interpretation(log)
        llm_ok = False
    interpretation["origin"] = classify_origin(log.platform) or interpretation.get("origin") or "unknown"
    group_key = f"ERR-{uuid.uuid4().hex[:8]}"
    cluster_id, count = await db_clusters.create_cluster(
        project_id=project_id, group_key=group_key, fingerprint=fp, vec=vec,
        llm=interpretation, app_version=log.app_version,
        platform=log.platform, raw_message=log.message,
        template=template, llm_ok=llm_ok,
    )
    if count == 1 and src:
        await db_clusters.set_cluster_source(cluster_id, src["snippet"], src["url"])
    # Yeni ve önemli (critical/high) hata → proje üyelerine bildirim (yalnız LLM yorumu varsa)
    if count == 1 and llm_ok and interpretation["severity"] in ("critical", "high"):
        members = await db_projects.project_member_ids(project_id)
        await db_notifications.create_notifications(
            members, type="new_error",
            title=f"Yeni {interpretation['severity']} hata",
            body=interpretation.get("title"), cluster_id=cluster_id, project_id=project_id)
        if members:
            await realtime.manager.broadcast({"type": "notification", "user_ids": members})
    return {
        "status": "new_cluster" if count == 1 else "duplicate",
        "match": None if count == 1 else "fingerprint",
        "group_key": group_key, "cluster_id": cluster_id,
        "occurrence_count": count, **interpretation,
        "source_url": src["url"] if src else None,
        "llm_ok": llm_ok,
    }


def _fallback_interpretation(log: LogIn) -> dict:
    """LLM erişilemediğinde küme oluşturmak için asgari yorum (sonra elle güncellenir)."""
    first_line = (log.message or "").strip().splitlines()[0] if log.message else ""
    return {
        "title": (first_line[:140] or "Yorumlanmadı (LLM erişilemedi)"),
        "summary": None,
        "source": log.error_type,
        "origin": None,
        "severity": "medium",
    }
