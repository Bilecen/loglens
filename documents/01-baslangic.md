# 1. Başlangıç

## Giriş yapma
Arayüzü açın (varsayılan: `http://localhost:5173`, kendi kurulumunuzda kendi adresiniz).
E-posta ve parolanızla oturum açın.

- İlk kurulumda hiç kullanıcı yoksa ekran sizi **ilk yönetici (admin)** oluşturmaya yönlendirir.
- Sonraki kullanıcıları admin, **Kullanıcılar** sayfasından oluşturur (açık kayıt yoktur).

## Arayüz genel yapısı

**Üst bar (topbar):**
- **☰** — sol menüyü (sidebar) gizle/göster.
- **Proje seçici** — üzerinde çalıştığınız projeyi seçersiniz. Tüm sayfalar (Hatalar,
  Genel bakış, Webhooks…) seçili projeye göre filtrelenir.
- **💬 Ekip & sohbet** — presence (müsait/dışarıda/meşgul) + canlı sohbet paneli.
- **🔔 Bildirimler** — yeni kritik hata / size atama bildirimleri.
- **Kullanıcı pill'i** — adınız + avatarınız. Tıklayınca: **profil düzenleme**, **tema**,
  **tasarım stili**, **çıkış**.

**Sol menü (sidebar):**
- **Genel bakış** — sayılar, olay trendi grafiği, kaynak/önem/durum dağılımları.
- **Hatalar** — hata gruplarını yönettiğiniz ana ekran.
- **Projeler** *(admin)* — proje + ekip + repo yönetimi.
- **Kullanıcılar** *(admin)* — hesaplar ve roller.
- **Webhooks** *(admin)* — servislerin hata gönderdiği token'lı URL'ler.
- **Entegrasyonlar** *(admin)* — Coolify/Vector + framework kod örnekleri.
- **Ayarlar** *(admin)* — yapay zeka sağlayıcısı ve anahtarlar.

## İlk adımlar
1. **Proje seç/oluştur** — ilk kurulumda "Varsayılan Proje" hazırdır; Projeler sayfasından
   yenisini ekleyebilirsiniz.
2. **Ekibi görevlendir** — Projeler → projeyi aç → üye ekle.
3. **Servisleri bağla** — Webhooks + Entegrasyonlar (bkz. [4. bölüm](04-entegrasyonlar.md)).
4. **Hataları izle** — Hatalar sayfası.

> Görünürlük globaldir: herkes tüm projeleri görebilir. Roller ve proje üyeliği
> **görevlendirme/yetki** içindir (bkz. [3. bölüm](03-projeler-roller.md)).
