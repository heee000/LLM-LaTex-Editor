from datetime import datetime
from pydantic import BaseModel


class CompileRequest(BaseModel):
    force: bool = False


class CompileResponse(BaseModel):
    id: str
    status: str
    log: str | None
    pdf_url: str | None
    error_msg: str | None
    model_config = {"from_attributes": True}
