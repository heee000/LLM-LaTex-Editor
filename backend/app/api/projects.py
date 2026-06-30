from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated
from app.database import get_db
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.services.project import list_projects, get_project, create_project, create_project_from_template, update_project, delete_project
from app.services.auth import decode_token, get_user_by_id

router = APIRouter(prefix="/api/projects", tags=["projects"])

async def _resolve_user(authorization: Annotated[str | None, Header()] = None, db: AsyncSession = Depends(get_db)) -> str | None:
    if authorization and authorization.startswith("Bearer "):
        uid = decode_token(authorization[7:])
        if uid:
            user = await get_user_by_id(db, uid)
            if user:
                return user.id
    return None

@router.get("", response_model=list[ProjectResponse])
async def list_user_projects(user_id: str | None = Depends(_resolve_user), db: AsyncSession = Depends(get_db)):
    projects = await list_projects(db, user_id)
    return [ProjectResponse.model_validate(p) for p in projects]

@router.get("/{project_id}", response_model=ProjectResponse)
async def get_single_project(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse.model_validate(project)

@router.post("", response_model=ProjectResponse, status_code=201)
async def create_new_project(data: ProjectCreate, user_id: str | None = Depends(_resolve_user), db: AsyncSession = Depends(get_db)):
    if data.template_id:
        try:
            project = await create_project_from_template(db, data.template_id, user_id)
        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
    else:
        project = await create_project(db, data, user_id)
    return ProjectResponse.model_validate(project)

@router.put("/{project_id}", response_model=ProjectResponse)
async def update_existing_project(project_id: str, data: ProjectUpdate, db: AsyncSession = Depends(get_db)):
    project = await update_project(db, project_id, data)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse.model_validate(project)

@router.delete("/{project_id}", status_code=204)
async def delete_existing_project(project_id: str, db: AsyncSession = Depends(get_db)):
    deleted = await delete_project(db, project_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Project not found")
