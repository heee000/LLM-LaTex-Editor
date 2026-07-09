import { ChevronLeft, ChevronRight, FileWarning, LoaderCircle, Maximize2, Minus, Plus } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useCallback, useEffect, useRef, useState } from "react";
import { pdfUrl } from "../api";
import { useProjectStore } from "../store";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.15;

export function PdfPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  const project = useProjectStore((state) => state.project);
  const compileVersion = useProjectStore((state) => state.compileVersion);
  const compileError = useProjectStore((state) => state.compileError);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(1);

  const renderPage = useCallback(
    async (pdf: pdfjsLib.PDFDocumentProxy, pageNumber: number) => {
      const canvas = canvasRef.current;
      const host = hostRef.current;
      if (!canvas || !host) return;

      try {
        const pdfPage = await pdf.getPage(pageNumber);
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const framePadding = host.clientWidth >= 540 ? 18 : 10;
        const maxWidth = Math.max(320, host.clientWidth - framePadding);
        const cssScale = Math.max(0.2, (maxWidth / baseViewport.width) * zoom);
        const cssViewport = pdfPage.getViewport({ scale: cssScale });
        const outputScale = Math.min(window.devicePixelRatio || 1, 3);
        const renderViewport = pdfPage.getViewport({ scale: cssScale * outputScale });
        const context = canvas.getContext("2d");
        if (!context) return;

        renderTaskRef.current?.cancel();
        canvas.width = Math.floor(renderViewport.width);
        canvas.height = Math.floor(renderViewport.height);
        canvas.style.width = `${cssViewport.width}px`;
        canvas.style.height = `${cssViewport.height}px`;

        const task = pdfPage.render({ canvas, canvasContext: context, viewport: renderViewport });
        renderTaskRef.current = task;
        await task.promise;
        if (renderTaskRef.current === task) renderTaskRef.current = null;
      } catch (err) {
        if (err instanceof Error && err.name === "RenderingCancelledException") return;
        setError(err instanceof Error ? `PDF 渲染失败：${err.message}` : "PDF 渲染失败");
      }
    },
    [zoom],
  );

  useEffect(() => {
    if (!project) return;

    setDoc(null);
    setLoading(true);
    setError(null);
    pdfjsLib
      .getDocument({ url: pdfUrl(project.id, compileVersion) })
      .promise.then((loaded) => {
        setDoc(loaded);
        setPageCount(loaded.numPages);
        setPage(1);
        setZoom(1);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setError(compileError || "还没有可预览的 PDF。");
      });
  }, [project?.id, compileVersion, compileError]);

  useEffect(() => {
    if (!doc || loading || error) return;
    renderPage(doc, page);
  }, [doc, page, zoom, loading, error, renderPage]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !doc) return;

    let timer = 0;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => renderPage(doc, page), 90);
    });
    observer.observe(host);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      renderTaskRef.current?.cancel();
    };
  }, [doc, page, renderPage]);

  const move = (delta: number) => {
    if (!doc) return;
    const next = page + delta;
    if (next < 1 || next > pageCount) return;
    setPage(next);
  };

  const changeZoom = (delta: number) => {
    setZoom((value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((value + delta).toFixed(2)))));
  };

  return (
    <section className="preview-panel" ref={hostRef}>
      <div className="panel-title preview-title">
        <div>
          <p className="eyebrow">Preview</p>
          <h2>PDF</h2>
        </div>
        {doc && !loading && !error && (
          <div className="pdf-controls">
            <div className="pager">
              <button className="icon-button compact" disabled={page <= 1} onClick={() => move(-1)} title="上一页">
                <ChevronLeft size={16} />
              </button>
              <span>
                {page}/{pageCount}
              </span>
              <button className="icon-button compact" disabled={page >= pageCount} onClick={() => move(1)} title="下一页">
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="pdf-zoom">
              <button className="icon-button compact" onClick={() => changeZoom(-ZOOM_STEP)} disabled={zoom <= MIN_ZOOM} title="缩小">
                <Minus size={15} />
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button className="icon-button compact" onClick={() => changeZoom(ZOOM_STEP)} disabled={zoom >= MAX_ZOOM} title="放大">
                <Plus size={15} />
              </button>
              <button className="icon-button compact" onClick={() => setZoom(1)} title="适应宽度">
                <Maximize2 size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
      {loading && (
        <div className="blank-surface">
          <LoaderCircle className="spin" size={20} />
          正在加载 PDF
        </div>
      )}
      {!loading && error && (
        <div className="preview-error">
          <FileWarning size={20} />
          <p>{error}</p>
          {compileError && <pre>{compileError}</pre>}
        </div>
      )}
      <div className={`paper-frame ${loading || error ? "is-hidden" : ""}`}>
        <canvas ref={canvasRef} />
      </div>
    </section>
  );
}
