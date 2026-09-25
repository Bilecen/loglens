# 5. AI Settings

The **Settings** page (admin) manages the LLM provider and integration keys.
Values take effect **live (without a restart)**; fields left blank fall back to the
`.env` value on the server.

> The LLM only runs for **new error groups** (generating title/summary/severity). Existing
> groups and repeat occurrences don't call the LLM — this keeps costs low.

## LLM provider
Five options (segmented control):

| Provider | When to use |
|-----------|----------|
| **LM Studio** | Local, OpenAI-compatible server (default `http://localhost:1234/v1`) |
| **Ollama** | Local Ollama (OpenAI-compatible, `http://localhost:11434/v1`) |
| **OpenAI (GPT)** | Cloud — requires an API key |
| **Gemini** | Google Gemini API (cloud) — requires an API key |
| **Anthropic (Claude)** | Cloud — requires an API key |

Each provider has its own fields:
- **LM Studio / Ollama:** Base URL + Model (+ optional API key).
- **OpenAI / Gemini / Anthropic:** API key + Model (+ optional Base URL).

> **Important (LM Studio/Ollama):** The `Model` field must match exactly the id of the model
> that is CURRENTLY LOADED on the server; otherwise the call will fail. Check the loaded
> models on your server.

## Response language
The **Response language** field determines what language the LLM's generated title/summary
text is written in (free text — "Turkish", "English", "Deutsch", etc.). This is a **single,
global setting for the whole team**; regardless of the log's own language, the LLM's
commentary is produced in this language. This is **independent** of the web interface's own
language (the Turkish/English selector in the Profile menu) — one controls the interface text,
the other controls the content the LLM generates.

## Testing the connection
The **Test connection** button makes a small sample call with the saved settings and shows
the result (a sample title if successful, an error message if not). **Save** first, then test.

## Source code access (global tokens)
- **GitHub token** and **Azure DevOps token (PAT)** — if no per-repository token is provided,
  these global tokens are used (for stack trace → source code mapping).

## Security
- Secret keys (API key, token) are **never sent back to the interface** — only a "configured ✓"
  indicator is shown. To change one, simply enter a new value; leaving it blank preserves the
  existing value.
