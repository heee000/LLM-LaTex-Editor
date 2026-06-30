from fastapi import APIRouter, Depends, HTTPException, UploadFile, File as FastAPIFile
from sqlalchemy.ext.asyncio import AsyncSession
from pathlib import Path
from app.config import settings
from app.database import get_db
from app.schemas.file import FileCreate, FileUpdate, FileResponse
from app.services.file import list_files, get_file, create_file, update_file, delete_file

router = APIRouter(prefix="/api/projects/{project_id}/files", tags=["files"])

@router.get("", response_model=list[FileResponse])
async def list_project_files(project_id: str, db: AsyncSession = Depends(get_db)):
    return [FileResponse.model_validate(f) for f in await list_files(db, project_id)]

@router.get("/{file_id}", response_model=FileResponse)
async def get_single_file(project_id: str, file_id: str, db: AsyncSession = Depends(get_db)):
    f = await get_file(db, file_id)
    if not f or f.project_id != project_id:
        raise HTTPException(status_code=404)
    return FileResponse.model_validate(f)

@router.post("", response_model=FileResponse, status_code=201)
async def create_new_file(project_id: str, data: FileCreate, db: AsyncSession = Depends(get_db)):
    try:
        return FileResponse.model_validate(await create_file(db, project_id, data))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

@router.put("/{file_id}", response_model=FileResponse)
async def update_existing_file(project_id: str, file_id: str, data: FileUpdate, db: AsyncSession = Depends(get_db)):
    f = await update_file(db, file_id, data)
    if not f:
        raise HTTPException(status_code=404)
    return FileResponse.model_validate(f)

@router.delete("/{file_id}", status_code=204)
async def delete_existing_file(project_id: str, file_id: str, db: AsyncSession = Depends(get_db)):
    if not await delete_file(db, file_id):
        raise HTTPException(status_code=404)

BINARY_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".pdf", ".docx", ".xlsx", ".zip"}

@router.post("/upload", response_model=FileResponse, status_code=201)
async def upload_file(project_id: str, file: UploadFile = FastAPIFile(...), db: AsyncSession = Depends(get_db)):
    content = await file.read()
    filename = file.filename or "untitled"
    ext = Path(filename).suffix.lower()

    if ext in BINARY_EXTENSIONS:
        # Store binary files in uploads dir, reference in DB
        upload_dir = Path(settings.upload_dir) / project_id
        upload_dir.mkdir(parents=True, exist_ok=True)
        dest = upload_dir / filename
        dest.write_bytes(content)
        data = FileCreate(path=filename, content="", file_type="img" if ext in {".png", ".jpg", ".jpeg", ".gif"} else "other", size=len(content))
    else:
        text = content.decode("utf-8", errors="replace")
        data = FileCreate(path=filename, content=text, file_type="tex" if ext in {".tex", ".bib", ".cls", ".sty"} else "other", size=len(content))

    f = await create_file(db, project_id, data)
    return FileResponse.model_validate(f)
