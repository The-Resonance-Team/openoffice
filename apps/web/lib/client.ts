import axios from 'axios';
import type { AxiosError, AxiosInstance } from 'axios';

const AUTH_KEY = 'oo-auth';

export interface StoredAuth {
  username: string;
  password: string;
}

export function loadAuth(): StoredAuth | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return null;
  }
}

export function saveAuth(auth: StoredAuth | null) {
  if (typeof window === 'undefined') return;
  if (!auth) {
    window.sessionStorage.removeItem(AUTH_KEY);
    return;
  }
  // Never localStorage: a Basic-auth password must not outlive the tab.
  window.sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

function apiBase(): string {
  const port = process.env.NEXT_PUBLIC_OPENOFFICE_SERVER_PORT;
  if (!port) {
    throw new Error(
      "NEXT_PUBLIC_OPENOFFICE_SERVER_PORT is not set — the web client needs the daemon's port",
    );
  }
  return `http://127.0.0.1:${port}`;
}

// The daemon returns payloads directly (no { data: T } envelope), so the
// interceptor only handles auth and error normalization — never unwrapping.
export function authHeader(): string | undefined {
  const auth = loadAuth();
  return auth ? `Basic ${btoa(`${auth.username}:${auth.password}`)}` : undefined;
}

export const api: AxiosInstance = axios.create({
  baseURL: apiBase(),
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const header = authHeader();
  if (header) {
    config.headers.Authorization = header;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    const method = error.config?.method?.toUpperCase() ?? 'GET';
    const path = error.config?.url ?? '';
    const status = error.response?.status;
    error.message = `${method} ${path} → ${status ?? 'no response'}`;
    throw error;
  },
);
