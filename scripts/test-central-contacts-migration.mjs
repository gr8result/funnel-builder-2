// Applies supabase/review/central_contacts_migration_draft.sql to an isolated, production-shaped PGlite database
// (scripts/lib/marketing-pglite.mjs) and exercises the scheduler RPCs, consent rules, SMS opt-out and RLS.
import assert from 'node:assert/strict';
import { createMarketingDb } from './lib/marketing-pglite.mjs';
import { createScheduledBroadcastRepository } from '../lib/email/scheduledBroadcastRepository.mjs';
import { processDueBroadcastDeliveries } from '../lib/email/persistentBroadcastScheduler.mjs';
import { hasEmailMarketingConsent, hasSmsMarketingConsent } from '../lib/marketingConsent.js';

const { pg, db } = await createMarketingDb({ seed: false });
console.log('PASS draft applies to a clean database (including sms_inbound_numbers and the consent projection)');

const A = 'aaaaaaaa-0000-4000-8000-000000000001', B = 'bbbbbbbb-0000-4000-8000-000000000002';
const uA = 'a0000000-0000-4000-8000-000000000001', uB = 'b0000000-0000-4000-8000-000000000001';
const one = async (sql, p) => (await pg.query(sql, p)).rows[0];
await pg.exec(`insert into auth.users values ('${uA}'),('${uB}');
  insert into workspaces (id, name) values ('${A}','Builder A'),('${B}','Builder B');
  insert into workspace_members (workspace_id, user_id, role, status) values ('${A}','${uA}','owner','active'),('${B}','${uB}','owner','active');`);

const contact = async (ws, email, phone) => (await one(`insert into contacts (workspace_id, email, phone) values ($1,$2,$3) returning id`, [ws, email, phone])).id;
const consent = (ws, c, channel, type, at, basis = 'express consent', id = null) => pg.query(
  `insert into contact_consent_events (workspace_id, contact_id, channel, event_type, lawful_basis, source, provider_event_id, occurred_at) values ($1,$2,$3,$4,$5,'test',$6,$7)`,
  [ws, c, channel, type, basis, id, at]);
const LIST = '11111111-1111-4111-8111-111111111111';
const member = (ws, c) => pg.query(`insert into contact_list_memberships (workspace_id, contact_id, source_list_table, source_list_id, purpose, status, lawful_basis)
  values ($1,$2,'lead_lists',$3,'marketing','active','express consent')`, [ws, c, LIST]);

// ---- Eligibility and tenant isolation
const cOk = await contact(A, 'ok@example.com', '0412 345 678');
const cNoConsent = await contact(A, 'none@example.com', null);
const cWithdrawn = await contact(A, 'gone@example.com', null);
const cOther = await contact(B, 'other@example.com', null);
for (const c of [cOk, cNoConsent, cWithdrawn]) await member(A, c);
await member(B, cOther);
await consent(A, cOk, 'email', 'granted', '2026-10-01T00:00:00Z');
await consent(A, cWithdrawn, 'email', 'granted', '2026-10-01T00:00:00Z');
await consent(A, cWithdrawn, 'email', 'unsubscribed', '2026-10-02T00:00:00Z');
await consent(B, cOther, 'email', 'granted', '2026-10-01T00:00:00Z');
const eligible = (await pg.query(`select contact_id from eligible_email_marketing_contacts($1,'lead_lists',$2)`, [A, LIST])).rows.map((r) => r.contact_id);
assert.deepEqual(eligible, [cOk], 'only the contact whose latest email event is a grant is eligible; other tenant excluded');
await assert.rejects(pg.query(`insert into contact_list_memberships (workspace_id, contact_id, source_list_table, source_list_id, purpose) values ($1,$2,'lead_lists','x','marketing')`, [A, cOther]), /foreign key/);
console.log('PASS eligibility follows the latest consent event, and memberships cannot cross tenants');

const env = { EMAIL_BROADCAST_SCHEDULER_ENABLED: 'true', EMAIL_BROADCAST_PROVIDER_MODE: 'mock', NODE_ENV: 'test' };

// Sanity-check the adapter's update path before relying on it.
await db.from('leads').insert({ id: '99999999-0000-4000-8000-000000000009', workspace_id: A, email: 'x@example.com' });
await db.from('leads').update({ email: 'y@example.com' }).eq('id', '99999999-0000-4000-8000-000000000009').eq('workspace_id', A);
assert.equal((await one(`select email from leads where id='99999999-0000-4000-8000-000000000009'`)).email, 'y@example.com');
await pg.query(`delete from leads where id='99999999-0000-4000-8000-000000000009'`);

