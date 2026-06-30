  <p align="center">
    <a href="README.md">English</a> | <a href="README_CN.md">中文文档</a>
  </p>

# AI LaTeX Editor — 智能 LaTeX 编辑器

基于 AI 的在线 LaTeX 编辑器，支持多模型对话、一键导入素材自动生成论文、实时 PDF 预览。前端 React 18 + TypeScript，后端 FastAPI + PostgreSQL。

## 功能概览

- **AI 辅助写作** — 支持 OpenAI / Claude / DeepSeek 三大模型，对话式生成、修改 LaTeX 文档。代码块带 `file=` 属性，点击"应用"即可写入编辑器。
- **智能导入** — 上传 txt、md、docx、png/jpg、csv/xlsx 文件，自动转换为 LaTeX 代码（文本排版、数学公式 OCR、表格生成、图片配图）。
- **实时编译预览** — 基于 latexmk + xelatex，支持中文排版。编译结果通过 pdf.js 以 canvas 渲染，无需浏览器 PDF 插件。
- **模板系统** — 内置项目管理器，支持从模板创建项目，支持上传自定义模板（ZIP 包）。
- **自动保存与自动编译** — 编辑器 2 秒防抖自动保存，可选开启自动编译实时查看效果。
- **中文本地化** — 全界面中文，支持 `\usepackage[UTF8]{ctex}` 中文排版。
- **暗色模式** — 支持深浅色主题切换，使用温暖的 Stone 色系。

## 架构原理

```
┌─────────────────────────────────────────────────────┐
│                    浏览器 (前端)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐ │
│  │ CodeMirror│ │  AI 对话  │ │  PDF 预览 (pdf.js)  │ │
│  │  LaTeX    │ │  SSE 流式 │ │  canvas 渲染        │ │
│  │  编辑器   │ │ react-md │ │  ?v=N 缓存破坏      │ │
│  └────┬─────┘ └────┬─────┘ └─────────┬────────────┘ │
│       │            │               │               │
│       │  Zustand 状态管理 (compileVersion 计数器)    │
└───────┼────────────┼───────────────┼───────────────┘
        │            │               │
┌───────┼────────────┼───────────────┼───────────────┐
│       ▼            ▼               ▼                │
│  ┌──────────────────────────────────────────────┐   │
│  │              FastAPI 后端                      │   │
│  │  /api/projects  /api/files  /api/compile      │   │
│  │  /api/auth  /api/ai  /api/templates           │   │
│  └───────────────────┬──────────────────────────┘   │
│                      │                              │
│  ┌───────────────────┼──────────────────────────┐   │
│  │  AI 服务层         │  编译服务                  │   │
│  │  OpenAI/Claude/   │  latexmk + xelatex         │   │
│  │  DeepSeek (httpx) │  subprocess.run + 线程池     │   │
│  └───────────────────┴──────────────────────────┘   │
│                      │                              │
│  ┌───────────────────┴──────────────────────────┐   │
│  │  PostgreSQL (asyncpg + SQLAlchemy async)      │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 核心设计决策

**compileVersion 计数器模式**
前端 Zustand store 维护一个 `compileVersion` 整数。每次编译（无论成功或失败）后递增。PDF 预览组件将此值附加到 PDF URL 后方（`?v=N`）实现缓存破坏，并将其作为 useEffect 的依赖以触发重新加载。这避免了手动管理 PDF 缓存的生命周期。

**AI 代码块预解析**
react-markdown v9 将 fenced code block 的 info string（如 `latex file=main.tex`）存储在父级 `<pre>` 节点的元数据中，自定义 `<code>` 渲染器无法直接访问。因此 ChatMessage 组件在实际渲染前用正则表达式预解析原始 markdown，建立 `内容 → {语言, 目标文件}` 的查找映射表，在渲染器中通过内容匹配恢复文件目标信息。

**Windows 子进程执行**
Windows 上 uvicorn 默认使用 `SelectorEventLoop`，该事件循环不支持子进程（会抛出 `NotImplementedError`）。解决方式是用 `subprocess.run()` 配合 `asyncio.to_thread()`，在独立线程池中执行编译，完全绕过事件循环的限制。

**pdf.js 本地化**
由于 `cdnjs.cloudflare.com` 和 `cdn.jsdelivr.net` 在中国大陆无法访问，pdf.js worker 通过 Vite 的 `?url` 导入语法(`import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url"`) 本地化打包，避免 CDN 加载失败导致 PDF 无法渲染。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端框架 | React 18 + TypeScript 5 |
| 构建工具 | Vite 5 |
| 样式方案 | Tailwind CSS 3.4（Stone 暖色系） |
| 状态管理 | Zustand 4（部分持久化到 localStorage） |
| 编辑器 | CodeMirror 6 + codemirror-lang-latex |
| PDF 渲染 | pdfjs-dist 5（本地 worker） |
| Markdown | react-markdown 9（自定义 code block 渲染） |
| 路由 | react-router-dom 6 |
| 布局 | react-resizable-panels（可拖拽分栏） |
| 后端框架 | FastAPI 0.115 |
| 数据库 | PostgreSQL 16 + SQLAlchemy 2 async + asyncpg |
| 迁移 | Alembic |
| 认证 | JWT（python-jose）+ bcrypt |
| AI 集成 | httpx 流式请求 |
| LaTeX 编译 | latexmk + xelatex（支持中文） |
| 部署 | Docker Compose |

