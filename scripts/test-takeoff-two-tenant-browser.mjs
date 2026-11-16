// AI Takeoff two-user, two-tenant browser test against the ISOLATED stack and an isolated production
// build (never port 3000, never production Supabase). Two real users signed in through the isolated
// Supabase auth, each in their own browser instance and profile:
//   1. both open a real takeoff job file and edit and save their own copy at the same time;
//   2. each reopens in a fresh page load and gets exactly their own saved state;
//   3. user B tries to open user A's job by its address and gets nothing of it;
//   4. user A edits the same job in two tabs: the stale tab's save is refused, nothing is overwritten,
//      and a reload recovers the newest save.
//   TAKEOFF_ISOLATED_ENV=<isolated-env.json> TAKEOFF_ISOLATED_APP=http://127.0.0.1:3122 TAKEOFF_JOB_FILE=<.gr8job>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { seedTenants } from './test-takeoff-two-tenant-isolated.mjs';

const env = JSON.parse(fs.readFileSync(process.env.TAKEOFF_ISOLATED_ENV, 'utf8'));
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const app = process.env.TAKEOFF_ISOLATED_APP;
const jobFile = process.env.TAKEOFF_JOB_FILE;
assert(/^http:\/\/127\.0\.0\.1:556\d\d$/.test(supabaseUrl), `Refusing Supabase ${supabaseUrl}`);
assert(/^http:\/\/127\.0\.0\.1:(?!3000\b)\d+$/.test(app || ''), `Refusing app ${app}`);
assert(fs.existsSync(jobFile), 'TAKEOFF_JOB_FILE must be a .gr8job takeoff job');
const out = path.resolve(process.env.TAKEOFF_TWO_TENANT_OUT || 'artifacts/test-results/takeoff-two-tenant-20261105/browser');
fs.mkdirSync(out, { recursive: true });
const report = { steps: {}, errors: [], blocked: [] };
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (...args) => console.log(new Date().toISOString().slice(11, 19), ...args);
const authStorageKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;

