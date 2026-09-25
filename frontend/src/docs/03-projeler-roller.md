# 3. Projeler & Roller

## Çok-proje mantığı
LogLens **tek kurulum** içinde birden çok proje barındırır. Her proje kendi **hatalarını,
webhook'larını ve repolarını** taşır. Üstteki **proje seçici** ile aktif projeyi değiştirir,
tüm ekranları o projeye göre görürsünüz.

- **Dedup proje bazındadır** — aynı hata farklı projelerde ayrı gruplanır.
- **Görünürlük globaldir** — herkes tüm projeleri görebilir. Proje üyeliği bir erişim duvarı
  değil, **kadro/görevlendirme** bilgisidir (kimin hangi projede çalıştığı).
- Tek embedding modeli tüm projelere hizmet eder → ayrı ayrı kurulum gerekmez.

## Proje oluşturma (admin)
**Projeler** sayfası → **Yeni proje**:
- **İsim** — okunur ad (örn. "Mobil Uygulama").
- **Anahtar (slug)** — URL-güvenli kısa tanımlayıcı (küçük harf/rakam/tire). İsimden otomatik
  türetilir, elle de değiştirilebilir.

## Ekip görevlendirme
Bir projeyi **Düzenle** ile açın:
- **Ekip** — kullanıcıları projeye ekleyip çıkarırsınız. Hata atarken atanan liste bu ekiptir.
- **Repolar** — projeye GitHub/Azure DevOps reposu bağlarsınız (kaynak kod eşlemesi için,
  bkz. [4. bölüm](04-entegrasyonlar.md)).

## Roller
Dört rol vardır: **Admin**, **Developer**, **PO/PM**, **Tester**.

| Rol | Yetki |
|-----|-------|
| **Admin** | Her şey: kullanıcı/proje/repo/ayar yönetimi, nihai durum geri alma |
| **Developer / PO / Tester** | Hataları görür, durum ileriye taşır, not ekler, kendine/atanana bakar |

- Yönetim ekranları (Projeler, Kullanıcılar, Webhooks, Entegrasyonlar, Ayarlar) **admin**'e açıktır.
- Nihai durumu (çözüldü/yok sayıldı) geri almak **admin** yetkisindedir.

## Kullanıcı yönetimi (admin)
**Kullanıcılar** sayfası:
- Yeni kullanıcı oluşturma (e-posta, ad, geçici parola, rol).
- Rol değiştirme, kullanıcı silme.
- İsim/e-posta arama + rol filtresi + sayfalama.
