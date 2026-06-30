import json
import re
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File as FastAPIFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.database import get_db
from app.schemas.ai import AIChatRequest
from app.schemas.file import FileCreate, FileResponse, FileUpdate
from app.middleware.llm_key import get_llm_credentials
from app.services.ai import get_provider
from app.services.import_pipeline import import_txt, import_docx, import_image, import_table
from app.services.file import list_files, get_file_by_path, create_file, update_file

router = APIRouter(prefix="/api/projects/{project_id}/ai", tags=["ai"])


async def _unique_path(db: AsyncSession, project_id: str, desired: str) -> str:
    """Return a non-conflicting file path in the project."""
    existing = await get_file_by_path(db, project_id, desired)
    if not existing:
        return desired
    if "." in desired:
        stem, ext = desired.rsplit(".", 1)
        ext = "." + ext
    else:
        stem, ext = desired, ""
    n = 1
    while True:
        candidate = f"{stem}_{n}{ext}"
        if not await get_file_by_path(db, project_id, candidate):
            return candidate
        n += 1

_LATEX_SYSTEM_PROMPT = """You are a LaTeX code generator. Your ONLY output format is fenced code blocks with LaTeX.

NEVER output markdown, never use ## or **bold**, never write plain paragraphs.
ONLY output complete usable LaTeX files inside ```latex file=FILENAME blocks.

The priority goal is to generate directly usable LaTeX single documents, and if there are any areas where bugs may occur, they can be appropriately modified

import following packages and any packages needed: usepackage{amsmath,amssymb,amsthm,graphicx,booktabs,hyperref,geometry,csquotes}


- Always include \\documentclass, \\usepackage[UTF8]{ctex} for Chinese, \\usepackage{csquotes}, and \\begin/end{document}
- For .bib: ```bibtex file=refs.bib
- For .cls/.sty: ```latex file=name.cls
- Multiple files = multiple code blocks, each with file= attribute
- Complete compilable files only — no diffs, no snippets
- No explanations — just the code blocks"""

@router.post("/chat")
async def ai_chat(project_id: str, data: AIChatRequest, request: Request, db: AsyncSession = Depends(get_db)):
    api_key, provider_type = await get_llm_credentials(request)
    provider = get_provider(api_key, provider_type)

    files = await list_files(db, project_id)
    file_contexts = []
    total_chars = 0
    MAX_CONTEXT_CHARS = 120000

    for f in files:
        if not f.content:
            continue
        lang = "bibtex" if f.path.endswith(".bib") else "latex"
        block = f"\n=== {f.path} ===\n```{lang}\n{f.content}\n```\n"
        if total_chars + len(block) > MAX_CONTEXT_CHARS:
            block = block[:MAX_CONTEXT_CHARS - total_chars] + "\n... (truncated)\n```"
            file_contexts.append(block)
            break
        file_contexts.append(block)
        total_chars += len(block)

    project_context = "".join(file_contexts) if file_contexts else "(empty project)"

    active_file_hint = ""
    if data.target_file:
        active_file_hint = f"\n\nCURRENTLY ACTIVE FILE: {data.target_file}"
    elif files:
        active_file_hint = f"\n\nCURRENTLY ACTIVE FILE: {files[0].path}"

    system_msg = _LATEX_SYSTEM_PROMPT + f"\n\n## PROJECT FILES\n{project_context}{active_file_hint}"
    messages = [{"role": "system", "content": system_msg}]
    for h in data.history[-10:]:
        messages.append(h)
    messages.append({"role": "user", "content": data.message})

    async def event_stream():
        yield "data: " + json.dumps({"type": "start"}) + "\n\n"
        full_response: list[str] = []
        try:
            async for token in provider.chat_stream(messages, data.model):
                full_response.append(token)
                yield "data: " + json.dumps({"type": "token", "content": token}) + "\n\n"

            # If AI output has no LaTeX code blocks, auto-convert to LaTeX
            response_text = "".join(full_response)
            has_blocks = "```latex" in response_text or "```bibtex" in response_text
            if not has_blocks and len(response_text.strip()) > 30:
                yield "data: " + json.dumps({"type": "converting"}) + "\n\n"
                convert_msg = (
                    "Convert the following text into a complete, compilable LaTeX document.\n"
                    "Include \\documentclass{article}, \\usepackage[UTF8]{ctex} (if Chinese), "
                    "\\usepackage{amsmath,amssymb,amsthm,graphicx,booktabs,hyperref,geometry}, "
                    "\\begin{document}...\\end{document}.\n"
                    "Output ONLY the LaTeX code, no explanations.\n\n"
                    + response_text
                )
                async for token in provider.chat_stream(
                    [{"role": "user", "content": convert_msg}], data.model
                ):
                    yield "data: " + json.dumps({"type": "token", "content": token}) + "\n\n"

            yield "data: " + json.dumps({"type": "done"}) + "\n\n"
        except Exception as e:
            yield "data: " + json.dumps({"type": "error", "message": str(e)}) + "\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

