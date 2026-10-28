// End-to-end API scenario for Landing Pages, run against the real migration in PGlite (no Supabase, no network).
// Calls the real route handlers in the order a builder would: campaign -> interview -> generate -> edit -> AI edit ->
// image -> save/reload -> publish -> public page -> enquiry -> Leads/CRM -> republish, plus the failure cases.
import assert from 'node:assert/strict';
import { createPgliteSupabase, mockReq, mockRes } from './lib/landing-pages-pglite-supabase.mjs';
import { setLandingDb, getPublishedBySlug } from '../lib/landing-pages/repository.js';
import { signFormToken } from '../lib/landing-pages/submission.js';
import { handler as campaignsIndex } from '../pages/api/landing-pages/campaigns/index.js';
import { handler as campaignRoute } from '../pages/api/landing-pages/campaigns/[id].js';
import { handler as pageRoute } from '../pages/api/landing-pages/pages/[id].js';
import submit from '../pages/api/landing-pages/submit.js';
import track from '../pages/api/landing-pages/track.js';
import cronSync from '../pages/api/landing-pages/cron-sync.js';
import fs from 'node:fs';
import { checkLandingPagesReadiness } from './check-landing-pages-readiness.mjs';
import { generateHeroImage, setAiTransport, setImageTransport } from '../lib/landing-pages/ai.js';

process.env.LANDING_PAGE_FORM_SECRET = 'api-test-secret';
delete process.env.OPENAI_API_KEY;
const db = await createPgliteSupabase();
setLandingDb(db);

const A = 'aaaaaaaa-0000-4000-8000-0000000000a1', B = 'bbbbbbbb-0000-4000-8000-0000000000b2';
const userA = { id: 'a0000000-0000-4000-8000-0000000000a1' }, userB = { id: 'b0000000-0000-4000-8000-0000000000b1' };
await db.pg.exec(`insert into workspaces values ('${A}','Harbourline Homes'),('${B}','Other Builder');
  insert into leads (id, user_id, workspace_id, name, email, source, lead_source, tags) values
   ('11111111-0000-4000-8000-0000000000c1','${userA.id}','${A}','Existing Client','existing.client@example.org','Referral','Referral','vip');`);
const leadsBefore = (await db.pg.query(`select * from leads order by id`)).rows;

let passed = 0;
const step = async (name, fn) => { await fn(); passed += 1; console.log(`PASS ${name}`); };
const call = async (h, opts) => { const res = mockRes(); await h(mockReq(opts), res); return res; };
const asA = (opts) => ({ workspaceId: A, user: userA, workspace: { name: 'Harbourline Homes' }, ...opts });
let ip = 10;
const nextIp = () => ({ 'x-forwarded-for': `198.51.100.${ip++}` });

let campaignId, pageId, revision, doc, slug;

await step('1. create a campaign', async () => {
  const r = await call(campaignsIndex, asA({ method: 'POST', body: { name: 'Build Your Dream Home in 2027' } }));
  assert.equal(r.statusCode, 201, JSON.stringify(r.body));
  campaignId = r.body.campaign.id;
  assert.equal(r.body.campaign.brief.businessName, 'Harbourline Homes', 'business name defaults to the workspace');
  const bad = await call(campaignsIndex, asA({ method: 'POST', body: { name: '   ' } }));
  assert.equal(bad.statusCode, 400);
});

await step('2. complete the AI interview (essentials answered, optional ones skipped or answered)', async () => {
  const answer = async (stepKey, ans, skip = false) => {
    const r = await call(campaignRoute, asA({ method: 'POST', query: { id: campaignId }, body: { action: 'interview', stepKey, answer: ans, skip } }));
    assert.equal(r.statusCode, 200, `${stepKey}: ${JSON.stringify(r.body)}`);
    return r.body;
  };
  let r = await call(campaignRoute, asA({ query: { id: campaignId } }));
  assert.equal(r.body.interview.next.key, 'business');
  const tooEarly = await call(campaignRoute, asA({ method: 'POST', query: { id: campaignId }, body: { action: 'generate' } }));
  assert.equal(tooEarly.statusCode, 400, 'cannot generate before the essentials');
  await answer('business', 'Harbourline Homes, 02 9000 1234, hello@harbourline.test');
  await answer('objective', 'enquiries');
  await answer('offering', 'single and double storey custom homes');
  await answer('audience', 'growing families');
  let body = await answer('serviceArea', 'Western Sydney and the Hills District');
  assert.equal(body.interview.progress.readyToGenerate, true);
  await answer('offer', { offer: '', ctaLabel: 'Book a design consultation' });
  await answer('usps', 'Fixed-price building contracts\nIn-house architects — designs drawn for your block\nWeekly site updates');
  await answer('style', { style: 'premium', primaryColour: '#B84E0A' });
  await answer('media', [{ src: 'https://images.example.org/hero.jpg', alt: 'Two storey home at dusk' }]);
  await answer('evidence', { testimonials: '"They answered every question before we signed." — Priya and Dev, Box Hill', credentials: 'NSW Builder Licence 123456C' });
  for (const s of ['formFields', 'thankYou', 'dates']) await answer(s, '', true);
  body = await answer('seo', '', true);
  assert.equal(body.interview.next, null);
  r = await call(campaignRoute, asA({ query: { id: campaignId } }));
  assert.equal(r.body.campaign.brief.ctaLabel, 'Book a design consultation', 'progress is saved after every answer');
});

