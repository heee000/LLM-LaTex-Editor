from datetime import datetime
from pydantic import BaseModel


class TemplateCreate(BaseModel):
    name: str
    description: str | None = None
    category: str = "other"
    language: str = "universal"


class TemplateResponse(BaseModel):
    id: str
    name: str
    description: str | None
    category: str
    language: str
    thumbnail_url: str | None
    is_public: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class TemplateFileResponse(BaseModel):
    id: str
    path: str
    content: str | None
    model_config = {"from_attributes": True}


class TemplateDetailResponse(TemplateResponse):
    files: list[TemplateFileResponse] = []
