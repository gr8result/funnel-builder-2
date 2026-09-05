import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';

dotenv.config({ path: '.env.local', quiet: true });
const out = path.resolve('test-results/takeoff-route');
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'route-test@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
  const account = { approved: true, is_approved: true, status: 'active', subscription_status: 'active', business_name: 'Routing test' };
  await page.setRequestInterception(true);
  page.on('request', req => {
    const url = new URL(req.url());
    // All account/API calls are test doubles; no remote accounts or records change.
    if (url.pathname.startsWith('/api/') || url.hostname.endsWith('.supabase.co')) {
      let body = {};
      if (url.pathname.includes('/auth/v1/user')) body = user;
      else if (url.pathname.includes('/rest/v1/accounts')) body = account;
      else if (url.pathname === '/api/workspaces') body = { workspaces: [] };
      else if (url.pathname.includes('/rest/v1/')) body = [];
      return req.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': req.headers()['access-control-request-headers'] || '*', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS' }, body: JSON.stringify(body) });
    }
    return req.continue();
  });
  const authKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
  await page.evaluateOnNewDocument(({ authKey, user }) => {
    localStorage.setItem(authKey, JSON.stringify({ access_token: 'routing-test-token', refresh_token: 'routing-test-refresh', token_type: 'bearer', expires_at: Math.floor(Date.now() / 1000) + 3600, user }));
  }, { authKey, user });
  await page.goto('http://localhost:3000/recovered-takeoff.html', { waitUntil: 'domcontentloaded' });
  const original = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open('estimate-builder-template-db', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('jobs', { keyPath: 'key' });
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
    const records = ['job:03-09/123', 'job:03-09/123:snapshot:2026-09-04T21:10:42.804Z', 'job:03-09/123-recovered'].map(key => ({ key, type: 'job', workbook: { jobId: '03-09/123', untouched: key } }));
    await new Promise((resolve, reject) => {
      const tx = db.transaction('jobs', 'readwrite'); records.forEach(r => tx.objectStore('jobs').add(r));
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
    db.close(); return records;
  });
  const url = 'http://localhost:3000/modules/estimate-builder?page=aiPlanTakeoff';
  const assertNormal = async () => {
    console.log('Checking normal UI:', page.url());
    await page.waitForSelector('#legacy-job-loader', { timeout: 180000 });
    assert.equal(await page.$('[data-takeoff-safe-mode]'), null);
    assert.equal(page.url(), url);
    assert(await page.$('canvas'), 'Full Takeoff canvas mounts');
  };
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await assertNormal();
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
  await assertNormal();
  await page.screenshot({ path: path.join(out, 'normal-after-refresh.png') });
  await page.click('a[href="/modules/estimate-builder?page=aiPlanTakeoff&safeMode=1"]');
  await page.waitForSelector('[data-takeoff-safe-mode]', { timeout: 60000 });
  assert.equal(await page.$('#legacy-job-loader'), null);
  const after = await page.evaluate(async keys => {
    const db = await new Promise(resolve => { const r = indexedDB.open('estimate-builder-template-db'); r.onsuccess = () => resolve(r.result); });
    const records = [];
    for (const key of keys) records.push(await new Promise(resolve => { const r = db.transaction('jobs').objectStore('jobs').get(key); r.onsuccess = () => resolve(r.result); }));
    db.close(); return records;
  }, original.map(r => r.key));
  assert.deepEqual(after, original, 'Main, snapshot and recovered records remain unchanged');
  assert.deepEqual(errors, [], 'No browser runtime errors');
  console.log('PASS: normal Takeoff on initial navigation and refresh; explicit recovery link; saved records unchanged.');
} finally { await browser.close(); }
