from fastapi import APIRouter, Depends, HTTPException, UploadFile, File as FastAPIFile, Form, Header
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.template import TemplateResponse, TemplateDetailResponse
from app.services.template import list_templates, get_template, create_template_from_zip
from app.services.auth import decode_token, get_user_by_id

router = APIRouter(prefix="/api", tags=["templates"])

@router.get("/templates", response_model=list[TemplateResponse])
async def get_public_templates(db: AsyncSession = Depends(get_db)):
    templates = await list_templates(db)
    return [TemplateResponse.model_validate(t) for t in templates]

@router.get("/templates/{template_id}", response_model=TemplateDetailResponse)
async def get_template_detail(template_id: str, db: AsyncSession = Depends(get_db)):
    template = await get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404)
    return TemplateDetailResponse.model_validate(template)

async def _require_admin(authorization: str = Header(None), db: AsyncSession = Depends(get_db)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401)
    user_id = decode_token(authorization[7:])
    if not user_id:
        raise HTTPException(status_code=401)
    user = await get_user_by_id(db, user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user_id

@router.post("/admin/templates", response_model=TemplateResponse, status_code=201)
async def admin_create_template(
    file: UploadFile = FastAPIFile(...),
    name: str = Form(...),
    description: str = Form(""),
    category: str = Form("other"),
    language: str = Form("universal"),
    user_id: str = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
):
    zip_bytes = await file.read()
    template = await create_template_from_zip(db, zip_bytes, name, description, category, language)
    return TemplateResponse.model_validate(template)

@router.delete("/admin/templates/{template_id}", status_code=204)
async def admin_delete_template(
    template_id: str,
    user_id: str = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
):
    template = await get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404)
    template.is_public = False
    await db.commit()
