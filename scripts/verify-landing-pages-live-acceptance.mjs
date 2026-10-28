// Live (intended-environment) acceptance for Landing Pages and the Funnel Builder.
//
// Runs against an already-started isolated dev server (never port 3000) that uses the real Supabase project.
// A fresh, isolated Chrome profile is opened; the operator signs in once through the app's own login page.
//
//   Phase A  read-only: every existing campaign opens through its campaign page, Preview (desktop + mobile) and the
//            Editor. All Landing Pages write requests are blocked in this phase and revisions are compared before/after.
//   Phase B  TEST workspace only: quick-generate a disposable campaign (no paid imagery), AI edit, accept, save,
//            reopen, preview, publish, visit the public page on desktop + mobile, submit an enquiry, verify the
//            submission, lead and CRM note with campaign attribution, take the page offline, then delete only the
//            records this run created.
//   Phase C  multi-step funnel: wizard -> editor -> publish -> public steps -> unpublish -> delete (own funnel only).
//
// Usage: LP_LIVE_APP=http://localhost:3157 node scripts/verify-landing-pages-live-acceptance.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local', quiet: true });
const APP = process.env.LP_LIVE_APP || 'http://localhost:3157';
assert(!/:3000\b/.test(APP), 'never run acceptance against the shared port 3000 server');
const LIVE_WORKSPACE = process.env.LP_LIVE_WORKSPACE || '846885cd-25b9-4eca-b9f9-3fd02f5882d8';
const TEST_WORKSPACE = process.env.LP_TEST_WORKSPACE || 'cf7e4d2d-2faa-467c-869b-7275db18de39';
const PROFILE = path.resolve(process.env.LP_LIVE_PROFILE || '.lp-live-profile-claude');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUT = path.resolve('artifacts', `landing-pages-live-acceptance-${STAMP}`);
fs.mkdirSync(OUT, { recursive: true });
const ONLY = new Set(String(process.env.LP_LIVE_PHASES || 'A,B,C').split(','));

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
const must = (r) => { if (r.error) throw new Error(r.error.message); return r.data; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const created = { campaignId: null, pageId: null, submissionIds: [], leadIds: [], funnelId: null };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const step = async (name, fn) => {
  const started = Date.now();
  try { const detail = await fn(); results.push({ name, ok: true, ms: Date.now() - started, detail }); log('PASS', name); }
  catch (error) { results.push({ name, ok: false, ms: Date.now() - started, error: String(error?.stack || error).slice(0, 2000) }); log('FAIL', name, error?.message); }
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ app: APP, results, created }, null, 2));
};
const shot = (page, name, opts = {}) => page.screenshot({ path: path.join(OUT, `${name}.png`), ...opts }).catch(() => {});

const browser = await puppeteer.launch({
  headless: false,
  userDataDir: PROFILE,
  defaultViewport: null,
  args: ['--window-size=1440,1000', '--no-first-run', '--no-default-browser-check'],
  protocolTimeout: 600_000,
});
const page = (await browser.pages())[0] || await browser.newPage();
page.setDefaultTimeout(240_000);
page.setDefaultNavigationTimeout(300_000);
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(`${page.url()} :: ${e.message}`));

// ---- sign-in ----------------------------------------------------------------------------------------------------
const sessionUser = async () => page.evaluate(() => {
  const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
  try { const s = key && JSON.parse(localStorage.getItem(key)); return s?.user?.id ? { id: s.user.id, email: s.user.email, token: s.access_token } : null; } catch { return null; }
}).catch(() => null);
await page.goto(`${APP}/login`, { waitUntil: 'domcontentloaded' });
let user = await sessionUser();
if (!user) {
  log(`SIGN-IN REQUIRED: sign in through the isolated browser window now (${APP}/login). Waiting up to 45 minutes.`);
  fs.writeFileSync(path.join(OUT, 'WAITING-FOR-SIGN-IN.txt'), `Sign in at ${APP}/login in the isolated browser window.\n`);
  const deadline = Date.now() + 45 * 60_000;
  while (!user && Date.now() < deadline) { await sleep(3000); user = await sessionUser(); }
}
assert(user, 'no authenticated session was established');
log('signed in as user', user.id);
const memberships = must(await db.from('workspace_members').select('workspace_id, role, status').eq('user_id', user.id));
const owned = must(await db.from('workspaces').select('id').eq('owner_id', user.id)).map((w) => w.id);
const canUse = (ws) => owned.includes(ws) || memberships.some((m) => m.workspace_id === ws);
results.push({ name: 'session', ok: true, detail: { userId: user.id, liveWorkspaceAccess: canUse(LIVE_WORKSPACE), testWorkspaceAccess: canUse(TEST_WORKSPACE) } });

