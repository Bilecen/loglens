"""API istek modelleri (Pydantic). Tüm request şemaları tek yerde."""
from pydantic import BaseModel, EmailStr, Field

ROLE_PATTERN = "^(admin|developer|po|tester)$"
STATUS_PATTERN = "^(open|investigating|resolved|ignored)$"


class LogIn(BaseModel):
    message: str
    stack_trace: str | None = None
    error_type: str | None = None
    app_version: str | None = None
    platform: str | None = None
    source: str | None = None  # firebase / sdk


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str | None = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


class McpTokenIn(BaseModel):
    name: str = Field(min_length=1, max_length=120, description="örn. 'Claude Code - MacBook'")


class UserCreateIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str | None = None
    role: str = Field(default="developer", pattern=ROLE_PATTERN)


class RoleIn(BaseModel):
    role: str = Field(pattern=ROLE_PATTERN)


class UpdateMeIn(BaseModel):
    name: str | None = Field(None, max_length=120)
    password: str | None = Field(None, min_length=6)
    avatar: str | None = Field(None, max_length=800_000)  # data-URI (base64) ya da "" (kaldır)


class ClusterUpdateIn(BaseModel):
    status: str | None = Field(None, pattern=STATUS_PATTERN)
    assignee_id: int | None = None
    note: str | None = None


class NoteIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class OpinionIn(BaseModel):
    provider: str = Field(pattern="^(local|ollama|openai|gemini|claude)$")


class RepoIn(BaseModel):
    provider: str = Field("github", pattern="^(github|azure)$",
                          description="github | azure (azure için full_name = org/project/repo)")
    full_name: str = Field(description="github: owner/repo — azure: org/project/repo")
    default_branch: str = "main"
    token: str | None = None
    path_prefix: str | None = None


class ProjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    key: str = Field(min_length=1, max_length=60, pattern="^[a-z0-9][a-z0-9-]*$",
                     description="URL-güvenli kısa slug (küçük harf/rakam/tire)")


class MemberIn(BaseModel):
    user_id: int


class PresenceIn(BaseModel):
    presence: str = Field(pattern="^(available|away|busy)$")


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class WebhookIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    source: str | None = Field(None, max_length=120)


class WebhookActiveIn(BaseModel):
    active: bool


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


class SettingsIn(BaseModel):
    # Hepsi opsiyonel: yalnızca gönderilen alanlar güncellenir (secret'lar
    # değişmediyse UI göndermez). "" = temizle (env fallback'e dön).
    llm_provider: str | None = Field(None, pattern="^(local|ollama|claude|openai|gemini)$")
    response_language: str | None = Field(None, max_length=40, description="örn. 'Türkçe', 'English'")
    anthropic_api_key: str | None = None
    claude_model: str | None = None
    local_base_url: str | None = None
    local_model: str | None = None
    local_api_key: str | None = None
    ollama_base_url: str | None = None
    ollama_model: str | None = None
    openai_base_url: str | None = None
    openai_model: str | None = None
    openai_api_key: str | None = None
    gemini_base_url: str | None = None
    gemini_model: str | None = None
    gemini_api_key: str | None = None
    github_token: str | None = None
    azure_token: str | None = None
