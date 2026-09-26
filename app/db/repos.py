"""Bağlı kod repoları (GitHub/Azure DevOps entegrasyonu)."""
from app.db.session import pool


def _repo_row(row, include_token=False) -> dict:
    d = {"id": row[0], "provider": row[1], "full_name": row[2],
         "default_branch": row[3], "path_prefix": row[5],
         "created_at": row[6].isoformat() if row[6] else None,
         "has_token": bool(row[4])}
    if include_token:
        d["token"] = row[4]
    return d


async def create_repo(project_id: int, provider: str, full_name: str, default_branch: str,
                      token: str | None, path_prefix: str | None) -> dict:
    async with pool().connection() as conn:
        cur = await conn.execute(
            """INSERT INTO repos (project_id, provider, full_name, default_branch, token, path_prefix)
               VALUES (%s, %s, %s, %s, %s, %s)
               ON CONFLICT (project_id, provider, full_name) DO UPDATE
                   SET default_branch = EXCLUDED.default_branch,
                       token = COALESCE(EXCLUDED.token, repos.token),
                       path_prefix = EXCLUDED.path_prefix
               RETURNING id, provider, full_name, default_branch, token, path_prefix, created_at""",
            (project_id, provider, full_name, default_branch, token, path_prefix),
        )
        return _repo_row(await cur.fetchone())


async def list_repos(project_id: int, include_token=False) -> list[dict]:
    async with pool().connection() as conn:
        cur = await conn.execute(
            "SELECT id, provider, full_name, default_branch, token, path_prefix, created_at "
            "FROM repos WHERE project_id = %s ORDER BY created_at",
            (project_id,),
        )
        return [_repo_row(r, include_token) for r in await cur.fetchall()]


async def delete_repo(repo_id: int) -> bool:
    async with pool().connection() as conn:
        cur = await conn.execute("DELETE FROM repos WHERE id = %s RETURNING id", (repo_id,))
        return (await cur.fetchone()) is not None
