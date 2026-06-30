import os
import io
import zipfile
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.models.template import Template, TemplateFile


async def list_templates(db: AsyncSession) -> list[Template]:
    result = await db.execute(
        select(Template)
        .where(Template.is_public == True)
        .order_by(Template.category, Template.name)
    )
    return list(result.scalars().all())


async def get_template(db: AsyncSession, template_id: str) -> Template | None:
    result = await db.execute(select(Template).where(Template.id == template_id))
    return result.scalar_one_or_none()


async def create_template(
    db: AsyncSession,
    template_dir: str,
    name: str,
    description: str,
    category: str,
    language: str,
) -> Template:
    template = Template(
        name=name,
        description=description,
        category=category,
        language=language,
        dir_path=template_dir,
        is_public=True,
    )
    db.add(template)
    await db.flush()

    for root, _dirs, files in os.walk(template_dir):
        for fname in files:
            fpath = Path(root) / fname
            rel_path = str(fpath.relative_to(template_dir)).replace("\\", "/")
            content = fpath.read_text(encoding="utf-8", errors="replace")
            tf = TemplateFile(template_id=template.id, path=rel_path, content=content)
            db.add(tf)

    await db.commit()
    await db.refresh(template)
    return template


async def create_template_from_zip(
    db: AsyncSession,
    zip_bytes: bytes,
    name: str,
    description: str,
    category: str,
    language: str,
) -> Template:
    template_id = f"{category}_{name.replace(' ', '_')}"
    dest_dir = Path(settings.template_dir) / template_id
    dest_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        zf.extractall(dest_dir)

    return await create_template(db, str(dest_dir), name, description, category, language)