## 快速开始

### 环境要求

- **Docker**（用于运行 PostgreSQL 数据库）
- Python 3.11+（需要 `F:/python/python.exe`，Windows Store 别名不可用）
- Node.js 22+
- LaTeX 发行版（TeX Live 推荐，需包含 xelatex、latexmk、ctex 宏包）

### 1. 安装依赖

```bash
# 后端
cd backend
pip install -r requirements.txt

# 前端
cd frontend
npm install
```

### 2. 配置环境变量

```bash
# ⚠️ 首次使用必须执行：复制配置模板
cd backend
cp .env.example .env
```

> `.env` 文件包含数据库连接信息。如果你使用自建的 PostgreSQL，打开 `.env` 修改连接地址。
> 默认配置直接适用于 Docker 方式启动的数据库，无需额外修改。

### 3. 启动 PostgreSQL 数据库（必须先做！）

```bash
# 在项目根目录
docker compose up -d db
```

验证：
```bash
docker ps --filter "name=db" --format "{{.Status}}"
# 应该显示：Up X seconds
```

> Windows 的 5432/5433 端口常被系统保留，docker-compose 已改用 15432 端口。

### 4. 初始化数据库表

```bash
cd backend
python -m alembic upgrade head
# Windows 用 F:/python/python.exe 代替 python
```

> 报 `ModuleNotFoundError: No module named 'app'` = 不在 `backend/` 目录下，先 `cd backend`。

### 5. 启动后端

```bash
# 终端 1 —— 在 backend/ 目录下
cd backend
F:/python/python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

看到 `Application startup complete.` 即启动成功。

### 6. 启动前端

```bash
# 终端 2 —— 在 frontend/ 目录下
cd frontend
npm run dev
```

浏览器访问 `http://localhost:3000`。

### 故障排查

| 错误信息 | 原因 | 解决方法 |
|----------|------|----------|
| `Connect call failed (127.0.0.1, 5432)` | PostgreSQL 没启动 | 先执行 `docker compose up -d db` |
| `Connect call failed` 但端口是 5432 | `.env` 文件不存在或端口不对 | `cp .env.example .env`（已配置好 15432 端口） |
| `ModuleNotFoundError: No module named 'app'` | alembic 不在 backend 目录下运行 | `cd backend` 后再执行 |
| 端口 5432/5433 `bind: access permissions` | Windows 端口保留 | docker-compose 已改用 15432 端口 |
| `npm run dev` 报 ENOENT | 前端依赖未安装 | `cd frontend && npm install` |
| LaTeX 编译失败 | xelatex/latexmk 未安装 | 安装 TeX Live 并确保在 PATH 中 |

### Docker 一键部署（可选）

```bash
# 启动全部服务（数据库 + 后端 + 前端）
docker compose up -d
```

## 详细用法

### 创建项目

1. 在首页点击"新建项目"，输入项目名称
2. 或者从模板库选择合适的模板一键创建
3. 项目创建后自动包含一个 `main.tex` 骨架文件

### 编辑与编译

1. 左侧文件树选择文件，中间 CodeMirror 编辑器编辑 LaTeX 代码
2. 点击顶部"编译"按钮，后台执行 `latexmk -xelatex`，右侧实时显示 PDF
3. 开启"自动"编译开关后，每次保存自动触发编译
4. 编辑器 2 秒防抖自动保存，文件名旁显示琥珀色圆点表示未保存

