/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Server-side API client — replaces @/integrations/supabase/client.server
 */

const API_BASE_URL = process.env.VITE_API_URL || 'http://127.0.0.1:8088/api';

async function sf<T = any>(endpoint: string, options: RequestInit = {}): Promise<{ data: T | null; error: any | null }> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json', ...((options.headers as Record<string, string>) || {}) };
  try {
    const response = await fetch(url, { ...options, headers });
    const data = await response.json();
    if (!response.ok) return { data: null, error: { message: data.message || 'Request failed', status: response.status } };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err.message || 'Network error' } };
  }
}

class ServerQueryBuilder<T = any> implements PromiseLike<{ data: T | null; error: any | null }> {
  private t: string;
  private f: string[] = [];
  private s: string[] = [];
  private l: number | null = null;
  private o = 0;
  private sc = '*';
  private sin = false;
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private md: any = null;

  constructor(table: string) { this.t = table; }
  select(c = '*'): this { this.sc = c; this.op = 'select'; return this; }
  eq(c: string, v: any): this { this.f.push(`${c}=eq.${v}`); return this; }
  neq(c: string, v: any): this { this.f.push(`${c}=neq.${v}`); return this; }
  gt(c: string, v: any): this { this.f.push(`${c}=gt.${v}`); return this; }
  lt(c: string, v: any): this { this.f.push(`${c}=lt.${v}`); return this; }
  gte(c: string, v: any): this { this.f.push(`${c}=gte.${v}`); return this; }
  lte(c: string, v: any): this { this.f.push(`${c}=lte.${v}`); return this; }
  like(c: string, v: string): this { this.f.push(`${c}=like.${v}`); return this; }
  ilike(c: string, v: string): this { this.f.push(`${c}=ilike.${v}`); return this; }
  in(c: string, v: any[]): this { this.f.push(`${c}=in.(${v.join(',')})`); return this; }
  is(c: string, v: any): this { this.f.push(`${c}=is.${v}`); return this; }
  or(cond: string): this { this.f.push(`or=(${cond})`); return this; }
  not(): this { return this; }
  contains(c: string, v: any): this { this.f.push(`${c}=cs.${JSON.stringify(v)}`); return this; }
  order(col: string, opts: { ascending?: boolean } = {}): this { this.s.push(`${col}.${opts.ascending !== false ? 'asc' : 'desc'}`); return this; }
  limit(n: number): this { this.l = n; return this; }
  range(from: number, to: number): this { this.o = from; this.l = to - from + 1; return this; }
  single(): this { this.sin = true; this.l = 1; return this; }
  maybeSingle(): this { this.sin = true; this.l = 1; return this; }
  insert(d: any): this { this.op = 'insert'; this.md = d; return this; }
  update(d: any): this { this.op = 'update'; this.md = d; return this; }
  delete(): this { this.op = 'delete'; return this; }
  upsert(d: any): this { this.op = 'upsert'; this.md = d; return this; }

  then<R1 = any, R2 = never>(ok?: ((v: any) => R1 | PromiseLike<R1>) | null, err?: ((r: any) => R2 | PromiseLike<R2>) | null): Promise<R1 | R2> {
    return this._e().then(ok as any, err);
  }

