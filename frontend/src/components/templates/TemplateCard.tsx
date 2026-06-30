import type { TemplateInfo } from "../../api/templates";

export function TemplateCard({ template, onSelect }: { template: TemplateInfo; onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="text-left p-4 rounded-panel border border-stone-200 dark:border-stone-700 hover:border-accent/50 hover:shadow-sm transition-all">
      <div className="w-full h-24 rounded-subtle bg-stone-100 dark:bg-stone-800 mb-2 flex items-center justify-center text-2xl text-stone-500">
        {template.thumbnail_url ? <img src={template.thumbnail_url} alt="" className="w-full h-full object-cover rounded-subtle" /> : "📄"}
      </div>
      <h3 className="text-sm font-medium truncate">{template.name}</h3>
      <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{template.description || "暂无描述"}</p>
      <div className="flex gap-1 mt-2">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500">{template.category}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500">{template.language}</span>
      </div>
    </button>
  );
}
