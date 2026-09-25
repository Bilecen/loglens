# LogLens

*[English version](README.en.md)*

Kendi sunucunuza kurduğunuz (self-hosted), **anlamsal hata kümeleme** ve **yapay zeka
yorumlu** hata-analiz platformu. Firebase Crashlytics/Analytics, mobil SDK'lar ve
production backend logları (Spring Boot, Ktor, FastAPI, Laravel, .NET) tek panelde toplanır.

- **Anlamsal gruplama** — aynı kök nedene sahip farklı hatalar embedding tabanlı benzerlikle
  tek kümede toplanır (fingerprint eşleşmez ama anlam aynıysa bile).
- **LLM yorumu** — her yeni küme için başlık, özet ve önem derecesi otomatik üretilir
  (yerel model / Ollama / OpenAI / Gemini / Claude — birini seçin, isteğe göre "ikinci görüş" alın).
- **Kaynak koda bağlama** — stack trace, bağlı GitHub/Azure DevOps reposundaki ilgili
  satıra otomatik eşlenir.
- **Çok-proje, roller, ekip** — proje bazlı görevlendirme (admin/developer/PO-PM/tester),
  canlı sohbet, presence, gerçek-zamanlı bildirim (WebSocket).
- **Mobil API** — tek native uygulama, kullanıcı kendi sunucu URL'ini QR ile ekler
  (self-hosted istemci deseni). Detay: [`documents/09-api.md`](documents/09-api.md).
- **MCP entegrasyonu** — kendi AI aracınızı (Claude Code, Claude Desktop, Cursor…) LogLens'e
  bağlayın; hata verisini okusun, kaynak koda bağlasın, düzeltip not düşsün. Detay:
  [`documents/11-mcp.md`](documents/11-mcp.md).
- **Çok dilli** — arayüz Türkçe/İngilizce (Profil menüsünden, kullanıcı bazlı); LLM'in
  ürettiği başlık/özet dili ayrıca Ayarlar'dan yapılandırılır (serbest metin, tüm ekip için).
- **Verisi sizde kalır** — kendi altyapınızda çalışır, üçüncü bir SaaS'a veri gitmez.

## Hızlı başlangıç (Docker Compose)

```bash
git clone https://github.com/Bilecen/loglens.git
cd loglens
cp env.example .env   # değerleri doldurun — bkz. documents/10-env-degiskenleri.md
docker compose up -d --build
```

Backend `:8000`'de ayağa kalkar (`/health` ile doğrulayın), veritabanı şeması ilk açılışta
otomatik kurulur. Frontend'i ayrıca geliştirmek isterseniz:

```bash
cd frontend
npm install
npm run dev   # :5173, /api → backend'e proxy
```

İlk açılışta `/auth/bootstrap` ilk-admin ekranını gösterir; oluşturduğunuz hesap `admin` rolüyle başlar.

## Dokümantasyon

Uçtan uca kullanıcı dokümanı [`documents/`](documents/) altında (Türkçe):

| # | Konu |
|---|------|
| 1 | [Başlangıç](documents/01-baslangic.md) |
| 2 | [Hataları Yönetme](documents/02-hatalar.md) |
| 3 | [Projeler & Roller](documents/03-projeler-roller.md) |
| 4 | [Entegrasyonlar](documents/04-entegrasyonlar.md) |
| 5 | [Yapay Zeka Ayarları](documents/05-ai-ayarlari.md) |
| 6 | [Ekip, Sohbet & Bildirimler](documents/06-ekip-bildirim.md) |
| 7 | [Profil](documents/07-profil.md) |
| 8 | [Kurulum & Deploy (Coolify)](documents/08-kurulum-deploy.md) |
| 9 | [API Referansı (mobil dahil)](documents/09-api.md) |
| 10 | [Ortam Değişkenleri (.env)](documents/10-env-degiskenleri.md) |
| 11 | [MCP Entegrasyonu](documents/11-mcp.md) |

## Mimari

FastAPI (backend, `:8000`) + React/Vite (frontend, `:5173`) + Postgres/pgvector.
Embedding modeli (`BAAI/bge-m3`) Docker imajına gömülüdür — runtime'da dışa çağrı yapmaz.
LLM opsiyoneldir; yoksa kümeler yine oluşur, yorum sonradan elle/LLM ile eklenir.

## Lisans

[MIT](LICENSE) — özgürce kullanın, değiştirin, dağıtın.
