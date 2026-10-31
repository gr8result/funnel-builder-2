// End-to-end Email/SMS scenario against the REAL API handlers, the consolidated migration and the backfill,
// on an isolated production-shaped PGlite database. Providers are mocked: SendGrid delivery uses the scheduler's
// mock mode, SendGrid events are signed with a locally generated ECDSA key, SMSGlobal callbacks are simulated.
// No network, no real database, no real messages.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createMarketingDb, applyBackfillDefinitions, WS, USER, LIST, LEAD } from './lib/marketing-pglite.mjs';

register('./lib/next-api-test-loader.mjs', import.meta.url);

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
Object.assign(process.env, {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_URL: 'http://127.0.0.1:9',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-key', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  MARKETING_CONTACTS_SCHEMA_READY: 'true',
  EMAIL_BROADCAST_SCHEDULER_ENABLED: 'true', EMAIL_BROADCAST_PROVIDER_MODE: 'mock', NODE_ENV: 'test',
  CRON_SECRET: 'cron-test-secret', SMSGLOBAL_WEBHOOK_SECRET: 'sms-test-secret',
  SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
});
delete process.env.SENDGRID_API_KEY;

const { pg, db } = await createMarketingDb();
await applyBackfillDefinitions(pg);
await pg.query(`select marketing_backfill_run('e2e', 'fixture')`);
await pg.query(`update accounts set dkim_domain = split_part(sendgrid_from_email, '@', 2), dkim_verified = true`);
globalThis.__MARKETING_TEST_DB__ = db;

const scheduleBroadcast = (await import('../pages/api/email/schedule-broadcast.js')).default;
const cancelBroadcast = (await import('../pages/api/email/cancel-scheduled-broadcast.js')).default;
const tick = (await import('../pages/api/email/broadcast-scheduler-tick.js')).default;
const sendgridEvents = (await import('../pages/api/webhooks/sendgrid-events.js')).default;
const legacySendgridEvents = (await import('../pages/api/automation/engine/sendgrid-event.js')).default;
const smsInbound = (await import('../pages/api/smsglobal/sms-inbound.js')).default;
const smsDlr = (await import('../pages/api/smsglobal/dlr.js')).default;
const smsCampaigns = (await import('../pages/api/smsglobal/campaigns.js')).default;
const logBroadcast = (await import('../pages/api/email/log-broadcast.js')).default;
const { assertSmsMarketingAllowed, withSmsOptOutFooter } = await import('../lib/smsglobal/marketingSendGuard.mjs');
const { buildSmsSequenceQueueRows } = await import('../lib/smsglobal/marketingCampaign.mjs');

const one = async (sql, p) => (await pg.query(sql, p)).rows[0];
const all = async (sql, p) => (await pg.query(sql, p)).rows;
function mockRes() {
  const res = { statusCode: 200, headers: {}, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.send = (b) => { res.body = b; return res; };
  res.end = () => res;
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; };
  return res;
}
async function call(handler, { method = 'POST', headers = {}, body, query = {}, rawBody } = {}) {
  const res = mockRes();
  await handler({ method, headers: { host: 'app.test', 'x-forwarded-proto': 'https', ...headers }, body, query, rawBody }, res);
  return res;
}
const asBuilder = (user, ws, extra = {}) => ({ 'x-test-user': user, 'x-test-workspace': ws, ...extra });
function signedEvents(events, { tamper = false } = {}) {
  const raw = Buffer.from(JSON.stringify(events));
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = sign('sha256', Buffer.concat([Buffer.from(timestamp), raw]), privateKey).toString('base64');
  return { rawBody: tamper ? Buffer.from(JSON.stringify([...events, { event: 'open' }])) : raw,
    headers: { 'x-twilio-email-event-webhook-signature': signature, 'x-twilio-email-event-webhook-timestamp': timestamp } };
}
let passed = 0;
const step = async (name, fn) => { await fn(); passed += 1; console.log(`PASS ${name}`); };

