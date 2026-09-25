"""
Postgres + pgvector erişimi (psycopg3 async pool).
İki katmanlı arama: önce ucuz fingerprint, sonra vektör.
"""
from psycopg_pool import AsyncConnectionPool
from pgvector.psycopg import register_vector_async
from pgvector import Vector
from config import settings

_pool: AsyncConnectionPool | None = None


async def _configure(conn):
    # Her bağlantıda pgvector tiplerini kaydet
    await register_vector_async(conn)


async def open_pool():
    global _pool
    _pool = AsyncConnectionPool(
        conninfo=settings.db_dsn,
        configure=_configure,
        open=False,
        min_size=1,
        max_size=10,
    )
    await _pool.open()


async def close_pool():
    if _pool:
        await _pool.close()


# --- 1. Katman: fingerprint ile kesin eşleşme (ucuz) ---
async def find_by_fingerprint(project_id: int, fp: str) -> dict | None:
    async with _pool.connection() as conn:
        cur = await conn.execute(
            "SELECT id, group_key, occurrence_count FROM error_clusters "
            "WHERE project_id = %s AND fingerprint = %s",
            (project_id, fp),
        )
        row = await cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "group_key": row[1], "occurrence_count": row[2]}


# --- 2. Katman: vektör benzerlik araması ---
async def find_by_vector(project_id: int, vec: list[float], threshold: float) -> dict | None:
    async with _pool.connection() as conn:
        # <=> cosine distance; benzerlik = 1 - distance. Arama PROJE BAZINDA.
        cur = await conn.execute(
            """
            SELECT id, group_key, occurrence_count, 1 - (embedding <=> %s) AS similarity
            FROM error_clusters
            WHERE project_id = %s
            ORDER BY embedding <=> %s
            LIMIT 1
            """,
            (Vector(vec), project_id, Vector(vec)),
        )
        row = await cur.fetchone()
    if not row:
        return None
    similarity = float(row[3])
    if similarity < threshold:
        return None
    return {
        "id": row[0],
        "group_key": row[1],
        "occurrence_count": row[2],
        "similarity": similarity,
    }


# --- Mevcut kümeye tekrar ekle: count +1, sürüm/zaman güncelle ---
async def bump_cluster(cluster_id: int, app_version: str | None,
                       platform: str | None, raw_message: str) -> int:
    async with _pool.connection() as conn:
        cur = await conn.execute(
            """
            UPDATE error_clusters
            SET occurrence_count = occurrence_count + 1,
                last_seen_at = now(),
                last_seen_version = COALESCE(%s, last_seen_version)
            WHERE id = %s
            RETURNING occurrence_count
            """,
            (app_version, cluster_id),
        )
        new_count = (await cur.fetchone())[0]
        await conn.execute(
            """
            INSERT INTO error_occurrences (cluster_id, app_version, platform, raw_message)
            VALUES (%s, %s, %s, %s)
            """,
            (cluster_id, app_version, platform, raw_message),
        )
    return new_count


# --- Yeni küme oluştur (LLM yorumundan sonra) ---
async def create_cluster(project_id: int, group_key: str, fingerprint: str, vec: list[float],
                         llm: dict, app_version: str | None,
                         platform: str | None, raw_message: str,
                         template: str | None = None, llm_ok: bool = True) -> tuple[int, int]:
    """
    Kümeyi ekler. Yarış durumu: aynı (proje, fingerprint) iki log eşzamanlı
    gelirse ON CONFLICT ile mevcut kümeye düşülür (count +1). Döner: (id, count).
    count == 1 ise gerçekten yeni küme oluşmuştur.
    """
    async with _pool.connection() as conn:
        cur = await conn.execute(
            """
            INSERT INTO error_clusters
                (project_id, group_key, fingerprint, title, summary, source, origin, severity,
                 embedding, first_seen_version, last_seen_version, llm_ok, template, llm_model)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (project_id, fingerprint) DO UPDATE
                SET occurrence_count = error_clusters.occurrence_count + 1,
                    last_seen_at = now(),
                    last_seen_version = COALESCE(EXCLUDED.last_seen_version,
                                                 error_clusters.last_seen_version)
            RETURNING id, occurrence_count
            """,
            (
                project_id, group_key, fingerprint,
                llm.get("title"), llm.get("summary"),
                llm.get("source"), llm.get("origin"), llm.get("severity"),
                Vector(vec), app_version, app_version, llm_ok, template, llm.get("llm_model"),
            ),
        )
        cluster_id, count = await cur.fetchone()
        await conn.execute(
            """
            INSERT INTO error_occurrences (cluster_id, app_version, platform, raw_message)
            VALUES (%s, %s, %s, %s)
            """,
            (cluster_id, app_version, platform, raw_message),
        )
    return cluster_id, count


