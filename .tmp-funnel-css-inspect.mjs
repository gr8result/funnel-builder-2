import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const stepId = '317fce1f-8cfd-400e-b6b1-6447133babdf';
const { data, error } = await supabase.from('funnel_steps').select('content').eq('id', stepId).single();
if (error) throw error;
const content = String(data?.content || '');
for (const key of ['#i4w67h', '#ijjncp', '#i7bqv8']) {
  const idx = content.indexOf(key);
  console.log('\nKEY', key, 'AT', idx);
  if (idx >= 0) console.log(content.slice(Math.max(0, idx - 350), Math.min(content.length, idx + 900)));
}
