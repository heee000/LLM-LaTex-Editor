import { File, FileCode2, FileText, Image, Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { createFile, deleteFile, uploadFile } from "../api";
import { useProjectStore } from "../store";
import type { FileInfo } from "../types";
import { formatBytes } from "../utils";

function fileIcon(file: FileInfo) {
  if (file.file_type === "img") return <Image size={15} />;
  if (["tex", "bib", "cls", "sty"].includes(file.file_type)) return <FileCode2 size={15} />;
  return <File size={15} />;
}

export function FileShelf() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [newPath, setNewPath] = useState("");
  const [dragging, setDragging] = useState(false);
  const { project, files, activeFileId, setActiveFile, upsertFile, removeFile, pushActivity } = useProjectStore();

  const addFile = async () => {
    if (!project || !newPath.trim()) return;
    const created = await createFile(project.id, newPath.trim());
    upsertFile(created);
    setActiveFile(created);
    setNewPath("");
    pushActivity(`创建 ${created.path}`);
  };

  const uploadMany = async (items: FileList | File[]) => {
    if (!project) return;
    const queue = Array.from(items);
    for (const item of queue) {
      const uploaded = await uploadFile(project.id, item);
      upsertFile(uploaded);
      pushActivity(`导入 ${uploaded.path}`);
    }
  };

  const remove = async (file: FileInfo) => {
    if (!project) return;
    await deleteFile(project.id, file.id);
    removeFile(file.id);
    pushActivity(`删除 ${file.path}`);
  };

  const sourceFiles = files.filter((file) => ["tex", "bib", "cls", "sty"].includes(file.file_type));
  const assets = files.filter((file) => !["tex", "bib", "cls", "sty"].includes(file.file_type));

  return (
    <aside
      className={`file-shelf ${dragging ? "dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        uploadMany(event.dataTransfer.files).catch((error) => pushActivity(`导入失败：${error.message}`));
      }}
    >
      <div className="panel-title">
        <div>
          <p className="eyebrow">Workspace</p>
          <h2>材料与源码</h2>
        </div>
        <button className="icon-button" onClick={() => inputRef.current?.click()} title="导入文件">
          <Upload size={17} />
        </button>
        <input
          ref={inputRef}
          className="hidden-input"
          type="file"
          multiple
          accept=".txt,.md,.docx,.png,.jpg,.jpeg,.gif,.webp,.svg,.csv,.xlsx,.bib,.tex,.cls,.sty,.pdf"
          onChange={(event) => event.target.files && uploadMany(event.target.files)}
        />
      </div>

      <div className="new-file-row">
        <FileText size={15} />
        <input
          value={newPath}
          onChange={(event) => setNewPath(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && addFile()}
          placeholder="chapters/intro.tex"
        />
        <button className="icon-button compact" onClick={addFile} title="新建文件">
          <Plus size={15} />
        </button>
      </div>

      <FileGroup title="源文件" files={sourceFiles} activeFileId={activeFileId} onSelect={setActiveFile} onDelete={remove} />
      <FileGroup title="资源" files={assets} activeFileId={activeFileId} onSelect={setActiveFile} onDelete={remove} />
      {files.length === 0 && <p className="empty-note">拖入 Word、图片、表格或 LaTeX 文件，先完整暂存材料。</p>}
    </aside>
  );
}

function FileGroup({
  title,
  files,
  activeFileId,
  onSelect,
  onDelete,
}: {
  title: string;
  files: FileInfo[];
  activeFileId: string | null;
  onSelect: (file: FileInfo) => void;
  onDelete: (file: FileInfo) => void;
}) {
  if (files.length === 0) return null;
  return (
    <section className="file-group">
      <p>{title}</p>
      {files.map((file) => (
        <div key={file.id} className={`file-row ${file.id === activeFileId ? "active" : ""}`}>
          <button onClick={() => onSelect(file)} title={file.path}>
            {fileIcon(file)}
            <span>{file.path}</span>
            <small>{formatBytes(file.size)}</small>
          </button>
          <button className="icon-button compact danger" onClick={() => onDelete(file)} title="删除">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </section>
  );
}
