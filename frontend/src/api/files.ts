import { apiGet, apiPost, apiPut, apiDelete, apiUpload } from "./client";

export interface FileInfo {
  id: string; project_id: string; path: string; content: string | null;
  file_type: string; size: number; created_at: string; updated_at: string;
}

export async function listFiles(projectId: string): Promise<FileInfo[]> { return apiGet<FileInfo[]>(`/projects/${projectId}/files`); }
export async function getFile(projectId: string, fileId: string): Promise<FileInfo> { return apiGet<FileInfo>(`/projects/${projectId}/files/${fileId}`); }
export async function createFile(projectId: string, path: string, content = "", fileType = "tex"): Promise<FileInfo> {
  return apiPost<FileInfo>(`/projects/${projectId}/files`, { path, content, file_type: fileType });
}
export async function updateFile(projectId: string, fileId: string, content: string): Promise<FileInfo> {
  return apiPut<FileInfo>(`/projects/${projectId}/files/${fileId}`, { content });
}
export async function deleteFile(projectId: string, fileId: string): Promise<void> { return apiDelete(`/projects/${projectId}/files/${fileId}`); }
export async function uploadFile(projectId: string, file: File): Promise<FileInfo> {
  const fd = new FormData(); fd.append("file", file);
  return apiUpload<FileInfo>(`/projects/${projectId}/files/upload`, fd);
}