  private async _e(): Promise<{ data: any; error: any | null; count?: number }> {
    if (this.op === 'insert') return sf(`/data/${this.t}`, { method: 'POST', body: JSON.stringify(this.md) });
    if (this.op === 'upsert') return sf(`/data/${this.t}/upsert`, { method: 'POST', body: JSON.stringify(this.md) });
    if (this.op === 'update') { const q = this._fq(); return sf(`/data/${this.t}${q ? '?' + q : ''}`, { method: 'PUT', body: JSON.stringify(this.md) }); }
    if (this.op === 'delete') { const q = this._fq(); return sf(`/data/${this.t}${q ? '?' + q : ''}`, { method: 'DELETE' }); }
    const p = new URLSearchParams();
    if (this.sc !== '*') p.set('select', this.sc);
    this.f.forEach(f => p.append('filter[]', f));
    this.s.forEach(s => p.append('sort[]', s));
    if (this.l !== null) p.set('limit', String(this.l));
    if (this.o > 0) p.set('offset', String(this.o));
    const q = p.toString() ? `?${p}` : '';
    const r = await sf<{ data: any; count?: number }>(`/public/${this.t}${q}`);
    if (r.error) return { data: null, error: r.error };
    if (this.sin) { const raw = r.data?.data; const arr = Array.isArray(raw) ? raw : raw != null ? [raw] : []; return { data: arr[0] ?? null, error: null }; }
    return { data: r.data?.data ?? r.data ?? [], error: null, count: r.data?.count };
  }
  private _fq(): string { const p = new URLSearchParams(); this.f.forEach(f => p.append('filter[]', f)); return p.toString(); }
}

class ServerAuthAPI {
  async getUser(token?: string) {
    if (!token) return { data: { user: null }, error: null };
    const r = await sf<any>('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    return { data: { user: r.data?.user || r.data }, error: r.error };
  }
  async getClaims(token: string) {
    const r = await sf<any>('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    return { data: { claims: { sub: r.data?.user?.id || r.data?.id } }, error: r.error };
  }
  admin = {
    getUserById: async (uid: string) => {
      const r = await sf<any>(`/admin/users/${uid}`);
      return { data: { user: r.data?.user || r.data }, error: r.error };
    },
    listUsers: async () => sf<any>('/admin/users'),
    createUser: async (d: any) => sf<any>('/admin/users', { method: 'POST', body: JSON.stringify(d) }),
    updateUserById: async (uid: string, d: any) => sf<any>(`/admin/users/${uid}`, { method: 'PUT', body: JSON.stringify(d) }),
    deleteUser: async (uid: string) => sf<any>(`/admin/users/${uid}`, { method: 'DELETE' }),
  };
}

class ServerRpcAPI {
  call<T = any>(fn: string, params: Record<string, any> = {}) {
    return sf<T>(`/rpc/${fn}`, { method: 'POST', body: JSON.stringify(params) });
  }
}

class ServerStorageAPI {
  from(bucket: string) {
    return {
      async upload(path: string, file: File) {
        const fd = new FormData(); fd.append('file', file); fd.append('bucket', bucket); fd.append('path', path);
        const resp = await fetch(`${API_BASE_URL}/storage/upload`, { method: 'POST', body: fd });
        const data = await resp.json();
        return { data: data?.url ? { path: data.path, fullPath: data.url } : null, error: resp.ok ? null : data };
      },
      getPublicUrl(path: string) { return { data: { publicUrl: `${API_BASE_URL}/storage/${bucket}/${path}` } }; },
      async remove(paths: string[]) { return sf('/storage/remove', { method: 'DELETE', body: JSON.stringify({ bucket, paths }) }); },
      async download(_path: string) { return { data: null, error: null }; },
      async createSignedUrl(path: string) { return { data: { signedUrl: `${API_BASE_URL}/storage/${bucket}/${path}` }, error: null }; },
      async list(prefix?: string) { return sf(`/storage/${bucket}/list`, { method: 'POST', body: JSON.stringify({ prefix }) }); },
    };
  }
  getBucket(name: string) { return Promise.resolve({ data: { name }, error: null }); }
  createBucket(name: string) { return Promise.resolve({ data: { name }, error: null }); }
}

class ServerFageApi {
  auth = new ServerAuthAPI();
  storage = new ServerStorageAPI();
  rpc = new ServerRpcAPI();
  from<T = any>(table: string): ServerQueryBuilder<T> { return new ServerQueryBuilder<T>(table); }
  channel(): any { return { on: () => this, subscribe: () => this, unsubscribe: () => Promise.resolve('ok' as const) }; }
  removeChannel(): Promise<'ok'> { return Promise.resolve('ok'); }
}

export const supabaseAdmin = new ServerFageApi();
export default supabaseAdmin;
