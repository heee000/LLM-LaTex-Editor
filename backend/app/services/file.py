from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.file import File
from app.schemas.file import FileCreate, FileUpdate

async def list_files(db: AsyncSession, project_id: str) -> list[File]:
    result = await db.execute(
        select(File).where(File.project_id == project_id).order_by(File.file_type, File.path)
    )
    return list(result.scalars().all())

async def get_file(db: AsyncSession, file_id: str) -> File | None:
    result = await db.execute(select(File).where(File.id == file_id))
    return result.scalar_one_or_none()

async def get_file_by_path(db: AsyncSession, project_id: str, path: str) -> File | None:
    result = await db.execute(select(File).where(File.project_id == project_id, File.path == path))
    return result.scalar_one_or_none()

async def create_file(db: AsyncSession, project_id: str, data: FileCreate) -> File:
    existing = await get_file_by_path(db, project_id, data.path)
    if existing:
        raise ValueError(f"File {data.path} already exists")
    f = File(project_id=project_id, path=data.path, content=data.content, file_type=data.file_type, size=len(data.content or ""))
    db.add(f)
    await db.commit()
    await db.refresh(f)
    return f

async def update_file(db: AsyncSession, file_id: str, data: FileUpdate) -> File | None:
    f = await get_file(db, file_id)
    if not f:
        return None
    f.content = data.content
    f.size = len(data.content or "")
    await db.commit()
    await db.refresh(f)
    return f

async def delete_file(db: AsyncSession, file_id: str) -> bool:
    f = await get_file(db, file_id)
    if not f:
        return False
    await db.delete(f)
    await db.commit()
    return True
