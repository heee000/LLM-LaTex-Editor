import io
import zipfile

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.file import File
from app.models.compile_job import CompileJob


async def export_tex_zip(db: AsyncSession, project_id: str) -> io.BytesIO:
    result = await db.execute(select(File).where(File.project_id == project_id))
    files = result.scalars().all()

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            if f.content is not None:
                zf.writestr(f.path, f.content)
    buf.seek(0)
    return buf


async def get_latest_pdf_path(db: AsyncSession, project_id: str) -> str | None:
    result = await db.execute(
        select(CompileJob)
        .where(CompileJob.project_id == project_id, CompileJob.status == "done")
        .order_by(CompileJob.created_at.desc())
        .limit(1)
    )
    job = result.scalar_one_or_none()
    return job.pdf_path if job else None