# ---------- UI okuma sorguları ----------

def _cluster_row(row) -> dict:
    return {
        "id": row[0], "group_key": row[1], "title": row[2], "summary": row[3],
        "source": row[4], "origin": row[5], "severity": row[6], "occurrence_count": row[7],
        "first_seen_at": row[8].isoformat() if row[8] else None,
        "last_seen_at": row[9].isoformat() if row[9] else None,
        "first_seen_version": row[10], "last_seen_version": row[11],
        "status": row[12], "assignee_id": row[13], "note": row[14],
        "source_snippet": row[15], "source_url": row[16],
        "assignee_name": row[17], "assignee_email": row[18],
        "llm_ok": row[19], "llm_model": row[20],
    }


# c.* ile başlayan alanlar; sonda assignee için users JOIN'inden 2 alan.
_CLUSTER_COLS = """c.id, c.group_key, c.title, c.summary, c.source, c.origin, c.severity,
                   c.occurrence_count, c.first_seen_at, c.last_seen_at,
                   c.first_seen_version, c.last_seen_version, c.status, c.assignee_id,
                   c.note, c.source_snippet, c.source_url, u.name, u.email, c.llm_ok, c.llm_model"""

_CLUSTER_FROM = "FROM error_clusters c LEFT JOIN users u ON u.id = c.assignee_id"

_SORT_MAP = {
    "last_seen": "c.last_seen_at DESC",
    "first_seen": "c.first_seen_at DESC",
    "count": "c.occurrence_count DESC",
}


def _cluster_filters(project_id, q, severity, origin, status):
    """Ortak WHERE cümlesi + parametreleri (list_clusters & count_clusters paylaşır)."""
    where, params = ["c.project_id = %s"], [project_id]
    if q:
        where.append("(c.title ILIKE %s OR c.summary ILIKE %s)")
        params += [f"%{q}%", f"%{q}%"]
    if severity:
        where.append("c.severity = %s")
        params.append(severity)
    if origin:
        where.append("c.origin = %s")
        params.append(origin)
    if status:
        where.append("c.status = %s")
        params.append(status)
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    return clause, params


async def list_clusters(project_id: int, q: str | None, severity: str | None, origin: str | None,
                        status: str | None, sort: str, limit: int, offset: int) -> list[dict]:
    clause, params = _cluster_filters(project_id, q, severity, origin, status)
    order = _SORT_MAP.get(sort, _SORT_MAP["last_seen"])
    async with _pool.connection() as conn:
        cur = await conn.execute(
            f"SELECT {_CLUSTER_COLS} {_CLUSTER_FROM} {clause} "
            f"ORDER BY {order} LIMIT %s OFFSET %s",
            tuple(params + [limit, offset]),
        )
        rows = await cur.fetchall()
    return [_cluster_row(r) for r in rows]


async def count_clusters(project_id: int, q: str | None, severity: str | None, origin: str | None,
                         status: str | None) -> int:
    clause, params = _cluster_filters(project_id, q, severity, origin, status)
    async with _pool.connection() as conn:
        cur = await conn.execute(
            f"SELECT COUNT(*) {_CLUSTER_FROM} {clause}", tuple(params),
        )
        row = await cur.fetchone()
    return row[0] if row else 0


async def get_cluster(cluster_id: int) -> dict | None:
    async with _pool.connection() as conn:
        cur = await conn.execute(
            f"SELECT {_CLUSTER_COLS} {_CLUSTER_FROM} WHERE c.id = %s",
            (cluster_id,),
        )
        row = await cur.fetchone()
    return _cluster_row(row) if row else None


