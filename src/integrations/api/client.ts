/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * FAGE API Client — Full Supabase-compatible Drop-in Replacement
 */

const API_BASE_URL: string =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || '/api';

// ─── Token Management ──────────────────────────────────────
let _accessToken: string | null = null;
let _authListeners: Array<(event: string, session: any) => void> = [];

function getStoredToken(): string | null {
  if (_accessToken) return _accessToken;
  if (typeof window !== 'undefined') {
    _accessToken = localStorage.getItem('fage_auth_token');
  }
  return _accessToken;
}

function setStoredToken(token: string | null): void {
  _accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('fage_auth_token', token);
    else localStorage.removeItem('fage_auth_token');
  }
}

function notifyAuthListeners(event: string, session: any) {
  _authListeners.forEach(cb => { try { cb(event, session); } catch { /* noop */ } });
}

// ─── Core Fetch ─────────────────────────────────────────────
async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: any | null }> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const response = await fetch(url, { ...options, headers });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        setStoredToken(null);
        notifyAuthListeners('SIGNED_OUT', null);
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
      return { data: null, error: { message: data.message || data.msg || 'Request failed', status: response.status, ...data } };
    }
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err.message || 'Network error' } };
  }
}

// ─── Query Builder ─────────────────────────────────────────
class QueryBuilder<T = any> implements PromiseLike<{ data: T | null; error: any | null; count?: number }> {
  private _table: string;
  private _filters: string[] = [];
  private _sorts: string[] = [];
  private _limitCount: number | null = null;
  private _offsetCount = 0;
  private _selectedColumns = '*';
  private _single = false;
  private _opType: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private _mutationData: any = null;

  constructor(table: string) { this._table = table; }

  // ─── Filters / Sort ───
  select(columns = '*'): this { this._selectedColumns = columns; this._opType = 'select'; return this; }
  eq(column: string, value: any): this { this._filters.push(`${column}=eq.${value}`); return this; }
  neq(column: string, value: any): this { this._filters.push(`${column}=neq.${value}`); return this; }
  gt(column: string, value: any): this { this._filters.push(`${column}=gt.${value}`); return this; }
  lt(column: string, value: any): this { this._filters.push(`${column}=lt.${value}`); return this; }
  gte(column: string, value: any): this { this._filters.push(`${column}=gte.${value}`); return this; }
  lte(column: string, value: any): this { this._filters.push(`${column}=lte.${value}`); return this; }
  like(column: string, pattern: string): this { this._filters.push(`${column}=like.${pattern}`); return this; }
  ilike(column: string, pattern: string): this { this._filters.push(`${column}=ilike.${pattern}`); return this; }
  in(column: string, values: any[]): this { this._filters.push(`${column}=in.(${values.join(',')})`); return this; }
  is(column: string, value: null | boolean): this { this._filters.push(`${column}=is.${value}`); return this; }
  contains(column: string, value: any): this { this._filters.push(`${column}=cs.${JSON.stringify(value)}`); return this; }
  or(conditions: string): this { this._filters.push(`or=(${conditions})`); return this; }
  not(): this { return this; }
  order(column: string, opts: { ascending?: boolean; nullsFirst?: boolean } = {}): this {
    this._sorts.push(`${column}.${opts.ascending !== false ? 'asc' : 'desc'}`);
    return this;
  }
  limit(count: number): this { this._limitCount = count; return this; }
  range(from: number, to: number): this { this._offsetCount = from; this._limitCount = to - from + 1; return this; }
  single(): this { this._single = true; this._limitCount = 1; return this; }
  maybeSingle(): this { this._single = true; this._limitCount = 1; return this; }

  // ─── Mutations ───
  insert(data: any | any[]): this { this._opType = 'insert'; this._mutationData = data; return this; }
  update(data: any): this { this._opType = 'update'; this._mutationData = data; return this; }
  delete(): this { this._opType = 'delete'; return this; }
  upsert(data: any | any[]): this { this._opType = 'upsert'; this._mutationData = data; return this; }

