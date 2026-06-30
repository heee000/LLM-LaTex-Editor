from datetime import datetime
from pydantic import BaseModel


class FileCreate(BaseModel):
    path: str
    content: str = ""
    file_type: str = "tex"


class FileUpdate(BaseModel):
    content: str


class FileResponse(BaseModel):
    id: str
    project_id: str
    path: str
    content: str | None
    file_type: str
    size: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
