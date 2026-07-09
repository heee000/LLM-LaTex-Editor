from datetime import datetime

from pydantic import BaseModel, Field


class UserRegister(BaseModel):
    username: str
    password: str
    email: str | None = None


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: str
    username: str | None = None
    email: str | None = None
    is_admin: bool = False
    is_guest: bool = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ProjectCreate(BaseModel):
    name: str = "Untitled Project"
    template_id: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    main_file: str | None = None


class ProjectResponse(BaseModel):
    id: str
    user_id: str | None
    name: str
    template_id: str | None = None
    main_file: str = "main.tex"
    created_at: datetime
    updated_at: datetime


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
    content: str | None = ""
    file_type: str
    size: int = 0
    created_at: datetime
    updated_at: datetime


class CompileRequest(BaseModel):
    force: bool = False


class CompileResponse(BaseModel):
    id: str
    status: str
    log: str | None = None
    pdf_url: str | None = None
    error_msg: str | None = None
    created_at: datetime | None = None


class AIChatRequest(BaseModel):
    message: str
    model: str = "gpt-4o"
    history: list[dict] = Field(default_factory=list)
    target_file: str | None = None


class TemplateResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    category: str = "other"
    language: str = "universal"
    thumbnail_url: str | None = None
    is_public: bool = True
    created_at: datetime


class TemplateDetailResponse(TemplateResponse):
    files: list[dict] = Field(default_factory=list)
