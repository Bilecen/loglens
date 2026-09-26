from pydantic import BaseModel, Field


class ProjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    key: str = Field(min_length=1, max_length=60, pattern="^[a-z0-9][a-z0-9-]*$",
                     description="URL-güvenli kısa slug (küçük harf/rakam/tire)")


class MemberIn(BaseModel):
    user_id: int
