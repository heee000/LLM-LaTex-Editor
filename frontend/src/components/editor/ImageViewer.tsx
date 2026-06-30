import { useState } from "react";
import { useProjectStore, useEditorStore } from "../../store";

function getStaticBase(): string {
  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
  return apiBase.replace(/\/api$/, "");
}

export function ImageViewer() {
  const projectId = useProjectStore((s) => s.projectId);
  const activeFilePath = useEditorStore((s) => s.activeFilePath);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (!projectId || !activeFilePath) {
    return (
      <div className="flex-1 flex items-center justify-center text-stone-400 dark:text-stone-500 text-[13px] bg-white dark:bg-stone-950">
        未选择图片
      </div>
    );
  }

  const url = `${getStaticBase()}/static/uploads/${projectId}/${activeFilePath}`;

  return (
    <div className="flex-1 flex flex-col bg-stone-100 dark:bg-stone-900 overflow-auto">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950">
        <span className="text-[11px] font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wider">
          图片预览
        </span>
        <span className="text-[12px] text-stone-600 dark:text-stone-300 font-mono">
          {activeFilePath}
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        {loading && (
          <p className="text-[13px] text-stone-400">加载中...</p>
        )}
        {error && (
          <div className="text-center">
            <p className="text-[13px] text-red-500 dark:text-red-400 mb-2">图片加载失败</p>
            <p className="text-[11px] text-stone-400 dark:text-stone-500 font-mono break-all">{url}</p>
          </div>
        )}
        <img
          src={url}
          alt={activeFilePath}
          onLoad={() => { setLoading(false); setError(false); }}
          onError={() => { setLoading(false); setError(true); }}
          className={`max-w-full max-h-full object-contain rounded-panel shadow-paper ${loading || error ? "hidden" : "block"}`}
        />
      </div>
    </div>
  );
}
