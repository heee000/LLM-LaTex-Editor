import { ArrowLeft, Upload } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTemplate } from "../api";

export function AdminTemplates() {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("thesis");
  const [language, setLanguage] = useState("zh");
  const [status, setStatus] = useState("");
  const navigate = useNavigate();

  const upload = async () => {
    if (!file || !name.trim()) return;
    try {
      await createTemplate(file, name.trim(), description, category, language);
      setStatus("模板已上传。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "上传失败。");
    }
  };

  return (
    <main className="home-page compact-page">
      <nav className="top-nav">
        <button className="ghost-button" onClick={() => navigate("/templates")}>
          <ArrowLeft size={16} />
          返回
        </button>
      </nav>
      <section className="admin-form">
        <p className="eyebrow">Template admin</p>
        <h1>上传 LaTeX 模板 ZIP</h1>
        {status && <p className="status-line">{status}</p>}
        <label>
          <span>名称</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          <span>描述</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
        </label>
        <div className="two-fields">
          <label>
            <span>分类</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {["thesis", "journal", "conference", "report", "resume", "letter", "other"].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>语言</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              {["zh", "en", "universal"].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          <span>ZIP 文件</span>
          <input type="file" accept=".zip" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        </label>
        <button className="primary-button" onClick={upload} disabled={!file || !name.trim()}>
          <Upload size={16} />
          上传
        </button>
      </section>
    </main>
  );
}
