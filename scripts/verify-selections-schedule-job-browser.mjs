// Browser verification of the Inclusions & Selections Schedule against a COPY of a saved job.
// The copy is opened in an isolated headless browser profile under a new job id; the original job
// is never opened and cloud writes are blocked. Needs the dev server (default http://localhost:3000).
// Every schedule page is mounted, measured (does the table fit its page?), checked for raw values and
// for product images that failed to load, and screenshotted.
//
// Run: node --max-old-space-size=8192 --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/verify-selections-schedule-job-browser.mjs <job.json>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import { buildSelectionsSchedule } from '../lib/builders/selectionsScheduleDocument.js';

dotenv.config({ path: '.env.local', quiet: true }); dotenv.config({ path: '.env', quiet: true });
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out = path.resolve('artifacts/test-artifacts/selections-schedule-job-verification'); fs.mkdirSync(out, { recursive: true });
const jobFile = process.argv[2];
assert(jobFile && fs.existsSync(jobFile), 'Pass the saved job JSON to verify.');
const saved = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
const projectId = `local-schedule-verify-${Date.now()}`;
// The embedded estimate documents (~90 MB of page images) play no part in the schedule and are left out of the copy.
const { projectEstimateBuilder, ...kept } = saved.workbook;
const workbook = { ...kept, projectId, registeredJobId: projectId, jobId: projectId, templateType: 'job', page: 'quotation',
  registeredJob: { ...(kept.registeredJob || {}), jobId: projectId, jobName: 'Schedule verification copy' }, jobFileMeta: { ...(kept.jobFileMeta || {}), projectId, jobName: 'Schedule verification copy' } };
const fixture = path.join(out, 'job-copy.json'); fs.writeFileSync(fixture, JSON.stringify({ projectId, jobName: 'Schedule verification copy', workbook }));
const expected = buildSelectionsSchedule(workbook.clientSelectionsBook, {
  firstPageNumber: 3,
  exteriorWalls: workbook.takeoffEngine?.lastJobSetupSync?.payload?.schedule?.projectTotals?.exteriorWalls || [],
});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
assert(url && anon && service, 'Existing test account authentication requires Supabase environment values.');
const admin = createClient(url, service, { auth: { persistSession: false } });
const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email: process.env.PRODUCT_LIBRARY_TEST_EMAIL || 'support@gr8result.com' });
if (linkError) throw linkError;
const { data: auth, error: authError } = await createClient(url, anon, { auth: { persistSession: false } }).auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });
if (authError) throw authError;
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 600000, defaultViewport: { width: 1920, height: 1200 } });

