from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.export import export_tex_zip, get_latest_pdf_path

router = APIRouter(prefix="/api/projects/{project_id}/export", tags=["export"])

@router.get("/tex")
async def download_tex(project_id: str, db: AsyncSession = Depends(get_db)):
    buf = await export_tex_zip(db, project_id)
    return StreamingResponse(buf, media_type="application/zip", headers={"Content-Disposition": f"attachment; filename=project_{project_id}.zip"})

@router.get("/pdf")
async def download_pdf(project_id: str, db: AsyncSession = Depends(get_db)):
    path = await get_latest_pdf_path(db, project_id)
    if not path:
        raise HTTPException(status_code=404, detail="No compiled PDF available")
    return FileResponse(path, media_type="application/pdf", filename=f"project_{project_id}.pdf")
