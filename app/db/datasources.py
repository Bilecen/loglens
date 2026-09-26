"""Firebase/BigQuery otomatik veri kaynakları."""
from app.db.session import pool


def _ds_row(r, with_creds=False) -> dict:
    d = {"id": r[0], "project_id": r[1], "type": r[2], "name": r[3], "bq_project": r[4],
         "bq_table": r[5], "ga_dataset": r[6], "event_pattern": r[7],
         "enabled": r[9], "interval_minutes": r[10], "watermark": r[11],
         "last_run_at": r[12].isoformat() if r[12] else None,
         "last_status": r[13], "last_error": r[14], "last_count": r[15],
         "has_credentials": bool(r[8])}
    if with_creds:
        d["credentials_json"] = r[8]
    return d


_DS_COLS = ("id, project_id, type, name, bq_project, bq_table, ga_dataset, event_pattern, "
            "credentials_json, enabled, interval_minutes, watermark, last_run_at, "
            "last_status, last_error, last_count")


async def list_data_sources(project_id: int) -> list[dict]:
    async with pool().connection() as conn:
        cur = await conn.execute(
            f"SELECT {_DS_COLS} FROM data_sources WHERE project_id = %s ORDER BY created_at",
            (project_id,))
        return [_ds_row(r) for r in await cur.fetchall()]


async def get_data_source(ds_id: int, with_creds=False) -> dict | None:
    async with pool().connection() as conn:
        cur = await conn.execute(f"SELECT {_DS_COLS} FROM data_sources WHERE id = %s", (ds_id,))
        r = await cur.fetchone()
    return _ds_row(r, with_creds) if r else None


async def list_due_data_sources() -> list[dict]:
    """Aktif + interval'ı dolmuş (ya da hiç çalışmamış) veri kaynakları — kimlikleriyle."""
    async with pool().connection() as conn:
        cur = await conn.execute(
            f"SELECT {_DS_COLS} FROM data_sources WHERE enabled = true AND "
            "(last_run_at IS NULL OR last_run_at < now() - make_interval(mins => interval_minutes))")
        return [_ds_row(r, with_creds=True) for r in await cur.fetchall()]


async def create_data_source(d: dict) -> dict:
    async with pool().connection() as conn:
        cur = await conn.execute(
            "INSERT INTO data_sources (project_id, type, name, bq_project, bq_table, ga_dataset, "
            "event_pattern, credentials_json, interval_minutes) "
            f"VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING {_DS_COLS}",
            (d["project_id"], d["type"], d["name"], d["bq_project"], d.get("bq_table"),
             d.get("ga_dataset"), d.get("event_pattern"), d.get("credentials_json"),
             d.get("interval_minutes", 5)),
        )
        return _ds_row(await cur.fetchone())


async def set_data_source_enabled(ds_id: int, enabled: bool) -> dict | None:
    async with pool().connection() as conn:
        cur = await conn.execute(
            f"UPDATE data_sources SET enabled = %s WHERE id = %s RETURNING {_DS_COLS}",
            (enabled, ds_id))
        r = await cur.fetchone()
    return _ds_row(r) if r else None


async def delete_data_source(ds_id: int) -> bool:
    async with pool().connection() as conn:
        cur = await conn.execute("DELETE FROM data_sources WHERE id = %s RETURNING id", (ds_id,))
        return await cur.fetchone() is not None


async def update_data_source_run(ds_id: int, status: str, error: str | None,
                                 count: int, watermark: str | None) -> None:
    async with pool().connection() as conn:
        await conn.execute(
            "UPDATE data_sources SET last_run_at = now(), last_status = %s, last_error = %s, "
            "last_count = %s, watermark = COALESCE(%s, watermark) WHERE id = %s",
            (status, error, count, watermark, ds_id))
