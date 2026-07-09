import csv
import io
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree

from app.store import detect_file_type, normalize_path


TEXT_EXTENSIONS = {".tex", ".bib", ".cls", ".sty", ".txt", ".md", ".csv"}
BINARY_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".pdf", ".docx", ".xlsx", ".zip"}


LATEX_SYSTEM_PROMPT = r"""You are a precise LaTeX project editor.

Return only fenced code blocks when you write files:
```latex file=main.tex
...
```

Rules:
- Generate complete compilable files, never diffs.
- Keep imports staged as source material until the user explicitly asks you to generate or apply code.
- Use \documentclass, \usepackage[UTF8]{ctex}, amsmath, amssymb, amsthm, graphicx, booktabs, hyperref, geometry, csquotes.
- Reference existing image assets by their exact project paths.
- For .bib files use ```bibtex file=refs.bib.
- Do not include explanations inside generated code blocks.
"""


def extract_first_code_block(text: str) -> str:
    match = re.search(r"```[^\n]*\n(.*?)```", text, re.DOTALL)
    return match.group(1).strip() if match else text.strip()


def extract_fenced_files(text: str) -> list[dict[str, str]]:
    files: list[dict[str, str]] = []
    for match in re.finditer(r"```([^\n`]*)\n(.*?)```", text, re.DOTALL):
        info = match.group(1).strip()
        content = match.group(2).strip()
        file_match = re.search(r"file=([^\s]+)", info)
        language = (info.split() or ["latex"])[0].lower()
        path = file_match.group(1) if file_match else ""
        if not path and language in {"latex", "tex"} and not files:
            path = "main.tex"
        if path:
            files.append({"path": path, "content": content})
    return files


def normalize_main_tex(text: str) -> str:
    content = repair_mojibake(extract_first_code_block(text))
    if "\\begin{document}" in content and "\\end{document}" in content:
        return content
    return "\n".join(
        [
            r"\documentclass{article}",
            r"\usepackage[UTF8]{ctex}",
            r"\usepackage{amsmath,amssymb,amsthm,graphicx,booktabs,hyperref,geometry,csquotes}",
            "",
            r"\begin{document}",
            content,
            r"\end{document}",
        ]
    )


def decode_text_bytes(data: bytes) -> str:
    candidates: list[str] = []
    for encoding in ("utf-8-sig", "utf-8", "gb18030", "gbk"):
        try:
            candidates.append(data.decode(encoding))
        except UnicodeDecodeError:
            continue
    if not candidates:
        return data.decode("utf-8", errors="replace")
    repaired = [repair_mojibake(candidate) for candidate in candidates]
    return min(repaired, key=mojibake_score)


def repair_mojibake(text: str) -> str:
    candidates = [text]
    for encoding in ("gb18030", "latin1", "cp1252"):
        try:
            candidates.append(text.encode(encoding).decode("utf-8"))
        except UnicodeError:
            continue
    return min(candidates, key=mojibake_score)


def mojibake_score(text: str) -> int:
    markers = ("锛", "锟", "瀹", "绔", "涓", "鈥", "俓", "圠", "�", "ä", "å", "æ", "ç", "è", "é", "â", "\u0080", "\u0085")
    return sum(text.count(marker) for marker in markers)


def sse(data: dict) -> str:
    import json

    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


def project_context(files: list[dict], max_chars: int = 120_000) -> tuple[str, list[str], list[str]]:
    parts: list[str] = []
    images: list[str] = []
    binaries: list[str] = []
    total = 0
    for f in files:
        if f.get("file_type") == "img":
            images.append(f["path"])
            continue
        if not f.get("content"):
            binaries.append(f["path"])
            continue
        block = f"\n=== {f['path']} ===\n{f['content']}\n"
        if total + len(block) > max_chars:
            remain = max_chars - total
            if remain > 0:
                parts.append(block[:remain] + "\n... (truncated)")
            break
        parts.append(block)
        total += len(block)
    return "".join(parts) if parts else "(no readable text files)", images, binaries


def generate_prompt(files: list[dict]) -> str:
    context, images, binaries = project_context(files)
    image_list = "\n".join(f"- {p}" for p in images) or "(none)"
    binary_list = "\n".join(f"- {p}" for p in binaries) or "(none)"
    return rf"""Below is a staged LaTeX workspace. Create a complete, compilable main.tex.

Images available:
{image_list}

Binary assets available but not readable:
{binary_list}

Project files:
{context}

Task:
- Produce a cohesive document that uses the staged source material.
- Do not overwrite assets.
- Include Chinese support with \usepackage[UTF8]{{ctex}}.
- Reference available images with \includegraphics{{exact/path}}.
- Return only one fenced block: ```latex file=main.tex ... ```
"""


def table_from_csv_bytes(data: bytes, filename: str) -> str:
    text = decode_text_bytes(data)
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    return table_rows_to_latex(rows, Path(filename).stem)


def table_rows_to_latex(rows: list[list[object]], stem: str) -> str:
    if not rows:
        return "% Empty table"
    col_count = max(len(row) for row in rows)
    align = "c" * col_count

    def esc(value: object) -> str:
        text = str(value if value is not None else "")
        return (
            text.replace("\\", r"\textbackslash{}")
            .replace("&", r"\&")
            .replace("%", r"\%")
            .replace("$", r"\$")
            .replace("#", r"\#")
            .replace("_", r"\_")
            .replace("{", r"\{")
            .replace("}", r"\}")
        )

    lines = [rf"\begin{{table}}[htbp]", r"\centering", rf"\begin{{tabular}}{{{align}}}", r"\toprule"]
    for i, row in enumerate(rows):
        padded = list(row) + [""] * (col_count - len(row))
        lines.append(" & ".join(esc(cell) for cell in padded) + r" \\")
        if i == 0:
            lines.append(r"\midrule")
    lines.extend([r"\bottomrule", r"\end{tabular}", r"\caption{}", rf"\label{{tab:{stem}}}", r"\end{table}"])
    return "\n".join(lines)


def read_template_zip(zip_bytes: bytes) -> list[dict[str, str]]:
    files: list[dict[str, str]] = []
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            path = normalize_path(info.filename)
            if Path(path).suffix.lower() in BINARY_EXTENSIONS:
                continue
            content = decode_text_bytes(zf.read(info))
            files.append({"path": path, "content": content})
    return files


def uploaded_file_type(filename: str) -> str:
    return detect_file_type(filename)


def extract_docx_text(file_bytes: bytes) -> str:
    paragraphs: list[str] = []
    with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
        document = zf.read("word/document.xml")
    root = ElementTree.fromstring(document)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    for paragraph in root.findall(".//w:p", ns):
        pieces = [node.text or "" for node in paragraph.findall(".//w:t", ns)]
        text = "".join(pieces).strip()
        if text:
            paragraphs.append(text)
    return "\n\n".join(paragraphs)
