// Real-application check on a COPY of a builder's saved takeoff job (decoded read-only from the browser's own
// storage), never the job itself. The copy is opened in an isolated headless Chrome profile against the live
// Takeoff bundle; every request off this test server is blocked, so nothing reaches the builder's storage,
// Supabase or OpenAI. The original plan PDF is relinked through the screen's own "Relink Original Plan" input.
//
// Steps: screenshots of the job as saved; Re-measure (local, no AI) through the screen's button; the room list,
// outdoor areas and screenshots of each floor sheet; a room picked from the list (highlighted, centred,
// approved through its own button); rerun refused without duplicates; save and reopen; the quotation gate.
//
//   GR8_JOB_COPY     JSON file { name, workbook } (the decoded copy)
//   GR8_PLAN_PDF     the job's original plan PDF
//   GR8_BUNDLE_DIR   folder holding browser-bundle.js (test-takeoff-vector-plan-browser.mjs, GR8_BUNDLE_ONLY=1)
//   GR8_FOCUS_ROOM   room to pick and approve (default: the first room on the last measured sheet)
//   TAKEOFF_COPY_OUT output folder
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jobFile = process.env.GR8_JOB_COPY;
const pdf = process.env.GR8_PLAN_PDF;
assert.ok(jobFile && fs.existsSync(jobFile), 'GR8_JOB_COPY must name the decoded job copy');
assert.ok(pdf && fs.existsSync(pdf), 'GR8_PLAN_PDF must name the plan PDF');
const bundleDir = path.resolve(process.env.GR8_BUNDLE_DIR || path.join(root, 'artifacts/test-results/takeoff-vector-plan-browser'));
const out = path.resolve(process.env.TAKEOFF_COPY_OUT || path.join(root, 'artifacts/test-results/takeoff-job-copy-browser'));
fs.mkdirSync(out, { recursive: true });
const apiRequests = [];

const server = http.createServer((req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(path.join(bundleDir, 'browser-bundle.js')).pipe(res); return; }
  if (req.url === '/job-copy.json') { res.setHeader('Content-Type', 'application/json'); fs.createReadStream(jobFile).pipe(res); return; }
  const ocrFile = /^\/takeoff-ocr\/((?:core|tessdata)\/)?[A-Za-z0-9._-]+$/.test(req.url) ? path.join(root, 'public', req.url) : null;
  if (ocrFile && fs.existsSync(ocrFile)) { res.setHeader('Content-Type', ocrFile.endsWith('.js') ? 'application/javascript' : 'application/octet-stream'); if (req.method === 'HEAD') { res.end(); return; } fs.createReadStream(ocrFile).pipe(res); return; }
  if (ocrFile) { res.statusCode = 404; res.end(); return; }
  if (req.url === '/pdfjs/pdf.worker.min.mjs') { res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(path.join(root, 'public/pdfjs/pdf.worker.min.mjs')).pipe(res); return; }
  if (req.url.startsWith('/api/')) { apiRequests.push({ url: req.url, at: new Date().toISOString() }); res.statusCode = 503; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: false, code: 'provider_disabled', error: 'OpenAI is disabled in this check.' })); return; }
  res.setHeader('Content-Type', 'text/html');
  res.end('<!doctype html><meta charset="utf-8"><title>Takeoff job copy</title><style>html,body,#root{height:100%;margin:0;font-family:Arial}</style><div id="root"></div><script src="/bundle.js"></script>');
});

