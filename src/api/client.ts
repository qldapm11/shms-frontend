import axios from 'axios';

// API base URL: dùng biến môi trường hoặc relative path
const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.BASE_URL.replace(/\/$/, '');
export const api = axios.create({ baseURL: `${API_BASE}/api/v1` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('shms_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('shms_token');
      const loginPath = `/login`;
      if (location.pathname !== loginPath) location.href = loginPath;
    }
    return Promise.reject(err);
  },
);

export function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error?.message || err.message;
  }
  return 'Lỗi không xác định';
}
