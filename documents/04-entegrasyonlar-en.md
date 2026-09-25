# 4. Integrations

Goal: get the **errors your applications produce flowing into LogLens**. Every path uses a
**webhook token** — this token determines which **project** the error lands in.

## 4.1 Generating a webhook (basics)
On the **Webhooks** page (admin), for the selected project:
1. Give it a **name** + optional **source tag**, then **Generate webhook**.
2. You're given a URL:
   ```
   https://loglens.yourcompany.com/ingest/hook/<TOKEN>
   ```
3. Error JSON is POSTed to this URL **without authentication** (the token itself is the secret, embedded in the URL).

**Payload format** (LogIn):
```json
{ "message": "...", "stack_trace": "...", "error_type": "...",
  "app_version": "1.2.0", "platform": "service", "source": "service-name" }
```
- Single submission: `POST /ingest/hook/<TOKEN>`
- Batch submission (collectors): `POST /ingest/hook/<TOKEN>/batch` (JSON array)

**Webhook management:** activate/deactivate, usage counter + last used, "curl example".

## 4.2 Integrations page (ready-made code)
The **Integrations** page (admin) provides copyable code with the selected project's token
**pre-filled**. Tabs:
- **Coolify / Vector** — server log collector (no code changes needed)
- **Spring Boot / Ktor**, **FastAPI**, **Laravel**, **.NET** — in-app appender/handler

> The full Vector config and detailed versions of all snippets live in the `integrations/` folder in the repo.

## 4.3 Production backend logs

Backend frameworks (Spring Boot, Ktor, FastAPI, Laravel, .NET) produce line-by-line logs.
There are two approaches — both write to the same webhook:

### Option A — Log collector (no code changes) · Recommended for Coolify
You install a **Vector** container on the server; it watches all container logs, filters
for **ERROR** level entries, and forwards them to LogLens. It doesn't touch your applications,
and it's a single solution for all languages.

```bash
# On the Coolify host:
docker run -d --name vector \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v $PWD/vector.toml:/etc/vector/vector.toml:ro \
  timberio/vector:latest-alpine
```
In `vector.toml`, the sink address is your project's **batch** endpoint:
`uri = "https://loglens.../ingest/hook/<TOKEN>/batch"`.
For prod-only filtering, use a Coolify environment label. (Ready-made config: Integrations page
or `integrations/vector.toml`.)

> Tip: if your applications write **JSON logs** (Spring: logstash-encoder, Laravel: Monolog JSON,
> FastAPI: python-json-logger, .NET: Serilog JSON), the `level` and `stack` fields are extracted cleanly.

### Option B — In-app appender/handler (richest data)
You add a small piece of code to each application; at ERROR level it sends the error with its
stack trace directly to LogLens (fire-and-forget, doesn't block the request).

| Framework | Method |
|-----------|--------|
| **Spring Boot / Ktor** | Logback custom appender (with AsyncAppender) |
| **FastAPI** | `logging.Handler` (+ QueueListener) |
| **Laravel** | Monolog handler |
| **.NET** | Serilog `ILogEventSink` |

Ready-made code: **Integrations** page (token pre-filled) or `integrations/README.md`.

### Coolify Log Drain
You can also route Coolify's own **Log Drain** feature to Vector.

### Prod / dev separation
Either place the collector only on the prod host, or only set the appender's target URL in the
prod deployment — this keeps development logs from mixing in.

## 4.4 Source code (GitHub / Azure DevOps)
If you link a repository to a project, the file/line from the stack trace is pulled from the
repo and shown as **source code** in the error detail, providing context for LLM analysis.

- **Projects** → open a project → **Repositories** → choose a provider (GitHub/Azure), enter
  `owner/repo` (Azure: `org/project/repo`), branch, path prefix, and an optional token.
- Tokens are set per-repository; if none is given, the global token from Settings is used.

## 4.5 Firebase Crashlytics
Crashlytics has no live read API; the official route is **BigQuery export**.

```
Crashlytics → BigQuery export → bridge script → /ingest/batch
```
1. In the Firebase Console → Integrations, enable the **BigQuery** export.
2. Run `bridge/crashlytics_to_loglens.py` (via Cloud Scheduler / cron, every ~5 min):
   ```bash
   export BQ_PROJECT=... BQ_TABLE=firebase_crashlytics.com_example_app_ANDROID
   export LOGLENS_URL=https://loglens... LOGLENS_PROJECT_ID=<project_id>
   python bridge/crashlytics_to_loglens.py
   ```
Thanks to the watermark file, only **new** crashes are processed on each run.

## 4.6 Firebase Analytics (GA4)
GA4 also exports to BigQuery. Using the same bridge pattern, it pulls **custom error events**
(those whose name contains error/exception/fail — configurable):
```bash
export BQ_PROJECT=... GA_DATASET=analytics_123456789
export LOGLENS_URL=https://loglens... LOGLENS_PROJECT_ID=<project_id>
export EVENT_PATTERN='(?i)(error|exception|fail)'   # optional
python bridge/analytics_to_loglens.py
```
This way, non-fatal errors like `logEvent("api_error", {...})` — which **wouldn't appear in
Crashlytics** — also come through.

## 4.7 Mobile applications
Mobile SDKs can also POST errors directly to the `/ingest/hook/<TOKEN>` webhook. Additionally,
the Crashlytics/Analytics paths (4.5–4.6) cover mobile crashes.
