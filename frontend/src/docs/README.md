# LogLens — Kullanıcı Dokümantasyonu

LogLens, uygulamalarınızın (mobil + backend) hatalarını tek yerde toplayan, **anlamsal
olarak kümeleyen** ve **yapay zeka ile yorumlayan** bir hata-analiz platformudur (LLM yorum dili
ve arayüz dili ayrı ayrı yapılandırılabilir — Türkçe/İngilizce dahil).

- Aynı kök nedene sahip farklı hatalar **tek gruba** düşer (embedding tabanlı benzerlik).
- Her yeni grup için LLM **başlık + özet + önem derecesi** üretir.
- Çok-proje, ekip görevlendirme, canlı sohbet, gerçek-zamanlı bildirim içerir.
- **Kendi sunucunuza** kurulur (on-prem) — veriniz sizde kalır.

## İçindekiler

| # | Konu | Ne öğrenirsiniz |
|---|------|-----------------|
| 1 | [Başlangıç](01-baslangic.md) | Giriş, arayüz, ilk proje |
| 2 | [Hataları Yönetme](02-hatalar.md) | Filtreleme, durum, notlar, atama, kaynak kod |
| 3 | [Projeler & Roller](03-projeler-roller.md) | Proje oluşturma, ekip görevlendirme, roller |
| 4 | [Entegrasyonlar](04-entegrasyonlar.md) | Webhook, Coolify/Vector, Spring/Ktor/FastAPI/Laravel/.NET, Firebase |
| 5 | [Yapay Zeka Ayarları](05-ai-ayarlari.md) | LM Studio / Ollama / Claude, anahtarlar |
| 6 | [Ekip, Sohbet & Bildirimler](06-ekip-bildirim.md) | Presence, canlı sohbet, bildirim zili |
| 7 | [Profil & Görünüm](07-profil.md) | Profil düzenleme, fotoğraf, tema, tasarım stilleri |
| 8 | [Kurulum & Deploy](08-kurulum-deploy.md) | Docker, docker-compose, Coolify |
| 9 | [API Referansı](09-api.md) | OpenAPI, kimlik doğrulama, mobil |
| 10 | [Ortam Değişkenleri](10-env-degiskenleri.md) | `.env` şablonu, Coolify kurulumu |
| 11 | [MCP Entegrasyonu](11-mcp.md) | Kendi AI aracınızı (Claude Code vb.) bağlama |

## Hızlı başlangıç
1. Tarayıcıdan arayüze girin, **admin** hesabıyla oturum açın.
2. Bir **proje** oluşturun ve ekibi görevlendirin ([3. bölüm](03-projeler-roller.md)).
3. Projeye bir **webhook** üretip servislerinizi bağlayın ([4. bölüm](04-entegrasyonlar.md)).
4. Hatalar akmaya başlayınca **Hatalar** sayfasından yönetin ([2. bölüm](02-hatalar.md)).
