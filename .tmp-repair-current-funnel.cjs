require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const funnelId = '2fc39ed2-fbd2-4750-bf8a-cc1abe625ae4';
const html = `
<section style="min-height:100vh;padding:72px 20px;background:linear-gradient(135deg,#0f172a 0%,#2563eb 100%);color:#fff;font-family:Arial,sans-serif;">
  <div style="max-width:900px;margin:0 auto;text-align:center;">
    <div style="display:inline-block;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.14);font-size:13px;font-weight:700;margin-bottom:16px;">SPORTS NUTRITION COURSE</div>
    <h1 style="font-size:56px;line-height:1.08;margin:0 0 16px;">Stop Getting Beaten In Their Tracks!</h1>
    <p style="font-size:20px;line-height:1.6;max-width:760px;margin:0 auto 26px;color:rgba(255,255,255,.9);">A compelling subheadline that hooks them emotionally and makes them desperate to read on.</p>
    <a href="#" style="display:inline-block;background:#22c55e;color:#052e16;padding:16px 28px;border-radius:999px;font-weight:800;text-decoration:none;">YES! I WANT ACCESS NOW →</a>
  </div>
</section>`.trim();

(async () => {
  const { data: existing, error: checkError } = await supabase
    .from('funnel_steps')
    .select('id')
    .eq('funnel_id', funnelId)
    .limit(1);

  if (checkError) throw checkError;

  if (!existing || existing.length === 0) {
    const { data, error } = await supabase
      .from('funnel_steps')
      .insert({
        funnel_id: funnelId,
        title: 'Page 1',
        order_index: 0,
        content: html,
      })
      .select('id,title')
      .single();

    if (error) throw error;
    console.log('INSERTED', JSON.stringify(data));
  } else {
    console.log('ALREADY_EXISTS', JSON.stringify(existing));
  }

  const { data: rows, error: rowsError } = await supabase
    .from('funnel_steps')
    .select('id,title,order_index')
    .eq('funnel_id', funnelId)
    .order('order_index', { ascending: true });

  if (rowsError) throw rowsError;
  console.log('STEP_COUNT=' + (rows?.length || 0));
  console.log(JSON.stringify(rows, null, 2));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