async def update_cluster_meta(cluster_id: int, fields: dict) -> dict | None:
    """CMS: status / assignee_id / note güncelle. Sadece verilen alanlar değişir."""
    allowed = {"status", "assignee_id", "note"}
    sets, params = [], []
    for k, v in fields.items():
        if k in allowed:
            sets.append(f"{k} = %s")
            params.append(v)
    if not sets:
        return await get_cluster(cluster_id)
    params.append(cluster_id)
    async with _pool.connection() as conn:
        cur = await conn.execute(
            f"UPDATE error_clusters SET {', '.join(sets)} WHERE id = %s RETURNING id",
            tuple(params),
        )
        row = await cur.fetchone()
    if not row:
        return None
    return await get_cluster(cluster_id)


def _note_row(r) -> dict:
    return {
        "id": r[0], "cluster_id": r[1], "author_id": r[2], "body": r[3],
        "created_at": r[4].isoformat() if r[4] else None,
        "author_name": r[5], "author_email": r[6],
    }


async def list_notes(cluster_id: int) -> list[dict]:
    async with _pool.connection() as conn:
        cur = await conn.execute(
            "SELECT n.id, n.cluster_id, n.author_id, n.body, n.created_at, u.name, u.email "
            "FROM cluster_notes n LEFT JOIN users u ON u.id = n.author_id "
            "WHERE n.cluster_id = %s ORDER BY n.created_at ASC",
            (cluster_id,),
        )
        rows = await cur.fetchall()
    return [_note_row(r) for r in rows]


async def add_note(cluster_id: int, author_id: int, body: str) -> dict:
    async with _pool.connection() as conn:
        cur = await conn.execute(
            "INSERT INTO cluster_notes (cluster_id, author_id, body) VALUES (%s, %s, %s) "
            "RETURNING id, cluster_id, author_id, body, created_at",
            (cluster_id, author_id, body),
        )
        r = await cur.fetchone()
        # yazar adını ekle (RETURNING JOIN yapamaz)
        acur = await conn.execute("SELECT name, email FROM users WHERE id = %s", (author_id,))
        a = await acur.fetchone()
    return _note_row((r[0], r[1], r[2], r[3], r[4], a[0] if a else None, a[1] if a else None))


async def get_note(note_id: int) -> dict | None:
    """Yetki kontrolü için minimal not (author_id + cluster_id)."""
    async with _pool.connection() as conn:
        cur = await conn.execute(
            "SELECT id, cluster_id, author_id FROM cluster_notes WHERE id = %s", (note_id,))
        r = await cur.fetchone()
    return {"id": r[0], "cluster_id": r[1], "author_id": r[2]} if r else None


async def update_note(note_id: int, body: str) -> dict:
    async with _pool.connection() as conn:
        cur = await conn.execute(
            "UPDATE cluster_notes SET body = %s WHERE id = %s "
            "RETURNING id, cluster_id, author_id, body, created_at",
            (body, note_id),
        )
        r = await cur.fetchone()
        acur = await conn.execute("SELECT name, email FROM users WHERE id = %s", (r[2],))
        a = await acur.fetchone()
    return _note_row((r[0], r[1], r[2], r[3], r[4], a[0] if a else None, a[1] if a else None))


async def delete_note(note_id: int) -> bool:
    async with _pool.connection() as conn:
        cur = await conn.execute("DELETE FROM cluster_notes WHERE id = %s RETURNING id", (note_id,))
        return await cur.fetchone() is not None


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
    async with _pool.connection() as conn:
        cur = await conn.execute(
            f"SELECT {_WEBHOOK_COLS} FROM webhooks WHERE project_id = %s ORDER BY created_at DESC",
            (project_id,),
        )
        rows = await cur.fetchall()
    return [_webhook_row(r) for r in rows]


async def create_webhook(project_id: int, name: str, token: str, source: str | None) -> dict:
    async with _pool.connection() as conn:
        cur = await conn.execute(
            f"INSERT INTO webhooks (project_id, name, token, source) VALUES (%s, %s, %s, %s) "
            f"RETURNING {_WEBHOOK_COLS}",
            (project_id, name, token, source),
        )
        r = await cur.fetchone()
    return _webhook_row(r)


