import axios from 'axios';
import type { AxiosError, AxiosInstance } from 'axios';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function apiBase(): string {
  return process.env.NEXT_PUBLIC_CLOUD_API_URL ?? 'http://localhost:5201';
}

// cloud-api returns payloads directly (no { data: T } envelope) and authenticates
// via HttpOnly session cookie — so the interceptor only normalizes errors, never
// unwraps. 401s are handled page-level, matching the pre-axios behavior.
export const api: AxiosInstance = axios.create({
  baseURL: `${apiBase()}/v1`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    const method = error.config?.method?.toUpperCase() ?? 'GET';
    const path = error.config?.url ?? '';
    const status = error.response?.status;
    throw new ApiError(status ?? 0, `${method} ${path} → ${status ?? 'no response'}`);
  },
);
