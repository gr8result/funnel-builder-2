import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const TABLES = {
  landing_campaigns: 'id,workspace_id,created_by,name,status,brief,interview',
  landing_pages: 'id,workspace_id,campaign_id,document,revision,published_version_id',
  landing_page_versions: 'id,workspace_id,page_id,version_no,kind,document',
  landing_page_submissions: 'id,workspace_id,campaign_id,page_id,status,attempts,lead_id',
  landing_page_events: 'id,workspace_id,page_id,campaign_id,type',
  landing_audit_log: 'id,workspace_id,entity,entity_id,action',
  workspaces: 'id,name',
  workspace_members: 'workspace_id,user_id,role,status',
  leads: 'id,user_id,workspace_id,name,email,phone,source,lead_source,tags,lead_status',
  lead_notes: 'id,lead_id,user_id,note',
};

export async function checkLandingPagesReadiness({ env = process.env, client, expectedProject } = {}) {
  const failures = [];
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
  for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'OPENAI_API_KEY', 'CRON_SECRET']) {
    if (!String(env[name] || '').trim()) failures.push({ check: `config:${name}`, code: 'MISSING' });
  }
  if (!key) failures.push({ check: 'config:SUPABASE_SERVICE_ROLE_KEY', code: 'MISSING' });
  for (const name of ['LANDING_PAGE_FORM_SECRET', 'CRON_SECRET']) {
    if (env[name] && env[name].length < 32) failures.push({ check: `config:${name}`, code: 'SECRET_TOO_SHORT' });
  }
  let project = null;
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
    project = url.hostname.split('.')[0];
    if (url.protocol !== 'https:') failures.push({ check: 'config:database_url', code: 'HTTPS_REQUIRED' });
    if (env.SUPABASE_URL && new URL(env.SUPABASE_URL).origin !== url.origin) failures.push({ check: 'config:database_target', code: 'TARGET_MISMATCH' });
    if (expectedProject && project !== expectedProject) failures.push({ check: 'config:database_target', code: 'TARGET_MISMATCH' });
  } catch { failures.push({ check: 'config:database_url', code: 'INVALID' }); }
  const publicUrl = env.LANDING_PAGES_PUBLIC_URL || env.NEXT_PUBLIC_SITE_URL || env.APP_PUBLIC_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  try {
    if (new URL(publicUrl).protocol !== 'https:') throw new Error('HTTPS required');
  } catch { failures.push({ check: 'config:public_url', code: 'HTTPS_PUBLIC_URL_REQUIRED' }); }
  if (!project || !key) return { ready: false, project, failures };
  const database = client || createClient(env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(15_000) }) },
  });
  for (const [table, columns] of Object.entries(TABLES)) {
    const result = await database.from(table).select(columns).limit(0);
    if (result.error) failures.push({ check: `table:${table}`, code: result.error.code || 'UNAVAILABLE' });
  }
  const result = await database.rpc('lp_readiness', {});
  if (result.error) failures.push({ check: 'permissions:lp_readiness', code: result.error.code || 'UNAVAILABLE' });
  else if (!result.data?.ready || result.data?.tables?.length !== 6) failures.push({ check: 'permissions:rls_and_roles', code: 'NOT_READY', details: result.data });
  return { ready: failures.length === 0, project, failures };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.VERCEL && !process.env.CI) dotenv.config({ path: '.env.local', quiet: true });
  try {
    const expectedProject = process.argv.find((argument) => argument.startsWith('--project-ref='))?.split('=')[1] || process.env.LANDING_PAGES_SUPABASE_PROJECT_REF;
    const result = await checkLandingPagesReadiness({ expectedProject });
    console[result.ready ? 'log' : 'error'](JSON.stringify({ event: 'landing_pages_release_readiness', ...result }));
    if (!result.ready) process.exitCode = 1;
    else if (process.argv.includes('--build')) {
      const build = spawnSync(process.execPath, ['scripts/run-next-clean.mjs', 'build'], { stdio: 'inherit', env: process.env });
      if (build.error) throw build.error;
      process.exitCode = build.status ?? 1;
    }
  } catch (error) {
    console.error(JSON.stringify({ event: 'landing_pages_release_readiness', ready: false, error: error.message }));
    process.exitCode = 1;
  }
}