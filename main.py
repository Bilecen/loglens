"""
FastAPI ana uygulaması — LogLens CMS.

İnce kabuk: uygulama + lifespan + CORS + router'lar. İş mantığı `services.py`'de,
endpoint'ler `routers/` altında domain başına ayrılmıştır.

Bölümler (router'lar):
  - auth      kayıt / giriş / ben (JWT)
  - ingest    log alımı (dış SDK/Firebase/webhook — token istemez)
  - system    sağlık kontrolü
  - stats     istatistik + grafik (giriş ister)
  - clusters  hata gruplarını okuma + CMS yönetimi (giriş ister)
  - users     kullanıcı yönetimi (admin)
  - repos     kod repo bağlama (admin)
  - settings  AI / entegrasyon ayarları (admin)
  - webhooks  inbound webhook yönetimi (admin)
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

import asyncio

import auth
import datasources
import db
import embedding
import mcp_server
import realtime
from routers import (auth as auth_router, clusters, datasources as datasources_router,
                     ingest, mcp_tokens, notifications, projects, repos,
                     settings, stats, system, team, users, webhooks)

_mcp_asgi_app, _mcp_inner_app = mcp_server.build()


@asynccontextmanager
async def lifespan(app: FastAPI):
    embedding.load_model()
    await db.open_pool()
    scheduler = asyncio.create_task(datasources.scheduler_loop())  # otomatik veri kaynakları
    async with _mcp_inner_app.router.lifespan_context(_mcp_inner_app):  # MCP session manager
        yield
    scheduler.cancel()
    await db.close_pool()


app = FastAPI(title="LogLens", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # prod'da UI origin'i ile sınırla
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (auth_router, ingest, system, stats, projects, clusters, users, repos,
               settings, webhooks, notifications, team, datasources_router, mcp_tokens):
    app.include_router(module.router)

app.mount("/mcp", _mcp_asgi_app)  # Model Context Protocol — bkz. mcp_server.py


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket, token: str = Query(...)):
    """Gerçek-zamanlı kanal: sohbet + presence + online durumu. Auth token query param'da."""
    user = await auth.user_from_token(token)
    if not user:
        await ws.close(code=1008)
        return
    newly_online = await realtime.manager.connect(ws, user["id"])
    if newly_online:
        await realtime.manager.broadcast({"type": "online", "user_id": user["id"], "online": True})
    try:
        while True:
            data = await ws.receive_json()
            kind = data.get("type")
            if kind == "chat" and (data.get("body") or "").strip():
                msg = await db.add_message(user["id"], data["body"].strip())
                await realtime.manager.broadcast({"type": "chat", "message": msg})
            elif kind == "presence" and data.get("presence") in ("available", "away", "busy"):
                await db.set_presence(user["id"], data["presence"])
                await realtime.manager.broadcast(
                    {"type": "presence", "user_id": user["id"], "presence": data["presence"]})
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        uid, now_offline = realtime.manager.disconnect(ws)
        if now_offline:
            await realtime.manager.broadcast({"type": "online", "user_id": uid, "online": False})
