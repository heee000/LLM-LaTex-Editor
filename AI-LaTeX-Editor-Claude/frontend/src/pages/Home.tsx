import { ArrowRight, FilePlus2, LayoutTemplate, LogIn, PenLine } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createProject, guestLogin, listProjects } from "../api";
import type { Project } from "../types";

export function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("Untitled Project");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    listProjects().then(setProjects).catch(console.error);
  }, []);

  const create = async () => {
    setLoading(true);
    try {
      const project = await createProject(name.trim() || "Untitled Project");
      navigate(`/editor/${project.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="home-page">
      <nav className="top-nav">
        <div className="brand-mark">AI LaTeX Editor</div>
        <div className="nav-actions">
          <button className="ghost-button" onClick={() => navigate("/templates")}>
            <LayoutTemplate size={16} />
            模板
          </button>
          <button className="ghost-button" onClick={() => guestLogin().then(() => listProjects().then(setProjects))}>
            <LogIn size={16} />
            访客会话
          </button>
        </div>
      </nav>

      <section className="project-launcher">
        <div className="launcher-copy">
          <p className="eyebrow">Workbench</p>
          <h1>从材料到可编译论文。</h1>
          <p>先把 Word、图片、表格和 LaTeX 源码完整导入，再让 AI 在明确指令下生成或修改。</p>
        </div>
        <div className="create-strip">
          <PenLine size={18} />
          <input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && create()} />
          <button className="primary-button" onClick={create} disabled={loading}>
            <FilePlus2 size={17} />
            新建
          </button>
        </div>
      </section>

      <section className="project-list">
        <div className="section-head">
          <p className="eyebrow">Recent</p>
          <h2>最近项目</h2>
        </div>
        <div className="project-grid">
          {projects.map((project) => (
            <button key={project.id} className="project-card" onClick={() => navigate(`/editor/${project.id}`)}>
              <span>{project.name}</span>
              <small>{new Date(project.updated_at).toLocaleString()}</small>
              <ArrowRight size={17} />
            </button>
          ))}
          {projects.length === 0 && <p className="empty-note">还没有项目，创建一个空白项目即可开始。</p>}
        </div>
      </section>
    </main>
  );
}
