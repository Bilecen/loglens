# LogLens

*[Türkçe versiyon](README.md)*

A self-hosted error-analysis platform with **semantic error clustering** and **AI-generated
commentary**. Firebase Crashlytics/Analytics, mobile SDKs, and production backend logs
(Spring Boot, Ktor, FastAPI, Laravel, .NET) are all collected in a single dashboard.

- **Semantic grouping** — errors that share the same root cause are grouped into a single
  cluster using embedding-based similarity (even when the fingerprint doesn't match but the
  meaning is the same).
- **LLM commentary** — a title, summary, and severity level are automatically generated for
  every new cluster (local model / Ollama / OpenAI / Gemini / Claude — pick one, and
  optionally get a "second opinion").
- **Source code linking** — the stack trace is automatically mapped to the corresponding
  line in your connected GitHub/Azure DevOps repository.
- **Multi-project, roles, team** — per-project assignment (admin/developer/PO-PM/tester),
  live chat, presence, real-time notifications (WebSocket).
- **Mobile API** — a single native app; the user adds their own server URL via QR code
  (self-hosted client pattern). Details: [`documents/09-api.md`](documents/09-api-en.md).
- **MCP integration** — connect your own AI tool (Claude Code, Claude Desktop, Cursor…) to
  LogLens; let it read error data, link it to source code, fix it, and leave a note.
  Details: [`documents/11-mcp.md`](documents/11-mcp-en.md).
- **Multilingual** — the interface supports Turkish/English (per-user, from the Profile
  menu); the language of the LLM-generated titles/summaries is configured separately in
  Settings (free text, applies to the whole team).
- **Your data stays with you** — runs on your own infrastructure, no data is sent to a
  third-party SaaS.

## Quick start (Docker Compose)

```bash
git clone https://github.com/Bilecen/loglens.git
cd loglens
cp env.example .env   # fill in the values — see documents/10-env-degiskenleri-en.md
docker compose up -d --build
```

The backend comes up on `:8000` (verify with `/health`); the database schema is set up
automatically on first launch. If you want to develop the frontend separately:

```bash
cd frontend
npm install
npm run dev   # :5173, /api → proxies to the backend
```

On first launch, `/auth/bootstrap` shows the first-admin setup screen; the account you
create starts with the `admin` role.

## Documentation

End-to-end user documentation is available under [`documents/`](documents/) (in English):

| # | Topic |
|---|------|
| 1 | [Getting Started](documents/01-baslangic-en.md) |
| 2 | [Managing Errors](documents/02-hatalar-en.md) |
| 3 | [Projects & Roles](documents/03-projeler-roller-en.md) |
| 4 | [Integrations](documents/04-entegrasyonlar-en.md) |
| 5 | [AI Settings](documents/05-ai-ayarlari-en.md) |
| 6 | [Team, Chat & Notifications](documents/06-ekip-bildirim-en.md) |
| 7 | [Profile](documents/07-profil-en.md) |
| 8 | [Setup & Deploy (Coolify)](documents/08-kurulum-deploy-en.md) |
| 9 | [API Reference (including mobile)](documents/09-api-en.md) |
| 10 | [Environment Variables (.env)](documents/10-env-degiskenleri-en.md) |
| 11 | [MCP Integration](documents/11-mcp-en.md) |

## Architecture

FastAPI (backend, `:8000`) + React/Vite (frontend, `:5173`) + Postgres/pgvector.
The embedding model (`BAAI/bge-m3`) is baked into the Docker image — it makes no external
calls at runtime. The LLM is optional; without it, clusters are still created, and
commentary can be added later, either manually or via an LLM.

## License

[MIT](LICENSE) — use, modify, and distribute freely.
