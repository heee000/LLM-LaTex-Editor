import type { ChatMessage, CompileJob, FileInfo, FilePreviewInfo, Project, TemplateInfo } from "./types";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
export const API_ORIGIN = BASE.replace(/\/api\/?$/, "");

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function parseError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    return data.detail || text || res.statusText;
  } catch {
    return text || res.statusText;
  }
}

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function llmHeaders(): Record<string, string> {
  const key = localStorage.getItem("llm_api_key");
  const provider = localStorage.getItem("llm_provider") || "openai";
  return key ? { "X-LLM-Key": key, "X-LLM-Provider": provider } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...authHeader(),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function listProjects(): Promise<Project[]> {
  return request<Project[]>("/projects");
}

export async function getProject(id: string): Promise<Project> {
  return request<Project>(`/projects/${id}`);
}

export async function createProject(name = "Untitled Project", templateId?: string | null): Promise<Project> {
  return request<Project>("/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, template_id: templateId || null }),
  });
}

export async function updateProject(id: string, data: Partial<Pick<Project, "name" | "main_file">>): Promise<Project> {
  return request<Project>(`/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function listFiles(projectId: string): Promise<FileInfo[]> {
  return request<FileInfo[]>(`/projects/${projectId}/files`);
}

export async function createFile(projectId: string, path: string, content = "", fileType = "tex"): Promise<FileInfo> {
  return request<FileInfo>(`/projects/${projectId}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content, file_type: fileType }),
  });
}

export async function updateFile(projectId: string, fileId: string, content: string): Promise<FileInfo> {
  return request<FileInfo>(`/projects/${projectId}/files/${fileId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

export async function deleteFile(projectId: string, fileId: string): Promise<void> {
  return request<void>(`/projects/${projectId}/files/${fileId}`, { method: "DELETE" });
}

export async function uploadFile(projectId: string, file: File): Promise<FileInfo> {
  const form = new FormData();
  form.append("file", file);
  return request<FileInfo>(`/projects/${projectId}/files/upload`, { method: "POST", body: form });
}

export async function getFilePreview(projectId: string, fileId: string): Promise<FilePreviewInfo> {
  return request<FilePreviewInfo>(`/projects/${projectId}/files/${fileId}/preview`);
}

export function resolveAssetUrl(path: string): string {
  return path.startsWith("http") ? path : `${API_ORIGIN}${path}`;
}

export async function triggerCompile(projectId: string): Promise<CompileJob> {
  return request<CompileJob>(`/projects/${projectId}/compile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force: false }),
  });
}

export function pdfUrl(projectId: string, version = 0): string {
  return `${BASE}/projects/${projectId}/pdf?v=${version}`;
}

export function exportUrl(projectId: string, type: "tex" | "pdf"): string {
  return `${BASE}/projects/${projectId}/export/${type}`;
}

type StreamHandlers = {
  onToken?: (token: string) => void;
  onEvent?: (event: Record<string, unknown>) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
};

async function readSSE(res: Response, handlers: StreamHandlers): Promise<void> {
  if (!res.ok) {
    handlers.onError?.(await parseError(res));
    return;
  }
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() || "";
    for (const eventText of events) {
      const line = eventText.split("\n").find((item) => item.startsWith("data: "));
      if (!line) continue;
      const event = JSON.parse(line.slice(6));
      handlers.onEvent?.(event);
      if (event.type === "token") handlers.onToken?.(event.content || "");
      if (event.type === "error") handlers.onError?.(event.message || "AI request failed");
      if (event.type === "done") handlers.onDone?.();
    }
  }
}

export async function aiGenerate(projectId: string, model: string, handlers: StreamHandlers): Promise<void> {
  const res = await fetch(`${BASE}/projects/${projectId}/ai/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(), ...llmHeaders(), "X-LLM-Model": model },
  });
  await readSSE(res, handlers);
}

export async function aiChat(
  projectId: string,
  message: string,
  model: string,
  history: ChatMessage[],
  targetFile: string | null,
  handlers: StreamHandlers,
): Promise<void> {
  const res = await fetch(`${BASE}/projects/${projectId}/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(), ...llmHeaders() },
    body: JSON.stringify({ message, model, history, target_file: targetFile }),
  });
  await readSSE(res, handlers);
}

export async function listTemplates(): Promise<TemplateInfo[]> {
  return request<TemplateInfo[]>("/templates");
}

export async function createTemplate(
  file: File,
  name: string,
  description: string,
  category: string,
  language: string,
): Promise<TemplateInfo> {
  const form = new FormData();
  form.append("file", file);
  form.append("name", name);
  form.append("description", description);
  form.append("category", category);
  form.append("language", language);
  return request<TemplateInfo>("/admin/templates", { method: "POST", body: form });
}

export async function guestLogin(): Promise<void> {
  const result = await request<{ access_token: string }>("/auth/guest", { method: "POST" });
  localStorage.setItem("auth_token", result.access_token);
}
