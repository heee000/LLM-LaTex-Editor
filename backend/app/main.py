import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings

# Ensure directories exist
os.makedirs(settings.compile_dir, exist_ok=True)
os.makedirs(settings.upload_dir, exist_ok=True)
os.makedirs(settings.template_dir, exist_ok=True)

app = FastAPI(title="AI LaTeX Editor", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for compiled PDFs and uploads
app.mount("/static/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

from app.api.auth import router as auth_router
from app.api.projects import router as projects_router
from app.api.files import router as files_router
from app.api.compile import router as compile_router
from app.api.ai import router as ai_router
from app.api.templates import router as templates_router
from app.api.export import router as export_router

app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(files_router)
app.include_router(compile_router)
app.include_router(ai_router)
app.include_router(templates_router)
app.include_router(export_router)

@app.get("/api/health")
async def health():
    return {"status": "ok"}
