# 11. MCP Integration (connect your own AI tool)

LogLens works as an **MCP (Model Context Protocol)** server. You can connect your own AI tool
(Claude Code, Claude Desktop, Cursor…) to LogLens; that tool can read error clusters, link them
to source code, and — **when you grant permission** — make the fix and leave a note / update
the status back in LogLens.

> This is a **different, complementary** mechanism to the 5 fixed LLM providers in Settings
> (LM Studio/Ollama/OpenAI/Gemini/Claude). Those exist so LogLens can automatically interpret
> new errors; MCP is for **your** AI tool — the one you already use — to access LogLens data.
> LogLens never stores any of your AI API keys — the code-editing capability stays entirely in
> your AI tool.

## How it works

LogLens **does not** perform the code fix itself — your AI tool, which already has access to
your repo, does. LogLens simply provides rich context: the error's title, summary, full stack
trace, the linked source code line pulled from the repo, past occurrences, and previous notes —
in a single tool call.

## 1. Create an access key

Click the **🔑 icon** in the profile menu ([Chapter 7](07-profil-en.md#mcp-access-keys)).
Type a name into the "New key" field (e.g. "Claude Code - my MacBook") and click **Create**.

> The key is shown **only once** — copy it. If you lose it, create a new key and revoke the old
> one. Keys are valid indefinitely and can be revoked at any time.

> **If your server is behind a domain (Coolify/Cloudflare etc.):** you must set the
> `PUBLIC_HOST` environment variable to your deploy domain (e.g. `public_host=loglens.example.com`),
> otherwise MCP clients get an "Invalid Host header" error — see
> [10. Environment Variables](10-env-degiskenleri-en.md#variable-descriptions).

## 2. Connect your AI tool

**Claude Code:**
```bash
claude mcp add --transport http loglens https://your-server.com/mcp/ \
  --header "Authorization: Bearer <your-key>"
```

**Claude Desktop** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "loglens": {
      "url": "https://your-server.com/mcp/",
      "headers": { "Authorization": "Bearer <your-key>" }
    }
  }
}
```

> **The trailing `/` matters** — `/mcp` (without the slash) returns a 307 redirect; most clients
> follow it automatically, but if you run into issues try `/mcp/` first. When developing
> locally, use `http://localhost:8000/mcp/`.

## 3. Use it

Ask your AI tool in natural language — e.g.: *"Look at the ERR-a1b2c3d4 cluster in LogLens and
fix it."* The tool automatically calls the appropriate tools.

## Available tools

| Tool | What it does |
|------|----------|
| `list_projects` | Lists all projects |
| `list_errors` | Lists error clusters in a project with filters (status/severity/search) |
| `get_error` | **This is where the real value is** — title, summary, full stack trace, source code snippet + file URL, recent occurrences, notes, previous LLM comments |
| `get_stats` | Project summary statistics (open/resolved counts, severity breakdown) |
| `add_note` | Leaves a note on a cluster (e.g. a summary of the fix that was made) |
| `update_status` | Changes the status (`open`/`investigating`/`resolved`/`ignored`) |

`add_note` and `update_status` are **write** operations — they exist so your AI tool can report
back to LogLens after fixing an error. Reopening a final status (`resolved`/`ignored`) is only
possible with a key belonging to a user with the **admin** role (the same rule as in the web
interface).

## Permissions and visibility

Tool calls run with the **role** of whichever user the key belongs to (the same permission model
as `get_current_user`). You can **revoke** the key from the profile menu at any time — the AI
tool using that key instantly loses its connection.

## Verifying your server

Your AI tool (or you) can confirm the server is genuinely a LogLens server via `GET /health`:
```json
{ "ok": true, "name": "loglens", "api_version": "1.0", "features": { "websocket": true, "chat": true, "notifications": true, "refresh_token": true } }
```
