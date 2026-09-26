"""Presence + ekip sohbeti."""
from app.db.session import pool
from app.db.users import _user_row


async def set_presence(user_id: int, presence: str) -> None:
    async with pool().connection() as conn:
        await conn.execute("UPDATE users SET presence = %s WHERE id = %s", (presence, user_id))


async def list_team(user_id: int) -> list[dict]:
    """Tüm kullanıcılar + presence (ekip paneli). Kişinin kendisi 'me' bayrağıyla."""
    async with pool().connection() as conn:
        cur = await conn.execute(
            "SELECT id, email, name, role, created_at, presence, avatar FROM users ORDER BY name NULLS LAST, email")
        return [{**_user_row(r), "me": r[0] == user_id} for r in await cur.fetchall()]


def _message_row(r) -> dict:
    return {"id": r[0], "user_id": r[1], "body": r[2],
            "created_at": r[3].isoformat() if r[3] else None,
            "author_name": r[4], "author_email": r[5]}


async def list_messages(after_id: int = 0, limit: int = 100) -> list[dict]:
    async with pool().connection() as conn:
        cur = await conn.execute(
            "SELECT m.id, m.user_id, m.body, m.created_at, u.name, u.email "
            "FROM messages m LEFT JOIN users u ON u.id = m.user_id "
            "WHERE m.id > %s ORDER BY m.id DESC LIMIT %s",
            (after_id, limit),
        )
        rows = await cur.fetchall()
    return [_message_row(r) for r in reversed(rows)]


async def add_message(user_id: int, body: str) -> dict:
    async with pool().connection() as conn:
        cur = await conn.execute(
            "INSERT INTO messages (user_id, body) VALUES (%s, %s) "
            "RETURNING id, user_id, body, created_at",
            (user_id, body),
        )
        r = await cur.fetchone()
        acur = await conn.execute("SELECT name, email FROM users WHERE id = %s", (user_id,))
        a = await acur.fetchone()
    return _message_row((r[0], r[1], r[2], r[3], a[0] if a else None, a[1] if a else None))
