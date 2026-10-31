// Isolated GR8 pre-launch acceptance. No production writes or email delivery.
// First run: LP_QUALITY_REAL_AI=1. Paid image generation is capped at one attempt and cached for replays.
// LP_QUALITY_KEEP=1 leaves this isolated browser demonstration running after acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { startMockSupabase } from './lib/mock-supabase-server.mjs';
import { composeDocument, copyQualityIssues } from '../lib/landing-pages/generator.js';
import { writePageCopy } from '../lib/landing-pages/ai.js';

const OUT = path.resolve('artifacts', 'landing-pages-campaign-quality');
fs.mkdirSync(OUT, { recursive: true });
const REAL = process.env.LP_QUALITY_REAL_AI === '1';
const KEEP = process.env.LP_QUALITY_KEEP === '1';
if (REAL) dotenv.config({ path: '.env.local', quiet: true });
const PORT = 3123, DB_PORT = 54423, APP = `http://localhost:${PORT}`;
const U = { id: 'a0000000-0000-4000-8000-000000000e71', email: 'quality-owner@example.test', password: 'quality-test-only' };
const W = 'aaaaaaaa-0000-4000-8000-000000000e71';
const C = 'cccccccc-0000-4000-8000-000000000e71';
const capabilities = [
  ['AI-assisted plan takeoff', 'Work from building plans to support quantity takeoff and reduce repeated manual measurement.'],
  ['Job setup and estimating', 'Organise job details and estimate inputs together rather than re-entering them across separate files.'],
  ['Quotation building', 'Bring estimate information into a quotation workflow for customer review.'],
  ['Client selections', 'Keep client choices connected to the job rather than scattered across messages.'],
  ['Product libraries and inclusions', 'Organise product information and inclusions for estimating and selections.'],
  ['Project and workflow management', 'Keep job tasks and project progress in a connected workflow.'],
  ['Customer enquiries and CRM', 'Record enquiries and keep customer follow-up information together.'],
  ['Marketing, landing pages and funnels', 'Create campaign pages and capture interest within the business workflow.'],
  ['Connected business workflows', 'Connect information between enquiries, estimates, quotations, selections and project work.'],
].map(([name, description]) => ({ name, description, status: 'unconfirmed' }));
const brief = {
  campaignName: 'GR8 Result pre-launch quality candidate',
  businessName: 'GR8 Result', industry: 'Software for Australian builders', objective: 'prelaunch',
  offering: 'AI-assisted plan takeoff, job setup and estimating, quotation building, client selections, product libraries and inclusions, project and workflow management, customer enquiries and CRM, marketing landing pages and funnels, connected business workflows',
  audience: 'Australian residential builders juggling estimates, client decisions and customer enquiries across disconnected systems',
  serviceArea: 'Australia-wide', email: 'demo@example.test', offer: '', ctaLabel: 'Register Your Interest',
  objectiveDetail: 'Promote the upcoming platform release, explain its proposed builder workflows, collect registrations and demonstration enquiries. No authorised trial, price, launch date or discount. Feature readiness has not been supplied: clearly label availability to be confirmed, never claim production readiness.',
  painPoints: ['Repeated manual plan measurement and disconnected estimating files', 'Re-entering job and quotation details across separate systems', 'Client selections buried in emails and messages', 'Customer enquiries disconnected from job follow-up'],
  capabilities, style: 'modern', primaryColour: '#087F83', secondaryColour: '#0B1728',
  campaignPrompt: 'Create a pre-launch campaign for GR8 Result for Australian builders. Explain AI-assisted plan takeoff, estimating, quotations, selections, libraries, project workflows, CRM and marketing. No invented trial, release date or proof. Capabilities have unconfirmed availability. Help visitors understand the practical value and register their interest or request a demonstration.',
};
const seedSql = `
insert into auth.users values ('${U.id}','${U.email}','${U.password}');
insert into accounts (user_id,email,business_name,full_name,is_approved,approved,status,subscription_status,onboarding_completed,phone_verified)
values ('${U.id}','${U.email}','GR8 Result','Quality Tester',true,true,'active','active',true,true);
insert into workspaces (id,name,slug,owner_id) values ('${W}','GR8 Result quality test','gr8-quality','${U.id}');
insert into workspace_members (workspace_id,user_id,role,status) values ('${W}','${U.id}','owner','active');
insert into landing_campaigns (id,workspace_id,created_by,name,status,brief)
values ('${C}','${W}','${U.id}','GR8 Result pre-launch quality candidate','draft','${JSON.stringify(brief).replace(/'/g, "''")}');
`;
let mock, next, browser;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function cleanup() {
  if (browser) await browser.close();
  if (next) {
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(next.pid), '/T', '/F']);
    else next.kill('SIGTERM');
  }
  if (mock) await mock.close();
}
async function waitForServer() {
  const until = Date.now() + 180_000;
  while (Date.now() < until) {
    try { if ((await fetch(`${APP}/api/ping`)).status < 500) return; } catch { /* startup only */ }
    await sleep(1000);
  }
  throw new Error('Isolated Next server did not become ready');
}
try {
  mock = await startMockSupabase({ port: DB_PORT, seedSql });
  const env = {
    ...process.env, NEXT_DIST_DIR: '.next-landing-pages-campaign-quality', NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_SUPABASE_URL: mock.url, SUPABASE_URL: mock.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-e2e',
    SUPABASE_SERVICE_ROLE_KEY: 'service-e2e', SUPABASE_SERVICE_KEY: 'service-e2e',
    OPENAI_API_KEY: REAL ? process.env.OPENAI_API_KEY : '', LP_E2E_DISABLE_AI: '', LP_E2E_IMAGE_FIXTURE: '',
    SENDGRID_API_KEY: '', GR8_MAIL_SEND_ONLY: '', RESEND_API_KEY: '', LANDING_PAGE_FORM_SECRET: 'quality-isolated-form',
    LANDING_PAGES_PUBLIC_URL: '', NEXT_PUBLIC_SITE_URL: '', APP_PUBLIC_URL: '',
  };
  next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '-p', String(PORT)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  const log = fs.createWriteStream(path.join(OUT, 'server.log'));
  next.stdout.pipe(log); next.stderr.pipe(log);
  next.stdout.on('data', (chunk) => process.stdout.write(chunk));
  next.stderr.on('data', (chunk) => process.stderr.write(chunk));
  await waitForServer();
  const session = mock.session(U);
  async function api(route, body, method = 'POST') {
    const response = await fetch(`${APP}/api/landing-pages/${route}`, {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, 'x-workspace-id': W },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    assert(response.headers.get('content-type')?.includes('application/json'), `Non-JSON API response for ${route}: HTTP ${response.status} ${text.slice(0, 1200)}`);
    const json = JSON.parse(text);
    assert(response.ok && json.ok, JSON.stringify({ route, status: response.status, json }));
    return json;
  }
  const cache = path.join(OUT, 'generated-document.json');
  let pageId, doc, generation;
  if (fs.existsSync(cache) && process.env.LP_QUALITY_REGENERATE_COPY !== '1') {
    doc = JSON.parse(fs.readFileSync(cache, 'utf8'));
    const cachedCopy = Object.fromEntries(doc.sections.map((section) => [section.type, section.props]));
    cachedCopy.hero = { ...cachedCopy.hero, primaryCta: cachedCopy.hero.primaryCta.label };
    cachedCopy.seo = doc.seo;
    const structure = doc.sections.map(({ type, variant }) => ({ type, variant }));
    let revised = cachedCopy;
    if (process.env.LP_QUALITY_REVISE_CACHED_COPY === '1' && copyQualityIssues(cachedCopy, brief).length) {
      assert(REAL, 'A real copy revision requires explicit real-AI mode.');
      revised = await writePageCopy(brief, structure, {
        strategy: doc.generation?.strategy, previousCopy: cachedCopy, qualityIssues: copyQualityIssues(cachedCopy, brief),
        onResult: (result) => fs.writeFileSync(path.join(OUT, 'copy-quality-provider.json'), JSON.stringify(result, null, 2)),
      });
      assert.deepEqual(copyQualityIssues(revised, brief), [], 'The revised first screen must pass the concrete-value quality gate.');
    }
    doc = composeDocument(brief, { aiCopy: revised, structure, strategy: doc.generation?.strategy }).document;
    fs.writeFileSync(cache, JSON.stringify(doc, null, 2));
    const { rows } = await mock.pg.query(`insert into landing_pages (workspace_id,campaign_id,created_by,title,slug,document,revision)
      values ($1,$2,$3,'GR8 Result quality candidate','gr8-result-prelaunch-candidate',$4,1) returning id`, [W, C, U.id, JSON.stringify(doc)]);
    pageId = rows[0].id;
    console.log('Using cached generated copy with the current compositor; any explicit copy revision is recorded separately. No new image generation request.');
  } else {
    assert(REAL, 'First acceptance run needs LP_QUALITY_REAL_AI=1; no fixture substitute is permitted.');
    generation = await api(`campaigns/${C}`, { action: 'generate' });
    assert(generation.usedAi && generation.ai.outcome === 'success', JSON.stringify(generation));
    assert.equal(generation.architectureAi.outcome, 'success');
    pageId = generation.pageId;
    doc = (await api(`pages/${pageId}`, null, 'GET')).page.document;
    fs.writeFileSync(cache, JSON.stringify(doc, null, 2));
    fs.writeFileSync(path.join(OUT, 'copy-provider.json'), JSON.stringify(generation, null, 2));
  }
  const imagePath = path.join(OUT, 'real-provider-hero.jpg');
  let image;
  if (fs.existsSync(imagePath)) {
    const uploaded = await api(`campaigns/${C}`, { action: 'upload', dataUrl: `data:image/jpeg;base64,${fs.readFileSync(imagePath).toString('base64')}`, fileName: 'verified-real-provider-hero.jpg' });
    image = { ...JSON.parse(fs.readFileSync(path.join(OUT, 'image-provider.json'), 'utf8')), url: uploaded.url };
    console.log('Reused stored bytes from the previously verified real image request.');
  } else {
    assert(REAL, 'No cached real image exists.');
    const attempt = path.join(OUT, 'image-request-attempted.json');
    const prior = fs.existsSync(attempt) ? JSON.parse(fs.readFileSync(attempt, 'utf8')) : null;
    assert(!prior || (process.env.LP_QUALITY_ADDITIONAL_IMAGE_APPROVED === '1' && (prior.requests || 1) === 1), 'Paid image budget exhausted; explicit review required.');
    fs.writeFileSync(attempt, JSON.stringify({ attemptedAt: new Date().toISOString(), requests: prior ? 2 : 1, maximumRequests: prior ? 2 : 1, previousAttempt: prior }));
    image = await api(`campaigns/${C}`, { action: 'generate-image' });
    assert.equal(image.source, 'openai');
    assert.equal(image.stored, true);
    assert.equal(image.provider.outcome, 'success');
    const response = await fetch(image.url);
    assert(response.ok, 'Stored provider image can be fetched');
    const bytes = Buffer.from(await response.arrayBuffer());
    const dimensions = await sharp(bytes).metadata();
    assert(dimensions.width >= 1024 && dimensions.height >= 1024);
    fs.writeFileSync(imagePath, bytes);
    fs.writeFileSync(path.join(OUT, 'image-provider.json'), JSON.stringify({ ...image, dimensions, verifiedAt: new Date().toISOString() }, null, 2));
  }
  const hero = doc.sections.find((section) => section.type === 'hero');
  hero.props.image = { src: image.url, alt: image.alt, disclosure: image.disclosure };
  doc.seo.ogImage = image.url;
  const sourceCopy = JSON.stringify(doc.sections.map((section) => section.props));
  assert(!/\btrial\b|14.day|guaranteed|award.winning/i.test(sourceCopy), 'No unapproved offer or fabricated proof');
  assert.match(sourceCopy, /takeoff/i);
  assert.match(sourceCopy, /estimating/i);
  assert.match(sourceCopy, /selections/i);
  assert.equal(doc.sections.find((section) => section.type === 'services').props.items.length, 9);
  assert(!/Availability to be confirmed/.test(JSON.stringify(doc.sections)));
  assert.equal(doc.generation.capabilities.length, 9);
  const originalBrief = (await mock.pg.query('select brief from landing_campaigns where id=$1', [C])).rows[0].brief;
  assert.deepEqual(originalBrief, brief, 'Generation never overwrote the source campaign brief');
  await api(`pages/${pageId}`, { document: doc, baseRevision: 1 }, 'PUT');
  const published = await api(`pages/${pageId}`, { action: 'publish' });
  const publicUrl = published.publicUrl;
  browser = await puppeteer.launch({ headless: true, protocolTimeout: 300_000, args: ['--no-sandbox', '--disable-gpu', '--disable-gpu-compositing'] });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(300_000);
  page.setDefaultTimeout(60_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`${publicUrl}?utm_source=quality-test&utm_campaign=gr8-prelaunch`, { waitUntil: 'domcontentloaded', timeout: 300_000 });
  await page.waitForSelector('.lp-s-hero img');
  await page.waitForFunction(() => [...document.querySelectorAll('.lp-s-hero img')].every((image) => image.complete && image.naturalWidth > 0));
  await page.evaluate(() => document.fonts.ready);
  assert(await page.$eval('.lp-hero-ctas .lp-btn-primary', (element) => element.getBoundingClientRect().bottom <= innerHeight), 'Desktop first screen includes the complete registration action');
  async function screenshot(name, fullPage = false) {
    await sleep(900);
    await page.evaluate(() => document.fonts.ready);
    const bytes = await page.screenshot({ path: path.join(OUT, name), fullPage });
    assert((await sharp(bytes).stats()).entropy > 2, `Rendered screenshot: ${name}`);
  }
  await screenshot('desktop.png');
  await screenshot('desktop-full.png', true);
  await page.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 1 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.lp-s-hero img');
  await page.waitForFunction(() => {
    const image = document.querySelector('.lp-s-hero img');
    return image && image.complete && image.naturalWidth > 0;
  });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile has no horizontal overflow');
  assert(await page.$eval('.lp-s-hero img', (element) => element.getBoundingClientRect().top < innerHeight), 'The mobile first screen includes the campaign visual');
  assert(await page.$eval('.lp-hero-ctas .lp-btn-primary', (element) => element.getBoundingClientRect().bottom <= innerHeight), 'The mobile first screen includes the complete registration action');
  await screenshot('mobile.png');
  await screenshot('mobile-full.png', true);
  async function submit(email, demonstration) {
    await page.waitForSelector('[name="email"]');
    if (demonstration) {
      await page.click('.lp-hero-ctas a[href="#enquire-demo"]');
      await page.waitForFunction(() => document.querySelector('[name="enquiry_intent"]').value === 'Demonstration enquiry');
    }
    await page.type('[name="name"]', demonstration ? 'Demo Builder' : 'Registered Builder');
    await page.type('[name="email"]', email);
    await page.type('[name="business_name"]', 'Isolated Test Building Co');
    await page.click('.lp-consent input');
    await sleep(2700);
    await page.click('.lp-form button[type="submit"]');
    await page.waitForSelector('.lp-thanks', { timeout: 30_000 });
  }
  await submit('registration@example.test', false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await submit('demonstration@example.test', true);
  await screenshot('demonstration-confirmation.png');
  const submissions = (await mock.pg.query('select fields,attribution,status,lead_id,consent from landing_page_submissions order by created_at')).rows;
  assert.equal(submissions.length, 2);
  assert.equal(submissions[0].fields.enquiry_intent, 'Pre-launch registration');
  assert.equal(submissions[1].fields.enquiry_intent, 'Demonstration enquiry');
  assert(submissions.every((submission) => submission.status === 'synced' && submission.lead_id && submission.attribution.utm_campaign === 'gr8-prelaunch' && submission.consent));
  const notes = (await mock.pg.query('select note from lead_notes order by created_at')).rows;
  assert.match(notes[0].note, /Pre-launch registration/);
  assert.match(notes[1].note, /Demonstration enquiry/);
  fs.writeFileSync(path.join(OUT, 'crm-evidence.json'), JSON.stringify({ submissions, notes }, null, 2));
  // Real editor: manual non-hero copy edit, save/reopen and isolated republish.
  const editor = await browser.newPage();
  editor.setDefaultNavigationTimeout(300_000);
  await editor.evaluateOnNewDocument((value) => localStorage.setItem('sb-127-auth-token', value), JSON.stringify(session));
  await editor.goto(`${APP}/modules/landing-pages/editor/${pageId}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await editor.waitForSelector('[data-testid="canvas"] .lp-s-hero h1', { timeout: 180_000 });
  const benefit = doc.sections.find((section) => section.type === 'benefits');
  const manualText = `${benefit.props.items[0].body} Ask how this fits your workflow.`;
  const editBody = await editor.$(`[data-lp-path="${benefit.id}:items.0.body"]`);
  await editBody.click({ clickCount: 3 });
  await editor.keyboard.down('Control');
  await editor.keyboard.press('A');
  await editor.keyboard.up('Control');
  await editor.keyboard.type(manualText);
  await editor.keyboard.press('Tab');
  const saved = editor.waitForResponse((response) => response.url().includes(`/api/landing-pages/pages/${pageId}`) && response.request().method() === 'PUT' && response.status() === 200);
  await editor.click('[data-testid="save"]');
  await saved;
  let reopened = await api(`pages/${pageId}`, null, 'GET');
  assert.equal(reopened.page.document.sections.find((section) => section.id === benefit.id).props.items[0].body, manualText);
  assert.equal(reopened.page.document.sections[0].props.image.src, image.url);
  assert.equal(reopened.page.document.sections[0].variant, hero.variant);
  await editor.reload({ waitUntil: 'domcontentloaded' });
  await editor.waitForSelector('[data-testid="canvas"] .lp-s-hero h1', { timeout: 120_000 });
  assert.equal(await editor.$eval(`[data-lp-path="${benefit.id}:items.0.body"]`, (element) => element.innerText), manualText);
  const publication = await api(`pages/${pageId}`, { action: 'publish' });
  assert(publication.ok);
  await page.goto(publicUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.lp-s-benefits');
  assert((await page.$eval('.lp-s-benefits', (element) => element.innerText)).includes(manualText), 'Republished manual edit is visible');
  await editor.screenshot({ path: path.join(OUT, 'editor.png') });
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(OUT, 'accepted-document.json'), JSON.stringify(reopened.page.document, null, 2));
  const attempts = JSON.parse(fs.readFileSync(path.join(OUT, 'image-request-attempted.json'), 'utf8'));
  const results = { ok: true, publicUrl, editorUrl: `${APP}/modules/landing-pages/editor/${pageId}`, isolated: true, productionWrites: 0, imageProvider: 'openai', imageRequests: attempts.requests || 1, successfulImageGenerations: 1, cachedReplay: !generation, capabilityCount: 9, registrationAndDemoCrmVerified: true, viewport: { desktop: '1440x1000', mobile: '390x844' }, errors };
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  await browser.close(); browser = null;
  if (KEEP) {
    console.log(`READY: isolated candidate remains available at ${publicUrl}`);
    process.on('SIGINT', async () => { await cleanup(); process.exit(0); });
    process.on('SIGTERM', async () => { await cleanup(); process.exit(0); });
  } else await cleanup();
} catch (error) {
  console.error(error);
  if (browser) for (const [index, page] of (await browser.pages()).entries()) await page.screenshot({ path: path.join(OUT, `failure-${index}.png`) });
  await cleanup();
  process.exitCode = 1;
}
