import base64
from pathlib import Path
from typing import Any

from app.latex import decode_text_bytes
from app.settings import get_settings
from app.store import normalize_path, store


TEXT_EXTENSIONS = {
    "",
    ".tex",
    ".sty",
    ".cls",
    ".bib",
    ".bst",
    ".bbx",
    ".cbx",
    ".cfg",
    ".def",
    ".clo",
    ".dtx",
    ".ins",
    ".md",
    ".txt",
    ".lua",
    ".mk",
}
BINARY_EXTENSIONS = {".png", ".jpg", ".jpeg", ".pdf", ".eps", ".svg"}
SKIP_DIRS = {".git", ".github", ".vscode", "test", "testfiles", "docs", "doc", "__pycache__"}


MATERIAL_TEMPLATES: list[dict[str, Any]] = [
    {
        "folder": "SJTUThesis-master",
        "source_id": "material:sjtu-thesis",
        "name": "SJTU Thesis",
        "description": "Shanghai Jiao Tong University thesis template from local material.",
        "category": "thesis",
        "language": "zh",
        "main": "main.tex",
    },
    {
        "folder": "thuthesis-master",
        "source_id": "material:thuthesis",
        "name": "ThuThesis",
        "description": "Tsinghua University thesis template from local material.",
        "category": "thesis",
        "language": "zh",
        "main": "thuthesis-example.tex",
    },
    {
        "folder": "ustcthesis-master",
        "source_id": "material:ustcthesis",
        "name": "USTC Thesis",
        "description": "University of Science and Technology of China thesis template from local material.",
        "category": "thesis",
        "language": "zh",
        "main": "main.tex",
    },
    {
        "folder": "zjuthesis-master",
        "source_id": "material:zjuthesis",
        "name": "ZJU Thesis",
        "description": "Zhejiang University thesis template from local material.",
        "category": "thesis",
        "language": "zh",
        "main": "zjuthesis.tex",
    },
    {
        "folder": "Russian-Phd-LaTeX-Dissertation-Template-master",
        "source_id": "material:russian-phd",
        "name": "Russian PhD Dissertation",
        "description": "Russian PhD dissertation template from local material.",
        "category": "thesis",
        "language": "universal",
        "main": "dissertation.tex",
    },
]


def material_template_roots(configured_dir: str) -> list[Path]:
    project_root = Path(__file__).resolve().parents[2]
    candidates = [
        Path(configured_dir).expanduser(),
        project_root / "material",
        project_root.parent / "material",
    ]

    roots: list[Path] = []
    seen: set[str] = set()
    for candidate in candidates:
        resolved = candidate if candidate.is_absolute() else (project_root / candidate).resolve()
        key = str(resolved).lower()
        if key not in seen:
            seen.add(key)
            roots.append(resolved)
    return roots


def seed_material_templates() -> list[str]:
    settings = get_settings()
    root = next((candidate for candidate in material_template_roots(settings.material_template_dir) if candidate.exists()), None)
    if root is None:
        return []
    seeded: list[str] = []
    for meta in MATERIAL_TEMPLATES:
        template_dir = root / meta["folder"]
        if not template_dir.exists():
            continue
        files = collect_template_files(template_dir, meta["main"])
        if not files:
            continue
        store.upsert_template(meta, files)
        seeded.append(meta["name"])
    return seeded


def collect_template_files(template_dir: Path, main_file: str) -> list[dict[str, Any]]:
    files: list[dict[str, Any]] = []
    has_main_tex = False
    main_file = normalize_path(main_file)

    for path in template_dir.rglob("*"):
        if path.is_dir():
            continue
        relative_parts = path.relative_to(template_dir).parts
        if any(part in SKIP_DIRS for part in relative_parts):
            continue
        rel = normalize_path(str(path.relative_to(template_dir)))
        ext = path.suffix.lower()
        if ext in TEXT_EXTENSIONS or path.name in {"Makefile", "latexmkrc", ".latexmkrc"}:
            if path.stat().st_size > 1_500_000:
                continue
            content = decode_text_bytes(path.read_bytes())
            files.append({"path": rel, "content": content, "is_binary": False, "size": len(content)})
            has_main_tex = has_main_tex or rel == "main.tex"
        elif ext in BINARY_EXTENSIONS:
            if path.stat().st_size > 3_000_000:
                continue
            raw = path.read_bytes()
            files.append(
                {
                    "path": rel,
                    "content": None,
                    "is_binary": True,
                    "data_base64": base64.b64encode(raw).decode("ascii"),
                    "size": len(raw),
                }
            )

    if not has_main_tex and main_file:
        files.insert(0, {"path": "main.tex", "content": f"\\input{{{main_file}}}\n", "is_binary": False, "size": len(main_file) + 9})
    return files
