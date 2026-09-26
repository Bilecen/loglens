from pydantic import BaseModel, EmailStr, Field


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
