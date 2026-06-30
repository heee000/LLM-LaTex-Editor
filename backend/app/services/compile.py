import os
import re
import asyncio
import shutil
import logging
import subprocess
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import settings
from app.models.compile_job import CompileJob
from app.models.file import File

logger = logging.getLogger("compile")


async def trigger_compile(db: AsyncSession, project_id: str) -> CompileJob:
    job = CompileJob(project_id=project_id, status="running")
    db.add(job)
    try:
        await db.commit()
    except Exception as e:
        logger.error("Failed to create compile job: %s", e)
        job.status = "failed"
        job.error_msg = f"无法创建编译任务: {e}"
        return job
    await db.refresh(job)

    job_dir = Path(settings.compile_dir) / job.id
    job_dir.mkdir(parents=True, exist_ok=True)

    try:
        files_result = await db.execute(select(File).where(File.project_id == project_id))
        files = files_result.scalars().all()

        for f in files:
            fpath = job_dir / f.path
            fpath.parent.mkdir(parents=True, exist_ok=True)
            if f.content:
                fpath.write_text(f.content, encoding="utf-8")
            else:
                # Binary file (image, etc.) — copy from upload dir
                src = Path(settings.upload_dir) / project_id / f.path
                if src.exists():
                    shutil.copy2(src, fpath)

        main = next((f for f in files if f.path == "main.tex"), None)
        if not main:
            job.status = "failed"
            job.error_msg = "main.tex 未找到，请先创建主文件"
            await db.commit()
            return job

        main_path = str(job_dir / main.path)
        logger.info("Compiling project %s in %s", project_id, job_dir)
        try:
            proc = await asyncio.to_thread(
                subprocess.run,
                [
                    "latexmk", "-xelatex", "-interaction=nonstopmode",
                    "-halt-on-error", "-file-line-error", main_path,
                ],
                cwd=str(job_dir),
                capture_output=True,
                timeout=settings.compile_timeout,
            )
        except subprocess.TimeoutExpired:
            job.status = "failed"
            job.error_msg = "编译超时（超过 60 秒）"
            job.log = ""
            await db.commit()
            return job

        log_text = (
            proc.stdout.decode("utf-8", errors="replace")
            + "\n"
            + proc.stderr.decode("utf-8", errors="replace")
        )

        pdf_file = job_dir / "main.pdf"
        if pdf_file.exists() and proc.returncode == 0:
            pdf_dir = Path(settings.upload_dir) / "pdf" / project_id
            pdf_dir.mkdir(parents=True, exist_ok=True)
            dest = pdf_dir / f"{job.id}.pdf"
            shutil.copy2(pdf_file, dest)
            job.status = "done"
            job.pdf_path = str(dest)
            logger.info("Compile success for %s: %s", project_id, dest)
        else:
            job.status = "failed"
            job.error_msg = _extract_latex_errors(log_text)
            logger.warning("Compile failed for %s: %s", project_id, job.error_msg)

        job.log = log_text
        await db.commit()
        await db.refresh(job)
        return job

    except Exception as e:
        logger.exception("Compile exception for %s", project_id)
        job.status = "failed"
        msg = str(e) or repr(e) or type(e).__name__
        job.error_msg = f"编译异常: {msg}"
        try:
            await db.commit()
        except Exception:
            pass
        return job
    finally:
        asyncio.create_task(_cleanup_dir(job_dir))


def _extract_latex_errors(log_text: str) -> str:
    """Extract meaningful error messages from latexmk/xelatex output."""
    errors: list[str] = []
    lines = log_text.split("\n")

    for i, line in enumerate(lines):
        stripped = line.strip()
        if line.startswith("!"):
            # Capture the error line + context (lines until "l." marker or next "!")
            block = [stripped]
            for j in range(i + 1, min(i + 5, len(lines))):
                ctx = lines[j].strip()
                if not ctx:
                    continue
                if ctx.startswith("!"):
                    break
                if "runscript" in ctx.lower():
                    continue
                block.append(ctx)
                if re.match(r"^l\.\d+", ctx):
                    break
            errors.append("\n".join(block))
        elif re.match(r"^\S+:\d+:", stripped):
            if stripped not in errors:
                errors.append(stripped)
        elif "Error:" in stripped or "error:" in stripped:
            if stripped not in errors and "Collected error" not in stripped:
                errors.append(stripped)
        elif "not found" in stripped.lower() or "missing" in stripped.lower():
            if stripped not in errors and "Latexmk:" in stripped:
                errors.append(stripped)
        elif "Emergency stop" in stripped or "Fatal" in stripped:
            errors.append(stripped)

    if not errors:
        tail = [l.strip() for l in lines[-20:] if l.strip()]
        return "\n".join(tail) if tail else "Unknown compilation error"

    result = "\n".join(errors[:25])
    # If the extracted errors are too terse, append the log tail for context
    if len(result) < 80:
        tail = [l.strip() for l in lines[-20:] if l.strip()]
        if tail:
            result += "\n\n--- 完整日志尾部 ---\n" + "\n".join(tail[-10:])
    return result


async def _cleanup_dir(path: Path, delay: int = 3600):
    await asyncio.sleep(delay)
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)


async def get_compile_job(db: AsyncSession, job_id: str) -> CompileJob | None:
    result = await db.execute(select(CompileJob).where(CompileJob.id == job_id))
    return result.scalar_one_or_none()
