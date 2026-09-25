# 5. Yapay Zeka Ayarları

**Ayarlar** sayfası (admin), LLM sağlayıcısını ve entegrasyon anahtarlarını yönetir.
Değerler **çalışırken (yeniden başlatmadan)** geçerli olur; boş bırakılan alanlar sunucudaki
`.env` değerine döner.

> LLM yalnızca **yeni hata grupları** için çalışır (başlık/özet/önem üretir). Mevcut gruplar
> ve tekrarlar LLM çağırmaz — maliyet düşük kalır.

## LLM sağlayıcısı
Üç seçenek (segment kontrolü):

| Sağlayıcı | Ne zaman |
|-----------|----------|
| **LM Studio** | Yerel, OpenAI uyumlu sunucu (varsayılan `http://localhost:1234/v1`) |
| **Ollama** | Yerel Ollama (OpenAI uyumlu, `http://localhost:11434/v1`) |
| **Anthropic (Claude)** | Bulut — API anahtarı gerekir |

Her sağlayıcının kendi alanları:
- **LM Studio / Ollama:** Base URL + Model (+ opsiyonel API anahtarı).
- **Anthropic:** API anahtarı + Model (örn. `claude-sonnet-5`).

> **Önemli (LM Studio/Ollama):** `Model` alanı, sunucuda O AN YÜKLÜ modelin id'siyle birebir
> eşleşmeli; yoksa çağrı hata verir. Yüklü modelleri sunucunuzdan kontrol edin.

## Bağlantıyı test etme
**Bağlantıyı test et** butonu, kayıtlı ayarla küçük bir örnek çağrı yapar ve sonucu gösterir
(başarılıysa örnek başlık, değilse hata mesajı). Önce **kaydedin**, sonra test edin.

## Kaynak kod erişimi (global token'lar)
- **GitHub token** ve **Azure DevOps token (PAT)** — repo bazında token verilmezse bu global
  token'lar kullanılır (stack trace → kaynak kod eşlemesi).

## Güvenlik
- Gizli anahtarlar (API key, token) **arayüze asla geri gönderilmez** — yalnızca "ayarlı ✓"
  bilgisi gösterilir. Değiştirmek için yeni değeri yazmanız yeterlidir; boş bırakırsanız
  mevcut değer korunur.
