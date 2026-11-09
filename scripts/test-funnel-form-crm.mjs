import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { startMockSupabase } from './lib/mock-supabase-server.mjs';
import { setFunnelFormDb, retryPendingFunnelSubmissions } from '../lib/funnels/formSubmissions.js';
import submit from '../pages/api/forms/submit.js';
import cron from '../pages/api/funnels/cron-sync.js';
import { mockReq, mockRes } from './lib/landing-pages-pglite-supabase.mjs';

const A = 'a0000000-0000-4000-8000-000000000081', B = 'b0000000-0000-4000-8000-000000000082';
const WA = 'aaaaaaaa-0000-4000-8000-000000000081', WB = 'bbbbbbbb-0000-4000-8000-000000000082';
const FA = randomUUID(), FB = randomUUID(), SA = randomUUID(), SB = randomUUID();
const seedSql = `
  create table funnels(id uuid primary key,owner_user_id uuid not null,workspace_id uuid,name text,slug text,status text,
    default_list_id uuid,notify_email text,created_at timestamptz default now(),updated_at timestamptz default now());
  create table funnel_steps(id uuid primary key,funnel_id uuid references funnels(id),title text,content text,order_index integer);
  create table form_submissions(id uuid primary key default gen_random_uuid(),user_id uuid,funnel_id uuid,step_id uuid,
    list_id uuid,name text,email text,payload jsonb);
  create table email_lists(id uuid primary key,user_id uuid,name text);
  ${fs.readFileSync('supabase/migrations/20261101000100_funnel_master_templates.sql','utf8')}
  ${fs.readFileSync('supabase/migrations/20261101000200_crm_lead_notes_access.sql','utf8')}
  ${fs.readFileSync('supabase/migrations/20261101000400_funnel_form_crm.sql','utf8')}
  insert into workspaces(id,name) values ('${WA}','A'),('${WB}','B');
  insert into workspace_members(workspace_id,user_id,role,status) values ('${WA}','${A}','owner','active'),('${WB}','${B}','owner','active');
  insert into funnels(id,owner_user_id,workspace_id,name,slug,status) values ('${FA}','${A}','${WA}','Funnel A','funnel-a','published'),('${FB}','${B}','${WB}','Funnel B','funnel-b','published');
  insert into funnel_steps values ('${SA}','${FA}','A','',0),('${SB}','${FB}','B','',0);
`;
const mock = await startMockSupabase({ port: 54421, seedSql });
setFunnelFormDb(createClient(mock.url, 'service-test', { auth: { persistSession: false } }));
const call = async (handler, options) => {
  const res = mockRes();
  res.send = (body) => { res.body = body; return res; };
  await handler(mockReq(options), res);
  return res;
};
const body = (overrides = {}) => ({ funnel_id: FA, step_id: SA, submission_key: randomUUID(), name: 'Example visitor',
  email: 'visitor@example.test', phone: '0412345678', user_id: B, workspace_id: WB, list_id: randomUUID(), notify_to: 'attacker@example.test', ...overrides });
