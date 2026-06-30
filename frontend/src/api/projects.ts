import { apiGet, apiPost, apiPut, apiDelete } from "./client";

export interface Project {
  id: string; user_id: string | null; name: string; template_id: string | null;
  main_file: string; created_at: string; updated_at: string;
}

export async function listProjects(): Promise<Project[]> { return apiGet<Project[]>("/projects"); }
export async function getProject(id: string): Promise<Project> { return apiGet<Project>(`/projects/${id}`); }
export async function createProject(name?: string, templateId?: string): Promise<Project> {
  return apiPost<Project>("/projects", { name: name || "Untitled Project", template_id: templateId });
}
export async function updateProject(id: string, data: Partial<Pick<Project, "name" | "main_file">>): Promise<Project> {
  return apiPut<Project>(`/projects/${id}`, data);
}
export async function deleteProject(id: string): Promise<void> { return apiDelete(`/projects/${id}`); }
