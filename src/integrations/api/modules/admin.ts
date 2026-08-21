/**
 * Admin API Module — All admin management endpoints
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

export const admin = {
  /** Dashboard */
  dashboard: () => apiFetch<any>('/admin/dashboard'),
  stats: () => apiFetch<any>('/admin/stats'),

  /** User management */
  users: {
    list: (params?: any) => apiFetch<any>('/admin/users' + (params ? '?' + new URLSearchParams(params).toString() : '')),
    get: (id: string) => apiFetch<any>(`/admin/users/${id}`),
    create: (data: any) => apiFetch<any>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch<any>(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<any>(`/admin/users/${id}`, { method: 'DELETE' }),
    updateRole: (id: string, role: string) => apiFetch<any>(`/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
    updateStatus: (id: string, status: string) => apiFetch<any>(`/admin/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  },

  /** Member management */
  members: {
    list: (params?: any) => apiFetch<any>('/admin/members' + (params ? '?' + new URLSearchParams(params).toString() : '')),
    get: (id: string) => apiFetch<any>(`/admin/members/${id}`),
    update: (id: string, data: any) => apiFetch<any>(`/admin/members/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<any>(`/admin/members/${id}`, { method: 'DELETE' }),
  },

  /** Applications */
  applications: {
    list: (params?: any) => apiFetch<any>('/admin/applications'),
    get: (id: string) => apiFetch<any>(`/admin/applications/${id}`),
    updateStatus: (id: string, status: string, notes?: string) =>
      apiFetch<any>(`/admin/applications/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, notes }) }),
  },

  /** Payments */
  payments: {
    list: (params?: any) => apiFetch<any>('/admin/payments'),
    get: (id: string) => apiFetch<any>(`/admin/payments/${id}`),
    updateStatus: (id: string, status: string) => apiFetch<any>(`/admin/payments/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    stats: () => apiFetch<any>('/admin/payments/stats'),
  },

  /** Directory approvals */
  directory: {
    pending: (params?: any) => apiFetch<any>('/admin/directory/pending'),
    approve: (id: string) => apiFetch<any>(`/admin/directory/${id}/approve`, { method: 'PUT' }),
    reject: (id: string, notes?: string) => apiFetch<any>(`/admin/directory/${id}/reject`, { method: 'PUT', body: JSON.stringify({ review_notes: notes }) }),
  },

  /** Support tickets */
  tickets: {
    list: (params?: any) => apiFetch<any>('/admin/support-tickets'),
    get: (id: string) => apiFetch<any>(`/admin/support-tickets/${id}`),
    update: (id: string, data: any) => apiFetch<any>(`/admin/support-tickets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    reply: (id: string, body: string) => apiFetch<any>(`/admin/support-tickets/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
    assign: (id: string, userId: string) => apiFetch<any>(`/admin/support-tickets/${id}/assign`, { method: 'PUT', body: JSON.stringify({ contact_name: userId }) }),
  },

  /** Certificates */
  certificates: {
    list: (params?: any) => apiFetch<any>('/admin/certificates'),
    create: (data: any) => apiFetch<any>('/admin/certificates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch<any>(`/admin/certificates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<any>(`/admin/certificates/${id}`, { method: 'DELETE' }),
    verify: (id: string) => apiFetch<any>(`/admin/certificates/${id}/verify`),
  },

  /** Trade opportunities */
  trade: {
    list: (params?: any) => apiFetch<any>('/admin/trade-opportunities'),
    create: (data: any) => apiFetch<any>('/admin/trade-opportunities', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch<any>(`/admin/trade-opportunities/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<any>(`/admin/trade-opportunities/${id}`, { method: 'DELETE' }),
    match: (id: string, memberIds: string[]) => apiFetch<any>(`/admin/trade-opportunities/${id}/match`, { method: 'POST', body: JSON.stringify({ member_ids: memberIds }) }),
  },

  /** Email settings */
  emailSettings: {
    get: () => apiFetch<any>('/admin/email-settings'),
    update: (data: any) => apiFetch<any>('/admin/email-settings', { method: 'PUT', body: JSON.stringify(data) }),
  },

  /** Email templates */
  emailTemplates: {
    list: () => apiFetch<any>('/admin/email-templates'),
    get: (id: string) => apiFetch<any>(`/admin/email-templates/${id}`),
    update: (id: string, data: any) => apiFetch<any>(`/admin/email-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    test: (id: string) => apiFetch<any>(`/admin/email-templates/${id}/test`, { method: 'POST' }),
  },

  /** Email logs */
  emailLogs: (params?: any) => apiFetch<any>('/admin/email-logs'),

  /** Backups */
  backups: {
    list: () => apiFetch<any>('/admin/backups'),
    create: () => apiFetch<any>('/admin/backups/create', { method: 'POST' }),
    download: (id: string) => `${API_BASE}/admin/backups/${id}/download`,
    restore: (id: string) => apiFetch<any>(`/admin/backups/${id}/restore`, { method: 'POST' }),
    delete: (id: string) => apiFetch<any>(`/admin/backups/${id}`, { method: 'DELETE' }),
    getConfig: () => apiFetch<any>('/admin/backups/config'),
    updateConfig: (data: any) => apiFetch<any>('/admin/backups/config', { method: 'PUT', body: JSON.stringify(data) }),
  },

  /** Settings */
  settings: {
    get: () => apiFetch<any>('/admin/settings'),
    update: (data: any) => apiFetch<any>('/admin/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },

  /** Security settings */
  security: {
    get: () => apiFetch<any>('/admin/security-settings'),
    update: (data: any) => apiFetch<any>('/admin/security-settings', { method: 'PUT', body: JSON.stringify(data) }),
  },

  /** Roles */
  roles: {
    list: () => apiFetch<any>('/admin/roles'),
    update: (role: string, summary: string) => apiFetch<any>(`/admin/roles/${role}`, { method: 'PUT', body: JSON.stringify({ summary }) }),
  },

  /** Payment gateways */
  gateways: {
    list: () => apiFetch<any>('/admin/payment-gateways'),
    update: (provider: string, data: any) => apiFetch<any>(`/admin/payment-gateways/${provider}`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  /** Subscription plans */
  plans: {
    list: () => apiFetch<any>('/admin/subscription-plans'),
    create: (data: any) => apiFetch<any>('/admin/subscription-plans', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch<any>(`/admin/subscription-plans/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<any>(`/admin/subscription-plans/${id}`, { method: 'DELETE' }),
  },

  /** Readiness checklist */
  readiness: {
    list: () => apiFetch<any>('/admin/readiness-checklist'),
    create: (data: any) => apiFetch<any>('/admin/readiness-checklist', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch<any>(`/admin/readiness-checklist/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<any>(`/admin/readiness-checklist/${id}`, { method: 'DELETE' }),
  },

  /** Contact messages */
  contacts: {
    list: () => apiFetch<any>('/admin/contact-messages'),
    get: (id: string) => apiFetch<any>(`/admin/contact-messages/${id}`),
    delete: (id: string) => apiFetch<any>(`/admin/contact-messages/${id}`, { method: 'DELETE' }),
  },

  /** Activity log */
  activityLog: (params?: any) => apiFetch<any>('/admin/activity-log'),

  /** Reports */
  reports: {
    membershipGrowth: () => apiFetch<any>('/admin/reports/membership-growth'),
    payments: () => apiFetch<any>('/admin/reports/payments'),
    directory: () => apiFetch<any>('/admin/reports/directory'),
  },

  /** Chatbot config */
  chatbot: {
    get: () => apiFetch<any>('/admin/chatbot-config'),
    update: (data: any) => apiFetch<any>('/admin/chatbot-config', { method: 'PUT', body: JSON.stringify(data) }),
  },

  /** Notifications (admin send) */
  notifications: {
    send: (userIds: string[], title: string, body: string, type?: string) =>
      apiFetch<any>('/admin/admin-notifications/send', { method: 'POST', body: JSON.stringify({ user_ids: userIds, title, body, type }) }),
    getConfig: () => apiFetch<any>('/admin/admin-notifications'),
    updateConfig: (data: any) => apiFetch<any>('/admin/admin-notifications', { method: 'PUT', body: JSON.stringify(data) }),
  },
};
