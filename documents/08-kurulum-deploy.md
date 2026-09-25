# 8. Kurulum & Deploy

LogLens **kendi sunucunuza** kurulur. Bileşenler:
- **Backend** — FastAPI (:8000). Embedding modeli process İÇİNDE çalışır (dışarı çağrı yok).
- **Frontend** — React/Vite (build sonrası statik).
- **Veritabanı** — PostgreSQL + pgvector.

## Docker ile
Depoda `Dockerfile` ve `docker-compose.yml` hazırdır.

```bash
docker compose up -d --build
```
- **db** — pgvector'lı Postgres; `schema.sql` ilk açılışta otomatik çalışır (varsayılan proje +
  tablolar dahil).
- **api** — backend imajı.

### Embedding modeli imaja gömülü
Backend imajı, embedding modelini (**bge-m3**) build sırasında **imaja gömer** — deploy'da
internet gerektirmez, offline çalışır (runtime'da HuggingFace'e bağlanmaz). CPU-only torch
kullanıldığı için gereksiz CUDA kütüphaneleri imaja girmez.

## Ortam değişkenleri (özet)
`.env` (ya da compose env) ile verilir:

| Değişken | Açıklama |
|----------|----------|
| `db_dsn` | Postgres bağlantısı |
| `llm_provider` | `local` / `ollama` / `claude` (UI'dan da değişir) |
| `local_base_url`, `local_model` | LM Studio |
| `ollama_base_url`, `ollama_model` | Ollama |
| `anthropic_api_key`, `claude_model` | Claude |
| `github_token`, `azure_token` | Kaynak kod erişimi (global) |
| `jwt_secret` | **Prod'da mutlaka güçlü bir değer verin** |

> AI/entegrasyon anahtarları çalışırken **Ayarlar** panelinden de yönetilebilir (`.env`'i override eder).

## Coolify ile deploy
- Coolify uygulamayı Docker olarak koşar ve **otomatik HTTPS** (Let's Encrypt) sağlar.
- **WebSocket:** Canlı sohbet/presence/bildirim için reverse-proxy'nin **WebSocket upgrade'i**
  geçirmesi gerekir. Coolify/Caddy/Traefik bunu otomatik yapar — ekstra ayar gerekmez.
- Log toplama için aynı host'a Vector kurabilir ya da Coolify Log Drain kullanabilirsiniz
  (bkz. [4. bölüm](04-entegrasyonlar.md)).

## Şema güncellemeleri
Yeni sürümlerde şema değişiklikleri `schema.sql`'de idempotent (IF NOT EXISTS / ALTER …)
yazılıdır; yeni kurulumda otomatik gelir, mevcut kurulumda migration olarak uygulanır.
