import base64
import io
import subprocess
import tempfile
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.ai.base import LLMProvider


async def _collect_stream(llm: LLMProvider, messages: list[dict], model: str) -> str:
    parts = []
    async for chunk in llm.chat_stream(messages, model):
        parts.append(chunk)
    return "".join(parts)


async def import_txt(content: str, llm: LLMProvider, model: str) -> str:
    """Convert plain text to structured LaTeX."""
    prompt = _import_system_prompt() + f"\n\nConvert the following text to LaTeX:\n\n{content}"
    return await _collect_stream(llm, [{"role": "user", "content": prompt}], model)


async def import_docx(file_bytes: bytes, filename: str, llm: LLMProvider, model: str) -> dict:
    """Convert Word document to LaTeX. Returns {path: content} dict for project files."""
    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        result = subprocess.run(
            ["pandoc", tmp_path, "--to", "latex", "--wrap=none"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        tex = result.stdout if result.returncode == 0 else ""

        prompt = (
            _import_system_prompt()
            + f"\n\nRefine this pandoc-converted LaTeX. Fix formulas, tables, and Chinese typesetting:\n\n{tex}"
        )
        refined = await _collect_stream(llm, [{"role": "user", "content": prompt}], model)

        stem = Path(filename).stem
        return {f"{stem}.tex": refined}
    finally:
        Path(tmp_path).unlink(missing_ok=True)


async def import_image(
    image_bytes: bytes, llm: LLMProvider, model: str, filename: str = "image.png"
) -> dict:
    """Convert image to LaTeX (formula OCR or figure insertion).
    Returns {path: content} dict for project files.
    Also returns the image filename for saving separately."""
    b64 = base64.b64encode(image_bytes).decode()

    classify_prompt = """Classify this image as one of: "formula", "chart", "photo".
Reply with only the classification word."""

    image_type = (await llm.vision(b64, classify_prompt, model)).strip().lower()

    safe_name = filename.replace(" ", "_")

    if image_type == "formula":
        formula_prompt = """Convert the mathematical formula in this image to LaTeX code.
Return ONLY the LaTeX math expression, no preamble, no document class, no explanations.
For inline formulas, return just the math. For display formulas, wrap in \\[...\\]."""
        latex = (await llm.vision(b64, formula_prompt, model)).strip()
        return {"formula_output.tex": latex}

    else:
        caption_prompt = (
            "Describe this image in one concise sentence suitable for a LaTeX \\caption{}."
        )
        caption = (await llm.vision(b64, caption_prompt, model)).strip()
        # Write to a separate file — never overwrite main.tex
        stem = Path(filename).stem
        figure_code = f"""\\begin{{figure}}[htbp]
\\centering
\\includegraphics[width=0.8\\textwidth]{{{safe_name}}}
\\caption{{{caption}}}
\\label{{fig:{stem}}}
\\end{{figure}}
"""
        return {f"fig_{stem}.tex": figure_code}


async def import_table(
    file_bytes: bytes, filename: str, llm: LLMProvider, model: str
) -> dict:
    """Convert CSV/Excel table to LaTeX booktabs format."""
    import pandas as pd

    if filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(file_bytes))
    else:
        df = pd.read_excel(io.BytesIO(file_bytes))

    csv_text = df.to_csv(index=False)
    prompt = f"""Convert this CSV data to a LaTeX table using \\booktabs format.
Include \\toprule, \\midrule, \\bottomrule. Center-align all columns.
Return ONLY the \\begin{{tabular}}...\\end{{tabular}} code block, nothing else.

Data:
{csv_text}"""

    latex = await _collect_stream(llm, [{"role": "user", "content": prompt}], model)

    table_code = f"""\\begin{{table}}[htbp]
\\centering
{latex.strip()}
\\caption{{}}
\\label{{tab:{Path(filename).stem}}}
\\end{{table}}
"""
    return {"main.tex": table_code}


def _import_system_prompt() -> str:
    return """You are a LaTeX expert. Follow these rules:
1. Use \\documentclass{{article}} with \\usepackage[UTF8]{{ctex}} for Chinese documents
2. Use amsmath, amssymb, graphicx, booktabs, hyperref packages
3. Use semantic markup: \\section{{}}, \\subsection{{}}, \\begin{{enumerate}}, etc.
4. Use \\begin{{table}} with \\booktabs for tables
5. Use \\begin{{figure}} with \\includegraphics for images
6. Use \\cite{{}} and \\bibliography{{}} for references
7. Output complete, compilable LaTeX code"""
