# Örnek veri (demo / sunum için)

Gerçek Crashlytics erişimi olmadan LogLens'i uçtan uca göstermek için sentetik veri.

## `sample_logs.json` — LogLens'e doğrudan bas
12 crash. İçinde bilerek:
- **3 birebir aynı** NPE (2'si aynı sürüm, 1'i farklı sürüm) → fingerprint eşleşmesi, tek grup, `occurrence_count` artar.
- **3 anlamsal olarak benzer** timeout hatası (Android × 2 + iOS, farklı mesaj/tip) → embedding vektör benzerliğiyle **aynı gruba** düşer (fingerprint tutmaz ama anlam aynı). LogLens'in Crashlytics'ten farkını gösteren kısım burası.
- Kalanlar farklı hatalar → her biri yeni grup + LLM yorumu.

Backend ayaktayken:
```bash
curl -X POST http://localhost:8000/ingest/batch \
  -H "Content-Type: application/json" \
  -d @samples/sample_logs.json
```
Sonra UI'ı aç (`frontend/`, `npm run dev`) → grupları, önem derecelerini ve LLM yorumlarını canlı gör.

## `crashlytics_bq_row_example.json` — "kaynak veri böyle" demek için
Crashlytics → BigQuery export'unda bir crash satırının gerçek şekli.
`bridge/crashlytics_to_loglens.py` tam olarak bu satırı okuyup `LogIn`'e eşler.
Sunumda "erişim verirseniz aynen bu akacak" diye gösterebilirsin.