const report = { job: saved.name || saved.workbook.jobName, revision: saved.revision, savedAt: saved.savedAt, expectedPages: expected.pages.length, expectedRows: expected.rows.length, pages: [], runtimeErrors: [], blockedCloudWrites: 0 };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let page;
try {
  page = await browser.newPage(); page.setDefaultTimeout(180000);
  page.on('pageerror', error => report.runtimeErrors.push(error.message.slice(0, 300))); page.on('dialog', dialog => dialog.accept());
  await page.setRequestInterception(true);
  page.on('request', request => { if (/\/(rest|storage)\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) { report.blockedCloudWrites += 1; void request.abort(); } else void request.continue(); });
  await page.evaluateOnNewDocument(({ key, session, workspace }) => { localStorage.setItem(key, JSON.stringify(session)); localStorage.setItem('active_workspace_id', workspace); },
    { key: `sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session: auth.session, workspace: workbook.workspaceId });

  await page.goto(`${origin}/modules/estimate-builder?page=quotation`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]'); await input.uploadFile(fixture);
  for (let n = 0; n < 8; n += 1) { await delay(400); await page.evaluate(() => { for (const text of ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local']) [...document.querySelectorAll('button')].find(b => !b.disabled && b.innerText.trim() === text)?.click(); }); }
  await page.waitForFunction(() => document.querySelectorAll('[data-quote-section]').length > 5, { timeout: 300000 });
  await delay(4000);
  // Client Selections for the job that is open in this tab: through the workspace menu, so the job
  // stays the tab's job (a bare address without its job id opens no job).
  const reviewReady = () => page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.innerText.trim() === 'Review Schedule'), { timeout: 120000 }).then(() => true, () => false);
  await page.evaluate(() => [...document.querySelectorAll('button, a')].find(element => element.innerText.trim() === 'Client Selections')?.click());
  if (!(await reviewReady())) {
    await page.goto(`${origin}/modules/estimate-builder?jobId=${encodeURIComponent(projectId)}&page=clientSelections`, { waitUntil: 'domcontentloaded', timeout: 240000 });
    assert(await reviewReady(), 'Client Selections did not open for the job copy.');
  }
  await delay(3000);
  await page.evaluate(() => [...document.querySelectorAll('button')].find(button => button.innerText.trim() === 'Review Schedule').click());
  await page.waitForSelector('[data-testid="schedule-reconciliation"]', { timeout: 120000 });
  // The job's Selections Book arrives a moment after the screen does.
  await page.waitForFunction(() => document.querySelectorAll('.documentPageFrame').length > 3, { timeout: 120000 }).catch(() => {});
  report.reconciliation = await page.$eval('[data-testid="schedule-reconciliation"]', element => ({ ok: element.dataset.scheduleOk, savedRecords: Number(element.querySelector('[data-schedule-saved-records]')?.dataset.scheduleSavedRecords || 0), eligibleRecords: Number(element.querySelector('[data-schedule-eligible-records]')?.dataset.scheduleEligibleRecords || 0), representedRecords: Number(element.querySelector('[data-schedule-represented-records]')?.dataset.scheduleRepresentedRecords || 0), sourceEntries: Number(element.querySelector('[data-schedule-source-entries]')?.dataset.scheduleSourceEntries || 0), missingRecords: Number(element.querySelector('[data-schedule-missing-records]')?.dataset.scheduleMissingRecords || 0), text: element.innerText.replace(/\s+/g, ' ').trim() }));
  report.pageSelector = await page.$$eval('.pageSelect option', options => options.map(option => option.textContent.trim()));

  // Mount each page in turn (offscreen pages are released), then measure and photograph it.
  const frames = await page.$$('.documentPageFrame');
  report.frameCount = frames.length;
  for (let index = 0; index < frames.length; index += 1) {
    await frames[index].evaluate(element => element.scrollIntoView({ block: 'center' }));
    await page.waitForFunction(element => element.querySelector('.page'), { timeout: 60000 }, frames[index]);
    await delay(900);
    const info = await frames[index].evaluate(async element => {
      const sheet = element.querySelector('.selectionsSchedulePage');
      const any = element.querySelector('.page');
      if (!sheet) return { kind: any.className.replace(/\s+/g, ' '), heading: any.querySelector('h1, h2')?.innerText.replace(/\s+/g, ' ').trim() || '', rawObjects: /\[object /.test(any.innerText) };
      const images = [...sheet.querySelectorAll('.ssImage img')];
      await Promise.all(images.map(image => image.complete ? null : new Promise(resolve => { image.onload = image.onerror = resolve; setTimeout(resolve, 8000); })));
      const body = sheet.querySelector('.ssBody'), table = sheet.querySelector('.ssTable');
      const style = getComputedStyle(body);
      const room = body.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      return { kind: 'schedule', number: Number(sheet.dataset.schedulePage), section: sheet.dataset.scheduleSection, heading: sheet.querySelector('.ssHeader h2').innerText.replace(/\s+/g, ' ').trim(),
        footer: sheet.querySelector('.ssFooter strong').innerText.trim(), rows: sheet.querySelectorAll('.ssRow').length, expectedRows: Number(sheet.dataset.scheduleRowCount), modelFill: Number(sheet.dataset.scheduleFill),
        tableHeight: Math.round(table.getBoundingClientRect().height), bodyRoom: Math.round(room), measuredFill: Math.round((table.getBoundingClientRect().height / room) * 100) / 100, overflows: table.getBoundingClientRect().height > room + 1,
        groups: [...sheet.querySelectorAll('.ssGroup td')].map(cell => cell.innerText.trim()), sections: [...sheet.querySelectorAll('.ssSection td')].map(cell => cell.innerText.trim()),
        images: images.length, brokenImages: images.filter(image => !image.naturalWidth).map(image => image.alt), swatches: sheet.querySelectorAll('.ssSwatch').length,
        rawObjects: /\[object |undefined|NaN/.test(sheet.innerText), pricing: /\$\s?\d|allowance|supplier quote/i.test(sheet.innerText), fontPx: Math.round(parseFloat(getComputedStyle(sheet.querySelector('.ssRow td')).fontSize) * 10) / 10,
        text: [...sheet.querySelectorAll('.ssRow')].map(row => [...row.querySelectorAll('td')].map(cell => cell.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | ')) };
    });
    report.pages.push(info);
    const sheet = await frames[index].$('.page');
    await sheet.screenshot({ path: path.join(out, `page-${String(index + 1).padStart(2, '0')}.png`) });
  }
  const schedulePages = report.pages.filter(item => item.kind === 'schedule');
  report.summary = { schedulePages: schedulePages.length, rows: schedulePages.reduce((total, item) => total + item.rows, 0), overflowing: schedulePages.filter(item => item.overflows).map(item => item.number),
    sparse: schedulePages.slice(0, -1).filter(item => item.measuredFill < 0.6).map(item => `${item.number}:${item.measuredFill}`), rawObjects: report.pages.filter(item => item.rawObjects).length, pricing: schedulePages.filter(item => item.pricing).map(item => item.number),
    brokenImages: schedulePages.flatMap(item => item.brokenImages), images: schedulePages.reduce((total, item) => total + item.images, 0), sectionsInOrder: schedulePages.flatMap(item => item.sections),
    wrongHeading: schedulePages.filter(item => !new RegExp(`^${{ exterior: '1\\. EXTERIOR SELECTIONS', interior: '2\\. INTERIOR SELECTIONS', painting: '3\\. PAINTING SCHEDULE' }[item.section]}`, 'i').test(item.heading)).map(item => item.number) };
  report.passed = schedulePages.length === expected.pages.length && report.summary.rows === expected.rows.length && report.reconciliation.savedRecords === expected.reconciliation.records.saved && report.reconciliation.eligibleRecords === expected.reconciliation.records.eligible && report.reconciliation.representedRecords === expected.reconciliation.records.represented && report.reconciliation.sourceEntries === expected.reconciliation.scheduleSourceEntries && report.reconciliation.missingRecords === 0 && !report.summary.overflowing.length && !report.summary.sparse.length && !report.summary.rawObjects && !report.summary.pricing.length
    && !report.summary.wrongHeading.length && report.reconciliation.ok === 'true' && report.runtimeErrors.length === 0;
} catch (error) { report.error = String(error.stack).slice(0, 1500); if (page) await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: false }).catch(() => {}); }
finally { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); const { pages, ...brief } = report; console.log(JSON.stringify({ ...brief, pages: pages.map(({ text, ...rest }) => rest) }, null, 1)); await browser.close(); }
if (!report.passed) process.exitCode = 1;
