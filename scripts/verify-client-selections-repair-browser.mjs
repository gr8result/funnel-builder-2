// Browser verification of the Client Selections workflow repair against a COPY of a saved job.
// The copy is opened in an isolated headless browser profile under a new job id; the original job
// is never opened and cloud writes are blocked. Needs the dev server (default http://localhost:3000).
// Covers: the attention list, Room Setup (unlisted locations, merge with conflict answers), the
// editable ceiling fan table (edit, remove, apply to other rooms) and the schedule (wall
// construction rows, tile images).
//
// Run: node --max-old-space-size=8192 --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/verify-client-selections-repair-browser.mjs <job.json>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local', quiet: true }); dotenv.config({ path: '.env', quiet: true });
const origin = process.env.CLIENT_SELECTIONS_BASE_URL || 'http://localhost:3000';
const out = path.resolve('artifacts/test-artifacts/client-selections-repair-verification'); fs.mkdirSync(out, { recursive: true });
const jobFile = process.argv[2];
assert(jobFile && fs.existsSync(jobFile), 'Pass the saved job JSON to verify.');
const saved = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
const projectId = process.env.CLIENT_SELECTIONS_VERIFY_JOB_ID || `local-repair-verify-${Date.now()}`;
const { projectEstimateBuilder, ...kept } = saved.workbook;
const workbook = { ...kept, projectId, registeredJobId: projectId, jobId: projectId, templateType: 'job', page: 'quotation',
  registeredJob: { ...(kept.registeredJob || {}), jobId: projectId, jobName: 'Repair verification copy' }, jobFileMeta: { ...(kept.jobFileMeta || {}), projectId, jobName: 'Repair verification copy' } };
const fixture = path.join(out, 'job-copy.json'); fs.writeFileSync(fixture, JSON.stringify({ projectId, jobName: 'Repair verification copy', workbook }));

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

