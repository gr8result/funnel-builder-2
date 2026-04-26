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

function normalizeName(name) {
  return String(name || '')
    .replace(/\.html$/i, '')
    .replace(/^gr8result marketing\s*-\s*/i, '')
    .replace(/^gr8result\s+/i, '')
    .replace(/^business\s+/i, '')
    .replace(/^campaign\s+/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

async function main() {
  loadEnv('.env.local');
  loadEnv('.env');

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } }
  );

  const { data: files, error } = await supabase.storage.from('email-assets').list('templates', { limit: 500 });
  if (error) throw error;

  const htmls = (files || []).filter((f) => String(f.name || '').endsWith('.html'));
  console.log('PUBLIC_HTML_COUNT=' + htmls.length);

  const groups = new Map();
  for (const f of htmls) {
    const key = normalizeName(f.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f.name);
  }

  let dupGroups = 0;
  for (const [key, names] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (names.length > 1) {
      dupGroups += 1;
      console.log('DUP=' + key + ' => ' + names.join(' | '));
    }
  }
  console.log('DUPLICATE_GROUPS=' + dupGroups);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
