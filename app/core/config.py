from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- API sürümü (mobil istemci uyumluluğu için /health'te açıklanır) ---
    api_version: str = "1.0"

    # --- Veritabanı ---
    db_dsn: str = "postgresql://postgres:postgres@localhost:5432/logs"

    # --- Embedding (FastAPI içinde NATIVE çalışır, dışarı çağrı YOK) ---
    embed_model: str = "BAAI/bge-m3"  # çok dilli, 1024 boyut
    embed_dim: int = 1024

    # --- Gruplama eşiği ---
    # 1 - cosine_distance >= bu değer ise "aynı hata" say.
    # 0.88 ile başla, kendi verine göre 0.85–0.92 arası ayarla.
    similarity_threshold: float = 0.88

    # Fingerprint için stack trace'in üst kaç frame'i kullanılsın
    top_frames: int = 5

    # --- LLM provider: sadece YENİ gruplarda çalışır ---
    # "claude" veya "local"
    llm_provider: str = "local"

    # LLM'in title/summary ürettiği dil (serbest metin, örn. "Türkçe", "English", "Deutsch").
    # Tüm ekip için tek ve global — Ayarlar panelinden değişir.
    response_language: str = "Türkçe"

    # Claude API
    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-5"  # eriştiğin modele göre değiştir

    # Yerel model (LM Studio, OpenAI uyumlu endpoint)
    local_base_url: str = "http://localhost:1234/v1"  # LM Studio varsayılanı
    local_model: str = "qwen2.5-7b-instruct"
    local_api_key : str = ""

    # Ollama (OpenAI uyumlu endpoint; provider="ollama")
    ollama_base_url: str = "http://localhost:11434/v1"
    ollama_model: str = "llama3.1"

    # OpenAI (GPT) — OpenAI uyumlu endpoint
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"
    openai_api_key: str = ""

    # Gemini (Google) — OpenAI uyumlu endpoint
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    gemini_model: str = "gemini-2.0-flash"
    gemini_api_key: str = ""

    # --- Auth / JWT ---
    # prod'da MUTLAKA .env'den güçlü bir değer ver.
    jwt_secret: str = "dev-secret-change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 gün (access token)
    refresh_expire_days: int = 90          # refresh token (mobil uzun oturum)

    # --- GitHub entegrasyonu ---
    # Repo'ya token verilmezse bu global token kullanılır (salt-okunur PAT).
    github_token: str = ""
    # --- Azure DevOps entegrasyonu ---
    # Repo'ya token verilmezse bu global PAT kullanılır (Code:Read yetkisi yeter).
    azure_token: str = ""
    # Stack trace'ten çekilen snippet'te satırın kaç komşusu gösterilsin.
    source_context_lines: int = 6

    # --- Ortam ---
    # "production" | "development". Test-amaçlı özellikleri (örn. Hatalar sayfasındaki
    # "Test log" butonu) yalnızca development'ta gösterir. Docker/Coolify deploy'larında
    # güvenli taraf: varsayılan production.
    environment: str = "production"

    # MCP sunucusunun (/mcp) DNS-rebinding korumasında izin vereceği Host/Origin.
    # Boşsa yalnızca localhost'tan MCP erişimi çalışır (kütüphanenin güvenli varsayılanı);
    # gerçek bir domain arkasında (Coolify/Cloudflare vb.) MCP kullanmak için burada
    # deploy domain'ini ver, örn. "loglens.example.com".
    public_host: str = ""

    # Webhook/entegrasyon URL'lerinde kullanılacak şema. Reverse proxy (Cloudflare/Traefik)
    # TLS'i kendi üstünde sonlandırıp backend'e düz HTTP ile geldiğinde, X-Forwarded-Proto
    # güvenilir şekilde ayarlanmamışsa üretilen URL yanlışlıkla http:// olur. "auto" önce
    # X-Forwarded-Proto header'ına bakar, yoksa ham bağlantı şemasını kullanır; kullanıcı
    # Ayarlar'dan "http"/"https" seçerek bunu ezebilir.
    public_url_scheme: str = "auto"  # "auto" | "http" | "https"


settings = Settings()
