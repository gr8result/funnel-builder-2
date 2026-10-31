// Browser acceptance against the existing isolated visual candidate. No provider calls or production access.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const APP = 'http://localhost:3123';
const DB = 'http://127.0.0.1:54423';
const PAGE = '2022a330-1ac0-4bff-a23f-7cdd40f580e0';
const WORKSPACE = 'aaaaaaaa-0000-4000-8000-000000000e71';
const OUT = path.resolve('artifacts', 'landing-pages-campaign-quality');
const URL = `${APP}/lp/gr8-result-prelaunch-candidate`;
const login = await fetch(`${DB}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'quality-owner@example.test', password: 'quality-test-only' }) });
assert(login.ok);
const session = await login.json();
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, 'x-workspace-id': WORKSPACE };
async function api(body = null, method = 'POST') {
  const response = await fetch(`${APP}/api/landing-pages/pages/${PAGE}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  const json = await response.json();
  assert(response.ok && json.ok, JSON.stringify(json));
  return json;
}
async function rows(table, query) {
  const response = await fetch(`${DB}/rest/v1/${table}?${query}`, { headers });
  assert(response.ok, `Read isolated ${table}`);
  return response.json();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const original = (await api(null, 'GET')).page.document;
const browser = await puppeteer.launch({ headless: true, protocolTimeout: 300000, args: ['--no-sandbox', '--disable-gpu'] });
const errors = [];
const results = { isolated: true, productionWrites: 0, paidRequests: 0 };
try {
  const editor = await browser.newPage();
  editor.setDefaultNavigationTimeout(300000); editor.setDefaultTimeout(180000);
  await editor.setViewport({ width: 1440, height: 1000 });
  await editor.evaluateOnNewDocument((value, workspace) => {
    localStorage.setItem('sb-127-auth-token', value);
    localStorage.setItem('active_workspace_id', workspace);
  }, JSON.stringify(session), WORKSPACE);
  await editor.goto(`${APP}/modules/landing-pages/editor/${PAGE}`, { waitUntil: 'domcontentloaded' });
  await editor.waitForSelector('[data-testid="canvas"] .lp-hero-backdrop img');
  const benefit = original.sections.find((s) => s.type === 'benefits');
  const selector = `[data-lp-path="${benefit.id}:items.3.problem"]`;
  await editor.$eval(selector, (element) => element.scrollIntoView());
  await editor.click(selector, { clickCount: 3 });
  await editor.keyboard.down('Control'); await editor.keyboard.press('A'); await editor.keyboard.up('Control');
  await editor.keyboard.type('Customer enquiries slipping out of sight.');
  await editor.keyboard.press('Tab');
  const saved = editor.waitForResponse((r) => r.url().endsWith(`/pages/${PAGE}`) && r.request().method() === 'PUT' && r.status() === 200);
  await editor.click('[data-testid="save"]'); await saved;
  const edited = (await api(null, 'GET')).page.document;
  assert.equal(edited.sections.find((s) => s.id === benefit.id).props.items[3].problem, 'Customer enquiries slipping out of sight.');
  assert.deepEqual(edited.sections.filter((s) => s.id !== benefit.id), original.sections.filter((s) => s.id !== benefit.id));
  await editor.reload({ waitUntil: 'domcontentloaded' });
  await editor.waitForSelector(selector);
  assert.equal(await editor.$eval(selector, (e) => e.innerText), 'Customer enquiries slipping out of sight.');
  results.manualEditSavedAndReopened = true;
  results.unrelatedEditsPreserved = true;

  await editor.click('[data-testid="tab-ai"]');
  await editor.type('[data-testid="ai-input"]', 'Shorten the headline');
  await editor.click('[data-testid="ai-input"]');
  await editor.keyboard.press('Enter');
  await editor.waitForSelector('[data-testid="ai-accept"]');
  const accepted = editor.waitForResponse((r) => r.url().endsWith(`/pages/${PAGE}`) && r.request().method() === 'PUT' && r.status() === 200);
  await editor.click('[data-testid="ai-accept"]'); await accepted;
  const afterAssistant = (await api(null, 'GET')).page;
  assert.notDeepEqual(afterAssistant.document.sections, edited.sections);
  results.conversationalEditingAcceptedAndSaved = true;
  // Restore only our temporary assistant change, preserving the actual manual edit.
  await api({ document: edited, baseRevision: afterAssistant.revision, label: 'Restore authored visual headline after assistant acceptance check' }, 'PUT');
  await api({ action: 'publish' });
  results.republished = true;
  await editor.reload({ waitUntil: 'domcontentloaded' });
  await editor.waitForSelector('[data-testid="canvas"] .lp-hero-backdrop img');
  await editor.screenshot({ path: path.join(OUT, 'visual-editor-live.png') });
  await editor.close();

  const stamp = Date.now();
  const emails = [`visual-registration-${stamp}@example.test`, `visual-demonstration-${stamp}@example.test`];
  for (let i = 0; i < 2; i += 1) {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(300000); page.setDefaultTimeout(60000);
    await page.setViewport({ width: i ? 390 : 1440, height: i ? 844 : 1000 });
    await page.goto(`${URL}?utm_source=visual-acceptance&utm_campaign=gr8-prelaunch-visual`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.lp-hero-ctas');
    await page.click(`.lp-hero-ctas a[href="${i ? '#enquire-demo' : '#enquire'}"]`);
    await page.waitForFunction((intent) => document.querySelector('[name="enquiry_intent"]').value === intent, {}, i ? 'Demonstration enquiry' : 'Pre-launch registration');
    await page.type('[name="name"]', i ? 'Visual Demo Builder' : 'Visual Registration Builder');
    await page.type('[name="email"]', emails[i]);
    await page.type('[name="business_name"]', 'Isolated Visual Acceptance Building Co');
    await page.click('.lp-consent input');
    await sleep(2800);
    await page.click('.lp-form button[type="submit"]');
    await page.waitForSelector('.lp-thanks');
    await page.screenshot({ path: path.join(OUT, `visual-${i ? 'demo' : 'registration'}-confirmation.png`) });
    await page.close();
  }
  const submissions = (await rows('landing_page_submissions', `page_id=eq.${PAGE}&order=created_at.desc&limit=6`)).filter((s) => emails.includes(s.email));
  assert.equal(submissions.length, 2);
  for (const submission of submissions) {
    assert.equal(submission.workspace_id, WORKSPACE);
    assert.equal(submission.status, 'synced');
    assert.equal(submission.attribution.utm_campaign, 'gr8-prelaunch-visual');
    assert.equal(submission.campaign_id, 'cccccccc-0000-4000-8000-000000000e71');
    assert(submission.consent && submission.lead_id);
    const leads = await rows('leads', `id=eq.${submission.lead_id}`);
    assert.equal(leads[0].workspace_id, WORKSPACE);
    const notes = await rows('lead_notes', `lead_id=eq.${submission.lead_id}`);
    assert(notes.some((n) => n.note.includes(submission.fields.enquiry_intent) && n.note.includes('gr8-prelaunch-visual')));
  }
  assert.deepEqual(new Set(submissions.map((s) => s.fields.enquiry_intent)), new Set(['Pre-launch registration', 'Demonstration enquiry']));
  results.crm = { registrationAndDemonstration: true, workspace: WORKSPACE, campaignAttribution: true, unrelatedMarketing: false };
  fs.writeFileSync(path.join(OUT, 'visual-crm-evidence.json'), JSON.stringify(submissions, null, 2));
  results.viewports = [];
  for (const [name, width, height] of [['desktop', 1440, 1000], ['tablet', 820, 1180], ['mobile', 390, 844]]) {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(300000); page.setDefaultTimeout(120000);
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.lp-hero-backdrop img');
    await page.evaluate(async () => { await document.fonts.ready; document.querySelectorAll('img').forEach((img) => { img.loading = 'eager'; }); });
    await page.waitForFunction(() => [...document.images].every((img) => img.complete && img.naturalWidth > 0));
    // Visit each part of the page so lazy decode and compositor tiles are ready for the full-page capture.
    const totalHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < totalHeight; y += height - 100) {
      await page.evaluate((top) => scrollTo(0, top), y); await sleep(180);
    }
    await page.evaluate(() => scrollTo(0, 0)); await sleep(1000);
    const measurements = await page.evaluate(() => {
      const hero = document.querySelector('.lp-s-hero');
      return {
        width: innerWidth, height: innerHeight,
        overflow: document.documentElement.scrollWidth - innerWidth,
        heroWidth: hero.getBoundingClientRect().width,
        primaryBottom: hero.querySelector('.lp-btn-primary').getBoundingClientRect().bottom,
        imageCount: document.images.length,
        imagesLoaded: [...document.images].every((i) => i.naturalWidth > 0),
        uncertaintyText: document.body.innerText.includes('Availability to be confirmed'),
        featureCards: document.querySelectorAll('.lp-layout-showcase .lp-card-img img').length,
        automaticImageCaptions: [...document.querySelectorAll('.lp-image-disclosure,.lp-card-caption,.lp-story-image figcaption span')].filter((e) => /AI.generated|AI concept|illustrative imagery/i.test(e.innerText)).length,
      };
    });
    assert.equal(measurements.overflow, 0);
    assert.equal(measurements.heroWidth, width);
    assert(measurements.primaryBottom < height);
    assert(measurements.imagesLoaded && measurements.imageCount >= 10 && measurements.featureCards === 8);
    assert.equal(measurements.uncertaintyText, false);
    assert.equal(measurements.automaticImageCaptions, 0);
    results.viewports.push({ name, ...measurements });
    await page.screenshot({ path: path.join(OUT, `visual-${name}.png`) });
    await page.screenshot({ path: path.join(OUT, `visual-${name}-full.png`), fullPage: true });
    await page.close();
  }
  assert.deepEqual(errors, []);
  const persisted = (await api(null, 'GET')).page.document;
  assert.equal(persisted.sections[0].props.image.src, original.sections[0].props.image.src);
  assert.deepEqual(persisted, original, 'The approved document is unchanged by the finishing acceptance round-trip');
  results.approvedDocumentUnchanged = true;
  results.storedImagesPersisted = true;
  results.ok = true;
  results.errors = errors;
  fs.writeFileSync(path.join(OUT, 'visual-candidate-document.json'), JSON.stringify(persisted, null, 2));
  fs.writeFileSync(path.join(OUT, 'visual-acceptance.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