// ---- Broadcast delivery end to end with the real repository and scheduler
async function scheduleBroadcast(ws, user, contacts, at = '2026-01-01T00:00:00Z') {
  const b = (await one(`insert into email_broadcasts (user_id, workspace_id, subject, html_content, audience_type, list_id, audience_list_table, scheduled_at, status)
    values ($1,$2,'Hello','<p>Hi</p>','list',$3,'lead_lists',$4,'scheduled') returning id`, [user, ws, LIST, at])).id;
  for (const c of contacts) await pg.query(`insert into email_broadcast_deliveries (workspace_id, broadcast_id, contact_id, scheduled_at) values ($1,$2,$3,$4)`, [ws, b, c, at]);
  return b;
}
// cWithdrawn was eligible at schedule time in this scenario but has since unsubscribed: it must be suppressed at send.
const b1 = await scheduleBroadcast(A, uA, [cOk, cWithdrawn]);
const sent = [];
const r1 = await processDueBroadcastDeliveries({
  repository: createScheduledBroadcastRepository(db),
  send: async ({ contact: c, delivery }) => { sent.push(c.email); return { providerMessageId: `mock-${delivery.id}` }; },
  env,
});
assert.equal(r1.enabled, true);
assert.deepEqual(sent, ['ok@example.com'], 'only the currently consented contact is sent');
assert.equal(r1.sent, 1); assert.equal(r1.suppressed, 1);
const statuses = (await pg.query(`select c.email, d.status, d.provider_message_id from email_broadcast_deliveries d join contacts c on c.id = d.contact_id where d.broadcast_id=$1 order by c.email`, [b1])).rows;
assert.deepEqual(statuses.map((r) => [r.email, r.status]), [['gone@example.com', 'suppressed'], ['ok@example.com', 'sent']]);
assert.match(statuses[1].provider_message_id, /^mock-/);
const send = await one(`select status, sendgrid_message_id, contact_id from email_sends where broadcast_id=$1`, [b1]);
assert.equal(send.status, 'sent'); assert.equal(send.contact_id, cOk);
assert.equal((await one(`select status from email_broadcasts where id=$1`, [b1])).status, 'sent', 'broadcast finalizes once no delivery is pending');
const r1again = await processDueBroadcastDeliveries({ repository: createScheduledBroadcastRepository(db), send: async () => { throw new Error('must not resend'); }, env });
assert.equal(r1again.considered, 0, 'a second tick finds nothing to resend');
console.log('PASS real scheduler + repository: consent rechecked at send, ledger recorded, broadcast finalized, no resend');

// ---- Claims are exclusive and need the right token
const b2 = await scheduleBroadcast(A, uA, [cOk]);
const d2 = (await one(`select id from email_broadcast_deliveries where broadcast_id=$1`, [b2])).id;
const t1 = 'c1111111-0000-4000-8000-000000000001', t2 = 'c2222222-0000-4000-8000-000000000002';
assert.equal((await pg.query(`select * from claim_email_broadcast_delivery($1,$2)`, [d2, t1])).rows.length, 1);
assert.equal((await pg.query(`select * from claim_email_broadcast_delivery($1,$2)`, [d2, t2])).rows.length, 0, 'second worker cannot claim');
assert.equal((await one(`select cancel_email_broadcast($1,$2,$3) as n`, [A, b2, uA])).n, -2, 'cannot cancel while a delivery is in flight');
assert.equal((await one(`select complete_email_broadcast_delivery($1,$2,$3,null,null,'sent',null,null,now()) as ok`, [d2, A, t2])).ok, false, 'wrong token cannot complete');
await pg.query(`update email_broadcast_deliveries set claim_expires_at = now() - interval '1 minute' where id=$1`, [d2]);
assert.equal((await one(`select expire_stale_email_broadcast_claims() as n`)).n, 1);
assert.equal((await one(`select status from email_broadcast_deliveries where id=$1`, [d2])).status, 'unknown', 'expired lease becomes unknown, never auto-resent');
assert.equal((await one(`select status from email_broadcasts where id=$1`, [b2])).status, 'failed', 'broadcast with an unknown outcome is not marked sent');
console.log('PASS claims are exclusive, token-bound, and expired leases go to reconciliation instead of resending');

