from datetime import datetime
from pydantic import BaseModel


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
    template_id: str | None
    main_file: str
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