await step('3. generate a complete page from the brief', async () => {
  const r = await call(campaignRoute, asA({ method: 'POST', query: { id: campaignId }, body: { action: 'generate' } }));
  assert.equal(r.statusCode, 200, JSON.stringify(r.body));
  pageId = r.body.pageId;
  const g = await call(pageRoute, asA({ query: { id: pageId } }));
  assert.equal(g.statusCode, 200);
  ({ document: doc, revision, slug } = g.body.page);
  assert.equal(slug, 'build-your-dream-home-in-2027');
  assert.deepEqual(g.body.check.errors, [], 'generated page is publishable as-is');
  const types = doc.sections.map((s) => s.type);
  assert.deepEqual([types[0], types.at(-1)], ['hero', 'footer']);
  assert(types.includes('testimonials') && types.includes('trust') && types.includes('enquiry'));
  const again = await call(campaignRoute, asA({ method: 'POST', query: { id: campaignId }, body: { action: 'generate' } }));
  assert.equal(again.statusCode, 409, 'a second generate does not silently replace the page');
});

const save = async (document, kind = 'save', label = null) => {
  const r = await call(pageRoute, asA({ method: 'PUT', query: { id: pageId }, body: { document, baseRevision: revision, kind, label } }));
  assert.equal(r.statusCode, 200, JSON.stringify(r.body));
  revision = r.body.revision; doc = document;
  return r;
};

await step('4. edit a headline manually and save', async () => {
  const d = structuredClone(doc);
  d.sections[0].props.headline = 'Build the family home you have been planning, in 2027';
  await save(d);
});

await step('5. ask the AI assistant to change another section, then accept', async () => {
  const faq = doc.sections.find((s) => s.type === 'faq');
  const r = await call(pageRoute, asA({ method: 'POST', query: { id: pageId }, body: { action: 'assistant', instruction: 'Make the enquiry form shorter', document: doc } }));
  assert.equal(r.statusCode, 200); assert(r.body.proposal, JSON.stringify(r.body));
  assert(r.body.proposal.document.form.fields.length < doc.form.fields.length);
  assert.equal(r.body.proposal.document.sections[0].props.headline, 'Build the family home you have been planning, in 2027', 'manual edit preserved');
  await save(r.body.proposal.document, 'ai', r.body.proposal.summary);
  const r2 = await call(pageRoute, asA({ method: 'POST', query: { id: pageId }, body: { action: 'assistant', instruction: 'Rename the FAQ heading', document: doc, selectedSectionId: faq.id } }));
  assert.equal(r2.statusCode, 200, 'unknown instruction without AI returns guidance rather than failing');
});

await step('6. replace an image', async () => {
  const d = structuredClone(doc);
  d.sections[0].props.image = { src: 'https://images.example.org/new-hero.jpg', alt: 'Single storey home with garden' };
  await save(d);
  const badUpload = await call(pageRoute, asA({ method: 'POST', query: { id: pageId }, body: { action: 'upload', dataUrl: 'data:text/html;base64,PGgxPg==' } }));
  assert.equal(badUpload.statusCode, 400, 'only images can be uploaded');
});

await step('7-8. reload: every edit persisted; stale saves are refused', async () => {
  const g = await call(pageRoute, asA({ query: { id: pageId } }));
  const d = g.body.page.document;
  assert.equal(d.sections[0].props.headline, 'Build the family home you have been planning, in 2027');
  assert.equal(d.sections[0].props.image.src, 'https://images.example.org/new-hero.jpg');
  assert.equal(d.form.fields.length, doc.form.fields.length);
  const stale = await call(pageRoute, asA({ method: 'PUT', query: { id: pageId }, body: { document: d, baseRevision: revision - 1 } }));
  assert.equal(stale.statusCode, 409);
  const v = await call(pageRoute, asA({ query: { id: pageId, versions: '1' } }));
  assert.deepEqual(v.body.versions.map((x) => x.kind), ['save', 'ai', 'save', 'generated']);
});

let firstVersionId;
await step('9-10. publish and load the public page by its stable URL', async () => {
  const r = await call(pageRoute, asA({ method: 'POST', query: { id: pageId }, body: { action: 'publish' } }));
  assert.equal(r.statusCode, 200, JSON.stringify(r.body));
  assert.equal(r.body.publicUrl, 'https://app.test/lp/build-your-dream-home-in-2027');
  firstVersionId = r.body.version.id;
  const pub = await getPublishedBySlug(slug);
  assert.equal(pub.document.sections[0].props.headline, 'Build the family home you have been planning, in 2027');
  const c = await call(campaignRoute, asA({ query: { id: campaignId } }));
  assert.equal(c.body.campaign.status, 'active', 'publishing activates a draft campaign');
  // draft edits after publishing do not leak to the live page
  const d = structuredClone(doc); d.sections[0].props.headline = 'Unpublished draft headline';
  await save(d);
  assert.equal((await getPublishedBySlug(slug)).document.sections[0].props.headline, 'Build the family home you have been planning, in 2027');
});

