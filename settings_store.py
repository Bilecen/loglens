"""
Runtime ayar katmanı: AI/entegrasyon anahtarları .env yerine (ya da üstüne)
UI'dan yönetilebilir. app_settings tablosundaki değer varsa onu, yoksa .env
(config.settings) değerini kullanır.

- effective()      -> tüm etkin ayarlar (gizli anahtarlar dahil, backend içi kullanım)
- public_view(ov)  -> UI'ya güvenli görünüm (gizli alanlar maskeli, sadece "set mi" bilgisi)
- KEYS             -> yönetilebilir anahtarların meta bilgisi (gizli mi + varsayılan)
"""
import db
from config import settings

# key -> (secret?, env-default getter)
KEYS = {
    "llm_provider":       (False, lambda: settings.llm_provider),      # local | ollama | claude
    "response_language":  (False, lambda: settings.response_language),  # LLM title/summary dili
    "anthropic_api_key":  (True,  lambda: settings.anthropic_api_key),
    "claude_model":       (False, lambda: settings.claude_model),
    "local_base_url":     (False, lambda: settings.local_base_url),
    "local_model":        (False, lambda: settings.local_model),
    "local_api_key":      (True,  lambda: settings.local_api_key),
    "ollama_base_url":    (False, lambda: getattr(settings, "ollama_base_url", "http://localhost:11434/v1")),
    "ollama_model":       (False, lambda: getattr(settings, "ollama_model", "llama3.1")),
    "openai_base_url":    (False, lambda: getattr(settings, "openai_base_url", "https://api.openai.com/v1")),
    "openai_model":       (False, lambda: getattr(settings, "openai_model", "gpt-4o-mini")),
    "openai_api_key":     (True,  lambda: getattr(settings, "openai_api_key", "")),
    "gemini_base_url":    (False, lambda: getattr(settings, "gemini_base_url", "https://generativelanguage.googleapis.com/v1beta/openai")),
    "gemini_model":       (False, lambda: getattr(settings, "gemini_model", "gemini-2.0-flash")),
    "gemini_api_key":     (True,  lambda: getattr(settings, "gemini_api_key", "")),
    "github_token":       (True,  lambda: settings.github_token),
    "azure_token":        (True,  lambda: settings.azure_token),
}

SECRET_KEYS = {k for k, (secret, _) in KEYS.items() if secret}


async def effective() -> dict:
    """Etkin ayarlar: DB override doluysa onu, değilse .env varsayılanını döndür."""
    ov = await db.get_settings()
    out = {}
    for k, (_, default) in KEYS.items():
        v = ov.get(k)
        out[k] = v if (v is not None and v != "") else default()
    return out


def public_view(eff: dict) -> dict:
    """UI için güvenli görünüm: gizli anahtarlar değeriyle değil, 'ayarlı mı' bilgisiyle döner."""
    out = {}
    for k, (secret, _) in KEYS.items():
        if secret:
            out[k] = ""                    # değeri asla dışarı verme
            out[f"{k}_set"] = bool(eff.get(k))
        else:
            out[k] = eff.get(k) or ""
    return out
