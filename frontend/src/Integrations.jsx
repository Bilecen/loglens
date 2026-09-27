import { useEffect, useState } from "react";
import { api } from "./api";
import { useProject } from "./project";
import DataSources from "./DataSources";
import Icon from "./Icon";
import { useLocale } from "./i18n";

function CopyButton({ text, className = "btn ghost sm", children }) {
  const { t } = useLocale();
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }
    catch { /* izin yoksa sessiz geç */ }
  };
  return (
    <button type="button" className={`${className} inline-flex items-center gap-1.5`} onClick={copy}>
      <Icon icon="lucide:copy" size={13} /> {done ? t("integrations.copied") : (children ?? t("integrations.copy"))}
    </button>
  );
}

const TABS = [
  { key: "vector", label: "Coolify / Vector", hintKey: "integrations.hintVector" },
  { key: "spring", label: "Spring Boot / Ktor", hint: "Logback appender" },
  { key: "fastapi", label: "FastAPI", hint: "logging.Handler" },
  { key: "laravel", label: "Laravel", hint: "Monolog handler" },
  { key: "dotnet", label: ".NET", hint: "Serilog sink" },
];

// url = tek hata endpoint'i (.../ingest/hook/TOKEN). Vector batch için +/batch kullanır.
const SNIPPETS = {
  vector: (url) => `# Coolify host'unda tek container olarak Vector kur:
docker run -d --name vector \\
  -v /var/run/docker.sock:/var/run/docker.sock:ro \\
  -v $PWD/vector.toml:/etc/vector/vector.toml:ro \\
  timberio/vector:latest-alpine

# vector.toml  (tüm container loglarını izler, ERROR'ları LogLens'e yollar)
[sources.docker]
type = "docker_logs"
# Sadece prod: include_labels = ["coolify.environment=production"]

[transforms.errors]
type = "filter"
inputs = ["docker"]
condition = '''match(to_string(.message) ?? "", r'(?i)error|exception|fatal')'''

[transforms.shape]
type = "remap"
inputs = ["errors"]
source = '''
. = { "message": to_string(.message) ?? "", "platform": "service",
      "source": to_string(.container_name) ?? "coolify" }
'''

[sinks.loglens]
type = "http"
inputs = ["shape"]
uri = "${url}/batch"
method = "post"
encoding.codec = "json"
batch.max_events = 100`,

  spring: (url) => `// LogLensAppender.kt — ERROR loglarını LogLens'e yollar (fire-and-forget)
class LogLensAppender : ch.qos.logback.core.AppenderBase<ch.qos.logback.classic.spi.ILoggingEvent>() {
  var url: String = "${url}"
  private val http = java.net.http.HttpClient.newHttpClient()
  private val json = com.fasterxml.jackson.databind.ObjectMapper()
  override fun append(e: ch.qos.logback.classic.spi.ILoggingEvent) {
    val body = json.writeValueAsString(mapOf(
      "message" to e.formattedMessage,
      "stack_trace" to e.throwableProxy?.let { ch.qos.logback.classic.spi.ThrowableProxyUtil.asString(it) },
      "error_type" to e.throwableProxy?.className, "source" to e.loggerName, "platform" to "service"))
    val req = java.net.http.HttpRequest.newBuilder(java.net.URI.create(url))
      .header("Content-Type","application/json")
      .POST(java.net.http.HttpRequest.BodyPublishers.ofString(body)).build()
    http.sendAsync(req, java.net.http.HttpResponse.BodyHandlers.discarding())
  }
}

<!-- logback-spring.xml -->
<appender name="LOGLENS" class="com.acme.LogLensAppender"/>
<appender name="LOGLENS_ASYNC" class="ch.qos.logback.classic.AsyncAppender">
  <filter class="ch.qos.logback.classic.filter.ThresholdFilter"><level>ERROR</level></filter>
  <appender-ref ref="LOGLENS"/>
</appender>
<root level="INFO"><appender-ref ref="LOGLENS_ASYNC"/></root>`,

  fastapi: (url) => `import logging, traceback, httpx
from queue import SimpleQueue
from logging.handlers import QueueHandler, QueueListener

class LogLensHandler(logging.Handler):
    def __init__(self):
        super().__init__(logging.ERROR)
        self.client = httpx.Client(timeout=5)
    def emit(self, record):
        try:
            exc = record.exc_info
            self.client.post("${url}", json={
                "message": record.getMessage(),
                "stack_trace": "".join(traceback.format_exception(*exc)) if exc else None,
                "error_type": exc[0].__name__ if exc else None,
                "source": record.name, "platform": "service"})
        except Exception:
            pass

# İsteği bloklamasın diye kuyruk arkasına al:
_q = SimpleQueue()
logging.getLogger().addHandler(QueueHandler(_q))
QueueListener(_q, LogLensHandler()).start()`,

  laravel: (url) => `// app/Logging/LogLensHandler.php
namespace App\\Logging;
use Monolog\\Handler\\AbstractProcessingHandler;
use Monolog\\Level; use Monolog\\LogRecord;
use Illuminate\\Support\\Facades\\Http;

class LogLensHandler extends AbstractProcessingHandler {
    public function __construct() { parent::__construct(Level::Error); }
    protected function write(LogRecord $record): void {
        $e = $record->context['exception'] ?? null;
        Http::async()->post("${url}", [
            'message' => $record->message,
            'stack_trace' => $e instanceof \\Throwable ? (string) $e : null,
            'error_type' => $e ? get_class($e) : null,
            'source' => $record->channel, 'platform' => 'service']);
    }
}

// config/logging.php -> 'channels' içine ekle, 'stack' kanalına dahil et:
'loglens' => ['driver' => 'monolog', 'handler' => App\\Logging\\LogLensHandler::class, 'level' => 'error'],`,

  dotnet: (url) => `// LogLensSink.cs — Serilog sink (ERROR+, fire-and-forget)
using Serilog.Core; using Serilog.Events; using System.Net.Http.Json;
public class LogLensSink : ILogEventSink {
    private readonly HttpClient _http = new();
    public void Emit(LogEvent e) {
        if (e.Level < LogEventLevel.Error) return;
        var src = e.Properties.TryGetValue("SourceContext", out var s) ? s.ToString().Trim('"') : "dotnet";
        _ = _http.PostAsJsonAsync("${url}", new {
            message = e.RenderMessage(), stack_trace = e.Exception?.ToString(),
            error_type = e.Exception?.GetType().Name, source = src, platform = "service" });
    }
}

// Program.cs
Log.Logger = new LoggerConfiguration()
    .WriteTo.Sink(new LogLensSink())
    .CreateLogger();
builder.Host.UseSerilog();`,
};

