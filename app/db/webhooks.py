"""Inbound webhook'lar (token'lı log alım uçları)."""
from app.db.session import pool


def _webhook_row(r) -> dict:
    return {
        "id": r[0], "name": r[1], "token": r[2], "source": r[3], "active": r[4],
        "delivery_count": r[5],
        "last_used_at": r[6].isoformat() if r[6] else None,
        "created_at": r[7].isoformat() if r[7] else None,
        "project_id": r[8],
    }


_WEBHOOK_COLS = "id, name, token, source, active, delivery_count, last_used_at, created_at, project_id"


async def list_webhooks(project_id: int) -> list[dict]:
    async with pool().connection() as conn:
        cur = await conn.execute(
            f"SELECT {_WEBHOOK_COLS} FROM webhooks WHERE project_id = %s ORDER BY created_at DESC",
            (project_id,),
        )
        rows = await cur.fetchall()
    return [_webhook_row(r) for r in rows]


async def create_webhook(project_id: int, name: str, token: str, source: str | None) -> dict:
    async with pool().connection() as conn:
        cur = await conn.execute(
            f"INSERT INTO webhooks (project_id, name, token, source) VALUES (%s, %s, %s, %s) "
            f"RETURNING {_WEBHOOK_COLS}",
            (project_id, name, token, source),
        )
        r = await cur.fetchone()
    return _webhook_row(r)


async def delete_webhook(webhook_id: int) -> bool:
    async with pool().connection() as conn:
        cur = await conn.execute("DELETE FROM webhooks WHERE id = %s RETURNING id", (webhook_id,))
        return await cur.fetchone() is not None


async def set_webhook_active(webhook_id: int, active: bool) -> dict | None:
    async with pool().connection() as conn:
        cur = await conn.execute(
            f"UPDATE webhooks SET active = %s WHERE id = %s RETURNING {_WEBHOOK_COLS}",
            (active, webhook_id),
        )
        r = await cur.fetchone()
    return _webhook_row(r) if r else None


async def get_webhook_by_token(token: str) -> dict | None:
    async with pool().connection() as conn:
        cur = await conn.execute(f"SELECT {_WEBHOOK_COLS} FROM webhooks WHERE token = %s", (token,))
        r = await cur.fetchone()
    return _webhook_row(r) if r else None


async def touch_webhook(webhook_id: int, n: int = 1) -> None:
    async with pool().connection() as conn:
        await conn.execute(
            "UPDATE webhooks SET delivery_count = delivery_count + %s, last_used_at = now() WHERE id = %s",
            (n, webhook_id),
        )
