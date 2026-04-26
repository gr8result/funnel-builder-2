const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let [, k, v] = m;
    v = v.replace(/^['\"]|['\"]$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
}

function cleanContent(value) {
  return String(value || '')
    .replace(/OdooBot/gi, 'Gr8Result Team')
    .replace(/https?:\/\/(www\.)?odoo\.com/gi, 'https://gr8result.com')
    .replace(/odoo/gi, 'Gr8Result')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanName(value) {
  return cleanContent(value)
    .replace(/:/g, ' - ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeFileName(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wrapHtml(name, subject, body) {
  const title = cleanContent(name || 'Business Email Template');
  const cleanedBody = cleanContent(String(body || '').trim());
  const safeBody = cleanedBody || `<div style="padding:24px;font-family:Arial,sans-serif"><h1>${title}</h1><p>${cleanContent(subject || '')}</p></div>`;
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f6fb;">
    ${safeBody}
  </body>
</html>`;
}

async function odooJson(base, path, payload, sessionId) {
  const headers = { 'Content-Type': 'application/json' };
  if (sessionId) headers.Cookie = `session_id=${sessionId}`;
  const res = await fetch(base + path, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json?.error?.data?.message || json?.error?.message || `Request failed: ${res.status}`);
  }
  return { json, headers: res.headers };
}

async function main() {
  loadEnv('.env.local');
  loadEnv('.env');

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const base = 'http://localhost:8069';

  const auth = await odooJson(base, '/web/session/authenticate', {
    jsonrpc: '2.0',
    method: 'call',
    params: { db: 'odoo', login: 'admin', password: 'admin' },
  });

  const setCookie = auth.headers.get('set-cookie') || '';
  const sessionMatch = setCookie.match(/session_id=([^;]+)/);
  const sessionId = sessionMatch ? sessionMatch[1] : null;
  if (!sessionId) throw new Error('No Odoo session established');

  const templatesRes = await odooJson(base, '/web/dataset/call_kw/mail.template/search_read', {
    jsonrpc: '2.0',
    method: 'call',
    params: {
      model: 'mail.template',
      method: 'search_read',
      args: [[]],
      kwargs: {
        fields: ['id', 'name', 'subject', 'body_html'],
        limit: 100,
      },
    },
  }, sessionId);

  const rows = Array.isArray(templatesRes.json.result) ? templatesRes.json.result : [];
  let uploaded = 0;
  const names = [];

  for (const row of rows) {
    const baseName = cleanName(row.name || `Template ${row.id}`);
    const finalName = safeFileName(`Business ${baseName}`).trim();
    const fileName = `${finalName}.html`;
    const html = wrapHtml(finalName, cleanName(row.subject || ''), row.body_html || '');

    const { error } = await supabase.storage.from('email-assets').upload(`templates/${fileName}`, html, {
      contentType: 'text/html',
      upsert: true,
    });
    if (error) throw error;

    uploaded += 1;
    names.push(finalName);
  }

  console.log('IMPORTED_REAL_TEMPLATES=' + uploaded);
  names.slice(0, 20).forEach((name) => console.log('TEMPLATE=' + name));

  const { data: files, error: listError } = await supabase.storage.from('email-assets').list('templates', { limit: 500 });
  if (listError) throw listError;
  console.log('PUBLIC_HTML_TOTAL=' + (files || []).filter((f) => String(f.name || '').endsWith('.html')).length);
}

main().catch((err) => {
  console.error('IMPORT_FAILED:', err.message || err);
  process.exit(1);
});
