from pydantic import BaseModel, Field


class RepoIn(BaseModel):
    provider: str = Field("github", pattern="^(github|azure)$",
                          description="github | azure (azure için full_name = org/project/repo)")
    full_name: str = Field(description="github: owner/repo — azure: org/project/repo")
    default_branch: str = "main"
    token: str | None = None
    path_prefix: str | None = None
