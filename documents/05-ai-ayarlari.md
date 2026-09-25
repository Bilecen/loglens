# 5. Yapay Zeka Ayarları

**Ayarlar** sayfası (admin), LLM sağlayıcısını ve entegrasyon anahtarlarını yönetir.
Değerler **çalışırken (yeniden başlatmadan)** geçerli olur; boş bırakılan alanlar sunucudaki
`.env` değerine döner.

> LLM yalnızca **yeni hata grupları** için çalışır (başlık/özet/önem üretir). Mevcut gruplar
> ve tekrarlar LLM çağırmaz — maliyet düşük kalır.

## LLM sağlayıcısı
Beş seçenek (segment kontrolü):

| Sağlayıcı | Ne zaman |
|-----------|----------|
| **LM Studio** | Yerel, OpenAI uyumlu sunucu (varsayılan `http://localhost:1234/v1`) |
| **Ollama** | Yerel Ollama (OpenAI uyumlu, `http://localhost:11434/v1`) |
| **OpenAI (GPT)** | Bulut — API anahtarı gerekir |
| **Gemini** | Google Gemini API (bulut) — API anahtarı gerekir |
| **Anthropic (Claude)** | Bulut — API anahtarı gerekir |

Her sağlayıcının kendi alanları:
- **LM Studio / Ollama:** Base URL + Model (+ opsiyonel API anahtarı).
- **OpenAI / Gemini / Anthropic:** API anahtarı + Model (+ opsiyonel Base URL).

> **Önemli (LM Studio/Ollama):** `Model` alanı, sunucuda O AN YÜKLÜ modelin id'siyle birebir
> eşleşmeli; yoksa çağrı hata verir. Yüklü modelleri sunucunuzdan kontrol edin.

## Yanıt dili
**Yanıt dili** alanı, LLM'in ürettiği başlık/özet metinlerinin hangi dilde yazılacağını belirler
(serbest metin — "Türkçe", "English", "Deutsch" vb.). **Tüm ekip için tek ve global** bir
ayardır; log'un kendi dili ne olursa olsun LLM yorumu bu dilde üretilir. Web arayüzünün kendi
dili (Profil menüsündeki Türkçe/İngilizce seçici) bundan **bağımsızdır** — biri arayüz
metinlerini, diğeri LLM'in ürettiği içeriği kontrol eder.

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
