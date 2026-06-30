import { apiPost, apiGet } from "./client";

export interface User {
  id: string; username: string | null; email: string | null;
  is_admin: boolean; is_guest: boolean;
}

export interface AuthResponse {
  access_token: string; token_type: string; user: User;
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  return apiPost<AuthResponse>("/auth/login", { username, password });
}

export async function register(username: string, password: string, email?: string): Promise<AuthResponse> {
  return apiPost<AuthResponse>("/auth/register", { username, password, email });
}

export async function guestLogin(): Promise<AuthResponse> {
  return apiPost<AuthResponse>("/auth/guest");
}

export async function getMe(): Promise<User> {
  return apiGet<User>("/auth/me");
}
