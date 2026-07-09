export interface Project {
  id: string;
  user_id: string | null;
  name: string;
  template_id: string | null;
  main_file: string;
  created_at: string;
  updated_at: string;
}

export interface FileInfo {
  id: string;
  project_id: string;
  path: string;
  content: string | null;
  file_type: string;
  size: number;
  created_at: string;
  updated_at: string;
}

export interface CompileJob {
  id: string;
  status: string;
  log: string | null;
  pdf_url: string | null;
  error_msg: string | null;
  created_at?: string | null;
}

export interface TemplateInfo {
  id: string;
  name: string;
  description: string | null;
  category: string;
  language: string;
  thumbnail_url: string | null;
  is_public: boolean;
  created_at: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CodeBlock {
  language: string;
  targetFile: string | null;
  content: string;
}

export interface FilePreviewInfo {
  id: string;
  path: string;
  file_type: string;
  size: number;
  preview_type: "text" | "image" | "pdf" | "table" | "download";
  text?: string;
  asset_url?: string;
  rows?: Array<Array<string | number | null>>;
}
