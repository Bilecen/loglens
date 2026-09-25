# LogLens — User Documentation

LogLens is an error-analysis platform that collects your applications' errors (mobile +
backend) in one place, **clusters them semantically**, and **annotates them with AI** (the
LLM commentary language and the interface language can be configured separately —
including Turkish/English).

- Different errors with the same root cause fall into a **single group** (embedding-based
  similarity).
- For every new group, the LLM generates a **title + summary + severity level**.
- Includes multi-project support, team assignment, live chat, and real-time notifications.
- Installed **on your own server** (on-prem) — your data stays with you.

## Table of Contents

| # | Topic | What you'll learn |
|---|------|-----------------|
| 1 | [Getting Started](01-baslangic-en.md) | Login, interface, first project |
| 2 | [Managing Errors](02-hatalar-en.md) | Filtering, status, notes, assignment, source code |
| 3 | [Projects & Roles](03-projeler-roller-en.md) | Creating projects, team assignment, roles |
| 4 | [Integrations](04-entegrasyonlar-en.md) | Webhook, Coolify/Vector, Spring/Ktor/FastAPI/Laravel/.NET, Firebase |
| 5 | [AI Settings](05-ai-ayarlari-en.md) | LM Studio / Ollama / Claude, keys |
| 6 | [Team, Chat & Notifications](06-ekip-bildirim-en.md) | Presence, live chat, notification bell |
| 7 | [Profile & Appearance](07-profil-en.md) | Editing your profile, photo, theme, design styles |
| 8 | [Setup & Deploy](08-kurulum-deploy-en.md) | Docker, docker-compose, Coolify |
| 9 | [API Reference](09-api-en.md) | OpenAPI, authentication, mobile |
| 10 | [Environment Variables](10-env-degiskenleri-en.md) | `.env` template, Coolify setup |
| 11 | [MCP Integration](11-mcp-en.md) | Connecting your own AI tool (Claude Code, etc.) |

## Quick start
1. Open the interface in your browser and sign in with the **admin** account.
2. Create a **project** and assign your team ([Chapter 3](03-projeler-roller-en.md)).
3. Generate a **webhook** for the project and connect your services ([Chapter 4](04-entegrasyonlar-en.md)).
4. Once errors start coming in, manage them from the **Errors** page ([Chapter 2](02-hatalar-en.md)).
