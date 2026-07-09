import type { CodeBlock } from "./types";

export function parseCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const regex = /```([^\n`]*)\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    const info = match[1].trim();
    const content = match[2].trim();
    const language = info.split(/\s+/)[0] || "text";
    const fileMatch = info.match(/file=([^\s]+)/);
    blocks.push({ language, targetFile: fileMatch?.[1] || null, content });
  }
  return blocks;
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function downloadUrl(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