const report = { jobFile: path.basename(jobFile), errors: [], dialogs: [], steps: [], screenshots: [] };
const step = (label, data) => { console.log(`${new Date().toISOString()} ${label}${data ? ` ${JSON.stringify(data)}` : ''}`); report.steps.push({ at: new Date().toISOString(), label, ...(data ? { data } : {}) }); };
let browser, page, memoryWatch;
const settle = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const snapshot = () => page.evaluate(() => harness.snapshot());
const shot = async (name) => { const file = path.join(out, `${name}.png`); await settle(); await new Promise((r) => setTimeout(r, 400)); await page.screenshot({ path: file }); report.screenshots.push(file); };
async function goToPage(number) { await page.evaluate((value) => harness.goToPage(value), number); await page.waitForFunction((value) => harness.snapshot().currentPage === value && harness.snapshot().imageReady, { timeout: 120000 }, number); await settle(); await new Promise((r) => setTimeout(r, 600)); }
async function save() {
  const before = await page.evaluate(() => harness.saveInputs().length);
  await page.evaluate(() => document.getElementById('ai-plan-takeoff-save-button').click());
  await page.waitForFunction((count) => harness.saveInputs().length > count, { timeout: 900000 }, before);
  for (let stable = 0, started = Date.now(); stable < 3;) {
    await new Promise((r) => setTimeout(r, 1000));
    stable = (await page.evaluate(() => harness.saveResults().length >= harness.saveInputs().length)) ? stable + 1 : 0;
    if (Date.now() - started > 900000) throw new Error('saves did not finish within 15 minutes');
  }
  const last = await page.evaluate(() => harness.saveResults().at(-1));
  assert.equal(last?.ok, true, `save succeeded (${last?.message || ''})`);
}
const roomsOf = (state) => (state.aiAnalysis?.rooms || []).map((room) => ({ id: room.id, page: room.page, name: room.name, areaM2: Number(room.areaM2?.toFixed?.(2) ?? room.areaM2), confirmed: Boolean(room.confirmed) }));
const counts = (state) => ({ walls: state.completedWallRuns.length, openings: state.placedOpenings.length, floorAreas: state.completedFloorplans.length,
  rooms: (state.aiAnalysis?.rooms || []).length, approved: (state.aiAnalysis?.rooms || []).filter((room) => room.confirmed).map((room) => room.id).sort() });
const panelText = () => page.evaluate(() => document.querySelector('[data-testid="room-boundary-panel"]')?.innerText || '');

