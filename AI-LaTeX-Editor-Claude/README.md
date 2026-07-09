# AI LaTeX Editor Claude Rebuild

这是对原 `AI-LaTeX Editor` 的重构版本。它保留原项目的核心功能：项目管理、文件 workspace、LaTeX 编辑、PDF 编译预览、AI 对话/生成、模板上传、源码/PDF 导出、用户自带 API key。

这版重点改了两件事：

- **架构更轻**：后端从 PostgreSQL 首发改成 local-first JSON 存储，API 路径基本延续旧版，单机论文编辑器不再必须先启动数据库。
- **体验重做**：前端不沿用旧页面风格，改成温暖纸面、细边界、低饱和陶土色重点按钮的 Claude-like workbench。

## 功能保留

- 项目创建、重命名、最近项目列表
- 文件创建、删除、拖拽/按钮导入
- 上传只做 workspace 暂存，不在导入时让 AI 改写材料
- CodeMirror LaTeX 编辑，自动保存
- `latexmk -xelatex` 编译，pdf.js 本地 worker 渲染预览
- OpenAI / Claude / DeepSeek 兼容的流式 AI 对话
- 显式 `生成 main.tex`，由 AI 汇总所有暂存材料
- AI 回复中的 `file=main.tex` 代码块可手动应用到目标文件
- ZIP 模板上传与模板创建项目
- 导出 LaTeX ZIP 与最新 PDF
- 访客会话、注册/登录 API

## 新增/改进

- **local-first 数据层**：`backend/data/store.json` 保存项目元数据，二进制资源保存在 `backend/uploads/`。
- **活动日志**：编辑页右下角记录导入、保存、生成、编译等关键动作。
- **更稳的编译错误**：后端抽取 LaTeX 日志里的 `!`、`file:line:`、fatal 信息。
- **明确的 AI 边界**：普通上传永远不触发 AI；只有 AI 对话、AI import、生成 main.tex 会访问模型。
- **API key 不进后端存储**：前端只把 key 存在当前浏览器 localStorage，每次请求通过请求头传给后端。

## 技术栈

| 层 | 技术 |
| --- | --- |
| Frontend | React 18, TypeScript, Vite |
| UI | Plain CSS, lucide-react icons |
| Editor | CodeMirror 6, codemirror-lang-latex |
| Preview | pdfjs-dist local worker |
| State | Zustand |
| Backend | FastAPI, Pydantic Settings |
| Storage | Local JSON + filesystem assets |
| AI | httpx streaming for OpenAI-compatible, Claude, DeepSeek |
| Compile | latexmk + xelatex |

## 本地运行

### 1. 后端

```powershell
cd backend
copy .env.example .env
F:/python/python.exe -m pip install -r requirements.txt
F:/python/python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

`MATERIAL_TEMPLATE_DIR` controls the optional local template seed folder. By default the app looks for `material` inside the rebuilt project, and also falls back to a sibling `material` folder if it exists.

需要本机已安装 TeX Live，并且 `latexmk`、`xelatex` 在 PATH 里。DOCX 智能导入需要 `pandoc`。

### 2. 前端

```powershell
cd frontend
npm install
npm run dev
```

访问 `http://localhost:5173`。

### 带日志启动

```powershell
.\scripts\start-dev.ps1
```

日志会写入：

- `logs/backend.log`
- `logs/backend.err.log`
- `logs/frontend.log`
- `logs/frontend.err.log`

## Docker 运行

```powershell
docker compose up --build
```

后端镜像会安装 TeX Live 中文相关包，首次构建时间会比较长。

## API 兼容入口

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/{project_id}/files`
- `POST /api/projects/{project_id}/files/upload`
- `POST /api/projects/{project_id}/compile`
- `GET /api/projects/{project_id}/pdf`
- `POST /api/projects/{project_id}/ai/chat`
- `POST /api/projects/{project_id}/ai/generate`
- `GET /api/templates`
- `POST /api/admin/templates`
- `GET /api/projects/{project_id}/export/tex`
- `GET /api/projects/{project_id}/export/pdf`

## 设计说明

这版不是 landing page，而是直接进入可工作的项目台。Claude-like 的部分主要体现在：

- 暖色纸面背景，不使用旧版蓝色仪表盘感
- 低对比但清楚的边界、窄工具栏、细粒度工作状态
- 图标按钮优先，文字按钮只用于明确命令
- 主工作流围绕“导入材料 -> 显式生成 -> 手动应用 -> 编译预览”

## 已验证

- `backend/app` Python AST 语法检查通过
- 后端 `import app.main` 通过
- 前端 `npm run build` 通过

构建提示中 pdf.js worker 体积较大，这是预期现象；后续可以按路由拆分 PDF 预览代码。
