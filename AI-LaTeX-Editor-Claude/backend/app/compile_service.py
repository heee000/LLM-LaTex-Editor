import asyncio
import re
import shutil
import subprocess
from pathlib import Path

from app.settings import get_settings
from app.store import store


def extract_latex_errors(log_text: str) -> str:
    errors: list[str] = []
    lines = log_text.splitlines()
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("!"):
            block = [stripped]
            for ctx in lines[i + 1 : i + 6]:
                ctx = ctx.strip()
                if not ctx or ctx.startswith("!"):
                    break
                block.append(ctx)
                if re.match(r"^l\.\d+", ctx):
                    break
            errors.append("\n".join(block))
        elif re.match(r"^\S+:\d+:", stripped):
            errors.append(stripped)
        elif "Emergency stop" in stripped or "Fatal error" in stripped:
            errors.append(stripped)
    if errors:
        return "\n".join(dict.fromkeys(errors[:25]))
    tail = [line.strip() for line in lines[-20:] if line.strip()]
    return "\n".join(tail) if tail else "Unknown LaTeX compilation error"


async def trigger_compile(project_id: str) -> dict:
    settings = get_settings()
    job = store.create_compile_job(project_id)
    job_dir = Path(settings.compile_dir) / job["id"]
    upload_dir = Path(settings.upload_dir) / project_id
    job_dir.mkdir(parents=True, exist_ok=True)

    try:
        files = store.list_files(project_id)
        main_path = None
        for item in files:
            target = job_dir / item["path"]
            target.parent.mkdir(parents=True, exist_ok=True)
            if item.get("content") is not None and item.get("file_type") != "img":
                target.write_text(item.get("content") or "", encoding="utf-8")
            else:
                source = upload_dir / item["path"]
                if source.exists():
                    shutil.copy2(source, target)
            if item["path"] == "main.tex":
                main_path = target

        if not main_path or not main_path.exists():
            return store.update_compile_job(
                job["id"],
                {"status": "failed", "error_msg": "main.tex not found. Create or generate a main file first.", "log": ""},
            ) or job

        proc, log_text = await run_latex(job_dir, settings.compile_timeout)
        pdf = job_dir / "main.pdf"
        if proc.returncode == 0 and pdf.exists():
            pdf_dir = Path(settings.upload_dir) / "pdf" / project_id
            pdf_dir.mkdir(parents=True, exist_ok=True)
            dest = pdf_dir / f"{job['id']}.pdf"
            shutil.copy2(pdf, dest)
            return store.update_compile_job(
                job["id"],
                {"status": "done", "log": log_text, "pdf_path": str(dest), "error_msg": None},
            ) or job

        return store.update_compile_job(
            job["id"],
            {"status": "failed", "log": log_text, "error_msg": extract_latex_errors(log_text)},
        ) or job
    except Exception as exc:
        return store.update_compile_job(
            job["id"],
            {"status": "failed", "error_msg": f"Compilation exception: {exc}", "log": ""},
        ) or job
    finally:
        asyncio.create_task(clean_later(job_dir))


async def clean_later(path: Path, delay: int = 3600) -> None:
    await asyncio.sleep(delay)
    shutil.rmtree(path, ignore_errors=True)


async def run_latex(job_dir: Path, timeout: int) -> tuple[subprocess.CompletedProcess[bytes], str]:
    try:
        latexmk = await asyncio.to_thread(
            subprocess.run,
            ["latexmk", "-xelatex", "-interaction=nonstopmode", "-halt-on-error", "-file-line-error", "main.tex"],
            cwd=str(job_dir),
            capture_output=True,
            timeout=timeout,
        )
        latexmk_log = decode_process_output(latexmk)
        if latexmk.returncode == 0 and (job_dir / "main.pdf").exists():
            return latexmk, latexmk_log
    except FileNotFoundError:
        latexmk = None
        latexmk_log = "latexmk was not found; falling back to xelatex.\n"
    except subprocess.TimeoutExpired:
        latexmk = subprocess.CompletedProcess(["latexmk"], 124, b"", b"latexmk timed out")
        latexmk_log = f"latexmk timed out after {timeout} seconds; falling back to xelatex.\n"

    xelatex_logs: list[str] = []
    last_proc: subprocess.CompletedProcess[bytes] | None = None
    for _ in range(2):
        try:
            last_proc = await asyncio.to_thread(
                subprocess.run,
                ["xelatex", "-interaction=nonstopmode", "-halt-on-error", "-file-line-error", "main.tex"],
                cwd=str(job_dir),
                capture_output=True,
                timeout=timeout,
            )
            xelatex_logs.append(decode_process_output(last_proc))
            if last_proc.returncode != 0:
                break
        except FileNotFoundError:
            last_proc = subprocess.CompletedProcess(["xelatex"], 127, b"", b"xelatex was not found")
            xelatex_logs.append("xelatex was not found. Install TeX Live or add xelatex to PATH.")
            break
        except subprocess.TimeoutExpired:
            last_proc = subprocess.CompletedProcess(["xelatex"], 124, b"", b"xelatex timed out")
            xelatex_logs.append(f"xelatex timed out after {timeout} seconds.")
            break

    if last_proc is None:
        last_proc = latexmk or subprocess.CompletedProcess(["latex"], 1, b"", b"No LaTeX command ran")

    combined = latexmk_log
    if latexmk_log:
        combined += "\n--- xelatex fallback ---\n"
    combined += "\n".join(xelatex_logs)
    return last_proc, combined


def decode_process_output(proc: subprocess.CompletedProcess[bytes]) -> str:
    return proc.stdout.decode("utf-8", errors="replace") + "\n" + proc.stderr.decode("utf-8", errors="replace")
