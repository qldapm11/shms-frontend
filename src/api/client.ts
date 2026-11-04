import axios from 'axios';

// Prefix gateway: mọi API gọi qua /shms/api/v1 để khớp Nginx route /shms/.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const api = axios.create({ baseURL: `${BASE}/api/v1` });

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
      const loginPath = `${BASE}/login`;
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
