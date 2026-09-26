from pydantic import BaseModel, Field


class PresenceIn(BaseModel):
    presence: str = Field(pattern="^(available|away|busy)$")


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
