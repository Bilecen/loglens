from pydantic import BaseModel, EmailStr, Field

ROLE_PATTERN = "^(admin|developer|po|tester)$"


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