async def delete_webhook(webhook_id: int) -> bool:
    async with _pool.connection() as conn:
        cur = await conn.execute("DELETE FROM webhooks WHERE id = %s RETURNING id", (webhook_id,))
        return await cur.fetchone() is not None


async def set_webhook_active(webhook_id: int, active: bool) -> dict | None:
    async with _pool.connection() as conn:
        cur = await conn.execute(
            f"UPDATE webhooks SET active = %s WHERE id = %s RETURNING {_WEBHOOK_COLS}",
            (active, webhook_id),
        )
        r = await cur.fetchone()
    return _webhook_row(r) if r else None


async def get_webhook_by_token(token: str) -> dict | None:
    async with _pool.connection() as conn:
        cur = await conn.execute(f"SELECT {_WEBHOOK_COLS} FROM webhooks WHERE token = %s", (token,))
        r = await cur.fetchone()
    return _webhook_row(r) if r else None


async def touch_webhook(webhook_id: int, n: int = 1) -> None:
    async with _pool.connection() as conn:
        await conn.execute(
            "UPDATE webhooks SET delivery_count = delivery_count + %s, last_used_at = now() WHERE id = %s",
            (n, webhook_id),
        )


async def get_settings() -> dict:
    """app_settings tablosundaki tüm anahtar/değerler (runtime override'lar)."""
    async with _pool.connection() as conn:
        cur = await conn.execute("SELECT key, value FROM app_settings")
        rows = await cur.fetchall()
    return {k: v for k, v in rows}


async def set_settings(items: dict) -> None:
    """Verilen anahtarları upsert eder. value None ise satırı siler (env fallback'e döner)."""
    async with _pool.connection() as conn:
        for k, v in items.items():
            if v is None:
                await conn.execute("DELETE FROM app_settings WHERE key = %s", (k,))
            else:
                await conn.execute(
                    "INSERT INTO app_settings (key, value, updated_at) VALUES (%s, %s, now()) "
                    "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
                    (k, v),
                )


async def set_cluster_source(cluster_id: int, snippet: str | None, url: str | None) -> None:
    """GitHub'dan çekilen kaynak snippet'i ve blob linkini kümeye yaz (önbellek)."""
    async with _pool.connection() as conn:
        await conn.execute(
            "UPDATE error_clusters SET source_snippet = %s, source_url = %s WHERE id = %s",
            (snippet, url, cluster_id),
        )


def _opinion_row(r) -> dict:
    return {"id": r[0], "cluster_id": r[1], "provider": r[2], "model": r[3],
            "title": r[4], "summary": r[5], "severity": r[6], "source": r[7], "origin": r[8],
            "created_at": r[9].isoformat() if r[9] else None}


_OPINION_COLS = "id, cluster_id, provider, model, title, summary, severity, source, origin, created_at"


async def list_opinions(cluster_id: int) -> list[dict]:
    async with _pool.connection() as conn:
        cur = await conn.execute(
            f"SELECT {_OPINION_COLS} FROM cluster_opinions WHERE cluster_id = %s ORDER BY created_at",
            (cluster_id,))
        return [_opinion_row(r) for r in await cur.fetchall()]


async def add_opinion(cluster_id: int, provider: str, llm: dict) -> dict:
    async with _pool.connection() as conn:
        cur = await conn.execute(
            "INSERT INTO cluster_opinions (cluster_id, provider, model, title, summary, severity, source, origin) "
            f"VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING {_OPINION_COLS}",
            (cluster_id, provider, llm.get("llm_model"), llm.get("title"), llm.get("summary"),
             llm.get("severity"), llm.get("source"), llm.get("origin")),
        )
        return _opinion_row(await cur.fetchone())


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
    async with _pool.connection() as conn:
        cur = await conn.execute(
            f"SELECT {_DS_COLS} FROM data_sources WHERE project_id = %s ORDER BY created_at",
            (project_id,))
        return [_ds_row(r) for r in await cur.fetchall()]


async def get_data_source(ds_id: int, with_creds=False) -> dict | None:
    async with _pool.connection() as conn:
        cur = await conn.execute(f"SELECT {_DS_COLS} FROM data_sources WHERE id = %s", (ds_id,))
        r = await cur.fetchone()
    return _ds_row(r, with_creds) if r else None