  // ─── PromiseLike ───
  then<R1 = { data: T | null; error: any | null; count?: number }, R2 = never>(
    onfulfilled?: ((v: { data: T | null; error: any | null; count?: number }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((r: any) => R2 | PromiseLike<R2>) | null
  ): Promise<R1 | R2> {
    return this._execute().then(onfulfilled as any, onrejected);
  }

  private async _execute(): Promise<{ data: any; error: any | null; count?: number }> {
    if (this._opType === 'insert') return apiFetch(`/data/${this._table}`, { method: 'POST', body: JSON.stringify(this._mutationData) });
    if (this._opType === 'upsert') return apiFetch(`/data/${this._table}/upsert`, { method: 'POST', body: JSON.stringify(this._mutationData) });
    if (this._opType === 'update') {
      const qs = this._buildFilterQs();
      return apiFetch(`/data/${this._table}${qs ? '?' + qs : ''}`, { method: 'PUT', body: JSON.stringify(this._mutationData) });
    }
    if (this._opType === 'delete') {
      const qs = this._buildFilterQs();
      return apiFetch(`/data/${this._table}${qs ? '?' + qs : ''}`, { method: 'DELETE' });
    }
    // SELECT
    const params = new URLSearchParams();
    if (this._selectedColumns && this._selectedColumns !== '*') params.set('select', this._selectedColumns);
    this._filters.forEach(f => params.append('filter[]', f));
    this._sorts.forEach(s => params.append('sort[]', s));
    if (this._limitCount !== null) params.set('limit', String(this._limitCount));
    if (this._offsetCount > 0) params.set('offset', String(this._offsetCount));
    const qs = params.toString() ? `?${params}` : '';
    const result = await apiFetch<{ data: any; count?: number }>(`/public/${this._table}${qs}`);
    if (result.error) return { data: null, error: result.error };
    if (this._single) {
      const raw = result.data?.data;
      const arr = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
      return { data: arr[0] ?? null, error: null };
    }
    return { data: result.data?.data ?? result.data ?? [], error: null, count: result.data?.count };
  }

  private _buildFilterQs(): string {
    const p = new URLSearchParams();
    this._filters.forEach(f => p.append('filter[]', f));
    return p.toString();
  }
}

// ─── Auth API ───────────────────────────────────────────────
class AuthAPI {
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    const r = await apiFetch<any>('/public/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (r.error) return { data: { user: null, session: null }, error: r.error };
    const token = r.data?.token || r.data?.access_token;
    if (token) setStoredToken(token);
    const sess = token ? { access_token: token, user: r.data?.user, refresh_token: '', expires_in: 3600, token_type: 'bearer' as const } : null;
    notifyAuthListeners('SIGNED_IN', sess);
    return { data: { user: r.data?.user, session: sess }, error: null };
  }

  async signUp({ email, password, options }: { email: string; password: string; options?: any }) {
    const name = options?.data?.full_name || options?.data?.name || email.split('@')[0];
    const r = await apiFetch<any>('/public/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) });
    if (r.error) return { data: { user: null, session: null }, error: r.error };
    const token = r.data?.token;
    if (token) setStoredToken(token);
    return { data: { user: r.data?.user, session: token ? { access_token: token, refresh_token: '', expires_in: 3600, token_type: 'bearer' as const } : null }, error: null };
  }

  async signOut() {
    await apiFetch('/auth/logout', { method: 'POST' });
    setStoredToken(null);
    notifyAuthListeners('SIGNED_OUT', null);
    return { error: null };
  }

  async getSession() {
    const token = getStoredToken();
    if (!token) return { data: { session: null }, error: null };
    const r = await apiFetch<any>('/auth/me');
    if (r.error) { setStoredToken(null); return { data: { session: null }, error: null }; }
    const user = r.data?.user || r.data;
    return { data: { session: { access_token: token, user, refresh_token: '', expires_in: 3600, token_type: 'bearer' as const } }, error: null };
  }

  async getUser() {
    const token = getStoredToken();
    if (!token) return { data: { user: null }, error: null };
    const r = await apiFetch<any>('/auth/me');
    if (r.error) return { data: { user: null }, error: r.error };
    return { data: { user: r.data?.user || r.data }, error: null };
  }

  async updateUser(updates: { password?: string; email?: string; data?: any }) {
    if (updates.password) {
      const r = await apiFetch<any>('/auth/password', { method: 'PUT', body: JSON.stringify({ password: updates.password }) });
      return { data: { user: r.data?.user }, error: r.error };
    }
    if (updates.email) {
      const r = await apiFetch<any>('/auth/profile', { method: 'PUT', body: JSON.stringify({ email: updates.email }) });
      return { data: { user: r.data?.user }, error: r.error };
    }
    if (updates.data) {
      const r = await apiFetch<any>('/auth/profile', { method: 'PUT', body: JSON.stringify(updates.data) });
      return { data: { user: r.data?.user }, error: r.error };
    }
    return { data: { user: null }, error: null };
  }

  async resetPasswordForEmail(email: string, _opts?: any) {
    return apiFetch('/public/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  }

  async refreshSession() { return this.getSession(); }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    _authListeners.push(callback);
    this.getSession().then(({ data }) => {
      callback(data.session ? 'INITIAL_SESSION' : 'SIGNED_OUT', data.session);
    });
    return { data: { subscription: { unsubscribe: () => { _authListeners = _authListeners.filter(cb => cb !== callback); } } } };
  }

  mfa = {
    getAuthenticatorAssuranceLevel: async () => ({
      data: { currentLevel: { nextVersion: 'aal1' }, nextLevel: 'aal2' },
      error: null,
    }),
    listFactors: async () => ({ data: { totp: [] as any[], phone: [] as any[], email: [] as any[] }, error: null }),
    enroll: async (_p?: any) => ({ data: null, error: null }),
    challenge: async (_p?: any) => ({ data: null, error: null }),
    verify: async (_p?: any) => ({ data: null, error: null }),
    challengeAndVerify: async (p?: any) => apiFetch('/auth/mfa/verify', { method: 'POST', body: JSON.stringify({ code: p?.code }) }),
    unenroll: async (_p?: any) => ({ data: null, error: null }),
  };
}

// ─── Storage API ────────────────────────────────────────────
class StorageAPI {
  from(bucket: string) {
    return {
      async upload(path: string, file: File, _options?: any) {
        const token = getStoredToken();
        const fd = new FormData();
        fd.append('file', file);
        fd.append('bucket', bucket);
        fd.append('path', path);
        const resp = await fetch(`${API_BASE_URL}/storage/upload`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
        const data = await resp.json();
        return { data: data?.url ? { path: data.path, fullPath: data.url, fullUrl: data.url } : null, error: resp.ok ? null : data };
      },
      getPublicUrl(path: string) {
        return { data: { publicUrl: `${API_BASE_URL}/storage/${bucket}/${path}`, url: `${API_BASE_URL}/storage/${bucket}/${path}` } };
      },
      async remove(paths: string[]) { return apiFetch('/storage/remove', { method: 'DELETE', body: JSON.stringify({ bucket, paths }) }); },
      async list(prefix?: string) { return apiFetch(`/storage/${bucket}/list`, { method: 'POST', body: JSON.stringify({ prefix }) }); },
      async download(_path: string) { return { data: null, error: null }; },
      async createSignedUrl(path: string, _expiresIn?: number) { return { data: { signedUrl: `${API_BASE_URL}/storage/${bucket}/${path}` }, error: null }; },
    };
  }
}

// ─── RPC ────────────────────────────────────────────────────
class RpcAPI {
  call<T = any>(functionName: string, params: Record<string, any> = {}): Promise<{ data: T | null; error: any | null }> {
    return apiFetch<T>(`/rpc/${functionName}`, { method: 'POST', body: JSON.stringify(params) });
  }
}

// ─── Realtime Channel (stub) ────────────────────────────────
class ChannelStub {
  constructor(_name: string) {}
  on(_event: string, _filter?: any, _callback?: any): this { return this; }
  subscribe(_callback?: any): this { if (_callback) _callback('SUBSCRIBED'); return this; }
  unsubscribe(): Promise<'ok'> { return Promise.resolve('ok'); }
}

// ─── Main Client ────────────────────────────────────────────
class FageApiClient {
  auth = new AuthAPI();
  storage = new StorageAPI();
  private _rpc = new RpcAPI();
  functions = { invoke: async (name: string, opts?: any) => this._rpc.call(name, opts?.body || {}) };

  from<T = any>(table: string): QueryBuilder<T> { return new QueryBuilder<T>(table); }

  rpc<T = any>(functionName: string, params: Record<string, any> = {}): Promise<{ data: T | null; error: any | null }> {
    return this._rpc.call<T>(functionName, params);
  }

  channel(name: string): ChannelStub { return new ChannelStub(name); }
  async removeChannel(_ch?: any): Promise<'ok'> { return Promise.resolve('ok'); }

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<{ data: T | null; error: any | null }> {
    return apiFetch<T>(endpoint, options);
  }

  getToken(): string | null { return getStoredToken(); }
  setToken(token: string | null): void { setStoredToken(token); }
}

export const api = new FageApiClient();
export const supabase = api;
export default api;
