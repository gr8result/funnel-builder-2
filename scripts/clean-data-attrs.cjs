require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function stripDataAttrs(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/ data-[a-z][a-z0-9-]*="[^"]*"/gi, '')
    .replace(/ data-[a-z][a-z0-9-]*='[^']*'/gi, '');
}

(async () => {
  const { data, error } = await sb
    .from('published_websites')
    .select('id,site_data')
    .eq('project_id', 'draft:2208a52a-8175-477e-823c-fc6de7fe4afe')
    .single();
  if (error) { console.log('error:', error); return; }

  let changed = 0;
  const sd = data.site_data;
  for (const [, blocks] of Object.entries(sd.pageBlocks || {})) {
    if (!Array.isArray(blocks)) continue;
    for (const block of blocks) {
      if (!block.props) continue;
      for (const key of Object.keys(block.props)) {
        const val = block.props[key];
        if (typeof val === 'string' && val.includes('data-')) {
          const cleaned = stripDataAttrs(val);
          if (cleaned !== val) { block.props[key] = cleaned; changed++; }
        }
      }
    }
  }

  if (changed === 0) { console.log('Nothing to clean'); return; }

  const { error: upErr } = await sb
    .from('published_websites')
    .update({ site_data: sd })
    .eq('id', data.id);
  if (upErr) console.log('update error:', upErr);
  else console.log('Cleaned', changed, 'values in Supabase draft');
})().catch(e => { console.error(e); process.exit(1); });