async def list_due_data_sources() -> list[dict]:
    """Aktif + interval'ı dolmuş (ya da hiç çalışmamış) veri kaynakları — kimlikleriyle."""
    async with _pool.connection() as conn:
        cur = await conn.execute(
            f"SELECT {_DS_COLS} FROM data_sources WHERE enabled = true AND "
            "(last_run_at IS NULL OR last_run_at < now() - make_interval(mins => interval_minutes))")
        return [_ds_row(r, with_creds=True) for r in await cur.fetchall()]


async def create_data_source(d: dict) -> dict:
    async with _pool.connection() as conn:
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
    async with _pool.connection() as conn:
        cur = await conn.execute(
            f"UPDATE data_sources SET enabled = %s WHERE id = %s RETURNING {_DS_COLS}",
            (enabled, ds_id))
        r = await cur.fetchone()
    return _ds_row(r) if r else None


async def delete_data_source(ds_id: int) -> bool:
    async with _pool.connection() as conn:
        cur = await conn.execute("DELETE FROM data_sources WHERE id = %s RETURNING id", (ds_id,))
        return await cur.fetchone() is not None


async def update_data_source_run(ds_id: int, status: str, error: str | None,
                                 count: int, watermark: str | None) -> None:
    async with _pool.connection() as conn:
        await conn.execute(
            "UPDATE data_sources SET last_run_at = now(), last_status = %s, last_error = %s, "
            "last_count = %s, watermark = COALESCE(%s, watermark) WHERE id = %s",
            (status, error, count, watermark, ds_id))


async def get_cluster_reinterpret_input(cluster_id: int) -> dict | None:
    """Yeniden LLM yorumu için gereken girdi: template + source_snippet."""
    async with _pool.connection() as conn:
        cur = await conn.execute(
            "SELECT template, source_snippet FROM error_clusters WHERE id = %s", (cluster_id,))
        r = await cur.fetchone()
    return {"template": r[0], "source_snippet": r[1]} if r else None


async def set_cluster_interpretation(cluster_id: int, llm: dict) -> dict | None:
    """LLM yorumunu (yeniden) uygula ve llm_ok=true yap."""
    async with _pool.connection() as conn:
        cur = await conn.execute(
            """UPDATE error_clusters
               SET title = %s, summary = %s, source = %s, origin = %s, severity = %s,
                   llm_ok = true, llm_model = %s
               WHERE id = %s RETURNING id""",
            (llm.get("title"), llm.get("summary"), llm.get("source"),
             llm.get("origin"), llm.get("severity"), llm.get("llm_model"), cluster_id),
        )
        if not await cur.fetchone():
            return None
    return await get_cluster(cluster_id)


async def list_occurrences(cluster_id: int, limit: int = 100) -> list[dict]:
    async with _pool.connection() as conn:
        cur = await conn.execute(
            """
            SELECT id, app_version, platform, raw_message, seen_at
            FROM error_occurrences WHERE cluster_id = %s
            ORDER BY seen_at DESC LIMIT %s
            """,
            (cluster_id, limit),
        )
        rows = await cur.fetchall()
    return [
        {"id": r[0], "app_version": r[1], "platform": r[2],
         "raw_message": r[3], "seen_at": r[4].isoformat() if r[4] else None}
        for r in rows
    ]


async def stats(project_id: int) -> dict:
    async with _pool.connection() as conn:
        cur = await conn.execute(
            """
            SELECT
                COUNT(*)                                  AS clusters,
                COALESCE(SUM(occurrence_count), 0)        AS occurrences,
                COUNT(*) FILTER (WHERE severity = 'critical') AS critical,
                COUNT(*) FILTER (WHERE severity = 'high')     AS high,
                COUNT(*) FILTER (WHERE status = 'open')       AS open,
                COUNT(*) FILTER (WHERE status = 'resolved')   AS resolved
            FROM error_clusters
            WHERE project_id = %s
            """,
            (project_id,),
        )
        row = await cur.fetchone()
    return {"clusters": row[0], "occurrences": int(row[1]),
            "critical": row[2], "high": row[3], "open": row[4], "resolved": row[5]}


# ---------- Grafik / trend sorguları ----------

