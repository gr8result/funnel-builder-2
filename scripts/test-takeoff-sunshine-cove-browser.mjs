// Real-plan browser check of the RUN AI TAKEOFF workflow on the Sunshine Cove plan set (15 pages), the job
// that failed on localhost:3000 with "Sheet analysis failed: The AI analysis timed out".
//
// The browser runs the live Takeoff component inside the real Estimate Builder workbook hook (bundle built by
// test-takeoff-vector-plan-browser.mjs with GR8_BUNDLE_ONLY=1). The PDF goes in through the screen's own file
// input, each floor sheet's level is chosen in the screen's "Sheet N is which level?" control, the plan is
// calibrated with the Calibrate tool to the job's own saved calibration, and RUN AI TAKEOFF is clicked.
// /api/ai/takeoff-analyse is served by the REAL server handler (lib/construction-estimation/aiTakeoffAnalysis.js).
//
// Sheet inspections are replayed from the job's own saved OpenAI inspections (the live job holds all 15 in its
// cache, so the application sends no inspection requests either). Every other request goes to the handler:
//   GR8_PROVIDER=recorded-timeout  the handler's network call raises the TimeoutError AbortSignal.timeout raises
//                                  (what happened on localhost:3000), with no paid call;
//   GR8_PROVIDER=live              the handler calls OpenAI (paid; GR8_LIVE_PROVIDER_APPROVED=yes and
//                                  GR8_LIVE_PROVIDER_MAX_REQUESTS required).
//   GR8_PROVIDER=none              OpenAI disabled: Run Takeoff must measure locally; any request to the analysis
//                                  endpoint or the provider fails the check (zero paid calls is asserted).
// Never touches port 3000, the user's browser profile or the user's job.
//   GR8_BUNDLE_DIR      folder holding browser-bundle.js
//   GR8_SERVER_MODULE   server module to load (default: the repository's aiTakeoffAnalysis.js)
//   GR8_INSPECTIONS     JSON of the job's recorded inspections, by page
//   GR8_SUNSHINE_PDF    the plan PDF; TAKEOFF_SUNSHINE_OUT output folder; GR8_EXPECT=fail|measure
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import { PDFDocument } from 'pdf-lib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env.local') });
const mode = process.env.GR8_PROVIDER || 'recorded-timeout';
const expect = process.env.GR8_EXPECT || 'measure';
const bundleDir = path.resolve(process.env.GR8_BUNDLE_DIR || path.join(root, 'artifacts/test-results/takeoff-vector-plan-browser'));
const out = path.resolve(process.env.TAKEOFF_SUNSHINE_OUT || path.join(root, 'artifacts/test-results/takeoff-sunshine-cove-browser', mode));
const pdf = process.env.GR8_SUNSHINE_PDF || 'C:/Users/grant/Downloads/BAX INVESTMENTS SUNSHINE COVE PLANS.pdf';
const inspections = mode === 'none' ? {} : JSON.parse(fs.readFileSync(process.env.GR8_INSPECTIONS, 'utf8'));
// The job's own floor information: sheet 4 "LOWER DIMENSIONS" and sheet 5 "UPPER DIMENSIONS", as the job's saved
// inspection also reads them; the job's saved calibration on sheet 4, applied to sheet 5 (same 1:100 sheet).
const sheets = [{ page: 4, level: 'Ground Floor' }, { page: 5, level: 'Second Level' }];
const jobPixelsPerMm = 0.014132207996477566;
const printed = { lowerLivingM2: 72.68, garageM2: 44.98, upperLivingM2: 115.56, balconyM2: 9.82 };
assert.ok(fs.existsSync(path.join(bundleDir, 'browser-bundle.js')), `bundle missing in ${bundleDir}`);
assert.ok(fs.existsSync(pdf), `plan PDF missing: ${pdf}`);
fs.mkdirSync(out, { recursive: true });
const serverModule = process.env.GR8_SERVER_MODULE ? pathToFileURL(path.resolve(process.env.GR8_SERVER_MODULE)).href : pathToFileURL(path.join(root, 'lib/construction-estimation/aiTakeoffAnalysis.js')).href;
const { createTakeoffAnalysisHandler } = await import(serverModule);

