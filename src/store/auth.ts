import { create } from 'zustand';
import { api } from '../api/client';

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  space: string;
  permissions: string[];
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loadMe: () => Promise<void>;
  can: (perm: string) => boolean;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('shms_token'),
  loading: false,
  async login(username, password) {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('shms_token', data.token);
    set({ token: data.token });
    await get().loadMe();
  },
  logout() {
    localStorage.removeItem('shms_token');
    set({ user: null, token: null });
  },
  async loadMe() {
    set({ loading: true });
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  can(perm) {
    const u = get().user;
    if (!u) return false;
    return u.permissions.includes('*') || u.permissions.includes(perm);
  },
}));
