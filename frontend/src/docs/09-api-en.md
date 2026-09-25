# 9. API Reference

The LogLens backend serves REST + WebSocket. The full, up-to-date contract is generated
**automatically**:

- **Swagger UI:** `https://loglens.../docs`
- **OpenAPI JSON:** `https://loglens.../openapi.json`

> You can generate a **type-safe client** for native/mobile apps from `openapi.json`
> (Kotlin, Swift, TS…).

## Authentication
- `POST /auth/login` → `{ token, refresh_token, user }`. The returned **JWT** (`token`) is sent
  on subsequent requests via the `Authorization: Bearer <token>` header. The access token is
  valid for 7 days.
- `POST /auth/refresh` → body `{ refresh_token }`, returns `{ token, user }` (a new access
  token). The refresh token is valid for 90 days — for long-lived mobile sessions, store it in
  secure storage (Keychain/Keystore) and call this endpoint when the access token expires.
- `POST /auth/logout` → body `{ refresh_token }`, revokes the refresh token on the server
  (call this on logout / when a device is lost).
- `GET /auth/me` → the current user.
- For WebSocket, the token is passed as a query param: `/ws?token=<jwt>`.

## Key endpoints (summary)

**Log ingestion (public, token-based):**
- `POST /ingest/hook/{token}` — a single error
- `POST /ingest/hook/{token}/batch` — bulk (for collectors)
- `POST /ingest?project_id=` — tokenless (to the default/given project)

**Reading / management (JWT):**
- `GET /projects`, `GET /clusters?project_id=`, `GET /clusters/{id}`
- `PATCH /clusters/{id}` (status/assignment/note fields), `POST /clusters/{id}/notes`
- `GET /stats?project_id=`, `/stats/timeseries`, `/stats/breakdown`
- `GET /notifications`, `POST /notifications/{id}/read`, `/read-all`
- `GET /team`, `PATCH /team/presence`, `GET/POST /chat`
- `PATCH /users/me` — your own profile (name, password, avatar)

**Admin:** `/users*`, `/projects*`, `/repos*`, `/webhooks*`, `/settings*`

## WebSocket
`/ws?token=<jwt>` — a single channel. The client sends:
```json
{ "type": "chat", "body": "..." }
{ "type": "presence", "presence": "available|away|busy" }
```
The server broadcasts: `chat` (new message), `presence` (status changed), `online`
(connected/disconnected), `notification` (targeted via `user_ids`).

## Mobile app
Architecture: **a single app** in the app store; the user **adds their own LogLens server URL**
(self-hosted client pattern). The app is a thin client — all data stays on the customer's
server.

**Adding a server (QR):** the web login page shows a QR code; the QR encodes the following
deep link: `loglens://add-server?url=<server-origin>`. The app catches this URL scheme
(Android intent-filter / iOS URL scheme) and adds the `url` parameter to its server list.
Manual URL entry must also be supported (without a QR code).

**Server verification:** send `GET /health` to the added/QR-scanned URL:
```json
{
  "ok": true,
  "name": "loglens",
  "api_version": "1.0",
  "provider": "local",
  "embed_model": "BAAI/bge-m3",
  "features": { "websocket": true, "chat": true, "notifications": true, "refresh_token": true }
}
```
`ok && name == "loglens"` confirms it's a genuine LogLens server. No authentication required.

**New error notifications:** when a new critical/high-severity error cluster is created, an
automatic `type: "new_error"` notification is dropped for project members (`GET /notifications`)
and `{ "type": "notification", "user_ids": [...] }` is broadcast to open WS connections — when
the app sees this, it refreshes `/notifications`. **There is no background push (FCM/APNs) in
v1**, deliberately deferred: WS + periodic polling while the app is open is sufficient.

- Auth + reading/management + notification + chat endpoints are the same as above.
- Native (Android/Kotlin + iOS/Swift) clients can generate a client from `openapi.json`.

## MCP (for your own AI tool)
In addition to REST/WebSocket, there is a **Model Context Protocol** server under `/mcp/` —
tools like Claude Code/Desktop and Cursor can connect using their own authentication (a Bearer
MCP key, separate from JWT) to read error data, leave notes, and update status. Details and
connection steps: [Chapter 11 — MCP integration](11-mcp-en.md).
