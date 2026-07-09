import json
import threading
import uuid
import base64
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.settings import get_settings


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_path(path: str) -> str:
    clean = path.replace("\\", "/").strip().lstrip("/")
    parts = [part for part in clean.split("/") if part and part != "."]
    if not parts or any(part == ".." for part in parts) or ":" in clean:
        raise ValueError("Invalid file path")
    return "/".join(parts)


def detect_file_type(path: str) -> str:
    ext = Path(path).suffix.lower()
    if ext in {".tex", ".bib", ".cls", ".sty"}:
        return ext[1:]
    if ext in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}:
        return "img"
    return "other"


def default_main_tex() -> str:
    return r"""\documentclass{article}
\usepackage[UTF8]{ctex}
\usepackage{amsmath,amssymb,amsthm}
\usepackage{graphicx}
\usepackage{booktabs}
\usepackage{hyperref}
\usepackage{geometry}
\usepackage{csquotes}

\title{Untitled Document}
\author{}
\date{\today}

\begin{document}
\maketitle

\section{Introduction}

\end{document}
"""


class JsonStore:
    def __init__(self) -> None:
        settings = get_settings()
        self.data_dir = Path(settings.data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.path = self.data_dir / "store.json"
        self._lock = threading.RLock()
        if not self.path.exists():
            self._save(
                {
                    "users": [],
                    "projects": [],
                    "files": [],
                    "compile_jobs": [],
                    "templates": [],
                    "template_files": [],
                }
            )

    def _load(self) -> dict[str, list[dict[str, Any]]]:
        with self._lock:
            return json.loads(self.path.read_text(encoding="utf-8"))

    def _save(self, data: dict[str, list[dict[str, Any]]]) -> None:
        with self._lock:
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            tmp.replace(self.path)

    def _mutate(self, fn):
        data = self._load()
        result = fn(data)
        self._save(data)
        return result

    def create_user(
        self,
        username: str | None,
        password_hash: str | None,
        email: str | None = None,
        is_guest: bool = False,
    ) -> dict[str, Any]:
        def op(data):
            if username and any(u.get("username") == username for u in data["users"]):
                raise ValueError("Username already exists")
            user = {
                "id": str(uuid.uuid4()),
                "username": username,
                "email": email,
                "password_hash": password_hash,
                "is_admin": False,
                "is_guest": is_guest,
                "created_at": utcnow(),
            }
            data["users"].append(user)
            return user

        return self._mutate(op)

    def get_user(self, user_id: str | None) -> dict[str, Any] | None:
        if not user_id:
            return None
        return next((u for u in self._load()["users"] if u["id"] == user_id), None)

    def get_user_by_username(self, username: str) -> dict[str, Any] | None:
        return next((u for u in self._load()["users"] if u.get("username") == username), None)

    def list_projects(self, user_id: str | None) -> list[dict[str, Any]]:
        projects = self._load()["projects"]
        filtered = [p for p in projects if p.get("user_id") == user_id]
        return sorted(filtered, key=lambda p: p["updated_at"], reverse=True)

    def get_project(self, project_id: str) -> dict[str, Any] | None:
        return next((p for p in self._load()["projects"] if p["id"] == project_id), None)

    def create_project(self, name: str, user_id: str | None = None, template_id: str | None = None) -> dict[str, Any]:
        def op(data):
            project = {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "name": name or "Untitled Project",
                "template_id": template_id,
                "main_file": "main.tex",
                "created_at": utcnow(),
                "updated_at": utcnow(),
            }
            data["projects"].append(project)
            template_files = [tf for tf in data["template_files"] if tf["template_id"] == template_id]
            if template_files:
                for tf in template_files:
                    path = normalize_path(tf["path"])
                    content = tf.get("content")
                    file_type = detect_file_type(path)
                    data["files"].append(
                        {
                            "id": str(uuid.uuid4()),
                            "project_id": project["id"],
                            "path": path,
                            "content": content if not tf.get("is_binary") else None,
                            "file_type": file_type,
                            "size": int(tf.get("size") or len(content or "")),
                            "created_at": utcnow(),
                            "updated_at": utcnow(),
                        }
                    )
                    if tf.get("is_binary") and tf.get("data_base64"):
                        settings = get_settings()
                        dest = Path(settings.upload_dir) / project["id"] / path
                        dest.parent.mkdir(parents=True, exist_ok=True)
                        dest.write_bytes(base64.b64decode(tf["data_base64"]))
            if not any(f["project_id"] == project["id"] and f["path"] == "main.tex" for f in data["files"]):
                data["files"].append(
                    {
                        "id": str(uuid.uuid4()),
                        "project_id": project["id"],
                        "path": "main.tex",
                        "content": default_main_tex(),
                        "file_type": "tex",
                        "size": len(default_main_tex()),
                        "created_at": utcnow(),
                        "updated_at": utcnow(),
                    }
                )
            return project

        return self._mutate(op)

    def update_project(self, project_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        def op(data):
            project = next((p for p in data["projects"] if p["id"] == project_id), None)
            if not project:
                return None
            for key in ("name", "main_file"):
                if updates.get(key) is not None:
                    project[key] = updates[key]
            project["updated_at"] = utcnow()
            return project

        return self._mutate(op)

    def delete_project(self, project_id: str) -> bool:
        def op(data):
            before = len(data["projects"])
            data["projects"] = [p for p in data["projects"] if p["id"] != project_id]
            data["files"] = [f for f in data["files"] if f["project_id"] != project_id]
            data["compile_jobs"] = [j for j in data["compile_jobs"] if j["project_id"] != project_id]
            return len(data["projects"]) != before

        return self._mutate(op)

    def list_files(self, project_id: str) -> list[dict[str, Any]]:
        files = [f for f in self._load()["files"] if f["project_id"] == project_id]
        return sorted(files, key=lambda f: (f["file_type"], f["path"]))

    def get_file(self, file_id: str) -> dict[str, Any] | None:
        return next((f for f in self._load()["files"] if f["id"] == file_id), None)

    def get_file_by_path(self, project_id: str, path: str) -> dict[str, Any] | None:
        path = normalize_path(path)
        return next((f for f in self._load()["files"] if f["project_id"] == project_id and f["path"] == path), None)

    def unique_path(self, project_id: str, desired: str) -> str:
        desired = normalize_path(desired)
        if not self.get_file_by_path(project_id, desired):
            return desired
        p = Path(desired)
        stem = p.with_suffix("").as_posix()
        suffix = p.suffix
        n = 1
        while self.get_file_by_path(project_id, f"{stem}_{n}{suffix}"):
            n += 1
        return f"{stem}_{n}{suffix}"

    def create_file(self, project_id: str, path: str, content: str | None, file_type: str | None = None, size: int | None = None) -> dict[str, Any]:
        path = normalize_path(path)

        def op(data):
            if any(f for f in data["files"] if f["project_id"] == project_id and f["path"] == path):
                raise ValueError(f"File already exists: {path}")
            now = utcnow()
            item = {
                "id": str(uuid.uuid4()),
                "project_id": project_id,
                "path": path,
                "content": content,
                "file_type": file_type or detect_file_type(path),
                "size": size if size is not None else len(content or ""),
                "created_at": now,
                "updated_at": now,
            }
            data["files"].append(item)
            for project in data["projects"]:
                if project["id"] == project_id:
                    project["updated_at"] = now
            return item

        return self._mutate(op)

    def update_file(self, file_id: str, content: str) -> dict[str, Any] | None:
        def op(data):
            item = next((f for f in data["files"] if f["id"] == file_id), None)
            if not item:
                return None
            item["content"] = content
            item["size"] = len(content or "")
            item["updated_at"] = utcnow()
            for project in data["projects"]:
                if project["id"] == item["project_id"]:
                    project["updated_at"] = item["updated_at"]
            return item

        return self._mutate(op)

    def delete_file(self, file_id: str) -> bool:
        def op(data):
            before = len(data["files"])
            data["files"] = [f for f in data["files"] if f["id"] != file_id]
            return len(data["files"]) != before

        return self._mutate(op)

    def create_compile_job(self, project_id: str) -> dict[str, Any]:
        def op(data):
            job = {
                "id": str(uuid.uuid4()),
                "project_id": project_id,
                "status": "running",
                "log": None,
                "pdf_path": None,
                "error_msg": None,
                "created_at": utcnow(),
            }
            data["compile_jobs"].append(job)
            return job

        return self._mutate(op)

    def update_compile_job(self, job_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        def op(data):
            job = next((j for j in data["compile_jobs"] if j["id"] == job_id), None)
            if not job:
                return None
            job.update(updates)
            return job

        return self._mutate(op)

    def get_compile_job(self, job_id: str) -> dict[str, Any] | None:
        return next((j for j in self._load()["compile_jobs"] if j["id"] == job_id), None)

    def latest_pdf(self, project_id: str) -> str | None:
        jobs = [
            j
            for j in self._load()["compile_jobs"]
            if j["project_id"] == project_id and j["status"] == "done" and j.get("pdf_path")
        ]
        if not jobs:
            return None
        return sorted(jobs, key=lambda j: j["created_at"], reverse=True)[0]["pdf_path"]

    def list_templates(self) -> list[dict[str, Any]]:
        templates = [t for t in self._load()["templates"] if t.get("is_public", True)]
        return sorted(templates, key=lambda t: (t.get("category", ""), t["name"]))

    def get_template(self, template_id: str) -> dict[str, Any] | None:
        data = self._load()
        tpl = next((t for t in data["templates"] if t["id"] == template_id), None)
        if not tpl:
            return None
        files = [f for f in data["template_files"] if f["template_id"] == template_id]
        return {**tpl, "files": files}

    def create_template(self, meta: dict[str, Any], files: list[dict[str, Any]]) -> dict[str, Any]:
        def op(data):
            now = utcnow()
            tpl = {
                "id": meta.get("id") or str(uuid.uuid4()),
                "source_id": meta.get("source_id"),
                "name": meta["name"],
                "description": meta.get("description") or "",
                "category": meta.get("category") or "other",
                "language": meta.get("language") or "universal",
                "thumbnail_url": None,
                "is_public": True,
                "created_at": now,
            }
            data["templates"].append(tpl)
            for f in files:
                data["template_files"].append(
                    {
                        "id": str(uuid.uuid4()),
                        "template_id": tpl["id"],
                        "path": normalize_path(f["path"]),
                        "content": f.get("content", ""),
                        "is_binary": bool(f.get("is_binary")),
                        "data_base64": f.get("data_base64"),
                        "size": int(f.get("size") or len(f.get("content") or "")),
                    }
                )
            return tpl

        return self._mutate(op)

    def upsert_template(self, meta: dict[str, Any], files: list[dict[str, Any]]) -> dict[str, Any]:
        source_id = meta.get("source_id")

        def op(data):
            now = utcnow()
            existing = None
            if source_id:
                existing = next((t for t in data["templates"] if t.get("source_id") == source_id), None)
            if not existing:
                existing = next(
                    (
                        t
                        for t in data["templates"]
                        if t.get("name") == meta["name"] and t.get("category") == meta.get("category", "other")
                    ),
                    None,
                )
            if existing:
                existing.update(
                    {
                        "source_id": source_id or existing.get("source_id"),
                        "name": meta["name"],
                        "description": meta.get("description") or "",
                        "category": meta.get("category") or "other",
                        "language": meta.get("language") or "universal",
                        "thumbnail_url": meta.get("thumbnail_url"),
                        "is_public": True,
                    }
                )
                tpl = existing
                data["template_files"] = [f for f in data["template_files"] if f["template_id"] != tpl["id"]]
            else:
                tpl = {
                    "id": meta.get("id") or str(uuid.uuid4()),
                    "source_id": source_id,
                    "name": meta["name"],
                    "description": meta.get("description") or "",
                    "category": meta.get("category") or "other",
                    "language": meta.get("language") or "universal",
                    "thumbnail_url": meta.get("thumbnail_url"),
                    "is_public": True,
                    "created_at": now,
                }
                data["templates"].append(tpl)
            for f in files:
                data["template_files"].append(
                    {
                        "id": str(uuid.uuid4()),
                        "template_id": tpl["id"],
                        "path": normalize_path(f["path"]),
                        "content": f.get("content"),
                        "is_binary": bool(f.get("is_binary")),
                        "data_base64": f.get("data_base64"),
                        "size": int(f.get("size") or len(f.get("content") or "")),
                    }
                )
            return tpl

        return self._mutate(op)


store = JsonStore()
