import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSettingsStore, useAuthStore, useProjectStore, useEditorStore } from "../../store";
import { triggerCompile } from "../../api/compile";
import { uploadFile, updateFile } from "../../api/files";
import { aiGenerateStream } from "../../api/ai";
import { listFiles } from "../../api/files";
import { LoginModal } from "../auth/LoginModal";
import { APIKeyModal } from "../auth/APIKeyModal";

export function Toolbar() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectId = useProjectStore((s) => s.projectId);
  const upsertFile = useProjectStore((s) => s.upsertFile);
  const {
    autoCompile, toggleAutoCompile, darkMode, toggleDarkMode,
    llmKey, llmModel,
  } = useSettingsStore();
  const { user, logout } = useAuthStore();
  const isDirty = useEditorStore((s) => s.isDirty);
  const activeFilePath = useEditorStore((s) => s.activeFilePath);
  const [showAPIKey, setShowAPIKey] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;
    setUploading(true);
    try {
      const result = await uploadFile(projectId, file);
      upsertFile(result);
    } catch { /* upload failed */ }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    if (!projectId || saving) return;
    setSaving(true);
    const store = useEditorStore.getState();
    const view = store.editorView as { state: { doc: { toString(): string } } } | null;
    const activeFileId = store.activeFileId;
    if (view && activeFileId) {
      try {
        const content = view.state.doc.toString();
        await updateFile(projectId, activeFileId, content);
        useProjectStore.getState().updateFileContent(activeFileId, content);
        store.markClean();
      } catch { /* save failed */ }
    }
    setSaving(false);
  };

  const handleCompile = async () => {
    if (!projectId || compiling) return;
    setCompiling(true);
    const store = useEditorStore.getState();

    // Save current editor content before compiling
    const view = store.editorView as { state: { doc: { toString(): string } } } | null;
    const activeFileId = store.activeFileId;
    if (view && activeFileId) {
      try {
        const content = view.state.doc.toString();
        await updateFile(projectId, activeFileId, content);
        useProjectStore.getState().updateFileContent(activeFileId, content);
        store.markClean();
      } catch { /* save failed, still try to compile */ }
    }

    try {
      const result = await triggerCompile(projectId);
      if (result.status === "done") {
        store.setLastCompileError(null);
      } else {
        store.setLastCompileError(result.error_msg || "编译失败");
      }
      store.incrementCompileVersion();
    } catch {
      store.setLastCompileError("编译请求失败");
      store.incrementCompileVersion();
    }
    setCompiling(false);
  };

  const handleGenerate = async () => {
    if (!projectId || !llmKey || generating) return;
    setGenerating(true);
    try {
      await aiGenerateStream(
        projectId, llmModel,
        () => {},
        async () => {
          // Refresh files list & reload editor with new main.tex
          try {
            const fresh = await listFiles(projectId);
            useProjectStore.getState().setFiles(fresh);
            const mainFile = fresh.find((f) => f.path === "main.tex");
            if (mainFile) {
              useEditorStore.getState().setActiveFile(mainFile.id, mainFile.path);
            }
          } catch { /* refresh failed, still try compile */ }
          // Trigger compile
          try {
            const result = await triggerCompile(projectId);
            const store = useEditorStore.getState();
            store.incrementCompileVersion();
            if (result.status === "done") {
              store.setLastCompileError(null);
            } else if (result.error_msg) {
              store.setLastCompileError(result.error_msg);
            }
          } catch { /* compile failed */ }
          setGenerating(false);
        },
        (err) => {
          useEditorStore.getState().setLastCompileError(err);
          setGenerating(false);
        },
      );
    } catch {
      setGenerating(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!projectId || downloading) return;
    setDownloading(true);
    try {
      const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${BASE}/projects/${projectId}/export/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "下载失败");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `project_${projectId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      // 静默失败
    }
    setDownloading(false);
  };

  return (
    <header className="h-12 flex items-center justify-between px-4 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 shadow-sm shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="font-medium text-[13px] tracking-tight text-stone-700 dark:text-stone-200 hover:text-accent transition-colors"
        >
          LaTeX 编辑器
        </button>
        <span className="text-stone-300 dark:text-stone-600">|</span>

        <button
          onClick={handleCompile}
          disabled={compiling}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-panel bg-accent text-white hover:bg-accent-hover disabled:opacity-40 transition-all shadow-button"
        >
          {compiling ? (
            <>
              <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              编译中...
            </>
          ) : (
            "编译"
          )}
        </button>

        <button
          onClick={handleDownloadPdf}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-panel border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 transition-colors"
          title="下载编译好的 PDF"
        >
          <svg className="w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {downloading ? "下载中..." : "下载PDF"}
        </button>

        <button
          onClick={handleGenerate}
          disabled={generating || !llmKey}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-panel bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-all shadow-button"
        >
          {generating ? (
            <>
              <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              生成中...
            </>
          ) : (
            "开始"
          )}
        </button>

        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="px-3 py-1.5 text-xs rounded-panel border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 transition-colors"
        >
          {saving ? "保存中..." : "保存"}
        </button>

        <label className="flex items-center gap-1.5 text-xs text-stone-500 cursor-pointer select-none">
          <input type="checkbox" checked={autoCompile} onChange={toggleAutoCompile} className="w-3 h-3 rounded accent-accent" />
          自动
        </label>

        <button onClick={() => navigate("/templates")} className="text-xs text-stone-500 hover:text-accent transition-colors">
          模板
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-xs text-stone-500 hover:text-accent transition-colors disabled:opacity-50"
        >
          {uploading ? "导入中..." : "导入"}
        </button>
        <input ref={fileInputRef} type="file" onChange={handleUpload} className="hidden"
          accept=".txt,.md,.docx,.png,.jpg,.jpeg,.gif,.csv,.xlsx,.bib,.tex,.cls,.sty" />
      </div>

      <div className="flex items-center gap-3">
        {activeFilePath && (
          <span className="text-xs text-stone-400 dark:text-stone-500 flex items-center gap-1.5 max-w-[200px] truncate">
            {activeFilePath}
            {isDirty && <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="未保存的更改" />}
          </span>
        )}

        <button
          onClick={toggleDarkMode}
          className="text-xs text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
        >
          {darkMode ? "浅色" : "深色"}
        </button>

        {user ? (
          <>
            <span className="text-xs text-stone-400">{user.username || "访客"}</span>
            <button onClick={logout} className="text-xs text-stone-400 hover:text-red-500 transition-colors">退出</button>
          </>
        ) : (
          <button
            onClick={() => setShowLogin(true)}
            className="px-3 py-1 text-xs rounded-subtle border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            登录
          </button>
        )}

        <button
          onClick={() => setShowAPIKey(true)}
          className="text-xs text-stone-500 hover:text-accent transition-colors"
        >
          API 密钥
        </button>
      </div>

      {showAPIKey && <APIKeyModal onClose={() => setShowAPIKey(false)} />}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </header>
  );
}
