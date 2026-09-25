"""
Crashlytics -> LogLens köprüsü.

Crashlytics'in canlı REST API'si YOKTUR. Standart yol: Crashlytics'i BigQuery'ye
export et (Firebase Console > Integrations > BigQuery), sonra bu script BQ'yu
artımlı (watermark'lı) sorgulayıp LogLens'in /ingest/batch endpoint'ine POST eder.

Neden ham mesaj/stack besliyoruz (issue_id değil):
  Crashlytics stack imzasına göre gruplar. LogLens embedding ile ANLAMSAL gruplar
  (aynı kök nedene sahip farklı issue'ları birleştirebilir) + LLM yorumu üretir.

Çalıştırma:
  pip install google-cloud-bigquery httpx
  export GOOGLE_APPLICATION_CREDENTIALS=/path/service-account.json
  export BQ_PROJECT=my-gcp-project
  export BQ_TABLE=firebase_crashlytics.com_example_app_ANDROID
  export LOGLENS_URL=http://localhost:8000
  export LOGLENS_PROJECT_ID=1        # hangi LogLens projesine yazılsın (boşsa varsayılan)
  python bridge/crashlytics_to_loglens.py

Cron / Cloud Scheduler ile periyodik (ör. 5 dk) çalıştır. Watermark dosyası
sayesinde her koşuda sadece YENİ crash'ler işlenir.
"""
import json
import os
import pathlib
import sys

import httpx
from google.cloud import bigquery

BQ_PROJECT = os.environ["BQ_PROJECT"]
BQ_TABLE = os.environ["BQ_TABLE"]            # dataset.table
LOGLENS_URL = os.environ.get("LOGLENS_URL", "http://localhost:8000").rstrip("/")
LOGLENS_PROJECT_ID = os.environ.get("LOGLENS_PROJECT_ID")  # None ise varsayılan projeye düşer
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "500"))
WATERMARK_FILE = pathlib.Path(os.environ.get("WATERMARK_FILE", ".crashlytics_watermark"))

# Son işlenen event_timestamp burada saklanır (ISO). İlk koşuda son 24 saat.
DEFAULT_SINCE = "TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)"


def read_watermark() -> str | None:
    if WATERMARK_FILE.exists():
        return WATERMARK_FILE.read_text().strip() or None
    return None


def write_watermark(iso_ts: str) -> None:
    WATERMARK_FILE.write_text(iso_ts)


def fetch_new_crashes(client: bigquery.Client, since: str | None) -> list[dict]:
    """
    Crashlytics BQ export şemasından LogIn alanlarına eşleştirir.
    NOT: kolon adları export sürümüne göre az değişebilir; kendi tablonla doğrula.
    """
    since_expr = "@since" if since else DEFAULT_SINCE
    query = f"""
    SELECT
      event_id,
      FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%E6SZ', event_timestamp) AS event_ts,
      (SELECT e.type FROM UNNEST(exceptions) e LIMIT 1) AS error_type,
      COALESCE(
        (SELECT e.exception_message FROM UNNEST(exceptions) e LIMIT 1),
        issue_title
      ) AS message,
      (
        SELECT STRING_AGG(
          FORMAT('%s (%s:%d)',
                 IFNULL(f.symbol, ''), IFNULL(f.file, ''), IFNULL(f.line, 0)),
          '\\n' ORDER BY f.offset
        )
        FROM UNNEST(exceptions) e, UNNEST(e.frames) f
      ) AS stack_trace,
      application.display_version AS app_version,
      operating_system.display_name AS platform
    FROM `{BQ_PROJECT}.{BQ_TABLE}`
    WHERE event_timestamp > {since_expr if since else DEFAULT_SINCE}
    ORDER BY event_timestamp
    LIMIT {BATCH_SIZE}
    """
    params = []
    if since:
        params.append(bigquery.ScalarQueryParameter("since", "TIMESTAMP", since))
    job = client.query(query, job_config=bigquery.QueryJobConfig(query_parameters=params))

    logs, last_ts = [], since
    for row in job:
        logs.append({
            "message": row["message"] or "(mesaj yok)",
            "error_type": row["error_type"],
            "stack_trace": row["stack_trace"],
            "app_version": row["app_version"],
            "platform": row["platform"],
            "source": "firebase",
        })
        last_ts = row["event_ts"]
    return logs, last_ts


def post_batch(logs: list[dict]) -> dict:
    params = {"project_id": LOGLENS_PROJECT_ID} if LOGLENS_PROJECT_ID else None
    with httpx.Client(timeout=300) as client:
        r = client.post(f"{LOGLENS_URL}/ingest/batch", params=params, json=logs)
        r.raise_for_status()
        return r.json()


def main() -> int:
    client = bigquery.Client(project=BQ_PROJECT)
    since = read_watermark()
    logs, last_ts = fetch_new_crashes(client, since)

    if not logs:
        print("Yeni crash yok.")
        return 0

    result = post_batch(logs)
    summary = {}
    for r in result.get("results", []):
        summary[r["status"]] = summary.get(r["status"], 0) + 1
    print(f"{len(logs)} crash işlendi -> {json.dumps(summary)}")

    if last_ts:
        write_watermark(last_ts)
    return 0


if __name__ == "__main__":
    sys.exit(main())