await step('publish is blocked while the page has placeholders or broken buttons', async () => {
  const d = structuredClone(doc); d.sections[0].props.subheadline = 'Lorem ipsum'; d.sections[0].props.primaryCta.href = '#missing';
  await save(d);
  const r = await call(pageRoute, asA({ method: 'POST', query: { id: pageId }, body: { action: 'publish' } }));
  assert.equal(r.statusCode, 422); assert(r.body.check.errors.length >= 2);
  const fixed = structuredClone(d); fixed.sections[0].props.subheadline = 'Custom homes for growing families.'; fixed.sections[0].props.primaryCta.href = '#enquire';
  await save(fixed);
});

const enquiry = (overrides = {}) => ({
  pageId, token: signFormToken(pageId, Date.now() - 8000), idempotencyKey: `key${Math.random().toString(36).slice(2, 14)}`, consent: true,
  fields: { name: 'Jordan Rivers', email: 'Jordan.Rivers@example.org', phone: '0412 345 678' },
  attribution: { utm_source: 'facebook', utm_medium: 'social', utm_campaign: 'build-your-dream-home-in-2027', referrer: 'https://facebook.com/' },
  ...overrides,
});

let leadId;
await step('11-15. visit + enquiry -> durable submission -> Lead and CRM note with campaign attribution', async () => {
  const t = mockRes(); await track(mockReq({ method: 'POST', body: { pageId, attribution: { utm_source: 'facebook' } }, headers: { ...nextIp(), 'user-agent': 'Mozilla/5.0' } }), t);
  assert.equal(t.statusCode, 204);
  const body = enquiry();
  const r = await call(submit, { method: 'POST', body, headers: nextIp() });
  assert.equal(r.statusCode, 200, JSON.stringify(r.body));
  const sub = (await db.pg.query(`select * from landing_page_submissions where page_id=$1`, [pageId])).rows[0];
  assert.equal(sub.status, 'synced'); assert.equal(sub.workspace_id, A); assert.equal(sub.campaign_id, campaignId);
  assert.equal(sub.attribution.utm_source, 'facebook'); assert.equal(sub.page_version_id, firstVersionId);
  const lead = (await db.pg.query(`select * from leads where id=$1`, [sub.lead_id])).rows[0];
  leadId = lead.id;
  assert.equal(lead.workspace_id, A); assert.equal(lead.email, 'jordan.rivers@example.org'); assert.equal(lead.name, 'Jordan Rivers');
  assert.equal(lead.lead_source, 'Landing Page: Build Your Dream Home in 2027'); assert.equal(lead.lead_status, 'new');
  const note = (await db.pg.query(`select note from lead_notes where lead_id=$1`, [lead.id])).rows[0].note;
  assert.match(note, /Build Your Dream Home in 2027/); assert.match(note, /utm_source/); assert.match(note, new RegExp(campaignId));
  const c = await call(campaignRoute, asA({ query: { id: campaignId } }));
  assert.equal(c.body.stats.visits, 1); assert.equal(c.body.stats.leads, 1); assert.equal(c.body.submissions[0].lead_id, lead.id);
  // the same browser retrying with the same key does not create a second enquiry
  const dup = await call(submit, { method: 'POST', body, headers: nextIp() });
  assert.equal(dup.body.duplicate, true);
  assert.equal((await db.pg.query(`select count(*)::int n from landing_page_submissions`)).rows[0].n, 1);
  assert.equal((await db.pg.query(`select count(*)::int n from lead_notes where lead_id=$1`, [lead.id])).rows[0].n, 1);
});

await step('a returning enquirer is matched to the existing CRM contact, not duplicated', async () => {
  const r = await call(submit, { method: 'POST', body: enquiry({ fields: { name: 'Someone Else', email: 'EXISTING.client@example.org' } }), headers: nextIp() });
  assert.equal(r.statusCode, 200);
  const lead = (await db.pg.query(`select * from leads where id='11111111-0000-4000-8000-0000000000c1'`)).rows[0];
  assert.equal(lead.name, 'Existing Client'); assert.equal(lead.lead_source, 'Referral'); assert.match(lead.tags, /campaign:build-your-dream-home-in-2027/);
});