const useWorkspace = async (ws) => {
  await page.evaluate((id) => localStorage.setItem('active_workspace_id', id), ws);
};
const waitText = (re, timeout = 240_000) => page.waitForFunction((src) => new RegExp(src, 'i').test(document.body.innerText), { timeout }, re.source);

// ---- Phase A: existing campaigns, read-only ---------------------------------------------------------------------
if (ONLY.has('A')) {
  const campaigns = must(await db.from('landing_campaigns').select('id, name, status').eq('workspace_id', LIVE_WORKSPACE).order('created_at'));
  const pagesBefore = must(await db.from('landing_pages').select('id, campaign_id, slug, status, revision, updated_at').eq('workspace_id', LIVE_WORKSPACE));
  const blockedWrites = [];
  await page.setRequestInterception(true);
  const guard = (req) => {
    const u = req.url();
    if (/\/api\/landing-pages\//.test(u) && !['GET', 'HEAD', 'OPTIONS'].includes(req.method())) { blockedWrites.push(`${req.method()} ${u}`); return req.abort(); }
    return req.continue();
  };
  page.on('request', guard);
  await useWorkspace(LIVE_WORKSPACE);
  for (const [i, c] of campaigns.entries()) {
    const p = pagesBefore.find((x) => x.campaign_id === c.id);
    const tag = `A${String(i + 1).padStart(2, '0')}`;
    await step(`${tag} campaign "${c.name.slice(0, 60)}" (${c.status}) opens: campaign page, Preview desktop/mobile, Editor`, async () => {
      const errorsBefore = pageErrors.length;
      await page.setViewport({ width: 1440, height: 1000 });
      await page.goto(`${APP}/modules/landing-pages/${c.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction((name) => document.querySelector('h1')?.innerText?.trim() === name.trim(), { timeout: 240_000 }, c.name);
      await shot(page, `${tag}-campaign`);
      if (!p) return { page: null };
      for (const [vp, size] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
        await page.setViewport(size);
        await page.goto(`${APP}/modules/landing-pages/preview/${p.id}`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.lp-root section, .lp-root [class*="lp-s-"]', { timeout: 240_000 });
        await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
        await sleep(1200);
        const metrics = await page.evaluate(() => ({
          sections: document.querySelectorAll('.lp-root [class*="lp-s-"]').length,
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          brokenImages: [...document.querySelectorAll('.lp-root img')].filter((im) => !(im.complete && im.naturalWidth > 0)).map((im) => im.src.slice(0, 120)),
          h1: document.querySelector('.lp-root h1')?.innerText?.slice(0, 120) || null,
        }));
        assert(metrics.sections > 0, `${vp} preview renders sections`);
        assert(metrics.overflow <= 1, `${vp} preview has no horizontal overflow (${metrics.overflow}px)`);
        assert.deepEqual(metrics.brokenImages, [], `${vp} preview images load`);
        await shot(page, `${tag}-preview-${vp}`);
        await shot(page, `${tag}-preview-${vp}-full`, { fullPage: true });
      }
      await page.setViewport({ width: 1440, height: 1000 });
      await page.goto(`${APP}/modules/landing-pages/editor/${p.id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-testid="canvas"] .lp-root', { timeout: 240_000 });
      await sleep(1500);
      const saveState = await page.$eval('[data-testid="save-state"]', (e) => e.innerText).catch(() => '');
      assert(/^Saved/.test(saveState), `editor opens clean, not "${saveState}"`);
      await shot(page, `${tag}-editor-desktop`);
      const mobileBtn = await page.$$('button[aria-pressed]');
      for (const b of mobileBtn) if ((await b.evaluate((e) => e.innerText.trim())) === 'Mobile') { await b.click(); break; }
      await sleep(800);
      await shot(page, `${tag}-editor-mobile`);
      const newErrors = pageErrors.slice(errorsBefore);
      assert.deepEqual(newErrors, [], 'no page errors');
      return { pageId: p.id, slug: p.slug, status: p.status, revision: p.revision };
    });
  }
  page.off('request', guard);
  await page.setRequestInterception(false);
  await step('A99 existing campaigns unchanged and no write was attempted', async () => {
    const pagesAfter = must(await db.from('landing_pages').select('id, revision, updated_at, status').eq('workspace_id', LIVE_WORKSPACE));
    const changed = pagesBefore.filter((b) => { const a = pagesAfter.find((x) => x.id === b.id); return !a || a.revision !== b.revision || a.updated_at !== b.updated_at || a.status !== b.status; });
    assert.deepEqual(changed.map((x) => x.id), [], 'no existing page changed');
    assert.deepEqual(blockedWrites, [], 'opening campaigns attempted no writes');
    return { campaigns: campaigns.length, pages: pagesBefore.length };
  });
}

// ---- Phase B: disposable landing page in the TEST workspace -----------------------------------------------------
const TEST_EMAIL = `lp-acceptance+${STAMP.slice(0, 19).replace(/[^0-9]/g, '')}@example.org`;
if (ONLY.has('B')) {
  assert(canUse(TEST_WORKSPACE), 'signed-in user has no access to the TEST workspace');
  await page.setViewport({ width: 1440, height: 1000 });
  await useWorkspace(TEST_WORKSPACE);
  let publicUrl = null; let acceptedHeadline = null;
  const waitSaved = () => page.waitForFunction(() => /^Saved/.test(document.querySelector('[data-testid="save-state"]')?.innerText || ''), { timeout: 120_000 });

  await step('B1 quick-generate a disposable campaign in the TEST workspace (no paid imagery)', async () => {
    await page.goto(`${APP}/modules/landing-pages`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('textarea[aria-label="Quick Generate or Advanced Brief"]');
    const imageBox = await page.$('label input[type=checkbox]');
    if (imageBox && await imageBox.evaluate((e) => e.checked && /campaign imagery/i.test(e.closest('label').innerText))) await imageBox.click();
    assert.equal(await page.$eval('label input[type=checkbox]', (e) => e.checked), false, 'AI imagery is off');
    await page.type('textarea[aria-label="Quick Generate or Advanced Brief"]', `TEST ${STAMP.slice(0, 16)}: Ridgeline Decks, a Brisbane deck and pergola builder offering a free on-site design consultation for homeowners planning outdoor living areas this summer. Contact: Sam Taylor, 07 3000 0000, ${TEST_EMAIL}.`);
    const genResponse = page.waitForResponse((r) => /\/api\/landing-pages\/campaigns\/[0-9a-f-]{36}$/.test(r.url()) && r.request().method() === 'POST' && /"generate"/.test(r.request().postData() || ''), { timeout: 300_000 });
    const createResponse = page.waitForResponse((r) => r.url().endsWith('/api/landing-pages/campaigns') && r.request().method() === 'POST', { timeout: 120_000 });
    const buttons = await page.$$('button[type=submit]');
    for (const b of buttons) if (/Generate draft/.test(await b.evaluate((e) => e.innerText))) { await b.click(); break; }
    const createdBody = await (await createResponse).json();
    created.campaignId = createdBody.campaign?.id;
    assert(created.campaignId, `campaign created: ${JSON.stringify(createdBody).slice(0, 300)}`);
    const gen = await genResponse;
    const body = await gen.json();
    assert.equal(gen.status(), 200, `generation: ${JSON.stringify(body).slice(0, 500)}`);
    created.pageId = body.pageId;
    await page.waitForFunction((id) => location.pathname === `/modules/landing-pages/editor/${id}`, { timeout: 240_000 }, created.pageId);
    await page.waitForSelector('[data-testid="canvas"] .lp-root .lp-s-hero h1', { timeout: 240_000 });
    const camp = must(await db.from('landing_campaigns').select('workspace_id').eq('id', created.campaignId).single());
    assert.equal(camp.workspace_id, TEST_WORKSPACE, 'campaign was created in the TEST workspace');
    await shot(page, 'B1-generated-editor');
    return { campaignId: created.campaignId, pageId: created.pageId, usedAi: body.usedAi, aiStatus: body.aiStatus, imagery: body.imagery ? { generated: body.imagery.generatedRequestCount } : null };
  });

  await step('B2 AI assistant edit is proposed, previewed and accepted', async () => {
    await page.click('[data-testid="tab-ai"]');
    await page.waitForSelector('[data-testid="ai-input"]');
    const resp = page.waitForResponse((r) => r.url().includes(`/api/landing-pages/pages/${created.pageId}`) && r.request().method() === 'POST' && /"assistant"/.test(r.request().postData() || ''), { timeout: 240_000 });
    await page.type('[data-testid="ai-input"]', 'Make only the hero headline more specific to Brisbane homeowners planning a new deck this summer. Do not change images, the form, the theme or any other section.');
    await page.keyboard.press('Enter');
    const proposed = await (await resp).json();
    await page.waitForSelector('[data-testid="ai-proposal"]', { timeout: 120_000 });
    acceptedHeadline = proposed.proposal?.document?.sections?.find((s) => s.type === 'hero')?.props?.headline;
    assert(acceptedHeadline, `assistant proposal: ${JSON.stringify(proposed).slice(0, 400)}`);
    await shot(page, 'B2-ai-proposal');
    await page.click('[data-testid="ai-accept"]');
    await waitSaved();
    return { source: proposed.source, outcome: proposed.ai?.outcome, headline: acceptedHeadline };
  });

  await step('B3 save, reload and reopen keep the accepted edit', async () => {
    await page.click('[data-testid="save"]');
    await waitSaved();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="canvas"] .lp-s-hero h1');
    assert.equal((await page.$eval('[data-testid="canvas"] .lp-s-hero h1', (e) => e.innerText)).trim(), acceptedHeadline.trim());
    await page.goto(`${APP}/modules/landing-pages/${created.campaignId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1');
    await page.goto(`${APP}/modules/landing-pages/editor/${created.pageId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="canvas"] .lp-s-hero h1');
    assert.equal((await page.$eval('[data-testid="canvas"] .lp-s-hero h1', (e) => e.innerText)).trim(), acceptedHeadline.trim());
    const stored = must(await db.from('landing_pages').select('document, revision').eq('id', created.pageId).single());
    assert.equal(stored.document.sections.find((s) => s.type === 'hero').props.headline, acceptedHeadline, 'database holds the accepted headline');
    return { revision: stored.revision };
  });

  await step('B4 Preview renders on desktop and mobile', async () => {
    for (const [vp, size] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
      await page.setViewport(size);
      await page.goto(`${APP}/modules/landing-pages/preview/${created.pageId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.lp-root .lp-s-hero h1');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert(overflow <= 1, `${vp} overflow ${overflow}`);
      await shot(page, `B4-preview-${vp}`, { fullPage: true });
    }
    await page.setViewport({ width: 1440, height: 1000 });
  });

  await step('B5 publish the disposable page', async () => {
    await page.goto(`${APP}/modules/landing-pages/editor/${created.pageId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="publish-open"]');
    await page.click('[data-testid="publish-open"]');
    await page.waitForSelector('[data-testid="publish-confirm"]:not([disabled])', { timeout: 60_000 });
    await page.click('[data-testid="publish-confirm"]');
    await page.waitForSelector('[data-testid="public-url"]', { timeout: 120_000 });
    publicUrl = (await page.$eval('[data-testid="public-url"]', (e) => e.innerText)).trim();
    await shot(page, 'B5-published');
    const p = must(await db.from('landing_pages').select('status, slug').eq('id', created.pageId).single());
    assert.equal(p.status, 'published');
    return { publicUrl, slug: p.slug };
  });

  const visitorContext = await browser.createBrowserContext();
  const visitor = await visitorContext.newPage();
  visitor.setDefaultTimeout(240_000); visitor.setDefaultNavigationTimeout(300_000);
  const localPublic = () => `${APP}/lp/${new URL(publicUrl).pathname.split('/').pop()}`;

  await step('B6 public page renders for an anonymous visitor on desktop and mobile', async () => {
    for (const [vp, size] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
      await visitor.setViewport(size);
      const res = await visitor.goto(`${localPublic()}?utm_source=acceptance&utm_medium=test&utm_campaign=lp-live-acceptance`, { waitUntil: 'networkidle2' });
      assert.equal(res.status(), 200);
      assert.equal((await visitor.$eval('.lp-s-hero h1', (e) => e.innerText)).trim(), acceptedHeadline.trim());
      const overflow = await visitor.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert(overflow <= 1, `${vp} overflow ${overflow}`);
      assert.equal(await visitor.$('.lp-editable'), null, 'no editor affordances on the public page');
      await shot(visitor, `B6-public-${vp}`, { fullPage: true });
    }
    return { url: localPublic(), configuredPublicUrl: publicUrl };
  });

  await step('B7 anonymous enquiry is accepted', async () => {
    await visitor.setViewport({ width: 1440, height: 1000 });
    await visitor.goto(`${localPublic()}?utm_source=acceptance&utm_medium=test&utm_campaign=lp-live-acceptance`, { waitUntil: 'networkidle2' });
    await visitor.waitForSelector('.lp-form');
    await visitor.$eval('.lp-form', (e) => e.scrollIntoView());
    const fill = async (sel, value) => { if (await visitor.$(sel)) await visitor.type(sel, value); };
    await fill('#lpf-name', 'Acceptance Tester');
    await fill('#lpf-email', TEST_EMAIL);
    await fill('#lpf-phone', '0400 000 000');
    await fill('#lpf-business', 'Acceptance Test Pty Ltd');
    await fill('#lpf-business_name', 'Acceptance Test Pty Ltd');
    await fill('#lpf-suburb', 'Paddington');
    await fill('#lpf-message', 'Automated acceptance test enquiry. Please ignore; it is deleted after verification.');
    for (const sel of await visitor.$$('.lp-form select')) {
      const value = await sel.evaluate((s) => [...s.options].find((o) => o.value)?.value || '');
      if (value) await sel.select(value);
    }
    for (const box of await visitor.$$('.lp-form .lp-consent input, .lp-form input[type=checkbox][required]')) if (!(await box.evaluate((e) => e.checked))) await box.click();
    await sleep(3500);
    const submitResp = visitor.waitForResponse((r) => r.url().includes('/api/landing-pages/submit'), { timeout: 120_000 });
    await visitor.click('.lp-form button[type=submit]');
    const sr = await submitResp;
    const sb = await sr.json().catch(() => ({}));
    assert.equal(sr.status(), 200, `submit: ${JSON.stringify(sb).slice(0, 300)}`);
    await visitor.waitForSelector('.lp-thanks', { timeout: 60_000 });
    await shot(visitor, 'B7-thank-you');
    return { response: sb };
  });

  await step('B8 enquiry reaches the TEST workspace Leads/CRM with campaign attribution', async () => {
    let sub = null;
    for (let i = 0; i < 20 && !(sub && sub.status === 'synced'); i++) {
      sub = must(await db.from('landing_page_submissions').select('*').eq('page_id', created.pageId).order('created_at', { ascending: false }).limit(1)).at(0) || null;
      if (!(sub && sub.status === 'synced')) await sleep(1500);
    }
    assert(sub, 'submission stored');
    created.submissionIds.push(sub.id);
    assert.equal(sub.status, 'synced', `submission synced (status ${sub.status}, error ${sub.last_error || ''})`);
    assert.equal(sub.workspace_id, TEST_WORKSPACE);
    assert.equal(sub.campaign_id, created.campaignId);
    assert.equal(sub.attribution?.utm_campaign, 'lp-live-acceptance');
    const lead = must(await db.from('leads').select('id, workspace_id, email, name, lead_source, source, tags, created_at').eq('id', sub.lead_id).single());
    created.leadIds.push(lead.id);
    assert.equal(lead.workspace_id, TEST_WORKSPACE, 'lead is in the TEST workspace');
    assert.equal(lead.email, TEST_EMAIL.toLowerCase());
    const campaign = must(await db.from('landing_campaigns').select('name').eq('id', created.campaignId).single());
    assert.match(String(lead.lead_source || ''), /Landing Page/i);
    const notes = must(await db.from('lead_notes').select('id, note').eq('lead_id', lead.id));
    assert(notes.some((n) => n.note.includes(created.campaignId) && n.note.includes('lp-live-acceptance')), 'CRM note carries the campaign id and UTM attribution');
    await page.goto(`${APP}/leads?lead=${lead.id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction((email) => document.body.innerText.toLowerCase().includes(email), { timeout: 240_000 }, TEST_EMAIL.toLowerCase());
    await sleep(1500);
    await shot(page, 'B8-crm-lead');
    return { submissionId: sub.id, leadId: lead.id, leadSource: lead.lead_source, tags: lead.tags, campaign: campaign.name, notes: notes.length };
  });

  await step('B9 take the page offline; the public URL stops serving it', async () => {
    await page.goto(`${APP}/modules/landing-pages/editor/${created.pageId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="publish-open"]');
    await page.click('[data-testid="publish-open"]');
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.innerText.trim() === 'Take offline'), { timeout: 60_000 });
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Take offline').click());
    for (let i = 0; i < 20; i++) { const p = must(await db.from('landing_pages').select('status').eq('id', created.pageId).single()); if (p.status !== 'published') break; await sleep(1000); }
    const p = must(await db.from('landing_pages').select('status').eq('id', created.pageId).single());
    assert.notEqual(p.status, 'published');
    const res = await visitor.goto(localPublic(), { waitUntil: 'domcontentloaded' });
    assert.equal(res.status(), 404, 'offline page is not served');
    return { status: p.status };
  });
  await visitorContext.close();
}

// ---- Phase C: multi-step funnel ---------------------------------------------------------------------------------
if (ONLY.has('C')) {
  await page.setViewport({ width: 1440, height: 1000 });
  await useWorkspace(TEST_WORKSPACE);
  const FUNNEL_NAME = `TEST funnel acceptance ${STAMP.slice(0, 16)}`;
  let slug = null;
  const api = (body) => page.evaluate(async ({ body, ws }) => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
    const token = JSON.parse(localStorage.getItem(key)).access_token;
    const r = await fetch('/api/funnels/manage', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-workspace-id': ws }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }, { body, ws: TEST_WORKSPACE });

  await step('C1 Funnel Builder creates a multi-step funnel through the wizard', async () => {
    await page.goto(`${APP}/modules/funnels`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="create-multi-step-funnel"]');
    await shot(page, 'C1-funnel-dashboard');
    await page.click('[data-testid="create-multi-step-funnel"]');
    await page.waitForFunction(() => location.pathname === '/modules/funnels/new', { timeout: 120_000 });
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /^View (Short|Long)$/.test(b.innerText.trim())), { timeout: 240_000 });
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /^View (Short|Long)$/.test(b.innerText.trim())).click());
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /^Use /.test(b.innerText.trim())), { timeout: 60_000 });
    await shot(page, 'C1-template-preview');
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /^Use /.test(b.innerText.trim())).click());
    await page.waitForSelector('input[placeholder^="e.g. CitrusBurn"]');
    await page.type('input[placeholder^="e.g. CitrusBurn"]', FUNNEL_NAME);
    await page.type('input[placeholder^="e.g. women over 40"]', 'Brisbane homeowners planning a new deck');
    await page.type('input[placeholder^="e.g. lose stubborn"]', 'a finished deck designed for their backyard');
    const createResp = page.waitForResponse((r) => r.url().includes('/api/funnels/create-with-pages'), { timeout: 300_000 });
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /Build My Funnel/.test(b.innerText)).click());
    const cr = await createResp;
    const cb = await cr.json().catch(() => ({}));
    assert(cb.ok && cb.funnelId, `create-with-pages: ${cr.status()} ${JSON.stringify(cb).slice(0, 300)}`);
    created.funnelId = cb.funnelId;
    await page.waitForFunction((id) => location.pathname === `/modules/funnels/edit/${id}`, { timeout: 240_000 }, cb.funnelId);
    await sleep(8000);
    await shot(page, 'C1-funnel-editor');
    const steps = must(await db.from('funnel_steps').select('id, title, order_index').eq('funnel_id', cb.funnelId).order('order_index'));
    assert(steps.length >= 2, `multi-step funnel has ${steps.length} steps`);
    return { funnelId: cb.funnelId, steps: steps.map((s) => s.title) };
  });

  await step('C2 funnel publishes and every public step renders; then unpublishes', async () => {
    const pub = await api({ action: 'publish', id: created.funnelId });
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    const f = must(await db.from('funnels').select('slug, status').eq('id', created.funnelId).single());
    slug = f.slug; assert.equal(f.status, 'published');
    const steps = must(await db.from('funnel_steps').select('id').eq('funnel_id', created.funnelId));
    const ctx = await browser.createBrowserContext();
    const v = await ctx.newPage();
    for (let i = 1; i <= steps.length; i++) {
      for (const [vp, size] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
        await v.setViewport(size);
        await v.goto(`${APP}/p/${slug}?step=${i}`, { waitUntil: 'networkidle2', timeout: 300_000 });
        await v.waitForFunction(() => document.body.innerText.trim().length > 200 || document.querySelector('iframe'), { timeout: 120_000 });
        assert(!/not found|unavailable/i.test(await v.evaluate(() => document.body.innerText.slice(0, 400))), `step ${i} renders`);
        await shot(v, `C2-public-step${i}-${vp}`, { fullPage: true });
      }
    }
    await ctx.close();
    const un = await api({ action: 'unpublish', id: created.funnelId });
    assert.equal(un.status, 200, JSON.stringify(un.body));
    return { slug, steps: steps.length };
  });
}

