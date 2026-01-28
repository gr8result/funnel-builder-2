import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const flowId = 'c74ab752-75c9-47d1-8dd2-7497f1e22434';

async function reset() {
  console.log('Resetting to trigger...');
  
  const { error } = await supabase
    .from('automation_flow_runs')
    .update({
      current_node_id: 'trigger-1',
      status: 'pending',
      available_at: new Date().toISOString(),
    })
    .eq('flow_id', flowId);

  if (error) {
    console.error('❌ Error:', error);
  } else {
    console.log('✅ Reset complete');
    
    // Verify
    const { data: runs } = await supabase
      .from('automation_flow_runs')
      .select('current_node_id, status')
      .eq('flow_id', flowId);
    
    console.log('Verification:');
    runs?.forEach((r, i) => {
      console.log(`  ${i + 1}. node: ${r.current_node_id} | status: ${r.status}`);
    });
  }
}

reset().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