await step('spam, malformed input and expired forms are rejected without storing anything', async () => {
  const before = (await db.pg.query(`select count(*)::int n from landing_page_submissions`)).rows[0].n;
  let r = await call(submit, { method: 'POST', body: enquiry({ company_website: 'http://spam.example' }), headers: nextIp() });
  assert.equal(r.statusCode, 200, 'honeypot gets a quiet success');
  r = await call(submit, { method: 'POST', body: enquiry({ token: signFormToken(pageId) }), headers: nextIp() });
  assert.equal(r.statusCode, 200, 'instant bot submissions get a quiet success');
  r = await call(submit, { method: 'POST', body: enquiry({ token: 'forged.token' }), headers: nextIp() });
  assert.equal(r.statusCode, 400);
  r = await call(submit, { method: 'POST', body: enquiry({ fields: { email: 'not-an-email', name: '' }, consent: false }), headers: nextIp() });
  assert.equal(r.statusCode, 422); assert(r.body.errors.email && r.body.errors.consent && r.body.errors.name);
  r = await call(submit, { method: 'POST', body: { pageId: 'nope' }, headers: nextIp() });
  assert.equal(r.statusCode, 400);
  r = await call(submit, { method: 'GET', headers: nextIp() });
  assert.equal(r.statusCode, 405);
  assert.equal((await db.pg.query(`select count(*)::int n from landing_page_submissions`)).rows[0].n, before);
  const sameIp = { 'x-forwarded-for': '192.0.2.77' };
  let last;
  for (let i = 0; i < 9; i += 1) last = await call(submit, { method: 'POST', body: { pageId }, headers: sameIp });
  assert.equal(last.statusCode, 429, 'per-IP rate limit');
});

await step('CRM outage: enquiry is still recorded, reported as received, and synced on retry', async () => {
  db.failRpc = true;
  const r = await call(submit, { method: 'POST', body: enquiry({ fields: { name: 'Outage Person', email: 'outage@example.org' } }), headers: nextIp() });
  db.failRpc = false;
  assert.equal(r.statusCode, 200);
  const sub = (await db.pg.query(`select * from landing_page_submissions where email='outage@example.org'`)).rows[0];
  assert.equal(sub.status, 'failed'); assert.match(sub.last_error, /outage/); assert.equal(sub.lead_id, null);
  let c = await call(campaignRoute, asA({ query: { id: campaignId } }));
  assert.equal(c.body.stats.failed, 1);
  c = await call(campaignRoute, asA({ method: 'POST', query: { id: campaignId }, body: { action: 'retry-sync' } }));
  assert.equal(c.body.stats.failed, 0);
  assert.equal((await db.pg.query(`select status from landing_page_submissions where id=$1`, [sub.id])).rows[0].status, 'synced');
  db.failNext = (table, op) => table === 'landing_page_submissions' && op === 'insert';
  const down = await call(submit, { method: 'POST', body: enquiry({ fields: { name: 'X', email: 'x@example.org' } }), headers: nextIp() });
  db.failNext = null;
  assert.equal(down.statusCode, 503, 'if the enquiry cannot be recorded the visitor is told to retry, never told it was sent');
});

await step('scheduled CRM recovery authenticates, isolates tenants and is idempotent', async () => {
  const previousSecret = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = 'isolated-cron-secret';
    const before = (await db.pg.query('select count(*)::int n from lead_notes')).rows[0].n;
    assert.equal((await call(cronSync, {})).statusCode, 401);
    assert.equal((await call(cronSync, { headers: { authorization: 'Bearer wrong-secret' } })).statusCode, 401);
    assert.equal((await call(cronSync, { method: 'DELETE', headers: { authorization: 'Bearer isolated-cron-secret' } })).statusCode, 405);
    delete process.env.CRON_SECRET;
    assert.equal((await call(cronSync, { headers: { authorization: 'Bearer ' } })).statusCode, 401);
    process.env.CRON_SECRET = 'isolated-cron-secret';
    assert.equal((await db.pg.query('select count(*)::int n from lead_notes')).rows[0].n, before);
    db.failRpc = true;
    const failed = await call(submit, { method: 'POST', body: enquiry({ fields: { name: 'Automatic Recovery', email: 'automatic@example.org' } }), headers: nextIp() });
    assert.equal(failed.statusCode, 200);
    const otherCampaign = (await db.pg.query('insert into landing_campaigns (workspace_id,created_by,name) values ($1,$2,$3) returning id', [B, userB.id, 'Other scheduled campaign'])).rows[0];
    const otherPage = (await db.pg.query('insert into landing_pages (workspace_id,campaign_id,created_by,slug) values ($1,$2,$3,$4) returning id', [B, otherCampaign.id, userB.id, 'other-scheduled-page'])).rows[0];
    await db.pg.query("insert into landing_page_submissions (workspace_id,campaign_id,page_id,idempotency_key,email,name,status) values ($1,$2,$3,'scheduled-tenant-b','automatic@example.org','Other Tenant','failed')", [B, otherCampaign.id, otherPage.id]);
    const auth = { authorization: 'Bearer isolated-cron-secret' };
    const unavailable = await call(cronSync, { headers: auth });
    assert.equal(unavailable.body.attempted, 2);
    assert.equal(unavailable.body.synced, 0);
    db.failRpc = false;
    const recovered = await call(cronSync, { headers: auth });
    assert.deepEqual(recovered.body, { ok: true, attempted: 2, synced: 2 });
    assert.equal(recovered.headers['cache-control'], 'no-store');
    const leads = (await db.pg.query("select id,workspace_id,name from leads where email='automatic@example.org' order by workspace_id")).rows;
    assert.equal(leads.length, 2);
    assert.deepEqual(leads.map((lead) => lead.workspace_id), [A, B]);
    assert.deepEqual(leads.map((lead) => lead.name), ['Automatic Recovery', 'Other Tenant']);
    assert.equal((await db.pg.query('select count(*)::int n from lead_notes where lead_id = any($1::uuid[])', [leads.map((lead) => lead.id)])).rows[0].n, 2);
    assert.deepEqual((await call(cronSync, { method: 'POST', headers: auth })).body, { ok: true, attempted: 0, synced: 0 });
    assert.equal((await db.pg.query('select count(*)::int n from lead_notes where lead_id = any($1::uuid[])', [leads.map((lead) => lead.id)])).rows[0].n, 2);
    const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
    assert.equal(config.crons.filter((entry) => entry.path === '/api/landing-pages/cron-sync').length, 1);
    for (const existing of ['/api/automation/engine/tick', '/api/email/autoresponders/process-queue', '/api/smsglobal/flush-queue', '/api/social/cron/process-schedule', '/api/social/cron/process-queue', '/api/social/cron/refresh-tokens', '/api/calendar/send-reminders']) assert(config.crons.some((entry) => entry.path === existing));
  } finally {
    db.failRpc = false;
    if (previousSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previousSecret;
  }
});

