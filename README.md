# AI LaTeX Editor — Smart LaTeX Editor

An AI-powered online LaTeX editor featuring multi-model chat, one-click material import for automatic paper generation, and real-time PDF preview. Frontend: React 18 + TypeScript. Backend: FastAPI + PostgreSQL.

## Features

- **AI-Assisted Writing** — Supports OpenAI / Claude / DeepSeek. Chat-based LaTeX generation and editing. Code blocks carry `file=` attributes; click "Apply" to write into the editor.
- **Smart Import** — Upload txt, md, docx, png/jpg, csv/xlsx files and auto-convert to LaTeX (text typesetting, math formula OCR, table generation, figure captions).
- **Live Compile & Preview** — Powered by latexmk + xelatex with Chinese typesetting support. Renders PDF via pdf.js onto canvas — no browser PDF plugin needed.
- **Template System** — Create projects from built-in templates. Upload custom templates as ZIP archives via admin panel.
- **Auto-Save & Auto-Compile** — 2-second debounced auto-save. Optional auto-compile for live preview.
- **Dark Mode** — Light/dark theme toggle with warm Stone color palette.
- **Chinese Localization** — Full Chinese UI. Supports `\usepackage[UTF8]{ctex}` for Chinese documents.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Frontend)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐ │
│  │ CodeMirror│ │ AI Chat  │ │  PDF Preview (pdf.js)│ │
│  │  LaTeX   │ │ SSE Stream│ │  Canvas rendering    │ │
│  │  Editor  │ │ react-md │ │  ?v=N cache busting  │ │
│  └────┬─────┘ └────┬─────┘ └─────────┬────────────┘ │
│       │            │               │               │
│       │  Zustand state (compileVersion counter)     │
└───────┼────────────┼───────────────┼───────────────┘
        │            │               │
┌───────┼────────────┼───────────────┼───────────────┐
│       ▼            ▼               ▼                │
│  ┌──────────────────────────────────────────────┐   │
│  │              FastAPI Backend                   │   │
│  │  /api/projects  /api/files  /api/compile      │   │
│  │  /api/auth  /api/ai  /api/templates           │   │
│  └───────────────────┬──────────────────────────┘   │
│                      │                              │
│  ┌───────────────────┼──────────────────────────┐   │
│  │  AI Service Layer  │  Compile Service          │   │
│  │  OpenAI/Claude/   │  latexmk + xelatex         │   │
│  │  DeepSeek (httpx) │  subprocess.run + thread   │   │
│  └───────────────────┴──────────────────────────┘   │
│                      │                              │
│  ┌───────────────────┴──────────────────────────┐   │
│  │  PostgreSQL (asyncpg + SQLAlchemy async)      │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Key Design Decisions

**compileVersion Counter Pattern**
The frontend Zustand store maintains a `compileVersion` integer, incremented after every compile (success or failure). The PDF preview component appends this value to the PDF URL (`?v=N`) for cache busting and watches it in its useEffect dependency array to trigger re-fetching. This avoids manual PDF cache lifecycle management.

**AI Code Block Pre-Parsing**
react-markdown v9 stores fenced code block info strings (e.g., `latex file=main.tex`) on the parent `<pre>` node's metadata, which is inaccessible from the custom `<code>` renderer. ChatMessage pre-parses the raw markdown with regex before rendering, building a `content → {language, targetFile}` lookup map. It then matches by code content in the renderer to recover file target information.

**Windows Subprocess Execution**
On Windows, uvicorn defaults to `SelectorEventLoop`, which does NOT support subprocesses and raises `NotImplementedError`. The workaround uses `subprocess.run()` wrapped in `asyncio.to_thread()`, executing compilation in a thread pool and completely bypassing the event loop limitation.

**pdf.js Worker Localization**
The pdf.js worker is imported locally via Vite's `?url` import syntax (`import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url"`), avoiding dependency on external CDN URLs that may be inaccessible in certain network environments.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend Framework | React 18 + TypeScript 5 |
| Build Tool | Vite 5 |
| Styling | Tailwind CSS 3.4 (Stone warm palette) |
| State Management | Zustand 4 (partial localStorage persistence) |
| Editor | CodeMirror 6 + codemirror-lang-latex |
| PDF Rendering | pdfjs-dist 5 (local worker) |
| Markdown | react-markdown 9 (custom code block renderer) |
| Routing | react-router-dom 6 |
| Layout | react-resizable-panels (draggable split panes) |
| Backend Framework | FastAPI 0.115 |
| Database | PostgreSQL 16 + SQLAlchemy 2 async + asyncpg |
| Migrations | Alembic |
| Auth | JWT (python-jose) + bcrypt |
| AI Integration | httpx streaming requests |
| LaTeX Compilation | latexmk + xelatex (CTeX support) |
| Deployment | Docker Compose |

## Quick Start

### Prerequisites

- **Docker** (for PostgreSQL) — the easiest way to run the database
- Python 3.11+ (at `F:/python/python.exe` on Windows)
- Node.js 22+
- LaTeX distribution (TeX Live recommended, with xelatex, latexmk, ctex packages)

### 1. Install Dependencies

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### 2. Configure Environment

```bash
# 复制配置模板并填写（首次使用必须执行）
cd backend
cp .env.example .env
```

> The `.env` file contains database connection info. Open it and edit if you're using your own PostgreSQL (default works with the Docker setup below).

### 3. Start PostgreSQL (REQUIRED FIRST)

```bash
# From the project root
docker compose up -d db
```

Verify:
```bash
docker ps --filter "name=db" --format "{{.Status}}"
# Should show: Up X seconds
```

> Windows port 5432/5433 is often reserved. docker-compose uses port 15432 instead.

