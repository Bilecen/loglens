"""Hata kümeleri: fingerprint/vektör arama, CRUD, notlar, ikinci görüşler, istatistikler."""
from pgvector import Vector

from app.db.session import pool


# --- 1. Katman: fingerprint ile kesin eşleşme (ucuz) ---
async def find_by_fingerprint(project_id: int, fp: str) -> dict | None:
    async with pool().connection() as conn:
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
    async with pool().connection() as conn:
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
    async with pool().connection() as conn:
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
    async with pool().connection() as conn:
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
    async with pool().connection() as conn:
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
    async with pool().connection() as conn:
        cur = await conn.execute(
            f"SELECT COUNT(*) {_CLUSTER_FROM} {clause}", tuple(params),
        )
        row = await cur.fetchone()
    return row[0] if row else 0


async def get_cluster(cluster_id: int) -> dict | None:
    async with pool().connection() as conn:
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
    async with pool().connection() as conn:
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
    async with pool().connection() as conn:
        cur = await conn.execute(
            "SELECT n.id, n.cluster_id, n.author_id, n.body, n.created_at, u.name, u.email "
            "FROM cluster_notes n LEFT JOIN users u ON u.id = n.author_id "
            "WHERE n.cluster_id = %s ORDER BY n.created_at ASC",
            (cluster_id,),
        )
        rows = await cur.fetchall()
    return [_note_row(r) for r in rows]


async def add_note(cluster_id: int, author_id: int, body: str) -> dict:
    async with pool().connection() as conn:
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
    async with pool().connection() as conn:
        cur = await conn.execute(
            "SELECT id, cluster_id, author_id FROM cluster_notes WHERE id = %s", (note_id,))
        r = await cur.fetchone()
    return {"id": r[0], "cluster_id": r[1], "author_id": r[2]} if r else None


async def update_note(note_id: int, body: str) -> dict:
    async with pool().connection() as conn:
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
    async with pool().connection() as conn:
        cur = await conn.execute("DELETE FROM cluster_notes WHERE id = %s RETURNING id", (note_id,))
        return await cur.fetchone() is not None


def _opinion_row(r) -> dict:
    return {"id": r[0], "cluster_id": r[1], "provider": r[2], "model": r[3],
            "title": r[4], "summary": r[5], "severity": r[6], "source": r[7], "origin": r[8],
            "created_at": r[9].isoformat() if r[9] else None}


_OPINION_COLS = "id, cluster_id, provider, model, title, summary, severity, source, origin, created_at"


async def list_opinions(cluster_id: int) -> list[dict]:
    async with pool().connection() as conn:
        cur = await conn.execute(
            f"SELECT {_OPINION_COLS} FROM cluster_opinions WHERE cluster_id = %s ORDER BY created_at",
            (cluster_id,))
        return [_opinion_row(r) for r in await cur.fetchall()]


async def add_opinion(cluster_id: int, provider: str, llm: dict) -> dict:
    async with pool().connection() as conn:
        cur = await conn.execute(
            "INSERT INTO cluster_opinions (cluster_id, provider, model, title, summary, severity, source, origin) "
            f"VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING {_OPINION_COLS}",
            (cluster_id, provider, llm.get("llm_model"), llm.get("title"), llm.get("summary"),
             llm.get("severity"), llm.get("source"), llm.get("origin")),
        )
        return _opinion_row(await cur.fetchone())


async def set_cluster_source(cluster_id: int, snippet: str | None, url: str | None) -> None:
    """GitHub'dan çekilen kaynak snippet'i ve blob linkini kümeye yaz (önbellek)."""
    async with pool().connection() as conn:
        await conn.execute(
            "UPDATE error_clusters SET source_snippet = %s, source_url = %s WHERE id = %s",
            (snippet, url, cluster_id),
        )


async def get_cluster_reinterpret_input(cluster_id: int) -> dict | None:
    """Yeniden LLM yorumu için gereken girdi: template + source_snippet."""
    async with pool().connection() as conn:
        cur = await conn.execute(
            "SELECT template, source_snippet FROM error_clusters WHERE id = %s", (cluster_id,))
        r = await cur.fetchone()
    return {"template": r[0], "source_snippet": r[1]} if r else None


async def set_cluster_interpretation(cluster_id: int, llm: dict) -> dict | None:
    """LLM yorumunu (yeniden) uygula ve llm_ok=true yap."""
    async with pool().connection() as conn:
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
    async with pool().connection() as conn:
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
    async with pool().connection() as conn:
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
    async with pool().connection() as conn:
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
    async with pool().connection() as conn:
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