await step('16-17. republish an edited version; the live page updates, history is kept, restore works', async () => {
  const d = structuredClone(doc); d.sections[0].props.headline = 'Your 2027 home, designed around your family';
  await save(d);
  const r = await call(pageRoute, asA({ method: 'POST', query: { id: pageId }, body: { action: 'publish' } }));
  assert.equal(r.statusCode, 200);
  assert.equal((await getPublishedBySlug(slug)).document.sections[0].props.headline, 'Your 2027 home, designed around your family');
  const versions = (await call(pageRoute, asA({ query: { id: pageId, versions: '1' } }))).body.versions;
  assert.equal(versions.filter((v) => v.kind === 'publish').length, 2);
  const generated = versions.find((v) => v.kind === 'generated');
  const restored = await call(pageRoute, asA({ method: 'POST', query: { id: pageId }, body: { action: 'restore', versionId: generated.id, baseRevision: revision } }));
  assert.equal(restored.statusCode, 200); revision = restored.body.revision;
  assert.notEqual(restored.body.document.sections[0].props.headline, 'Your 2027 home, designed around your family');
  assert.equal((await getPublishedBySlug(slug)).document.sections[0].props.headline, 'Your 2027 home, designed around your family', 'restoring a draft does not change the live page');
});

await step('tenant isolation: another builder cannot see, edit, publish or read leads of this campaign', async () => {
  const asB = (opts) => ({ workspaceId: B, user: userB, ...opts });
  assert.equal((await call(campaignsIndex, asB({}))).body.campaigns.some((campaign) => campaign.id === campaignId), false);
  assert.equal((await call(campaignRoute, asB({ query: { id: campaignId } }))).statusCode, 404);
  assert.equal((await call(pageRoute, asB({ query: { id: pageId } }))).statusCode, 404);
  assert.equal((await call(pageRoute, asB({ method: 'PUT', query: { id: pageId }, body: { document: doc, baseRevision: revision } }))).statusCode, 404);
  assert.equal((await call(pageRoute, asB({ method: 'POST', query: { id: pageId }, body: { action: 'unpublish' } }))).statusCode, 404);
  assert.equal((await call(campaignRoute, asB({ method: 'POST', query: { id: campaignId }, body: { action: 'archive' } }))).statusCode, 404);
  assert.equal((await db.pg.query(`select count(*)::int n from leads where workspace_id=$1 and email='jordan.rivers@example.org'`, [B])).rows[0].n, 0);
});

await step('duplicate and archive campaigns; archived pages go offline', async () => {
  const d = await call(campaignRoute, asA({ method: 'POST', query: { id: campaignId }, body: { action: 'duplicate' } }));
  assert.equal(d.statusCode, 201);
  const list = (await call(campaignsIndex, asA({}))).body.campaigns;
  const copy = list.find((c) => c.id === d.body.campaign.id);
  assert.equal(copy.pages.length, 1); assert.notEqual(copy.pages[0].slug, slug); assert.equal(copy.pages[0].status, 'draft');
  const a = await call(campaignRoute, asA({ method: 'POST', query: { id: copy.id }, body: { action: 'archive' } }));
  assert.equal(a.body.campaign.status, 'archived');
  assert.equal((await call(campaignsIndex, asA({}))).body.campaigns.some((c) => c.id === copy.id), false);
  assert.equal((await call(campaignsIndex, asA({ query: { archived: '1' } }))).body.campaigns.some((c) => c.id === copy.id), true);
  assert(await getPublishedBySlug(slug), 'the original campaign stays live');
  const un = await call(pageRoute, asA({ method: 'POST', query: { id: pageId }, body: { action: 'unpublish' } }));
  assert.equal(un.body.page.status, 'unpublished');
  assert.equal(await getPublishedBySlug(slug), null);
  const late = await call(submit, { method: 'POST', body: enquiry(), headers: nextIp() });
  assert.equal(late.statusCode, 404, 'an unpublished page stops accepting enquiries');
  await call(pageRoute, asA({ method: 'POST', query: { id: pageId }, body: { action: 'publish' } }));
});

