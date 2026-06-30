import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  llmKey: string; llmProvider: string; llmModel: string;
  autoCompile: boolean; darkMode: boolean;
  setLLMKey: (key: string, provider: string) => void;
  setLLMModel: (model: string) => void;
  toggleAutoCompile: () => void;
  toggleDarkMode: () => void;
}

export const useSettingsStore = create<SettingsState>()(persist((set) => ({
  llmKey: "", llmProvider: "openai", llmModel: "gpt-4o", autoCompile: true, darkMode: false,
  setLLMKey: (key, provider) => { localStorage.setItem("llm_api_key", key); localStorage.setItem("llm_provider", provider); set({ llmKey: key, llmProvider: provider }); },
  setLLMModel: (model) => set({ llmModel: model }),
  toggleAutoCompile: () => set((s) => ({ autoCompile: !s.autoCompile })),
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
}), { name: "settings-storage" }));
