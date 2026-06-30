from pydantic import BaseModel


class AIChatRequest(BaseModel):
    message: str
    model: str = "gpt-4o"
    history: list[dict] = []
    target_file: str | None = None


class AIImportRequest(BaseModel):
    file_type: str
    target_path: str = "main.tex"
    instructions: str | None = None
