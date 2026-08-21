/**
 * Content API Module — Replaces supabase.from('news'), .from('products'), etc.
 * 
 * Usage:
 *   import { content } from "@/integrations/api/modules/content";
 *   const news = await content.news.list({ page: 1 });
 *   const article = await content.news.get('slug');
 *   const plans = await content.subscriptionPlans.list();
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('fage_auth_token') : null;
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
  return response.json() as Promise<T>;
}

async function paginated<T>(endpoint: string, params?: Record<string, any>): Promise<T[]> {
  const qs = params ? '?' + new URLSearchParams(params as any).toString() : '';
  const data = await apiFetch<any>(`${endpoint}${qs}`);
  return data.data || data;
}

export const content = {
  /** News articles */
  news: {
    list: (params?: { page?: number; per_page?: number }) => paginated('/public/news', params),
    get: (slug: string) => apiFetch<any>(`/public/news/${slug}`),
    adminList: (params?: any) => paginated('/admin/news', params),
    create: (data: any) => apiFetch<any>('/admin/news', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch<any>(`/admin/news/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<any>(`/admin/news/${id}`, { method: 'DELETE' }),
  },

  /** Products */
  products: {
    list: (params?: any) => paginated('/public/products', params),
    get: (slug: string) => apiFetch<any>(`/public/products/${slug}`),
    adminList: (params?: any) => paginated('/admin/products', params),
    create: (data: any) => apiFetch<any>('/admin/products', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch<any>(`/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<any>(`/admin/products/${id}`, { method: 'DELETE' }),
  },

  /** Activities */
  activities: {
    list: (params?: any) => paginated('/public/activities', params),
    get: (slug: string) => apiFetch<any>(`/public/activities/${slug}`),
    adminList: (params?: any) => paginated('/admin/activities', params),
    create: (data: any) => apiFetch<any>('/admin/activities', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch<any>(`/admin/activities/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<any>(`/admin/activities/${id}`, { method: 'DELETE' }),
  },

  /** Events */
  events: {
    list: (params?: any) => paginated('/public/events', params),
    get: (slug: string) => apiFetch<any>(`/public/events/${slug}`),
    adminList: (params?: any) => paginated('/admin/events', params),
    create: (data: any) => apiFetch<any>('/admin/events', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch<any>(`/admin/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<any>(`/admin/events/${id}`, { method: 'DELETE' }),
  },

  /** Media */
  media: {
    list: (params?: any) => paginated('/public/media', params),
    adminList: (params?: any) => paginated('/admin/media', params),
    create: (data: any) => apiFetch<any>('/admin/media', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<any>(`/admin/media/${id}`, { method: 'DELETE' }),
  },

  /** Homepage slides */
  homepage: {
    get: () => apiFetch<any>('/public/home-page'),
    adminGet: () => apiFetch<any>('/admin/home-page'),
    update: (data: any) => apiFetch<any>('/admin/home-page', { method: 'PUT', body: JSON.stringify(data) }),
  },

  /** Countdown */
  countdown: {
    get: () => apiFetch<any>('/public/countdown'),
    adminGet: () => apiFetch<any>('/admin/countdown'),
    update: (data: any) => apiFetch<any>('/admin/countdown', { method: 'PUT', body: JSON.stringify(data) }),
  },

  /** Partner logos */
  partnerLogos: {
    list: () => apiFetch<any[]>('/public/partner-logos'),
    adminList: () => apiFetch<any>('/admin/partner-logos'),
    create: (data: any) => apiFetch<any>('/admin/partner-logos', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiFetch<any>(`/admin/partner-logos/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<any>(`/admin/partner-logos/${id}`, { method: 'DELETE' }),
  },

  /** Stats (public) */
  stats: () => apiFetch<any>('/public/stats'),
};
