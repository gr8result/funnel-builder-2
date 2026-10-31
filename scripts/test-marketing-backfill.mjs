// Representative isolated database test (PGlite, no network): production-shaped legacy data ->
// consolidated migration -> deterministic backfill -> validation -> quarantine -> tenant isolation ->
// consent history and repeated STOP/START -> rollback to the exact pre-backfill state -> operator decision.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createMarketingDb, applyBackfillDefinitions, asUser, WS, USER, LIST, LEAD } from './lib/marketing-pglite.mjs';

const { pg } = await createMarketingDb();
await applyBackfillDefinitions(pg);
const one = async (sql, p) => (await pg.query(sql, p)).rows[0];
const all = async (sql, p) => (await pg.query(sql, p)).rows;
let passed = 0;
const step = async (name, fn) => { await fn(); passed += 1; console.log(`PASS ${name}`); };

// Snapshot of every legacy table, legacy columns only (the migration adds columns; rollback must restore values).
const LEGACY = {
  leads: 'id,user_id,name,email,phone,list_id,unsubscribed_at,workspace_id',
  lead_lists: 'id,user_id,name', email_lists: 'id,user_id,name', subscribers: 'id,user_id,email',
  form_submissions: 'id,user_id,email', email_broadcasts: 'id,user_id,subject,workspace_id',
  email_sends: 'id,user_id,status,unsubscribed,spam_reported,bounced_at,workspace_id',
  sms_sent_history: 'id,user_id,provider_message_id,workspace_id', email_campaigns_queue: 'id,user_id,status',
  crm_tasks: 'id,contact_id,workspace_id', email_suppressions: 'id,email_lower,reason',
};
let run;
await step('backfill runs and every validation check passes', async () => {
  run = (await one(`select marketing_backfill_run('test-operator', 'representative fixture') as id`)).id;
  const checks = await all(`select * from marketing_backfill_validate($1)`, [run]);
  for (const c of checks) assert.equal(c.passed, true, `${c.check_name} (${c.detail})`);
  assert.ok(checks.length >= 8);
});

await step('ownership assigned only for single-workspace users; everything else quarantined with a reason', async () => {
  assert.equal((await one(`select workspace_id from email_broadcasts where user_id=$1`, [USER.A])).workspace_id, WS.A);
  assert.equal((await one(`select workspace_id from email_broadcasts where user_id=$1`, [USER.B])).workspace_id, WS.B);
  assert.equal((await one(`select workspace_id from email_broadcasts where user_id=$1`, [USER.MULTI])).workspace_id, null);
  assert.equal((await one(`select workspace_id from lead_lists where id=$1`, [LIST.MULTI])).workspace_id, null);
  const q = await all(`select table_name, reason from marketing_backfill_quarantine where run_id=$1 order by 1,2`, [run]);
  const reasons = q.map((r) => `${r.table_name}:${r.reason}`);
  for (const expected of [
    'email_broadcasts:user_in_multiple_workspaces', 'email_sends:user_in_multiple_workspaces', 'lead_lists:user_in_multiple_workspaces',
    'subscribers:user_without_workspace', 'subscribers:user_in_multiple_workspaces', 'form_submissions:no_user',
    'sms_sent_history:user_in_multiple_workspaces', 'email_campaigns_queue:user_in_multiple_workspaces',
    'leads:list_in_other_or_unknown_workspace', 'leads:list_not_found',
  ]) assert.ok(reasons.includes(expected), `missing quarantine ${expected}`);
});

await step('one contact per lead, no merging, never across tenants', async () => {
  const contacts = await all(`select c.workspace_id, l.id as lead_id from leads l join contacts c on c.id = l.contact_id order by l.id`);
  assert.equal(contacts.length, 5);
  for (const c of contacts) assert.equal(c.workspace_id, (await one(`select workspace_id from leads where id=$1`, [c.lead_id])).workspace_id);
  const a2 = (await one(`select contact_id from leads where id=$1`, [LEAD.A2])).contact_id;
  const a3 = (await one(`select contact_id from leads where id=$1`, [LEAD.A3])).contact_id;
  assert.notEqual(a2, a3, 'same email in one workspace stays two contacts (no automatic merge)');
  assert.equal((await one(`select email from contacts where id=$1`, [a2])).email, 'shared@example.test', 'email normalized');
});