try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  step('isolated server', { origin });
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 3600000,
    userDataDir: path.join(out, `profile-${Date.now()}`), args: ['--no-first-run', '--disable-extensions', '--window-size=1700,1150'], defaultViewport: { width: 1700, height: 1150 } });
  const minCommitMb = Number(process.env.GR8_MIN_FREE_COMMIT_MB) || 1200;
  if (process.platform === 'win32') memoryWatch = setInterval(() => {
    execFile('powershell.exe', ['-NoProfile', '-Command', '$m=Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory; $o=Get-CimInstance Win32_OperatingSystem; @{commitFreeMB=($m.CommitLimit-$m.CommittedBytes)/1MB;physicalFreeMB=$o.FreePhysicalMemory/1024} | ConvertTo-Json -Compress'], { windowsHide: true, timeout: 10000 }, (error, stdout) => {
      if (error) return; let sample; try { sample = JSON.parse(stdout); } catch { return; }
      if (sample.commitFreeMB < minCommitMb || sample.physicalFreeMB < 800) { const reason = `Memory guard: free commit ${Math.round(sample.commitFreeMB)} MB, physical ${Math.round(sample.physicalFreeMB)} MB; closing this test browser.`; report.errors.push(reason); console.error(reason); clearInterval(memoryWatch); void browser.close().catch(() => {}); }
    });
  }, 5000);
  page = await browser.newPage();
  page.setDefaultTimeout(240000);
  page.on('pageerror', (error) => { report.errors.push(error.message); console.error('Browser error:', error.message); });
  page.on('dialog', async (dialog) => { report.dialogs.push(dialog.message()); await dialog.accept(); });
  await page.setRequestInterception(true);
  page.on('request', (request) => request.url().startsWith(origin) || /^(data|blob):/.test(request.url()) ? request.continue() : request.abort());
  await page.evaluateOnNewDocument(({ storageKey, session }) => { localStorage.setItem(storageKey, JSON.stringify(session)); }, {
    storageKey: 'sb-stubbedtakeoff-auth-token',
    session: { access_token: 'stub-access-token', refresh_token: 'stub-refresh', token_type: 'bearer', expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, user: { id: 'stub-user', aud: 'authenticated', role: 'authenticated', email: 'stub@example.test' } },
  });
  await page.goto(origin, { waitUntil: 'load', timeout: 300000 });
  await page.waitForFunction(() => window.harness?.ready());

  // 1. The copy of the saved job, and its original plan relinked.
  await page.evaluate(async () => { const source = await (await fetch('/job-copy.json')).json(); return harness.loadCopy(source); });
  // The saved takeoff opens once its plan file is relinked (the plan itself is not stored in the job).
  // The screen reports the missing plan images and offers to relink the original PDF; that input is used.
  await page.waitForFunction(() => /Plan could not be loaded/.test(document.body.innerText), { timeout: 300000 });
  const relink = await page.evaluateHandle(() => [...document.querySelectorAll('label')].find((label) => /Relink Original Plan/.test(label.textContent) && label.offsetParent !== null)?.querySelector('input[type=file]'));
  assert.ok(relink.asElement(), 'the plan-load card offers Relink Original Plan');
  await relink.asElement().uploadFile(pdf);
  const opened = await page.waitForFunction(() => Boolean(harness.snapshot().openedTakeoffJob?.takeoffId) && harness.snapshot().imageReady, { timeout: 600000 }).then(() => true, () => false);
  if (!opened) {
    await page.screenshot({ path: path.join(out, '0-not-opened.png') });
    report.notOpened = await page.evaluate(() => { const s = harness.snapshot(); return { keys: Object.keys(s), openedTakeoffJob: s.openedTakeoffJob || null, totalPages: s.totalPages, text: document.body.innerText.slice(0, 1500) }; });
    throw new Error('the job copy did not open its takeoff: ' + JSON.stringify(report.notOpened).slice(0, 1500));
  }
  await page.waitForFunction(() => harness.snapshot().imageReady && harness.snapshot().totalPages > 1, { timeout: 900000 });
  await settle();
  const saved = await snapshot();
  report.asSaved = { counts: counts(saved), sheetLevels: saved.sheetLevels, rooms: roomsOf(saved), rotation: saved.rotation };
  step('job copy opened', { counts: report.asSaved.counts, sheetLevels: saved.sheetLevels });
  const levelled = Object.keys(saved.sheetLevels || {}).map(Number).filter((page) => saved.sheetLevels[page] && saved.sheetLevels[page] !== 'Unassigned').sort((a, b) => a - b);
  for (const sheet of levelled) { await goToPage(sheet); await shot(`1-as-saved-sheet-${sheet}`); }

  // 2. Re-measure with the current rules through the screen's own button (local only).
  const hasRemeasure = await page.$('#remeasure-takeoff');
  assert.ok(hasRemeasure, 'the screen offers Re-measure on a job measured before');
  await page.click('#remeasure-takeoff');
  await page.waitForFunction(() => /TAKEOFF (REQUIRES REVIEW|COMPLETE)|Not re-measured|Nothing could be measured/.test(document.querySelector('#ai-takeoff-status')?.textContent || '')
    && !document.querySelector('#run-ai-takeoff')?.disabled, { timeout: 1200000 });
  await settle();
  const message = await page.$eval('#ai-takeoff-status', (element) => element.textContent);
  const measured = await snapshot();
  report.remeasured = { message, counts: counts(measured), rooms: roomsOf(measured),
    floorAreas: measured.completedFloorplans.map((item) => ({ page: item.page, type: item.type, label: item.label })) };
  step('re-measured', { message: message.slice(0, 300), counts: report.remeasured.counts });
  assert.match(message, /Re-measured/, 'the earlier measurement was replaced');
  report.panel = await panelText();
  const sheets = [...new Set(report.remeasured.rooms.map((room) => room.page))].sort((a, b) => a - b);
  for (const sheet of sheets) {
    await goToPage(sheet);
    await page.click('[data-testid="zoom-to-rooms"]');
    await new Promise((r) => setTimeout(r, 800));
    await shot(`2-remeasured-sheet-${sheet}`);
  }
  // The outdoor areas listed apart from the rooms (scrolled into view in the room panel).
  report.outdoorList = await page.evaluate(() => { const block = document.querySelector('[data-testid="outdoor-areas"]'); block?.scrollIntoView(); return block?.innerText || null; });
  await shot('2-room-panel-outdoor-areas');
  // A ground-floor space picked from the list as well.
  const groundRoom = process.env.GR8_FOCUS_ROOM_2;
  if (groundRoom) {
    const button = await page.$(`[data-testid="room-focus"][data-room-name="${groundRoom}"]`);
    assert.ok(button, `the room list has ${groundRoom}`);
    await button.click(); await new Promise((r) => setTimeout(r, 900));
    await shot(`3-focused-${groundRoom.replace(/[^a-z0-9]+/gi, '-')}`);
  }

  // 3. A room picked from the list: highlighted, centred, approved with its own button.
  const target = process.env.GR8_FOCUS_ROOM || report.remeasured.rooms.filter((room) => room.page === sheets.at(-1))[0]?.name;
  const focusButton = await page.$(`[data-testid="room-focus"][data-room-name="${target}"]`);
  assert.ok(focusButton, `the room list has ${target}`);
  await focusButton.click();
  await new Promise((r) => setTimeout(r, 900));
  await shot(`3-focused-${String(target).replace(/[^a-z0-9]+/gi, '-')}`);
  const approved = await page.evaluate((name) => {
    const row = [...document.querySelectorAll('[data-room-id]')].find((element) => element.querySelector('[data-testid="room-focus"]')?.dataset.roomName === name);
    const button = row && [...row.querySelectorAll('button')].find((item) => item.textContent.trim() === 'Approve room');
    if (!button) return { found: false };
    if (button.disabled) return { found: true, disabled: true, reason: row.innerText.slice(0, 300) };
    button.click(); return { found: true, clicked: true };
  }, target);
  await settle();
  const afterApprove = await snapshot();
  report.focus = { target, approved, confirmed: roomsOf(afterApprove).find((room) => room.name === target)?.confirmed ?? null };
  step('room focused and approval tried', report.focus);
  await shot(`4-after-approve-${String(target).replace(/[^a-z0-9]+/gi, '-')}`);

  // 4. Rerun: refused, nothing added.
  const beforeRetry = counts(await snapshot());
  await page.click('#run-ai-takeoff');
  await page.waitForFunction(() => /already been measured/.test(document.querySelector('#ai-takeoff-status')?.textContent || ''), { timeout: 120000 });
  report.retry = { message: await page.$eval('#ai-takeoff-status', (element) => element.textContent), counts: counts(await snapshot()) };
  assert.deepEqual(report.retry.counts, beforeRetry, 'rerun adds nothing');
  // Re-measure is refused now that a room is approved (nothing approved is lost).
  if (report.focus.confirmed) {
    await page.click('#remeasure-takeoff');
    await page.waitForFunction(() => /Not re-measured/.test(document.querySelector('#ai-takeoff-status')?.textContent || ''), { timeout: 120000 });
    report.remeasureAfterApproval = { message: await page.$eval('#ai-takeoff-status', (element) => element.textContent), counts: counts(await snapshot()) };
    assert.deepEqual(report.remeasureAfterApproval.counts, beforeRetry, 'a refused re-measure changes nothing');
  }

  // 5. Save and reopen.
  await save();
  const beforeReopen = counts(await snapshot());
  await page.evaluate(() => harness.reopen());
  await page.waitForFunction(() => harness.snapshot().imageReady && harness.snapshot().completedWallRuns.length > 0, { timeout: 300000 });
  await settle();
  report.persistence = { beforeReopen, afterReopen: counts(await snapshot()) };
  step('save and reopen', report.persistence);
  assert.deepEqual(report.persistence.afterReopen, beforeReopen, 'everything persists through save and reopen');

  // 6. The quotation gate.
  report.blockers = await page.evaluate(() => harness.blockers());
  report.paidRequests = apiRequests;
  assert.equal(apiRequests.length, 0, 'no request reached the analysis endpoint');
  report.ok = report.errors.length === 0;
  console.log('Job copy browser check passed.');
} catch (error) {
  report.failure = String(error?.stack || error);
  console.error(error);
  process.exitCode = 1;
} finally {
  clearInterval(memoryWatch);
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close().catch(() => {});
  server.close();
}
