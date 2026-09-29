"""Sistem: sağlık kontrolü + sunucu keşfi (public, kimlik gerektirmez)."""
from fastapi import APIRouter

from app.core.config import settings
from app.services import settings_store

router = APIRouter(tags=["system"])


@router.get("/health")
async def health():
    """Mobil/web istemciler QR ya da elle eklenen sunucu URL'ini bununla doğrular:
    ok=true + name="loglens" olması, gerçek bir LogLens sunucusu olduğunu gösterir."""
    eff = await settings_store.effective()
    return {
        "ok": True,
        "name": "loglens",
        "api_version": settings.api_version,
        "provider": eff["llm_provider"],
        "embed_model": settings.embed_model,
        "environment": settings.environment,
        "features": {
            "websocket": True,
            "chat": True,
            "notifications": True,
            "refresh_token": True,
        },
    }