await step('memberships are pending with no lawful basis: nobody becomes marketable', async () => {
  assert.equal((await one(`select count(*)::int n from contact_list_memberships where status <> 'pending'`)).n, 0);
  assert.equal((await one(`select count(*)::int n from contact_list_memberships`)).n, 3, 'A1 and A2 on list A, B1 on list B; mismatched and missing lists excluded');
  assert.equal((await all(`select * from eligible_email_marketing_contacts($1,'lead_lists',$2)`, [WS.A, LIST.A])).length, 0);
});

await step('opt-out evidence carried over; other builders untouched', async () => {
  const a1 = await one(`select email_marketing_opt_out from leads where id=$1`, [LEAD.A1]);
  assert.equal(a1.email_marketing_opt_out, true, 'leads.unsubscribed_at became an unsubscribe event');
  for (const id of [LEAD.A2, LEAD.A3]) assert.equal((await one(`select email_marketing_opt_out from leads where id=$1`, [id])).email_marketing_opt_out, true, 'legacy unsubscribe for shared@ applies to every matching contact in workspace A');
  assert.equal((await one(`select email_marketing_opt_out from leads where id=$1`, [LEAD.B1])).email_marketing_opt_out, false, 'same address at builder B is untouched');
  const sup = await all(`select email_lower, reason from email_suppressions where workspace_id=$1 order by 1`, [WS.A]);
  assert.deepEqual(sup.map((r) => `${r.email_lower}:${r.reason}`), ['gone@example.test:legacy_bounce', 'shared@example.test:unsubscribed', 'spam@example.test:spam_complaint']);
  assert.equal((await one(`select count(*)::int n from email_suppressions where workspace_id is null`)).n, 0);
});

await step('CRM tasks whose contact_id holds a lead id still update (no contacts FK on crm_tasks)', async () => {
  await pg.query(`update crm_tasks set completed = true where contact_id = $1`, [LEAD.A1]);
  assert.equal((await one(`select completed from crm_tasks where contact_id=$1`, [LEAD.A1])).completed, true);
});

await step('broadcast RLS: own workspace only; quarantined rows invisible even to their owner', async () => {
  const seenByA = await asUser(pg, USER.A, `select id, workspace_id from email_broadcasts`);
  assert.deepEqual(seenByA.rows.map((r) => r.workspace_id), [WS.A]);
  const seenByMulti = await asUser(pg, USER.MULTI, `select id from email_broadcasts`);
  assert.equal(seenByMulti.rows.length, 0, 'quarantined legacy broadcast is not exposed');
  const editOther = await asUser(pg, USER.A, `update email_broadcasts set subject='hijack' where user_id=$1 returning id`, [USER.B]);
  assert.equal(editOther.rowCount, 0, 'cannot edit another builder\'s broadcast');
  await assert.rejects(asUser(pg, USER.A, `insert into email_broadcasts (user_id, workspace_id, subject) values ($1,$2,'x')`, [USER.A, WS.B]), /row-level security/, 'cannot create into a workspace you are not in');
  await assert.rejects(asUser(pg, USER.A, `insert into email_broadcasts (user_id, subject) values ($1,'x')`, [USER.A]), /row-level security/, 'cannot create unscoped broadcasts');
  await assert.rejects(asUser(pg, USER.A, `insert into contact_consent_events (workspace_id, contact_id, channel, event_type, lawful_basis, source, occurred_at)
    select $1, contact_id, 'sms', 'granted', 'says yes', 'provider:smsglobal-start-optin', now() from leads where id=$2`, [WS.A, LEAD.A2]), /row-level security/, 'builders cannot forge provider-verified opt-ins');
});

