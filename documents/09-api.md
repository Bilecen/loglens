# 9. API Referansı

LogLens backend'i REST + WebSocket sunar. Tam ve güncel kontrat **otomatik** üretilir:

- **Swagger UI:** `https://loglens.../docs`
- **OpenAPI JSON:** `https://loglens.../openapi.json`

> `openapi.json`'dan native/mobil istemciler için **tip-güvenli client** üretebilirsiniz
> (Kotlin, Swift, TS…).

## Kimlik doğrulama
- `POST /auth/login` → `{ token, refresh_token, user }`. Dönen **JWT** (`token`) sonraki
  isteklerde `Authorization: Bearer <token>` başlığıyla gönderilir. Access token 7 gün geçerli.
- `POST /auth/refresh` → body `{ refresh_token }`, döner `{ token, user }` (yeni access token).
  Refresh token 90 gün geçerli — mobilde uzun oturum için bunu güvenli depoda (Keychain/Keystore)
  saklayın, access token süresi dolunca bunu çağırın.
- `POST /auth/logout` → body `{ refresh_token }`, refresh token'ı sunucuda iptal eder
  (cihaz kaybında / çıkışta çağırın).
- `GET /auth/me` → mevcut kullanıcı.
- WebSocket için token query param'da: `/ws?token=<jwt>`.

## Önemli uçlar (özet)

**Log alımı (public, token'lı):**
- `POST /ingest/hook/{token}` — tek hata
- `POST /ingest/hook/{token}/batch` — toplu (collector'lar)
- `POST /ingest?project_id=` — token'sız (varsayılan/verilen projeye)

**Okuma / yönetim (JWT):**
- `GET /projects`, `GET /clusters?project_id=`, `GET /clusters/{id}`
- `PATCH /clusters/{id}` (durum/atama/not alanları), `POST /clusters/{id}/notes`
- `GET /stats?project_id=`, `/stats/timeseries`, `/stats/breakdown`
- `GET /notifications`, `POST /notifications/{id}/read`, `/read-all`
- `GET /team`, `PATCH /team/presence`, `GET/POST /chat`
- `PATCH /users/me` — kendi profili (ad, parola, avatar)

**Admin:** `/users*`, `/projects*`, `/repos*`, `/webhooks*`, `/settings*`

## WebSocket
`/ws?token=<jwt>` — tek kanal. İstemci gönderir:
```json
{ "type": "chat", "body": "..." }
{ "type": "presence", "presence": "available|away|busy" }
```
Sunucu yayınlar: `chat` (yeni mesaj), `presence` (durum değişti), `online` (bağlandı/koptu),
`notification` (`user_ids` ile hedefli).

## Mobil uygulama
Mimari: **tek uygulama** app store'da; kullanıcı kendi **LogLens sunucu URL'ini ekler**
(self-hosted istemci deseni). App ince istemcidir — tüm veri müşterinin sunucusunda kalır.

**Sunucu ekleme (QR):** Web login sayfası bir QR gösterir; QR şu deep link'i kodlar:
`loglens://add-server?url=<sunucu-origin>`. App bu URL şemasını (Android intent-filter /
iOS URL scheme) yakalayıp `url` parametresini sunucu listesine ekler. Elle URL girişi de
desteklenmeli (QR olmadan).

**Sunucu doğrulama:** Eklenen/QR'dan gelen URL'e `GET /health` atın:
```json
{
  "ok": true,
  "name": "loglens",
  "api_version": "1.0",
  "provider": "local",
  "embed_model": "BAAI/bge-m3",
  "features": { "websocket": true, "chat": true, "notifications": true, "refresh_token": true }
}
```
`ok && name == "loglens"` gerçek bir LogLens sunucusu olduğunu doğrular. Kimlik istemez.

**Yeni hata bildirimi:** Kritik/yüksek şiddetli yeni bir hata kümesi oluştuğunda, proje
üyelerine otomatik `type: "new_error"` bildirimi düşer (`GET /notifications`) ve açık WS
bağlantısına `{ "type": "notification", "user_ids": [...] }` yayınlanır — app bunu görünce
`/notifications`'ı tazeler. **v1'de arka plan push (FCM/APNs) yok**, bilerek ertelendi:
uygulama açıkken WS + periyodik polling yeterli.

- Auth + okuma/yönetim + bildirim + sohbet uçları yukarıdakilerle aynıdır.
- Native (Android/Kotlin + iOS/Swift) istemciler `openapi.json`'dan client üretebilir.

## MCP (kendi AI aracınız için)
REST/WebSocket'e ek olarak `/mcp/` altında bir **Model Context Protocol** sunucusu vardır —
Claude Code/Desktop, Cursor gibi araçlar kendi kimlik doğrulamalarıyla (Bearer MCP anahtarı,
JWT'den ayrı) bağlanıp hata verisini okur, not düşer, durum günceller. Detay ve bağlantı
adımları: [11. bölüm — MCP entegrasyonu](11-mcp.md).
