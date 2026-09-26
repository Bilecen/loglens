"""
Otomatik veri kaynakları: backend, kayıtlı Firebase (BigQuery) kaynaklarını
zamanlanmış görevle sorgular ve yeni hataları process_log'a besler.

- Kimlik: her kaynağın service account JSON'u ile (google-cloud-bigquery lazy import).
- Watermark: her koşuda yalnızca YENİ satırlar işlenir.
- BigQuery çağrıları bloklar → asyncio.to_thread ile ayrı thread'de çalışır.
"""
import asyncio
import json

from app.db import datasources as db_datasources
from app.schemas.cluster import LogIn
from app.services import ingest

BATCH_SIZE = 500
DEFAULT_LOOKBACK_DAYS = 3   # analytics tablo-shard taraması


def _bq_client(ds: dict):
    """google-cloud-bigquery lazy import + service account'tan client."""
    from google.cloud import bigquery
    from google.oauth2 import service_account
    creds = None
    if ds.get("credentials_json"):
        creds = service_account.Credentials.from_service_account_info(json.loads(ds["credentials_json"]))
    return bigquery.Client(project=ds["bq_project"], credentials=creds)


def _fetch_crashlytics(ds: dict) -> tuple[list[dict], str | None]:
    from google.cloud import bigquery
    client = _bq_client(ds)
    since = ds.get("watermark")
    since_expr = "@since" if since else "TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)"
    query = f"""
    SELECT
      FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%E6SZ', event_timestamp) AS event_ts,
      (SELECT e.type FROM UNNEST(exceptions) e LIMIT 1) AS error_type,
      COALESCE((SELECT e.exception_message FROM UNNEST(exceptions) e LIMIT 1), issue_title) AS message,
      (SELECT STRING_AGG(FORMAT('%s (%s:%d)', IFNULL(f.symbol,''), IFNULL(f.file,''), IFNULL(f.line,0)),
                         '\\n' ORDER BY f.offset)
       FROM UNNEST(exceptions) e, UNNEST(e.frames) f) AS stack_trace,
      application.display_version AS app_version,
      operating_system.display_name AS platform
    FROM `{ds['bq_project']}.{ds['bq_table']}`
    WHERE event_timestamp > {since_expr}
    ORDER BY event_timestamp LIMIT {BATCH_SIZE}
    """
    params = [bigquery.ScalarQueryParameter("since", "TIMESTAMP", since)] if since else []
    job = client.query(query, job_config=bigquery.QueryJobConfig(query_parameters=params))
    logs, last = [], since
    for row in job:
        logs.append({"message": row["message"] or "(mesaj yok)", "error_type": row["error_type"],
                     "stack_trace": row["stack_trace"], "app_version": row["app_version"],
                     "platform": (row["platform"] or "").lower() or None, "source": "firebase"})
        last = row["event_ts"]
    return logs, last


def _fetch_analytics(ds: dict) -> tuple[list[dict], str | None]:
    from google.cloud import bigquery
    client = _bq_client(ds)
    since = ds.get("watermark")
    pattern = ds.get("event_pattern") or r"(?i)(error|exception|fail)"
    since_expr = "@since" if since else "UNIX_MICROS(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR))"
    query = f"""
    SELECT event_timestamp, event_name,
      (SELECT ep.value.string_value FROM UNNEST(event_params) ep
        WHERE ep.key IN ('message','error_message','description','msg') LIMIT 1) AS message,
      (SELECT COALESCE(ep.value.string_value, CAST(ep.value.int_value AS STRING)) FROM UNNEST(event_params) ep
        WHERE ep.key IN ('error_type','type','code','error_code') LIMIT 1) AS error_type,
      (SELECT ep.value.string_value FROM UNNEST(event_params) ep
        WHERE ep.key IN ('stack_trace','stack','exception') LIMIT 1) AS stack_trace,
      app_info.version AS app_version, platform
    FROM `{ds['bq_project']}.{ds['ga_dataset']}.events_*`
    WHERE _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY))
      AND REGEXP_CONTAINS(event_name, @pattern)
      AND event_timestamp > {since_expr}
    ORDER BY event_timestamp LIMIT {BATCH_SIZE}
    """
    params = [bigquery.ScalarQueryParameter("pattern", "STRING", pattern),
              bigquery.ScalarQueryParameter("days", "INT64", DEFAULT_LOOKBACK_DAYS)]
    if since:
        params.append(bigquery.ScalarQueryParameter("since", "INT64", int(since)))
    job = client.query(query, job_config=bigquery.QueryJobConfig(query_parameters=params))
    logs, last = [], since
    for row in job:
        logs.append({"message": row["message"] or row["event_name"],
                     "error_type": row["error_type"] or row["event_name"],
                     "stack_trace": row["stack_trace"], "app_version": row["app_version"],
                     "platform": (row["platform"] or "").lower() or None, "source": "analytics"})
        last = str(row["event_timestamp"])
    return logs, last


def _fetch(ds: dict) -> tuple[list[dict], str | None]:
    if ds["type"] == "crashlytics":
        return _fetch_crashlytics(ds)
    return _fetch_analytics(ds)


async def run_source(ds: dict) -> dict:
    """Bir veri kaynağını çalıştır: BQ'dan çek → process_log → durum/watermark güncelle."""
    try:
        logs, new_watermark = await asyncio.to_thread(_fetch, ds)
        for item in logs:
            await ingest.process_log(ds["project_id"], LogIn(**item))
        await db_datasources.update_data_source_run(ds["id"], "ok", None, len(logs), new_watermark)
        return {"ok": True, "count": len(logs)}
    except Exception as e:
        await db_datasources.update_data_source_run(ds["id"], "error", f"{type(e).__name__}: {e}"[:500], 0, None)
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}


async def scheduler_loop():
    """Her 60sn'de bir vadesi gelen kaynakları çalıştırır (lifespan'de başlatılır)."""
    while True:
        try:
            for ds in await db_datasources.list_due_data_sources():
                await run_source(ds)
        except Exception:
            pass  # scheduler asla çökmesin
        await asyncio.sleep(60)
