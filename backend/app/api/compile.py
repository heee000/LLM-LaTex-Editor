from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.compile import CompileResponse, CompileRequest
from app.services.compile import trigger_compile, get_compile_job
from app.services.project import get_project

router = APIRouter(prefix="/api/projects/{project_id}", tags=["compile"])

@router.post("/compile", response_model=CompileResponse)
async def compile_project(project_id: str, req: CompileRequest, db: AsyncSession = Depends(get_db)):
    project = await get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    job = await trigger_compile(db, project_id)
    pdf_url = f"/api/projects/{project_id}/pdf" if job.status == "done" else None
    return CompileResponse(id=job.id, status=job.status, log=job.log, pdf_url=pdf_url, error_msg=job.error_msg)

@router.get("/compile/{job_id}", response_model=CompileResponse)
async def get_compile_status(project_id: str, job_id: str, db: AsyncSession = Depends(get_db)):
    job = await get_compile_job(db, job_id)
    if not job or job.project_id != project_id:
        raise HTTPException(status_code=404)
    pdf_url = f"/api/projects/{project_id}/pdf" if job.status == "done" else None
    return CompileResponse(id=job.id, status=job.status, log=job.log, pdf_url=pdf_url, error_msg=job.error_msg)

@router.get("/pdf")
async def get_project_pdf(project_id: str, db: AsyncSession = Depends(get_db)):
    from app.services.export import get_latest_pdf_path
    path = await get_latest_pdf_path(db, project_id)
    if not path:
        raise HTTPException(status_code=404, detail="No compiled PDF available")
    return FileResponse(path, media_type="application/pdf")
