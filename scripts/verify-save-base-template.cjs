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

  const resp = await fetch('http://localhost:3001/api/email/save-base-template', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'verify-user',
      name: 'ZZ TEMP VERIFY TEMPLATE',
      path: 'templates/ZZ TEMP VERIFY TEMPLATE.html',
      scope: 'public',
      html: '<html><body><h1>ok</h1></body></html>',
    }),
  });

  const json = await resp.json().catch(() => ({}));
  console.log('API_STATUS=' + resp.status);
  console.log('API_OK=' + !!json.ok);

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } }
  );

  const { error } = await supabase.storage
    .from('email-assets')
    .remove(['templates/ZZ TEMP VERIFY TEMPLATE.html']);

  console.log('CLEANUP_OK=' + !error);

  if (!resp.ok || !json.ok || error) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
