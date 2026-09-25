"""AI / entegrasyon ayarları (admin). Runtime override + bağlantı testi."""
from fastapi import APIRouter, Depends

import auth
import db
import llm
import services
import settings_store
from schemas import SettingsIn

router = APIRouter(tags=["settings"])

_TEST_LOG = "Test hatası: NullPointerException at com.demo.Foo.bar(Foo.java:1)"


@router.get("/settings")
async def settings_get(admin: dict = Depends(auth.require_admin)):
    """Etkin ayarların güvenli görünümü (gizli anahtarlar maskeli, '<key>_set' bayrağıyla)."""
    return settings_store.public_view(await settings_store.effective())


@router.put("/settings")
async def settings_put(body: SettingsIn, admin: dict = Depends(auth.require_admin)):
    await db.set_settings(body.model_dump(exclude_unset=True))
    services.clear_source_caches()  # token değişmiş olabilir; kaynak-kod cache'ini tazele
    return settings_store.public_view(await settings_store.effective())


@router.post("/settings/test-llm")
async def settings_test_llm(admin: dict = Depends(auth.require_admin)):
    """Kayıtlı LLM ayarlarıyla küçük bir örnek çağrı yapıp bağlantıyı test eder."""
    try:
        res = await llm.interpret(_TEST_LOG)
        return {"ok": True, "sample_title": res.get("title")}
    except Exception as e:  # bağlantı/anahtar/model hataları
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
