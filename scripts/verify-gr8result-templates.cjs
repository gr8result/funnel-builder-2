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

async function main() {
  loadEnv('.env.local');
  loadEnv('.env');

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: files, error } = await supabase.storage.from('email-assets').list('templates', { limit: 500 });
  if (error) throw error;

  const targets = (files || []).filter((f) => /^Business /i.test(String(f.name || '')) && /\.html$/i.test(String(f.name || '')));
  let matches = 0;

  console.log('IMPORTED_COUNT=' + targets.length);

  for (const file of targets) {
    const path = `templates/${file.name}`;
    const { data, error: dlError } = await supabase.storage.from('email-assets').download(path);
    if (dlError) throw dlError;
    const text = await data.text();
    const hasOdoo = /odoo/i.test(text);
    console.log(`${file.name} HAS_ODOO=${hasOdoo}`);
    if (hasOdoo) matches += 1;
  }

  console.log('FILES_WITH_ODOO=' + matches);
}

main().catch((err) => {
  console.error('VERIFY_FAILED:', err.message || err);
  process.exit(1);
});
