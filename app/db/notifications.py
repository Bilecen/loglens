"""Kullanıcı bildirimleri (in-app inbox)."""
from app.db.session import pool


def _notif_row(r) -> dict:
    return {"id": r[0], "type": r[1], "title": r[2], "body": r[3],
            "cluster_id": r[4], "project_id": r[5], "is_read": r[6],
            "created_at": r[7].isoformat() if r[7] else None}


async def create_notifications(user_ids: list[int], type: str, title: str,
                               body: str | None, cluster_id: int | None,
                               project_id: int | None) -> None:
    """Her alıcı için ayrı satır. Boş listede no-op."""
    if not user_ids:
        return
    async with pool().connection() as conn:
        for uid in user_ids:
            await conn.execute(
                "INSERT INTO notifications (user_id, type, title, body, cluster_id, project_id) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (uid, type, title, body, cluster_id, project_id),
            )


async def list_notifications(user_id: int, limit: int = 50) -> dict:
    async with pool().connection() as conn:
        cur = await conn.execute(
            "SELECT id, type, title, body, cluster_id, project_id, is_read, created_at "
            "FROM notifications WHERE user_id = %s ORDER BY created_at DESC LIMIT %s",
            (user_id, limit),
        )
        items = [_notif_row(r) for r in await cur.fetchall()]
        cur = await conn.execute(
            "SELECT COUNT(*) FROM notifications WHERE user_id = %s AND is_read = false", (user_id,))
        unread = (await cur.fetchone())[0]
    return {"items": items, "unread": unread}


async def mark_notification_read(notification_id: int, user_id: int) -> bool:
    async with pool().connection() as conn:
        cur = await conn.execute(
            "UPDATE notifications SET is_read = true WHERE id = %s AND user_id = %s RETURNING id",
            (notification_id, user_id),
        )
        return await cur.fetchone() is not None


async def mark_all_notifications_read(user_id: int) -> int:
    async with pool().connection() as conn:
        cur = await conn.execute(
            "UPDATE notifications SET is_read = true WHERE user_id = %s AND is_read = false RETURNING id",
            (user_id,),
        )
        return len(await cur.fetchall())