await step('18. existing CRM data is intact', async () => {
  const after = (await db.pg.query(`select * from leads where id = any($1::uuid[]) order by id`, [leadsBefore.map((l) => l.id)])).rows;
  for (const [i, l] of leadsBefore.entries()) {
    assert.equal(after[i].name, l.name); assert.equal(after[i].email, l.email); assert.equal(after[i].lead_source, l.lead_source); assert.equal(after[i].user_id, l.user_id);
  }
});

await step('marketing: tracked links and social copy for the published page', async () => {
  const r = await call(pageRoute, asA({ method: 'POST', query: { id: pageId }, body: { action: 'marketing' } }));
  assert.equal(r.body.published, true);
  assert.match(r.body.links.find((l) => l.key === 'facebook').url, /\/lp\/build-your-dream-home-in-2027\?utm_source=facebook/);
  assert.match(r.body.posts.facebook, /utm_source=facebook/); assert.equal(r.body.usedAi, false);
});

await step('campaign defaults use the workspace owner business profile without verification data', async () => {
  await db.pg.exec('alter table workspaces add column owner_id uuid; create table business_profile_vaults (user_id uuid primary key, data jsonb); create table accounts (user_id uuid primary key, business_logo text, business_logo_url text)');
  const publicLogo = 'https://readiness-test.supabase.co/storage/v1/object/public/public-assets/company/logo.png';
  await db.pg.query('insert into accounts (user_id,business_logo) values ($1,$2)', [userA.id, publicLogo]);
  db.storage = { from(bucket) { return { getPublicUrl(storagePath) { return { data: { publicUrl: `https://readiness-test.supabase.co/storage/v1/object/public/${bucket}/${storagePath}` } }; } }; } };
  await db.pg.query('update workspaces set owner_id=$1 where id=$2', [userA.id, A]);
  const profileLogo = 'https://readiness-test.supabase.co/storage/v1/object/public/public-assets/business-profile-vault/bright/logo.png';
  await db.pg.query('insert into business_profile_vaults values ($1,$2)', [userA.id, JSON.stringify({ business_information: { tradingName: 'Bright Dental', industry: 'Dentistry', businessEmail: 'hello@bright.test', businessPhone: '07 3000 1234', businessAddress: 'Brisbane', abn: 'private-registration' }, branding_assets: { companyLogoUpload: profileLogo }, account_holder_verification: { idNumber: 'private-identity' } })]);
  const created = await call(campaignsIndex, asA({ method: 'POST', body: { name: 'Spring Promotion' } }));
  assert.equal(created.statusCode, 201, JSON.stringify(created.body));
  assert.deepEqual(created.body.campaign.brief, { businessName: 'Bright Dental', industry: 'Dentistry', email: 'hello@bright.test', phone: '07 3000 1234', address: 'Brisbane', logoUrl: profileLogo, campaignName: 'Spring Promotion' });
  assert(!JSON.stringify(created.body).includes('private-'));
  const other = await call(campaignsIndex, { workspaceId: B, user: userB, workspace: { name: 'Other Business' }, method: 'POST', body: { name: 'New Product Launch' } });
  assert.equal(other.statusCode, 201);
  assert(!JSON.stringify(other.body.campaign.brief).includes('Bright Dental'));
});

await step('Quick Generate extracts one prompt into an account-branded campaign brief', async () => {
  setAiTransport(async () => ({ businessName: 'Bright Dental', industry: 'Dentistry', objective: 'display', offering: 'family dental care', audience: 'local families', serviceArea: 'Brisbane', phone: '07 3000 1234' }));
  try {
    const prompt = 'Create a bright page for our family dental practice, aimed at local Brisbane families.';
    const response = await call(campaignsIndex, asA({ method: 'POST', body: { prompt } }));
    assert.equal(response.statusCode, 201, JSON.stringify(response.body));
    assert.equal(response.body.campaign.brief.businessName, 'Bright Dental');
    assert.equal(response.body.campaign.brief.objective, 'display');
    assert.equal(response.body.campaign.brief.campaignPrompt, prompt);
    assert(response.body.campaign.brief.logoUrl, 'saved owner branding is carried into the quick campaign');
  } finally { setAiTransport(null); }
});

