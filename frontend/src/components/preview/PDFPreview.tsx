import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useProjectStore, useEditorStore } from "../../store";
import { getPDFUrl } from "../../api/compile";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export function PDFPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const projectId = useProjectStore((s) => s.projectId);
  const compileVersion = useEditorStore((s) => s.compileVersion);
  const lastCompileError = useEditorStore((s) => s.lastCompileError);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    const url = getPDFUrl(projectId) + `?v=${compileVersion}`;

    const params: any = { url };
    // Only add cMap config if cdn is accessible, skip for now
    // Chinese PDFs will still render, just without text extraction

    pdfjsLib
      .getDocument(params)
      .promise.then((doc) => {
        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setPageNum(1);
        setError(null);
        setLoading(false);
        renderPage(doc, 1);
      })
      .catch((err) => {
        setLoading(false);
        // Check if the PDF actually exists (404) or is a network error
        const msg = lastCompileError || "暂无 PDF，请先编译文档";
        setError(msg);
        console.warn("PDF load failed:", err);
      });
  }, [projectId, compileVersion, lastCompileError]);

  const renderPage = async (doc: pdfjsLib.PDFDocumentProxy, num: number) => {
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }
    const page = await doc.getPage(num);
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth - 32;
    const viewport = page.getViewport({ scale: 1 });
    const scale = containerWidth / viewport.width;
    const scaledViewport = page.getViewport({ scale });
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    renderTaskRef.current = page.render({ canvas, viewport: scaledViewport });
    await renderTaskRef.current.promise;
  };

  const changePage = (delta: number) => {
    if (!pdfDocRef.current) return;
    const next = pageNum + delta;
    if (next < 1 || next > numPages) return;
    setPageNum(next);
    renderPage(pdfDocRef.current, next);
  };

  return (
    <div ref={containerRef} className="h-full overflow-auto p-4 bg-stone-100 dark:bg-stone-900">
      {loading && (
        <div className="flex items-center justify-center h-full">
          <p className="text-[13px] text-stone-400">加载中...</p>
        </div>
      )}
      {!loading && error ? (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
          <p className="text-[13px] text-stone-500 dark:text-stone-400">{error}</p>
          {lastCompileError && (
            <pre className="text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 rounded-subtle max-h-48 overflow-auto max-w-full whitespace-pre-wrap font-mono">
              {lastCompileError}
            </pre>
          )}
        </div>
      ) : !loading && !error ? (
        <>
          {lastCompileError && (
            <div className="mb-3 p-2.5 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-subtle">
              <p className="text-[12px] text-red-700 dark:text-red-300 font-medium mb-1">编译失败，显示的是上次成功编译的 PDF：</p>
              <pre className="text-[11px] text-red-600 dark:text-red-400 whitespace-pre-wrap font-mono leading-relaxed">
                {lastCompileError}
              </pre>
            </div>
          )}
          {numPages > 1 && (
            <div className="flex items-center justify-center gap-3 mb-3 text-[13px]">
              <button
                onClick={() => changePage(-1)}
                disabled={pageNum <= 1}
                className="px-2.5 py-1 rounded-subtle hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 transition-colors"
              >
                &larr;
              </button>
              <span className="text-stone-500 dark:text-stone-400">
                {pageNum} / {numPages}
              </span>
              <button
                onClick={() => changePage(1)}
                disabled={pageNum >= numPages}
                className="px-2.5 py-1 rounded-subtle hover:bg-stone-200 dark:hover:bg-stone-700 disabled:opacity-30 transition-colors"
              >
                &rarr;
              </button>
            </div>
          )}
          <div className="max-w-[210mm] mx-auto">
            <div className="bg-white shadow-paper rounded-panel overflow-hidden">
              <canvas ref={canvasRef} className="w-full block" />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