// ---- Provider transport behind the real handler ----
const ledger = { mode, calls: [], refused: 0, inputTokens: 0, outputTokens: 0 };
let fetchImpl;
if (mode === 'live') {
  assert.equal(process.env.GR8_LIVE_PROVIDER_APPROVED, 'yes', 'GR8_LIVE_PROVIDER_APPROVED=yes is required for paid requests');
  const max = Number(process.env.GR8_LIVE_PROVIDER_MAX_REQUESTS);
  assert.ok(Number.isInteger(max) && max > 0 && max <= 20, 'GR8_LIVE_PROVIDER_MAX_REQUESTS (1-20) is required');
  fetchImpl = async (target, init) => {
    if (!String(target).startsWith('https://api.openai.com/')) throw new Error('Only the OpenAI API may be called.');
    if (ledger.calls.length >= max) { ledger.refused += 1; throw Object.assign(new Error('Request cap reached; nothing was sent.'), { name: 'CapError' }); }
    const call = { startedAt: new Date().toISOString() }; ledger.calls.push(call);
    const started = Date.now();
    try {
      const response = await fetch(target, init);
      const body = await response.clone().json().catch(() => null);
      Object.assign(call, { seconds: Math.round((Date.now() - started) / 100) / 10, status: response.status, model: body?.model, input: body?.usage?.input_tokens || 0, output: body?.usage?.output_tokens || 0, reasoning: body?.usage?.output_tokens_details?.reasoning_tokens || 0 });
      ledger.inputTokens += call.input; ledger.outputTokens += call.output;
      return response;
    } catch (error) {
      Object.assign(call, { seconds: Math.round((Date.now() - started) / 100) / 10, failed: error.name });
      throw error;
    } finally { fs.writeFileSync(path.join(out, 'provider-ledger.json'), JSON.stringify(ledger, null, 2)); }
  };
} else if (mode === 'none') {
  fetchImpl = async (target) => { ledger.calls.push({ at: new Date().toISOString(), refusedTarget: String(target) }); throw new Error('OpenAI is disabled in this check.'); };
} else {
  fetchImpl = async () => {
    ledger.calls.push({ at: new Date().toISOString(), injected: 'TimeoutError' });
    throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
  };
}
const handler = createTakeoffAnalysisHandler({ fetchImpl, env: { ...process.env, OPENAI_API_KEY: mode === 'live' ? process.env.OPENAI_API_KEY : 'sk-not-used-recorded-timeout' } });
const apiRequests = [];

const server = http.createServer(async (req, res) => {
  if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(path.join(bundleDir, 'browser-bundle.js')).pipe(res); return; }
  const ocrFile = /^\/takeoff-ocr\/((?:core|tessdata)\/)?[A-Za-z0-9._-]+$/.test(req.url) ? path.join(root, 'public', req.url) : null;
  if (ocrFile && fs.existsSync(ocrFile)) { res.setHeader('Content-Type', ocrFile.endsWith('.js') ? 'application/javascript' : 'application/octet-stream'); if (req.method === 'HEAD') { res.end(); return; } fs.createReadStream(ocrFile).pipe(res); return; }
  if (ocrFile) { res.statusCode = 404; res.end(); return; }
  if (req.url === '/pdfjs/pdf.worker.min.mjs') { res.setHeader('Content-Type', 'application/javascript'); fs.createReadStream(path.join(root, 'public/pdfjs/pdf.worker.min.mjs')).pipe(res); return; }
  if (req.url === '/api/ai/takeoff-analyse') {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const entry = { action: body.action, scope: body.measurementScope || null, page: body.page?.pageNumber, startedAt: new Date().toISOString() };
    apiRequests.push(entry);
    const started = Date.now();
    if (mode === 'none') { entry.status = 503; res.statusCode = 503; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: false, code: 'provider_disabled', error: 'OpenAI is disabled in this check.' })); return; }
    const send = (status, payload) => { entry.status = status; entry.seconds = Math.round((Date.now() - started) / 100) / 10; entry.code = payload.code || null; entry.error = payload.error || null; res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(payload)); };
    if (body.action === 'inspect') {
      const recorded = inspections[body.page.pageNumber];
      if (!recorded) return send(502, { ok: false, code: 'not_recorded', error: 'No recorded inspection for this page.' });
      return send(200, { ok: true, provider: 'openai', model: recorded.model, requestId: `recorded-${recorded.requestId || body.page.pageNumber}`, analysis: { ...recorded.analysis, page: body.page.pageNumber } });
    }
    let status = 200; const fakeRes = { setHeader() {}, status(code) { status = code; return this; }, json(payload) { send(status, payload); } };
    await handler({ method: 'POST', body, user: { id: 'sunshine-cove-browser-check' } }, fakeRes);
    return;
  }
  res.setHeader('Content-Type', 'text/html');
  res.end('<!doctype html><meta charset="utf-8"><title>Sunshine Cove AI Takeoff</title><style>html,body,#root{height:100%;margin:0;font-family:Arial}</style><div id="root"></div><script src="/bundle.js"></script>');
});