const send = (data) => call(submit, { method: 'POST', body: data, headers: { accept: 'application/json' } });
const step = async (name, run) => { await run(); console.log(`PASS ${name}`); };
try {
  await mock.pg.exec(fs.readFileSync('supabase/migrations/20261101000400_funnel_form_crm.sql','utf8'));
  let first;
  await step('published funnel with no email list records its own CRM lead, ignoring client ownership and routing', async () => {
    first = body();
    const result = await send(first);
    assert.equal(result.statusCode, 200, JSON.stringify(result.body));
    assert.equal(result.body.crmSynced, true);
    const sub = (await mock.pg.query('select * from form_submissions')).rows[0];
    assert.equal(sub.user_id, A); assert.equal(sub.workspace_id, WA); assert.equal(sub.list_id, null);
    const lead = (await mock.pg.query('select * from leads where id=$1', [sub.crm_lead_id])).rows[0];
    assert.equal(lead.user_id, A); assert.equal(lead.workspace_id, WA); assert.equal(lead.lead_source, 'Funnel: Funnel A');
    assert.equal((await mock.pg.query('select user_id from lead_notes where id=$1',[sub.crm_note_id])).rows[0].user_id, A);
  });
  await step('duplicate requests create one submission/note; the same email in another builder stays isolated', async () => {
    const duplicate = await send(first);
    assert.equal(duplicate.body.duplicate, true);
    assert.equal((await mock.pg.query('select id from form_submissions')).rows.length, 1);
    assert.equal((await mock.pg.query('select id from lead_notes')).rows.length, 1);
    assert.equal((await send(body({ funnel_id: FB, step_id: SB }))).body.crmSynced, true);
    const leads = (await mock.pg.query('select user_id,workspace_id from leads order by user_id')).rows;
    assert.deepEqual(leads, [{user_id:A,workspace_id:WA},{user_id:B,workspace_id:WB}]);
  });
  await step('CRM outage retains the enquiry, rolls back partial CRM writes and retries without duplication', async () => {
    await mock.pg.exec(`create function test_funnel_crm_outage() returns trigger language plpgsql as $$ begin raise exception 'simulated CRM outage'; end $$;
      create trigger test_funnel_crm_outage before insert on lead_notes for each row execute function test_funnel_crm_outage();`);
    const queued = body({ email: 'queued@example.test' });
    const received = await send(queued);
    assert.equal(received.statusCode, 200);
    assert.equal(received.body.queued, true);
    const sub = (await mock.pg.query('select * from form_submissions where submission_key=$1',[queued.submission_key])).rows[0];
    assert.equal(sub.crm_synced_at, null); assert.match(sub.crm_error, /simulated CRM outage/);
    assert.equal((await mock.pg.query("select id from leads where email='queued@example.test'")).rows.length, 0);
    await mock.pg.exec('drop trigger test_funnel_crm_outage on lead_notes; drop function test_funnel_crm_outage();');
    const retried = await retryPendingFunnelSubmissions();
    assert.equal(retried.filter((result) => result.ok).length, 1);
    assert.equal((await send(queued)).body.duplicate, true);
    assert.equal((await mock.pg.query("select id from leads where email='queued@example.test'")).rows.length, 1);
  });
  await step('draft/master funnels, mismatched steps, bad keys and invalid emails cannot capture leads', async () => {
    assert.equal((await send(body({step_id:SB}))).statusCode, 404);
    assert.equal((await send(body({submission_key:'bad'}))).statusCode, 400);
    assert.equal((await send(body({email:'bad'}))).statusCode, 422);
    await mock.pg.query("update funnels set status='draft' where id=$1",[FA]);
    assert.equal((await send(body())).statusCode, 404);
    await mock.pg.query("update funnels set status='published',is_master_template=true where id=$1",[FA]);
    assert.equal((await send(body())).statusCode, 404);
    await mock.pg.query("update funnels set is_master_template=false where id=$1",[FA]);
  });
  await step('failed archive writes explicitly fail instead of reporting successful lead capture', async () => {
    await mock.pg.exec(`create function test_funnel_archive_outage() returns trigger language plpgsql as $$ begin raise exception 'simulated archive outage'; end $$;
      create trigger test_funnel_archive_outage before insert on form_submissions for each row execute function test_funnel_archive_outage();`);
    assert.equal((await send(body())).statusCode, 500);
    await mock.pg.exec('drop trigger test_funnel_archive_outage on form_submissions; drop function test_funnel_archive_outage();');
  });
  await step('native form redirects stay on the subscriber funnel, never a supplied external URL', async () => {
    const result = await call(submit,{method:'POST',body:body({success_url:'https://attacker.example.test'})});
    assert.equal(result.statusCode,302); assert.equal(result.headers.location,'/p/funnel-a?ok=1');
    const copiedStep = await call(submit,{method:'POST',body:body({success_url:'/p/master-original?step=2'})});
    assert.equal(copiedStep.headers.location,'/p/funnel-a?step=2', 'copied multi-step forms continue within their own funnel');
  });
  await step('anonymous/direct writes are denied; authenticated submission reads are builder scoped', async () => {
    await mock.pg.exec('set role anon');
    await assert.rejects(mock.pg.query('select payload from form_submissions'), /permission denied/);
    await assert.rejects(mock.pg.query('select funnel_sync_submission($1)',[randomUUID()]), /permission denied/);
    await mock.pg.exec('reset role; set role authenticated');
    await mock.pg.query("select set_config('request.jwt.claim.sub',$1,false)",[B]);
    const rows = (await mock.pg.query('select user_id from form_submissions')).rows;
    assert(rows.length); assert(rows.every((row)=>row.user_id===B));
    await assert.rejects(mock.pg.query('insert into form_submissions(user_id,email) values ($1,$2)',[B,'direct@example.test']), /permission denied/);
    await mock.pg.exec('reset role');
  });
  await step('CRM retry endpoint requires its scheduler secret', async () => {
    process.env.CRON_SECRET = 'isolated-funnel-cron-secret';
    assert.equal((await call(cron,{})).statusCode,401);
    assert.equal((await call(cron,{headers:{authorization:'Bearer isolated-funnel-cron-secret'}})).statusCode,200);
  });
  console.log('8/8 classic funnel CRM acceptance scenarios passed.');
} finally {
  setFunnelFormDb(null);
  await mock.close();
}