const tenants = await seedTenants();
const browsers = [];
async function openBrowser(tenant) {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 1800000,
    userDataDir: path.join(out, `profile-${tenant.key}-${Date.now()}`), args: ['--no-first-run', '--disable-extensions'], defaultViewport: { width: 1600, height: 1000 } });
  browsers.push(browser);
  tenant.browser = browser;
  const page = await newTab(tenant);
  await page.goto(`${app}/login`, { waitUntil: 'domcontentloaded', timeout: 600000 });
  const [emailInput, passwordInput] = await Promise.all([
    page.waitForSelector('input[type="email"]', { timeout: 300000 }),
    page.waitForSelector('input[type="password"]', { timeout: 300000 }),
  ]);
  await emailInput.type(tenant.email);
  await passwordInput.type(tenant.password);
  await page.$eval('button[type="submit"]', (button) => button.click());
  await page.waitForFunction((key) => {
    try { return Boolean(JSON.parse(localStorage.getItem(key))?.access_token); }
    catch { return false; }
  }, { timeout: 600000 }, authStorageKey);
  return page;
}
async function newTab(tenant) {
  const page = await tenant.browser.newPage();
  page.setDefaultTimeout(300000);
  page.on('pageerror', (error) => report.errors.push(`${tenant.key}: ${error.message}`));
  page.on('dialog', (dialog) => dialog.accept());
  await page.setRequestInterception(true);
  // Only the isolated app and the isolated Supabase are reachable: nothing can touch production.
  page.on('request', (request) => {
    const target = request.url();
    if (target.startsWith(app) || target.startsWith(supabaseUrl) || /^(data|blob):/.test(target)) void request.continue();
    else { report.blocked.push(`${tenant.key}: ${request.method()} ${target.slice(0, 120)}`); void request.abort(); }
  });
  await page.evaluateOnNewDocument(({ workspaceId }) => {
    localStorage.setItem('active_workspace_id', workspaceId);
  }, {
    workspaceId: tenant.workspaceId,
  });
  return page;
}
const wallRows = (page) => page.evaluate(() => [...document.querySelectorAll('div')].filter((div) => div.children.length === 2 && /^(interior|exterior) \(\d+mm\):/.test(div.children[0]?.textContent || '') && div.children[1]?.tagName?.toLowerCase() === 'svg').length);
async function waitForWalls(page, label) {
  const started = Date.now();
  for (;;) {
    const labels = await page.$$eval('button', (buttons) => buttons.filter((b) => !b.disabled).map((b) => b.innerText.trim()));
    for (const text of ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local', 'Open as is']) if (labels.includes(text)) await page.evaluate((value) => [...document.querySelectorAll('button')].find((b) => !b.disabled && b.innerText.trim() === value)?.click(), text);
    const rows = await wallRows(page);
    if (rows > 0) return rows;
    if (Date.now() - started > 600000) { await page.screenshot({ path: path.join(out, `${label}-no-walls.png`) }); throw new Error(`${label}: no takeoff walls shown after 10 minutes`); }
    await delay(2000);
  }
}
async function openJob(page, label) {
  let input;
  try {
    await page.goto(`${app}/modules/estimate-builder?page=aiPlanTakeoff`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const started = Date.now();
    while (!input && Date.now() - started < 120000) {
      input = await page.$('[data-testid="open-local-job-file-input"]');
      if (input) break;
      const retried = await page.evaluate(() => {
        const retry = [...document.querySelectorAll('button')].find((button) => button.innerText.trim() === 'Retry' && !button.disabled);
        retry?.click();
        return Boolean(retry);
      });
      await delay(retried ? 10000 : 2000);
    }
    if (!input) throw new Error('Takeoff input did not appear before the bootstrap deadline');
  } catch (error) {
    const state = await page.evaluate(() => ({
      url: window.location.href,
      body: document.body.innerText.replace(/\s+/g, ' ').slice(0, 1000),
      storageKeys: Object.keys(localStorage).sort(),
      activeWorkspaceId: localStorage.getItem('active_workspace_id'),
    }));
    report.steps.bootstrapFailure = { ...(report.steps.bootstrapFailure || {}), [label]: state };
    await page.screenshot({ path: path.join(out, `${label}-bootstrap-failure.png`) });
    throw new Error(`${label}: Takeoff UI did not mount: ${JSON.stringify(state)}`, { cause: error });
  }
  await input.uploadFile(jobFile);
  return waitForWalls(page, label);
}
async function deleteWalls(page, count) {
  for (let i = 0; i < count; i++) {
    await page.evaluate(() => { const rows = [...document.querySelectorAll('div')].filter((div) => div.children.length === 2 && /^(interior|exterior) \(\d+mm\):/.test(div.children[0]?.textContent || '') && div.children[1]?.tagName?.toLowerCase() === 'svg'); rows[0]?.children[1].dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await delay(800);
  }
}
async function saveTakeoff(page) {
  await page.$eval('#ai-plan-takeoff-save-button', (button) => button.click());
  const started = Date.now();
  for (;;) {
    const text = await page.evaluate(() => document.body.innerText);
    const status = await page.$eval('[data-testid="job-persistence-status"]', (el) => el.innerText).catch(() => '');
    if (/Save stopped|older copy|newer|could not be saved|failed/i.test(text) && !/Saving/.test(status)) return { ok: false, status, message: (text.match(/Save stopped[^\n]*|[^\n]*older copy[^\n]*|[^\n]*failed[^\n]*/i) || [''])[0].slice(0, 300) };
    if (/Saved at/.test(status)) return { ok: true, status, seconds: Math.round((Date.now() - started) / 1000) };
    if (Date.now() - started > 900000) return { ok: false, status, message: 'no save result after 15 minutes' };
    await delay(1500);
  }
}

try {
  const { A, B } = tenants;
  const pageA = await openBrowser(A);
  const pageB = await openBrowser(B);
  // 1-2. Both users open, edit and save their own copy at the same time, then reopen in a fresh load.
  log('both users open the takeoff job');
  const startA = await openJob(pageA, 'A');
  const startB = await openJob(pageB, 'B');
  report.steps.opened = { A: startA, B: startB };
  assert.equal(startA, startB, 'both start from the same job file');
  await Promise.all([deleteWalls(pageA, 1), deleteWalls(pageB, 2)]);
  const [editedA, editedB] = await Promise.all([wallRows(pageA), wallRows(pageB)]);
  assert.equal(editedA, startA - 1); assert.equal(editedB, startB - 2);
  log('both users save at the same time');
  const [savedA, savedB] = await Promise.all([saveTakeoff(pageA), saveTakeoff(pageB)]);
  report.steps.concurrentSave = { A: savedA, B: savedB };
  assert.ok(savedA.ok && savedB.ok, `both saves succeed (${JSON.stringify(report.steps.concurrentSave)})`);
  const jobUrlA = pageA.url(), jobUrlB = pageB.url();
  log('reopen each in a fresh page load');
  await Promise.all([pageA.goto(jobUrlA, { waitUntil: 'domcontentloaded', timeout: 600000 }), pageB.goto(jobUrlB, { waitUntil: 'domcontentloaded', timeout: 600000 })]);
  const [reopenA, reopenB] = await Promise.all([waitForWalls(pageA, 'A-reopen'), waitForWalls(pageB, 'B-reopen')]);
  report.steps.reopened = { A: reopenA, B: reopenB, urlA: jobUrlA.replace(app, ''), urlB: jobUrlB.replace(app, '') };
  assert.equal(reopenA, startA - 1, 'user A reopens exactly their own saved edit');
  assert.equal(reopenB, startB - 2, 'user B reopens exactly their own saved edit');

  // 3. User B tries user A's server-registered job by its address.
  log('cross-tenant address attempt');
  const intrusion = await newTab(B);
  // A job of A's that holds a saved takeoff snapshot and transferred quotation rows (seeded by
  // test-takeoff-two-tenant-isolated.mjs), so "B sees nothing" is checked against real data A can see.
  const withQuote = (await A.db.from('builder_boq_items').select('project_id').eq('workspace_id', A.workspaceId).limit(1)).data || [];
  const foreignJob = withQuote[0]?.project_id || (await A.db.from('builder_commercial_projects').select('id').eq('workspace_id', A.workspaceId).limit(1).single()).data.id;
  const ownerSees = { snapshots: (await A.db.from('builder_estimate_snapshots').select('id').eq('project_id', foreignJob)).data?.length || 0, boq: (await A.db.from('builder_boq_items').select('id').eq('project_id', foreignJob)).data?.length || 0 };
  report.steps.ownerControl = ownerSees;
  assert.ok(ownerSees.snapshots > 0 && ownerSees.boq > 0, `user A can see its own snapshot and quotation rows for the probed job (${JSON.stringify(ownerSees)})`);
  await intrusion.goto(`${app}/jobs/${foreignJob}/takeoff`, { waitUntil: 'domcontentloaded', timeout: 600000 });
  await delay(20000);
  const seen = await intrusion.evaluate(() => document.body.innerText);
  report.steps.crossTenant = { foreignJob, wallRows: await wallRows(intrusion), excerpt: seen.replace(/\s+/g, ' ').slice(0, 300) };
  assert.equal(report.steps.crossTenant.wallRows, 0, 'user B sees no takeoff for user A\'s job');
  assert.ok(!seen.includes(`Takeoff job A`), 'user A\'s job name is not shown to user B');
  // 3b. From inside B's signed-in browser session (B's own token, the app's origin): A's saved takeoff
  // (measurements and approvals), A's transferred quotation rows and the quotation transfer endpoint
  // for A's workspace give B nothing; and nothing of A's job reached B's browser storage, which is
  // what B's own .gr8job export is built from.
  const probe = await intrusion.evaluate(async ({ supabaseUrl, anonKey, authStorageKey, app, foreignJob, workspaceA }) => {
    const token = JSON.parse(localStorage.getItem(authStorageKey) || '{}').access_token;
    const rest = async (query) => { const r = await fetch(`${supabaseUrl}/rest/v1/${query}`, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } }); return { status: r.status, rows: r.ok ? (await r.json()).length : null }; };
    const snapshots = await rest(`builder_estimate_snapshots?project_id=eq.${foreignJob}&select=id,workbook_snapshot`);
    const boq = await rest(`builder_boq_items?project_id=eq.${foreignJob}&select=id,quantity`);
    const procurement = await rest(`builder_procurement_items?project_id=eq.${foreignJob}&select=id`);
    const project = await rest(`builder_commercial_projects?id=eq.${foreignJob}&select=id`);
    const sync = await fetch(`${app}/api/builders/sync-commercial-snapshot`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-workspace-id': workspaceA }, body: JSON.stringify({ workspace_id: workspaceA, workbook: { jobId: 'probe' } }) });
    const dbNames = indexedDB.databases ? (await indexedDB.databases()).map((d) => d.name) : [];
    const local = Object.keys(localStorage).map((k) => `${k}=${localStorage.getItem(k)}`).join('\n');
    return { hasToken: Boolean(token), snapshots, boq, procurement, project, syncStatus: sync.status, storageMentionsForeignJob: local.includes(foreignJob) || dbNames.some((n) => String(n).includes(foreignJob)), storageMentionsWorkspaceA: local.includes(workspaceA) };
  }, { supabaseUrl, anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, authStorageKey, app, foreignJob, workspaceA: A.workspaceId });
  report.steps.crossTenantData = probe;
  assert.ok(probe.hasToken, 'the probe runs as signed-in user B');
  for (const key of ['snapshots', 'boq', 'procurement', 'project']) assert.ok(probe[key].status === 200 && probe[key].rows === 0, `user B's browser session gets none of user A's ${key} (${JSON.stringify(probe[key])})`);
  assert.equal(probe.syncStatus, 403, 'user B cannot transfer a quotation into user A\'s workspace from the browser');
  assert.ok(!probe.storageMentionsForeignJob && !probe.storageMentionsWorkspaceA, 'nothing of user A\'s job or workspace is in user B\'s browser storage (B\'s exports cannot contain it)');
  await intrusion.close();

  // 4. Stale tab: user A has the job open in two tabs; the first saves, then the stale second tries to.
  log('stale save from a second tab');
  const staleTab = await newTab(A);
  await staleTab.goto(jobUrlA, { waitUntil: 'domcontentloaded', timeout: 600000 });
  const staleStart = await waitForWalls(staleTab, 'A-stale');
  await deleteWalls(pageA, 1);
  const fresh = await saveTakeoff(pageA);
  assert.ok(fresh.ok, `the current tab saves (${JSON.stringify(fresh)})`);
  await deleteWalls(staleTab, 2);
  const stale = await saveTakeoff(staleTab);
  report.steps.staleSave = { freshSave: fresh, staleSave: stale, staleStartedWith: staleStart };
  assert.equal(stale.ok, false, 'the stale tab\'s save is refused');
  await staleTab.goto(jobUrlA, { waitUntil: 'domcontentloaded', timeout: 600000 });
  const recovered = await waitForWalls(staleTab, 'A-recovered');
  report.steps.staleSave.recoveredWalls = recovered;
  assert.equal(recovered, startA - 2, 'reloading recovers the newest saved takeoff; nothing was overwritten by the stale tab');
  // 5. Interrupted save: user B edits, starts saving and reloads the page while the save is running.
  // The job must reopen as either the last successful save or the completed new one, never partial.
  log('interrupted save');
  await deleteWalls(pageB, 1);
  const beforeInterrupt = await wallRows(pageB);
  await pageB.$eval('#ai-plan-takeoff-save-button', (button) => button.click());
  await delay(1500);
  const statusAtInterrupt = await pageB.$eval('[data-testid="job-persistence-status"]', (el) => el.innerText).catch(() => '');
  await pageB.goto(jobUrlB, { waitUntil: 'domcontentloaded', timeout: 600000 });
  const afterInterrupt = await waitForWalls(pageB, 'B-interrupted');
  report.steps.interruptedSave = { statusAtInterrupt, lastSaved: startB - 2, attempted: beforeInterrupt, reopened: afterInterrupt };
  assert.ok([startB - 2, beforeInterrupt].includes(afterInterrupt), `after an interrupted save the job is the last good save or the completed new one (${afterInterrupt})`);
  report.passed = true;
  log('PASS');
} catch (error) {
  report.passed = false; report.failure = error.message;
  throw error;
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  for (const browser of browsers) await browser.close().catch(() => {});
}
console.log('Takeoff two-tenant browser test passed:', JSON.stringify(report.steps));
