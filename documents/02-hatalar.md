# 2. Hataları Yönetme

**Hatalar** sayfası, seçili projeye düşen hata gruplarını yönettiğiniz ana ekrandır.

## Hata grupları (kümeler) nasıl oluşur
Bir hata geldiğinde LogLens iki katmanlı çalışır:
1. **Parmak izi (fingerprint)** — aynı hata daha önce görüldüyse yeni grup açılmaz, sayaç artar.
2. **Vektör benzerlik (embedding)** — parmak izi tutmasa bile *anlamsal olarak* benzer bir
   hata varsa aynı gruba düşer (farklı yazılmış ama aynı kök nedenli hatalar birleşir).
3. Hiçbiri yoksa **yeni grup** açılır; (varsa) kaynak kod çekilir, LLM **başlık/özet/önem**
   üretir. Bu adım yalnızca yeni gruplarda çalışır (maliyet düşük kalır).

> Dedup **proje bazındadır**: aynı hata farklı projelerde ayrı gruplar olur.

## Listeleme, filtreleme, arama
Üstteki çubuktan:
- **Arama** — başlık/özet içinde metin arama.
- **Önem** — critical / high / medium / low.
- **Kaynak** — mobile / web / service.
- **Durum** — açık / inceleniyor / çözüldü / yok sayıldı.
- **Sıralama** — son görülme / en sık / ilk görülme.
- **Sayfalama** — altta "N sonuç · sayfa X/Y" + Önceki/Sonraki.

## Hata detayı
Bir gruba tıklayınca sağda detay açılır:

### Durum yönetimi (önemli iş kuralı)
- Durumu değiştirdiğinizde **"Son kararınız mı?"** onayı çıkar.
- **Çözüldü** ve **Yok sayıldı** *nihai* durumlardır. Bir kayıt nihai duruma geçtikten sonra
  durumu **kilitlenir** — geri almayı yalnızca **admin** yapabilir (diğer roller kilitli 🔒).
- İleri yönlü akış (Açık → İnceleniyor → Çözüldü) herkese açıktır.

### Atama
- **Atanan** açılır listesi, o projenin **ekip üyelerini** gösterir. Bir hatayı bir ekip
  üyesine atarsınız; atanan kişiye **bildirim** düşer.

### LLM yorumu
- Yeni grup oluşurken üretilen Türkçe **kök neden özeti**.

### Kaynak kod
- Projeye bir repo (GitHub/Azure) bağlıysa, stack trace'teki dosya/satır repodan çekilir ve
  burada **kaynak kod snippet'i** gösterilir; "Kaynağı aç ↗" ile repoya gidersiniz.

### Notlar (yorum akışı)
- Her nota **kimin yazdığı + zaman** işlenir.
- Sürekli **not ekleyebilirsiniz**.
- **Kendi notunuzu** ✎ ile düzenler, 🗑 ile silersiniz. Admin her notu silebilir.

### Son olaylar & sürümler
- İlk/son görülen sürüm ve son ham olaylar (platform, sürüm, mesaj).

## Test logu gönderme
Sağ üstteki **+ Test logu** ile elle örnek bir hata gönderip akışı deneyebilirsiniz.