async def timeseries(project_id: int, days: int = 14) -> list[dict]:
    """Son N gün için günlük olay sayısı (grafik). Olaylar kümesinin projesine göre."""
    async with _pool.connection() as conn:
        cur = await conn.execute(
            """
            SELECT d::date AS day, COALESCE(cnt, 0) AS count
            FROM generate_series(
                     (now() - make_interval(days => %s))::date, now()::date, '1 day'
                 ) AS d
            LEFT JOIN (
                SELECT date_trunc('day', o.seen_at)::date AS day, COUNT(*) AS cnt
                FROM error_occurrences o
                JOIN error_clusters c ON c.id = o.cluster_id
                WHERE o.seen_at >= (now() - make_interval(days => %s)) AND c.project_id = %s
                GROUP BY 1
            ) o ON o.day = d::date
            ORDER BY day
            """,
            (days, days, project_id),
        )
        rows = await cur.fetchall()
    return [{"day": r[0].isoformat(), "count": int(r[1])} for r in rows]


async def breakdown(project_id: int) -> dict:
    """Severity, origin ve status kırılımları (pasta/bar grafikleri). Proje bazında."""
    async with _pool.connection() as conn:
        async def group(col):
            cur = await conn.execute(
                f"SELECT {col}, COUNT(*) FROM error_clusters WHERE project_id = %s "
                f"GROUP BY {col} ORDER BY 2 DESC",
                (project_id,),
            )
            return [{"key": r[0], "count": r[1]} for r in await cur.fetchall()]
        return {
            "severity": await group("severity"),
            "origin": await group("origin"),
            "status": await group("status"),
        }


# ---------- Kullanıcılar (auth) ----------

def _user_row(row) -> dict:
    return {"id": row[0], "email": row[1], "name": row[2], "role": row[3],
            "created_at": row[4].isoformat() if row[4] else None,
            "presence": row[5], "avatar": row[6]}


async def count_users() -> int:
    async with _pool.connection() as conn:
        cur = await conn.execute("SELECT COUNT(*) FROM users")
        return (await cur.fetchone())[0]


async def create_refresh_token(user_id: int, token_hash: str, expires_at) -> None:
    async with _pool.connection() as conn:
        await conn.execute(
            "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (%s, %s, %s)",
            (user_id, token_hash, expires_at))


async def get_refresh_user_id(token_hash: str) -> int | None:
    """Geçerli (süresi dolmamış) refresh token'ın kullanıcısı."""
    async with _pool.connection() as conn:
        cur = await conn.execute(
            "SELECT user_id FROM refresh_tokens WHERE token_hash = %s AND expires_at > now()",
            (token_hash,))
        r = await cur.fetchone()
    return r[0] if r else None


async def delete_refresh_token(token_hash: str) -> None:
    async with _pool.connection() as conn:
        await conn.execute("DELETE FROM refresh_tokens WHERE token_hash = %s", (token_hash,))


async def create_mcp_token(user_id: int, token_hash: str, name: str | None) -> dict:
    async with _pool.connection() as conn:
        cur = await conn.execute(
            """INSERT INTO mcp_tokens (user_id, token_hash, name)
               VALUES (%s, %s, %s) RETURNING id, name, created_at, last_used_at""",
            (user_id, token_hash, name))
        row = await cur.fetchone()
    return {"id": row[0], "name": row[1],
            "created_at": row[2].isoformat() if row[2] else None,
            "last_used_at": row[3].isoformat() if row[3] else None}


async def list_mcp_tokens(user_id: int) -> list[dict]:
    async with _pool.connection() as conn:
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
    async with _pool.connection() as conn:
        cur = await conn.execute(
            "UPDATE mcp_tokens SET last_used_at = now() WHERE token_hash = %s RETURNING user_id",
            (token_hash,))
        r = await cur.fetchone()
    return r[0] if r else None


async def revoke_mcp_token(user_id: int, token_id: int) -> bool:
    """Yalnızca sahibi iptal edebilir."""
    async with _pool.connection() as conn:
        cur = await conn.execute(
            "DELETE FROM mcp_tokens WHERE id = %s AND user_id = %s", (token_id, user_id))
        return cur.rowcount > 0