// Two contacts in workspace A with real, evidenced email consent (the backfill itself grants nobody).
async function consentedContact(email) {
  const id = (await one(`insert into contacts (workspace_id, email, display_name) values ($1,$2,$2) returning id`, [WS.A, email])).id;
  await pg.query(`insert into contact_list_memberships (workspace_id, contact_id, source_list_table, source_list_id, purpose, status, lawful_basis)
    values ($1,$2,'lead_lists',$3,'marketing','active','express consent: web form 2026-09-01')`, [WS.A, id, LIST.A]);
  await pg.query(`insert into contact_consent_events (workspace_id, contact_id, channel, event_type, lawful_basis, source, evidence_ref, occurred_at)
    values ($1,$2,'email','granted','express consent: web form 2026-09-01','web-form','form-123','2026-09-01T00:00:00Z')`, [WS.A, id]);
  return id;
}
const fresh1 = await consentedContact('fresh1@example.test');
const fresh2 = await consentedContact('fresh2@example.test');
// The legacy-unsubscribed lead A2 is also made an "active" member: its earlier unsubscribe must still win.
await pg.query(`update contact_list_memberships set status='active', lawful_basis='express consent' where contact_id=(select contact_id from leads where id=$1)`, [LEAD.A2]);

let broadcastId;
await step('schedule API: only currently consented, unsuppressed contacts are queued; access is enforced', async () => {
  const body = { list_id: LIST.A, list_table: 'lead_lists', subject: 'Open home Saturday', html_content: '<p>Hi</p>', scheduled_at: new Date(Date.now() + 60_000).toISOString() };
  const forbidden = await call(scheduleBroadcast, { headers: asBuilder(USER.B, WS.A), body });
  assert.equal(forbidden.statusCode, 403, 'builder B cannot schedule into workspace A');
  const viewer = await call(scheduleBroadcast, { headers: asBuilder(USER.A, WS.A, { 'x-test-role': 'viewer' }), body });
  assert.equal(viewer.statusCode, 403);
  const res = await call(scheduleBroadcast, { headers: asBuilder(USER.A, WS.A), body });
  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  assert.equal(res.body.recipients, 2, 'fresh1 + fresh2; the legacy-unsubscribed contact is excluded');
  broadcastId = res.body.broadcast_id;
  const b = await one(`select status, workspace_id, from_email from email_broadcasts where id=$1`, [broadcastId]);
  assert.deepEqual([b.status, b.workspace_id, b.from_email], ['scheduled', WS.A, 'news@builder-a.test']);
});

await step('SendGrid webhook: fails closed, verifies the ECDSA signature over the raw body, records idempotently', async () => {
  const spam = [{ sg_event_id: 'evt-spam-1', event: 'spamreport', email: 'Fresh2@example.test', timestamp: 1760000000, workspace_id: WS.A, contact_id: fresh2 }];
  const unsigned = await call(sendgridEvents, { rawBody: Buffer.from(JSON.stringify(spam)), headers: {} });
  assert.equal(unsigned.statusCode, 401);
  const tampered = signedEvents(spam, { tamper: true });
  assert.equal((await call(sendgridEvents, tampered)).statusCode, 401, 'body changed after signing');
  const key = process.env.SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY;
  delete process.env.SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY;
  assert.equal((await call(sendgridEvents, signedEvents(spam))).statusCode, 503, 'no key configured -> refuse (SendGrid retries)');
  process.env.SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY = key;

  const ok = await call(sendgridEvents, signedEvents(spam));
  assert.equal(ok.statusCode, 200, JSON.stringify(ok.body));
  assert.deepEqual(ok.body.counts, { matched: 1 });
  const replay = await call(sendgridEvents, signedEvents(spam));
  assert.deepEqual(replay.body.counts, { duplicate: 1 }, 'redelivery is recognised by sg_event_id');
  assert.equal((await one(`select count(*)::int n from email_provider_events`)).n, 1);
  assert.equal((await one(`select reason from email_suppressions where workspace_id=$1 and email_lower='fresh2@example.test'`, [WS.A])).reason, 'spam_complaint');
  assert.equal((await one(`select event_type from contact_consent_events where contact_id=$1 order by recorded_at desc limit 1`, [fresh2])).event_type, 'withdrawn');
  const ghost = await call(sendgridEvents, signedEvents([{ sg_event_id: 'evt-x', event: 'spamreport', email: 'fresh1@example.test', timestamp: 1760000000, workspace_id: WS.B }]));
  assert.deepEqual(ghost.body.counts, { workspace_only: 1 });
  assert.equal((await one(`select count(*)::int n from email_suppressions where email_lower='fresh1@example.test'`)).n, 1, 'recorded for B only');
  assert.equal((await one(`select workspace_id from email_suppressions where email_lower='fresh1@example.test'`)).workspace_id, WS.B, 'workspace A is unaffected by B\'s event');
});