@router.post("/import")
async def ai_import(
    project_id: str,
    request: Request,
    file: UploadFile = FastAPIFile(...),
    db: AsyncSession = Depends(get_db),
):
    api_key, provider_type = await get_llm_credentials(request)
    provider = get_provider(api_key, provider_type)
    model = request.headers.get("X-LLM-Model", "gpt-4o")

    content = await file.read()
    filename = file.filename or "untitled"
    ext = (filename or "").split(".")[-1].lower() if "." in filename else ""

    try:
        if ext in ("txt", "md"):
            text = content.decode("utf-8", errors="replace")
            result = await import_txt(text, provider, model)
            path = await _unique_path(db, project_id, f"{Path(filename).stem}.tex")
            f = await create_file(db, project_id, FileCreate(path=path, content=result, file_type="tex"))
            return FileResponse.model_validate(f)

        elif ext == "docx":
            result = await import_docx(content, filename, provider, model)
            files = []
            for orig_path, tex_content in result.items():
                path = await _unique_path(db, project_id, orig_path)
                f = await create_file(db, project_id, FileCreate(path=path, content=tex_content, file_type="tex"))
                files.append(FileResponse.model_validate(f))
            return {"files": [f.model_dump() for f in files]}

        elif ext in ("png", "jpg", "jpeg", "gif"):
            safe_name = filename.replace(" ", "_")

            # Save image file to project (needed by \includegraphics)
            img_dir = Path(settings.upload_dir) / project_id
            img_dir.mkdir(parents=True, exist_ok=True)
            (img_dir / safe_name).write_bytes(content)
            existing_img = await get_file_by_path(db, project_id, safe_name)
            if existing_img:
                await update_file(db, existing_img.id, FileUpdate(content=""))
            else:
                await create_file(db, project_id, FileCreate(path=safe_name, content="", file_type="img"))

            # Try AI vision pipeline, fall back to basic template on failure
            try:
                result = await import_image(content, provider, model, filename)
            except Exception as vision_err:
                import logging
                logging.getLogger("ai").warning("Vision import failed for %s: %s", filename, vision_err)
                stem = Path(filename).stem
                latex_code = f"""\\begin{{figure}}[htbp]
\\centering
\\includegraphics[width=0.8\\textwidth]{{{safe_name}}}
\\caption{{}}
\\label{{fig:{stem}}}
\\end{{figure}}
"""
                result = {f"fig_{stem}.tex": latex_code}

            # Save LaTeX output from vision as separate files
            files = []
            for orig_path, tex_content in result.items():
                path = await _unique_path(db, project_id, orig_path)
                f = await create_file(db, project_id, FileCreate(path=path, content=tex_content, file_type="tex"))
                files.append(FileResponse.model_validate(f))
            return {"files": [f.model_dump() for f in files]}

        elif ext in ("csv", "xlsx"):
            result = await import_table(content, filename, provider, model)
            files = []
            for orig_path, tex_content in result.items():
                path = await _unique_path(db, project_id, orig_path)
                f = await create_file(db, project_id, FileCreate(path=path, content=tex_content, file_type="tex"))
                files.append(FileResponse.model_validate(f))
            return {"files": [f.model_dump() for f in files]}

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: .{ext}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate")
async def ai_generate(project_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Read all project files and generate main.tex via AI."""
    api_key, provider_type = await get_llm_credentials(request)
    provider = get_provider(api_key, provider_type)
    model = request.headers.get("X-LLM-Model", "gpt-4o")

    files = await list_files(db, project_id)
    if not files:
        raise HTTPException(status_code=400, detail="项目中没有文件，请先导入材料")

    # Build context: include ALL text files + list binary resources
    parts = []
    img_files = []
    binary_files = []
    for f in files:
        if f.file_type == "img":
            img_files.append(f.path)
        elif f.content:
            parts.append(f"\n=== {f.path} ===\n{f.content}")
        else:
            binary_files.append(f.path)

    file_context = "\n".join(parts) if parts else "(no text files)"
    img_list = "\n".join(f"- {p}" for p in img_files) if img_files else "(none)"
    binary_list = "\n".join(f"- {p}" for p in binary_files) if binary_files else "(none)"

    prompt = f"""You are a LaTeX document generator. Below are project files and images.

## IMAGES AVAILABLE
{img_list}

## BINARY FILES (not readable as text, available for reference)
{binary_list}

## PROJECT FILES
{file_context}

## TASK
Generate a COMPLETE, compilable main.tex that incorporates ALL the content above.
- Use \\documentclass{{article}}, \\usepackage[UTF8]{{ctex}} for Chinese
- Use \\usepackage{{amsmath,amssymb,amsthm,graphicx,booktabs,hyperref,geometry,csquotes}}
- Reference available images with \\includegraphics{{filename}}
- Merge all text/tex content intelligently into cohesive sections
- Output ONLY the LaTeX code in a fenced block: ```latex file=main.tex ... ```
- The output MUST be complete and compilable"""

    messages = [{"role": "user", "content": prompt}]

    async def event_stream():
        yield "data: " + json.dumps({"type": "start"}) + "\n\n"
        full_response: list[str] = []
        try:
            async for token in provider.chat_stream(messages, model):
                full_response.append(token)
                yield "data: " + json.dumps({"type": "token", "content": token}) + "\n\n"

            response_text = "".join(full_response)
            # Extract LaTeX from code block, stripping the info string line
            # (which may include "file=main.tex" or other attributes)
            tex_content = response_text
            m = re.search(r"```[^\n]*\n(.*?)```", response_text, re.DOTALL)
            if m:
                tex_content = m.group(1).strip()

            # Save to main.tex
            existing = await get_file_by_path(db, project_id, "main.tex")
            if existing:
                await update_file(db, existing.id, FileUpdate(content=tex_content))
            else:
                await create_file(db, project_id, FileCreate(path="main.tex", content=tex_content, file_type="tex"))

            yield "data: " + json.dumps({"type": "done"}) + "\n\n"
        except Exception as e:
            yield "data: " + json.dumps({"type": "error", "message": str(e)}) + "\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
