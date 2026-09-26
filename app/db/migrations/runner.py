"""
Hafif migration sistemi — SQLAlchemy/Alembic yok, ek bağımlılık yok.

migrations/NNNN_isim.sql dosyaları sırayla, her biri bir transaction içinde uygulanır ve
schema_migrations tablosuna kaydedilir. Zaten uygulanmışsa atlanır. main.py'nin lifespan'inde
db.open_pool()'dan ÖNCE çağrılır: 0001_initial.sql "CREATE EXTENSION vector" içerir, ama
app.db.session'ın pool'u her bağlantıda pgvector tipini register etmeye çalışır (configure
callback) — extension henüz yokken bu patlar. Bu yüzden runner kendi HAM (pool dışı, configure
callback'siz) bağlantısını kullanır; pool ancak migration'lar bittikten, extension var olduktan
sonra güvenle açılır.

Yeni şema değişikliği eklerken: bu klasöre yeni bir NNNN_isim.sql dosyası ekle (var olanları
ASLA değiştirme), CREATE/ALTER ifadelerini IF NOT EXISTS ile idempotent yaz.
"""
import logging
from pathlib import Path

import psycopg

from app.core.config import settings

logger = logging.getLogger("loglens.migrations")
_MIGRATIONS_DIR = Path(__file__).parent


async def run_migrations() -> None:
    async with await psycopg.AsyncConnection.connect(settings.db_dsn, autocommit=True) as conn:
        await conn.execute(
            """CREATE TABLE IF NOT EXISTS schema_migrations (
                version    INTEGER PRIMARY KEY,
                name       TEXT NOT NULL,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )"""
        )
        cur = await conn.execute("SELECT version FROM schema_migrations")
        applied = {row[0] for row in await cur.fetchall()}

        pending = sorted(
            (p for p in _MIGRATIONS_DIR.glob("*.sql") if int(p.stem.split("_", 1)[0]) not in applied),
            key=lambda p: int(p.stem.split("_", 1)[0]),
        )
        for path in pending:
            version = int(path.stem.split("_", 1)[0])
            sql = path.read_text()
            logger.info("Migration uygulanıyor: %s", path.stem)
            try:
                async with conn.transaction():
                    await conn.execute(sql)
                    await conn.execute(
                        "INSERT INTO schema_migrations (version, name) VALUES (%s, %s)",
                        (version, path.stem),
                    )
            except Exception:
                logger.exception("Migration BAŞARISIZ: %s — uygulama başlatılmıyor.", path.stem)
                raise
            logger.info("Migration tamam: %s", path.stem)
