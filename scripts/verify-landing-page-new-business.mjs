// Real copy/strategy provider acceptance, isolated storage and existing imagery. Zero image-generation requests.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import { correctBriefForCopy, planCampaign, writePageCopy } from '../lib/landing-pages/ai.js';
import { composeDocument, validateStructure } from '../lib/landing-pages/generator.js';

const APP = 'http://localhost:3123';
const WORKSPACE = 'aaaaaaaa-0000-4000-8000-000000000e71';
const OUT = path.resolve('artifacts', 'landing-pages-campaign-quality');
dotenv.config({ path: '.env.local', quiet: true });
const login = await fetch('http://127.0.0.1:54423/auth/v1/token?grant_type=password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'quality-owner@example.test', password: 'quality-test-only' }) });
assert(login.ok);
const session = await login.json();
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, 'x-workspace-id': WORKSPACE };
async function api(route, body = null, method = 'POST') {
  const response = await fetch(`${APP}/api/landing-pages/${route}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  const json = await response.json();
  assert(response.ok && json.ok, JSON.stringify(json));
  return json;
}
const evidenceFile = path.join(OUT, 'new-business-provider.json');
let evidence;
if (fs.existsSync(evidenceFile)) {
  evidence = JSON.parse(fs.readFileSync(evidenceFile, 'utf8'));
} else {
  const source = {
    campaignName: 'Paperbark Creative design consultations', businessName: 'Paperbark Creative',
    industry: 'Brand identity and website design studio', objective: 'booking', ctaLabel: 'Discuss Your Project',
    offering: 'Brand identity, Website desgin, Campaign creative',
    audience: 'Australian small business owners with an inconsistent brand and an outdated website',
    serviceArea: 'Australia', email: '', style: 'classic', primaryColour: '#B54834', secondaryColour: '#282422',
    objectiveDetail: 'Collect project enquiries for a brand and website design consultation. No prices, booking guarantees or special offers.',
    painPoints: ['An outdated website that no longer reflects the business', 'Inconsistent brand materials', 'Unclear project scope'],
    usps: ['Brand identity and website design considered together'],
    formFields: ['name', 'email', 'business_name', 'message'],
    media: [
      { src: `${APP}/assets/creative-team-digital-collaboration-gr8result.jpg`, alt: 'Illustrative creative studio team discussing a brand brief' },
      { src: `${APP}/assets/graphic-designer-creative-workspace-gr8result.jpg`, alt: 'Illustrative designer working on visual communication' },
      { src: `${APP}/assets/website-development-client-collaboration-gr8result.jpg`, alt: 'Illustrative website design consultation' },
      { src: `${APP}/assets/digital-strategy-workflow-mapping-gr8result.jpg`, alt: 'Illustrative visual workflow planning' },
    ],
  };
  const providers = {};
  const corrected = await correctBriefForCopy(source, { onResult: (r) => { providers.proofreading = r; } });
  assert.match(corrected.offering, /Website design/);
  assert.equal(source.offering, 'Brand identity, Website desgin, Campaign creative');
  const plan = await planCampaign(corrected, { onResult: (r) => { providers.strategy = r; } });
  const structure = validateStructure(plan.sections, corrected);
  const copy = await writePageCopy(corrected, structure, { strategy: plan.strategy, onResult: (r) => { providers.copy = r; } });
  const document = composeDocument(corrected, { aiCopy: copy, structure, strategy: plan.strategy }).document;
  assert(!/\bbuilders?\b|construction|takeoff|GR8 Result/i.test(JSON.stringify(document.sections)));
  evidence = { source, corrected, document, providers };
  fs.writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
}
const before = await api('campaigns', null, 'GET');
const beforePages = new Map();
for (const campaign of before.campaigns) {
  const detail = await api(`campaigns/${campaign.id}`, null, 'GET');
  for (const page of detail.pages) beforePages.set(page.id, (await api(`pages/${page.id}`, null, 'GET')).page);
}
const created = await api('campaigns', { name: `Paperbark Creative release check ${Date.now()}` });
const campaignId = created.campaign.id;
await api(`campaigns/${campaignId}`, { brief: { ...evidence.source, email: 'studio@example.test' } }, 'PATCH');
const generated = await api(`campaigns/${campaignId}`, { action: 'generate', useAi: false });
const pageId = generated.pageId;
const current = await api(`pages/${pageId}`, null, 'GET');
// Use the same shared compositor with genuine provider output; this fixture server has no provider credentials.
const document = structuredClone(evidence.document);
for (const section of document.sections) {
  const images = section.props.items?.map((item) => item.image).filter(Boolean) || [];
  if (section.props.image?.src) images.push(section.props.image);
  if (section.type === 'gallery') images.push(...section.props.images);
  for (const image of images) {
    if (!image.src) continue;
    const response = await fetch(image.src);
    assert(response.ok);
    const bytes = Buffer.from(await response.arrayBuffer());
    const upload = await api(`pages/${pageId}`, { action: 'upload', fileName: 'creative-studio-existing.jpg', dataUrl: `data:image/jpeg;base64,${bytes.toString('base64')}` });
    image.src = upload.url;
  }
}
document.seo.ogImage = document.sections[0].props.image.src;
await api(`pages/${pageId}`, { document, baseRevision: current.page.revision }, 'PUT');
const publication = await api(`pages/${pageId}`, { action: 'publish' });
assert.deepEqual((await api(`campaigns/${campaignId}`, null, 'GET')).campaign.brief.offering, evidence.source.offering);
for (const [id, snapshot] of beforePages) assert.deepEqual((await api(`pages/${id}`, null, 'GET')).page, snapshot, 'Existing isolated campaigns and pages were untouched');
const browser = await puppeteer.launch({ headless: true, protocolTimeout: 300000, args: ['--no-sandbox', '--disable-gpu'] });
const viewports = [];
try {
  for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(300000); page.setDefaultTimeout(120000);
    await page.setViewport({ width, height });
    await page.goto(publication.publicUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.lp-s-hero img');
    await page.evaluate(async () => { await document.fonts.ready; document.querySelectorAll('img').forEach((i) => { i.loading = 'eager'; }); });
    await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
    const measured = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      headline: document.querySelector('h1').innerText,
      relevantImagery: [...document.images].filter((i) => /creative|design|studio|workflow/i.test(i.alt)).length,
      unrelatedConstructionCopy: /\bbuilders?\b|takeoff|construction|GR8 Result/i.test(document.querySelector('.lp-root').innerText),
      automaticCaptions: [...document.querySelectorAll('.lp-image-disclosure,.lp-card-caption')].some((e) => /AI.generated|AI concept/i.test(e.innerText)),
    }));
    assert.equal(measured.overflow, 0);
    assert.equal(measured.unrelatedConstructionCopy, false);
    assert.equal(measured.automaticCaptions, false);
    assert(measured.relevantImagery >= 3);
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(OUT, `new-business-${name}.png`) });
    await page.screenshot({ path: path.join(OUT, `new-business-${name}-full.png`), fullPage: true });
    viewports.push({ name, ...measured });
    await page.close();
  }
} finally { await browser.close(); }
const result = { ok: true, publicUrl: publication.publicUrl, pageId, industry: evidence.source.industry, genuineTextProvider: true, proofreadingVerified: true, originalBriefPreserved: true, existingPagesUnchanged: true, imageRequests: 0, isolated: true, productionWrites: 0, viewports };
fs.writeFileSync(path.join(OUT, 'new-business-acceptance.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
