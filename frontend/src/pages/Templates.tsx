import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { TemplateCard } from "../components/templates/TemplateCard";
import { listTemplates, TemplateInfo } from "../api/templates";
import { createProject } from "../api/projects";

export default function Templates() {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const navigate = useNavigate();

  useEffect(() => { listTemplates().then(setTemplates).catch(console.error); }, []);

  const handleSelect = async (t: TemplateInfo) => {
    try { const project = await createProject(undefined, t.id); navigate(`/editor/${project.id}`); } catch { /* create failed */ }
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <button onClick={() => navigate("/")} className="text-xs text-stone-500 hover:text-accent mb-4 block">&larr; 返回</button>
        <h1 className="text-2xl font-semibold mb-2">模板</h1>
        <p className="text-sm text-stone-500 mb-6">为你的文档选择一个起始模板</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {templates.map((t) => <TemplateCard key={t.id} template={t} onSelect={() => handleSelect(t)} />)}
          {templates.length === 0 && <p className="text-sm text-stone-500 col-span-full text-center py-10">暂无可用模板</p>}
        </div>
      </div>
    </AppShell>
  );
}