// ---- Cancel
const b3 = await scheduleBroadcast(A, uA, [cOk, cNoConsent], '2099-01-01T00:00:00Z');
assert.equal((await one(`select cancel_email_broadcast($1,$2,$3) as n`, [A, b3, uB])).n, -1, 'another user cannot cancel');
assert.equal((await one(`select cancel_email_broadcast($1,$2,$3) as n`, [B, b3, uA])).n, -1, 'wrong workspace cannot cancel');
assert.equal((await one(`select cancel_email_broadcast($1,$2,$3) as n`, [A, b3, uA])).n, 2);
assert.equal((await one(`select status from email_broadcasts where id=$1`, [b3])).status, 'cancelled');
assert.equal((await pg.query(`select * from claim_email_broadcast_delivery((select id from email_broadcast_deliveries where broadcast_id=$1 limit 1), $2)`, [b3, t1])).rows.length, 0);
await assert.rejects(pg.query(`insert into email_broadcast_deliveries (workspace_id, broadcast_id, contact_id, scheduled_at) values ($1,$2,$3,now())`, [A, b3, cOther]), /foreign key/, 'cross-tenant recipient rejected');
console.log('PASS cancellation is owner/workspace bound and atomic; recipients cannot cross tenants');

// ---- Consent projection onto lead rows read by the existing senders
const lead = async (ws, fields) => (await one(`insert into leads (workspace_id, email, phone) values ($1,$2,$3) returning id`, [ws, fields.email || null, fields.phone || null])).id;
const leadRow = (id) => one(`select * from leads where id=$1`, [id]);
const cLead = await contact(A, 'lead@example.com', '0400 111 222');
const linkedLead = await lead(A, { email: 'lead@example.com', phone: '0400111222' });
await pg.query(`insert into contact_sources (workspace_id, contact_id, source_table, source_record_key) values ($1,$2,'leads',$3)`, [A, cLead, linkedLead]);
assert.equal(hasEmailMarketingConsent(await leadRow(linkedLead)), false, 'default is no permission');
await consent(A, cLead, 'email', 'granted', '2026-10-01T00:00:00Z', null);
assert.equal(hasEmailMarketingConsent(await leadRow(linkedLead)), false, 'a grant without a lawful basis is not projected');
await consent(A, cLead, 'email', 'granted', '2026-10-02T00:00:00Z');
await consent(A, cLead, 'sms', 'granted', '2026-10-02T00:00:00Z');
let row = await leadRow(linkedLead);
assert.equal(hasEmailMarketingConsent(row), true); assert.equal(hasSmsMarketingConsent(row), true);
await consent(A, cLead, 'email', 'unsubscribed', '2026-10-05T00:00:00Z');
await consent(A, cLead, 'email', 'granted', '2026-10-03T00:00:00Z');
row = await leadRow(linkedLead);
assert.equal(hasEmailMarketingConsent(row), false, 'an older grant recorded late does not override a newer unsubscribe');
assert.equal(hasSmsMarketingConsent(row), true, 'email withdrawal leaves SMS consent alone');
console.log('PASS consent events project onto linked lead rows: deny by default, latest wins, channels independent');

// ---- SMS STOP: one atomic call, tenant-scoped, idempotent
const unlinkedLead = await lead(A, { phone: '+61 400 111 222' });
const otherTenantLead = await lead(B, { phone: '0400111222' });
await pg.query(`update leads set workspace_id=$1 where id=$2`, [B, otherTenantLead]);
const stop = await one(`select * from record_sms_opt_out($1,$2,$3,$4)`, [A, '61400111222', 'msg-123', '2026-10-06T00:00:00Z']);
assert.equal(stop.contacts_opted_out, 1); assert.equal(stop.leads_opted_out, 2, 'linked and unlinked leads in the workspace');
for (const id of [linkedLead, unlinkedLead]) assert.equal(hasSmsMarketingConsent(await leadRow(id)), false);
assert.equal((await leadRow(otherTenantLead)).sms_opt_out, false, 'another builder\'s lead with the same number is untouched');
assert.equal((await leadRow(linkedLead)).sms_opt_out, true);
const again = await one(`select * from record_sms_opt_out($1,$2,$3,$4)`, [A, '0400 111 222', 'msg-123', '2026-10-06T00:00:00Z']);
assert.equal(again.contacts_opted_out, 0, 'provider retry does not duplicate consent events');
await consent(A, cLead, 'sms', 'granted', '2026-10-07T00:00:00Z');
assert.equal(hasSmsMarketingConsent(await leadRow(linkedLead)), false, 'a later grant does not silently clear a STOP');
await assert.rejects(pg.query(`select * from record_sms_opt_out($1,'',$2,now())`, [A, 'x']), /requires/);
console.log('PASS record_sms_opt_out flags contacts and leads in one workspace only, is retry-safe, and a STOP is not silently undone');

// ---- SMS campaign drafts, tenant policies and cancellation
const smsCampaign = await one(`insert into sms_marketing_campaigns
  (workspace_id,user_id,name,audience_type,lead_id,steps,status)
  values ($1,$2,'Spring follow-up','lead',$3,'[{"delay":0,"unit":"minutes","message":"Hello"}]','queued') returning id`, [A, uA, linkedLead]);
