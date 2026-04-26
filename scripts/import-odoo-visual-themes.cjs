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

const FRIENDLY_NAMES = {
  theme_bignews_template: 'Gr8Result Big News',
  theme_blogging_template: 'Gr8Result Blogging',
  theme_coffeebreak_template: 'Gr8Result Coffee Break',
  theme_coupon_template: 'Gr8Result Coupon Code',
  theme_event_template: 'Gr8Result Event Promo',
  theme_magazine_template: 'Gr8Result Magazine',
  theme_newsletter_template: 'Gr8Result Newsletter',
  theme_promotion_template: 'Gr8Result Promotion Program',
  theme_roadshow1_template: 'Gr8Result Roadshow Schedule',
  theme_roadshow2_template: 'Gr8Result Roadshow Follow Up',
  theme_training_template: 'Gr8Result Training',
};

function fileSafe(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanHtml(html) {
  return String(html || '')
    .replace(/OdooBot/gi, 'Gr8Result Team')
    .replace(/https?:\/\/(www\.)?odoo\.com/gi, 'https://gr8result.com')
    .replace(/https?:\/\/twitter\.com\/Odoo/gi, 'https://gr8result.com')
    .replace(/https?:\/\/www\.facebook\.com\/Odoo/gi, 'https://gr8result.com')
    .replace(/https?:\/\/www\.linkedin\.com\/company\/odoo/gi, 'https://gr8result.com')
    .replace(/https?:\/\/www\.instagram\.com\/explore\/tags\/odoo\//gi, 'https://gr8result.com')
    .replace(/https?:\/\/www\.tiktok\.com\/@odoo/gi, 'https://gr8result.com')
    .replace(/odoo/gi, 'Gr8Result')
    .replace(/(src|href)="\/(?!\/)/gi, '$1="http://localhost:8069/')
    .replace(/(src|href)='\/(?!\/)/gi, "$1='http://localhost:8069/");
}

function wrapHtml(title, body) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>body{margin:0;padding:0;background:#f3f6fb;font-family:Arial,sans-serif;}</style>
  </head>
  <body>
    ${body}
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

  const viewsRes = await odooJson(base, '/web/dataset/call_kw/ir.ui.view/search_read', {
    jsonrpc: '2.0',
    method: 'call',
    params: {
      model: 'ir.ui.view',
      method: 'search_read',
      args: [[['key', 'ilike', 'mass_mailing_themes.theme_']]],
      kwargs: {
        fields: ['id', 'key', 'name', 'arch_db'],
        limit: 100,
      },
    },
  }, sessionId);

  const views = Array.isArray(viewsRes.json.result) ? viewsRes.json.result : [];

  const { data: existing, error: listError } = await supabase.storage.from('email-assets').list('templates', { limit: 500 });
  if (listError) throw listError;

  const removePaths = (existing || [])
    .filter((f) => /^Business .*\.html$/i.test(String(f.name || '')))
    .map((f) => `templates/${f.name}`);

  if (removePaths.length) {
    const { error: removeError } = await supabase.storage.from('email-assets').remove(removePaths);
    if (removeError) throw removeError;
  }

  let uploaded = 0;
  for (const view of views) {
    const rawName = String(view.name || '').trim();
    const keyName = String(view.key || '').split('.').pop();
    const finalName = FRIENDLY_NAMES[keyName] || fileSafe(rawName || keyName);
    const html = wrapHtml(finalName, cleanHtml(view.arch_db || ''));
    const fileName = `${fileSafe(finalName)}.html`;

    const { error } = await supabase.storage.from('email-assets').upload(`templates/${fileName}`, html, {
      contentType: 'text/html',
      upsert: true,
    });
    if (error) throw error;

    uploaded += 1;
    console.log('THEME=' + finalName);
  }

  const { data: after, error: afterError } = await supabase.storage.from('email-assets').list('templates', { limit: 500 });
  if (afterError) throw afterError;

  console.log('IMPORTED_VISUAL_THEMES=' + uploaded);
  console.log('PUBLIC_HTML_TOTAL=' + (after || []).filter((f) => String(f.name || '').endsWith('.html')).length);
}

main().catch((err) => {
  console.error('IMPORT_FAILED:', err.message || err);
  process.exit(1);
});