async def create_user(email: str, name: str | None, password_hash: str, role: str) -> dict:
    async with _pool.connection() as conn:
        cur = await conn.execute(
            """INSERT INTO users (email, name, password_hash, role)
               VALUES (%s, %s, %s, %s)
               RETURNING id, email, name, role, created_at, presence, avatar""",
            (email, name, password_hash, role),
        )
        return _user_row(await cur.fetchone())


async def get_user_by_email(email: str) -> dict | None:
    """Şifre doğrulaması için password_hash DAHİL döner (sadece iç kullanım)."""
    async with _pool.connection() as conn:
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
    async with _pool.connection() as conn:
        cur = await conn.execute(
            "SELECT id, email, name, role, created_at, presence, avatar FROM users WHERE id = %s",
            (user_id,),
        )
        row = await cur.fetchone()
    return _user_row(row) if row else None


async def list_users() -> list[dict]:
    async with _pool.connection() as conn:
        cur = await conn.execute(
            "SELECT id, email, name, role, created_at, presence, avatar FROM users ORDER BY created_at"
        )
        return [_user_row(r) for r in await cur.fetchall()]


async def update_user_role(user_id: int, role: str) -> dict | None:
    async with _pool.connection() as conn:
        cur = await conn.execute(
            "UPDATE users SET role = %s WHERE id = %s RETURNING id, email, name, role, created_at, presence, avatar",
            (role, user_id),
        )
        row = await cur.fetchone()
    return _user_row(row) if row else None


async def delete_user(user_id: int) -> bool:
    async with _pool.connection() as conn:
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
        async with _pool.connection() as conn:
            await conn.execute(f"UPDATE users SET {', '.join(sets)} WHERE id = %s", tuple(params))
    return await get_user_by_id(user_id)


# ---------- Repolar (GitHub entegrasyonu) ----------

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
    async with _pool.connection() as conn:
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
    async with _pool.connection() as conn:
        cur = await conn.execute(
            "SELECT id, provider, full_name, default_branch, token, path_prefix, created_at "
            "FROM repos WHERE project_id = %s ORDER BY created_at",
            (project_id,),
        )
        return [_repo_row(r, include_token) for r in await cur.fetchall()]


async def delete_repo(repo_id: int) -> bool:
    async with _pool.connection() as conn:
        cur = await conn.execute("DELETE FROM repos WHERE id = %s RETURNING id", (repo_id,))
        return (await cur.fetchone()) is not None


# ---------- Projeler + üyeler ----------

def _project_row(r) -> dict:
    return {"id": r[0], "name": r[1], "key": r[2],
            "created_at": r[3].isoformat() if r[3] else None, "member_count": r[4]}


async def list_projects() -> list[dict]:
    async with _pool.connection() as conn:
        cur = await conn.execute(
            """SELECT p.id, p.name, p.key, p.created_at, COUNT(m.user_id) AS members
               FROM projects p LEFT JOIN project_members m ON m.project_id = p.id
               GROUP BY p.id ORDER BY p.created_at"""
        )
        return [_project_row(r) for r in await cur.fetchall()]


async def create_project(name: str, key: str) -> dict:
    async with _pool.connection() as conn:
        cur = await conn.execute(
            "INSERT INTO projects (name, key) VALUES (%s, %s) "
            "RETURNING id, name, key, created_at, 0",
            (name, key),
        )
        return _project_row(await cur.fetchone())


async def default_project_id() -> int | None:
    """Token'sız /ingest için düşen proje: en eski (ilk) proje."""
    async with _pool.connection() as conn:
        cur = await conn.execute("SELECT id FROM projects ORDER BY id LIMIT 1")
        row = await cur.fetchone()
    return row[0] if row else None


async def project_exists(project_id: int) -> bool:
    async with _pool.connection() as conn:
        cur = await conn.execute("SELECT 1 FROM projects WHERE id = %s", (project_id,))
        return await cur.fetchone() is not None


async def delete_project(project_id: int) -> bool:
    async with _pool.connection() as conn:
        cur = await conn.execute("DELETE FROM projects WHERE id = %s RETURNING id", (project_id,))
        return await cur.fetchone() is not None


