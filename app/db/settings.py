"""Runtime ayar override'ları (app_settings tablosu) — anahtar/değer deposu."""
from app.db.session import pool


async def get_settings() -> dict:
    """app_settings tablosundaki tüm anahtar/değerler (runtime override'lar)."""
    async with pool().connection() as conn:
        cur = await conn.execute("SELECT key, value FROM app_settings")
        rows = await cur.fetchall()
    return {k: v for k, v in rows}


async def set_settings(items: dict) -> None:
    """Verilen anahtarları upsert eder. value None ise satırı siler (env fallback'e döner)."""
    async with pool().connection() as conn:
        for k, v in items.items():
            if v is None:
                await conn.execute("DELETE FROM app_settings WHERE key = %s", (k,))
            else:
                await conn.execute(
                    "INSERT INTO app_settings (key, value, updated_at) VALUES (%s, %s, now()) "
                    "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
                    (k, v),
                )
