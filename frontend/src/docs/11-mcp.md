# 11. MCP Entegrasyonu (kendi AI aracınızı bağlayın)

LogLens, **MCP (Model Context Protocol)** sunucusu olarak çalışır. Kendi AI aracınızı
(Claude Code, Claude Desktop, Cursor…) LogLens'e bağlayabilir; o araç hata kümelerini
okuyabilir, kaynak koda bağlayabilir ve **siz izin verdiğinizde** düzeltmeyi yapıp
LogLens'e not düşebilir / durumu güncelleyebilir.

> Bu, Ayarlar'daki 5 sabit LLM sağlayıcısından (LM Studio/Ollama/OpenAI/Gemini/Claude) **farklı
> ve tamamlayıcı** bir mekanizmadır. Onlar LogLens'in yeni hataları otomatik yorumlaması için;
> MCP ise **sizin** zaten kullandığınız AI aracınızın LogLens verisine erişmesi için. LogLens
> hiçbir AI API anahtarınızı saklamaz — kod düzenleme yeteneği tamamen sizin AI aracınızda kalır.

## Nasıl çalışır

Kod düzeltme işini LogLens **yapmaz** — zaten repo'nuza erişimi olan AI aracınız yapar. LogLens
sadece zengin bağlam sağlar: hatanın başlığı, özeti, tam stack trace'i, bağlı repodan çekilmiş
kaynak kod satırı, geçmiş oluşumlar ve önceki notlar — tek bir araç çağrısında.

## 1. Erişim anahtarı oluşturun

Profil menüsündeki **🔑 ikonuna** tıklayın ([7. bölüm](07-profil.md#mcp-erişim-anahtarları)).
"Yeni anahtar" alanına bir isim yazın (örn. "Claude Code - MacBook'um") ve **Oluştur**'a basın.

> Anahtar **yalnızca bir kez** gösterilir — kopyalayın. Kaybederseniz yeni bir anahtar
> oluşturup eskisini iptal edin. Anahtarlar süresiz geçerlidir, istediğiniz zaman iptal
> edilebilir.

## 2. AI aracınıza bağlayın

**Claude Code:**
```bash
claude mcp add --transport http loglens https://sunucunuz.com/mcp/ \
  --header "Authorization: Bearer <anahtarınız>"
```

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "loglens": {
      "url": "https://sunucunuz.com/mcp/",
      "headers": { "Authorization": "Bearer <anahtarınız>" }
    }
  }
}
```

> **Sondaki `/` önemli** — `/mcp` (eğik çizgi olmadan) 307 yönlendirme döner; çoğu istemci bunu
> otomatik takip eder ama sorun yaşarsanız önce `/mcp/` deneyin. Yerelde geliştirirken
> `http://localhost:8000/mcp/` kullanın.

## 3. Kullanın

AI aracınıza doğal dille sorun — örn: *"LogLens'teki ERR-a1b2c3d4 kümesini incele ve düzelt."*
Araç otomatik olarak uygun tool'ları çağırır.

## Erişilebilir tool'lar

| Tool | Ne yapar |
|------|----------|
| `list_projects` | Tüm projeleri listeler |
| `list_errors` | Bir projedeki hata kümelerini filtreli listeler (durum/önem/arama) |
| `get_error` | **Asıl değer burada** — başlık, özet, tam stack trace, kaynak kod snippet'i + dosya URL'i, son oluşumlar, notlar, önceki LLM yorumları |
| `get_stats` | Proje özet istatistiği (açık/çözülen sayısı, önem dağılımı) |
| `add_note` | Kümeye not bırakır (örn. yapılan düzeltmenin özeti) |
| `update_status` | Durumu değiştirir (`open`/`investigating`/`resolved`/`ignored`) |

`add_note` ve `update_status` **yazma** işlemleridir — AI aracınız bir hatayı düzelttikten
sonra bunu LogLens'e bildirmesi için var. Nihai bir durumu (`resolved`/`ignored`) geri açmak
yalnızca **admin** rolündeki bir kullanıcının anahtarıyla mümkündür (web arayüzündeki kuralla
aynı).

## Yetki ve görünürlük

Anahtar hangi kullanıcıya aitse, tool çağrıları o kullanıcının **rolüyle** çalışır (`get_current_user`
ile aynı yetki modeli). Anahtarı Profil menüsünden istediğiniz zaman **iptal edebilirsiniz** —
o anahtarı kullanan AI aracı anında bağlantısını kaybeder.

## Sunucunuzu doğrulama

AI aracınız (ya da siz) `GET /health` ile sunucunun gerçekten bir LogLens sunucusu olduğunu
doğrulayabilir:
```json
{ "ok": true, "name": "loglens", "api_version": "1.0", "features": { "websocket": true, "chat": true, "notifications": true, "refresh_token": true } }
```
