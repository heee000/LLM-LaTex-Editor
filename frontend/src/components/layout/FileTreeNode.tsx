import type { FileInfo } from "../../api/files";

const icons: Record<string, string> = { tex: "📄", bib: "📚", cls: "⚙️", sty: "🧩", img: "🖼️", other: "📎" };

export function FileTreeNode({ file, isActive, onClick }: { file: FileInfo; isActive: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full text-left text-xs py-0.5 px-1.5 rounded-subtle truncate block ${isActive ? "bg-accent/10 text-accent font-medium" : "text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"}`}>
      <span className="mr-1">{icons[file.file_type] || "📎"}</span>
      {file.path}
    </button>
  );
}
