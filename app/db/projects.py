"""Projeler + üyeler."""
from app.db.session import pool
from app.db.users import _user_row


def _project_row(r) -> dict:
    return {"id": r[0], "name": r[1], "key": r[2],
            "created_at": r[3].isoformat() if r[3] else None, "member_count": r[4]}


async def list_projects() -> list[dict]:
    async with pool().connection() as conn:
        cur = await conn.execute(
            """SELECT p.id, p.name, p.key, p.created_at, COUNT(m.user_id) AS members
               FROM projects p LEFT JOIN project_members m ON m.project_id = p.id
               GROUP BY p.id ORDER BY p.created_at"""
        )
        return [_project_row(r) for r in await cur.fetchall()]


async def create_project(name: str, key: str) -> dict:
    async with pool().connection() as conn:
        cur = await conn.execute(
            "INSERT INTO projects (name, key) VALUES (%s, %s) "
            "RETURNING id, name, key, created_at, 0",
            (name, key),
        )
        return _project_row(await cur.fetchone())


async def default_project_id() -> int | None:
    """Token'sız /ingest için düşen proje: en eski (ilk) proje."""
    async with pool().connection() as conn:
        cur = await conn.execute("SELECT id FROM projects ORDER BY id LIMIT 1")
        row = await cur.fetchone()
    return row[0] if row else None


async def project_exists(project_id: int) -> bool:
    async with pool().connection() as conn:
        cur = await conn.execute("SELECT 1 FROM projects WHERE id = %s", (project_id,))
        return await cur.fetchone() is not None


async def delete_project(project_id: int) -> bool:
    async with pool().connection() as conn:
        cur = await conn.execute("DELETE FROM projects WHERE id = %s RETURNING id", (project_id,))
        return await cur.fetchone() is not None


async def list_project_members(project_id: int) -> list[dict]:
    async with pool().connection() as conn:
        cur = await conn.execute(
            """SELECT u.id, u.email, u.name, u.role, u.created_at, u.presence, u.avatar
               FROM project_members m JOIN users u ON u.id = m.user_id
               WHERE m.project_id = %s ORDER BY u.name NULLS LAST, u.email""",
            (project_id,),
        )
        return [_user_row(r) for r in await cur.fetchall()]


async def add_project_member(project_id: int, user_id: int) -> None:
    async with pool().connection() as conn:
        await conn.execute(
            "INSERT INTO project_members (project_id, user_id) VALUES (%s, %s) "
            "ON CONFLICT DO NOTHING",
            (project_id, user_id),
        )


async def remove_project_member(project_id: int, user_id: int) -> bool:
    async with pool().connection() as conn:
        cur = await conn.execute(
            "DELETE FROM project_members WHERE project_id = %s AND user_id = %s RETURNING user_id",
            (project_id, user_id),
        )
        return await cur.fetchone() is not None


async def project_member_ids(project_id: int) -> list[int]:
    async with pool().connection() as conn:
        cur = await conn.execute(
            "SELECT user_id FROM project_members WHERE project_id = %s", (project_id,))
        return [r[0] for r in await cur.fetchall()]
