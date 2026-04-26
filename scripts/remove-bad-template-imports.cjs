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

  const removePaths = (files || [])
    .filter((f) => /^(studio-|template-)/i.test(String(f.name || '')))
    .map((f) => `templates/${f.name}`);

  console.log('REMOVE_COUNT=' + removePaths.length);

  if (removePaths.length) {
    const { error: removeError } = await supabase.storage.from('email-assets').remove(removePaths);
    if (removeError) throw removeError;
  }

  const { data: after, error: afterError } = await supabase.storage.from('email-assets').list('templates', { limit: 500 });
  if (afterError) throw afterError;

  console.log('HTML_COUNT_AFTER=' + (after || []).filter((f) => String(f.name || '').endsWith('.html')).length);
}

main().catch((err) => {
  console.error('REMOVE_FAILED:', err.message || err);
  process.exit(1);
});
