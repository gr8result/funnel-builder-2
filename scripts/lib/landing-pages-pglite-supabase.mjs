// A tiny stand-in for the supabase-js client, backed by PGlite, covering only the query-builder calls that
// lib/landing-pages/repository.js makes. It lets the real API handlers run against the real migration offline.
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const IDENT = /^[a-z_][a-z0-9_]*$/;
const q = (name) => { if (!IDENT.test(name)) throw new Error(`bad identifier ${name}`); return `"${name}"`; };

function out(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(out);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, out(v)]));
  return value;
}
const param = (v) => (v && typeof v === 'object' && !(v instanceof Date) ? JSON.stringify(v) : v);

class Builder {
  constructor(db, table) { Object.assign(this, { db, table, op: 'select', cols: '*', filters: [], orders: [], lim: null, mode: null, payload: null, returning: false }); }
  select(cols = '*') { if (this.op === 'select') this.cols = cols; else { this.returning = true; this.cols = cols; } return this; }
  insert(rows) { this.op = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
  update(patch) { this.op = 'update'; this.payload = patch; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c, v) { this.filters.push([c, '=', v]); return this; }
  neq(c, v) { this.filters.push([c, '<>', v]); return this; }
  lt(c, v) { this.filters.push([c, '<', v]); return this; }
  in(c, list) { this.filters.push([c, 'in', list]); return this; }
  order(c, { ascending = true } = {}) { this.orders.push(`${q(c)} ${ascending ? 'asc' : 'desc'}`); return this; }
  limit(n) { this.lim = n; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }
  single() { this.mode = 'one'; return this; }
  cols_() { return this.cols === '*' ? '*' : this.cols.split(',').map((column) => {
    const field = column.trim();
    const json = field.match(/^([a-z_][a-z0-9_]*)->([a-z_][a-z0-9_]*)$/);
    return json ? `${q(json[1])}->'${json[2]}' as ${q(json[2])}` : q(field);
  }).join(', '); }
  where(params) {
    if (!this.filters.length) return '';
    return ' where ' + this.filters.map(([c, op, v]) => {
      if (op === 'in') { if (!v.length) return 'false'; return `${q(c)} in (${v.map((x) => { params.push(x); return `$${params.length}`; }).join(', ')})`; }
      params.push(v); return `${q(c)} ${op} $${params.length}`;
    }).join(' and ');
  }
  async run() {
    const params = [];
    let sql;
    if (this.op === 'select') {
      sql = `select ${this.cols_()} from ${q(this.table)}${this.where(params)}${this.orders.length ? ` order by ${this.orders.join(', ')}` : ''}${this.lim ? ` limit ${Number(this.lim)}` : ''}`;
    } else if (this.op === 'insert') {
      const keys = Object.keys(this.payload[0]);
      const values = this.payload.map((row) => `(${keys.map((k) => { params.push(param(row[k])); return `$${params.length}`; }).join(', ')})`);
      sql = `insert into ${q(this.table)} (${keys.map(q).join(', ')}) values ${values.join(', ')}${this.returning ? ` returning ${this.cols_()}` : ''}`;
    } else if (this.op === 'update') {
      const sets = Object.entries(this.payload).map(([k, v]) => { params.push(param(v)); return `${q(k)} = $${params.length}`; });
      sql = `update ${q(this.table)} set ${sets.join(', ')}${this.where(params)}${this.returning ? ` returning ${this.cols_()}` : ''}`;
    } else {
      sql = `delete from ${q(this.table)}${this.where(params)}`;
    }
    try {
      if (this.db.failNext && this.db.failNext(this.table, this.op)) throw new Error('simulated outage');
      const { rows } = await this.db.pg.query(sql, params);
      const data = out(rows);
      if (this.mode === 'one') return rows.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: `expected one row, got ${rows.length}` } };
      if (this.mode === 'maybe') return rows.length > 1 ? { data: null, error: { message: 'multiple rows' } } : { data: data[0] || null, error: null };
      return { data, error: null };
    } catch (e) {
      return { data: null, error: { message: e.message } };
    }
  }
  then(resolve, reject) { return this.run().then(resolve, reject); }
}

export async function createPgliteSupabase() {
  const pg = new PGlite();
  await pg.exec(`
    create role authenticated nologin; create role anon nologin; create role service_role nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.workspaces (id uuid primary key, name text);
    create table public.workspace_members (workspace_id uuid, user_id uuid, role text, status text default 'active');
    create table public.leads (id uuid primary key default gen_random_uuid(), user_id uuid not null, workspace_id uuid, name text, email text,
      phone text, source text, lead_source text, tags text, lead_status text, notes text, stage text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
    create table public.lead_notes (id uuid primary key default gen_random_uuid(), lead_id uuid not null, user_id uuid not null, note text not null, created_at timestamptz default now());
  `);
  await pg.exec(fs.readFileSync('supabase/migrations/20261014000100_landing_page_campaigns.sql', 'utf8'));
  const client = {
    pg,
    failNext: null,
    from: (table) => new Builder(client, table),
    async rpc(name, args) {
      if (client.failRpc) return { data: null, error: { message: 'simulated CRM outage' } };
      if (!IDENT.test(name)) return { data: null, error: { message: 'bad rpc' } };
      const keys = Object.keys(args || {});
      try {
        const { rows } = await pg.query(`select ${q(name)}(${keys.map((k, i) => `${q(k)} => $${i + 1}`).join(', ')}) as result`, keys.map((k) => args[k]));
        return { data: out(rows[0]?.result), error: null };
      } catch (e) { return { data: null, error: { message: e.message } }; }
    },
  };
  return client;
}

// Minimal Next.js API req/res doubles.
export function mockReq({ method = 'GET', query = {}, body = {}, headers = {}, workspaceId, user, workspace } = {}) {
  return { method, query, body, headers: { host: 'app.test', 'x-forwarded-proto': 'https', ...headers }, socket: { remoteAddress: headers['x-test-ip'] || '203.0.113.9' }, workspaceId, user, workspace };
}
export function mockRes() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.end = () => res;
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  return res;
}