await step('AI-selected architecture is validated and saved with generated copy', async () => {
  setAiTransport(async ({ system }) => {
    if (system.includes('Proofread the supplied campaign copy')) return {};
    if (system.includes('campaign strategist')) return { strategy: { audience: 'retailers', problemSolutionBenefits: [{ problem: 'Disconnected inventory', solution: 'Stock tracking', benefit: 'See inventory together' }], visual: { treatment: 'product', direction: 'Retail inventory context' } }, sections: ['hero', 'services', 'faq', 'offer', 'enquiry', 'footer'].map((type) => ({ type, reason: `Chosen for ${type}` })) };
    return { hero: { headline: 'Know what is in stock' }, services: { items: [{ title: 'Stock tracking', body: 'See inventory in one place.' }, { title: 'Purchase planning', body: 'Plan replenishment with clarity.' }] } };
  });
  try {
    const created = await call(campaignsIndex, asA({ method: 'POST', body: { name: 'Retail Stock Clarity' } }));
    const id = created.body.campaign.id;
    const patched = await call(campaignRoute, asA({ method: 'PATCH', query: { id }, body: { brief: { businessName: 'Stockwise', phone: '02 9000 0000', objective: 'package', offering: 'inventory software; stock tracking; purchase planning', audience: 'independent retailers', serviceArea: 'Australia', offer: '14-day trial' } } }));
    assert.equal(patched.statusCode, 200);
    const generated = await call(campaignRoute, asA({ method: 'POST', query: { id }, body: { action: 'generate' } }));
    assert.equal(generated.statusCode, 200, JSON.stringify(generated.body));
    assert.equal(generated.body.usedAi, true);
    assert.deepEqual(generated.body.structure.map((section) => section.type), ['hero', 'services', 'faq', 'offer', 'enquiry', 'footer']);
    const savedPage = await call(pageRoute, asA({ query: { id: generated.body.pageId } }));
    assert.deepEqual(savedPage.body.page.document.sections.map((section) => section.type), generated.body.structure.map((section) => section.type));
    assert.equal(savedPage.body.page.document.sections[0].props.headline, 'Know what is in stock');
    assert.equal(savedPage.body.page.document.generation.strategy.visual.treatment, 'product');
  } finally {
    setAiTransport(null);
  }
});

await step('architecture success with copy failure is reported as fallback, not real-AI success', async () => {
  setAiTransport(async ({ system }) => {
    if (system.includes('Proofread the supplied campaign copy')) return {};
    if (system.includes('campaign strategist')) return { sections: ['hero', 'benefits', 'enquiry', 'footer'] };
    throw new Error('simulated provider fetch failure');
  });
  try {
    const created = await call(campaignsIndex, asA({ method: 'POST', body: { name: 'AI fallback status check' } }));
    const id = created.body.campaign.id;
    await call(campaignRoute, asA({ method: 'PATCH', query: { id }, body: { brief: { businessName: 'Bright Dental', phone: '07 3000 4444', objective: 'enquiries', offering: 'family dentistry', audience: 'local families', serviceArea: 'Brisbane' } } }));
    const generated = await call(campaignRoute, asA({ method: 'POST', query: { id }, body: { action: 'generate' } }));
    assert.equal(generated.statusCode, 200);
    assert.equal(generated.body.usedAi, false);
    assert.deepEqual(generated.body.aiStatus, { correction: 'ai', architecture: 'ai', copy: 'fallback' });
  } finally { setAiTransport(null); }
});

await step('copy proofreading is applied only to derived copy inputs and preserves the stored brief', async () => {
  const created = await call(campaignsIndex, asA({ method: 'POST', body: { name: 'Copy proofing' } }));
  const id = created.body.campaign.id;
  const raw = { businessName: 'Bright Dental', phone: '07 3000 1234', objective: 'enquiries', offering: 'preventative dental care with colourfull desgins', audience: 'local families', serviceArea: 'Brisbane', usps: ['Gentle care for familys'] };
  await call(campaignRoute, asA({ method: 'PATCH', query: { id }, body: { brief: raw } }));
  let copyPromptBrief;
  setAiTransport(async ({ system, user }) => {
    if (system.includes('Proofread the supplied campaign copy')) return { offering: 'preventative dental care with colourful designs', audience: 'local families', serviceArea: 'Brisbane', usps: ['Gentle care for families'] };
    if (system.includes('campaign strategist')) return { sections: ['hero', 'benefits', 'enquiry', 'footer'] };
    copyPromptBrief = user.brief;
    return { hero: { headline: 'Preventative dental care with colourful designs' } };
  });
  try {
    const generated = await call(campaignRoute, asA({ method: 'POST', query: { id }, body: { action: 'generate' } }));
    assert.equal(generated.statusCode, 200, JSON.stringify(generated.body));
    assert.equal(generated.body.aiStatus.correction, 'ai');
    assert.match(JSON.stringify(copyPromptBrief), /colourful designs/);
    assert.match(JSON.stringify(copyPromptBrief), /Gentle care for families/);
    assert.equal(copyPromptBrief.business, 'Bright Dental');
    const persisted = await call(campaignRoute, asA({ query: { id } }));
    assert.equal(persisted.body.campaign.brief.offering, raw.offering);
    assert.deepEqual(persisted.body.campaign.brief.usps, raw.usps);
  } finally { setAiTransport(null); }
});

