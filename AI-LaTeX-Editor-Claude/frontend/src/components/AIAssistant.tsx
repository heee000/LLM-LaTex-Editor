import { ClipboardCheck, Send, Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";
import { aiChat, createFile, listFiles, triggerCompile, updateFile } from "../api";
import { useProjectStore, useSettingsStore } from "../store";
import type { ChatMessage, CodeBlock } from "../types";
import { parseCodeBlocks } from "../utils";

export function AIAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const { project, files, activeFilePath, upsertFile, updateFileContent, setFiles, finishCompile, pushActivity } = useProjectStore();
  const settings = useSettingsStore();

  const send = async () => {
    if (!project || !settings.llmKey || !input.trim() || streaming) return;
    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    let assistant = "";
    await aiChat(project.id, userMessage.content, settings.llmModel, messages, activeFilePath, {
      onToken: (token) => {
        assistant += token;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: assistant };
          return next;
        });
      },
      onError: (message) => {
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${message}` }]);
        setStreaming(false);
      },
      onDone: () => setStreaming(false),
    });
  };

  const applyBlock = async (block: CodeBlock) => {
    if (!project) return;
    const targetPath = block.targetFile || activeFilePath || "main.tex";
    const existing = files.find((file) => file.path === targetPath);
    if (existing) {
      const updated = await updateFile(project.id, existing.id, block.content);
      upsertFile(updated);
      updateFileContent(existing.id, block.content);
    } else {
      const created = await createFile(project.id, targetPath, block.content, targetPath.endsWith(".bib") ? "bib" : "tex");
      upsertFile(created);
    }
    pushActivity(`AI 写入 ${targetPath}`);
    if (settings.autoCompile) {
      const job = await triggerCompile(project.id);
      finishCompile(job.status === "done" ? null : job.error_msg || "Compilation failed");
    }
    setFiles(await listFiles(project.id));
  };

  return (
    <section className="ai-panel">
      <div className="panel-title">
        <div>
          <p className="eyebrow">Collaborator</p>
          <h2>AI 助手</h2>
        </div>
        <Sparkles size={18} />
      </div>
      <div className="chat-log">
        {messages.length === 0 && (
          <div className="assistant-empty">
            <Wand2 size={20} />
            <p>可以让 AI 改写当前文件、解释错误，或基于所有已导入材料生成完整论文。</p>
          </div>
        )}
        {messages.map((message, index) => (
          <article key={index} className={`chat-message ${message.role}`}>
            <p>{message.role === "user" ? "你" : "AI"}</p>
            <pre>{message.content}</pre>
            {message.role === "assistant" &&
              parseCodeBlocks(message.content).map((block, blockIndex) => (
                <button key={blockIndex} className="mini-command" onClick={() => applyBlock(block)}>
                  <ClipboardCheck size={15} />
                  应用到 {block.targetFile || activeFilePath || "main.tex"}
                </button>
              ))}
          </article>
        ))}
      </div>
      <div className="chat-input">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          placeholder={settings.llmKey ? "让 AI 修改、解释或生成 LaTeX..." : "先在设置中填写 API key"}
          disabled={!settings.llmKey || streaming}
        />
        <button className="primary-button icon-only" disabled={!settings.llmKey || streaming || !input.trim()} onClick={send} title="发送">
          <Send size={17} />
        </button>
      </div>
    </section>
  );
}
