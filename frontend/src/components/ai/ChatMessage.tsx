import { useMemo } from "react";
import ReactMarkdown from "react-markdown";

interface Message { role: "user" | "assistant"; content: string; }

export interface CodeBlock {
  language: string;
  targetFile: string | null;
  content: string;
}

function extractFileTarget(infoString: string): string | null {
  const match = infoString.match(/file=(\S+)/);
  return match ? match[1] : null;
}

/** Pre-parse all fenced code blocks from raw markdown to extract file= targets.
 *  react-markdown puts the info string meta on the parent <pre> node,
 *  not on <code>, so we parse the raw markdown instead. */
function parseCodeBlockMeta(raw: string): Map<string, { lang: string; fileTarget: string | null }> {
  const map = new Map<string, { lang: string; fileTarget: string | null }>();
  const regex = /```([^\n]+)\n([\s\S]*?)```/g;
  let m;
  while ((m = regex.exec(raw)) !== null) {
    const info = m[1].trim();       // e.g. "latex" or "latex file=main.tex"
    const content = m[2].trim();    // code body
    const lang = info.split(/\s+/)[0];
    const fileTarget = extractFileTarget(info);
    map.set(content, { lang, fileTarget });
  }
  return map;
}

export function ChatMessage({
  message,
  onApplyCode,
}: {
  message: Message;
  onApplyCode?: (block: CodeBlock) => void;
}) {
  const codeMetaMap = useMemo(() => parseCodeBlockMeta(message.content), [message.content]);

  if (message.role === "user") {
    return (
      <div className="mb-3 text-right">
        <span className="text-[10px] font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">你</span>
        <div className="mt-1 text-[13px] rounded-xl rounded-br-sm px-3 py-2 inline-block max-w-[85%] bg-accent text-white">
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3 text-left">
      <span className="text-[10px] font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">AI</span>
      <div className="text-[13px] text-stone-800 dark:text-stone-200 leading-relaxed">
        <ReactMarkdown
          components={{
            code({ className, children, ...props }) {
              const text = String(children).replace(/\n$/, "");
              const lang = (className || "").replace("language-", "");
              const isBlock = lang && text.includes("\n");

              if (!isBlock) {
                return (
                  <code className="bg-stone-100 dark:bg-stone-800 px-1 py-0.5 rounded text-[11px] font-mono" {...props}>
                    {children}
                  </code>
                );
              }

              // Look up file= target from pre-parsed markdown
              const meta = codeMetaMap.get(text.trim()) ?? codeMetaMap.get(text);
              const targetFile = meta?.fileTarget ?? null;
              const displayLang = meta?.lang || lang;

              return (
                <div className="relative my-3 border border-stone-200 dark:border-stone-700 rounded-subtle overflow-hidden">
                  <div className="flex items-center justify-between bg-stone-100 dark:bg-stone-800 px-3 py-1.5 text-[10px] uppercase tracking-wide text-stone-500 dark:text-stone-400">
                    <span className="font-medium">{targetFile || displayLang || "代码"}</span>
                    {onApplyCode && (
                      <button
                        onClick={() => onApplyCode({ language: displayLang, targetFile, content: text })}
                        className="px-3 py-0.5 rounded-subtle bg-accent text-white text-[10px] font-medium hover:bg-accent-hover transition-colors shadow-button"
                      >
                        应用
                      </button>
                    )}
                  </div>
                  <pre className="bg-white dark:bg-stone-900 p-3 overflow-x-auto text-[12px] font-mono leading-relaxed">
                    <code className={className}>{text}</code>
                  </pre>
                </div>
              );
            },
            p({ children }) {
              return <p className="mb-2 last:mb-0">{children}</p>;
            },
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
