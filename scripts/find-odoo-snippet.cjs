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
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const path = 'templates/Business Settings New Portal Signup.html';
  const { data, error } = await supabase.storage.from('email-assets').download(path);
  if (error) throw error;
  const text = await data.text();
  const match = text.match(/.{0,180}odoo.{0,180}/i);
  console.log(match ? match[0] : 'NO_MATCH');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
