# 10. Ortam Değişkenleri (.env) & Coolify

Backend, ayarları `.env` (ya da container ortam değişkenleri) üzerinden okur. AI/entegrasyon
anahtarları çalışırken **Ayarlar** panelinden de değiştirilebilir (env'i override eder).

## Yapıştırmaya hazır şablon
```dotenv
# ---------------- Veritabanı ----------------
db_dsn=postgresql://postgres:postgres@db:5432/logs

# ---------------- Kimlik / JWT ----------------
# PROD'DA MUTLAKA güçlü, rastgele bir değer verin (örn. `openssl rand -hex 32`)
jwt_secret=DEGISTIR-rastgele-uzun-bir-deger
jwt_algorithm=HS256
jwt_expire_minutes=10080          # 7 gün (access token)
refresh_expire_days=90            # refresh token (mobil uzun oturum)

# ---------------- Embedding (process içinde çalışır) ----------------
embed_model=BAAI/bge-m3
embed_dim=1024
similarity_threshold=0.88         # 0.85–0.92 arası ayarlanır
top_frames=5

# ---------------- LLM sağlayıcısı ----------------
llm_provider=local                # local | ollama | openai | gemini | claude

# LM Studio (yerel, OpenAI uyumlu)
local_base_url=http://host.docker.internal:1234/v1
local_model=qwen/qwen3.8-27b
local_api_key=

# Ollama (yerel, OpenAI uyumlu)
ollama_base_url=http://host.docker.internal:11434/v1
ollama_model=llama3.1

# OpenAI (GPT) — bulut
openai_base_url=https://api.openai.com/v1
openai_model=gpt-4o-mini
openai_api_key=

# Gemini (Google, OpenAI uyumlu endpoint) — bulut
gemini_base_url=https://generativelanguage.googleapis.com/v1beta/openai
gemini_model=gemini-2.0-flash
gemini_api_key=

# Anthropic (Claude) — bulut
anthropic_api_key=
claude_model=claude-sonnet-5

# ---------------- Kaynak kod erişimi (global fallback token) ----------------
github_token=
azure_token=
source_context_lines=6
```

## Değişken açıklamaları

| Değişken | Zorunlu | Açıklama |
|----------|:------:|----------|
| `db_dsn` | ✅ | Postgres bağlantısı. Compose ağında host = `db`. Coolify-yönetimli DB kullanırsan onun stringi. |
| `jwt_secret` | ✅ | Token imzalama sırrı. **Prod'da mutlaka değiştir.** |
| `jwt_algorithm` | — | Varsayılan `HS256`. |
| `jwt_expire_minutes` | — | Access token oturum süresi (dk). Varsayılan 7 gün. |
| `refresh_expire_days` | — | Refresh token süresi (gün). Varsayılan 90 — mobil uzun oturum içindir. |
| `embed_model` | — | Embedding modeli (imaja gömülü). Değiştirirsen `embed_dim` de değişir. |
| `embed_dim` | — | Vektör boyutu (bge-m3 = 1024). |
| `similarity_threshold` | — | Anlamsal gruplama eşiği. |
| `top_frames` | — | Fingerprint için stack'in üst N frame'i. |
| `llm_provider` | — | `local` / `ollama` / `openai` / `gemini` / `claude`. Ayarlar panelinden de değişir. |
| `local_*` | — | LM Studio base URL + model (+ opsiyonel key). |
| `ollama_*` | — | Ollama base URL + model. |
| `openai_*` | — | OpenAI (GPT) kullanacaksan. |
| `gemini_*` | — | Gemini kullanacaksan. |
| `anthropic_api_key`, `claude_model` | — | Claude kullanacaksan. |
| `github_token`, `azure_token` | — | Kaynak kod eşlemesi için global token (repo bazında da verilebilir). |
| `source_context_lines` | — | Kaynak snippet'te satırın kaç komşusu gösterilsin. |

> **Not:** `local_base_url`/`ollama_base_url` container İÇİNDEN host'a erişecekse `host.docker.internal`
> kullanın. LLM aynı sunucuda değilse gerçek adresini yazın. Sunucuda yerel LLM yoksa `llm_provider=claude`
> yapıp anahtarı verin.

## Coolify'da nasıl tanımlanır
Coolify env değişkenlerini **otomatik doldurmaz** — uygulamayı ekledikten sonra:
1. Uygulama → **Environment Variables** bölümüne gidin.
2. Yukarıdaki şablonu **toplu yapıştırın** (Coolify .env formatını parse eder).
3. `jwt_secret`'ı güçlü bir değerle değiştirin; kullanmadığınız sağlayıcı anahtarlarını boş bırakın.
4. **Coolify-yönetimli Postgres** kullanıyorsanız, onun bağlantı stringini `db_dsn`'e koyun
   (Coolify bazı kurulumlarda otomatik enjekte edebilir).

## Docker Compose ile
`docker-compose.yml` env'leri servis tanımında da taşır. Yerelde kök dizindeki `.env`
otomatik okunur (`env_file` / pydantic-settings). Prod'da Coolify env'i geçerlidir.
