import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { startMockSupabase } from './lib/mock-supabase-server.mjs';
import { handler, setFunnelTemplateDb } from '../pages/api/funnels/templates.js';
import { composeDocument } from '../lib/landing-pages/generator.js';
import { setLandingDb } from '../lib/landing-pages/repository.js';
import { handler as pageHandler } from '../pages/api/landing-pages/pages/[id].js';
import submit from '../pages/api/landing-pages/submit.js';
import { signFormToken } from '../lib/landing-pages/submission.js';
import { mockReq, mockRes } from './lib/landing-pages-pglite-supabase.mjs';

process.env.LANDING_PAGE_FORM_SECRET = 'isolated-campaign-master-form-secret';
process.env.SENDGRID_API_KEY = '';
process.env.RESEND_API_KEY = '';
const ADMIN = 'a0000000-0000-4000-8000-000000000091';
const B = 'b0000000-0000-4000-8000-000000000092';
const C = 'c0000000-0000-4000-8000-000000000093';
const WA = 'aaaaaaaa-0000-4000-8000-000000000091';
const WB = 'bbbbbbbb-0000-4000-8000-000000000092';
const WC = 'cccccccc-0000-4000-8000-000000000093';
const sourceId = randomUUID();
const schema = `
  create table funnels (id uuid primary key default gen_random_uuid(), owner_user_id uuid not null, workspace_id uuid,
    name text not null, description text, notify_email text, default_list_id uuid, slug text unique, status text default 'draft',
    created_at timestamptz default now(), updated_at timestamptz default now());
  create table funnel_steps (id uuid primary key default gen_random_uuid(), funnel_id uuid references funnels(id) on delete cascade,
    title text not null, content text not null default '', order_index integer default 0, updated_at timestamptz default now());
  ${fs.readFileSync('supabase/migrations/20261101000100_funnel_master_templates.sql', 'utf8')}
  ${fs.readFileSync('supabase/migrations/20261101000200_crm_lead_notes_access.sql', 'utf8')}
  ${fs.readFileSync('supabase/migrations/20261101000300_campaign_master_templates.sql', 'utf8')}
  insert into workspaces(id,name) values ('${WA}','Admin'),('${WB}','Builder B'),('${WC}','Builder C');
  insert into workspace_members(workspace_id,user_id,role,status) values ('${WA}','${ADMIN}','owner','active'),('${WB}','${B}','owner','active'),('${WC}','${C}','owner','active');
`;
const mock = await startMockSupabase({ port: 54420, seedSql: schema });
const db = createClient(mock.url, 'service-test', { auth: { persistSession: false } });
setFunnelTemplateDb(db);
setLandingDb(db);
const call = async (user, workspaceId, { method = 'GET', query = {}, body = {}, memberRole = 'owner' } = {}) => {
  const result = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; }, setHeader() {} };
  await handler({ user: { id: user, email: `${user[0]}@builder.test` }, workspaceId, memberRole, method, query, body }, result);
  return result;
};
const step = async (name, run) => { await run(); console.log(`PASS ${name}`); };
const copy = async (user, workspace, templateId, requestId = randomUUID()) => {
  const result = await call(user, workspace, { method: 'POST', body: { action: 'clone', templateId, requestId, name: 'Subscriber campaign', user_id: ADMIN, workspace_id: WA } });
  assert.equal(result.statusCode, 201, JSON.stringify(result.body));
  return result.body;
};
let templateId;
try {
  await mock.pg.exec(fs.readFileSync('supabase/migrations/20261101000300_campaign_master_templates.sql', 'utf8'));
  const brief = { campaignName: 'JSON campaign original', businessName: 'Original business', objective: 'enquiries', offering: 'Custom designs', audience: 'Families', serviceArea: 'Queensland', email: 'master@example.test' };
  const document = composeDocument(brief).document;
  document.sections.find((section) => section.type === 'hero').props.primaryCta.href = '/lp/template-second-page#enquire';
  await mock.pg.query("insert into landing_campaigns(id,workspace_id,created_by,name,status,brief) values ($1,$2,$3,$4,'active',$5)", [sourceId, WA, ADMIN, brief.campaignName, JSON.stringify(brief)]);
  for (const [slug, title] of [['template-first-page', 'First page'], ['template-second-page', 'Second page']]) {
    await mock.pg.query("insert into landing_pages(workspace_id,campaign_id,created_by,title,slug,document) values ($1,$2,$3,$4,$5,$6)", [WA, sourceId, ADMIN, title, slug, JSON.stringify(document)]);
  }
  const sourceBefore = (await mock.pg.query('select * from landing_campaigns where id=$1', [sourceId])).rows;
  const pagesBefore = (await mock.pg.query('select * from landing_pages where campaign_id=$1 order by created_at,id', [sourceId])).rows;
  await step('admin snapshot preserves every original campaign/page and is idempotent', async () => {
    const promote = () => call(ADMIN, WA, { method: 'POST', body: { action: 'save_campaign', campaignId: sourceId, description: 'JSON template' } });
    const first = await promote();
    assert.equal(first.statusCode, 200, JSON.stringify(first.body));
    templateId = first.body.template.id;
    assert.equal((await promote()).body.template.id, templateId);
    assert.deepEqual((await mock.pg.query('select * from landing_campaigns where id=$1', [sourceId])).rows, sourceBefore);
    assert.deepEqual((await mock.pg.query('select * from landing_pages where campaign_id=$1 order by created_at,id', [sourceId])).rows, pagesBefore);
  });
  await step('catalogue and JSON preview expose only approved snapshot content, not private source identities', async () => {
    const list = await call(B, WB);
    assert.equal(list.body.templates[0].kind, 'campaign');
    assert.equal(list.body.templates[0].stepCount, 2);
    const preview = await call(B, WB, { query: { id: templateId } });
    assert.equal(preview.body.template.steps.length, 2);
    assert.deepEqual(preview.body.template.steps[0].document, pagesBefore[0].document);
    assert(!JSON.stringify(preview.body).includes(sourceId));
    assert(!JSON.stringify(preview.body).includes(ADMIN));
  });
  let bCopy, cCopy, requestId = randomUUID();
  await step('two builders clone fresh drafts with new versions, no inherited ownership and remapped step links', async () => {
    bCopy = await copy(B, WB, templateId, requestId);
    cCopy = await copy(C, WC, templateId);
    assert.notEqual(bCopy.campaign.id, cCopy.campaign.id);
    for (const [copied, user, workspace] of [[bCopy, B, WB], [cCopy, C, WC]]) {
      assert.equal(copied.pageIds.length, 2);
      const campaign = (await mock.pg.query('select * from landing_campaigns where id=$1', [copied.campaign.id])).rows[0];
      assert.equal(campaign.workspace_id, workspace);
      assert.equal(campaign.created_by, user);
      assert.equal(campaign.status, 'draft');
      assert.equal(campaign.duplicated_from, null);
      assert.equal(campaign.brief.email, `${user[0]}@builder.test`, 'master notification email is replaced by the authenticated subscriber');
      for (const pageId of copied.pageIds) {
        const page = (await mock.pg.query('select * from landing_pages where id=$1', [pageId])).rows[0];
        assert.equal(page.created_by, user);
        assert.equal(page.workspace_id, workspace);
        assert.equal(page.status, 'draft');
        assert.equal(page.published_version_id, null);
        assert.equal(page.document.brand.email, `${user[0]}@builder.test`);
        const second = (await mock.pg.query('select slug from landing_pages where campaign_id=$1 and title=$2', [campaign.id, 'Second page'])).rows[0];
        assert.equal(page.document.sections.find((section) => section.type === 'hero').props.primaryCta.href, `/lp/${second.slug}#enquire`);
        const versions = (await mock.pg.query('select * from landing_page_versions where page_id=$1', [pageId])).rows;
        assert.equal(versions.length, 1);
        assert.equal(versions[0].created_by, user);
      }
    }
  });
  await step('replayed clone request returns the same receipt without duplicate campaigns/pages', async () => {
    assert.deepEqual(await copy(B, WB, templateId, requestId), bCopy);
    assert.equal((await mock.pg.query('select id from landing_pages where campaign_id=$1', [bCopy.campaign.id])).rows.length, 2);
  });
  await step('source promotion, clone RPC and direct RLS access deny other builders and anonymous users', async () => {
    assert.equal((await call(ADMIN, WA, { method: 'POST', memberRole: 'member', body: { action: 'save_campaign', campaignId: sourceId } })).statusCode, 403);
    assert.equal((await call(B, WB, { method: 'POST', body: { action: 'save_campaign', campaignId: sourceId } })).statusCode, 404);
    const privateSourceId = randomUUID();
    const privateDoc = structuredClone(document);
    privateDoc.sections.find((section) => section.type === 'hero').props.image.src = 'https://example.test/storage/v1/object/sign/assets/private.jpg?token=fixture';
    await mock.pg.query("insert into landing_campaigns(id,workspace_id,created_by,name) values ($1,$2,$3,'Private asset campaign')", [privateSourceId, WA, ADMIN]);
    await mock.pg.query("insert into landing_pages(workspace_id,campaign_id,created_by,slug,document) values ($1,$2,$3,'private-template-assets',$4)", [WA, privateSourceId, ADMIN, JSON.stringify(privateDoc)]);
    assert.equal((await call(ADMIN, WA, { method: 'POST', body: { action: 'save_campaign', campaignId: privateSourceId } })).statusCode, 400, 'private signed assets cannot enter the shared catalogue');
    await mock.pg.exec('set role authenticated');
    await mock.pg.query("select set_config('request.jwt.claim.sub',$1,false)", [C]);
    assert.equal((await mock.pg.query('select id from landing_pages where campaign_id=$1', [bCopy.campaign.id])).rows.length, 0);
    await assert.rejects(mock.pg.query('select lp_clone_master_template($1,$2,$3,$4,$5)', [templateId, WB, B, 'forged', randomUUID()]), /permission denied/);
    await mock.pg.exec('reset role; set role anon');
    await assert.rejects(mock.pg.query('select lp_clone_master_template($1,$2,$3,$4,$5)', [templateId, WB, B, 'forged', randomUUID()]), /permission denied/);
    await mock.pg.exec('reset role');
    await assert.rejects(mock.pg.query('select lp_clone_master_template($1,$2,$3,$4,$5)', [templateId, WB, C, 'wrong workspace', randomUUID()]), /Active workspace membership/);
  });
  await step('immutable snapshot and another builder copy do not change when one subscriber edits', async () => {
    await assert.rejects(mock.pg.query("update funnels set template_payload=template_payload || '{\"changed\":true}' where id=$1", [templateId]), /immutable/);
    await mock.pg.query("update landing_pages set document=jsonb_set(document,'{seo,title}','\"Builder edit\"') where id=$1", [bCopy.pageIds[0]]);
    const untouched = (await mock.pg.query('select document from landing_pages where id=$1', [cCopy.pageIds[0]])).rows[0];
    assert.notEqual(untouched.document.seo.title, 'Builder edit');
    assert.deepEqual((await call(C, WC, { query: { id: templateId } })).body.template.steps[0].document, pagesBefore[0].document);
  });
  await step('failed clone transaction leaves no orphan campaign, page or version and permits retry', async () => {
    const before = (await mock.pg.query('select (select count(*) from landing_pages) pages,(select count(*) from landing_page_versions) versions')).rows[0];
    await mock.pg.exec(`create function test_clone_outage() returns trigger language plpgsql as $$ begin raise exception 'simulated clone outage'; end $$;
      create trigger test_clone_outage before insert on landing_page_versions for each row execute function test_clone_outage();`);
    const failedId = randomUUID();
    const failed = await call(B, WB, { method: 'POST', body: { action: 'clone', templateId, name: 'Retry me', requestId: failedId } });
    assert.equal(failed.statusCode, 500);
    assert.equal((await mock.pg.query('select id from landing_campaigns where template_clone_request_id=$1', [failedId])).rows.length, 0);
    assert.deepEqual((await mock.pg.query('select (select count(*) from landing_pages) pages,(select count(*) from landing_page_versions) versions')).rows[0], before);
    await mock.pg.exec('drop trigger test_clone_outage on landing_page_versions; drop function test_clone_outage();');
    await copy(B, WB, templateId, failedId);
  });
  await step('published subscriber copy sends idempotent CRM leads to that builder, never the master owner', async () => {
    const publish = mockRes();
    await pageHandler(mockReq({ method: 'POST', workspaceId: WB, user: { id: B }, query: { id: bCopy.pageIds[0] }, body: { action: 'publish' } }), publish);
    assert.equal(publish.statusCode, 200, JSON.stringify(publish.body));
    const body = {
      pageId: bCopy.pageIds[0], token: signFormToken(bCopy.pageIds[0], Date.now() - 8000), idempotencyKey: randomUUID(),
      consent: true, fields: { name: 'Example Visitor', email: 'visitor@example.test', phone: '0412345678' },
      workspace_id: WA, user_id: ADMIN,
    };
    const result = mockRes();
    await submit(mockReq({ method: 'POST', body }), result);
    assert.equal(result.statusCode, 200, JSON.stringify(result.body));
    const submission = (await mock.pg.query('select * from landing_page_submissions where page_id=$1', [body.pageId])).rows[0];
    assert.equal(submission.status, 'synced');
    const lead = (await mock.pg.query('select * from leads where id=$1', [submission.lead_id])).rows[0];
    assert.equal(lead.workspace_id, WB);
    assert.equal(lead.user_id, B);
    assert.equal((await mock.pg.query('select user_id from lead_notes where lead_id=$1', [lead.id])).rows[0].user_id, B);
    const replay = mockRes();
    await submit(mockReq({ method: 'POST', body }), replay);
    assert.equal(replay.body.duplicate, true);
    assert.equal((await mock.pg.query('select id from lead_notes where lead_id=$1', [lead.id])).rows.length, 1);
    assert.equal((await mock.pg.query('select id from leads where user_id=$1', [ADMIN])).rows.length, 0);
  });
  console.log('8/8 campaign master-template acceptance scenarios passed.');
} finally {
  setFunnelTemplateDb(null);
  setLandingDb(null);
  await mock.close();
}