### AI 对话

1. 点击顶栏"API 密钥"，填入 LLM API Key
   - OpenAI：`sk-*` 开头，自动识别
   - Claude：`sk-ant-*` 开头，自动识别
   - DeepSeek：选择 deepseek 提供商
2. 打开右侧 AI 面板，输入要求（例如："帮我写一篇关于量子计算的综述"）
3. AI 回复中的代码块标注了目标文件名（如 `latex file=main.tex`），点击"应用"按钮即可写入编辑器
4. AI 可以同时生成多个文件（main.tex、references.bib 等），分别点击应用

### 导入文件

点击"导入"按钮支持以下格式：

| 格式 | 处理方式 |
|------|---------|
| `.txt` `.md` | AI 转换为结构化 LaTeX |
| `.docx` | pandoc 初转 + AI 精修 |
| `.png` `.jpg` `.gif` | 视觉识别：公式 → OCR 转换，图表/照片 → 生成 figure 环境 |
| `.csv` `.xlsx` | 转换为 booktabs 表格 |
| `.bib` `.tex` `.cls` `.sty` | 直接上传不转换 |

### 模板管理

- `/templates` 浏览模板库
- `/admin/templates` 上传自定义模板（ZIP 包，内含完整 LaTeX 项目）

## API 接口一览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 用户登录 |
| POST | `/api/auth/guest` | 游客登录 |
| GET | `/api/auth/me` | 获取当前用户 |
| GET | `/api/projects` | 项目列表 |
| POST | `/api/projects` | 创建项目 |
| GET | `/api/projects/{id}` | 项目详情 |
| PUT | `/api/projects/{id}` | 更新项目 |
| DELETE | `/api/projects/{id}` | 删除项目 |
| GET | `/api/projects/{pid}/files` | 文件列表 |
| POST | `/api/projects/{pid}/files` | 创建文件 |
| PUT | `/api/projects/{pid}/files/{fid}` | 更新文件内容 |
| POST | `/api/projects/{pid}/files/upload` | 上传文件 |
| POST | `/api/projects/{pid}/compile` | 触发编译 |
| GET | `/api/projects/{pid}/compile/{job_id}` | 编译状态查询 |
| GET | `/api/projects/{pid}/pdf` | 获取最新 PDF |
| POST | `/api/projects/{pid}/ai/chat` | AI 对话（SSE 流式） |
| POST | `/api/projects/{pid}/ai/import` | AI 智能导入 |
| GET | `/api/templates` | 模板列表 |
| GET | `/api/projects/{pid}/export/tex` | 导出为 ZIP |
| GET | `/api/projects/{pid}/export/pdf` | 导出 PDF |

## 已知问题与注意事项

1. **Windows Python 路径** — Windows Store 的 `python.exe` 无法正常工作（退出码 49），需使用完整 Python 安装路径。
2. **CDN 不可用** — pdf.js 的 CDN 资源已做本地化处理，无需外网访问。
3. **编译超时** — 默认 60 秒超时，大文档可调整 `COMPILE_TIMEOUT` 环境变量。
4. **中文支持** — 需安装 TeX Live 的 ctex 宏包（`texlive-lang-chinese`）。

## 项目结构

```
NEW/
├── backend/
│   ├── app/
│   │   ├── api/         # REST 接口层
│   │   ├── models/      # SQLAlchemy ORM 模型
│   │   ├── schemas/     # Pydantic 校验模型
│   │   ├── services/    # 业务逻辑层
│   │   │   ├── ai/      # LLM 提供者（OpenAI/Claude/DeepSeek）
│   │   │   └── ...
│   │   ├── middleware/   # 中间件（LLM 密钥提取）
│   │   ├── config.py
│   │   ├── database.py
│   │   └── main.py      # 应用入口
│   ├── alembic/         # 数据库迁移
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/         # HTTP 客户端层
│   │   ├── store/       # Zustand 状态管理
│   │   ├── components/  # React 组件
│   │   │   ├── ai/      # AI 对话面板
│   │   │   ├── auth/    # 登录/认证
│   │   │   ├── editor/  # CodeMirror 编辑器
│   │   │   ├── layout/  # 布局组件
│   │   │   ├── preview/ # PDF 预览
│   │   │   └── templates/ # 模板卡片
│   │   ├── pages/       # 页面组件
│   │   └── main.tsx
│   ├── tailwind.config.js
│   └── package.json
└── docker-compose.yml
```
