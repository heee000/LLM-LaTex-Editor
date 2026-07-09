import { ArrowLeft, FilePlus2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createProject, listTemplates } from "../api";
import type { TemplateInfo } from "../types";

export function Templates() {
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    listTemplates().then(setTemplates).catch(console.error);
  }, []);

  const start = async (template: TemplateInfo) => {
    const project = await createProject(template.name, template.id);
    navigate(`/editor/${project.id}`);
  };

  return (
    <main className="home-page compact-page">
      <nav className="top-nav">
        <button className="ghost-button" onClick={() => navigate("/")}>
          <ArrowLeft size={16} />
          返回
        </button>
        <button className="ghost-button" onClick={() => navigate("/admin/templates")}>
          上传模板
        </button>
      </nav>
      <section className="project-list">
        <div className="section-head">
          <p className="eyebrow">Templates</p>
          <h1>模板库</h1>
        </div>
        <div className="template-grid">
          {templates.map((template) => (
            <article className="template-card" key={template.id}>
              <p>{template.category} / {template.language}</p>
              <h2>{template.name}</h2>
              <span>{template.description || "无描述"}</span>
              <button className="primary-button" onClick={() => start(template)}>
                <FilePlus2 size={16} />
                使用
              </button>
            </article>
          ))}
          {templates.length === 0 && <p className="empty-note">暂无模板，可以从右上角上传 ZIP 模板。</p>}
        </div>
      </section>
    </main>
  );
}
