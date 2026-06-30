import { apiGet, apiPost } from "./client";

export interface CompileJob {
  id: string; status: string; log: string | null; pdf_url: string | null; error_msg: string | null;
}

export async function triggerCompile(projectId: string): Promise<CompileJob> {
  return apiPost<CompileJob>(`/projects/${projectId}/compile`, { force: false });
}
export async function getCompileStatus(projectId: string, jobId: string): Promise<CompileJob> {
  return apiGet<CompileJob>(`/projects/${projectId}/compile/${jobId}`);
}
export function getPDFUrl(projectId: string): string {
  return `${import.meta.env.VITE_API_URL || "http://localhost:8000/api"}/projects/${projectId}/pdf`;
}
