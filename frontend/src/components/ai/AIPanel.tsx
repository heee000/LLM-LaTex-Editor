import { useState, useRef, useEffect } from "react";
import { useProjectStore, useEditorStore, useSettingsStore } from "../../store";
import { aiChatStream } from "../../api/ai";
import { updateFile, createFile, listFiles } from "../../api/files";
import { triggerCompile } from "../../api/compile";
import { ChatMessage, CodeBlock } from "./ChatMessage";
import type { EditorView } from "@codemirror/view";

interface Message { role: "user" | "assistant"; content: string; }

export function AIPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const projectId = useProjectStore((s) => s.projectId);
  const files = useProjectStore((s) => s.files);
  const upsertFile = useProjectStore((s) => s.upsertFile);
  const updateFileContent = useProjectStore((s) => s.updateFileContent);
  const activeFilePath = useEditorStore((s) => s.activeFilePath);
  const editorView = useEditorStore((s) => s.editorView);
  const { llmKey, llmModel, autoCompile } = useSettingsStore();

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !projectId || !llmKey || streaming) return;
    const userMsg: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);
    let assistantContent = "";
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    await aiChatStream(
      projectId, input, llmModel,
      messages.map((m) => ({ role: m.role, content: m.content })),
      activeFilePath,
      (token) => {
        assistantContent += token;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: assistantContent };
          return next;
        });
      },
      () => setStreaming(false),
      (err) => {
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err}` }]);
        setStreaming(false);
      },
      () => {
        // Markdown detected, auto-converting to LaTeX — reset content
        assistantContent = "";
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: "" };
          return next;
        });
      },
    );
  };

  const handleApplyCode = async (block: CodeBlock) => {
    if (!projectId) return;

    const targetPath = block.targetFile || activeFilePath || "main.tex";

    // Update editor if this is the currently active file
    if (editorView && (block.targetFile === activeFilePath || !block.targetFile)) {
      const view = editorView as EditorView;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: block.content },
      });
    }

    // Save to backend — always update the target file, not just the active one
    try {
      const existing = files.find((f) => f.path === targetPath);
      if (existing) {
        await updateFile(projectId, existing.id, block.content);
        updateFileContent(existing.id, block.content);
      } else {
        try {
          const newFile = await createFile(projectId, targetPath, block.content, "tex");
          upsertFile(newFile);
        } catch {
          // File might have been created between find and create, re-fetch and try update
          try {
            const fresh = await listFiles(projectId);
            const match = fresh.find((f) => f.path === targetPath);
            if (match) {
              await updateFile(projectId, match.id, block.content);
              updateFileContent(match.id, block.content);
            }
          } catch { /* list failed, give up */ }
        }
      }
    } catch (e) {
      console.error("AI apply save failed:", e);
    }

    // Mark clean + trigger compile
    useEditorStore.getState().markClean();
    if (autoCompile) {
      try {
        const result = await triggerCompile(projectId);
        useEditorStore.getState().incrementCompileVersion();
        if (result.status === "done") {
          useEditorStore.getState().setLastCompileError(null);
        } else if (result.error_msg) {
          useEditorStore.getState().setLastCompileError(result.error_msg);
        }
      } catch { /* compile error */ }
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="h-9 px-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 text-[13px] text-stone-500 hover:text-accent transition-colors flex items-center gap-2"
        >
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          AI 助手
        </button>
      )}
      {isOpen && (
        <div className="h-72 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b border-stone-200 dark:border-stone-800">
            <span className="text-[13px] font-medium flex items-center gap-2 text-stone-700 dark:text-stone-300">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              AI 助手
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            >
              关闭
            </button>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-[13px] text-stone-400 dark:text-stone-500 text-center mt-8 leading-relaxed">
                让 AI 帮你编写、编辑或修复 LaTeX 文档。<br />
                先导入材料，然后说"帮我写一篇关于...的论文"
              </p>
            )}
            {messages.map((msg, i) => (
              <ChatMessage
                key={i}
                message={msg}
                onApplyCode={msg.role === "assistant" ? handleApplyCode : undefined}
              />
            ))}
          </div>
          <div className="flex gap-2 px-4 py-3 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={llmKey ? "让 AI 编写、编辑或解释..." : "请先在工具栏设置 API 密钥"}
              className="flex-1 text-[13px] border border-stone-300 dark:border-stone-700 rounded-panel px-3 py-1.5 bg-white dark:bg-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-accent/30 transition-shadow"
              disabled={!llmKey || streaming}
            />
            <button
              onClick={handleSend}
              disabled={!llmKey || streaming || !input.trim()}
              className="px-4 py-1.5 text-[13px] font-medium rounded-panel bg-accent text-white hover:bg-accent-hover disabled:opacity-40 transition-all shadow-button"
            >
              发送
            </button>
          </div>
        </div>
      )}
    </>
  );
}
