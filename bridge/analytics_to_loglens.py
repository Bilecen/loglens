"""
Firebase Analytics (GA4) -> LogLens köprüsü.

GA4 de BigQuery'ye export eder (Firebase/GA4 Console > BigQuery linki). Bu script
GA4 export tablolarını (`analytics_<id>.events_*`) artımlı (watermark'lı) sorgular,
ADINDA hata deseni geçen event'leri (error/exception/fail — ayarlanabilir) çeker,
param'larından mesaj/tip/stack çıkarıp LogLens'in /ingest/batch endpoint'ine POST eder.

Neden sadece "özel hata event'leri":
  Analytics HER kullanıcı event'ini toplar (ekran, tıklama...). Bunların çoğu hata
  değil. Bu yüzden yalnızca event ADI EVENT_PATTERN'e uyanları alırız — tipik olarak
  geliştiricinin logEvent("api_error", {message, code, ...}) ile logladığı non-fatal
  hatalar (Crashlytics'te OLMAYAN sinyaller).

Çalıştırma:
  pip install google-cloud-bigquery httpx
  export GOOGLE_APPLICATION_CREDENTIALS=/path/service-account.json
  export BQ_PROJECT=my-gcp-project
  export GA_DATASET=analytics_123456789          # GA4 export dataset'i
  export LOGLENS_URL=http://localhost:8000
  export LOGLENS_PROJECT_ID=2                     # hangi LogLens projesine yazılsın
  # opsiyonel:
  export EVENT_PATTERN='(?i)(error|exception|fail)'   # event adı filtresi (regex)
  export LOOKBACK_DAYS=3                          # taranacak gün-shard aralığı
  python bridge/analytics_to_loglens.py

Cron / Cloud Scheduler ile periyodik (ör. 5 dk) çalıştır. Watermark dosyası
sayesinde her koşuda sadece YENİ event'ler işlenir.
"""
import json
import os
import pathlib
import sys

import httpx
from google.cloud import bigquery

BQ_PROJECT = os.environ["BQ_PROJECT"]
GA_DATASET = os.environ["GA_DATASET"]                 # analytics_<propertyId>
LOGLENS_URL = os.environ.get("LOGLENS_URL", "http://localhost:8000").rstrip("/")
LOGLENS_PROJECT_ID = os.environ.get("LOGLENS_PROJECT_ID")  # None ise varsayılan projeye düşer
EVENT_PATTERN = os.environ.get("EVENT_PATTERN", r"(?i)(error|exception|fail)")
LOOKBACK_DAYS = int(os.environ.get("LOOKBACK_DAYS", "3"))
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "500"))
WATERMARK_FILE = pathlib.Path(os.environ.get("WATERMARK_FILE", ".analytics_watermark"))

# GA4 event_timestamp = epoch MİKROSANİYE (INT64). Watermark bu değeri saklar.
DEFAULT_SINCE_MICROS = "UNIX_MICROS(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR))"


def read_watermark() -> str | None:
    if WATERMARK_FILE.exists():
        return WATERMARK_FILE.read_text().strip() or None
    return None


def write_watermark(micros: int) -> None:
    WATERMARK_FILE.write_text(str(micros))


def fetch_new_events(client: bigquery.Client, since: str | None) -> tuple[list[dict], int | None]:
    """GA4 export şemasından LogIn alanlarına eşler. Param anahtarları uygulamana
    göre değişebilir — kendi event'lerinle doğrula (message/code/stack anahtarları)."""
    since_expr = "@since" if since else DEFAULT_SINCE_MICROS
    query = f"""
    SELECT
      event_timestamp,
      event_name,
      (SELECT ep.value.string_value FROM UNNEST(event_params) ep
        WHERE ep.key IN ('message','error_message','description','msg') LIMIT 1) AS message,
      (SELECT COALESCE(ep.value.string_value, CAST(ep.value.int_value AS STRING)) FROM UNNEST(event_params) ep
        WHERE ep.key IN ('error_type','type','code','error_code') LIMIT 1) AS error_type,
      (SELECT ep.value.string_value FROM UNNEST(event_params) ep
        WHERE ep.key IN ('stack_trace','stack','exception') LIMIT 1) AS stack_trace,
      app_info.version AS app_version,
      platform
    FROM `{BQ_PROJECT}.{GA_DATASET}.events_*`
    WHERE _TABLE_SUFFIX >= FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY))
      AND REGEXP_CONTAINS(event_name, @pattern)
      AND event_timestamp > {since_expr}
    ORDER BY event_timestamp
    LIMIT {BATCH_SIZE}
    """
    params = [
        bigquery.ScalarQueryParameter("pattern", "STRING", EVENT_PATTERN),
        bigquery.ScalarQueryParameter("days", "INT64", LOOKBACK_DAYS),
    ]
    if since:
        params.append(bigquery.ScalarQueryParameter("since", "INT64", int(since)))
    job = client.query(query, job_config=bigquery.QueryJobConfig(query_parameters=params))

    logs, last_micros = [], int(since) if since else None
    for row in job:
        logs.append({
            "message": row["message"] or row["event_name"],
            "error_type": row["error_type"] or row["event_name"],
            "stack_trace": row["stack_trace"],
            "app_version": row["app_version"],
            "platform": (row["platform"] or "").lower() or None,
            "source": "analytics",
        })
        last_micros = row["event_timestamp"]
    return logs, last_micros


def post_batch(logs: list[dict]) -> dict:
    url = f"{LOGLENS_URL}/ingest/batch"
    params = {"project_id": LOGLENS_PROJECT_ID} if LOGLENS_PROJECT_ID else None
    with httpx.Client(timeout=300) as client:
        r = client.post(url, params=params, json=logs)
        r.raise_for_status()
        return r.json()


def main() -> int:
    client = bigquery.Client(project=BQ_PROJECT)
    since = read_watermark()
    logs, last_micros = fetch_new_events(client, since)

    if not logs:
        print("Yeni hata event'i yok.")
        return 0

    result = post_batch(logs)
    summary = {}
    for r in result.get("results", []):
        summary[r["status"]] = summary.get(r["status"], 0) + 1
    print(f"{len(logs)} analytics event işlendi -> {json.dumps(summary)}")

    if last_micros:
        write_watermark(last_micros)
    return 0


if __name__ == "__main__":
    sys.exit(main())