await step('consent history and repeated STOP/START, tenant-scoped', async () => {
  const A_NUMBER = '61400000111';
  await pg.query(`insert into sms_inbound_numbers (workspace_id, phone_e164) values ($1,$2)`, [WS.A, A_NUMBER]);
  const a2Contact = (await one(`select contact_id from leads where id=$1`, [LEAD.A2])).contact_id;
  // Builder records SMS consent with a lawful basis -> permitted.
  await pg.query(`insert into contact_consent_events (workspace_id, contact_id, channel, event_type, lawful_basis, source, occurred_at) values ($1,$2,'sms','granted','express consent at site visit','crm',$3)`, [WS.A, a2Contact, '2026-10-01T00:00:00Z']);
  assert.equal((await one(`select marketing_permission_granted($1,$2,'sms') ok`, [WS.A, a2Contact])).ok, true);

  const ingest = (msgid, body, at, to = A_NUMBER) => one(`select * from ingest_sms_inbound('smsglobal',$1,$2,'+61 412 000 002',$3,$4,$5)`, [msgid, `hash-${msgid}`, to, body, at]);
  const s1 = await ingest('m1', 'Stop', '2026-10-02T00:00:00Z');
  assert.equal(s1.status, 'processed'); assert.equal(s1.keyword, 'STOP'); assert.equal(s1.duplicate, false);
  const s1again = await ingest('m1', 'Stop', '2026-10-02T00:00:00Z');
  assert.equal(s1again.duplicate, true, 'provider retry is recognised');
  const s2 = await ingest('m2', 'STOP.', '2026-10-02T00:05:00Z');
  assert.equal(s2.status, 'processed', 'a second, distinct STOP is also recorded');
  assert.equal((await one(`select count(*)::int n from contact_consent_events where contact_id=$1 and channel='sms' and event_type='unsubscribed'`, [a2Contact])).n, 2);
  assert.equal((await one(`select is_sms_marketing_blocked($1,'0412000002') b`, [WS.A])).b, true);
  assert.equal((await one(`select is_sms_marketing_blocked($1,'0412000002') b`, [WS.B])).b, false, 'builder B (same number, own lead) is not affected');
  assert.equal((await one(`select sms_opt_out from leads where id=$1`, [LEAD.B1])).sms_opt_out, false);

  await pg.query(`insert into contact_consent_events (workspace_id, contact_id, channel, event_type, lawful_basis, source, occurred_at) values ($1,$2,'sms','granted','builder re-added','crm',$3)`, [WS.A, a2Contact, '2026-10-03T00:00:00Z']);
  assert.equal((await one(`select marketing_permission_granted($1,$2,'sms') ok`, [WS.A, a2Contact])).ok, false, 'a builder-entered grant cannot lift a STOP');
  assert.equal((await one(`select is_sms_marketing_blocked($1,'0412000002') b`, [WS.A])).b, true);

  const start = await ingest('m3', 'START', '2026-10-04T00:00:00Z');
  assert.equal(start.status, 'processed'); assert.equal(start.keyword, 'START');
  assert.equal((await one(`select marketing_permission_granted($1,$2,'sms') ok`, [WS.A, a2Contact])).ok, true, 'the recipient\'s own START restores permission');
  assert.equal((await one(`select is_sms_marketing_blocked($1,'0412000002') b`, [WS.A])).b, false);
  assert.equal((await one(`select sms_opt_out from leads where id=$1`, [LEAD.A2])).sms_opt_out, false);

  const stopAgain = await ingest('m4', 'stop', '2026-10-05T00:00:00Z');
  assert.equal(stopAgain.status, 'processed');
  assert.equal((await one(`select is_sms_marketing_blocked($1,'0412000002') b`, [WS.A])).b, true, 'STOP after START blocks again');

  const unmapped = await ingest('m5', 'STOP', '2026-10-05T00:00:00Z', '61400000999');
  assert.equal(unmapped.status, 'unmapped');
  assert.equal((await one(`select is_sms_marketing_blocked($1,'0412000002') b`, [WS.B])).b, true, 'STOP on an unmapped number holds sends in every workspace');
  await pg.query(`update sms_inbound_events set status='resolved', resolution_note='operator mapped number to A' where id=$1`, [unmapped.inbound_id]);
  assert.equal((await one(`select is_sms_marketing_blocked($1,'0412000002') b`, [WS.B])).b, false);
  await pg.query(`delete from sms_inbound_numbers`);
});

