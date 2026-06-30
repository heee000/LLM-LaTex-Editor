import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { createTemplate } from "../api/templates";

export default function AdminTemplates() {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("other");
  const [language, setLanguage] = useState("universal");
  const [status, setStatus] = useState("");
  const navigate = useNavigate();

  const handleUpload = async () => {
    if (!file || !name) return;
    try { await createTemplate(file, name, desc, category, language); setStatus("模板上传成功！"); }
    catch (e) { setStatus(`错误：${e}`); }
  };

  return (
    <AppShell>
      <div className="max-w-lg mx-auto px-6 py-10">
        <button onClick={() => navigate("/")} className="text-xs text-stone-500 hover:text-accent mb-4 block">&larr; 返回</button>
        <h1 className="text-2xl font-semibold mb-6">添加模板</h1>
        {status && <p className="text-xs mb-4 p-2 rounded-subtle bg-stone-100 dark:bg-stone-800">{status}</p>}
        <div className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="模板名称" className="w-full text-sm border rounded-subtle px-3 py-2 dark:bg-stone-800 dark:border-stone-700" />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="描述" rows={3} className="w-full text-sm border rounded-subtle px-3 py-2 dark:bg-stone-800 dark:border-stone-700" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full text-sm border rounded-subtle px-3 py-2 dark:bg-stone-800 dark:border-stone-700">
            {["thesis", "journal", "conference", "report", "resume", "letter", "other"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full text-sm border rounded-subtle px-3 py-2 dark:bg-stone-800 dark:border-stone-700">
            {["universal", "zh", "en"].map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <input type="file" accept=".zip" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-sm" />
          <button onClick={handleUpload} disabled={!file || !name} className="w-full py-2 rounded-subtle bg-accent text-white hover:bg-accent-hover disabled:opacity-40 text-sm">上传模板</button>
        </div>
      </div>
    </AppShell>
  );
}
