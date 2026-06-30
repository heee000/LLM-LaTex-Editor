import { ReactNode } from "react";
import { useSettingsStore } from "../../store";

export function AppShell({ children }: { children: ReactNode }) {
  const darkMode = useSettingsStore((s) => s.darkMode);
  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="h-screen flex flex-col bg-surface dark:bg-surface-dark text-stone-800 dark:text-stone-200">
        {children}
      </div>
    </div>
  );
}
