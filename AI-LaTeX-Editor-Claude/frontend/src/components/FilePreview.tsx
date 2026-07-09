import { Download, FileText, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { getFilePreview, resolveAssetUrl } from "../api";
import type { FileInfo, FilePreviewInfo } from "../types";
import { formatBytes } from "../utils";

interface Props {
  projectId: string | null;
  file: FileInfo | null;
}

export function FilePreview({ projectId, file }: Props) {
  const [preview, setPreview] = useState<FilePreviewInfo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId || !file) {
      setPreview(null);
      return;
    }
    setLoading(true);
    setError("");
    getFilePreview(projectId, file.id)
      .then(setPreview)
      .catch((err) => setError(err instanceof Error ? err.message : "预览失败"))
      .finally(() => setLoading(false));
  }, [projectId, file?.id]);

  if (!file) return <div className="blank-surface">选择一个文件开始。</div>;
  if (loading) {
    return (
      <div className="blank-surface">
        <LoaderCircle className="spin" size={20} />
        正在生成预览
      </div>
    );
  }
  if (error) {
    return (
      <div className="asset-preview">
        <FileText size={22} />
        <h2>{file.path}</h2>
        <p>{error}</p>
      </div>
    );
  }
  if (!preview) return null;

  const asset = preview.asset_url ? resolveAssetUrl(preview.asset_url) : "";

  return (
    <section className="file-preview">
      <div className="file-preview-head">
        <div>
          <p className="eyebrow">Preview</p>
          <h2>{preview.path}</h2>
        </div>
        <span>{formatBytes(preview.size)}</span>
      </div>

      {preview.preview_type === "image" && <img className="image-preview" src={asset} alt={preview.path} />}

      {preview.preview_type === "pdf" && <iframe className="pdf-asset-preview" src={asset} title={preview.path} />}

      {preview.preview_type === "text" && <pre className="text-preview">{preview.text || "无可预览文本"}</pre>}

      {preview.preview_type === "table" && (
        <div className="table-preview-wrap">
          <table className="table-preview">
            <tbody>
              {(preview.rows || []).map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview.preview_type === "download" && (
        <div className="asset-preview">
          <FileText size={22} />
          <h2>{preview.path}</h2>
          <p>该格式暂不支持内嵌预览，可以下载或作为 LaTeX 资源继续使用。</p>
          {asset && (
            <a className="primary-button" href={asset} download>
              <Download size={16} />
              下载文件
            </a>
          )}
        </div>
      )}
    </section>
  );
}