async def list_project_members(project_id: int) -> list[dict]:
    async with _pool.connection() as conn:
        cur = await conn.execute(
            """SELECT u.id, u.email, u.name, u.role, u.created_at, u.presence, u.avatar
               FROM project_members m JOIN users u ON u.id = m.user_id
               WHERE m.project_id = %s ORDER BY u.name NULLS LAST, u.email""",
            (project_id,),
        )
        return [_user_row(r) for r in await cur.fetchall()]


async def add_project_member(project_id: int, user_id: int) -> None:
    async with _pool.connection() as conn:
        await conn.execute(
            "INSERT INTO project_members (project_id, user_id) VALUES (%s, %s) "
            "ON CONFLICT DO NOTHING",
            (project_id, user_id),
        )


async def remove_project_member(project_id: int, user_id: int) -> bool:
    async with _pool.connection() as conn:
        cur = await conn.execute(
            "DELETE FROM project_members WHERE project_id = %s AND user_id = %s RETURNING user_id",
            (project_id, user_id),
        )
        return await cur.fetchone() is not None


async def project_member_ids(project_id: int) -> list[int]:
    async with _pool.connection() as conn:
        cur = await conn.execute(
            "SELECT user_id FROM project_members WHERE project_id = %s", (project_id,))
        return [r[0] for r in await cur.fetchall()]


# ---------- Bildirimler ----------

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
    async with _pool.connection() as conn:
        for uid in user_ids:
            await conn.execute(
                "INSERT INTO notifications (user_id, type, title, body, cluster_id, project_id) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (uid, type, title, body, cluster_id, project_id),
            )


async def list_notifications(user_id: int, limit: int = 50) -> dict:
    async with _pool.connection() as conn:
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
    async with _pool.connection() as conn:
        cur = await conn.execute(
            "UPDATE notifications SET is_read = true WHERE id = %s AND user_id = %s RETURNING id",
            (notification_id, user_id),
        )
        return await cur.fetchone() is not None


async def mark_all_notifications_read(user_id: int) -> int:
    async with _pool.connection() as conn:
        cur = await conn.execute(
            "UPDATE notifications SET is_read = true WHERE user_id = %s AND is_read = false RETURNING id",
            (user_id,),
        )
        return len(await cur.fetchall())


# ---------- Presence + ekip sohbeti ----------

async def set_presence(user_id: int, presence: str) -> None:
    async with _pool.connection() as conn:
        await conn.execute("UPDATE users SET presence = %s WHERE id = %s", (presence, user_id))


async def list_team(user_id: int) -> list[dict]:
    """Tüm kullanıcılar + presence (ekip paneli). Kişinin kendisi 'me' bayrağıyla."""
    async with _pool.connection() as conn:
        cur = await conn.execute(
            "SELECT id, email, name, role, created_at, presence, avatar FROM users ORDER BY name NULLS LAST, email")
        return [{**_user_row(r), "me": r[0] == user_id} for r in await cur.fetchall()]


def _message_row(r) -> dict:
    return {"id": r[0], "user_id": r[1], "body": r[2],
            "created_at": r[3].isoformat() if r[3] else None,
            "author_name": r[4], "author_email": r[5]}


async def list_messages(after_id: int = 0, limit: int = 100) -> list[dict]:
    async with _pool.connection() as conn:
        cur = await conn.execute(
            "SELECT m.id, m.user_id, m.body, m.created_at, u.name, u.email "
            "FROM messages m LEFT JOIN users u ON u.id = m.user_id "
            "WHERE m.id > %s ORDER BY m.id DESC LIMIT %s",
            (after_id, limit),
        )
        rows = await cur.fetchall()
    return [_message_row(r) for r in reversed(rows)]


async def add_message(user_id: int, body: str) -> dict:
    async with _pool.connection() as conn:
        cur = await conn.execute(
            "INSERT INTO messages (user_id, body) VALUES (%s, %s) "
            "RETURNING id, user_id, body, created_at",
            (user_id, body),
        )
        r = await cur.fetchone()
        acur = await conn.execute("SELECT name, email FROM users WHERE id = %s", (user_id,))
        a = await acur.fetchone()
    return _message_row((r[0], r[1], r[2], r[3], a[0] if a else None, a[1] if a else None))