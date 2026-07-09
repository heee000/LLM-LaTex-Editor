import {
  ArrowLeft,
  Download,
  FileArchive,
  LoaderCircle,
  Play,
  Save,
  Settings,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  aiGenerate,
  exportUrl,
  getProject,
  listFiles,
  triggerCompile,
  updateFile,
  updateProject,
  uploadFile,
} from "../api";
import { AIAssistant } from "../components/AIAssistant";
import { CodeEditor } from "../components/CodeEditor";
import { FilePreview } from "../components/FilePreview";
import { FileShelf } from "../components/FileShelf";
import { PdfPreview } from "../components/PdfPreview";
import { SettingsDialog } from "../components/SettingsDialog";
import { useProjectStore, useSettingsStore } from "../store";
import { downloadUrl } from "../utils";

type ResizeMode = "left" | "right" | "preview";

function storedNumber(key: string, fallback: number, minimum = 0) {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) && value > 0 ? Math.max(minimum, value) : fallback;
}

export function Workbench() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leftWidth, setLeftWidth] = useState(() => storedNumber("latex-left-width", 270));
  const [rightWidth, setRightWidth] = useState(() => storedNumber("latex-right-width", 520, 480));
  const [previewHeight, setPreviewHeight] = useState(() => storedNumber("latex-preview-height", 460, 420));
  const resizeRef = useRef<{ mode: ResizeMode; startX: number; startY: number; left: number; right: number; preview: number } | null>(
    null,
  );
  const settings = useSettingsStore();
  const {
    project,
    files,
    activeFileId,
    activeFilePath,
    isDirty,
    activity,
    setProject,
    setFiles,
    updateFileContent,
    markDirty,
    markClean,
    finishCompile,
    pushActivity,
  } = useProjectStore();
  const activeFile = files.find((file) => file.id === activeFileId) || null;
  const editable = !!activeFile && activeFile.content !== null;

  useEffect(() => {
    if (!projectId) return;
    Promise.all([getProject(projectId), listFiles(projectId)])
      .then(([loadedProject, loadedFiles]) => {
        setProject(loadedProject);
        setFiles(loadedFiles);
      })
      .catch((error) => pushActivity(`加载失败：${error.message}`));
    return () => {
      setProject(null);
      setFiles([]);
    };
  }, [projectId]);

  useEffect(() => {
    localStorage.setItem("latex-left-width", String(leftWidth));
  }, [leftWidth]);

  useEffect(() => {
    localStorage.setItem("latex-right-width", String(rightWidth));
  }, [rightWidth]);

  useEffect(() => {
    localStorage.setItem("latex-preview-height", String(previewHeight));
  }, [previewHeight]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const resize = resizeRef.current;
      if (!resize) return;
      if (resize.mode === "left") {
        setLeftWidth(Math.min(520, Math.max(180, resize.left + event.clientX - resize.startX)));
      } else if (resize.mode === "right") {
        setRightWidth(Math.min(960, Math.max(320, resize.right - (event.clientX - resize.startX))));
      } else {
        setPreviewHeight(Math.min(820, Math.max(220, resize.preview + event.clientY - resize.startY)));
      }
    };
    const onUp = () => {
      resizeRef.current = null;
      document.body.classList.remove("is-resizing", "is-resizing-left", "is-resizing-right", "is-resizing-preview");
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.classList.remove("is-resizing", "is-resizing-left", "is-resizing-right", "is-resizing-preview");
    };
  }, []);

  const startResize = (mode: ResizeMode, event: React.PointerEvent) => {
    resizeRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      left: leftWidth,
      right: rightWidth,
      preview: previewHeight,
    };
    document.body.classList.add("is-resizing", `is-resizing-${mode}`);
  };

  const saveActive = useCallback(
    async (announce = true, compileAfterSave = settings.autoCompile) => {
      if (!project || !activeFile || activeFile.content === null) return;
      const saved = await updateFile(project.id, activeFile.id, activeFile.content || "");
      updateFileContent(saved.id, saved.content || "");
      markClean();
      if (announce) pushActivity(`保存 ${saved.path}`);
      if (compileAfterSave) {
        const job = await triggerCompile(project.id);
        finishCompile(job.status === "done" ? null : job.error_msg || "Compilation failed");
      }
    },
    [project?.id, activeFile?.id, activeFile?.content, settings.autoCompile],
  );

  useEffect(() => {
    if (!isDirty || !activeFile || activeFile.content === null) return;
    const timer = window.setTimeout(() => {
      saveActive(false).catch((error) => pushActivity(`自动保存失败：${error.message}`));
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [activeFile?.content, isDirty]);

  const compile = async () => {
    if (!project) return;
    setBusy("compile");
    try {
      await saveActive(false, false);
      const job = await triggerCompile(project.id);
      finishCompile(job.status === "done" ? null : job.error_msg || "Compilation failed");
      pushActivity(job.status === "done" ? "编译完成" : "编译失败");
    } finally {
      setBusy(null);
    }
  };

  const generate = async () => {
    if (!project) return;
    if (!settings.llmKey) {
      setSettingsOpen(true);
      pushActivity("请先设置 API key");
      return;
    }
    setBusy("generate");
    try {
      let streamError = "";
      await aiGenerate(project.id, settings.llmModel, {
        onEvent: (event) => {
          if (event.type === "saved") pushActivity(`AI 已生成 ${event.path}`);
        },
        onError: (message) => {
          streamError = message;
          pushActivity(`AI 生成失败：${message}`);
        },
      });
      if (streamError) throw new Error(streamError);
      const fresh = await listFiles(project.id);
      setFiles(fresh);
      const job = await triggerCompile(project.id);
      finishCompile(job.status === "done" ? null : job.error_msg || "Compilation failed");
      pushActivity(job.status === "done" ? "生成并编译完成" : "生成完成，编译失败");
    } finally {
      setBusy(null);
    }
  };

  const uploadTop = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!project || !event.target.files) return;
    for (const file of Array.from(event.target.files)) {
      const uploaded = await uploadFile(project.id, file);
      useProjectStore.getState().upsertFile(uploaded);
      pushActivity(`导入 ${uploaded.path}`);
    }
    event.target.value = "";
  };

  const rename = async (name: string) => {
    if (!project || !name.trim() || name === project.name) return;
    const updated = await updateProject(project.id, { name: name.trim() });
    setProject(updated);
    pushActivity("项目已重命名");
  };

  const downloadProject = async () => {
    if (!project) return;
    setBusy("download");
    try {
      await saveActive(false, false);
      const job = await triggerCompile(project.id);
      const errorMessage = job.status === "done" ? null : job.error_msg || "Compilation failed";
      finishCompile(errorMessage);
      if (errorMessage) {
        pushActivity("下载已停止：编译失败");
        return;
      }
      const safeName = (project.name || "latex-project").replace(/[<>:"/\\|?*]+/g, "_");
      pushActivity("正在下载源码和 PDF");
      downloadUrl(exportUrl(project.id, "tex"), `${safeName}.zip`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="workbench">
      <header className="workbench-top">
        <div className="top-left">
          <button className="icon-button" onClick={() => navigate("/")} title="返回项目">
            <ArrowLeft size={18} />
          </button>
          <input
            className="project-name-input"
            defaultValue={project?.name || ""}
            onBlur={(event) => rename(event.target.value)}
            aria-label="项目名称"
          />
          <span className={`save-state ${isDirty ? "dirty" : ""}`}>{isDirty ? "未保存" : "已保存"}</span>
        </div>
        <div className="top-actions">
          <label className="icon-button" title="导入材料">
            <input className="hidden-input" type="file" multiple onChange={uploadTop} />
            <FileArchive size={18} />
          </label>
          <button className="icon-button" onClick={() => saveActive()} disabled={!isDirty || busy !== null} title="保存">
            <Save size={18} />
          </button>
          <button className="command-button" onClick={compile} disabled={busy !== null}>
            {busy === "compile" ? <LoaderCircle className="spin" size={17} /> : <Play size={17} />}
            编译
          </button>
          <button className="command-button emphasis" onClick={generate} disabled={busy !== null}>
            {busy === "generate" ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
            生成 main.tex
          </button>
          <button className="icon-button" onClick={downloadProject} disabled={!project || busy !== null} title="下载源码和 PDF">
            {busy === "download" ? <LoaderCircle className="spin" size={18} /> : <Download size={18} />}
          </button>
          <button className="icon-button" onClick={() => setSettingsOpen(true)} title="设置">
            <Settings size={18} />
          </button>
        </div>
      </header>

      <div
        className="workbench-grid"
        style={{ gridTemplateColumns: `${leftWidth}px 8px minmax(360px, 1fr) 8px ${rightWidth}px` }}
      >
        <FileShelf />
        <div className="resize-handle vertical" onPointerDown={(event) => startResize("left", event)} />
        <section className="editor-panel">
          <div className="panel-title editor-title">
            <div>
              <p className="eyebrow">{editable ? "Editor" : "Asset Preview"}</p>
              <h2>{activeFilePath || "No file selected"}</h2>
            </div>
          </div>
          {editable ? (
            <CodeEditor
              file={activeFile}
              onSave={() => saveActive()}
              onChange={(content) => {
                if (!activeFile) return;
                updateFileContent(activeFile.id, content);
                markDirty();
              }}
            />
          ) : (
            <FilePreview projectId={project?.id || null} file={activeFile} />
          )}
        </section>
        <div className="resize-handle vertical" onPointerDown={(event) => startResize("right", event)} />
        <div className="right-rail" style={{ gridTemplateRows: `${previewHeight}px 8px minmax(220px, 1fr) auto` }}>
          <PdfPreview />
          <div className="resize-handle horizontal" onPointerDown={(event) => startResize("preview", event)} />
          <AIAssistant />
          <section className="activity-panel">
            <p className="eyebrow">Activity</p>
            {activity.length === 0 ? <span>等待操作。</span> : activity.map((item) => <span key={item}>{item}</span>)}
          </section>
        </div>
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  );
}
