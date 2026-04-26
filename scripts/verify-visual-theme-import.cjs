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
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } }
  );

  const { data, error } = await supabase.storage.from('email-assets').list('templates', { limit: 500 });
  if (error) throw error;

  const visual = (data || []).filter((f) => /^Gr8Result .*\.html$/i.test(String(f.name || '')));
  console.log('VISUAL_TEMPLATE_COUNT=' + visual.length);

  let withOdoo = 0;
  for (const f of visual) {
    const { data: download, error: downloadError } = await supabase.storage.from('email-assets').download(`templates/${f.name}`);
    if (downloadError) throw downloadError;
    const html = await download.text();
    const hasOdoo = /odoo/i.test(html);
    console.log(`${f.name} HAS_ODOO=${hasOdoo}`);
    if (hasOdoo) withOdoo += 1;
  }

  console.log('VISUAL_FILES_WITH_ODOO=' + withOdoo);
}

main().catch((err) => {
  console.error('VERIFY_FAILED:', err.message || err);
  process.exit(1);
});
