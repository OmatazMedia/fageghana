/**
 * Member API Module — All member-facing dashboard endpoints
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('fage_auth_token') : null;
}

async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json', 'Accept': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'Error');
  return response.json() as Promise<T>;
}

export const member = {
  /** Dashboard */
  dashboard: () => apiFetch<any>('/member/dashboard'),

  /** Profile */
  profile: {
    get: () => apiFetch<any>('/member/profile'),
    update: (data: any) => apiFetch<any>('/member/profile', { method: 'PUT', body: JSON.stringify(data) }),
    uploadAvatar: (formData: FormData) => {
      const token = getToken();
      return fetch(`${API_BASE}/member/profile/avatar`, {
        method: 'POST', body: formData,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).then(r => r.json());
    },
    updatePassword: (data: { current_password: string; password: string }) =>
      apiFetch<any>('/auth/password', { method: 'PUT', body: JSON.stringify({ ...data, password_confirmation: data.password }) }),
  },

  /** Directory listing */
  directory: {
    get: () => apiFetch<any>('/member/directory'),
    create: (data: any) => apiFetch<any>('/member/directory', { method: 'POST', body: JSON.stringify(data) }),
    update: (data: any) => apiFetch<any>('/member/directory', { method: 'PUT', body: JSON.stringify(data) }),
  },

  /** Payments */
  payments: {
    list: (params?: any) => apiFetch<any>('/member/payments' + (params ? '?' + new URLSearchParams(params).toString() : '')),
    get: (id: string) => apiFetch<any>(`/member/payments/${id}`),
    initialize: (data: any) => apiFetch<any>('/member/payments/initialize', { method: 'POST', body: JSON.stringify(data) }),
  },

  /** Applications */
  applications: {
    list: () => apiFetch<any>('/member/applications'),
    get: (id: string) => apiFetch<any>(`/member/applications/${id}`),
    create: (data: any) => apiFetch<any>('/member/applications', { method: 'POST', body: JSON.stringify(data) }),
  },

  /** Certificates */
  certificates: {
    list: () => apiFetch<any>('/member/certificates'),
    download: (id: string) => apiFetch<any>(`/member/certificates/${id}/download`),
  },

  /** Resources */
  resources: () => apiFetch<any>('/member/resources'),

  /** Trade opportunities */
  trade: {
    list: (params?: any) => apiFetch<any>('/member/trade-opportunities'),
    get: (id: string) => apiFetch<any>(`/member/trade-opportunities/${id}`),
  },

  /** Support tickets */
  tickets: {
    list: (params?: any) => apiFetch<any>('/member/support-tickets'),
    get: (id: string) => apiFetch<any>(`/member/support-tickets/${id}`),
    create: (data: any) => apiFetch<any>('/member/support-tickets', { method: 'POST', body: JSON.stringify(data) }),
    reply: (id: string, data: any) => apiFetch<any>(`/member/support-tickets/${id}/messages`, { method: 'POST', body: JSON.stringify(data) }),
  },

  /** Email preferences */
  emailPreferences: {
    get: () => apiFetch<any>('/member/email-preferences'),
    update: (data: any) => apiFetch<any>('/member/email-preferences', { method: 'PUT', body: JSON.stringify(data) }),
  },

  /** Notifications */
  notifications: {
    list: (params?: any) => apiFetch<any>('/member/notifications'),
    unreadCount: () => apiFetch<any>('/member/notifications/unread-count'),
    markRead: (id: string) => apiFetch<any>(`/member/notifications/${id}/read`, { method: 'PUT' }),
    markAllRead: () => apiFetch<any>('/member/notifications/read-all', { method: 'PUT' }),
    delete: (id: string) => apiFetch<any>(`/member/notifications/${id}`, { method: 'DELETE' }),
  },

  /** Readiness checklist */
  readiness: {
    get: () => apiFetch<any>('/member/readiness'),
    submit: (data: any) => apiFetch<any>('/member/readiness', { method: 'POST', body: JSON.stringify(data) }),
  },
};
