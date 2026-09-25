# LogLens — Production log entegrasyonları

Backend framework'leri (Spring Boot, Ktor, FastAPI, Laravel, .NET) satır-satır log
üretir; Firebase gibi hazır bir export'u yoktur. Amaç: **ERROR seviyesindeki logları
(stack trace'iyle) LogLens'e POST etmek.** İki yol var — ikisi de aynı endpoint'e yazar:

| Endpoint | Kullanım |
|----------|----------|
| `POST {LOGLENS}/ingest/hook/{TOKEN}` | Tek hata (uygulama içi appender) |
| `POST {LOGLENS}/ingest/hook/{TOKEN}/batch` | Hata dizisi (log toplayıcı / Vector) |

`{TOKEN}` = ilgili **projenin** Webhooks sayfasından üretilen token. Böylece log
doğru projeye düşer, ayrı auth gerekmez.

Payload (LogIn):
```json
{ "message": "...", "stack_trace": "...", "error_type": "...",
  "app_version": "1.2.0", "platform": "service", "source": "servis-adı" }
```

---

## Yol A — Log toplayıcı (kod değişmeden, Coolify için önerilen)

`vector.toml` (bu klasörde): Coolify host'unda TÜM container loglarını dinler,
ERROR'ları filtreler, `/ingest/hook/{TOKEN}/batch`'e yollar. Uygulamalara dokunmaz,
tüm diller için tek çözüm. Prod-only için Coolify environment label'ıyla sınırlanır.

> İpucu: uygulamalar **JSON log** yazarsa (aşağıdaki her framework'te mümkün) level
> ve stack alanları net ayıklanır. Düz metinde heuristik + multiline birleştirme devrede.

---

## Yol B — Uygulama içi appender/handler (en zengin veri)

Hepsi ERROR+ seviyede tetiklenir ve **fire-and-forget** (isteği bloklamaz).

### Spring Boot & Ktor (Logback — ikisi de SLF4J/Logback kullanır)
```kotlin
// LogLensAppender.kt
import ch.qos.logback.classic.spi.ILoggingEvent
import ch.qos.logback.classic.spi.ThrowableProxyUtil
import ch.qos.logback.core.AppenderBase
import java.net.URI
import java.net.http.*
import com.fasterxml.jackson.databind.ObjectMapper

class LogLensAppender : AppenderBase<ILoggingEvent>() {
    var url: String = ""                    // logback.xml'den set edilir
    private val http = HttpClient.newHttpClient()
    private val json = ObjectMapper()

    override fun append(e: ILoggingEvent) {
        val body = json.writeValueAsString(mapOf(
            "message" to e.formattedMessage,
            "stack_trace" to e.throwableProxy?.let { ThrowableProxyUtil.asString(it) },
            "error_type" to e.throwableProxy?.className,
            "source" to e.loggerName,
            "platform" to "service",
        ))
        val req = HttpRequest.newBuilder(URI.create(url))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body)).build()
        http.sendAsync(req, HttpResponse.BodyHandlers.discarding())   // bloklamaz
    }
}
```
```xml
<!-- logback-spring.xml (Spring) / logback.xml (Ktor) -->
<appender name="LOGLENS" class="com.acme.LogLensAppender">
    <url>http://LOGLENS_HOST:8000/ingest/hook/TOKEN</url>
    <filter class="ch.qos.logback.classic.filter.ThresholdFilter"><level>ERROR</level></filter>
</appender>
<!-- Bloklamamak için async sar -->
<appender name="LOGLENS_ASYNC" class="ch.qos.logback.classic.AsyncAppender">
    <appender-ref ref="LOGLENS"/>
</appender>
<root level="INFO"><appender-ref ref="LOGLENS_ASYNC"/></root>
```
Ktor'da ek olarak yakalanmayan exception'lar için:
```kotlin
install(StatusPages) {
    exception<Throwable> { call, cause ->
        LoggerFactory.getLogger("ktor").error("Unhandled", cause)   // appender yakalar
        call.respond(HttpStatusCode.InternalServerError)
    }
}
```

### FastAPI (Python `logging.Handler`)
```python
import logging, traceback, httpx
from queue import SimpleQueue
from logging.handlers import QueueHandler, QueueListener

class LogLensHandler(logging.Handler):
    def __init__(self, url: str):
        super().__init__(logging.ERROR)
        self.url, self.client = url, httpx.Client(timeout=5)
    def emit(self, record):
        try:
            exc = record.exc_info
            self.client.post(self.url, json={
                "message": record.getMessage(),
                "stack_trace": "".join(traceback.format_exception(*exc)) if exc else None,
                "error_type": exc[0].__name__ if exc else None,
                "source": record.name, "platform": "service",
            })
        except Exception:
            pass  # loglama asla uygulamayı bozmasın

# İsteği bloklamamak için kuyruk arkasına al:
_q = SimpleQueue()
logging.getLogger().addHandler(QueueHandler(_q))
QueueListener(_q, LogLensHandler("http://LOGLENS_HOST:8000/ingest/hook/TOKEN")).start()
```

### Laravel (Monolog handler)
```php
// app/Logging/LogLensHandler.php
namespace App\Logging;
use Monolog\Handler\AbstractProcessingHandler;
use Monolog\Level; use Monolog\LogRecord;
use Illuminate\Support\Facades\Http;

class LogLensHandler extends AbstractProcessingHandler {
    public function __construct(private string $url) { parent::__construct(Level::Error); }
    protected function write(LogRecord $record): void {
        $e = $record->context['exception'] ?? null;
        Http::async()->post($this->url, [           // async = bloklamaz
            'message' => $record->message,
            'stack_trace' => $e instanceof \Throwable ? (string) $e : null,
            'error_type' => $e ? get_class($e) : null,
            'source' => $record->channel, 'platform' => 'service',
        ]);
    }
}
```
```php
// config/logging.php  -> 'channels' içine:
'loglens' => [
    'driver' => 'monolog',
    'handler' => App\Logging\LogLensHandler::class,
    'with' => ['url' => env('LOGLENS_HOOK_URL')],   // .../ingest/hook/TOKEN
    'level' => 'error',
],
// stack'e ekle: 'stack' => ['channels' => ['single', 'loglens']]
```

### .NET (Serilog sink)
```csharp
// LogLensSink.cs
using Serilog.Core; using Serilog.Events; using System.Net.Http.Json;

public class LogLensSink : ILogEventSink {
    private readonly string _url;
    private readonly HttpClient _http = new();
    public LogLensSink(string url) => _url = url;

    public void Emit(LogEvent e) {
        if (e.Level < LogEventLevel.Error) return;
        var src = e.Properties.TryGetValue("SourceContext", out var s) ? s.ToString().Trim('"') : "dotnet";
        _ = _http.PostAsJsonAsync(_url, new {                 // fire-and-forget
            message = e.RenderMessage(),
            stack_trace = e.Exception?.ToString(),
            error_type = e.Exception?.GetType().Name,
            source = src, platform = "service",
        });
    }
}
```
```csharp
// Program.cs
Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.Sink(new LogLensSink("http://LOGLENS_HOST:8000/ingest/hook/TOKEN"))
    .CreateLogger();
builder.Host.UseSerilog();
// Yakalanmayan exception'lar zaten Error olarak loglanır (UseExceptionHandler / middleware).
```

---

## Prod / dev ayrımı
- **Collector yolu:** Vector'ı sadece prod host'a koy ya da Coolify prod-environment label'ıyla filtrele.
- **Appender yolu:** `LOGLENS_HOOK_URL` env'ini yalnızca prod deploy'unda tanımla (dev'de boşsa gönderim olmaz).

Her iki yolda da `source` alanı servis adını taşır; farklı servisler tek projede
ayrışır, LogLens embedding ile anlamsal kümeler + Türkçe LLM yorumu üretir.