await step('hero image prompt uses campaign subject details and never includes contact data', async () => {
  let prompt;
  setImageTransport(async (input) => { prompt = input.prompt; return { dataUrl: 'data:image/png;base64,aGVsbG8=', alt: 'Dental care' }; });
  try {
    const result = await generateHeroImage({ businessName: 'Bright Dental', industry: 'Dentistry', offering: 'family dental care', audience: 'local families', serviceArea: 'Brisbane', phone: '07 3000 1234', email: 'private@example.test' });
    assert.match(prompt, /family dental care/);
    assert.match(prompt, /Brisbane/);
    assert.doesNotMatch(prompt, /07 3000 1234|private@example\.test/);
    assert.equal(result.dataUrl, 'data:image/png;base64,aGVsbG8=');
  } finally { setImageTransport(null); }
});

await step('hero image generation fails closed when unavailable or cross-workspace', async () => {
  const created = await call(campaignsIndex, asA({ method: 'POST', body: { name: 'Image access control' } }));
  const id = created.body.campaign.id;
  const unavailable = await call(campaignRoute, asA({ method: 'POST', query: { id }, body: { action: 'generate-image' } }));
  assert.equal(unavailable.statusCode, 503, JSON.stringify(unavailable.body));
  const crossWorkspace = await call(campaignRoute, { workspaceId: B, user: userB, method: 'POST', query: { id }, body: { action: 'generate-image' } });
  assert.equal(crossWorkspace.statusCode, 404);
});

await step('generic first-screen copy receives one bounded strategy-aware revision', async () => {
  let copyCalls = 0;
  setAiTransport(async ({ system, user }) => {
    if (system.includes('Proofread the supplied campaign copy')) return {};
    if (system.includes('campaign strategist')) return { strategy: { visual: { treatment: 'product', direction: 'Builder workflow concept' } }, sections: ['hero', 'benefits', 'enquiry', 'footer'] };
    copyCalls += 1;
    if (copyCalls === 1) return { hero: { headline: 'All-in-One Management Platform', subheadline: 'Streamline your operations.' } };
    assert(user.requiredCorrections.length > 0);
    assert.equal(user.strategy.visual.treatment, 'product');
    return { hero: { headline: 'Stop re-entering estimates across separate systems', subheadline: 'Workflow software for builders connects estimates and client selections. Register for release updates.' } };
  });
  try {
    const created = await call(campaignsIndex, asA({ method: 'POST', body: { name: 'Builder pre-launch' } }));
    const id = created.body.campaign.id;
    await call(campaignRoute, asA({ method: 'PATCH', query: { id }, body: { brief: { businessName: 'Builder Tools', email: 'info@example.test', objective: 'prelaunch', offering: 'estimating and selections software', audience: 'builders', serviceArea: 'Australia', capabilities: [{ name: 'Estimating', description: 'Connect estimate inputs.', status: 'development' }] } } }));
    const generated = await call(campaignRoute, asA({ method: 'POST', query: { id }, body: { action: 'generate' } }));
    assert.equal(generated.statusCode, 200);
    assert.equal(copyCalls, 2);
    assert.deepEqual(generated.body.qualityIssues, []);
    const saved = await call(pageRoute, asA({ query: { id: generated.body.pageId } }));
    assert.equal(saved.body.page.document.sections[0].variant, 'product');
    assert(saved.body.page.document.sections.some((section) => section.type === 'services'));
    assert.match(saved.body.page.document.sections.find((section) => section.type === 'services').props.items[0].body, /^In development:/);
    const again = await call(campaignRoute, asA({ method: 'POST', query: { id }, body: { action: 'generate' } }));
    assert.equal(again.statusCode, 409);
    assert.equal(copyCalls, 2, 'Duplicate generation is rejected before further provider requests');
  } finally { setAiTransport(null); }
});

await step('deployment readiness fails closed for missing schema, permissions, target or configuration', async () => {
  const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://readiness-test.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'isolated-anon', SUPABASE_SERVICE_ROLE_KEY: 'isolated-service', OPENAI_API_KEY: 'isolated-provider', LANDING_PAGE_FORM_SECRET: 'f'.repeat(32), CRON_SECRET: 'c'.repeat(32), LANDING_PAGES_PUBLIC_URL: 'https://app.example.test' };
  assert.equal((await checkLandingPagesReadiness({ env, client: db, expectedProject: 'readiness-test' })).ready, true);
  assert.equal((await checkLandingPagesReadiness({ env, client: db, expectedProject: 'wrong-project' })).ready, false);
  assert.equal((await checkLandingPagesReadiness({ env: { ...env, OPENAI_API_KEY: '' }, client: db })).ready, false);
  await db.pg.exec('revoke update on landing_pages from service_role');
  assert.equal((await checkLandingPagesReadiness({ env, client: db })).ready, false);
  await db.pg.exec('grant update on landing_pages to service_role');
  db.failNext = (table) => table === 'landing_campaigns';
  assert.equal((await checkLandingPagesReadiness({ env, client: db })).ready, false);
  db.failNext = null;
  assert.equal((await checkLandingPagesReadiness({ env, client: db })).ready, true);
  const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  assert.match(config.buildCommand, /check-landing-pages-readiness\.mjs.*--build/);
});

console.log(`\n${passed} landing page API scenario steps passed.`);