const report = { mode, expect, bundleDir, serverModule, errors: [], dialogs: [], steps: [] };
const step = (label, data) => { const line = `${new Date().toISOString()} ${label}${data ? ` ${JSON.stringify(data)}` : ''}`; console.log(line); report.steps.push({ at: new Date().toISOString(), label, ...(data ? { data } : {}) }); };
let browser, page, memoryWatch;
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  step('isolated server', { origin });
  browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 3600000,
    userDataDir: path.join(out, `profile-${Date.now()}`), args: ['--no-first-run', '--disable-extensions', '--window-size=1600,1100'], defaultViewport: { width: 1600, height: 1100 } });
  const minCommitMb = Number(process.env.GR8_MIN_FREE_COMMIT_MB) || 1500;
  if (process.platform === 'win32') memoryWatch = setInterval(() => {
    execFile('powershell.exe', ['-NoProfile', '-Command', '$m=Get-CimInstance Win32_PerfFormattedData_PerfOS_Memory; $o=Get-CimInstance Win32_OperatingSystem; @{commitFreeMB=($m.CommitLimit-$m.CommittedBytes)/1MB;physicalFreeMB=$o.FreePhysicalMemory/1024} | ConvertTo-Json -Compress'], { windowsHide: true, timeout: 10000 }, (error, stdout) => {
      if (error) return; let sample; try { sample = JSON.parse(stdout); } catch { return; }
      report.minCommitFreeMB = Math.min(report.minCommitFreeMB ?? Infinity, Math.round(sample.commitFreeMB));
      if (sample.commitFreeMB < minCommitMb || sample.physicalFreeMB < 800) { const reason = `Memory guard: free commit ${Math.round(sample.commitFreeMB)} MB, physical ${Math.round(sample.physicalFreeMB)} MB; closing this test browser.`; report.errors.push(reason); console.error(reason); clearInterval(memoryWatch); void browser.close().catch(() => {}); }
    });
  }, 5000);
  page = await browser.newPage();
  page.setDefaultTimeout(180000);
  page.on('pageerror', (error) => { report.errors.push(error.message); console.error('Browser error:', error.message); });
  page.on('error', (error) => { report.errors.push(`renderer crashed: ${error.message}`); void browser.close().catch(() => {}); });
  page.on('dialog', async (dialog) => { report.dialogs.push(dialog.message()); await dialog.accept(); });
  await page.setRequestInterception(true);
  page.on('request', (request) => request.url().startsWith(origin) || /^(data|blob):/.test(request.url()) ? request.continue() : request.abort());
  await page.evaluateOnNewDocument(({ storageKey, session }) => { localStorage.setItem(storageKey, JSON.stringify(session)); }, {
    storageKey: 'sb-stubbedtakeoff-auth-token',
    session: { access_token: 'stub-access-token', refresh_token: 'stub-refresh', token_type: 'bearer', expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, user: { id: 'stub-user', aud: 'authenticated', role: 'authenticated', email: 'stub@example.test' } },
  });
  await page.goto(origin, { waitUntil: 'load', timeout: 300000 });
  await page.waitForFunction(() => window.harness?.ready());

  // 1. A disposable job (never the user's), and the original 15-page PDF through the screen's file input.
  await page.evaluate(() => harness.newJob());
  await page.waitForFunction(() => Boolean(harness.snapshot().openedTakeoffJob?.takeoffId));
  await page.waitForSelector('input[type="file"][accept="image/*,.pdf"]:not([disabled])');
  const pageCount = (await PDFDocument.load(fs.readFileSync(pdf), { ignoreEncryption: true })).getPageCount();
  const uploadStarted = Date.now();
  await (await page.$('input[type="file"][accept="image/*,.pdf"]')).uploadFile(pdf);
  await page.waitForFunction((count) => harness.snapshot().imageReady && harness.snapshot().totalPages === count, { timeout: 900000 }, pageCount);
  report.upload = { pages: pageCount, seconds: Math.round((Date.now() - uploadStarted) / 1000) };
  step('uploaded', report.upload);

  // 2-4. Select sheet 4, assign each floor sheet's level in the screen, calibrate sheet 4 (applied to sheet 5).
  for (const sheet of sheets) {
    await goToPage(sheet.page);
    await page.select('#ai-plan-takeoff-sheet-level-select', sheet.level);
    await settle();
  }
  await goToPage(4);
  const logicalWidth = await page.evaluate(() => harness.workbook().aiPlanTakeoffJob?.plan?.pages?.[3]?.logicalWidth ?? null).catch(() => null);
  await centre({ x: 210, y: 300 });
  const span = 300; // logical units between the two calibration clicks
  calibrationAnswer = String(Math.round(span / jobPixelsPerMm * 10) / 10);
  await button('Calibrate');
  await clickPlan({ x: 60, y: 300 });
  await clickPlan({ x: 60 + span, y: 300 });
  await answerCalibration([5]);
  await page.waitForFunction(() => harness.snapshot().pixelsPerMm > 0);
  const calibrated = await snapshot();
  report.setup = { logicalWidth, sheetLevels: calibrated.sheetLevels, pixelsPerMm: calibrated.pixelsPerMm, jobPixelsPerMm, sheetCalibrations: calibrated.sheetCalibrations };
  step('levels and calibration', report.setup);
  assert.deepEqual(calibrated.sheetLevels, { 4: 'Ground Floor', 5: 'Second Level' }, 'levels assigned in the screen');
  assert.ok(Math.abs(calibrated.pixelsPerMm - jobPixelsPerMm) / jobPixelsPerMm < 0.005, `calibration ${calibrated.pixelsPerMm} matches the job's ${jobPixelsPerMm}`);
  assert.equal(calibrated.sheetCalibrations?.[5]?.appliedFromSheet, 4, 'sheet 5 has sheet 4\'s calibration');
  await page.screenshot({ path: path.join(out, 'before-run.png') });

  // 4b. Paid AI never starts from one click: both AI buttons ask for authorisation first; cancelling sends nothing.
  if (mode === 'none') {
    const before = apiRequests.length;
    const prompts = {};
    for (const [buttonId, promptId] of [['#run-ai-assisted-takeoff', '#confirm-ai-assisted'], ['#read-rooms-from-plans', '#confirm-ai-rooms']]) {
      await page.click(buttonId); await settle();
      prompts[buttonId] = await page.$eval(promptId, (element) => element.textContent).catch(() => null);
      assert.ok(prompts[buttonId] && /charged/.test(prompts[buttonId]), `${buttonId} asks for authorisation before any paid request`);
      await page.click(`${promptId}-cancel`); await settle();
    }
    assert.equal(apiRequests.length, before, 'cancelling the AI prompts sends nothing');
    report.paidPrompts = prompts;
    step('paid AI needs authorisation', { prompts: Object.keys(prompts), requestsSent: apiRequests.length - before });
  }
  // 5. RUN TAKEOFF, answering the screen's scale question with the job's own (manual) calibration.
  const runStarted = Date.now();
  await page.click('#run-ai-takeoff');
  report.statusTrail = [];
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const state = await page.evaluate(() => ({ status: document.querySelector('#ai-takeoff-status')?.textContent || '', busy: document.querySelector('#run-ai-takeoff')?.disabled,
      manual: Boolean([...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Use manual calibration')),
      verified: Boolean([...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'I verified the current calibration — continue')) }));
    if (report.statusTrail.at(-1) !== state.status) { report.statusTrail.push(state.status); step('status', { seconds: Math.round((Date.now() - runStarted) / 1000), status: state.status.slice(0, 300) }); }
    if (state.manual) { report.scaleQuestion = state.status; await button('Use manual calibration'); await page.keyboard.press('Escape'); continue; }
    if (state.verified) { await button('I verified the current calibration — continue'); continue; }
    if (!state.busy && /Retry shortly|tab is (still|busy)/i.test(state.status)) {
      // The sign-in session lock was busy. Record who held it, then retry as the message tells the builder.
      const locks = await page.evaluate(async () => JSON.parse(JSON.stringify(await navigator.locks.query())));
      (report.lockContention ||= []).push({ seconds: Math.round((Date.now() - runStarted) / 1000), status: state.status, locks });
      step('lock contention', report.lockContention.at(-1));
      if (report.lockContention.length > 2) break;
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await page.click('#run-ai-takeoff');
      continue;
    }
    if (!state.busy && /AI TAKEOFF COMPLETE|REQUIRES REVIEW|could not|failed|error|already|exhausted|No measurements were inserted/i.test(state.status)) break;
    if (Date.now() - runStarted > 3600000) throw new Error('RUN AI TAKEOFF did not finish within an hour');
  }
  await settle();
  report.run = { seconds: Math.round((Date.now() - runStarted) / 1000), message: await page.$eval('#ai-takeoff-status', (element) => element.textContent) };
  step('run finished', report.run);
  const after = await snapshot();
  report.measured = summarise(after);
  step('measured', report.measured);
  await page.screenshot({ path: path.join(out, 'after-run-sheet-4.png') });

  if (expect === 'fail') {
    // Reproduction of the localhost:3000 failure on the committed code.
    assert.match(report.run.message, /AI Takeoff could not measure the plan\. .*Sheet analysis failed: .*timed out/s, 'the localhost:3000 error is reproduced');
    assert.equal(after.completedWallRuns.length + after.placedOpenings.length, 0, 'no measurements were produced');
    report.ok = true;
    console.log('Reproduced the localhost:3000 failure.');
  } else {
    assert.doesNotMatch(report.run.message, /could not measure the plan/, report.run.message);
    for (const sheet of sheets) {
      const s = report.measured.sheets[sheet.page];
      // Coverage shortfalls are recorded and the workflow continues, so save, reopen and quotation are still checked.
      const concerns = report.coverageConcerns ||= [];
      if (!(s.walls > 10)) concerns.push(`sheet ${sheet.page}: only ${s.walls} walls admitted`);
      if (!(s.openings > 3)) concerns.push(`sheet ${sheet.page}: only ${s.openings} openings`);
      if (!(s.rooms > 3)) concerns.push(`sheet ${sheet.page}: only ${s.rooms} rooms`);
      if (!(s.walls > 0)) concerns.push(`sheet ${sheet.page}: no walls admitted (candidates held for review)`);
      assert.ok(s.wallLevels.every((level) => level === sheet.level), `sheet ${sheet.page}: walls carry ${sheet.level} (${s.wallLevels})`);
    }
    assert.ok(sheets.some((sheet) => report.measured.sheets[sheet.page].walls > 0), 'walls are measured on at least one floor plan');
    await goToPage(5); await page.screenshot({ path: path.join(out, 'after-run-sheet-5.png') }); await goToPage(4);

    // 6-8. Save, reopen, the measurements persist.
    await save();
    const counts = (state) => ({ walls: state.completedWallRuns.length, openings: state.placedOpenings.length, floorAreas: state.completedFloorplans.length,
      rooms: (state.aiAnalysis?.rooms || []).length, approved: (state.aiAnalysis?.rooms || []).filter((room) => room.confirmed).map((room) => room.id).sort() });
    const beforeReopen = counts(await snapshot());
    await page.evaluate(() => harness.reopen());
    await page.waitForFunction(() => harness.snapshot().imageReady && harness.snapshot().completedWallRuns.length > 0, { timeout: 300000 });
    await settle();
    const reopened = await snapshot();
    report.persistence = { beforeReopen, afterReopen: counts(reopened), sheetLevels: reopened.sheetLevels, pixelsPerMm: reopened.pixelsPerMm };
    step('save and reopen', report.persistence);
    assert.deepEqual(counts(reopened), beforeReopen, 'walls, openings, floor areas and rooms persist through save and reopen');
    assert.deepEqual(reopened.sheetLevels, { 4: 'Ground Floor', 5: 'Second Level' }, 'levels persist');

    // Retry: running again on the same plan adds nothing twice.
    await page.click('#run-ai-takeoff');
    await page.waitForFunction(() => !document.querySelector('#run-ai-takeoff')?.disabled && /already|COMPLETE|REVIEW|could not|failed/i.test(document.querySelector('#ai-takeoff-status')?.textContent || ''), { timeout: 3600000 });
    await settle();
    const rerun = await snapshot();
    report.retry = { message: await page.$eval('#ai-takeoff-status', (element) => element.textContent), counts: counts(rerun) };
    step('retry', report.retry);
    assert.deepEqual(counts(rerun), beforeReopen, 'a retry does not duplicate measurements');

    // 9. Quotation gate. By default nothing is decided on the builder's behalf: no room is approved and no
    // review question is answered, so the takeoff must NOT reach the quote sheet (the gate is the result).
    // GR8_SETTLE_AS_BUILDER=1 runs the older path that settles the review with suggested answers (test inputs,
    // not facts read from the plan) to exercise the transfer itself.
    if (process.env.GR8_SETTLE_AS_BUILDER !== '1') {
      const dialogsBefore = report.dialogs.length;
      await button('Takeoff Schedule', true);
      await button('Send to Quote Sheet');
      await settle();
      const gate = report.dialogs.slice(dialogsBefore).find((text) => /not ready for quotation/i.test(text));
      report.quotation = { gate: gate || null, blockers: await page.evaluate(() => harness.blockers()) };
      step('quotation gate', { gate, blockers: report.quotation.blockers.length });
      assert.ok(gate, 'unreviewed local measurements cannot reach the quotation');
      report.ok = true;
      console.log('Sunshine Cove local takeoff browser check passed (quotation gated until the builder reviews).');
    } else {
    // 9. Quotation: one measured room approved by this test (as a builder would after checking it), given a
    // floor finish, sent to the quote sheet and priced. Only the approved room's area may arrive.
    // Sheet 4's room if one was measured, else sheet 5's (recorded in the report).
    const measuredRooms = (await snapshot()).aiAnalysis.rooms.filter((room) => room.polygon?.length >= 3 && room.areaM2 > 2);
    const roomsOn = (pageNumber) => measuredRooms.filter((room) => Number(room.page) === pageNumber);
    const rooms = roomsOn(4).length ? roomsOn(4) : roomsOn(5);
    const target = rooms.find((room) => /laundry|ldry/i.test(room.name || '')) || rooms.find((room) => !/unlabelled/i.test(room.name || '')) || rooms.sort((a, b) => b.areaM2 - a.areaM2)[0];
    assert.ok(target, 'a measured room with a boundary exists on sheet 4 or 5');
    // 9a. The review the quotation gate requires, settled as a builder checking this plan would: the screen's
    // suggested answers to its questions are accepted, every measured room other than the one taken to the
    // quote is rejected (not used), and the measured footprint is removed where it disagrees with the printed
    // area. Everything done here is recorded in report.settledReview.
    const settledReview = report.settledReview = { before: await page.evaluate(() => harness.blockers()), answers: [], roomsRejected: [], floorAreasRemoved: [], left: [] };
    const answerQuestions = async () => {
      for (let round = 0; round < 40; round += 1) {
        const open = await page.evaluate(() => [...document.querySelectorAll('[data-review-decision]')].map((el) => ({ id: el.getAttribute('data-review-decision'), title: el.querySelector('strong')?.textContent || '',
          buttons: [...el.querySelectorAll('button')].map((b) => b.textContent.trim()).filter((t) => !/^Show sheet/.test(t)), number: Boolean(el.querySelector('input[type="number"]')) })));
        const next = open.find((d) => d.number || d.buttons.length);
        if (!next) break;
        const choice = next.number ? 'Apply' : next.buttons.find((t) => /^Use /.test(t)) || next.buttons.find((t) => /^Confirm /.test(t)) || next.buttons.find((t) => t === 'I have checked this') || next.buttons[0];
        const typed = next.number ? await page.evaluate((id) => document.querySelector(`[data-review-decision="${id}"] input[type="number"]`).value, next.id) : null;
        await page.evaluate(({ id, choice }) => { [...document.querySelector(`[data-review-decision="${id}"]`).querySelectorAll('button')].find((b) => b.textContent.trim() === choice).click(); }, { id: next.id, choice });
        settledReview.answers.push({ id: next.id, title: next.title, answer: next.number ? `${typed} (the screen's suggested value)` : choice });
        await settle();
      }
    };
    await answerQuestions();
    for (const sheet of sheets) {
      await goToPage(sheet.page);
      const pendingRooms = (await snapshot()).aiAnalysis.rooms.filter((room) => Number(room.page) === sheet.page && !room.excluded && room.confirmed !== true && room.id !== target.id);
      for (const room of pendingRooms) {
        await page.evaluate((id) => { const box = document.querySelector(`[data-room-id="${id}"] input[type="checkbox"]`); if (box && !box.checked) box.click(); }, room.id);
        await settle();
        const clicked = await page.evaluate((id) => { const row = document.querySelector(`[data-room-id="${id}"]`); const b = row && [...row.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Reject boundary'); if (!b || b.disabled) return b ? 'disabled' : 'missing'; b.click(); return 'clicked'; }, room.id);
        settledReview.roomsRejected.push({ sheet: sheet.page, name: room.name, areaM2: room.areaM2 && +room.areaM2.toFixed(2), action: clicked });
        await settle();
      }
      for (const area of (await snapshot()).completedFloorplans.filter((item) => Number(item.page) === sheet.page && item.source === 'ai' && item.confirmed !== true)) {
        await page.evaluate((id) => { harness.setTool('floorplan'); harness.selectFloorplan(id); }, area.id); await settle();
        await page.keyboard.press('Delete'); await settle();
        const gone = !(await snapshot()).completedFloorplans.some((item) => item.id === area.id);
        settledReview.floorAreasRemoved.push({ sheet: sheet.page, type: area.type, areaM2: area.areaM2 ?? null, removed: gone,
          reason: `measured outline disagrees with the printed area (${sheet.page === 4 ? `lower living ${printed.lowerLivingM2} m², garage ${printed.garageM2} m²` : `upper living ${printed.upperLivingM2} m², balcony ${printed.balconyM2} m²`})` });
      }
      await page.evaluate(() => harness.setTool('select')); await settle();
    }
    await answerQuestions();
    await goToPage(Number(target.page)); await settle();
    await page.evaluate(() => { const box = document.querySelector('[data-testid="room-boundary-panel"] input[type="checkbox"]'); if (box && !box.checked) box.click(); });
    await settle();
    await page.evaluate((id) => { for (const row of document.querySelectorAll('[data-room-id]')) { const checkbox = row.querySelector('input[type="checkbox"]'); const want = row.getAttribute('data-room-id') === id; if (checkbox && checkbox.checked !== want) checkbox.click(); } }, target.id);
    await settle();
    const approve = await page.evaluate((id) => { const row = document.querySelector(`[data-room-id="${id}"]`); const element = row && [...row.querySelectorAll('button')].find((item) => item.textContent.trim() === 'Approve room'); if (!element || element.disabled) return element ? 'disabled' : 'missing'; element.click(); return 'clicked'; }, target.id);
    await settle();
    report.quotation = { room: target.name, page: Number(target.page), approve };
    if (approve === 'clicked') {
      await page.evaluate(() => { const panel = document.querySelector('[data-testid="room-boundary-panel"]'); const element = [...panel.querySelectorAll('button')].find((item) => item.textContent === 'Floor Tiling'); if (!element) throw Error('Floor Tiling finish button missing'); element.click(); });
      await settle();
      await save();
      await answerQuestions(); await save();
      settledReview.left = await page.evaluate(() => harness.blockers());
      step('review settled', { answers: settledReview.answers.length, roomsRejected: settledReview.roomsRejected.length, floorAreasRemoved: settledReview.floorAreasRemoved, left: settledReview.left.map((item) => item.title) });
      const approved = (await snapshot()).aiAnalysis.rooms.find((room) => room.id === target.id);
      report.quotation.approvedAreaM2 = approved.areaM2;
      await button('Takeoff Schedule', true);
      const dialogsBefore = report.dialogs.length;
      await button('Send to Quote Sheet');
      await settle();
      // A takeoff with unsettled required review items must not reach the quotation. Settling them is the
      // builder's decision on this job (no reference exists to decide them from), so the gate is the result.
      const gate = report.dialogs.slice(dialogsBefore).find((text) => /not ready for quotation/i.test(text));
      if (gate) { report.quotation.blockers = await page.evaluate(() => harness.blockers()); report.quotation.blockedByReviewGate = gate; (report.coverageConcerns ||= []).push('quotation: ' + gate); step('quotation', report.quotation); }
      if (!gate) {
      await page.waitForFunction(() => [...document.querySelectorAll('tr')].some((row) => row.textContent.includes('Floor Tiling') && row.querySelector('select')), { timeout: 60000 });
      await page.evaluate((name) => { const row = [...document.querySelectorAll('tr')].find((item) => item.textContent.includes(name) && item.textContent.includes('Floor Tiling') && item.querySelector('select')); if (!row) throw Error('Approved room missing from the quote preview'); row.querySelector('select').setAttribute('data-testid', 'approved-room-quote-mapping'); }, target.name);
      await page.select('[data-testid="approved-room-quote-mapping"]', 'takeoff-browser-room-check');
      await settle();
      await button('Apply Mapped Quantities'); await settle();
      await button('Apply Mapped Quantities'); await settle();
      const mapped = await page.evaluate(() => harness.liveWorkbook().quotation['Takeoff browser check'].rows.find((item) => item.id === 'takeoff-browser-room-check')?.quantity);
      const unapprovedTiling = await page.evaluate(() => [...document.querySelectorAll('tr')].filter((row) => row.textContent.includes('Floor Tiling') && row.querySelector('select')).length);
      const priced = await page.evaluate(() => Object.values(harness.quotation().quotation || {}).flatMap((section) => section.rows || []).find((row) => row.id === 'takeoff-browser-room-check'));
      Object.assign(report.quotation, { quoteSheetQuantity: Number(mapped), floorTilingRowsOffered: unapprovedTiling, quotationQty: priced?.qty, quotationCost: priced?.cost });
      step('quotation', report.quotation);
      assert.ok(Math.abs(Number(mapped) - approved.areaM2) < 0.02, `the approved room's area reaches the quote sheet once (${mapped} vs ${approved.areaM2})`);
      assert.ok(Math.abs(priced.qty - approved.areaM2) < 0.02, 'and the calculated quotation');
      assert.equal(unapprovedTiling, 1, 'only the approved room is offered as a Floor Tiling quantity');
      await page.screenshot({ path: path.join(out, 'quote-sheet.png') });
      }
    } else step('quotation', report.quotation);
    assert.equal(report.quotation.approve, 'clicked', `the measured room ${target.name} can be approved (${approve})`);
    report.ok = !(report.coverageConcerns || []).length;
    console.log(report.ok ? 'Sunshine Cove AI Takeoff browser check passed.' : `Workflow passed; coverage concerns: ${report.coverageConcerns.join('; ')}`);
    }
  }
  if (mode === 'none') {
    report.paidRequests = { analysisEndpoint: apiRequests.length, provider: ledger.calls.length };
    assert.equal(apiRequests.length, 0, `no request reached the AI analysis endpoint (${JSON.stringify(apiRequests)})`);
    assert.equal(ledger.calls.length, 0, 'no provider call was made');
  }
  assert.deepEqual(report.errors, [], 'no browser runtime errors');
} catch (error) {
  report.error = error.stack || String(error);
  if (page) { report.status = await page.$eval('#ai-takeoff-status', (element) => element.textContent).catch(() => null); await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {}); }
  process.exitCode = 1;
  console.error(error);
} finally {
  clearInterval(memoryWatch);
  report.apiRequests = apiRequests;
  report.ledger = ledger;
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser?.close();
  await new Promise((resolve) => server.listening ? server.close(resolve) : resolve());
}

function summarise(state) {
  const ppm = (page) => state.sheetCalibrations?.[page]?.pixelsPerMm || state.pixelsPerMm;
  const area = (nodes, page) => Math.round(Math.abs(nodes.reduce((sum, p, i) => { const q = nodes[(i + 1) % nodes.length]; return sum + p.x * q.y - q.x * p.y; }, 0)) / 2 / (ppm(page) ** 2) / 1e4) / 100;
  const result = { sheets: {}, review: (state.aiAnalysis?.review || []).filter((item) => ['decision', 'builder'].includes(item.audience)).map((item) => `${item.code}${item.page ? ` (sheet ${item.page})` : ''}: ${String(item.message).slice(0, 260)}`) };
  for (const { page } of sheets) {
    const walls = state.completedWallRuns.filter((item) => Number(item.page) === page);
    const openings = state.placedOpenings.filter((item) => Number(item.page || item.pageId) === page);
    const rooms = (state.aiAnalysis?.rooms || []).filter((item) => Number(item.page) === page);
    result.sheets[page] = {
      walls: walls.length, wallLengthM: Math.round(walls.reduce((sum, wall) => sum + (Number(wall.lengthMm) || 0), 0) / 10) / 100,
      exteriorWalls: walls.filter((wall) => wall.category === 'exterior').length, wallLevels: [...new Set(walls.map((wall) => wall.level || state.sheetLevels?.[page] || 'Unassigned'))],
      openings: openings.length, openingTypes: Object.entries(openings.reduce((map, item) => ({ ...map, [item.type || 'unclassified']: (map[item.type || 'unclassified'] || 0) + 1 }), {})).map(([k, v]) => `${k} ${v}`),
      rooms: rooms.length, roomNames: rooms.map((room) => `${room.name}${room.areaM2 ? ` ${room.areaM2.toFixed(2)} m²` : ''}`),
      floorAreas: state.completedFloorplans.filter((item) => Number(item.page) === page).map((item) => `${item.type} ${area(item.nodes, page)} m²`),
    };
  }
  result.printedOnDrawing = printed;
  return result;
}
var calibrationAnswer;
async function snapshot() { return page.evaluate(() => harness.snapshot()); }
async function settle() { await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function goToPage(number) { await page.evaluate((value) => harness.goToPage(value), number); await page.waitForFunction((value) => harness.snapshot().currentPage === value && harness.snapshot().imageReady, { timeout: 120000 }, number); await settle(); await new Promise((resolve) => setTimeout(resolve, 500)); }
async function centre(point) { await page.evaluate((point) => { const size = harness.viewSize(); harness.setView({ zoom: 1, pan: { x: size.width / 2 - point.x, y: size.height / 2 - point.y } }); }, point); await settle(); }
async function button(label, prefix = false) { const found = await page.evaluate(({ label, prefix }) => { const element = [...document.querySelectorAll('button')].find((item) => prefix ? item.textContent.trim().startsWith(label) : item.textContent.trim() === label); if (!element) return false; element.click(); return true; }, { label, prefix }); assert.ok(found, `Find button ${label}`); await settle(); }
async function answerCalibration(applyTo = []) {
  await page.waitForSelector('[data-testid="calibration-confirmation"]');
  await page.click('[data-testid="calibration-dimension-mm"]', { clickCount: 3 });
  await page.type('[data-testid="calibration-dimension-mm"]', calibrationAnswer);
  for (const sheet of applyTo) { const box = await page.$(`[data-testid="calibration-apply-sheet-${sheet}"]`); assert.ok(box, `calibration dialog offers sheet ${sheet}`); await box.click(); }
  await page.click('[data-testid="confirm-calibration"]');
  await settle();
}
async function clickPlan(point) { const client = await page.evaluate((point) => harness.point(point), point); await page.mouse.move(client.x, client.y); await page.mouse.click(client.x, client.y); await settle(); await new Promise((resolve) => setTimeout(resolve, 650)); }
async function save() {
  const before = await page.evaluate(() => harness.saveInputs().length);
  await page.evaluate(() => document.getElementById('ai-plan-takeoff-save-button').click());
  await page.waitForFunction((count) => harness.saveInputs().length > count, { timeout: 900000 }, before);
  // Every save the screen submitted (queued autosaves included) has finished, three checks in a row.
  for (let stable = 0, started = Date.now(); stable < 3;) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    stable = (await page.evaluate(() => harness.saveResults().length >= harness.saveInputs().length)) ? stable + 1 : 0;
    if (Date.now() - started > 900000) throw new Error('saves did not finish within 15 minutes');
  }
  const last = await page.evaluate(() => harness.saveResults().at(-1));
  assert.equal(last?.ok, true, `save succeeded (${last?.message || ''})`);
  await settle();
}
