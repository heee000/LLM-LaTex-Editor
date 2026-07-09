import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FileInfo, Project } from "./types";

interface ProjectState {
  project: Project | null;
  files: FileInfo[];
  activeFileId: string | null;
  activeFilePath: string | null;
  isDirty: boolean;
  compileVersion: number;
  compileError: string | null;
  activity: string[];
  setProject: (project: Project | null) => void;
  setFiles: (files: FileInfo[]) => void;
  setActiveFile: (file: FileInfo | null) => void;
  upsertFile: (file: FileInfo) => void;
  removeFile: (fileId: string) => void;
  updateFileContent: (fileId: string, content: string) => void;
  markDirty: () => void;
  markClean: () => void;
  bumpCompile: () => void;
  setCompileError: (message: string | null) => void;
  finishCompile: (message: string | null) => void;
  pushActivity: (message: string) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  project: null,
  files: [],
  activeFileId: null,
  activeFilePath: null,
  isDirty: false,
  compileVersion: 0,
  compileError: null,
  activity: [],
  setProject: (project) => set({ project }),
  setFiles: (files) =>
    set((state) => {
      const active = state.activeFileId ? files.find((file) => file.id === state.activeFileId) : files[0];
      return {
        files,
        activeFileId: active?.id || null,
        activeFilePath: active?.path || null,
      };
    }),
  setActiveFile: (file) => set({ activeFileId: file?.id || null, activeFilePath: file?.path || null, isDirty: false }),
  upsertFile: (file) =>
    set((state) => {
      const exists = state.files.some((item) => item.id === file.id);
      const files = exists ? state.files.map((item) => (item.id === file.id ? file : item)) : [...state.files, file];
      return { files };
    }),
  removeFile: (fileId) =>
    set((state) => {
      const files = state.files.filter((file) => file.id !== fileId);
      const active = state.activeFileId === fileId ? files[0] : files.find((file) => file.id === state.activeFileId);
      return { files, activeFileId: active?.id || null, activeFilePath: active?.path || null };
    }),
  updateFileContent: (fileId, content) =>
    set((state) => ({
      files: state.files.map((file) => (file.id === fileId ? { ...file, content, size: content.length } : file)),
    })),
  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),
  bumpCompile: () => set((state) => ({ compileVersion: state.compileVersion + 1 })),
  setCompileError: (message) => set({ compileError: message }),
  finishCompile: (message) => set((state) => ({ compileError: message, compileVersion: state.compileVersion + 1 })),
  pushActivity: (message) =>
    set((state) => ({
      activity: [`${new Date().toLocaleTimeString()}  ${message}`, ...state.activity].slice(0, 8),
    })),
}));

interface SettingsState {
  llmKey: string;
  llmProvider: string;
  llmModel: string;
  autoCompile: boolean;
  setLLM: (key: string, provider: string, model: string) => void;
  setAutoCompile: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      llmKey: localStorage.getItem("llm_api_key") || "",
      llmProvider: localStorage.getItem("llm_provider") || "openai",
      llmModel: localStorage.getItem("llm_model") || "gpt-4o",
      autoCompile: false,
      setLLM: (key, provider, model) => {
        localStorage.setItem("llm_api_key", key);
        localStorage.setItem("llm_provider", provider);
        localStorage.setItem("llm_model", model);
        set({ llmKey: key, llmProvider: provider, llmModel: model });
      },
      setAutoCompile: (value) => set({ autoCompile: value }),
    }),
    { name: "ai-latex-claude-settings" },
  ),
);
