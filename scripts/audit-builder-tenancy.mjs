// Read-only ownership audit. Never print credentials or customer/job contents.
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ path: '.env', quiet: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } });
const workspaces = await db.from('workspaces').select('id,name,slug');
if (workspaces.error) throw new Error(workspaces.error.message);
console.log(JSON.stringify({ workspaces: workspaces.data }));
for (const table of ['builder_products', 'builder_inclusion_templates', 'builder_standard_specifications', 'builder_commercial_projects']) {
  const { data, error } = await db.from(table).select('workspace_id');
  const owners = {};
  for (const row of data || []) owners[row.workspace_id || 'UNOWNED'] = (owners[row.workspace_id || 'UNOWNED'] || 0) + 1;
  console.log(JSON.stringify({ table, owners, error: error?.message }));
}
for (const table of ['selection_slot_definitions','builder_inclusion_schedules','builder_selection_configurations','builder_selection_quote_mappings']) {
  const result = await db.from(table).select('*').limit(5);
  console.log(JSON.stringify({table,data:result.data,error:result.error?.message}));
}
