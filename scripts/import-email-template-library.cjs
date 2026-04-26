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

function makeNeutralSlug(name) {
  const base = String(name || '').replace(/\.html$/i, '').trim();
  return `studio-${base}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

async function main() {
  loadEnv(path.resolve(process.cwd(), '.env.local'));
  loadEnv(path.resolve(process.cwd(), '.env'));

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) throw new Error('Missing Supabase environment variables.');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const emailDir = path.resolve(process.cwd(), 'email');
  const files = fs.readdirSync(emailDir).filter((file) => file.toLowerCase().endsWith('.html'));

  let uploadedTemplates = 0;
  for (const file of files) {
    const neutral = `${makeNeutralSlug(file)}.html`;
    const html = fs.readFileSync(path.join(emailDir, file), 'utf8');
    const upload = await supabase.storage.from('email-assets').upload(`templates/${neutral}`, html, {
      contentType: 'text/html',
      upsert: true,
    });
    if (upload.error) throw upload.error;
    uploadedTemplates += 1;
  }

  const [accountsRes, leadsRes] = await Promise.all([
    supabase.from('accounts').select('user_id'),
    supabase.from('leads').select('user_id'),
  ]);

  const userIds = [...new Set([
    ...((accountsRes.data || []).map((row) => String(row.user_id || '').trim())),
    ...((leadsRes.data || []).map((row) => String(row.user_id || '').trim())),
  ].filter(Boolean))];

  for (const userId of userIds) {
    const { data: docs } = await supabase.storage.from('email-user-assets').list(`${userId}/builder-docs`, { limit: 500 });
    const { data: finished } = await supabase.storage.from('email-user-assets').list(`${userId}/finished-emails`, { limit: 500 });

    const docDeletes = (docs || [])
      .filter((item) => /^odoo-.*\.(json|html)$/i.test(String(item.name || '')))
      .map((item) => `${userId}/builder-docs/${item.name}`);

    const finishedDeletes = (finished || [])
      .filter((item) => /^odoo-.*\.html$/i.test(String(item.name || '')))
      .map((item) => `${userId}/finished-emails/${item.name}`);

    const removePaths = [...docDeletes, ...finishedDeletes];
    if (removePaths.length) {
      const removal = await supabase.storage.from('email-user-assets').remove(removePaths);
      if (removal.error) throw removal.error;
    }

    console.log(`USER ${userId} CLEANED=${removePaths.length}`);
  }

  const { data: publicTemplates } = await supabase.storage.from('email-assets').list('templates', { limit: 500 });
  console.log(`PUBLIC_TEMPLATES=${(publicTemplates || []).filter((f) => String(f.name || '').endsWith('.html')).length}`);
  console.log(`UPLOADED_TEMPLATE_FILES=${uploadedTemplates}`);
}

main().catch((error) => {
  console.error('IMPORT_FAILED:', error.message || error);
  process.exit(1);
});
