from pydantic import BaseModel, Field


class WebhookIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    source: str | None = Field(None, max_length=120)


class WebhookActiveIn(BaseModel):
    active: bool
