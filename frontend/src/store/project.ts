import { create } from "zustand";
import type { FileInfo } from "../api/files";

interface ProjectState {
  projectId: string | null; files: FileInfo[];
  setProjectId: (id: string | null) => void;
  setFiles: (files: FileInfo[]) => void;
  updateFileContent: (fileId: string, content: string) => void;
  upsertFile: (file: FileInfo) => void;
  removeFile: (fileId: string) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projectId: null, files: [],
  setProjectId: (id) => set({ projectId: id }),
  setFiles: (files) => set({ files }),
  updateFileContent: (fileId, content) => set((s) => ({
    files: s.files.map((f) => (f.id === fileId ? { ...f, content, size: content.length } : f)),
  })),
  upsertFile: (file) => set((s) => {
    const idx = s.files.findIndex((f) => f.id === file.id);
    if (idx >= 0) { const files = [...s.files]; files[idx] = file; return { files }; }
    return { files: [...s.files, file] };
  }),
  removeFile: (fileId) => set((s) => ({ files: s.files.filter((f) => f.id !== fileId) })),
}));
