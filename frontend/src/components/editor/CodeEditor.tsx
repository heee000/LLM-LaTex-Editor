import { useEffect, useRef, useCallback } from "react";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap } from "@codemirror/commands";
import { oneDark } from "@codemirror/theme-one-dark";
import { useEditorStore, useProjectStore, useSettingsStore } from "../../store";
import { updateFile } from "../../api/files";
import { triggerCompile } from "../../api/compile";
import { latexExtensions } from "./latexExtensions";

export function CodeEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { activeFileId, setEditorView, markClean } = useEditorStore();
  const projectId = useProjectStore((s) => s.projectId);
  const files = useProjectStore((s) => s.files);
  const darkMode = useSettingsStore((s) => s.darkMode);

  const activeFile = files.find((f) => f.id === activeFileId);

  const handleSave = useCallback(async () => {
    if (!projectId || !activeFileId || !viewRef.current) return;
    const content = viewRef.current.state.doc.toString();
    try {
      await updateFile(projectId, activeFileId, content);
      useProjectStore.getState().updateFileContent(activeFileId, content);
      markClean();

      if (useSettingsStore.getState().autoCompile) {
        try {
          const result = await triggerCompile(projectId);
          if (result.status === "done") {
            useEditorStore.getState().incrementCompileVersion();
            useEditorStore.getState().setLastCompileError(null);
          } else if (result.error_msg) {
            useEditorStore.getState().setLastCompileError(result.error_msg);
          }
        } catch { /* compile failed */ }
      }
    } catch { /* save failed */ }
  }, [projectId, activeFileId, markClean]);

  useEffect(() => {
    if (!containerRef.current || !activeFile) return;
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    const extensions = [
      ...latexExtensions,
      keymap.of(defaultKeymap),
      keymap.of([
        {
          key: "Ctrl-s",
          run: () => {
            handleSave();
            return true;
          },
        },
      ]),
      placeholder("开始编写 LaTeX..."),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          useEditorStore.getState().markDirty();
          if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = setTimeout(() => {
            handleSave();
          }, 2000);
        }
      }),
    ];
    if (darkMode) extensions.push(oneDark);

    const state = EditorState.create({
      doc: activeFile.content || "",
      extensions,
    });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    setEditorView(view);

    return () => {
      // Flush pending auto-save before destroying editor
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
        handleSave();
      } else if (useEditorStore.getState().isDirty) {
        handleSave();
      }
      view.destroy();
      viewRef.current = null;
    };
  }, [activeFile?.id, darkMode]);

  if (!activeFile) {
    return (
      <div className="flex-1 flex items-center justify-center text-stone-400 dark:text-stone-500 text-[13px] bg-white dark:bg-stone-950">
        选择一个文件开始编辑
      </div>
    );
  }

  return <div ref={containerRef} className="flex-1 h-full overflow-auto bg-white dark:bg-stone-950" />;
}
