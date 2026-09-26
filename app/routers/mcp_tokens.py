"""MCP (Model Context Protocol) erişim anahtarları — kullanıcı kendi AI aracını
(Claude Code/Desktop, Cursor…) LogLens'e bağlamak için burada üretir/listeler/iptal eder.
Giriş ister; her kullanıcı yalnızca kendi anahtarlarını görür/yönetir."""
from fastapi import APIRouter, Depends, HTTPException

from app.core import security as auth
from app.db import users as db
from app.schemas.auth import McpTokenIn

router = APIRouter(tags=["mcp"])


@router.get("/mcp-tokens")
async def mcp_tokens_list(user: dict = Depends(auth.get_current_user)):
    return await db.list_mcp_tokens(user["id"])


@router.post("/mcp-tokens")
async def mcp_tokens_create(body: McpTokenIn, user: dict = Depends(auth.get_current_user)):
    raw, token_hash = auth.new_mcp_token()
    row = await db.create_mcp_token(user["id"], token_hash, name=body.name.strip())
    return {**row, "token": raw}  # ham değer YALNIZCA bu yanıtta döner, bir daha gösterilmez


@router.delete("/mcp-tokens/{token_id}")
async def mcp_tokens_revoke(token_id: int, user: dict = Depends(auth.get_current_user)):
    if not await db.revoke_mcp_token(user["id"], token_id):
        raise HTTPException(status_code=404, detail="anahtar bulunamadı")
    return {"revoked": token_id}