### 4. Initialize Database Tables

```bash
cd backend
python -m alembic upgrade head
# Windows: use F:/python/python.exe instead of python
```

> `ModuleNotFoundError: No module named 'app'` = not in `backend/` directory. `cd backend` first.

### 5. Start the Backend

```bash
# Terminal 1 — from backend/
cd backend
F:/python/python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 6. Start the Frontend

```bash
# Terminal 2 — from frontend/
cd frontend
npm run dev
```

Open `http://localhost:3000` in your browser.

### All-in-One Docker Deployment

To run everything in containers (database + backend + frontend):

```bash
docker compose up -d
```

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Connect call failed (127.0.0.1, 5432)` | PostgreSQL isn't running. Run `docker compose up -d db` first |
| `Connect call failed` with wrong port | `.env` missing or misconfigured. Run `cp .env.example .env` in `backend/` |
| `ModuleNotFoundError: No module named 'app'` (alembic) | Run from `backend/` directory: `cd backend && python -m alembic upgrade head` |
| Port 5432/5433 "bind: access permissions" | Windows reserves these ports. docker-compose already uses port 15432 |
| `npm run dev` fails with ENOENT | Run `npm install` in the frontend directory first |
| LaTeX compilation fails | Check that xelatex and latexmk are installed and on PATH |

## Usage Guide

### Creating a Project

1. Click "New Project" on the landing page, enter a project name
2. Or select a template from the template gallery
3. A skeleton `main.tex` is auto-created with CTeX Chinese support

### Editing & Compiling

1. Select a file in the left file tree, edit LaTeX in the center CodeMirror editor
2. Click "Compile" in the toolbar — `latexmk -xelatex` runs in the background
3. Toggle "Auto" to auto-compile on every save
4. An amber dot next to the filename indicates unsaved changes

### AI Chat

1. Click "API Key" in the top bar and enter your LLM API key
   - OpenAI: `sk-*` prefix, auto-detected
   - Claude: `sk-ant-*` prefix, auto-detected
   - DeepSeek: select the DeepSeek provider
2. Open the right AI panel and type your request (e.g., "Write a survey on quantum computing")
3. Code blocks in the AI response show target filenames (`latex file=main.tex`) — click "Apply" to insert into the editor
4. The AI can generate multiple files at once; apply each independently

### Importing Files

Click the "Import" button. Supported formats:

| Format | Pipeline |
|--------|----------|
| `.txt` `.md` | AI converts to structured LaTeX |
| `.docx` | pandoc initial conversion + AI refinement |
| `.png` `.jpg` `.gif` | Vision classification: formula → OCR, chart/photo → figure environment |
| `.csv` `.xlsx` | Converts to booktabs-formatted table |
| `.bib` `.tex` `.cls` `.sty` | Direct upload, no conversion |

### Template Management

- `/templates` — Browse the template gallery
- `/admin/templates` — Upload custom templates (ZIP archives with complete LaTeX projects)

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/guest` | Guest login |
| GET | `/api/auth/me` | Current user info |
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/{id}` | Get project details |
| PUT | `/api/projects/{id}` | Update project |
| DELETE | `/api/projects/{id}` | Delete project |
| GET | `/api/projects/{pid}/files` | List files |
| POST | `/api/projects/{pid}/files` | Create file |
| PUT | `/api/projects/{pid}/files/{fid}` | Update file content |
| POST | `/api/projects/{pid}/files/upload` | Upload file |
| POST | `/api/projects/{pid}/compile` | Trigger compilation |
| GET | `/api/projects/{pid}/compile/{job_id}` | Check compile status |
| GET | `/api/projects/{pid}/pdf` | Get latest PDF |
| POST | `/api/projects/{pid}/ai/chat` | AI chat (SSE stream) |
| POST | `/api/projects/{pid}/ai/import` | AI smart import |
| GET | `/api/templates` | List templates |
| GET | `/api/projects/{pid}/export/tex` | Export project as ZIP |
| GET | `/api/projects/{pid}/export/pdf` | Export as PDF |

## Known Issues & Notes

1. **Windows Python Path** — The Windows Store `python.exe` alias may not work. Use the full Python installation path.
2. **CDN Accessibility** — pdf.js resources are bundled locally; no external CDN access required.
3. **Compile Timeout** — Default is 60 seconds. Adjust via the `COMPILE_TIMEOUT` environment variable for large documents.
4. **Chinese Support** — Requires TeX Live's ctex package (`texlive-lang-chinese`).

## Project Structure

```
NEW/
├── backend/
│   ├── app/
│   │   ├── api/         # REST endpoint layer
│   │   ├── models/      # SQLAlchemy ORM models
│   │   ├── schemas/     # Pydantic validation schemas
│   │   ├── services/    # Business logic layer
│   │   │   ├── ai/      # LLM providers (OpenAI/Claude/DeepSeek)
│   │   │   └── ...
│   │   ├── middleware/   # Middleware (LLM key extraction)
│   │   ├── config.py
│   │   ├── database.py
│   │   └── main.py      # App entry point
│   ├── alembic/         # Database migrations
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/         # HTTP client layer
│   │   ├── store/       # Zustand state management
│   │   ├── components/  # React components
│   │   │   ├── ai/      # AI chat panel
│   │   │   ├── auth/    # Login/authentication
│   │   │   ├── editor/  # CodeMirror editor
│   │   │   ├── layout/  # Layout components
│   │   │   ├── preview/ # PDF preview
│   │   │   └── templates/ # Template cards
│   │   ├── pages/       # Page components
│   │   └── main.tsx
│   ├── tailwind.config.js
│   └── package.json
└── docker-compose.yml
```