export default function Integrations() {
  const { t } = useLocale();
  const { projects, projectId, setProjectId } = useProject();
  const [hooks, setHooks] = useState([]);
  const [hookId, setHookId] = useState(null);
  const [tab, setTab] = useState("vector");

  useEffect(() => {
    if (!projectId) return;
    api.webhooks(projectId).then((list) => {
      setHooks(list);
      setHookId((cur) => (list.some((h) => h.id === cur) ? cur : list[0]?.id ?? null));
    }).catch(() => {});
  }, [projectId]);

  const hook = hooks.find((h) => h.id === hookId) || null;
  const code = hook ? SNIPPETS[tab](hook.ingest_url) : "";

  return (
    <div className="anim-in">
      <div className="mb-6">
        <h2 className="text-[22px] font-extrabold tracking-tight flex items-center gap-2">
          <Icon icon="lucide:plug" size={20} /> {t("integrations.title")}
        </h2>
        <p className="text-muted text-[13px] mt-1 max-w-2xl">
          {t("integrations.description")}
        </p>
      </div>

      {projects.length > 0 && (
        <div className="card-surface p-[14px] mb-4 flex items-center gap-2.5">
          <Icon icon="lucide:folder" size={15} className="text-muted shrink-0" />
          <label className="text-[12.5px] font-semibold text-muted shrink-0">{t("integrations.projectLabel")}</label>
          <select className="flex-1 max-w-xs" value={projectId ?? ""} onChange={(e) => setProjectId(Number(e.target.value))}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {/* Firebase/BigQuery otomatik veri kaynakları (webhook'tan bağımsız) */}
      <div className="mb-4"><DataSources projectId={projectId} /></div>

      {hooks.length === 0 ? (
        <div className="card-surface p-8 text-center">
          <div className="w-11 h-11 rounded-xl grid place-items-center text-muted mx-auto mb-2"
            style={{ background: "var(--panel-2)" }}><Icon icon="lucide:webhook" size={18} /></div>
          <div className="text-[13px] font-semibold">{t("integrations.noWebhooks")}</div>
          <div className="text-faint text-[12px] mt-1">{t("integrations.noWebhooksHintPrefix")} <b>Webhooks</b> {t("integrations.noWebhooksHintSuffix")}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Webhook seçimi */}
          <div className="card-surface p-[18px]">
            <label className="field-label !mt-0">{t("integrations.targetWebhookLabel")}</label>
            <select className="w-full" value={hookId ?? ""} onChange={(e) => setHookId(Number(e.target.value))}>
              {hooks.map((h) => <option key={h.id} value={h.id}>{h.name}{h.active ? "" : t("integrations.inactiveSuffix")}</option>)}
            </select>
            <div className="flex items-center gap-2 mt-2.5">
              <code className="flex-1 min-w-0 text-[12px] font-mono bg-surface-2 border border-line rounded-lg px-2.5 py-2 overflow-x-auto whitespace-nowrap">
                {hook?.ingest_url}
              </code>
              <CopyButton text={hook?.ingest_url || ""}>URL</CopyButton>
            </div>
          </div>

          {/* Tab seçimi */}
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((tabItem) => {
              const active = tab === tabItem.key;
              return (
                <button key={tabItem.key} onClick={() => setTab(tabItem.key)}
                  className="px-3 py-2 rounded-lg text-[12.5px] font-semibold transition-all"
                  style={{
                    background: active ? "var(--accent-soft)" : "var(--panel-2)",
                    color: active ? "var(--accent)" : "var(--muted)",
                    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  }}>
                  {tabItem.label}
                </button>
              );
            })}
          </div>

          {/* Snippet */}
          <div className="card-surface p-[18px]">
            <div className="flex items-center justify-between mb-2.5">
              <div>
                <h3 className="text-[14px] font-bold">{TABS.find((tabItem) => tabItem.key === tab)?.label}</h3>
                <p className="text-faint text-[11.5px]">
                  {(() => {
                    const cur = TABS.find((tabItem) => tabItem.key === tab);
                    return cur?.hintKey ? t(cur.hintKey) : cur?.hint;
                  })()}
                </p>
              </div>
              <CopyButton text={code}>{t("integrations.copyCode")}</CopyButton>
            </div>
            <pre className="bg-code border border-line-strong rounded-[10px] px-3.5 py-3 overflow-x-auto text-[11.5px] font-mono leading-relaxed m-0 max-h-[440px]">{code}</pre>
            {tab === "vector" && (
              <p className="text-faint text-[11.5px] mt-2">
                {t("integrations.fullConfigPrefix")} <span className="font-mono">integrations/vector.toml</span>{t("integrations.fullConfigSuffix")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