// ---- cleanup: only records created by this run ------------------------------------------------------------------
await step('Z cleanup of this run\'s own test records', async () => {
  const done = [];
  if (created.funnelId) {
    const f = must(await db.from('funnels').select('name').eq('id', created.funnelId).maybeSingle());
    if (f) {
      const r = await page.evaluate(async ({ id, name, ws }) => {
        const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
        const token = JSON.parse(localStorage.getItem(key)).access_token;
        const res = await fetch('/api/funnels/manage', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-workspace-id': ws }, body: JSON.stringify({ action: 'delete', id, confirmName: name }) });
        return res.status;
      }, { id: created.funnelId, name: f.name, ws: TEST_WORKSPACE });
      assert.equal(r, 200, 'funnel deleted through the product');
      done.push('funnel');
    }
  }
  for (const leadId of created.leadIds) {
    const lead = must(await db.from('leads').select('id, email, workspace_id').eq('id', leadId).single());
    assert.equal(lead.email, TEST_EMAIL.toLowerCase()); assert.equal(lead.workspace_id, TEST_WORKSPACE);
    must(await db.from('landing_page_submissions').update({ lead_id: null }).eq('lead_id', leadId).eq('workspace_id', TEST_WORKSPACE).select('id'));
    must(await db.from('lead_notes').delete().eq('lead_id', leadId).select('id'));
    must(await db.from('leads').delete().eq('id', leadId).eq('workspace_id', TEST_WORKSPACE).select('id'));
    done.push(`lead ${leadId}`);
  }
  if (created.campaignId) {
    const c = must(await db.from('landing_campaigns').select('workspace_id').eq('id', created.campaignId).single());
    assert.equal(c.workspace_id, TEST_WORKSPACE, 'only TEST workspace data is cleaned up');
    if (created.pageId) must(await db.from('landing_pages').update({ published_version_id: null }).eq('id', created.pageId).select('id'));
    for (const table of ['landing_page_submissions', 'landing_page_events']) must(await db.from(table).delete().eq('campaign_id', created.campaignId).eq('workspace_id', TEST_WORKSPACE).select('id'));
    if (created.pageId) must(await db.from('landing_page_versions').delete().eq('page_id', created.pageId).select('id'));
    must(await db.from('landing_pages').delete().eq('campaign_id', created.campaignId).eq('workspace_id', TEST_WORKSPACE).select('id'));
    must(await db.from('landing_campaigns').delete().eq('id', created.campaignId).eq('workspace_id', TEST_WORKSPACE).select('id'));
    must(await db.from('landing_audit_log').delete().in('entity_id', [created.campaignId, created.pageId].filter(Boolean)).eq('workspace_id', TEST_WORKSPACE).select('id'));
    done.push('campaign, page, versions, submissions, events, audit');
  }
  return done;
});

fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ app: APP, results, created, pageErrors }, null, 2));
const failed = results.filter((r) => !r.ok);
log(`${results.length - failed.length}/${results.length} passed. Evidence: ${OUT}`);
await browser.close();
process.exitCode = failed.length ? 1 : 0;