await step('cron tick: unauthenticated refused; mock delivery sends only to the still-permitted contact', async () => {
  assert.equal((await call(tick, { method: 'GET' })).statusCode, 401);
  await pg.query(`update email_broadcasts set scheduled_at = now() - interval '1 second' where id=$1`, [broadcastId]);
  await pg.query(`update email_broadcast_deliveries set scheduled_at = now() - interval '1 second' where broadcast_id=$1`, [broadcastId]);
  const res = await call(tick, { method: 'GET', headers: { authorization: 'Bearer cron-test-secret' } });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  assert.deepEqual([res.body.sent, res.body.suppressed], [1, 1], 'fresh2 was suppressed after the spam complaint');
  const rows = await all(`select c.email, d.status from email_broadcast_deliveries d join contacts c on c.id=d.contact_id where d.broadcast_id=$1 order by c.email`, [broadcastId]);
  assert.deepEqual(rows.map((r) => `${r.email}:${r.status}`), ['fresh1@example.test:sent', 'fresh2@example.test:suppressed']);
  assert.equal((await one(`select status from email_broadcasts where id=$1`, [broadcastId])).status, 'sent');
  const again = await call(tick, { method: 'GET', headers: { authorization: 'Bearer cron-test-secret' } });
  assert.equal(again.body.sent, 0, 'nothing is ever sent twice');
});

await step('delivery, open and hard bounce events update the send and suppress the address', async () => {
  const send = await one(`select id, sendgrid_message_id from email_sends where broadcast_id=$1`, [broadcastId]);
  const ev = (id, kind, extra = {}) => ({ sg_event_id: id, event: kind, email: 'fresh1@example.test', sg_message_id: `${send.sendgrid_message_id}.filter0001`, timestamp: 1760000100, workspace_id: WS.A, contact_id: fresh1, ...extra });
  const res = await call(sendgridEvents, signedEvents([ev('e-d', 'delivered'), ev('e-o', 'open'), ev('e-o2', 'open'), ev('e-b', 'bounce', { type: 'bounce', reason: '550 no such user' })]));
  assert.equal(res.statusCode, 200);
  const row = await one(`select status, delivered_at, open_count, bounced_at, last_event from email_sends where id=$1`, [send.id]);
  assert.equal(row.status, 'bounced'); assert.ok(row.delivered_at); assert.equal(row.open_count, 2); assert.ok(row.bounced_at);
  assert.equal((await one(`select reason from email_suppressions where workspace_id=$1 and email_lower='fresh1@example.test'`, [WS.A])).reason, 'hard_bounce');
  assert.equal((await all(`select * from eligible_email_marketing_contacts($1,'lead_lists',$2)`, [WS.A, LIST.A])).length, 0, 'no one left to mail on list A');
  const soft = await call(sendgridEvents, signedEvents([ev('e-soft', 'bounce', { type: 'blocked' })]));
  assert.equal(soft.statusCode, 200);
  assert.equal((await one(`select count(*)::int n from email_suppressions where reason='hard_bounce'`)).n, 1, 'a soft (blocked) bounce does not suppress');
});

await step('cancel API: owner can cancel a pending broadcast; other workspace cannot', async () => {
  await consentedContact('fresh3@example.test');
  const body = { list_id: LIST.A, list_table: 'lead_lists', subject: 'Later', html_content: '<p>x</p>', scheduled_at: new Date(Date.now() + 3_600_000).toISOString() };
  const scheduled = await call(scheduleBroadcast, { headers: asBuilder(USER.A, WS.A), body });
  assert.equal(scheduled.statusCode, 201, JSON.stringify(scheduled.body));
  const wrong = await call(cancelBroadcast, { headers: asBuilder(USER.B, WS.B), body: { broadcast_id: scheduled.body.broadcast_id } });
  assert.equal(wrong.statusCode, 404);
  const ok = await call(cancelBroadcast, { headers: asBuilder(USER.A, WS.A), body: { broadcast_id: scheduled.body.broadcast_id } });
  assert.equal(ok.statusCode, 200); assert.equal(ok.body.cancelled_deliveries, 1);
});

