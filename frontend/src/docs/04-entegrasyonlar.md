# 4. Entegrasyonlar

Amaç: uygulamalarınızın ürettiği **hataları LogLens'e akıtmak**. Tüm yollar bir **webhook
token'ı** kullanır — bu token, hatanın hangi **projeye** düşeceğini belirler.

## 4.1 Webhook üretme (temel)
**Webhooks** sayfası (admin), seçili proje için:
1. **İsim** + opsiyonel **kaynak etiketi** ver, **Webhook üret**.
2. Sana bir URL verilir:
   ```
   https://loglens.sirketiniz.com/ingest/hook/<TOKEN>
   ```
3. Bu URL'e **kimlik doğrulaması olmadan** hata JSON'u POST edilir (token URL'de gizlidir).

**Payload biçimi** (LogIn):
```json
{ "message": "...", "stack_trace": "...", "error_type": "...",
  "app_version": "1.2.0", "platform": "service", "source": "servis-adı" }
```
- Tekil gönderim: `POST /ingest/hook/<TOKEN>`
- Toplu gönderim (collector'lar): `POST /ingest/hook/<TOKEN>/batch` (JSON dizisi)

**Webhook yönetimi:** aktif/pasif alma, kullanım sayacı + son kullanım, "curl örneği".

## 4.2 Entegrasyonlar sayfası (hazır kod)
**Entegrasyonlar** sayfası (admin), seçili projenin token'ı **önceden doldurulmuş**,
kopyalanabilir kod verir. Sekmeler:
- **Coolify / Vector** — sunucu logu toplayıcı (kod değişmeden)
- **Spring Boot / Ktor**, **FastAPI**, **Laravel**, **.NET** — uygulama içi appender/handler

> Tam Vector config ve tüm snippet'lerin ayrıntılı hâli repo'da `integrations/` klasöründedir.

## 4.3 Production backend logları

Backend framework'leri (Spring Boot, Ktor, FastAPI, Laravel, .NET) satır-satır log üretir.
İki yaklaşım var — ikisi de aynı webhook'a yazar:

### Yol A — Log toplayıcı (kod değişmeden) · Coolify için önerilen
Sunucuya bir **Vector** container kurarsınız; tüm container loglarını izler, **ERROR**
seviyesindekileri filtreleyip LogLens'e yollar. Uygulamalara dokunmaz, tüm diller için tek çözüm.

```bash
# Coolify host'unda:
docker run -d --name vector \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v $PWD/vector.toml:/etc/vector/vector.toml:ro \
  timberio/vector:latest-alpine
```
`vector.toml` içinde sink adresi projenizin **batch** endpoint'i olur:
`uri = "https://loglens.../ingest/hook/<TOKEN>/batch"`.
Prod-only için Coolify environment label'ıyla filtrelenir. (Hazır config: Entegrasyonlar sayfası
veya `integrations/vector.toml`.)

> İpucu: uygulamalar **JSON log** yazarsa (Spring: logstash-encoder, Laravel: Monolog JSON,
> FastAPI: python-json-logger, .NET: Serilog JSON) `level` ve `stack` alanları net ayıklanır.

### Yol B — Uygulama içi appender/handler (en zengin veri)
Her uygulamaya küçük bir kod eklersiniz; ERROR seviyesinde hatayı stack trace'iyle doğrudan
LogLens'e gönderir (fire-and-forget, isteği bloklamaz).

| Framework | Yöntem |
|-----------|--------|
| **Spring Boot / Ktor** | Logback custom appender (AsyncAppender ile) |
| **FastAPI** | `logging.Handler` (+ QueueListener) |
| **Laravel** | Monolog handler |
| **.NET** | Serilog `ILogEventSink` |

Hazır kod: **Entegrasyonlar** sayfası (token doldurulmuş) veya `integrations/README.md`.

### Coolify Log Drain
Coolify'ın kendi **Log Drain** özelliğini Vector'a yönlendirerek de kullanabilirsiniz.

### Prod / dev ayrımı
Collector'ı yalnızca prod host'a koyun ya da appender'ın hedef URL'ini yalnızca prod
deploy'unda tanımlayın — geliştirme logları karışmaz.

## 4.4 Kaynak kod (GitHub / Azure DevOps)
Bir projeye repo bağlarsanız, stack trace'teki dosya/satır repodan çekilir ve hata detayında
**kaynak kod** gösterilir, LLM analizine bağlam olur.

- **Projeler** → projeyi aç → **Repolar** → provider seç (GitHub/Azure), `owner/repo`
  (Azure: `org/proje/repo`), dal, yol öneki, opsiyonel token.
- Token repo bazında verilir; verilmezse Ayarlar'daki global token kullanılır.

## 4.5 Firebase Crashlytics
Crashlytics'in canlı okuma API'si yoktur; resmi yol **BigQuery export**tur.

```
Crashlytics → BigQuery export → bridge script → /ingest/batch
```
1. Firebase Console → Integrations → **BigQuery** export'u açın.
2. `bridge/crashlytics_to_loglens.py`'yi çalıştırın (Cloud Scheduler / cron ile ~5 dk):
   ```bash
   export BQ_PROJECT=... BQ_TABLE=firebase_crashlytics.com_example_app_ANDROID
   export LOGLENS_URL=https://loglens... LOGLENS_PROJECT_ID=<proje_id>
   python bridge/crashlytics_to_loglens.py
   ```
Watermark dosyası sayesinde her koşuda yalnızca **yeni** crash'ler işlenir.

## 4.6 Firebase Analytics (GA4)
GA4 de BigQuery'ye export eder. Aynı köprü deseniyle, **özel hata event'lerini** çeker
(adında error/exception/fail geçen — ayarlanabilir):
```bash
export BQ_PROJECT=... GA_DATASET=analytics_123456789
export LOGLENS_URL=https://loglens... LOGLENS_PROJECT_ID=<proje_id>
export EVENT_PATTERN='(?i)(error|exception|fail)'   # opsiyonel
python bridge/analytics_to_loglens.py
```
Böylece `logEvent("api_error", {...})` gibi **Crashlytics'te olmayan** non-fatal hatalar da gelir.

## 4.7 Mobil uygulamalar
Mobil SDK'lar da doğrudan `/ingest/hook/<TOKEN>` webhook'una hata POST edebilir. Ayrıca
Crashlytics/Analytics yolları (4.5–4.6) mobil crash'leri kapsar.
