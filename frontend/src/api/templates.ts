import { apiGet, apiUpload } from "./client";

export interface TemplateInfo {
  id: string; name: string; description: string | null; category: string;
  language: string; thumbnail_url: string | null; is_public: boolean; created_at: string;
}

export async function listTemplates(): Promise<TemplateInfo[]> { return apiGet<TemplateInfo[]>("/templates"); }
export async function getTemplate(id: string): Promise<TemplateInfo & { files: Array<{ id: string; path: string; content: string | null }> }> {
  return apiGet(`/templates/${id}`);
}
export async function createTemplate(file: File, name: string, description: string, category: string, language: string): Promise<TemplateInfo> {
  const fd = new FormData(); fd.append("file", file); fd.append("name", name);
  fd.append("description", description); fd.append("category", category); fd.append("language", language);
  return apiUpload<TemplateInfo>("/admin/templates", fd);
}
