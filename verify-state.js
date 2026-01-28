import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const flowId = 'c74ab752-75c9-47d1-8dd2-7497f1e22434';

async function check() {
  const { data: runs } = await supabase
    .from('automation_flow_runs')
    .select('id, current_node_id, status')
    .eq('flow_id', flowId);

  console.log('=== CURRENT RUN POSITIONS ===');
  if (runs && runs.length > 0) {
    runs.forEach((r, i) => {
      console.log(`${i + 1}. current_node_id: ${r.current_node_id || 'null'} | status: ${r.status}`);
    });
  }
}

check().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
