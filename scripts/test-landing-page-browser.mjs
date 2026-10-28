// Browser acceptance test for Landing Pages: "Build Your Dream Home in 2027" for a fictional builder.
//
// Starts an isolated stack — a mock Supabase backed by PGlite (scripts/lib/mock-supabase-server.mjs) and a separate
// Next dev server on its own port and build directory — then drives the real app in Chrome: create campaign, AI
// interview, generate, manual edit, AI edit, image replace, save/reload, publish, public page on desktop and mobile,
// enquiry, Leads/CRM, attribution, republish. Supabase and SendGrid remain isolated. OpenAI is real only with LP_E2E_REAL_AI=1.
//
// Run: node scripts/test-landing-page-browser.mjs   (screenshots go to artifacts/landing-pages-e2e/)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import net from 'node:net';
import sharp from 'sharp';
import { startMockSupabase } from './lib/mock-supabase-server.mjs';
import { slugify } from '../lib/landing-pages/pageModel.js';

const REAL_AI = process.env.LP_E2E_REAL_AI === '1';
const FIXTURES = process.env.LP_E2E_FIXTURES === '1';
assert(!(REAL_AI && FIXTURES), 'Choose either real-AI acceptance or deterministic fixtures, not both.');
if (REAL_AI) {
  dotenv.config({ path: '.env.local', quiet: true });
  assert(process.env.OPENAI_API_KEY, 'Real AI testing requires a configured OPENAI_API_KEY');
}
const APP_PORT = Number(process.env.LP_E2E_PORT || (REAL_AI ? 3117 : 3107));
const MOCK_PORT = Number(process.env.LP_E2E_DB_PORT || (REAL_AI ? 54409 : 54399));
const APP = `http://localhost:${APP_PORT}`;
const OUT = process.env.LP_E2E_OUT || `artifacts/landing-pages-e2e/${REAL_AI ? 'real-ai' : FIXTURES ? 'fixtures' : 'regression'}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
fs.mkdirSync(OUT, { recursive: true });
const BUSINESS = REAL_AI ? 'Example Residential Builders' : 'Harbourline Homes';
const aiEvidence = [];
const imageEvidence = [];
const rawSpellingInput = 'Architect-designed plans and weekly site updats';
let acceptedHeadline = 'Build the family home you have been planning, in 2027';
let rawBriefOffering = '';
let primaryDocument = null;

const U = { id: 'a0000000-0000-4000-8000-0000000000e1', email: 'owner@harbourline.test', password: 'e2e-password' };
const UB = { id: 'b0000000-0000-4000-8000-0000000000e2', email: 'owner@otherbuilder.test', password: 'e2e-password' };
const WA = 'aaaaaaaa-0000-4000-8000-0000000000e1', WB = 'bbbbbbbb-0000-4000-8000-0000000000e2';
const seedSql = `
  insert into auth.users values ('${U.id}','${U.email}','${U.password}'),('${UB.id}','${UB.email}','${UB.password}');
  insert into accounts (user_id, email, business_name, full_name, is_approved, approved, status, subscription_status, onboarding_completed, phone_verified) values
    ('${U.id}','${U.email}','${BUSINESS}','Alex Harbour',true,true,'active','active',true,true),('${UB.id}','${UB.email}','Other Builder Co','Sam Other',true,true,'active','active',true,true);
  insert into workspaces (id, name, slug, owner_id) values ('${WA}','${BUSINESS}','harbourline','${U.id}'),('${WB}','Other Builder Co','other','${UB.id}');
  insert into workspace_members (workspace_id, user_id, role, status) values ('${WA}','${U.id}','owner','active'),('${WB}','${UB.id}','owner','active');
  insert into leads (id, user_id, workspace_id, name, email, phone, source, lead_source, tags, lead_status) values
    ('11111111-0000-4000-8000-0000000000e1','${U.id}','${WA}','Existing Client','existing.client@example.org','0400 000 001','Referral','Referral','vip','won'),
    ('11111111-0000-4000-8000-0000000000e2','${UB.id}','${WB}','Other Tenant Lead','jordan.rivers@example.org',null,'Manual','Manual',null,'new');
  insert into landing_campaigns (id, workspace_id, created_by, name, status, brief) values ('cccccccc-0000-4000-8000-0000000000e2','${WB}','${UB.id}','Other builder campaign','active','{"businessName":"Other Builder Co"}');
