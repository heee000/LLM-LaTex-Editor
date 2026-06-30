import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { AppShell } from "../components/layout/AppShell";
import { Toolbar } from "../components/layout/Toolbar";
import { FileTree } from "../components/layout/FileTree";
import { CodeEditor } from "../components/editor/CodeEditor";
import { ImageViewer } from "../components/editor/ImageViewer";
import { PDFPreview } from "../components/preview/PDFPreview";
import { AIPanel } from "../components/ai/AIPanel";
import { useProjectStore, useEditorStore } from "../store";
import { listFiles } from "../api/files";

function CenterPanel() {
  const activeFileId = useEditorStore((s) => s.activeFileId);
  const files = useProjectStore((s) => s.files);
  const activeFile = files.find((f) => f.id === activeFileId);

  if (activeFile?.file_type === "img") {
    return <ImageViewer />;
  }
  return <CodeEditor />;
}

export default function Editor() {
  const { projectId } = useParams<{ projectId: string }>();
  const setProjectId = useProjectStore((s) => s.setProjectId);
  const setFiles = useProjectStore((s) => s.setFiles);

  useEffect(() => {
    if (projectId) {
      setProjectId(projectId);
      listFiles(projectId).then(setFiles).catch(console.error);
    }
    return () => { setProjectId(null); setFiles([]); };
  }, [projectId]);

  if (!projectId) {
    return <AppShell><div className="flex items-center justify-center h-full text-stone-500 text-sm">请创建或选择一个项目</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        <Toolbar />
        <div className="flex-1 overflow-hidden">
          <PanelGroup direction="horizontal">
            <Panel defaultSize={15} minSize={12} maxSize={25}>
              <FileTree />
            </Panel>
            <PanelResizeHandle className="w-1 bg-stone-200 dark:bg-stone-800 hover:bg-accent transition-colors" />
            <Panel defaultSize={45} minSize={30}>
              <CenterPanel />
            </Panel>
            <PanelResizeHandle className="w-1 bg-stone-200 dark:bg-stone-800 hover:bg-accent transition-colors" />
            <Panel defaultSize={40} minSize={25}>
              <PDFPreview />
            </Panel>
          </PanelGroup>
        </div>
        <AIPanel />
      </div>
    </AppShell>
  );
}
