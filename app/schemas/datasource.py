from pydantic import BaseModel, Field


class DataSourceIn(BaseModel):
    type: str = Field(pattern="^(crashlytics|analytics)$")
    name: str = Field(min_length=1, max_length=120)
    bq_project: str = Field(min_length=1)
    bq_table: str | None = None            # crashlytics: dataset.table
    ga_dataset: str | None = None          # analytics: analytics_<id>
    event_pattern: str | None = None
    credentials_json: str | None = Field(None, max_length=200000)   # service account JSON
    interval_minutes: int = Field(5, ge=1, le=1440)


class DataSourceToggleIn(BaseModel):
    enabled: bool