await step('SMS sequence queue rows honor scheduled start and retain contact/campaign attribution', async () => {
  const now = Date.parse('2026-10-16T00:00:00.000Z');
  const scheduledAt = '2026-10-16T01:00:00.000Z';
  const rows = buildSmsSequenceQueueRows({
    userId: USER.A, workspaceId: WS.A, campaignId: 'campaign-test',
    recipients: [{ lead_id: LEAD.A2, contact_id: fresh1, to_phone: '61412000002' }],
    steps: [
      { delay: 0, unit: 'minutes', message: 'First' },
      { delay: 2, unit: 'hours', message: 'Second' },
    ],
    origin: 'gr8result', scheduledAt, now,
  });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.scheduled_for), ['2026-10-16T01:00:00.000Z', '2026-10-16T03:00:00.000Z']);
  assert.ok(rows.every((row) => row.available_at === scheduledAt && row.campaign_id === 'campaign-test' && row.contact_id === fresh1));
});

await step('SMSGlobal inbound STOP: authenticated, stored before "OK", idempotent, non-OK on failure', async () => {
  await pg.query(`insert into sms_inbound_numbers (workspace_id, phone_e164) values ($1,'61400000111')`, [WS.A]);
  const stop = { from: '0412 000 002', to: '0400 000 111', msg: 'STOP', msgid: 'sg-777', date: '2026-10-15 10:00:00' };
  assert.equal((await call(smsInbound, { method: 'GET', query: stop })).statusCode, 401, 'no secret -> unauthorized');
  const headers = { 'x-smsglobal-webhook-secret': 'sms-test-secret' };
  const malformed = await call(smsInbound, { method: 'GET', query: { ...stop, from: '' }, headers });
  assert.notEqual(malformed.body, 'OK', 'malformed STOP must not be silently acknowledged');
  assert.equal(malformed.statusCode, 422);
  const ok = await call(smsInbound, { method: 'GET', query: stop, headers });
  assert.deepEqual([ok.statusCode, ok.body], [200, 'OK']);
  const replay = await call(smsInbound, { method: 'GET', query: stop, headers });
  assert.deepEqual([replay.statusCode, replay.body], [200, 'OK']);
  assert.equal((await one(`select count(*)::int n from sms_inbound_events`)).n, 1, 'repeated callback stored once');
  assert.equal((await one(`select sms_opt_out from leads where id=$1`, [LEAD.A2])).sms_opt_out, true);
  assert.equal((await one(`select sms_opt_out from leads where id=$1`, [LEAD.B1])).sms_opt_out, false, 'same number at builder B untouched');

  globalThis.__MARKETING_TEST_DB__ = { rpc: async () => ({ data: null, error: { message: 'connection refused' } }) };
  const down = await call(smsInbound, { method: 'GET', query: { ...stop, msgid: 'sg-778' }, headers });
  assert.equal(down.statusCode, 503); assert.notEqual(down.body, 'OK', 'SMSGlobal repeats anything that is not "OK"');
  globalThis.__MARKETING_TEST_DB__ = db;
  const retried = await call(smsInbound, { method: 'GET', query: { ...stop, msgid: 'sg-778' }, headers });
  assert.equal(retried.body, 'OK', 'the repeated callback is then stored');

  process.env.MARKETING_CONTACTS_SCHEMA_READY = 'false';
  assert.equal((await call(smsInbound, { method: 'GET', query: { ...stop, msgid: 'sg-779' }, headers })).statusCode, 503, 'pre-migration: refuse rather than acknowledge and lose');
  process.env.MARKETING_CONTACTS_SCHEMA_READY = 'true';
});

await step('SMS send guard: STOP blocks, missing opt-out number blocks, footer names the STOP number', async () => {
  await assert.rejects(assertSmsMarketingAllowed(db, { workspaceId: WS.A, phone: '+61412000002' }), /STOP/);
  await assert.rejects(assertSmsMarketingAllowed(db, { workspaceId: WS.B, phone: '0412000002' }), /No STOP reply number/);
  const ok = await assertSmsMarketingAllowed(db, { workspaceId: WS.A, phone: '0412000003' });
  assert.equal(ok.optOutNumber, '61400000111');
  assert.equal(withSmsOptOutFooter('Display home open Sat 10am', ok.optOutNumber), 'Display home open Sat 10am\nOpt out: reply STOP to 0400 000 111');
  const broken = { rpc: async () => ({ data: null, error: { message: 'down' } }) };
  await assert.rejects(assertSmsMarketingAllowed(broken, { workspaceId: WS.A, phone: '0412000003' }), /could not be checked/, 'fails closed');
});

