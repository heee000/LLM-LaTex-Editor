import { useState, useRef, useCallback } from "react";
import { useProjectStore, useEditorStore } from "../../store";
import { createFile, uploadFile } from "../../api/files";
import { FileTreeNode } from "./FileTreeNode";

export function FileTree() {
  const files = useProjectStore((s) => s.files);
  const projectId = useProjectStore((s) => s.projectId);
  const activeFileId = useEditorStore((s) => s.activeFileId);
  const setActiveFile = useEditorStore((s) => s.setActiveFile);
  const upsertFile = useProjectStore((s) => s.upsertFile);
  const [newName, setNewName] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);

  const texFiles = files.filter(
    (f) => f.file_type === "tex" || f.file_type === "bib" || f.file_type === "cls" || f.file_type === "sty"
  );
  const otherFiles = files.filter(
    (f) => f.file_type === "img" || f.file_type === "other"
  );

  const handleCreate = async () => {
    if (!projectId || !newName.trim()) return;
    try {
      const f = await createFile(projectId, newName.trim());
      upsertFile(f);
      setNewName("");
      setShowNew(false);
      setActiveFile(f.id, f.path);
    } catch { /* create failed */ }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragOver(true);
    }
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    dragCounter.current = 0;

    if (!projectId) return;
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    for (const file of droppedFiles) {
      try {
        const result = await uploadFile(projectId, file);
        upsertFile(result);
      } catch { /* per-file failure, continue */ }
    }
  }, [projectId, upsertFile]);

  return (
    <aside
      className={`w-full h-full border-r border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 overflow-y-auto flex flex-col transition-colors ${dragOver ? "ring-2 ring-accent bg-accent/5" : ""}`}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between px-3 py-3 border-b border-stone-100 dark:border-stone-800">
        <span className="text-[11px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
          文件
        </span>
        <button
          onClick={() => setShowNew(!showNew)}
          className="text-stone-400 hover:text-accent transition-colors text-lg leading-none"
        >
          +
        </button>
      </div>

      {dragOver && (
        <div className="mx-2 my-1 px-2 py-3 border-2 border-dashed border-accent rounded-subtle text-[12px] text-accent text-center">
          释放以导入文件
        </div>
      )}

      {showNew && (
        <div className="flex gap-1 px-2 py-2 border-b border-stone-100 dark:border-stone-800">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="chapters/intro.tex"
            className="flex-1 text-[12px] border border-stone-300 dark:border-stone-700 rounded-subtle px-2 py-1 bg-white dark:bg-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-accent/30 font-mono"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setShowNew(false);
            }}
            autoFocus
          />
          <button
            onClick={handleCreate}
            className="text-xs text-accent font-medium px-2"
          >
            确定
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-1">
        {texFiles.length > 0 && (
          <div className="px-3 py-1.5 text-[10px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
            源文件
          </div>
        )}
        {texFiles.map((f) => (
          <FileTreeNode
            key={f.id}
            file={f}
            isActive={f.id === activeFileId}
            onClick={() => setActiveFile(f.id, f.path)}
          />
        ))}

        {otherFiles.length > 0 && (
          <div className="px-3 py-1.5 mt-2 text-[10px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
            资源
          </div>
        )}
        {otherFiles.map((f) => (
          <FileTreeNode
            key={f.id}
            file={f}
            isActive={f.id === activeFileId}
            onClick={() => setActiveFile(f.id, f.path)}
          />
        ))}

        {files.length === 0 && (
          <p className="px-3 py-4 text-[12px] text-stone-400 dark:text-stone-500 text-center">
            暂无文件，点击 + 创建或拖入文件
          </p>
        )}
      </div>
    </aside>
  );
}