await step('rollback is refused once backfilled contacts carry live history', async () => {
  await assert.rejects(pg.query(`select marketing_backfill_rollback($1)`, [run]), /live history/);
});

await step('rollback restores the exact pre-backfill legacy state (on a fresh copy without live history)', async () => {
  const fresh = await createMarketingDb();
  await applyBackfillDefinitions(fresh.pg);
  const fone = async (sql, p) => (await fresh.pg.query(sql, p)).rows[0];
  const hashOf = async () => {
    const h = createHash('sha256');
    for (const [t, cols] of Object.entries(LEGACY)) h.update(JSON.stringify((await fresh.pg.query(`select ${cols}${['lead_lists', 'email_lists', 'subscribers', 'form_submissions', 'email_campaigns_queue'].includes(t) ? ',workspace_id' : ''} from ${t} order by id`)).rows));
    return h.digest('hex');
  };
  const pre = await hashOf();
  const r1 = (await fone(`select marketing_backfill_run('op','first') as id`)).id;
  assert.notEqual(await hashOf(), pre);
  assert.equal((await fone(`select marketing_backfill_rollback($1) as r`, [r1])).r, 'rolled back');
  assert.equal(await hashOf(), pre, 'legacy tables identical to before the backfill');
  for (const t of ['contacts', 'contact_sources', 'contact_list_memberships', 'contact_consent_events'])
    assert.equal((await fone(`select count(*)::int n from ${t}`)).n, 0, `${t} emptied`);
  const leadFlags = await fone(`select count(*)::int n from leads where email_marketing_opt_out or contact_id is not null`);
  assert.equal(leadFlags.n, 0);
  assert.equal((await fone(`select marketing_backfill_rollback($1) as r`, [r1])).r, 'already rolled back');

  // Operator decision resolves the multi-workspace owner deterministically on a re-run.
  await fresh.pg.query(`insert into marketing_backfill_owner_decisions (user_id, workspace_id, decided_by, evidence) values ($1,$2,'grant','platform owner: legacy marketing belongs to Builder A')`, [USER.MULTI, WS.A]);
  const r2 = (await fone(`select marketing_backfill_run('op','after decision') as id`)).id;
  for (const c of (await fresh.pg.query(`select * from marketing_backfill_validate($1)`, [r2])).rows) assert.equal(c.passed, true, c.check_name);
  assert.equal((await fone(`select workspace_id from email_broadcasts where user_id=$1`, [USER.MULTI])).workspace_id, WS.A);
  assert.equal((await fone(`select count(*)::int n from marketing_backfill_quarantine where run_id=$1 and reason='user_in_multiple_workspaces'`, [r2])).n, 0);
  // A decision for a workspace the user is not a member of is refused (quarantined), never applied.
  await fresh.pg.query(`update marketing_backfill_owner_decisions set workspace_id=$1 where user_id=$2`, [WS.C, USER.MULTI]);
  assert.equal((await fone(`select reason from marketing_backfill_resolve_owner($1,'email_sends')`, [USER.MULTI])).reason, 'decision_not_member');
  await fresh.pg.close();
});

await pg.close();
console.log(`Marketing backfill checks passed (${passed} sections)`);
