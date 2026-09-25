# 8. Installation & Deployment

LogLens is installed **on your own server**. Components:
- **Backend** — FastAPI (:8000). The embedding model runs INSIDE the process (no outbound calls).
- **Frontend** — React/Vite (static after build).
- **Database** — PostgreSQL + pgvector.

## With Docker
The repo already includes a `Dockerfile` and `docker-compose.yml`.

```bash
docker compose up -d --build
```
- **db** — Postgres with pgvector; `schema.sql` runs automatically on first startup (including
  the default project + tables).
- **api** — the backend image.

### Embedding model baked into the image
The backend image **bakes the embedding model** (**bge-m3**) into the image at build time — no
internet is required at deploy time, and it runs offline (no runtime calls to HuggingFace).
Since CPU-only torch is used, unnecessary CUDA libraries are not included in the image.

## Environment variables (summary)
Provided via `.env` (or compose env):

| Variable | Description |
|----------|----------|
| `db_dsn` | Postgres connection |
| `llm_provider` | `local` / `ollama` / `claude` (can also be changed from the UI) |
| `local_base_url`, `local_model` | LM Studio |
| `ollama_base_url`, `ollama_model` | Ollama |
| `anthropic_api_key`, `claude_model` | Claude |
| `github_token`, `azure_token` | Source code access (global) |
| `jwt_secret` | **Always set a strong value in production** |

> AI/integration keys can also be managed from the **Settings** panel while the app is running
> (this overrides `.env`).

## Deploying with Coolify
- Coolify runs the app as Docker and provides **automatic HTTPS** (Let's Encrypt).
- **WebSocket:** for live chat/presence/notifications, the reverse proxy needs to pass through
  the **WebSocket upgrade**. Coolify/Caddy/Traefik do this automatically — no extra
  configuration is needed.
- For log collection you can install Vector on the same host, or use Coolify Log Drain
  (see [Chapter 4](04-entegrasyonlar-en.md)).

## Schema updates
In new releases, schema changes are written into `schema.sql` idempotently
(IF NOT EXISTS / ALTER …); they're applied automatically on a new install, and as a migration
on an existing install.
