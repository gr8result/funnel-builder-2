// Applies only this reviewed additive migration, never pending unrelated migrations.
import fs from 'node:fs/promises';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ path: '.env', quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const migration = 'supabase/migrations/20261003000100_builder_selection_tenant_foundation.sql';
const existing = await db.from('builder_inclusion_schedules').select('id').limit(1);
if (!existing.error) { console.log('Tenant foundation already present. No migration executed.'); process.exit(0); }
if (!['PGRST205','42P01'].includes(existing.error.code)) throw new Error(existing.error.message);
if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({migration,applied:false,managementCredentialAvailable:Boolean(process.env.SUPABASE_ACCESS_TOKEN)}));
  process.exit(0);
}
const sql = await fs.readFile(migration,'utf8');
if (process.env.SUPABASE_ACCESS_TOKEN) {
  const ref = new URL(url).hostname.split('.')[0];
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method:'POST', headers:{Authorization:`Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql}),
  });
  if (!response.ok) throw new Error(`Migration Management API failed (${response.status}): ${(await response.text()).slice(0,500)}`);
} else {
  const { error } = await db.rpc('exec_sql',{sql});
  if (error) throw new Error(`Migration not applied: ${error.message}. A database migration credential or SQL Editor is required.`);
}
console.log('Applied tenant foundation migration. Existing quote and job payloads were not rewritten.');
