# LogLens UI

Backend'i (FastAPI, `:8000`) tüketen React (Vite) arayüzü.

## Çalıştırma

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

Dev sunucusu `/api/*` isteklerini `http://localhost:8000`'e proxy'ler
(bkz. `vite.config.js`). Backend farklı bir adresteyse:

```bash
VITE_API_TARGET=http://192.168.1.10:8000 npm run dev
```

Prod build'de mutlak URL vermek için `.env`:

```
VITE_API_BASE=https://loglens.example.com
```

## Ekranlar
- Üstte özet kutuları (grup sayısı, toplam olay, critical/high).
- Hata grubu listesi: arama + önem derecesi filtresi + sıralama.
- Detay paneli: LLM yorumu (title/summary/severity) + son olaylar.
- “+ Test logu”: `/ingest`'e örnek log gönderip akışı (fingerprint / vektör /
  yeni grup) canlı test etmek için.
