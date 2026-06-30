import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { createProject } from "../api/projects";

export default function Landing() {
  const navigate = useNavigate();
  const handleNewProject = async () => {
    try { const project = await createProject(); navigate(`/editor/${project.id}`); } catch { /* create failed */ }
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl font-semibold tracking-tight mb-4">轻松撰写<span className="text-accent">论文</span></h1>
        <p className="text-stone-500 mb-10 max-w-lg mx-auto leading-relaxed">AI 驱动的 LaTeX 编辑器。导入 Word 文档、图片和表格——AI 自动转换为 LaTeX。实时预览编辑，支持中英文混排。</p>
        <div className="flex gap-3 justify-center">
          <button onClick={handleNewProject} className="px-6 py-2 rounded-subtle bg-accent text-white hover:bg-accent-hover font-medium text-sm transition-colors">新建空白项目</button>
          <button onClick={() => navigate("/templates")} className="px-6 py-2 rounded-subtle border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 font-medium text-sm transition-colors">浏览模板</button>
        </div>
      </div>
    </AppShell>
  );
}
