from pydantic import BaseModel, Field

STATUS_PATTERN = "^(open|investigating|resolved|ignored)$"


class LogIn(BaseModel):
    message: str
    stack_trace: str | None = None
    error_type: str | None = None
    app_version: str | None = None
    platform: str | None = None
    source: str | None = None  # firebase / sdk


class ClusterUpdateIn(BaseModel):
    status: str | None = Field(None, pattern=STATUS_PATTERN)
    assignee_id: int | None = None
    note: str | None = None


class NoteIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class OpinionIn(BaseModel):
    provider: str = Field(pattern="^(local|ollama|openai|gemini|claude)$")
