/**
 * Auth API Module — Replaces supabase.auth.*
 * 
 * Usage:
 *   import { auth } from "@/integrations/api/modules/auth";
 *   await auth.signIn({ email, password });
 *   await auth.signUp({ email, password, name });
 *   await auth.signOut();
 *   const user = await auth.getUser();
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

let _token: string | null = null;

function getToken(): string | null {
  if (_token) return _token;
  if (typeof window !== 'undefined') {
    _token = localStorage.getItem('fage_auth_token');
  }
  return _token;
}

function setToken(token: string | null) {
  _token = token;
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('fage_auth_token', token);
    else localStorage.removeItem('fage_auth_token');
  }
}

async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      setToken(null);
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    throw new Error(data.message || 'Request failed');
  }

  return data as T;
}

export const auth = {
  /** Sign in with email/password */
  async signIn({ email, password }: { email: string; password: string }) {
    const data = await apiFetch<{ user: any; token: string; access_token: string }>('/public/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const token = data.token || data.access_token;
    if (token) setToken(token);
    return { user: data.user, session: token ? { access_token: token } : null };
  },

  /** Sign up a new user */
  async signUp({ email, password, name }: { email: string; password: string; name: string }) {
    const data = await apiFetch<{ user: any; token: string }>('/public/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    if (data.token) setToken(data.token);
    return { user: data.user, session: data.token ? { access_token: data.token } : null };
  },

  /** Sign out */
  async signOut() {
    try { await apiFetch('/auth/logout', { method: 'POST' }); } catch {}
    setToken(null);
    return { error: null };
  },

  /** Get current user */
  async getUser() {
    const token = getToken();
    if (!token) return { user: null };
    try {
      const data = await apiFetch<{ user: any }>('/auth/me');
      return { user: data.user };
    } catch {
      return { user: null };
    }
  },

  /** Get current session */
  async getSession() {
    const token = getToken();
    if (!token) return { session: null };
    try {
      const data = await apiFetch<{ user: any }>('/auth/me');
      return { session: { access_token: token, user: data.user } };
    } catch {
      return { session: null };
    }
  },

  /** Reset password */
  async resetPassword(email: string) {
    return apiFetch('/public/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  /** Update password */
  async updatePassword(currentPassword: string, newPassword: string) {
    return apiFetch('/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ current_password: currentPassword, password: newPassword, password_confirmation: newPassword }),
    });
  },

  /** Listen for auth state changes */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    this.getSession().then(({ session }) => {
      callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
    });
    return { data: { subscription: { unsubscribe: () => {} } } };
  },

  /** Get current token */
  getToken,
  setToken,
};
