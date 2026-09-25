# 6. Ekip, Sohbet & Bildirimler

## Ekip paneli (💬)
Üst bardaki **💬** ile sağdan açılan panel: presence durumu + canlı sohbet.

### Presence (durum)
Kendi durumunuzu tek tıkla ayarlarsınız:
- 🟢 **Müsait**
- 🟡 **Dışarıda**
- 🔴 **Meşgul**

**Ekip** sekmesinde herkes, avatarında renkli durum noktasıyla listelenir.

**Online / çevrimdışı:** Durum rengi yalnızca kişi **uygulamada açıkken (bağlıyken)** görünür.
Bağlı olmayan biri **gri "Çevrimdışı"** olarak, soluk gösterilir. Yani gerçekten o an çevrimiçi
olanları ayırt edersiniz.

### Canlı sohbet (gerçek-zamanlı)
- **Sohbet** sekmesinde ekip mesajlaşır. Mesajlar **WebSocket** ile anında herkeste belirir
  (polling değil).
- Her mesaj grubunun başında **kim yazdığı** görünür (art arda mesajlarda tekrar etmez).
- Bağlantı koparsa otomatik yeniden bağlanır; kopukken kısa süre yedek yol devreye girer.
- Enter ile gönderir, Shift+Enter ile alt satıra geçersiniz.

## Bildirimler (🔔)
Üst bardaki **🔔** — okunmamış sayısı rozette görünür. Tıklayınca bildirim listesi açılır.

Ne zaman bildirim düşer:
- Bir projede **yeni critical/high hata** oluştuğunda → o projenin **tüm üyelerine**.
- Bir hata **size atandığında**.

- Bildirimler **gerçek-zamanlı** gelir (anında rozette görünür).
- Bir bildirime tıklayınca **okundu** olur; **"Hepsini okundu"** ile tümünü işaretlersiniz.
- Bildirim kaydı sizde durur — anlık göremeseniz bile listeden görürsünüz.

> Not: Mobil uygulama da aynı bildirim ve sohbet altyapısını kullanır (bkz. [9. bölüm](09-api.md)).