const report = { job: saved.name || saved.workbook.jobName, revision: saved.revision, steps: {}, runtimeErrors: [], browserWarnings: [], failedRequests: [], blockedCloudWrites: 0 };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let page;
const shot = name => page.screenshot({ path: path.join(out, `${name}.png`) }).catch(() => {});
const clickText = (text, scope = 'button') => page.evaluate((label, selector) => { const el = [...document.querySelectorAll(selector)].find(b => !b.disabled && b.innerText.trim().toLowerCase() === label.toLowerCase()); el?.click(); return Boolean(el); }, text, scope);
const texts = selector => page.$$eval(selector, list => list.map(el => el.innerText.replace(/\s+/g, ' ').trim()));
const step = async (name, run) => { try { report.steps[name] = await run(); } catch (error) { report.steps[name] = { error: String(error.message).slice(0, 500) }; await shot(`failed-${name}`); } };
try {
  page = await browser.newPage(); page.setDefaultTimeout(120000);
  page.on('pageerror', error => report.runtimeErrors.push(error.message.slice(0, 300))); page.on('dialog', dialog => dialog.accept());
  page.on('console', message => { if (['warning', 'error'].includes(message.type())) report.browserWarnings.push({ type: message.type(), text: message.text().slice(0, 500) }); });
  page.on('requestfailed', request => report.failedRequests.push({ url: request.url().slice(0, 240), error: request.failure()?.errorText || '' }));
  await page.setRequestInterception(true);
  page.on('request', request => { if (/\/(rest|storage)\/v1\//.test(request.url()) && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) { report.blockedCloudWrites += 1; void request.abort(); } else void request.continue(); });
  await page.evaluateOnNewDocument(({ key, session, workspace }) => { localStorage.setItem(key, JSON.stringify(session)); localStorage.setItem('active_workspace_id', workspace); },
    { key: `sb-${new URL(url).hostname.split('.')[0]}-auth-token`, session: auth.session, workspace: workbook.workspaceId });

  await page.goto(`${origin}/modules/estimate-builder?page=quotation`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  const input = await page.waitForSelector('[data-testid="open-local-job-file-input"]'); await input.uploadFile(fixture);
  for (let n = 0; n < 8; n += 1) { await delay(400); await page.evaluate(() => { for (const text of ['Discard Changes', 'Open Job', 'Open Job File', 'Keep Local']) [...document.querySelectorAll('button')].find(b => !b.disabled && b.innerText.trim() === text)?.click(); }); }
  await page.waitForFunction(() => document.querySelectorAll('[data-quote-section]').length > 5, { timeout: 300000 });
  await delay(4000);
  const reviewReady = () => page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.innerText.trim() === 'Review Schedule'), { timeout: 120000 }).then(() => true, () => false);
  await page.evaluate(() => [...document.querySelectorAll('button, a')].find(element => element.innerText.trim() === 'Client Selections')?.click());
  if (!(await reviewReady())) {
    await page.goto(`${origin}/modules/estimate-builder?jobId=${encodeURIComponent(projectId)}&page=clientSelections`, { waitUntil: 'domcontentloaded', timeout: 240000 });
    assert(await reviewReady(), 'Client Selections did not open for the job copy.');
  }
  await delay(3000);

  await step('roomsBar', async () => ({ bar: (await texts('[data-testid="project-rooms-bar"]'))[0]?.slice(0, 260), reviewCount: (await texts('[data-testid="project-rooms-review-count"]'))[0] || '' }));
  await step('roomSetupGate', async () => {
    const entered = await page.evaluate(() => { const button = document.querySelector('[data-testid="guided-client-selections-home"] button[aria-label^="Open Interior"]'); button?.click(); return Boolean(button); });
    await delay(800);
    const gateState = await page.evaluate(() => ({ home: Boolean(document.querySelector('[data-testid="guided-client-selections-home"]')), manager: Boolean(document.querySelector('[data-testid="project-room-manager"]')), close: Boolean(document.querySelector('[data-testid="room-manager-close"]')), confirm: document.querySelector('[data-testid="room-setup-confirm-button"]')?.disabled ?? null, intro: [...document.querySelectorAll('h1,h2,h3')].map(node => node.innerText.trim()).slice(-5) }));
    if (!gateState.manager) throw new Error(`Room Setup gate did not open: ${JSON.stringify({ entered, ...gateState })}`);
    const closeButtonPresent = gateState.close;
    await page.keyboard.press('Escape'); await delay(250);
    const escapeBlocked = Boolean(await page.$('[data-testid="project-room-manager"]'));
    await page.waitForFunction(() => { const button = document.querySelector('[data-testid="room-setup-confirm-button"]'); return button && !button.disabled; }, { timeout: 30000 });
    await page.click('[data-testid="room-setup-confirm-button"]');
    await page.waitForFunction(() => !document.querySelector('[data-testid="project-room-manager"]'), { timeout: 30000 });
    return { entered, closeButtonPresent, escapeBlocked, confirmed: true };
  });

  // -- Attention list ------------------------------------------------------------------------------
  await clickText('Review Schedule');
  await page.waitForSelector('[data-testid="selection-attention"]', { timeout: 120000 });
  await page.waitForFunction(() => document.querySelectorAll('.documentPageFrame').length > 3, { timeout: 120000 }).catch(() => {});
  await delay(1500);
  const attention = () => page.evaluate(() => ({ heading: document.querySelector('[data-testid="selection-attention"] h2, [data-testid="selection-attention"] h3')?.innerText.trim(),
    completion: document.querySelector('[data-testid="attention-completion"]')?.innerText.replace(/\s+/g, ' ').trim(), readiness: document.querySelector('[data-testid="attention-readiness"]')?.innerText.replace(/\s+/g, ' ').trim(),
    groups: [...document.querySelectorAll('[data-testid="attention-group"]')].map(group => ({ title: (group.querySelector('h3, h4, summary, button')?.innerText || '').replace(/\s+/g, ' ').trim(), items: group.querySelectorAll('[data-testid="attention-item"]').length })),
    items: [...document.querySelectorAll('[data-testid="attention-item"]')].map(item => item.innerText.replace(/\s+/g, ' ').trim().slice(0, 200)), withoutAction: [...document.querySelectorAll('[data-testid="attention-item"]')].filter(item => !item.querySelector('[data-testid="attention-action"]')).length }));
  await step('attentionBefore', async () => { const a = await attention(); await shot('01-attention'); return { ...a, items: a.items.length, sample: a.items.slice(0, 6) }; });
  await step('preflight', async () => ({ missing: (await texts('[data-testid="preflight-missing"]'))[0] || '', linked: (await texts('[data-testid="preflight-linked-job"]'))[0] || '', johnson: await page.evaluate(() => { const at = document.body.innerText.search(/johnson/i); return at < 0 ? '' : document.body.innerText.slice(Math.max(0, at - 80), at + 80).replace(/s+/g, ' '); }) }));
  await step('scheduleRows', async () => {
    const frames = await page.$$('.documentPageFrame'); const rows = [];
    for (const frame of frames) { await frame.evaluate(el => el.scrollIntoView({ block: 'center' })); await page.waitForFunction(el => el.querySelector('.page'), { timeout: 60000 }, frame); await delay(700);
      rows.push(...await frame.evaluate(async el => { const images = [...el.querySelectorAll('.ssImage img')]; await Promise.all(images.map(image => image.complete ? null : new Promise(resolve => { image.onload = image.onerror = resolve; setTimeout(resolve, 8000); })));
        return [...el.querySelectorAll('.ssRow')].map(row => ({ text: [...row.querySelectorAll('td')].map(cell => cell.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' | '), image: Boolean(row.querySelector('.ssImage img')?.naturalWidth) })); })); }
    const tiles = rows.filter(row => /tile/i.test(row.text.split('|')[0]));
    return { rows: rows.length, walls: rows.filter(row => /^External Walls/i.test(row.text)).map(row => row.text.slice(0, 160)), tiles: tiles.length, tilesWithImage: tiles.filter(row => row.image).length, reconciliation: (await texts('[data-testid="schedule-reconciliation"]'))[0] };
  });

  // -- Room Setup: join the second bedroom ensuite's three names ------------------------------------
  await page.evaluate(() => window.scrollTo(0, 0));
  await step('roomSetup', async () => {
    const opened = await page.evaluate(() => { const item = [...document.querySelectorAll('[data-testid="attention-action"]')].find(button => /RESOLVE DUPLICATE|CONFIRM ROOMS|CHOOSE ROOM/i.test(button.innerText) && /room|ensuite|—/i.test(button.closest('[data-testid="attention-item"]').innerText) && !/Ceiling|Toilet|Fan/i.test(button.closest('[data-testid="attention-item"]').innerText)); item?.click(); return Boolean(item); });
    await page.waitForSelector('[data-testid="project-room-manager"]', { timeout: 30000 });
    await delay(800); await shot('02-room-setup');
    const unlistedBefore = await texts('[data-testid="room-unlisted-location"]');
    const merged = [];
    for (const name of ['2nd BEDROOM ENSUITE', 'Bed 2 Ensuite', '2nd Bedroom Ensuite Shower']) {
      const found = await page.evaluate(label => { const row = [...document.querySelectorAll('[data-testid="room-unlisted-location"]')].find(el => el.innerText.toLowerCase().includes(label.toLowerCase())); if (!row) return null;
        const select = row.querySelector('[data-testid="room-unlisted-target"]'); const option = [...select.options].find(o => /B2 Ensuite/i.test(o.textContent)); if (!option) return 'no-target';
        select.value = option.value; select.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'; }, name);
      if (found !== 'ok') { merged.push({ name, found }); continue; }
      await delay(300);
      await page.evaluate(label => [...document.querySelectorAll('[data-testid="room-unlisted-location"]')].find(el => el.innerText.toLowerCase().includes(label.toLowerCase())).querySelector('[data-testid="room-unlisted-assign"]').click(), name);
      await delay(900);
      const conflicts = await texts('[data-testid="room-merge-conflict"]');
      if (conflicts.length) {
        await shot(`03-conflicts-${merged.length}`);
        // "They are the same fixture": keep one, do not add the two quantities together.
        await page.evaluate(() => document.querySelectorAll('[data-testid="room-merge-conflict"]').forEach(conflict => { (conflict.querySelector('[data-testid="room-merge-answer-same"]') || conflict.querySelector('input[type=radio]'))?.click(); }));
        await delay(300); await shot(`03b-answered-${merged.length}`); await page.click('[data-testid="room-merge-conflicts-confirm"]');
      }
      // The merge is saved to the job before the list comes back.
      const started = Date.now();
      await page.waitForFunction(label => !document.querySelector('[data-testid="room-merge-conflicts"]') && ![...document.querySelectorAll('[data-testid="room-unlisted-location"]')].some(el => el.dataset.location === label), { timeout: 90000 }, name);
      merged.push({ name, seconds: Math.round((Date.now() - started) / 100) / 10, conflicts: conflicts.length, sample: conflicts[0]?.slice(0, 160), message: (await texts('[data-testid="room-manager-message"]'))[0]?.slice(0, 200) });
    }
    const unlistedAfter = await texts('[data-testid="room-unlisted-location"]');
    const confirm = await page.$('[data-testid="room-setup-confirm-button"]');
    if (confirm) {
      await page.waitForFunction(() => { const button = document.querySelector('[data-testid="room-setup-confirm-button"]'); return button && !button.disabled; }, { timeout: 90000 });
      await confirm.click();
      await page.waitForFunction(() => document.querySelector('[data-testid="project-room-manager"]') === null || document.querySelector('[data-testid="room-setup-confirm"][data-confirmed="true"]'), { timeout: 90000 });
    }
    await shot('04-room-setup-after');
    const confirmedText = (await texts('[data-testid="room-setup-confirm"]'))[0]?.slice(0, 160);
    await page.click('[data-testid="room-manager-close"]').catch(() => {});
    return { opened, unlistedBefore: unlistedBefore.map(t => t.slice(0, 90)), merged, unlistedAfter: unlistedAfter.map(t => t.slice(0, 90)), confirmedText };
  });
  await delay(1500);
  await step('attentionAfterRooms', async () => { const a = await attention(); return { groups: a.groups, items: a.items.length, ensuiteItems: a.items.filter(text => /2nd bedroom|bed 2 ensuite/i.test(text)).length, accessories: a.items.filter(text => /towel|robe|toilet roll/i.test(text)).map(t => t.slice(0, 120)) }; });

  // -- Ceiling fans: every assignment editable -------------------------------------------------------
  await step('fans', async () => {
    const opened = await page.evaluate(() => { const item = [...document.querySelectorAll('[data-testid="attention-item"]')].find(el => /Ceiling Fan/i.test(el.innerText)); item?.querySelector('[data-testid="attention-action"]')?.click(); return item?.innerText.replace(/\s+/g, ' ').slice(0, 200) || ''; });
    await page.waitForSelector('[data-testid="selection-assignments"]', { timeout: 60000 });
    await delay(1200); await shot('05-fans-before');
    const read = () => page.evaluate(() => ({ reconciliation: document.querySelector('[data-testid="assignment-reconciliation"]')?.innerText.replace(/\s+/g, ' ').trim(), shared: document.querySelector('[data-testid="assignment-shared-rooms"]')?.innerText.replace(/\s+/g, ' ').trim().slice(0, 260) || '', notRooms: document.querySelector('[data-testid="assignment-not-rooms"]')?.innerText.replace(/\s+/g, ' ').trim().slice(0, 260) || '',
      groups: document.querySelectorAll('[data-testid="assignment-group"]').length, rows: [...document.querySelectorAll('[data-testid="assignment-row"]')].map(row => ({ location: row.dataset.location, cells: [...row.querySelectorAll('td')].slice(0, 4).map(td => td.innerText.trim()).join(' | '), actions: [...row.querySelectorAll('button')].map(b => b.innerText.trim()).join(',') })) }));
    const before = await read();
    // Collapse and re-open a grouped row.
    await page.click('[data-testid="assignment-group"] button.toggle'); await delay(300); const collapsedRows = (await read()).rows.length; await page.click('[data-testid="assignment-group"] button.toggle'); await delay(300);
    // Edit: the two fans saved against "DOWNSTAIRS" become one fan in the Family room.
    const row = sel => `[data-testid="assignment-row"][data-location="${sel}"]`;
    await page.click(`${row('downstairs')} button[data-action="edit"]`); await delay(300);
    await page.select(`${row('downstairs')} select`, 'Family');
    await page.$eval(`${row('downstairs')} input[type=number]`, el => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, '1'); el.dispatchEvent(new Event('input', { bubbles: true })); });
    await clickText('Save', `${row('downstairs')} button`);
    await page.waitForFunction(() => !document.querySelector('[data-testid="assignment-saving"]'), { timeout: 90000 });
    const afterEdit = await read();
    // Remove: the second fan in Alfresco (SPYDA), leaving the Stanza.
    await page.evaluate(() => { const target = [...document.querySelectorAll('[data-testid="assignment-row"][data-location="alfresco"]')][0]; target.querySelector('button[data-action="remove"]').click(); });
    await page.waitForFunction(() => !document.querySelector('[data-testid="assignment-saving"]'), { timeout: 90000 });
    const afterRemove = await read();
    // Apply to other rooms: preview first.
    await page.evaluate(() => [...document.querySelectorAll('[data-testid="assignment-row"][data-location="bedroom-1"] button[data-action="apply"]')][0].click());
    await page.waitForSelector('[data-testid="apply-to-rooms"]'); await delay(300);
    await page.evaluate(() => { for (const label of document.querySelectorAll('[data-testid="apply-to-rooms"] .roomGrid label')) if (/^(Study|Bedroom 2|Balcony)\b/.test(label.innerText.trim())) label.querySelector('input').click(); }); await delay(400);
    const preview = await page.$$eval('[data-testid="apply-preview"] li', list => list.map(li => `${li.dataset.state}: ${li.innerText.replace(/\s+/g, ' ').trim()}`)); await shot('06-apply-preview');
    await page.waitForFunction(() => { const button = [...document.querySelectorAll('[data-testid="apply-to-rooms"] button')].find(item => item.innerText.trim() === 'Apply to selected rooms'); return button && !button.disabled; }, { timeout: 90000 });
    const applyClicked = await clickText('Apply to selected rooms', '[data-testid="apply-to-rooms"] button');
    await page.waitForFunction(() => document.querySelector('[data-testid="assignment-saving"]') || !document.querySelector('[data-testid="apply-to-rooms"]'), { timeout: 90000 });
    report.fanSaveStateAfterApply = await page.evaluate(() => ({
      saving: document.querySelector('[data-testid="assignment-saving"]')?.innerText.replace(/\s+/g, ' ').trim() || '',
      error: document.querySelector('[data-testid="assignment-save-error"]')?.innerText.replace(/\s+/g, ' ').trim() || '',
      dialog: document.querySelector('[data-testid="apply-to-rooms"]')?.innerText.replace(/\s+/g, ' ').trim().slice(-500) || '',
      applyButtonDisabled: [...document.querySelectorAll('[data-testid="apply-to-rooms"] button')].find(button => button.innerText.trim() === 'Apply to selected rooms')?.disabled ?? null,
    }));
    report.fanSaveStateAfterApply.clicked = applyClicked;
    const persistedStudyAssignment = await page.waitForFunction(async jobId => {
      for (const { name } of await indexedDB.databases()) {
        if (!name.includes('estimate-builder-template-db')) continue;
        const db = await new Promise((resolve, reject) => { const request = indexedDB.open(name); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        try {
          if (!db.objectStoreNames.contains('jobs')) continue;
          const record = await new Promise((resolve, reject) => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(`job:${jobId}`); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
          const lines = (record?.workbook?.clientSelectionsBook?.rooms || []).flatMap(room => room.rows || []).filter(row => row.guidedRequirementKey === 'ceiling-fan' || row.guidedSelection?.requirementKey === 'ceiling-fan').flatMap(row => row.guidedSelection?.plumbingAllocation?.lines || []);
          const allocation = lines.flatMap(line => line.allocations || []).find(item => /^study$/i.test(item.location || ''));
          if (allocation?.quantity === 1) return { product: lines.find(line => line.allocations?.includes(allocation))?.productName, quantity: allocation.quantity };
        } finally { db.close(); }
      }
      return false;
    }, { timeout: 90000 }, projectId);
    const afterApply = await read(); await shot('07-fans-after');
    return { opened, before: { reconciliation: before.reconciliation, shared: before.shared, notRooms: before.notRooms, groups: before.groups, rows: before.rows.length, actions: before.rows[0]?.actions }, collapsedRows,
      afterEdit: { reconciliation: afterEdit.reconciliation, family: afterEdit.rows.filter(r => r.location === 'family').map(r => r.cells), downstairs: afterEdit.rows.filter(r => r.location === 'downstairs').length },
      afterRemove: { reconciliation: afterRemove.reconciliation, alfresco: afterRemove.rows.filter(r => r.location === 'alfresco').map(r => r.cells) }, preview,
      afterApply: { persistedStudyAssignment, reconciliation: afterApply.reconciliation, study: afterApply.rows.filter(r => r.location === 'study').map(r => r.cells), bedroom2: afterApply.rows.filter(r => r.location === 'bedroom-2').length, balcony: afterApply.rows.filter(r => r.location === 'balcony').map(r => r.cells) } };
  });
  const persistedCopy = await page.evaluate(async (key) => {
    for (const { name } of await indexedDB.databases()) {
      if (!name.includes('estimate-builder-template-db')) continue;
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open(name); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      try {
        if (!db.objectStoreNames.contains('jobs')) continue;
        const record = await new Promise((resolve, reject) => { const request = db.transaction('jobs', 'readonly').objectStore('jobs').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        if (record?.workbook) return { revision: record.revision, savedAt: record.savedAt, workbook: record.workbook };
      } finally { db.close(); }
    }
    return null;
  }, `job:${projectId}`);
  assert(persistedCopy?.workbook, 'The isolated job copy remains in local job storage after the edits.');
  const reopenSnapshotPath = path.join(out, 'job-copy-after-edits.json');
  fs.writeFileSync(reopenSnapshotPath, JSON.stringify({ name: 'New Job 03/09 verification copy', jobId: projectId, revision: persistedCopy.revision, savedAt: persistedCopy.savedAt, workbook: persistedCopy.workbook }));
  report.reopenSnapshot = { path: reopenSnapshotPath, jobId: projectId, revision: persistedCopy.revision, roomCount: persistedCopy.workbook.clientSelectionsBook?.rooms?.length || 0,
    selectionRows: (persistedCopy.workbook.clientSelectionsBook?.rooms || []).reduce((count, room) => count + (room.rows || []).length, 0) };
  report.reopenSnapshot.guidedRecords = (persistedCopy.workbook.clientSelectionsBook?.rooms || []).flatMap(room => room.rows || []).filter(row => row.guidedRequirementKey || row.guidedSelection).length;
  report.passed = !Object.values(report.steps).some(value => value?.error) && report.runtimeErrors.length === 0;
} catch (error) { report.error = String(error.stack).slice(0, 1500); if (page) await shot('failure'); }
finally { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 1)); await browser.close(); }
if (!report.passed) process.exitCode = 1;
