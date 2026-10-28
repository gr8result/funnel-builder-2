// A local stand-in for Supabase (auth, PostgREST subset, storage, rpc) backed by PGlite, for browser tests.
// The real app runs unmodified against it by pointing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL at this server.
// Nothing here touches the real Supabase project.
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const IDENT = /^[a-z_][a-z0-9_]*$/;
const qi = (n) => { if (!IDENT.test(n)) throw new Error(`bad identifier ${n}`); return `"${n}"`; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

export function makeJwt(user, ttl = 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp })}.${crypto.randomBytes(16).toString('base64url')}`;
}
function decodeJwt(token) {
  try { return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString()); } catch { return null; }
}

export async function startMockSupabase({ port = 54399, seedSql = '' } = {}) {
  const pg = new PGlite();
  await pg.exec(`
    create role authenticated nologin; create role anon nologin; create role service_role nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text unique, password text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.workspaces (id uuid primary key default gen_random_uuid(), name text, slug text, plan text default 'pro', owner_id uuid, is_demo boolean default false, created_at timestamptz default now(), updated_at timestamptz default now());
    create table public.workspace_members (id uuid primary key default gen_random_uuid(), workspace_id uuid references public.workspaces(id), user_id uuid, role text, status text default 'active', invited_by uuid, created_at timestamptz default now(), updated_at timestamptz default now());
    create table public.leads (id uuid primary key default gen_random_uuid(), user_id uuid not null, pipeline_id uuid, stage text, name text, email text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      list_id uuid, phone text, source text, tags text, notes text, avatar_icon text, avatar_color text, unsubscribed_at timestamptz, workspace_id uuid, lead_owner_user_id uuid, lead_status text, lead_source text, assigned_at timestamptz, company text);
    create table public.lead_notes (id uuid primary key default gen_random_uuid(), lead_id uuid not null, user_id uuid not null, note text not null, created_at timestamptz default now());
    create table public.accounts (id uuid primary key default gen_random_uuid(), user_id uuid, email text, business_name text, full_name text, is_approved boolean, approved boolean, status text,
      subscription_status text, onboarding_completed boolean, phone_verified boolean, created_at timestamptz default now());
  `);
  await pg.exec(fs.readFileSync('supabase/migrations/20261014000100_landing_page_campaigns.sql', 'utf8'));
  if (seedSql) await pg.exec(seedSql);
  const tables = new Set((await pg.query(`select tablename from pg_tables where schemaname='public'`)).rows.map((r) => r.tablename));
  const columns = {};
  for (const r of (await pg.query(`select table_name, column_name, data_type from information_schema.columns where table_schema='public'`)).rows) (columns[r.table_name] ||= {})[r.column_name] = r.data_type;
  const files = new Map();
  const log = [];

  async function userFromAuth(req) {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const claims = decodeJwt(token);
    if (!claims?.sub || claims.exp * 1000 < Date.now()) return null;
    const { rows } = await pg.query('select id, email from auth.users where id = $1', [claims.sub]);
    return rows[0] || null;
  }
  const userJson = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: new Date().toISOString(), app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() });
  const session = (u) => ({ access_token: makeJwt(u), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `r-${u.id}`, user: userJson(u) });

  function parseValue(v) { return v === 'null' ? null : v === 'true' ? true : v === 'false' ? false : v; }
  function parseList(v) {
    return v.replace(/^\(|\)$/g, '').match(/("([^"\\]|\\.)*"|[^,]+)/g)?.map((x) => x.replace(/^"|"$/g, '')) || [];
  }
  function buildWhere(table, params, values) {
    const clauses = [];
    for (const [k, raw] of params) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
      if (!columns[table]?.[k]) throw Object.assign(new Error(`column ${table}.${k} does not exist`), { code: '42703' });
      const neg = raw.startsWith('not.');
      const v = neg ? raw.slice(4) : raw;
      const dot = v.indexOf('.');
      const op = v.slice(0, dot); const arg = v.slice(dot + 1);
      let sql;
      if (op === 'in') { const list = parseList(arg); if (!list.length) sql = 'false'; else sql = `${qi(k)} in (${list.map((x) => { values.push(x); return `$${values.length}`; }).join(',')})`; }
      else if (op === 'is') sql = `${qi(k)} is ${arg === 'null' ? 'null' : arg === 'true' ? 'true' : 'false'}`;
      else {
        const map = { eq: '=', neq: '<>', lt: '<', lte: '<=', gt: '>', gte: '>=', like: 'like', ilike: 'ilike' };
        if (!map[op]) throw new Error(`unsupported filter ${op}`);
        values.push(op.includes('like') ? arg.replace(/\*/g, '%') : parseValue(arg));
        sql = `${qi(k)} ${map[op]} $${values.length}`;
      }
      clauses.push(neg ? `not (${sql})` : sql);
    }
    return clauses.length ? ` where ${clauses.join(' and ')}` : '';
  }
  function splitSelect(sel) {
    const parts = []; let depth = 0; let cur = '';
    for (const ch of String(sel || '*')) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += ch; }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
  }
  async function selectRows(table, sel, rows) {
    const parts = splitSelect(sel);
    const embeds = parts.filter((p) => p.includes('('));
    const plain = parts.filter((p) => !p.includes('('));
    let out = rows.map((r) => (plain.includes('*') || !plain.length ? { ...r } : Object.fromEntries(plain.map((c) => [c, r[c]]))));
    for (const e of embeds) {
      const m = e.match(/^(?:(\w+):)?(\w+)(?:!\w+)?\((.*)\)$/);
      if (!m) continue;
      const alias = m[1] || m[2]; const target = m[2]; const cols = m[3];
      const fk = columns[table]?.[`${alias}_id`] ? `${alias}_id` : `${target.replace(/s$/, '')}_id`;
      for (let i = 0; i < out.length; i++) {
        if (!tables.has(target) || rows[i][fk] == null) { out[i][alias] = null; continue; }
        const { rows: t } = await pg.query(`select * from ${qi(target)} where id = $1`, [rows[i][fk]]);
        out[i][alias] = t[0] ? (await selectRows(target, cols, [t[0]]))[0] : null;
      }
    }
    return out;
  }
  const toParam = (v) => (v && typeof v === 'object' ? JSON.stringify(v) : v);

  async function rest(req, res, url, body) {
    const table = decodeURIComponent(url.pathname.replace('/rest/v1/', ''));
    const wantsObject = String(req.headers.accept || '').includes('vnd.pgrst.object');
    const send = (status, data) => {
      if (wantsObject && Array.isArray(data)) {
        if (data.length !== 1) return json(res, 406, { code: 'PGRST116', details: `The result contains ${data.length} rows`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' });
        data = data[0];
      }
      return json(res, status, data, { 'content-range': `0-${Math.max(0, (Array.isArray(data) ? data.length : 1) - 1)}/*` });
    };
    if (table.startsWith('rpc/')) {
      const fn = table.slice(4);
      const keys = Object.keys(body || {});
      const { rows } = await pg.query(`select ${qi(fn)}(${keys.map((k, i) => `${qi(k)} => $${i + 1}`).join(', ')}) as r`, keys.map((k) => toParam(body[k])));
      return json(res, 200, rows[0]?.r ?? null);
    }
    if (!tables.has(table)) return req.method === 'GET' ? send(200, []) : json(res, 201, []);
    const params = [...url.searchParams.entries()];
    const sel = url.searchParams.get('select') || '*';
    const values = [];
    const where = buildWhere(table, params, values);
    const prefer = String(req.headers.prefer || '');
    const returning = prefer.includes('return=representation');
    if (req.method === 'GET' || req.method === 'HEAD') {
      const order = url.searchParams.get('order');
      const orderSql = order ? ` order by ${order.split(',').map((o) => { const [c, dir, nulls] = o.split('.'); return `${qi(c)} ${dir === 'desc' ? 'desc' : 'asc'}${nulls === 'nullslast' ? ' nulls last' : nulls === 'nullsfirst' ? ' nulls first' : ''}`; }).join(', ')}` : '';
      const limit = url.searchParams.get('limit') ? ` limit ${Number(url.searchParams.get('limit'))}` : '';
      const offset = url.searchParams.get('offset') ? ` offset ${Number(url.searchParams.get('offset'))}` : '';
      const { rows } = await pg.query(`select * from ${qi(table)}${where}${orderSql}${limit}${offset}`, values);
      return send(200, await selectRows(table, sel, rows));
    }
    if (req.method === 'POST') {
      const list = Array.isArray(body) ? body : [body];
      if (!list.length) return json(res, 201, []);
      const keys = [...new Set(list.flatMap((r) => Object.keys(r)))].filter((k) => columns[table][k]);
      const vals = [];
      const tuples = list.map((r) => `(${keys.map((k) => { if (r[k] === undefined) return 'default'; vals.push(toParam(r[k])); return `$${vals.length}`; }).join(',')})`);
      const conflict = prefer.includes('resolution=merge-duplicates') && url.searchParams.get('on_conflict') ? ` on conflict (${url.searchParams.get('on_conflict').split(',').map(qi).join(',')}) do update set ${keys.map((k) => `${qi(k)} = excluded.${qi(k)}`).join(', ')}` : '';
      const { rows } = await pg.query(`insert into ${qi(table)} (${keys.map(qi).join(',')}) values ${tuples.join(',')}${conflict} returning *`, vals);
      return returning ? send(201, await selectRows(table, sel, rows)) : (res.writeHead(201), res.end());
    }
    if (req.method === 'PATCH') {
      const keys = Object.keys(body || {}).filter((k) => columns[table][k]);
      const sets = keys.map((k) => { values.push(toParam(body[k])); return `${qi(k)} = $${values.length}`; });
      const { rows } = await pg.query(`update ${qi(table)} set ${sets.join(', ')}${where} returning *`, values);
      return returning ? send(200, await selectRows(table, sel, rows)) : (res.writeHead(204), res.end());
    }
    if (req.method === 'DELETE') {
      const { rows } = await pg.query(`delete from ${qi(table)}${where} returning *`, values);
      return returning ? send(200, rows) : (res.writeHead(204), res.end());
    }
    return json(res, 405, { message: 'method' });
  }

  function json(res, status, data, headers = {}) {
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
    res.end(data === undefined ? '' : JSON.stringify(data));
  }

  const server = http.createServer(async (req, res) => {
    res.setHeader('access-control-allow-origin', req.headers.origin || '*');
    res.setHeader('access-control-allow-headers', req.headers['access-control-request-headers'] || '*');
    res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS,HEAD');
    res.setHeader('access-control-expose-headers', 'content-range');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks);
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    let body = null;
    if (raw.length && String(req.headers['content-type'] || '').includes('json')) { try { body = JSON.parse(raw.toString()); } catch { body = null; } }
    log.push(`${req.method} ${url.pathname}`);
    try {
      if (url.pathname.startsWith('/auth/v1/')) {
        const p = url.pathname.slice(9);
        if (p === 'user') { const u = await userFromAuth(req); return u ? json(res, 200, userJson(u)) : json(res, 401, { code: 401, msg: 'invalid JWT' }); }
        if (p === 'token' && url.searchParams.get('grant_type') === 'password') {
          const { rows } = await pg.query('select id, email from auth.users where email = $1 and password = $2', [body?.email, body?.password]);
          return rows[0] ? json(res, 200, session(rows[0])) : json(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
        }
        if (p === 'token' && url.searchParams.get('grant_type') === 'refresh_token') {
          const id = String(body?.refresh_token || '').replace(/^r-/, '');
          const { rows } = await pg.query('select id, email from auth.users where id::text = $1', [id]);
          return rows[0] ? json(res, 200, session(rows[0])) : json(res, 400, { error: 'invalid_grant' });
        }
        if (p === 'logout') { res.writeHead(204); return res.end(); }
        return json(res, 200, {});
      }
      if (url.pathname.startsWith('/rest/v1/')) return await rest(req, res, url, body);
      if (url.pathname.startsWith('/storage/v1/object/public/')) {
        const f = files.get(decodeURIComponent(url.pathname.replace('/storage/v1/object/public/', '')));
        if (!f) return json(res, 404, { message: 'not found' });
        res.writeHead(200, { 'content-type': f.type, 'cache-control': 'public, max-age=60' });
        return res.end(f.bytes);
      }
      if (url.pathname.startsWith('/storage/v1/object/')) {
        const key = decodeURIComponent(url.pathname.replace('/storage/v1/object/', ''));
        if (req.method === 'POST' || req.method === 'PUT') { files.set(key, { bytes: raw, type: String(req.headers['content-type'] || 'application/octet-stream') }); return json(res, 200, { Key: key, Id: crypto.randomUUID() }); }
        return json(res, 200, []);
      }
      if (url.pathname.startsWith('/realtime/') || url.pathname.startsWith('/functions/')) return json(res, 200, {});
      return json(res, 404, { message: 'unknown endpoint' });
    } catch (e) {
      return json(res, e.code === '42703' ? 400 : 500, { code: e.code || 'XX000', message: e.message, details: null, hint: null });
    }
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return { pg, server, url: `http://127.0.0.1:${port}`, files, log, session, close: () => new Promise((r) => server.close(r)) };
}
