const fs = require('fs');
const path = require('path');
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

function titleCase(value) {
  return String(value || '')
    .replace(/\.html$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function fileSafe(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanHtml(html) {
  return String(html || '')
    .replace(/OdooBot/gi, 'Gr8Result Team')
    .replace(/odoo/gi, 'Gr8Result');
}

async function main() {
  loadEnv('.env.local');
  loadEnv('.env');

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const sourceDir = path.join(process.cwd(), 'email');
  const entries = fs.readdirSync(sourceDir).filter((name) => /\.html$/i.test(name));

  let uploaded = 0;
  for (const file of entries) {
    const raw = fs.readFileSync(path.join(sourceDir, file), 'utf8');
    const pretty = titleCase(file);
    const finalName = `Gr8Result Marketing - ${pretty}`;
    const target = `templates/${fileSafe(finalName)}.html`;

    const { error } = await supabase.storage.from('email-assets').upload(target, cleanHtml(raw), {
      contentType: 'text/html; charset=utf-8',
      upsert: true,
    });
    if (error) throw error;
    uploaded += 1;
    console.log('IMPORTED=' + finalName);
  }

  const { data, error } = await supabase.storage.from('email-assets').list('templates', { limit: 500 });
  if (error) throw error;

  const marketingCount = (data || []).filter((f) => /^Gr8Result Marketing - .*\.html$/i.test(String(f.name || ''))).length;
  console.log('IMPORTED_MARKETING_PACK=' + uploaded);
  console.log('VISIBLE_MARKETING_PACK=' + marketingCount);
}

main().catch((err) => {
  console.error('IMPORT_FAILED:', err.message || err);
  process.exit(1);
});