await pg.query(`insert into sms_queue (workspace_id,user_id,lead_id,campaign_id,to_phone,body,status)
  values ($1,$2,$3,$4,'61400111222','Hello','queued')`, [A, uA, linkedLead, smsCampaign.id]);
const cancelledSmsRows = await one(`select cancel_sms_marketing_campaign($1,$2,$3) as n`, [A, smsCampaign.id, uA]);
assert.equal(cancelledSmsRows.n, 1);
assert.equal((await one(`select status from sms_marketing_campaigns where id=$1`, [smsCampaign.id])).status, 'cancelled');
assert.equal((await one(`select count(*)::int n from sms_queue where campaign_id=$1`, [smsCampaign.id])).n, 0);

const inFlightCampaign = await one(`insert into sms_marketing_campaigns
  (workspace_id,user_id,name,audience_type,lead_id,steps,status)
  values ($1,$2,'In flight','lead',$3,'[{"delay":0,"unit":"minutes","message":"Hello"}]','queued') returning id`, [A, uA, linkedLead]);
await pg.query(`insert into sms_queue (workspace_id,user_id,lead_id,campaign_id,to_phone,body,status)
  values ($1,$2,$3,$4,'61400111222','Hello','processing')`, [A, uA, linkedLead, inFlightCampaign.id]);
assert.equal((await one(`select cancel_sms_marketing_campaign($1,$2,$3) as n`, [A, inFlightCampaign.id, uA])).n, -2);
assert.equal((await one(`select status from sms_marketing_campaigns where id=$1`, [inFlightCampaign.id])).status, 'queued');

const visibleSmsCampaigns = await as(uB, `select id from sms_marketing_campaigns`);
assert.equal(visibleSmsCampaigns.rows.length, 0, 'another workspace cannot view SMS campaign drafts');
await assert.rejects(as(uB, `insert into sms_marketing_campaigns (workspace_id,user_id,name,audience_type,lead_id,steps)
  values ($1,$2,'Spoofed','lead',$3,'[{"message":"Hello"}]')`, [A, uB, linkedLead]), /row-level security/);
await assert.rejects(as(uA, `select cancel_sms_marketing_campaign($1,$2,$3)`, [A, smsCampaign.id, uA]), /permission denied/);
console.log('PASS SMS campaign drafts are tenant-isolated and cancellation refuses in-flight delivery');

const claimRaceCampaign = await one(`insert into sms_marketing_campaigns
  (workspace_id,user_id,name,audience_type,lead_id,steps,status)
  values ($1,$2,'Claim race','lead',$3,'[{"delay":0,"unit":"minutes","message":"Hello"}]','queued') returning id`, [A, uA, linkedLead]);
const claimRaceRow = await one(`insert into sms_queue (workspace_id,user_id,lead_id,campaign_id,to_phone,body,status)
  values ($1,$2,$3,$4,'61400111222','Hello','queued') returning id`, [A, uA, linkedLead, claimRaceCampaign.id]);
const claimQueueRow = () => one(`update sms_queue set status='processing' where id=$1 and workspace_id=$2 and status in ('queued','pending') returning id`, [claimRaceRow.id, A]);
const competingClaims = await Promise.all([claimQueueRow(), claimQueueRow()]);
assert.equal(competingClaims.filter(Boolean).length, 1, 'only one concurrent worker can claim a queued SMS');
assert.equal((await one(`select cancel_sms_marketing_campaign($1,$2,$3) as n`, [A, claimRaceCampaign.id, uA])).n, -2, 'cancellation refuses the atomically claimed row');
console.log('PASS SMS queue claims are exclusive and block racing campaign cancellation');

// ---- RLS and function grants
async function as(user, sql, params = []) {
  await pg.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user]);
  await pg.exec('set role authenticated');
  try { return await pg.query(sql, params); } finally { await pg.exec('reset role'); }
}
const seen = (await as(uB, `select workspace_id from contacts`)).rows;
assert.ok(seen.length > 0 && seen.every((r) => r.workspace_id === B), 'builder B sees only its own contacts');
await assert.rejects(as(uB, `insert into contact_consent_events (workspace_id, contact_id, channel, event_type, occurred_at) values ($1,$2,'email','granted',now())`, [A, cOk]), /row-level security/);
await assert.rejects(as(uA, `select * from record_sms_opt_out($1,'0400111222','x',now())`, [A]), /permission denied/);
await assert.rejects(as(uA, `select * from claim_email_broadcast_delivery($1,$2)`, [d2, t1]), /permission denied/);
console.log('PASS RLS keeps tenants apart; scheduler and opt-out functions are service-role only');

await pg.close();
console.log('Central contacts migration draft checks passed');
