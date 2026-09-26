"""Kullanıcılar, refresh token'lar (mobil oturum) ve MCP erişim anahtarları."""
from app.db.session import pool


def _user_row(row) -> dict:
    return {"id": row[0], "email": row[1], "name": row[2], "role": row[3],
            "created_at": row[4].isoformat() if row[4] else None,
            "presence": row[5], "avatar": row[6]}


async def count_users() -> int:
    async with pool().connection() as conn:
        cur = await conn.execute("SELECT COUNT(*) FROM users")
        return (await cur.fetchone())[0]


async def create_refresh_token(user_id: int, token_hash: str, expires_at) -> None:
    async with pool().connection() as conn:
        await conn.execute(
            "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (%s, %s, %s)",
            (user_id, token_hash, expires_at))


async def get_refresh_user_id(token_hash: str) -> int | None:
    """Geçerli (süresi dolmamış) refresh token'ın kullanıcısı."""
    async with pool().connection() as conn:
        cur = await conn.execute(
            "SELECT user_id FROM refresh_tokens WHERE token_hash = %s AND expires_at > now()",
            (token_hash,))
        r = await cur.fetchone()
    return r[0] if r else None


async def delete_refresh_token(token_hash: str) -> None:
    async with pool().connection() as conn:
        await conn.execute("DELETE FROM refresh_tokens WHERE token_hash = %s", (token_hash,))


async def create_mcp_token(user_id: int, token_hash: str, name: str | None) -> dict:
    async with pool().connection() as conn:
        cur = await conn.execute(
            """INSERT INTO mcp_tokens (user_id, token_hash, name)
               VALUES (%s, %s, %s) RETURNING id, name, created_at, last_used_at""",
            (user_id, token_hash, name))
        row = await cur.fetchone()
    return {"id": row[0], "name": row[1],
            "created_at": row[2].isoformat() if row[2] else None,
            "last_used_at": row[3].isoformat() if row[3] else None}


async def list_mcp_tokens(user_id: int) -> list[dict]:
    async with pool().connection() as conn:
        cur = await conn.execute(
            """SELECT id, name, created_at, last_used_at FROM mcp_tokens
               WHERE user_id = %s ORDER BY created_at DESC""",
            (user_id,))
        rows = await cur.fetchall()
    return [{"id": r[0], "name": r[1],
             "created_at": r[2].isoformat() if r[2] else None,
             "last_used_at": r[3].isoformat() if r[3] else None} for r in rows]


async def get_mcp_user_id(token_hash: str) -> int | None:
    """Geçerli bir MCP anahtarının kullanıcısı; bulunursa last_used_at güncellenir."""
    async with pool().connection() as conn:
        cur = await conn.execute(
            "UPDATE mcp_tokens SET last_used_at = now() WHERE token_hash = %s RETURNING user_id",
            (token_hash,))
        r = await cur.fetchone()
    return r[0] if r else None


async def revoke_mcp_token(user_id: int, token_id: int) -> bool:
    """Yalnızca sahibi iptal edebilir."""
    async with pool().connection() as conn:
        cur = await conn.execute(
            "DELETE FROM mcp_tokens WHERE id = %s AND user_id = %s", (token_id, user_id))
        return cur.rowcount > 0


async def create_user(email: str, name: str | None, password_hash: str, role: str) -> dict:
    async with pool().connection() as conn:
        cur = await conn.execute(
            """INSERT INTO users (email, name, password_hash, role)
               VALUES (%s, %s, %s, %s)
               RETURNING id, email, name, role, created_at, presence, avatar""",
            (email, name, password_hash, role),
        )
        return _user_row(await cur.fetchone())


async def get_user_by_email(email: str) -> dict | None:
    """Şifre doğrulaması için password_hash DAHİL döner (sadece iç kullanım)."""
    async with pool().connection() as conn:
        cur = await conn.execute(
            "SELECT id, email, name, role, created_at, presence, avatar, password_hash FROM users WHERE email = %s",
            (email,),
        )
        row = await cur.fetchone()
    if not row:
        return None
    d = _user_row(row)
    d["password_hash"] = row[7]
    return d


async def get_user_by_id(user_id: int) -> dict | None:
    async with pool().connection() as conn:
        cur = await conn.execute(
            "SELECT id, email, name, role, created_at, presence, avatar FROM users WHERE id = %s",
            (user_id,),
        )
        row = await cur.fetchone()
    return _user_row(row) if row else None


async def list_users() -> list[dict]:
    async with pool().connection() as conn:
        cur = await conn.execute(
            "SELECT id, email, name, role, created_at, presence, avatar FROM users ORDER BY created_at"
        )
        return [_user_row(r) for r in await cur.fetchall()]


async def update_user_role(user_id: int, role: str) -> dict | None:
    async with pool().connection() as conn:
        cur = await conn.execute(
            "UPDATE users SET role = %s WHERE id = %s RETURNING id, email, name, role, created_at, presence, avatar",
            (role, user_id),
        )
        row = await cur.fetchone()
    return _user_row(row) if row else None


async def delete_user(user_id: int) -> bool:
    async with pool().connection() as conn:
        cur = await conn.execute("DELETE FROM users WHERE id = %s RETURNING id", (user_id,))
        return (await cur.fetchone()) is not None


async def update_me(user_id: int, fields: dict) -> dict | None:
    """Kendi profilini güncelle: name / password_hash / avatar (yalnız verilenler)."""
    allowed = {"name", "password_hash", "avatar"}
    sets, params = [], []
    for k, v in fields.items():
        if k in allowed:
            sets.append(f"{k} = %s")
            params.append(v)
    if sets:
        params.append(user_id)
        async with pool().connection() as conn:
            await conn.execute(f"UPDATE users SET {', '.join(sets)} WHERE id = %s", tuple(params))
    return await get_user_by_id(user_id)
