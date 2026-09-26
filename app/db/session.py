"""Postgres bağlantı havuzu (psycopg3 async pool) + pgvector kaydı."""
from psycopg_pool import AsyncConnectionPool
from pgvector.psycopg import register_vector_async

from app.core.config import settings

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


def pool() -> AsyncConnectionPool:
    """Diğer app.db.* modülleri bağlantı almak için bunu çağırır."""
    assert _pool is not None, "db.open_pool() henüz çağrılmadı"
    return _pool
