const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string>;
}

export async function apiGet<T>(path: string, opts?: RequestOptions): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  if (opts?.params) Object.entries(opts.params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: { ...getAuthHeader(), ...opts?.headers } });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function apiPost<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeader(), ...opts?.headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function apiPut<T>(path: string, body: unknown, opts?: RequestOptions): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeader(), ...opts?.headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json();
}

export async function apiDelete(path: string, opts?: RequestOptions): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE", headers: { ...getAuthHeader(), ...opts?.headers } });
  if (!res.ok) throw new ApiError(res.status, await res.text());
}

export async function apiUpload<T>(path: string, formData: FormData, opts?: RequestOptions): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST", headers: { ...getAuthHeader(), ...opts?.headers }, body: formData,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json();
}

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getLLMHeaders(): Record<string, string> {
  const key = localStorage.getItem("llm_api_key");
  const provider = localStorage.getItem("llm_provider") || "";
  return key ? { "X-LLM-Key": key, "X-LLM-Provider": provider } : {};
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
