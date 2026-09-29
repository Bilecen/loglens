from pydantic import BaseModel, Field


class SettingsIn(BaseModel):
    # Hepsi opsiyonel: yalnızca gönderilen alanlar güncellenir (secret'lar
    # değişmediyse UI göndermez). "" = temizle (env fallback'e dön).
    llm_provider: str | None = Field(None, pattern="^(local|ollama|claude|openai|gemini)$")
    response_language: str | None = Field(None, max_length=40, description="örn. 'Türkçe', 'English'")
    anthropic_api_key: str | None = None
    claude_model: str | None = None
    local_base_url: str | None = None
    local_model: str | None = None
    local_api_key: str | None = None
    ollama_base_url: str | None = None
    ollama_model: str | None = None
    openai_base_url: str | None = None
    openai_model: str | None = None
    openai_api_key: str | None = None
    gemini_base_url: str | None = None
    gemini_model: str | None = None
    gemini_api_key: str | None = None
    github_token: str | None = None
    azure_token: str | None = None
    public_url_scheme: str | None = Field(None, pattern="^(auto|http|https)$")
