import { create } from "zustand";

interface EditorState {
  activeFileId: string | null;
  activeFilePath: string | null;
  editorView: unknown | null;
  isDirty: boolean;
  compileVersion: number;
  lastCompileError: string | null;

  setActiveFile: (id: string | null, path: string | null) => void;
  setEditorView: (view: unknown) => void;
  markDirty: () => void;
  markClean: () => void;
  incrementCompileVersion: () => void;
  setLastCompileError: (msg: string | null) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  activeFileId: null,
  activeFilePath: null,
  editorView: null,
  isDirty: false,
  compileVersion: 0,
  lastCompileError: null,

  setActiveFile: (id, path) => set({ activeFileId: id, activeFilePath: path, isDirty: false }),
  setEditorView: (view) => set({ editorView: view }),
  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),
  incrementCompileVersion: () => set((s) => ({ compileVersion: s.compileVersion + 1 })),
  setLastCompileError: (msg) => set({ lastCompileError: msg }),
}));
