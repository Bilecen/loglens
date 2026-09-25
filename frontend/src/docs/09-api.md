# 9. API Referansı

LogLens backend'i REST + WebSocket sunar. Tam ve güncel kontrat **otomatik** üretilir:

- **Swagger UI:** `https://loglens.../docs`
- **OpenAPI JSON:** `https://loglens.../openapi.json`

> `openapi.json`'dan native/mobil istemciler için **tip-güvenli client** üretebilirsiniz
> (Kotlin, Swift, TS…).

## Kimlik doğrulama
- `POST /auth/login` → `{ token, user }`. Dönen **JWT**'yi sonraki isteklerde
  `Authorization: Bearer <token>` başlığıyla gönderin.
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
- Sunucu doğrulaması: `GET /health`.
- Auth + okuma/yönetim + bildirim + sohbet uçları yukarıdakilerle aynıdır.
- Native (Android/Kotlin + iOS/Swift) istemciler `openapi.json`'dan client üretebilir.
