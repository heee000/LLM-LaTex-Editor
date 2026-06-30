import { getLLMHeaders } from "./client";
import type { FileInfo } from "./files";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

type SSEHandlers = {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
  onConvert?: () => void;
};

async function readSSE(res: Response, h: SSEHandlers): Promise<void> {
  if (!res.ok) { h.onError(await res.text()); return; }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === "token") h.onToken(data.content);
          else if (data.type === "done") h.onDone();
          else if (data.type === "error") h.onError(data.message);
          else if (data.type === "converting") h.onConvert?.();
        } catch { /* skip malformed lines */ }
      }
    }
  }
}

export async function aiChatStream(
  projectId: string,
  message: string,
  model: string,
  history: Array<{ role: string; content: string }>,
  targetFile: string | null,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
  onConvert?: () => void,
): Promise<void> {
  const res = await fetch(`${BASE}/projects/${projectId}/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getLLMHeaders() },
    body: JSON.stringify({ message, model, history, target_file: targetFile }),
  });
  await readSSE(res, { onToken, onDone, onError, onConvert });
}

export async function aiGenerateStream(
  projectId: string,
  model: string,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): Promise<void> {
  const res = await fetch(`${BASE}/projects/${projectId}/ai/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getLLMHeaders(), "X-LLM-Model": model },
  });
  await readSSE(res, { onToken, onDone, onError });
}

export async function aiImportFile(
  projectId: string,
  file: File,
  model: string,
): Promise<FileInfo | { files: FileInfo[] }> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE}/projects/${projectId}/ai/import`, {
    method: "POST",
    headers: { ...getLLMHeaders(), "X-LLM-Model": model },
    body: formData,
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
