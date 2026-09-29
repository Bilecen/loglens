# 10. Environment Variables (.env) & Coolify

The backend reads its settings from `.env` (or container environment variables). AI/integration
keys can also be changed from the **Settings** panel while the app is running (this overrides
the env).

## Ready-to-paste template
```dotenv
# ---------------- Database ----------------
db_dsn=postgresql://postgres:postgres@db:5432/logs

# ---------------- Identity / JWT ----------------
# ALWAYS set a strong, random value in PRODUCTION (e.g. `openssl rand -hex 32`)
jwt_secret=CHANGE-ME-a-long-random-value
jwt_algorithm=HS256
jwt_expire_minutes=10080          # 7 days (access token)
refresh_expire_days=90            # refresh token (long mobile sessions)

# ---------------- Embedding (runs in-process) ----------------
embed_model=BAAI/bge-m3
embed_dim=1024
similarity_threshold=0.88         # tune between 0.85–0.92
top_frames=5

# ---------------- LLM provider ----------------
llm_provider=local                # local | ollama | openai | gemini | claude
response_language=English         # language the LLM writes titles/summaries in (free text)

# LM Studio (local, OpenAI-compatible)
local_base_url=http://host.docker.internal:1234/v1
local_model=qwen/qwen3.8-27b
local_api_key=

# Ollama (local, OpenAI-compatible)
ollama_base_url=http://host.docker.internal:11434/v1
ollama_model=llama3.1

# OpenAI (GPT) — cloud
openai_base_url=https://api.openai.com/v1
openai_model=gpt-4o-mini
openai_api_key=

# Gemini (Google, OpenAI-compatible endpoint) — cloud
gemini_base_url=https://generativelanguage.googleapis.com/v1beta/openai
gemini_model=gemini-2.0-flash
gemini_api_key=

# Anthropic (Claude) — cloud
anthropic_api_key=
claude_model=claude-sonnet-5

# ---------------- Source code access (global fallback token) ----------------
github_token=
azure_token=
source_context_lines=6

# ---------------- Deploy / production ----------------
environment=production             # production | development
public_host=                       # e.g. loglens.example.com — REQUIRED for MCP (see below)
public_url_scheme=auto             # auto | http | https
```

## Variable descriptions

| Variable | Required | Description |
|----------|:------:|----------|
| `db_dsn` | Yes | Postgres connection. On the compose network, host = `db`. If you use a Coolify-managed DB, use its connection string. |
| `jwt_secret` | Yes | Token signing secret. **Always change this in production.** |
| `jwt_algorithm` | — | Defaults to `HS256`. |
| `jwt_expire_minutes` | — | Access token session length (minutes). Defaults to 7 days. |
| `refresh_expire_days` | — | Refresh token lifetime (days). Defaults to 90 — intended for long mobile sessions. |
| `embed_model` | — | Embedding model (baked into the image). If you change it, `embed_dim` changes too. |
| `embed_dim` | — | Vector dimension (bge-m3 = 1024). |
| `similarity_threshold` | — | Semantic clustering threshold. |
| `top_frames` | — | Top N frames of the stack used for the fingerprint. |
| `llm_provider` | — | `local` / `ollama` / `openai` / `gemini` / `claude`. Can also be changed from the Settings panel. |
| `response_language` | — | The language the LLM writes titles/summaries in (free text, e.g. "English"). Shared by the whole team. |
| `local_*` | — | LM Studio base URL + model (+ optional key). |
| `ollama_*` | — | Ollama base URL + model. |
| `openai_*` | — | If you'll use OpenAI (GPT). |
| `gemini_*` | — | If you'll use Gemini. |
| `anthropic_api_key`, `claude_model` | — | If you'll use Claude. |
| `github_token`, `azure_token` | — | Global token for source code mapping (can also be set per repository). |
| `source_context_lines` | — | How many neighboring lines to show around a line in the source snippet. |
| `environment` | — | `production` (default) / `development`. The "Test log" button on the Errors page only shows in `development`. |
| `public_host` | For MCP ✅ | The domain allowed in the MCP server's (`/mcp`) DNS-rebinding protection, e.g. `loglens.example.com`. If empty, MCP only works from `localhost` — behind a real domain (Coolify/Cloudflare) an MCP client (Claude Code etc.) trying to connect will get "Invalid Host header". |
| `public_url_scheme` | — | `auto` (default, checks `X-Forwarded-Proto`) / `http` / `https`. Scheme used for webhook URLs — force it here if `auto` guesses wrong behind a reverse proxy. Can also be changed from the Settings panel. |

> **Note:** if `local_base_url`/`ollama_base_url` need to reach the host FROM INSIDE the
> container, use `host.docker.internal`. If the LLM isn't on the same server, use its actual
> address. If there's no local LLM on the server, set `llm_provider=claude` and provide the key.

## Setting these up in Coolify
Coolify does **not** auto-populate environment variables — after adding the application:
1. Go to the application → **Environment Variables** section.
2. **Paste the template above in bulk** (Coolify parses the .env format).
3. Change `jwt_secret` to a strong value; leave provider keys you're not using blank.
4. If you're using **Coolify-managed Postgres**, put its connection string into `db_dsn`
   (Coolify can auto-inject this in some setups).

## With Docker Compose
`docker-compose.yml` also carries the envs in the service definition. Locally, the `.env` at
the repo root is read automatically (`env_file` / pydantic-settings). In production, the
Coolify env takes precedence.
