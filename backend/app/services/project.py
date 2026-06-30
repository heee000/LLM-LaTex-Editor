from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.project import Project
from app.models.file import File
from app.models.template import Template, TemplateFile
from app.schemas.project import ProjectCreate, ProjectUpdate

async def list_projects(db: AsyncSession, user_id: str | None) -> list[Project]:
    if user_id:
        result = await db.execute(
            select(Project).where(Project.user_id == user_id).order_by(Project.updated_at.desc())
        )
    else:
        result = await db.execute(
            select(Project).where(Project.user_id.is_(None)).order_by(Project.updated_at.desc())
        )
    return list(result.scalars().all())

async def get_project(db: AsyncSession, project_id: str) -> Project | None:
    result = await db.execute(select(Project).where(Project.id == project_id))
    return result.scalar_one_or_none()

async def create_project(db: AsyncSession, data: ProjectCreate, user_id: str | None = None) -> Project:
    project = Project(user_id=user_id, name=data.name, template_id=data.template_id)
    project.main_file = "main.tex"
    db.add(project)
    await db.flush()

    db.add(File(project_id=project.id, path="main.tex", content=_default_main_tex(), file_type="tex"))

    await db.commit()
    await db.refresh(project)
    return project

async def create_project_from_template(db: AsyncSession, template_id: str, user_id: str | None = None) -> Project:
    result = await db.execute(select(Template).where(Template.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise ValueError("Template not found")

    tpl_files_result = await db.execute(select(TemplateFile).where(TemplateFile.template_id == template_id))
    tpl_files = tpl_files_result.scalars().all()

    project = Project(user_id=user_id, name=template.name, template_id=template_id)
    project.main_file = "main.tex"
    db.add(project)
    await db.flush()

    for tf in tpl_files:
        f = File(project_id=project.id, path=tf.path, content=tf.content, file_type=_detect_type(tf.path))
        db.add(f)

    main_result = await db.execute(select(File).where(File.project_id == project.id, File.path == "main.tex"))
    if not main_result.scalar_one_or_none():
        db.add(File(project_id=project.id, path="main.tex", content=_default_main_tex(), file_type="tex"))

    await db.commit()
    await db.refresh(project)
    return project

async def update_project(db: AsyncSession, project_id: str, data: ProjectUpdate) -> Project | None:
    project = await get_project(db, project_id)
    if not project:
        return None
    if data.name is not None:
        project.name = data.name
    if data.main_file is not None:
        project.main_file = data.main_file
    await db.commit()
    await db.refresh(project)
    return project

async def delete_project(db: AsyncSession, project_id: str) -> bool:
    project = await get_project(db, project_id)
    if not project:
        return False
    await db.delete(project)
    await db.commit()
    return True

def _detect_type(path: str) -> str:
    ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    mapping = {"tex": "tex", "bib": "bib", "cls": "cls", "sty": "sty", "png": "img", "jpg": "img", "pdf": "img"}
    return mapping.get(ext, "other")

def _default_main_tex() -> str:
    return r"""\documentclass{article}
\usepackage[UTF8]{ctex}
\usepackage{amsmath,amssymb,amsthm}
\usepackage{graphicx}
\usepackage{booktabs}
\usepackage{hyperref}

\title{Untitled Document}
\author{}
\date{}

\begin{document}
\maketitle

\section{Introduction}

\end{document}
"""