await step('SMSGlobal delivery receipt is stored once and linked to the backfilled workspace', async () => {
  const headers = { 'x-smsglobal-webhook-secret': 'sms-test-secret' };
  const dlr = { msgid: 'smsA1', status: 'DELIVRD', event_id: 'dlr-1' };
  const r1 = await call(smsDlr, { method: 'GET', query: { ...dlr, status: 'delivered' }, headers });
  assert.ok([200, 202].includes(r1.statusCode), JSON.stringify(r1.body));
  await call(smsDlr, { method: 'GET', query: { ...dlr, status: 'delivered' }, headers });
  const receipts = await all(`select workspace_id, association_status from sms_delivery_receipts`);
  assert.equal(receipts.length, 1, 'duplicate receipt ignored');
  assert.equal(receipts[0].workspace_id, WS.A);
  assert.equal(receipts[0].association_status, 'pending_contact_link', 'legacy SMS rows have no contact yet; flagged for reconciliation');
});

await step('SMS campaign drafts save, reopen, stay workspace-scoped, and cancel safely', async () => {
  const scheduledAt = new Date(Date.now() + 3_600_000).toISOString();
  const draft = {
    name: 'Spring follow-up', audience_type: 'lead', lead_id: LEAD.A2,
    steps: [{ delay: 0, unit: 'minutes', message: 'New offer' }],
    scheduled_at: scheduledAt,
  };
  const saved = await call(smsCampaigns, { headers: asBuilder(USER.A, WS.A), body: draft });
  assert.equal(saved.statusCode, 201, JSON.stringify(saved.body));
  const campaignId = saved.body.campaign.id;
  assert.equal(saved.body.campaign.status, 'draft');
  assert.equal(saved.body.campaign.scheduled_at, scheduledAt);

  const reopened = await call(smsCampaigns, { method: 'GET', headers: asBuilder(USER.A, WS.A), query: { id: campaignId } });
  assert.equal(reopened.statusCode, 200);
  assert.equal(reopened.body.campaigns[0].steps[0].message, 'New offer');

  const hidden = await call(smsCampaigns, { method: 'GET', headers: asBuilder(USER.B, WS.B), query: { id: campaignId } });
  assert.deepEqual(hidden.body.campaigns, [], 'another workspace cannot reopen the draft');

  const updated = await call(smsCampaigns, { headers: asBuilder(USER.A, WS.A), body: { ...draft, id: campaignId, name: 'Spring follow-up revised' } });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.body.campaign.name, 'Spring follow-up revised');

  const cancelled = await call(smsCampaigns, { headers: asBuilder(USER.A, WS.A), body: { action: 'cancel', id: campaignId } });
  assert.equal(cancelled.statusCode, 200, JSON.stringify(cancelled.body));
  const afterCancel = await call(smsCampaigns, { method: 'GET', headers: asBuilder(USER.A, WS.A), query: { id: campaignId } });
  assert.equal(afterCancel.body.campaigns[0].status, 'cancelled');
});

await step('pre-migration SendGrid path only touches existing email_sends columns and is replay-safe', async () => {
  process.env.MARKETING_CONTACTS_SCHEMA_READY = 'false';
  const ev = [{ sg_event_id: 'legacy-1', event: 'delivered', email: 'una@example.test', sg_message_id: 'sgA4.filter', timestamp: 1760000200 }];
  const r1 = await call(sendgridEvents, signedEvents(ev));
  const r2 = await call(sendgridEvents, signedEvents(ev));
  assert.deepEqual([r1.body.counts, r2.body.counts], [{ updated: 1 }, { updated: 1 }]);
  const row = await one(`select status, delivered_at from email_sends where sendgrid_message_id='sgA4'`);
  assert.equal(row.status, 'delivered'); assert.ok(row.delivered_at);
  process.env.MARKETING_CONTACTS_SCHEMA_READY = 'true';
});

await step('retired log-broadcast endpoint cannot create broadcasts for another user', async () => {
  const before = (await one(`select count(*)::int n from email_broadcasts`)).n;
  const res = await call(logBroadcast, { body: { userId: USER.B, subject: 'spoof' } });
  assert.equal(res.statusCode, 410);
  assert.equal((await one(`select count(*)::int n from email_broadcasts`)).n, before);
});

await step('legacy SendGrid endpoint is retired and cannot process unsigned events', async () => {
  const res = await call(legacySendgridEvents, { body: [{ event: 'unsubscribe', custom_args: { gr8_send_row_id: 'spoof' } }] });
  assert.equal(res.statusCode, 410);
  assert.match(res.body.error, /\/api\/webhooks\/sendgrid-events/);
});

await pg.close();
console.log(`Email/SMS end-to-end checks passed (${passed} scenarios)`);