`;

const results = [];
const step = async (name, fn) => {
  const t = Date.now();
  try { await fn(); results.push({ name, ok: true, ms: Date.now() - t }); console.log(`PASS ${name} (${Math.round((Date.now() - t) / 1000)}s)`); }
  catch (e) {
    results.push({ name, ok: false, error: e.message }); console.log(`FAIL ${name}: ${e.message}`);
    for (const [i, p] of (await browser?.pages().catch(() => []) || []).entries()) { try { await p.screenshot({ path: path.join(OUT, `failure-${i}.png`) }); console.log(`  page ${i}: ${p.url()} :: ${(await p.evaluate(() => document.body.innerText.slice(0, 600))).replace(/\s*\n\s*/g, ' | ')}`); } catch { /* ignore */ } }
    throw e;
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const capture = async (page, options, { minEntropy = 2 } = {}) => {
  await page.bringToFront();
  await page.evaluate(async () => { await document.fonts.ready; await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  const image = await page.screenshot(options);
  const stats = await sharp(image).stats();
  assert(stats.entropy > minEntropy, `Screenshot lacks rendered content: ${options.path} (entropy ${stats.entropy})`);
};
const withoutHeroImage = (document) => {
  const copy = JSON.parse(JSON.stringify(document));
  const hero = copy.sections.find((section) => section.type === 'hero');
  if (hero) hero.props.image = { src: '', alt: '' };
  if (copy.seo) copy.seo.ogImage = '';
  return copy;
};
const visualSignature = (document) => JSON.stringify({
  theme: [document.theme.preset, document.theme.fonts, document.theme.palette.accent, document.theme.radius],
  hero: [document.sections.find((section) => section.type === 'hero')?.variant, !!document.sections.find((section) => section.type === 'hero')?.props.image.src],
  sections: document.sections.map((section) => [section.type, section.variant, section.style.background, section.style.align]),
});

let mock, next, browser;
let fontFallbackStylesheets = 0;
async function cleanup() {
  try { await browser?.close(); } catch { /* ignore */ }
  try { if (next && !next.killed) { if (process.platform === 'win32') spawn('taskkill', ['/pid', String(next.pid), '/T', '/F']); else next.kill('SIGTERM'); } } catch { /* ignore */ }
  try { await mock?.close(); } catch { /* ignore */ }
}

async function waitForHttp(url, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.status < 500) return r.status; } catch { /* not up */ }
    await sleep(1500);
  }
  throw new Error(`timed out waiting for ${url}`);
}

try {
  for (const port of [APP_PORT, MOCK_PORT]) {
    await new Promise((resolve, reject) => {
      const probe = net.createServer();
      probe.once('error', reject);
      probe.listen(port, () => probe.close(resolve));
    });
  }
  mock = await startMockSupabase({ port: MOCK_PORT, seedSql });
  const leadsBefore = (await mock.pg.query('select * from leads order by id')).rows;

  const env = {
    ...process.env,
    NEXT_DIST_DIR: process.env.LP_E2E_DIST_DIR || (REAL_AI ? '.next-landing-pages-real-ai' : '.next-landing-pages-regression'), PORT: String(APP_PORT), NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_SUPABASE_URL: mock.url, SUPABASE_URL: mock.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-e2e', SUPABASE_SERVICE_ROLE_KEY: 'service-e2e', SUPABASE_SERVICE_KEY: 'service-e2e',
    OPENAI_API_KEY: REAL_AI ? process.env.OPENAI_API_KEY : '', SENDGRID_API_KEY: '', GR8_MAIL_SEND_ONLY: '', RESEND_API_KEY: '', LANDING_PAGE_FORM_SECRET: 'e2e-form-secret',
    LP_E2E_DISABLE_AI: FIXTURES ? '1' : '',
    LP_E2E_IMAGE_FIXTURE: FIXTURES ? '1' : '',
    LANDING_PAGES_PUBLIC_URL: '', NEXT_PUBLIC_SITE_URL: '', APP_PUBLIC_URL: '',
  };
  next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', String(APP_PORT)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  const serverLog = fs.createWriteStream(path.join(OUT, 'next-dev.log'));
  serverLog.on('error', () => { /* the log file is diagnostics only */ });
  next.stdout.pipe(serverLog); next.stderr.pipe(serverLog);
  await waitForHttp(`${APP}/api/ping`, 240_000);

  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-gpu-compositing', '--window-size=1440,960'] });
  const builder = await browser.newPage();
  builder.setDefaultNavigationTimeout(120_000);
  await builder.setViewport({ width: 1440, height: 960 });
  const consoleErrors = [];
  builder.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  builder.on('response', async (r) => { if (r.url().includes('/api/landing-pages') && r.status() >= 400) { let b = ''; try { b = await r.text(); } catch { /* ignore */ } console.log(`  API ${r.request().method()} ${r.url().replace(APP, '')} -> ${r.status()} ${b.slice(0, 300)}`); } });
  builder.on('response', async (response) => {
    if (!REAL_AI || !response.url().includes('/api/landing-pages') || response.request().method() !== 'POST') return;
    try {
      const body = await response.json();
      const action = JSON.parse(response.request().postData() || '{}').action;
      if (body.ai) aiEvidence.push({ action, ...body.ai });
      if (body.architectureAi) aiEvidence.push({ action: `${action}:architecture`, ...body.architectureAi });
      if (body.correctionAi) aiEvidence.push({ action: `${action}:correction`, ...body.correctionAi });
    } catch { /* non-JSON responses have no provider evidence */ }
  });
  const sessionJson = JSON.stringify(mock.session(U));
  await builder.evaluateOnNewDocument((s) => { try { localStorage.setItem('sb-127-auth-token', s); } catch { /* ignore */ } }, sessionJson);

  let campaignId, pageId, publicUrl, leadId;
  let primaryStructure = [];
  const text = (sel) => builder.$eval(sel, (el) => el.innerText);
  const clickText = async (selector, label, page = builder) => {
    const end = Date.now() + 30_000;
    while (Date.now() < end) {
      for (const h of await page.$$(selector)) {
        if ((await h.evaluate((el) => el.innerText.trim())) === label && !(await h.evaluate((el) => el.disabled))) { await h.click(); return; }
      }
      await sleep(250);
    }
    throw new Error(`no enabled ${selector} with text "${label}"`);
  };

  await step('1. create the campaign', async () => {
    await builder.goto(`${APP}/modules/funnels`, { waitUntil: 'domcontentloaded', timeout: 240_000 });
    await builder.waitForFunction(() => document.querySelector('[data-testid="create-ai-landing-page"]') || /Retry connection|Please sign in/.test(document.body.innerText), { timeout: 240_000 });
    if (!(await builder.$('[data-testid="create-ai-landing-page"]'))) {
      if (await builder.$('button')) await clickText('button', 'Retry connection');
      await builder.waitForSelector('[data-testid="create-ai-landing-page"]', { timeout: 120_000 });
    }
    assert.equal((await builder.$$('.sidenav a[href="/modules/landing-pages"]')).length, 0, 'no standalone Landing Pages sidebar item');
    assert.equal((await builder.$$('.sidenav a[href="/modules/funnels"]')).length, 1, 'one canonical Funnel Builder sidebar item');
    await builder.waitForSelector('.sidenav a[href="/modules/funnels"] .nav-item.active');
    // Creators are buttons that navigate via router.push; assert where each click lands.
    await builder.click('[data-testid="create-multi-step-funnel"]');
    await builder.waitForFunction(() => location.pathname === '/modules/funnels/new' && document.body.innerText.includes('Create New Funnel'), { timeout: 120_000 });
    await builder.waitForSelector('.sidenav a[href="/modules/funnels"] .nav-item.active');
    assert(await builder.$('a[href="/modules/landing-pages?from=sales-funnels"]'), 'existing wizard retains the landing-page entry');
    await builder.goto(`${APP}/modules/funnels`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await builder.waitForSelector('[data-testid="create-ai-landing-page"]');
    await builder.click('[data-testid="create-ai-landing-page"]');
    await builder.waitForFunction(() => location.pathname === '/modules/landing-pages' && new URLSearchParams(location.search).get('from') === 'sales-funnels', { timeout: 240_000 });
    await builder.waitForSelector('input[aria-label="Campaign name"]', { timeout: 240_000 });
    await builder.waitForSelector('.sidenav a[href="/modules/funnels"] .nav-item.active');
    await builder.type('input[aria-label="Campaign name"]', 'Build Your Dream Home in 2027');
    await clickText('button', 'Create campaign');
    await builder.waitForFunction(() => /\/modules\/landing-pages\/[0-9a-f-]{36}$/.test(location.pathname), { timeout: 240_000 });
    campaignId = builder.url().split('/').pop();
    await builder.waitForSelector('[data-testid="interview-composer"]', { timeout: 240_000 });
  });

  const question = () => text('[data-testid="interview-composer"] > div');
  const answerText = async (value) => {
    const before = await question();
    await builder.click('[data-testid="interview-text"]');
    await builder.type('[data-testid="interview-text"]', value);
    await builder.click('[data-testid="interview-send"]');
    await builder.waitForFunction((b) => document.querySelector('[data-testid="interview-composer"] > div')?.innerText !== b, { timeout: 60_000 }, before);
  };
  const advance = async (action) => {
    const before = await question();
    await action();
    await builder.waitForFunction((b) => !document.querySelector('[data-testid="interview-composer"]') || document.querySelector('[data-testid="interview-composer"] > div')?.innerText !== b, { timeout: 60_000 }, before);
  };

  await step('2. complete the AI interview', async () => {
    await advance(async () => {
      for (const [id, v] of [['#b-name', BUSINESS], ['#b-phone', '07 3000 1234'], ['#b-email', 'hello@example-builder.test']]) {
        await builder.click(id, { clickCount: 3 }); await builder.keyboard.press('Backspace'); await builder.type(id, v);
      }
      await builder.click('[data-testid="interview-send"]');
    });
    await advance(() => clickText('button', 'Generate enquiries or consultation bookings'));
    rawBriefOffering = 'Single and double storey custom homes designed for your block';
    await answerText(rawBriefOffering);
    await answerText(REAL_AI ? 'Residential homebuilding customers in South East Queensland' : 'Growing families who have outgrown their current home');
    if (!REAL_AI || await builder.$('[data-testid="interview-text"]')) await answerText(REAL_AI ? 'South East Queensland' : 'Western Sydney and the Hills District');
    await advance(async () => {
      if (REAL_AI) {
        await builder.click('#o-offer', { clickCount: 3 }); await builder.keyboard.press('Backspace'); await builder.type('#o-offer', 'Free initial building consultation');
      }
      await builder.click('#o-cta', { clickCount: 3 }); await builder.type('#o-cta', REAL_AI ? 'Book your free consultation' : 'Book a design consultation'); await builder.click('[data-testid="interview-send"]');
    });
    await answerText(`Fixed-price building contracts\nIn-house architects — designs drawn for your block\n${REAL_AI ? rawSpellingInput : 'Weekly photo updates from site'}`);
    await advance(async () => { await clickText('button', 'Premium & refined'); await builder.click('[data-testid="interview-send"]'); });
    await advance(async () => {
      if (REAL_AI) await clickText('button', 'Skip');
      else {
        const input = await builder.$('[data-testid="interview-composer"] input[type=file]');
        await input.uploadFile(path.resolve('3-Mediterranean.jpg'));
        await builder.waitForSelector('[data-testid="interview-composer"] img', { timeout: 60_000 });
        await builder.click('[data-testid="interview-send"]');
      }
    });
    await advance(async () => {
      if (!REAL_AI) {
        await builder.type('#e-t', '"They answered every question before we signed, and the build finished when they said it would." — Priya and Dev, Box Hill');
        await builder.type('#e-c', 'NSW Builder Licence 123456C');
      }
      await builder.click('[data-testid="interview-send"]');
    });
    for (let i = 0; i < 4; i++) await advance(() => clickText('button', 'Skip'));
    assert.equal(await builder.$('[data-testid="interview-composer"]'), null, 'interview complete');
    await capture(builder, { path: path.join(OUT, '01-interview-complete.png'), fullPage: false }, { minEntropy: 1.8 });
    const saved = (await mock.pg.query('select brief, interview from landing_campaigns where id=$1', [campaignId])).rows[0];
    assert.equal(saved.brief.businessName, BUSINESS); assert.equal((saved.brief.testimonials || []).length, REAL_AI ? 0 : 1); assert.equal((saved.brief.media || []).length, REAL_AI ? 0 : 1);
    if (REAL_AI) {
      assert.match(saved.brief.serviceArea, /South East Queensland/i);
      assert.equal(saved.brief.offer, 'Free initial building consultation');
      assert.equal(saved.brief.offering, rawBriefOffering, 'the original technical offering remains unchanged');
      assert(saved.brief.usps.includes(rawSpellingInput), 'the original misspelled strength remains unchanged in the saved brief');
    }
    assert(saved.interview.answered.length >= 9, 'answers saved on the server as the interview progressed');
    assert(await builder.$('[data-testid="interview-composer"]') === null, 'the interview completed and left the campaign screen');
  });

  await step('3. generate a professional landing page', async () => {
    const providerResponse = builder.waitForResponse((response) => response.url().includes('/api/landing-pages/campaigns/') && response.request().method() === 'POST' && JSON.parse(response.request().postData() || '{}').action === 'generate', { timeout: 120_000 });
    await builder.click('[data-testid="generate-page"]');
    const generated = await (await providerResponse).json();
    if (REAL_AI) {
      assert.equal(generated.usedAi, true, JSON.stringify(generated));
      assert.equal(generated.ai?.provider, 'openai');
      assert.equal(generated.ai?.outcome, 'success');
      assert.equal(generated.ai?.fallback, false);
      assert.equal(generated.architectureAi?.outcome, 'success', 'structure came from the real information architect');
      assert.equal(generated.correctionAi?.provider, 'openai');
      assert.equal(generated.correctionAi?.outcome, 'success', 'copy correction came from the real provider');
      assert.equal(generated.aiStatus.correction, 'ai');
      assert(generated.ai?.usage?.total_tokens > 0, 'actual provider token usage is recorded');
    } else if (FIXTURES) {
      assert.equal(generated.usedAi, false, 'fixture generation must not report real-AI success');
      assert.equal(generated.aiStatus.architecture, 'fallback');
      assert.equal(generated.aiStatus.copy, 'fallback');
    }
    await builder.waitForFunction(() => location.pathname.includes('/modules/landing-pages/editor/'), { timeout: 240_000 });
    pageId = builder.url().split('/editor/')[1].split('?')[0];
    await builder.waitForSelector('[data-testid="canvas"] .lp-s-hero h1', { timeout: 240_000 });
    primaryDocument = (await mock.pg.query('select document from landing_pages where id=$1', [pageId])).rows[0].document;
    if (REAL_AI) {
      const publicCopy = JSON.stringify(primaryDocument.sections.map((section) => section.props));
      assert(!/updats/i.test(publicCopy), 'misspelling is absent from generated page copy');
      assert.match(publicCopy, /updates/i, 'Australian-English correction appears in generated copy');
      assert.equal(primaryDocument.brand.name, BUSINESS, 'the company name remains unchanged');
      assert.match(publicCopy, /architect/i, 'the technical term is retained in page copy');
    }
    await sleep(1500);
    await capture(builder, { path: path.join(OUT, '02-editor-generated.png') });
    const types = await builder.$$eval('[data-testid="canvas"] [data-section-type]', (els) => els.map((e) => e.dataset.sectionType));
    primaryStructure = types;
    if (REAL_AI) {
      assert.deepEqual(types, generated.structure.map((section) => section.type), 'rendered sections follow the AI-selected, validated plan');
      for (const required of ['hero', 'enquiry', 'footer']) assert(types.includes(required), `AI plan retains ${required}`);
    } else {
      for (const required of ['hero', 'benefits', 'process', 'faq', 'enquiry', 'contact', 'footer', 'trust', 'testimonials']) assert(types.includes(required), `regression fixture has ${required}`);
    }
    assert.equal(types[0], 'hero');
    if (!REAL_AI) {
      const quote = await text('[data-testid="canvas"] .lp-s-testimonials blockquote');
      assert.match(quote, /They answered every question/, 'testimonial is the one supplied, word for word');
    } else assert(!types.includes('testimonials') && !types.includes('trust'), 'no fictional social proof or credentials');
  });

  const waitSaved = () => builder.waitForFunction(() => /^Saved/.test(document.querySelector('[data-testid="save-state"]')?.innerText || ''), { timeout: 60_000 });

  await step('4. edit the headline by clicking on it', async () => {
    const h1 = '[data-testid="canvas"] .lp-s-hero h1';
    await builder.click(h1);
    await builder.keyboard.down('Control'); await builder.keyboard.press('KeyA'); await builder.keyboard.up('Control');
    await builder.keyboard.type('Build the family home you have been planning, in 2027');
    await builder.keyboard.press('Enter');
    await builder.waitForFunction(() => /Unsaved|Saving|Saved/.test(document.querySelector('[data-testid="save-state"]')?.innerText || ''));
    await waitSaved();
  });

  await step('5. ask the AI assistant to change another section and accept it', async () => {
    const before = (await mock.pg.query('select document from landing_pages where id=$1', [pageId])).rows[0].document;
    await builder.click('[data-testid="tab-ai"]');
    const instruction = REAL_AI ? 'Improve only the hero headline and subheadline for residential homebuilding customers in South East Queensland planning to build in 2027. Make the free initial building consultation compelling and the copy specific. Do not change the theme, images, form, other hero properties or any other section. Do not invent claims.' : 'Change this campaign to target first-home buyers';
    const requestEdit = async () => {
      const providerResponse = builder.waitForResponse((response) => response.url().includes('/api/landing-pages/pages/') && response.request().method() === 'POST' && JSON.parse(response.request().postData() || '{}').action === 'assistant', { timeout: 120_000 });
      const input = await builder.$('[data-testid="ai-input"]');
      await input.click({ clickCount: 3 }); await builder.keyboard.press('Backspace'); await input.type(instruction);
      await builder.keyboard.press('Enter');
      return (await providerResponse).json();
    };
    let proposed = await requestEdit();
    if (REAL_AI && proposed.ai?.outcome === 'error' && /fetch failed|abort|ECONNRESET|timeout/i.test(proposed.ai.error || '')) proposed = await requestEdit();
    if (REAL_AI) {
      assert.equal(proposed.source, 'ai', JSON.stringify(proposed));
      assert.equal(proposed.ai?.outcome, 'success');
      assert.equal(proposed.ai?.fallback, false);
      assert(proposed.proposal, JSON.stringify(proposed));
      assert.deepEqual(proposed.proposal.document.sections.filter((section) => section.type !== 'hero'), before.sections.filter((section) => section.type !== 'hero'));
      assert.deepEqual(proposed.proposal.document.form, before.form);
      assert.deepEqual(proposed.proposal.document.theme, before.theme);
      assert.deepEqual(proposed.proposal.document.seo, before.seo);
      acceptedHeadline = proposed.proposal.document.sections.find((section) => section.type === 'hero').props.headline;
      assert.notEqual(acceptedHeadline, before.sections[0].props.headline, 'hero improved by provider');
    }
    await builder.waitForSelector('[data-testid="ai-proposal"]', { timeout: 60_000 });
    if (REAL_AI) assert.equal(await text('[data-testid="canvas"] .lp-s-hero h1'), acceptedHeadline, 'provider proposal is previewed');
    else assert.match(await text('[data-testid="canvas"] .lp-s-benefits h2'), /first-home buyers/i, 'proposal is previewed on the canvas');
    await capture(builder, { path: path.join(OUT, '03-ai-proposal.png') });
    await builder.click('[data-testid="ai-accept"]');
    await waitSaved();
    assert.equal(await text('[data-testid="canvas"] .lp-s-hero h1'), acceptedHeadline);
  });

  let newImage;
  await step('6. generate a campaign hero image', async () => {
    await builder.click(REAL_AI ? '[data-testid="canvas"] .lp-s-hero .lp-hero-image-empty' : '[data-testid="canvas"] .lp-s-hero .lp-img-edit');
    if (FIXTURES) {
      const generatedResponse = builder.waitForResponse((response) => response.url().includes(`/api/landing-pages/campaigns/${campaignId}`) && response.request().method() === 'POST' && JSON.parse(response.request().postData() || '{}').action === 'generate-image', { timeout: 60_000 });
      await builder.click('[data-testid="image-generate"]');
      const generated = await (await generatedResponse).json();
      assert.equal(generated.source, 'fixture', 'browser flow uses a deterministic fixture without provider calls');
      assert.equal(generated.stored, true);
      newImage = generated.url;
      await builder.waitForFunction(() => !document.querySelector('[data-testid="image-upload"]'), { timeout: 60_000 });
      assert.match(newImage, /\/storage\/v1\/object\/public\/assets\/landing-pages\/.+ai-hero-image\.png$/i, 'generated image is stored under the campaign workspace');
      const storageKey = new URL(newImage).pathname.replace('/storage/v1/object/public/', '');
      assert(mock.files.has(storageKey), 'generated image bytes exist in isolated Supabase storage');
      return;
    }
    if (REAL_AI) {
      const generateFromProvider = async () => {
        const responsePromise = builder.waitForResponse((response) => response.url().includes(`/api/landing-pages/campaigns/${campaignId}`) && response.request().method() === 'POST' && JSON.parse(response.request().postData() || '{}').action === 'generate-image', { timeout: 180_000 });
        await builder.click('[data-testid="image-generate"]');
        const response = await responsePromise;
        assert.equal(response.status(), 200);
        const result = await response.json();
        assert.equal(result.source, 'openai', 'the authenticated image endpoint returned a real provider result');
        assert.equal(result.stored, true);
        assert(result.url);
        const objectKey = new URL(result.url).pathname.replace('/storage/v1/object/public/', '');
        assert(objectKey.startsWith(`assets/landing-pages/${WA}/campaign-${campaignId}/`), 'the asset belongs to this campaign workspace');
        const stored = mock.files.get(objectKey);
        assert(stored && stored.bytes.length > 20_000, 'provider image bytes were uploaded to isolated persistent storage');
        assert.equal(stored.type, 'image/jpeg');
        assert.equal(stored.bytes[0], 0xff); assert.equal(stored.bytes[1], 0xd8, 'stored asset is a JPEG returned by the image API');
        imageEvidence.push({ provider: result.source, url: result.url, objectKey, bytes: stored.bytes.length, contentType: stored.type });
        await builder.waitForFunction(() => !document.querySelector('[data-testid="image-upload"]'), { timeout: 120_000 });
        return result;
      };
      const generated = await generateFromProvider();
      await builder.waitForFunction(() => {
        const image = document.querySelector('[data-testid="canvas"] .lp-s-hero img');
        return image && image.complete && image.naturalWidth > 100 && image.naturalHeight > 100;
      }, { timeout: 60_000 });
      const generatedImage = await builder.$eval('[data-testid="canvas"] .lp-s-hero img', (image) => ({ src: image.src, loaded: image.complete && image.naturalWidth > 100 && image.naturalHeight > 100 }));
      assert.equal(generatedImage.src, generated.url);
      assert(generatedImage.loaded, 'generated image is visible and decoded in the hero');
      await waitSaved();
      const beforeManual = (await mock.pg.query('select document from landing_pages where id=$1', [pageId])).rows[0].document;
      assert.equal(beforeManual.sections[0].variant, 'split', 'adding an image persists the image layout');
      assert.equal(beforeManual.seo.ogImage, generated.url, 'the generated hero image is used for social previews by default');

      await builder.click('[data-testid="canvas"] .lp-s-hero .lp-img-edit');
      const upload = await builder.$('[data-testid="image-upload"]');
      await upload.uploadFile(path.resolve('3-Mediterranean.jpg'));
      await builder.waitForFunction(() => !document.querySelector('[data-testid="image-upload"]'), { timeout: 60_000 });
      const manualUrl = await builder.$eval('[data-testid="canvas"] .lp-s-hero img', (image) => image.src);
      assert.match(manualUrl, /3-mediterranean\.jpg$/i, 'manual replacement remains available');
      await waitSaved();
      const afterManual = (await mock.pg.query('select document from landing_pages where id=$1', [pageId])).rows[0].document;
      assert.deepEqual(withoutHeroImage(afterManual), withoutHeroImage(beforeManual), 'manual replacement changes no unrelated page content');
      assert.equal(afterManual.seo.ogImage, manualUrl, 'manual replacement updates the default social preview image');

      await builder.click('[data-testid="canvas"] .lp-s-hero .lp-img-edit');
      const regenerated = await generateFromProvider();
      assert.notEqual(regenerated.url, generated.url, 'AI regeneration creates a new persistent asset');
      newImage = regenerated.url;
      await waitSaved();
      const afterRegeneration = (await mock.pg.query('select document from landing_pages where id=$1', [pageId])).rows[0].document;
      assert.deepEqual(withoutHeroImage(afterRegeneration), withoutHeroImage(beforeManual), 'AI regeneration preserves unrelated page content');
      assert.equal(afterRegeneration.seo.ogImage, regenerated.url, 'AI regeneration updates the default social preview image');
      assert.equal(imageEvidence.length, 2, 'exactly two intentional image-generation requests; no retries');
      return;
    }
    await builder.waitForSelector('[data-testid="image-upload"]');
    const input = await builder.$('[data-testid="image-upload"]');
    await input.uploadFile(path.resolve('3-Mediterranean.jpg'));
    await builder.waitForFunction(() => !document.querySelector('[data-testid="image-upload"]'), { timeout: 60_000 });
    newImage = await builder.$eval('[data-testid="canvas"] .lp-s-hero img', (i) => i.src);
    assert.match(newImage, /\/storage\/v1\/object\/public\/assets\/landing-pages\/.+3-mediterranean\.jpg$/i, 'uploaded into the workspace folder of the assets bucket');
  });

  await step('7-8. save, refresh, and confirm every edit persisted', async () => {
    await builder.click('[data-testid="save"]');
    await waitSaved();
    await builder.reload({ waitUntil: 'domcontentloaded' });
    await builder.waitForSelector('[data-testid="canvas"] .lp-s-hero h1', { timeout: 120_000 });
    assert.equal(await text('[data-testid="canvas"] .lp-s-hero h1'), acceptedHeadline);
    if (!REAL_AI) assert.match(await text('[data-testid="canvas"] .lp-s-benefits h2'), /first-home buyers/i);
    assert.equal(await builder.$eval('[data-testid="canvas"] .lp-s-hero img', (i) => i.src), newImage);
    const loaded = await builder.$eval('[data-testid="canvas"] .lp-s-hero img', (i) => i.complete && i.naturalWidth > 0);
    assert(loaded, 'replaced image actually loads');
    if (REAL_AI) {
      const persisted = (await mock.pg.query('select document from landing_pages where id=$1', [pageId])).rows[0].document;
      assert.equal(persisted.sections[0].props.image.src, newImage, 'the regenerated hero image survives reload');
    }
    for (const [name, width] of [['desktop', 1440], ['mobile', 390]]) {
      await clickText('button[aria-pressed]', name === 'desktop' ? 'Desktop' : 'Mobile');
      await sleep(600);
      await capture(builder, { path: path.join(OUT, `04-editor-${name}.png`) });
      void width;
    }
    await clickText('button[aria-pressed]', 'Desktop');
    if (REAL_AI) {
      await builder.goto(`${APP}/modules/landing-pages/${campaignId}`, { waitUntil: 'domcontentloaded' });
      await builder.goto(`${APP}/modules/landing-pages/editor/${pageId}`, { waitUntil: 'domcontentloaded' });
      await builder.waitForSelector('[data-testid="canvas"] .lp-s-hero h1');
      assert.equal(await text('[data-testid="canvas"] .lp-s-hero h1'), acceptedHeadline, 'accepted AI edit survives reopening');
      const persisted = (await mock.pg.query('select document from landing_pages where id=$1', [pageId])).rows[0].document;
      primaryDocument = persisted;
      fs.writeFileSync(path.join(OUT, 'accepted-document.json'), JSON.stringify(persisted, null, 2));
    }
  });

  if (FIXTURES) await step('8a. generated hero image survives save and reload', async () => {
    assert.equal(await builder.$eval('[data-testid="canvas"] .lp-s-hero img', (image) => image.src), newImage);
    assert(await builder.$eval('[data-testid="canvas"] .lp-s-hero img', (image) => image.complete && image.naturalWidth > 0), 'generated campaign asset loads after reopening');
    const saved = (await mock.pg.query('select document from landing_pages where id=$1', [pageId])).rows[0].document;
    assert.equal(saved.seo.ogImage, newImage, 'generated campaign image is the default social preview');
  });

  if (FIXTURES) await step('8b. manual image replacement remains available', async () => {
    await builder.click('[data-testid="canvas"] .lp-s-hero .lp-img-edit');
    const input = await builder.$('[data-testid="image-upload"]');
    await input.uploadFile(path.resolve('3-Mediterranean.jpg'));
    await builder.waitForFunction(() => !document.querySelector('[data-testid="image-upload"]'), { timeout: 60_000 });
    newImage = await builder.$eval('[data-testid="canvas"] .lp-s-hero img', (image) => image.src);
    assert.match(newImage, /3-mediterranean\.jpg$/i);
    await builder.click('[data-testid="save"]');
    await waitSaved();
    const saved = (await mock.pg.query('select document from landing_pages where id=$1', [pageId])).rows[0].document;
    assert.equal(saved.seo.ogImage, newImage, 'manual image replacement updates the default social preview');
  });

  await step('9. publish', async () => {
    await builder.click('[data-testid="publish-open"]');
    await builder.waitForSelector('[data-testid="publish-confirm"]:not([disabled])', { timeout: 20_000 });
    await builder.click('[data-testid="publish-confirm"]');
    await builder.waitForSelector('[data-testid="public-url"]', { timeout: 60_000 });
    publicUrl = await text('[data-testid="public-url"]');
    assert.equal(publicUrl, `${APP}/lp/build-your-dream-home-in-2027`);
    await clickText('button', 'Done');
  });

  const visitorContext = await browser.createBrowserContext();
  const visitor = await visitorContext.newPage();
  visitor.setDefaultNavigationTimeout(120_000);
  const visitorErrors = [];
  const failedRequests = [];
  visitor.on('pageerror', (e) => visitorErrors.push(e.message));
  visitor.on('console', (m) => { if (m.type() === 'error' && !/Download the React DevTools|favicon/.test(m.text())) visitorErrors.push(m.text()); });
  await visitor.setRequestInterception(true);
  visitor.on('request', (r) => {
    if (new URL(r.url()).hostname === 'fonts.googleapis.com') {
      fontFallbackStylesheets += 1;
      return r.respond({ status: 200, contentType: 'text/css', body: '' });
    }
    return r.continue();
  });
  visitor.on('requestfailed', (r) => { if (!/_next\/webpack-hmr/.test(r.url()) && !/ERR_ABORTED/.test(r.failure()?.errorText || '')) failedRequests.push(`${r.failure()?.errorText} ${r.url()}`); });
  visitor.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) failedRequests.push(`${r.status()} ${r.url()}`); });

  await step('10-11. public URL renders on desktop and mobile with working links and images', async () => {
    await visitor.setViewport({ width: 1440, height: 900 });
    const res = await visitor.goto(`${publicUrl}?utm_source=facebook&utm_medium=social&utm_campaign=build-your-dream-home-in-2027`, { waitUntil: 'networkidle0', timeout: 240_000 });
    assert.equal(res.status(), 200);
    assert.equal(await visitor.$eval('.lp-s-hero h1', (e) => e.innerText), acceptedHeadline);
    if (REAL_AI) {
      assert.equal(await visitor.$eval('.lp-s-hero img', (image) => image.src), newImage, 'published hero shows the regenerated AI image');
      assert.match(await visitor.$eval('.lp-root', (root) => root.innerText), /updates/i, 'corrected Australian-English copy survives into the published page');
      assert.doesNotMatch(await visitor.$eval('.lp-root', (root) => root.innerText), /updats/i, 'misspelling does not reach the public page');
      const heroGeometry = await visitor.evaluate(() => {
        const text = document.querySelector('.lp-s-hero h1').getBoundingClientRect();
        const image = document.querySelector('.lp-s-hero img').getBoundingClientRect();
        return { textRight: text.right, textBottom: text.bottom, imageLeft: image.left, imageTop: image.top, textColor: getComputedStyle(document.querySelector('.lp-s-hero h1')).color };
      });
      assert(heroGeometry.textRight <= heroGeometry.imageLeft || heroGeometry.textBottom <= heroGeometry.imageTop || heroGeometry.imageTop + 1 >= heroGeometry.textBottom, `hero copy and image remain visually separate: ${JSON.stringify(heroGeometry)}`);
    }
    assert.equal(await visitor.$('.lp-editable'), null, 'no editor affordances on the live page');
    const meta = await visitor.evaluate(() => ({ title: document.title, desc: document.querySelector('meta[name=description]')?.content, og: document.querySelector('meta[property="og:image"]')?.content, canonical: document.querySelector('link[rel=canonical]')?.href }));
    assert(meta.title && meta.desc && meta.og && meta.canonical === publicUrl, JSON.stringify(meta));
    const images = await visitor.$$eval('img', (els) => els.map((i) => ({ src: i.src, ok: i.complete && i.naturalWidth > 0 })));
    await visitor.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } window.scrollTo(0, 0); });
    await sleep(800);
    const imagesAfter = await visitor.$$eval('img', (els) => els.map((i) => ({ src: i.src, ok: i.complete && i.naturalWidth > 0 })));
    assert(images.length >= 1 && imagesAfter.every((i) => i.ok), `broken images: ${JSON.stringify(imagesAfter.filter((i) => !i.ok))}`);
    const brokenLinks = await visitor.$$eval('a[href^="#"]', (as) => as.map((a) => a.getAttribute('href')).filter((h) => h.length > 1 && !document.getElementById(h.slice(1))));
    assert.deepEqual(brokenLinks, [], 'every in-page button reaches a section');
    await capture(visitor, { path: path.join(OUT, '05-public-desktop.png'), fullPage: true });
    await visitor.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await visitor.reload({ waitUntil: 'networkidle0' });
    const overflow = await visitor.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 1, `no horizontal scrolling on mobile (overflow ${overflow}px)`);
    const heroMedia = await visitor.evaluate(() => ({ imageBottom: document.querySelector('.lp-hero-media img')?.getBoundingClientRect().bottom, badgeTop: document.querySelector('.lp-hero-card')?.getBoundingClientRect().top }));
    assert(heroMedia.imageBottom == null || heroMedia.badgeTop == null || heroMedia.badgeTop >= heroMedia.imageBottom - 1, `mobile hero badge does not overlap the image: ${JSON.stringify(heroMedia)}`);
    if (REAL_AI) {
      const imageLayout = await visitor.$eval('.lp-s-hero img', (image) => ({ src: image.src, width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height, fit: getComputedStyle(image).objectFit, loaded: image.complete && image.naturalWidth > 100 }));
      assert.equal(imageLayout.src, newImage, 'mobile page keeps the same generated asset');
      assert(imageLayout.width > 0 && imageLayout.height > 0 && imageLayout.loaded && imageLayout.fit === 'cover', `mobile hero image crops responsively: ${JSON.stringify(imageLayout)}`);
    }
    const smallText = await visitor.$$eval('.lp-root p, .lp-root li, .lp-root label, .lp-root a, .lp-root summary', (els) => els.filter((e) => e.offsetParent && e.innerText.trim() && parseFloat(getComputedStyle(e).fontSize) < 14).map((e) => e.innerText.slice(0, 30)));
    assert.deepEqual(smallText, [], 'body text stays readable on mobile');
    await capture(visitor, { path: path.join(OUT, '06-public-mobile.png'), fullPage: true });
    assert.deepEqual(failedRequests, [], `failed requests: ${failedRequests.join(' | ')}`);
    assert.deepEqual(visitorErrors, [], `console errors: ${visitorErrors.join(' | ')}`);
  });

  await step('12. submit a test enquiry from the live page', async () => {
    await visitor.setViewport({ width: 1440, height: 900 });
    await visitor.goto(`${publicUrl}?utm_source=facebook&utm_medium=social&utm_campaign=build-your-dream-home-in-2027`, { waitUntil: 'networkidle0' });
    await visitor.$eval('#enquire', (e) => e.scrollIntoView());
    await visitor.click('.lp-form button[type=submit]');
    await visitor.waitForSelector('.lp-err');
    assert((await visitor.$$('.lp-err')).length >= 2, 'required-field validation shows before sending');
    await visitor.type('#lpf-name', 'Jordan Rivers');
    await visitor.type('#lpf-email', 'Jordan.Rivers@example.org');
    await visitor.type('#lpf-phone', '0412 345 678');
    if (await visitor.$('#lpf-suburb')) await visitor.type('#lpf-suburb', 'Kellyville');
    if (await visitor.$('#lpf-project_type')) await visitor.select('#lpf-project_type', 'Consultation');
    if (await visitor.$('#lpf-timeframe')) await visitor.select('#lpf-timeframe', '6–12 months');
    if (await visitor.$('#lpf-message')) await visitor.type('#lpf-message', 'Four bedrooms, two living areas, on a 600 m² block.');
    await visitor.click('.lp-consent input');
    await sleep(2800);
    await visitor.click('.lp-form button[type=submit]');
    await visitor.waitForSelector('.lp-thanks', { timeout: 60_000 });
    await capture(visitor, { path: path.join(OUT, '07-enquiry-thank-you.png') });
  });

  await step('13-15. the enquiry is in Leads and CRM, with campaign attribution', async () => {
    const sub = (await mock.pg.query('select * from landing_page_submissions where campaign_id=$1', [campaignId])).rows;
    assert.equal(sub.length, 1); assert.equal(sub[0].status, 'synced'); assert.equal(sub[0].workspace_id, WA);
    assert.equal(sub[0].attribution.utm_source, 'facebook'); assert.equal(sub[0].attribution.utm_campaign, 'build-your-dream-home-in-2027');
    leadId = sub[0].lead_id;
    const lead = (await mock.pg.query('select * from leads where id=$1', [leadId])).rows[0];
    assert.equal(lead.workspace_id, WA, 'lead created in the builder’s own workspace');
    assert.equal(lead.email, 'jordan.rivers@example.org'); assert.equal(lead.name, 'Jordan Rivers'); assert.equal(lead.phone, '0412 345 678');
    assert.equal(lead.lead_source, 'Landing Page: Build Your Dream Home in 2027');
    const otherTenant = (await mock.pg.query(`select * from leads where id='11111111-0000-4000-8000-0000000000e2'`)).rows[0];
    assert.equal(otherTenant.workspace_id, WB, 'same email in another builder was not touched');
    const note = (await mock.pg.query('select note from lead_notes where lead_id=$1', [leadId])).rows[0].note;
    for (const re of [/Build Your Dream Home in 2027/, /Kellyville|Four bedrooms/, /utm_source/, new RegExp(campaignId)]) assert.match(note, re);
    // Builder sees it in the campaign and opens it in CRM
    await builder.goto(`${APP}/modules/landing-pages/${campaignId}`, { waitUntil: 'domcontentloaded' });
    await builder.waitForSelector('[role=tab]', { timeout: 120_000 });
    await clickText('[role=tab]', 'Enquiries (1)');
    await builder.waitForFunction(() => document.body.innerText.includes('Jordan Rivers') && document.body.innerText.includes('In CRM'), { timeout: 30_000 });
    await capture(builder, { path: path.join(OUT, '08-campaign-enquiries.png') });
    await builder.goto(`${APP}/leads?lead=${leadId}`, { waitUntil: 'domcontentloaded' });
    await builder.waitForFunction(() => document.body.innerText.includes('Jordan Rivers') && document.body.innerText.includes('jordan.rivers@example.org'), { timeout: 180_000 });
    await sleep(1500);
    await capture(builder, { path: path.join(OUT, '09-crm-lead.png') });
  });

  await step('16-17. republish an edited version and the live page updates', async () => {
    await builder.goto(`${APP}/modules/landing-pages/editor/${pageId}`, { waitUntil: 'domcontentloaded' });
    await builder.waitForSelector('[data-testid="canvas"] .lp-s-hero h1', { timeout: 120_000 });
    await builder.click('[data-testid="canvas"] .lp-s-hero h1');
    await builder.keyboard.down('Control'); await builder.keyboard.press('KeyA'); await builder.keyboard.up('Control');
    await builder.keyboard.type('Your 2027 home, designed around your family');
    await builder.keyboard.press('Enter');
    await waitSaved();
    await builder.click('[data-testid="publish-open"]');
    await builder.waitForSelector('[data-testid="publish-confirm"]:not([disabled])');
    await builder.click('[data-testid="publish-confirm"]');
    await builder.waitForSelector('[data-testid="public-url"]', { timeout: 60_000 });
    await visitor.goto(publicUrl, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await visitor.waitForFunction(() => document.querySelector('.lp-s-hero h1')?.innerText === 'Your 2027 home, designed around your family', { timeout: 120_000 });
    assert.equal(await visitor.$eval('.lp-s-hero h1', (e) => e.innerText), 'Your 2027 home, designed around your family');
    const versions = (await mock.pg.query(`select kind from landing_page_versions where page_id=$1 order by version_no`, [pageId])).rows.map((r) => r.kind);
    assert.equal(versions.filter((k) => k === 'publish').length, 2, `two published versions kept (${versions.join(',')})`);
    await builder.goto(`${APP}/modules/landing-pages/editor/${pageId}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await builder.waitForSelector('[data-testid="canvas"] .lp-s-hero h1', { timeout: 120_000 });
    assert.equal(await text('[data-testid="canvas"] .lp-s-hero h1'), 'Your 2027 home, designed around your family', 'republished content survives editor reopen');
  });

  await step('18. existing campaigns and customer data are intact; tenants are isolated', async () => {
    const after = (await mock.pg.query('select * from leads where id = any($1::uuid[]) order by id', [leadsBefore.map((l) => l.id)])).rows;
    assert.deepEqual(after.map((l) => [l.name, l.email, l.lead_source, l.workspace_id, l.lead_status]), leadsBefore.map((l) => [l.name, l.email, l.lead_source, l.workspace_id, l.lead_status]));
    const other = (await mock.pg.query(`select name, status from landing_campaigns where workspace_id=$1`, [WB])).rows;
    assert.deepEqual(other, [{ name: 'Other builder campaign', status: 'active' }]);
    const tokenB = mock.session(UB).access_token;
    const r1 = await fetch(`${APP}/api/landing-pages/pages/${pageId}`, { headers: { Authorization: `Bearer ${tokenB}`, 'x-workspace-id': WB } });
    assert.equal(r1.status, 404, 'another builder cannot open this page');
    const r2 = await fetch(`${APP}/api/landing-pages/pages/${pageId}`, { headers: { Authorization: `Bearer ${tokenB}`, 'x-workspace-id': WA } });
    assert.equal(r2.status, 403, 'another builder cannot claim this workspace');
    const r3 = await fetch(`${APP}/api/landing-pages/campaigns`, { headers: { 'x-workspace-id': WA } });
    assert.equal(r3.status, 401, 'signed-out requests are refused');
    const r4 = await fetch(`${APP}/lp/does-not-exist`);
    assert.equal(r4.status, 404);
    // The CRM Leads page mounts the existing telephony dialer, which cannot get a Twilio token in this isolated stack.
    const outside = consoleErrors.filter((e) => /BrowserDialer/.test(e));
    if (outside.length) console.log(`  note: ${outside.length} error(s) from components/telephony/BrowserDialer.js on the Leads page (outside this module; no Twilio in the test stack)`);
    assert.deepEqual(consoleErrors.filter((e) => !outside.includes(e)), [], `builder page errors: ${consoleErrors.join(' | ')}`);
  });

  if (REAL_AI || FIXTURES) await step(REAL_AI ? '19. five businesses receive distinct AI-planned draft pages' : '19. five deterministic business fixtures render responsively', async () => {
    const businesses = [
      { name: 'Bright Dental', brief: { businessName: 'Bright Dental', industry: 'Dentistry', objective: 'enquiries', offering: 'preventive dentistry; restorative dentistry', audience: 'families and adults', serviceArea: 'Brisbane', phone: '07 3000 1111', email: 'hello@bright-dental.test' }, fixtureMedia: [{ src: '/assets/happy-young-woman-work-office-using-computer_171337-6704-1.avif', alt: 'Consultation in a bright office' }], fixtureStructure: ['hero', 'services', 'about', 'faq', 'enquiry', 'footer'] },
      { name: 'Tasman Trails', brief: { businessName: 'Tasman Trails', industry: 'Tourism', objective: 'display', offering: 'guided coastal walks; island nature tours', audience: 'visitors exploring Tasmania', serviceArea: 'Tasmania', address: 'Hobart, Tasmania', phone: '03 6200 1111', email: 'hello@tasman-trails.test' }, fixtureMedia: [{ src: '/assets/ai1.jpg', alt: 'Illustrated mountain trail landscape' }], fixtureStructure: ['hero', 'about', 'process', 'contact', 'enquiry', 'footer'] },
      { name: 'Stockwise', brief: { businessName: 'Stockwise', industry: 'Software', objective: 'package', offering: 'inventory management software', audience: 'independent retailers', serviceArea: 'Australia', offer: '14-day trial', phone: '02 9000 2222', email: 'hello@stockwise.test' }, fixtureMedia: [{ src: '/assets/software-1-300x169.webp', alt: 'Software product interface' }], fixtureStructure: ['hero', 'benefits', 'services', 'offer', 'enquiry', 'footer'] },
      { name: 'Northside Community Festival', brief: { businessName: 'Northside Community Festival', industry: 'Community events', objective: 'event', offering: 'community fundraiser and food festival', audience: 'local families', serviceArea: 'Northside Brisbane', address: 'Northside community grounds', phone: '07 3000 3333', email: 'hello@northside-festival.test' }, fixtureMedia: [{ src: '/assets/creative-agency-team-celebrating-success-gr8result.jpg', alt: 'People celebrating together' }], fixtureStructure: ['hero', 'about', 'benefits', 'process', 'enquiry', 'footer'] },
    ];
    const token = mock.session(U).access_token;
    const headers = { Authorization: `Bearer ${token}`, 'x-workspace-id': WA, 'Content-Type': 'application/json' };
    const businessDesigns = [];
    if (REAL_AI) {
      const mainPage = (await mock.pg.query('select document from landing_pages where id=$1', [pageId])).rows[0].document;
      businessDesigns.push({ name: BUSINESS, document: mainPage, signature: visualSignature(mainPage) });
    }
    for (const item of businesses) {
      const createdResponse = await fetch(`${APP}/api/landing-pages/campaigns`, { method: 'POST', headers, body: JSON.stringify({ name: item.name }) });
      const created = await createdResponse.json();
      assert.equal(createdResponse.status, 201, JSON.stringify(created));
      const brief = FIXTURES ? { ...item.brief, media: item.fixtureMedia } : item.brief;
      const patchedResponse = await fetch(`${APP}/api/landing-pages/campaigns/${created.campaign.id}`, { method: 'PATCH', headers, body: JSON.stringify({ brief }) });
      assert.equal(patchedResponse.status, 200, `brief for ${item.name}`);
      const generateBody = FIXTURES ? { action: 'generate', useAi: false, structure: item.fixtureStructure } : { action: 'generate' };
      const generatedResponse = await fetch(`${APP}/api/landing-pages/campaigns/${created.campaign.id}`, { method: 'POST', headers, body: JSON.stringify(generateBody) });
      const generated = await generatedResponse.json();
      assert.equal(generatedResponse.status, 200, `${item.name}: ${JSON.stringify(generated)}`);
      if (REAL_AI) {
        assert.equal(generated.usedAi, true, `${item.name} uses real AI architecture and copy`);
        assert.equal(generated.ai?.outcome, 'success', `${item.name} has successful provider evidence`);
        assert.equal(generated.architectureAi?.outcome, 'success', `${item.name} has successful architecture evidence`);
        aiEvidence.push({ action: `generate:${item.name}`, ...generated.ai });
      } else {
        assert.equal(generated.usedAi, false, `${item.name} is deterministic, not reported as AI success`);
        assert.equal(generated.aiStatus.architecture, 'manual');
        assert.equal(generated.aiStatus.copy, 'fallback');
      }
      const sequence = generated.structure.map((section) => section.type);
      assert.equal(sequence[0], 'hero');
      assert.equal(sequence.at(-2), 'enquiry');
      assert.equal(sequence.at(-1), 'footer');
      await builder.goto(`${APP}/modules/landing-pages/editor/${generated.pageId}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await builder.waitForSelector('[data-testid="canvas"] .lp-s-hero h1', { timeout: 120_000 });
      const rendered = await builder.$$eval('[data-testid="canvas"] [data-section-type]', (els) => els.map((e) => e.dataset.sectionType));
      assert.deepEqual(rendered, sequence, `${item.name} browser sections match its plan`);
      const pageDocument = (await mock.pg.query('select document from landing_pages where id=$1', [generated.pageId])).rows[0].document;
      assert.equal(pageDocument.brand.name, item.brief.businessName, `${item.name} branding matches the campaign`);
      assert(!pageDocument.sections.some((section) => ['trust', 'testimonials'].includes(section.type)), `${item.name} does not invent social proof`);
      assert.equal(pageDocument.theme.preset, ({ 'Bright Dental': 'modern', 'Tasman Trails': 'classic', Stockwise: 'minimal', 'Northside Community Festival': 'premium' })[item.name], `${item.name} receives the expected industry-appropriate visual preset`);
      const copy = JSON.stringify(pageDocument.sections.map((section) => section.props));
      const industryTerms = {
        'Bright Dental': /dental|dentistry|preventive/i,
        'Tasman Trails': /coastal|Tasmania|island|guided/i,
        Stockwise: /inventory|stock|retailer/i,
        'Northside Community Festival': /festival|community|food/i,
      };
      assert(industryTerms[item.name].test(copy), `${item.name} copy reflects its industry and offer`);
      businessDesigns.push({ name: item.name, document: pageDocument, signature: visualSignature(pageDocument) });
      if (FIXTURES) {
        assert.equal(pageDocument.sections[0].props.image.src, item.fixtureMedia[0].src, `${item.name} uses its local fixture image`);
        if (item.name === 'Bright Dental') {
          await builder.click('[data-testid="canvas"] .lp-s-hero h1');
          await builder.keyboard.down('Control'); await builder.keyboard.press('KeyA'); await builder.keyboard.up('Control');
          await builder.keyboard.type('Dental care for every stage');
          await builder.keyboard.press('Enter');
          await waitSaved();
          await builder.click('[data-testid="canvas"] .lp-s-hero h1');
          await clickText('button[aria-pressed]', 'Tint');
          await builder.click('[data-testid="canvas"] .lp-s-hero .lp-btn-primary');
          const fillInputByLabel = async (scope, labelText, value) => {
            const inputs = await builder.$$(`${scope} input`);
            let target = null;
            for (const input of inputs) {
              if ((await input.evaluate((element) => element.closest('label')?.innerText || '')).includes(labelText)) { target = input; break; }
            }
            assert(target, `input labelled ${labelText} exists in ${scope}`);
            await target.click();
            await builder.keyboard.down('Control'); await builder.keyboard.press('KeyA'); await builder.keyboard.up('Control');
            await target.type(value);
          };
          await fillInputByLabel('aside[aria-label="Edit panel"]', 'Button text', 'Book a dental visit');
          await clickText('aside[aria-label="Page structure"] [role="tab"]', 'Page settings');
          await fillInputByLabel('aside[aria-label="Page structure"]', 'Button text', 'Send dental enquiry');
          await waitSaved();
          await clickText('aside[aria-label="Page structure"] [role="tab"]', 'Sections');
          await builder.select('[data-testid="add-section"]', 'process');
          await builder.waitForFunction(() => document.querySelectorAll('[data-testid="canvas"] [data-section-type="process"]').length === 1);
          await builder.click('[aria-label="Undo"]');
          await builder.waitForFunction(() => document.querySelectorAll('[data-testid="canvas"] [data-section-type="process"]').length === 0);
          await builder.click('[aria-label="Redo"]');
          await builder.waitForFunction(() => document.querySelectorAll('[data-testid="canvas"] [data-section-type="process"]').length === 1);
          await builder.click('[data-testid="save"]');
          await waitSaved();
          const saved = (await mock.pg.query('select document from landing_pages where id=$1', [generated.pageId])).rows[0].document;
          assert.equal(saved.sections[0].props.headline, 'Dental care for every stage', 'manual editing persists on a fixture');
          assert.equal(saved.sections[0].style.background, 'alt', 'section styling persists');
          assert.equal(saved.sections[0].props.primaryCta.label, 'Book a dental visit', 'CTA editing persists');
          assert.equal(saved.form.submitLabel, 'Send dental enquiry', 'form editing persists');
          assert(saved.sections.some((section) => section.type === 'process'), 'section add and redo persist');
          await clickText('header button', 'History');
          await builder.waitForFunction(() => document.body.innerText.toLowerCase().includes('version history'));
          await builder.waitForFunction(() => /first generation/i.test(document.querySelector('aside[aria-label="Edit panel"]')?.innerText || ''));
          await builder.goto(`${APP}/modules/landing-pages/editor/${generated.pageId}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
          await builder.waitForSelector('[data-testid="canvas"] .lp-s-hero h1', { timeout: 60_000 });
          assert.equal(await text('[data-testid="canvas"] .lp-s-hero h1'), 'Dental care for every stage', 'saved content is present after reopening');
          assert.equal(await text('[data-testid="canvas"] .lp-s-hero .lp-btn-primary'), 'Book a dental visit');
          assert.equal(await text('[data-testid="canvas"] .lp-s-enquiry .lp-btn'), 'Send dental enquiry');
        }
      }
      if (REAL_AI) {
        await builder.setViewport({ width: 1440, height: 960 });
        await builder.waitForFunction(() => document.querySelector('[data-testid="canvas"] .lp-s-hero h1') && !document.body.innerText.includes('Loading editor'), { timeout: 120_000 });
        await capture(builder, { path: path.join(OUT, `business-${slugify(item.name)}-desktop.png`) });
        await builder.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
        await builder.waitForFunction(() => document.querySelector('[data-testid="canvas"] .lp-s-hero h1') && !document.body.innerText.includes('Loading editor'), { timeout: 120_000 });
        await capture(builder, { path: path.join(OUT, `business-${slugify(item.name)}-mobile.png`) });
      } else {
        for (const viewport of [{ name: 'desktop', width: 1440, height: 960 }, { name: 'tablet', width: 834, height: 1112 }, { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]) {
          await builder.setViewport(viewport);
          await builder.goto(`${APP}/modules/landing-pages/preview/${generated.pageId}`, { waitUntil: 'networkidle0', timeout: 120_000 });
          await builder.waitForSelector('.lp-root .lp-s-hero h1', { timeout: 60_000 });
          await builder.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((resolve) => setTimeout(resolve, 80)); } window.scrollTo(0, 0); });
          const readyImages = await builder.waitForFunction(() => Array.from(document.querySelectorAll('.lp-root img')).every((image) => image.complete && image.naturalWidth > 1 && image.naturalHeight > 1), { timeout: 60_000 });
          assert(readyImages, `${item.name} images load at ${viewport.name}`);
          const layout = await builder.evaluate(() => ({ overflow: document.documentElement.scrollWidth - window.innerWidth, hero: !!document.querySelector('.lp-s-hero h1'), form: !!document.querySelector('.lp-s-enquiry form'), cta: !!document.querySelector('.lp-s-hero a[href="#enquire"]'), brokenAnchors: Array.from(document.querySelectorAll('a[href^="#"]')).map((a) => a.getAttribute('href')).filter((href) => href.length > 1 && !document.getElementById(href.slice(1))) }));
          assert(layout.hero && layout.form && layout.cta, `${item.name} shows hero, CTA and lead form at ${viewport.name}`);
          assert(layout.overflow <= 1, `${item.name} has no horizontal overflow at ${viewport.name}: ${layout.overflow}px`);
          assert.deepEqual(layout.brokenAnchors, [], `${item.name} has working in-page links at ${viewport.name}`);
          await capture(builder, { path: path.join(OUT, `business-${slugify(item.name)}-${viewport.name}.png`), fullPage: true });
        }
      }
      const statuses = (await mock.pg.query('select c.status campaign_status,p.status page_status from landing_campaigns c join landing_pages p on p.campaign_id=c.id where p.id=$1', [generated.pageId])).rows[0];
      assert.deepEqual(statuses, { campaign_status: 'draft', page_status: 'draft' }, `${item.name} remains unpublished`);
    }
    const signatures = businessDesigns.map((design) => design.signature);
    const signatureCount = new Set(signatures).size;
    assert(signatureCount >= 4, `five business pages should have at least four visibly distinct compositions, themes, hero treatments or section layouts; got ${signatureCount}`);
    fs.writeFileSync(path.join(OUT, 'business-design-review.json'), JSON.stringify(businessDesigns.map(({ name, document, signature }) => ({
      name,
      signature,
      headline: document.sections.find((section) => section.type === 'hero')?.props.headline,
      industryCopy: document.sections.map((section) => section.props).filter(Boolean),
    })), null, 2));
  });
} catch (e) {
  process.exitCode = 1;
  console.error(e.stack || e);
} finally {
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ results, environment: { externalFontStylesheetsFallback: fontFallbackStylesheets } }, null, 2));
  if (REAL_AI) {
    const successful = aiEvidence.filter((result) => result.outcome === 'success');
    const estimatedUsd = successful.every((result) => result.model.startsWith('gpt-4o-mini')) ? successful.reduce((total, result) => total + ((result.usage?.prompt_tokens || 0) * 0.15 + (result.usage?.completion_tokens || 0) * 0.60) / 1_000_000, 0) : null;
    fs.writeFileSync(path.join(OUT, 'provider-evidence.json'), JSON.stringify({ isolatedDatabase: true, realOpenAi: true, requests: aiEvidence, estimatedUsd, estimateBasis: 'gpt-4o-mini: $0.15 input / $0.60 output per million tokens, excluding cache discounts; estimate, not an invoice' }, null, 2));
    fs.writeFileSync(path.join(OUT, 'image-provider-evidence.json'), JSON.stringify({ isolatedDatabase: true, realOpenAiImages: true, explicitGenerationCount: imageEvidence.length, requests: imageEvidence }, null, 2));
    console.log(`Real provider requests: ${successful.length}; estimated USD: ${estimatedUsd}`);
  }
  await cleanup();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} browser acceptance steps passed. Screenshots: ${OUT}/`);
  setTimeout(() => process.exit(process.exitCode || 0), 500);
}
