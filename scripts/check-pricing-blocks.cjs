require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data } = await sb.from('published_websites').select('site_data').eq('project_id', 'draft:2208a52a-8175-477e-823c-fc6de7fe4afe').single();
  const blocks = data.site_data.pageBlocks['Pricing'] || [];
  blocks.forEach((b, i) => {
    if (b.type === 'text' && b.props?.text) {
      console.log('BLOCK', i, 'type=text, text preview:');
      console.log(JSON.stringify(b.props.text.slice(0, 300)));
      console.log('---');
    }
    // Also check columns blocks
    if ((b.type === 'columns' || b.type === 'two-column') && b.props) {
      const keys = ['text','leftText','rightText','col1Text','col2Text','body','content'];
      for (const k of keys) {
        if (b.props[k]) {
          console.log('BLOCK', i, `type=${b.type} prop=${k}:`, JSON.stringify(b.props[k].slice(0, 200)));
          console.log('---');
        }
      }
    }
  });
})().catch(console.error);
