import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { recordSafeModeMemory } from './measure-takeoff-safe-mode.mjs';

const out = process.env.RECOVERY_DIR ? path.resolve(process.env.RECOVERY_DIR) : path.resolve('recovery', `emergency-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(out, { recursive: true });
const userDataDir = path.join(out, 'isolated-chrome');
const source = 'C:/Users/grant/AppData/Local/Google/Chrome/User Data/Profile 6/IndexedDB';
for (const suffix of (process.env.RECOVERY_DIR ? [] : ['leveldb', 'blob'])) {
  const name = `http_localhost_3000.indexeddb.${suffix}`;
  if (fs.existsSync(path.join(source, name))) fs.cpSync(path.join(source, name), path.join(userDataDir, 'Default/IndexedDB', name), { recursive: true, filter: file => path.basename(file) !== 'LOCK' });
}
console.log('Preserved current localhost IndexedDB copy:', out);
const browser = process.env.RECOVERY_CDP ? await puppeteer.connect({ browserURL: process.env.RECOVERY_CDP }) : await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 600000, userDataDir, args: ['--no-first-run', '--disable-extensions'] });
let outputFd = null;
const token = crypto.randomBytes(24).toString('hex');
const server = http.createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  if (request.url !== '/' + token || request.method !== 'POST' || outputFd === null) { response.writeHead(403).end(); return; }
  try { for await (const chunk of request) fs.writeSync(outputFd, chunk); response.writeHead(204).end(); }
  catch { response.writeHead(500).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const endpoint = `http://127.0.0.1:${server.address().port}/${token}`;
try {
  const page = await browser.newPage();
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: out });
  const requests = [], errors = [];
  if (process.env.RECOVERY_METADATA_ONLY) {
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.url().endsWith('/takeoff-recovery-worker.js')) {
        const guard = `for (const method of ['get', 'getAll', 'openCursor']) { const original = IDBObjectStore.prototype[method]; IDBObjectStore.prototype[method] = function(...args) { if (this.name === 'jobs') throw new Error('Forbidden legacy payload read on safe-mode mount'); return original.apply(this, args); }; }\n`;
        request.respond({ status: 200, contentType: 'application/javascript', body: guard + fs.readFileSync('public/takeoff-recovery-worker.js', 'utf8') });
      } else request.continue();
    });
  }
  page.on('request', req => requests.push(req.url()));
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:3000/modules/estimate-builder?page=aiPlanTakeoff&safeMode=1', { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForSelector('[data-takeoff-safe-mode]', { timeout: 180000 });
  await page.waitForFunction(() => /Metadata scan complete|No Takeoff database/.test(document.querySelector('[role=status]')?.textContent || ''), { timeout: 180000 });
  if (process.env.RECOVERY_METADATA_CATALOG_FROM) {
    const verified = JSON.parse(fs.readFileSync(process.env.RECOVERY_METADATA_CATALOG_FROM, 'utf8')).verified || [];
    for (const row of verified) {
      if (!row.key.includes(':snapshot:')) continue; // Latest primary record has its own newer verification.
      await page.evaluate(row => new Promise((resolve, reject) => {
        const worker = new Worker('/takeoff-recovery-worker.js');
        worker.onmessage = ({ data }) => { if (data.type === 'done' || data.type === 'error') { worker.terminate(); data.type === 'done' ? resolve() : reject(new Error(data.message)); } };
        worker.onerror = error => { worker.terminate(); reject(new Error(error.message)); };
        worker.postMessage({ action: 'catalog', row });
      }), { id: row.key, projectId: row.projectId, name: row.name, savedAt: row.savedAt, revision: row.revision, pageCount: row.pageCount, byteSize: row.bytes });
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /Metadata scan complete/.test(document.querySelector('[role=status]')?.textContent || ''));
  }
  const before = await page.metrics();
  const table = await page.$eval('table', node => node.innerText);
  fs.writeFileSync(path.join(out, 'metadata.txt'), table);
  await page.screenshot({ path: path.join(out, 'safe-mode.png'), fullPage: true });
  const keys = await page.$$eval('tbody tr', rows => rows.map(row => row.cells[0].textContent));
  console.log('Metadata records:', keys.length, 'JS heap MB:', before.JSHeapUsedSize / 1048576);
  async function verifyAndCatalog(destination) {
    const verification = spawnSync(process.execPath, ['scripts/verify-takeoff-emergency-backups.mjs', destination, '--record'], { encoding: 'utf8' });
    if (verification.status !== 0) return false;
    const verified = JSON.parse(verification.stdout);
    await page.evaluate(async row => new Promise((resolve, reject) => {
      const worker = new Worker('/takeoff-recovery-worker.js');
      worker.onmessage = ({ data }) => { if (data.type === 'done' || data.type === 'error') { worker.terminate(); data.type === 'done' ? resolve() : reject(new Error(data.message)); } };
      worker.onerror = error => { worker.terminate(); reject(new Error(error.message)); };
      worker.postMessage({ action: 'catalog', row });
    }), { id: verified.key, name: verified.name, projectId: verified.projectId, savedAt: verified.savedAt, revision: verified.revision, pageCount: verified.pageCount, byteSize: verified.bytes });
    return true;
  }
  for (const [index, key] of (process.env.RECOVERY_METADATA_ONLY ? [] : process.env.RECOVERY_SELECTED_KEYS ? JSON.parse(process.env.RECOVERY_SELECTED_KEYS) : keys).entries()) {
    const filename = `${String(index).padStart(4, '0')}-${key.replace(/[^a-z0-9.-]/gi, '_')}.raw.json`;
    const destination = path.join(out, filename);
    if (fs.existsSync(destination)) {
      if (await verifyAndCatalog(destination)) { console.log('Already independently parsed', key); continue; }
      fs.renameSync(destination, destination + '.partial-' + Date.now());
    }
    const partial = destination + '.streaming-' + Date.now();
    outputFd = fs.openSync(partial, 'wx');
    let exportResult;
    try {
      exportResult = await page.evaluate(async ({ key, endpoint }) => {
        return await new Promise((resolve, reject) => {
          const worker = new Worker('/takeoff-recovery-worker.js');
          worker.onmessage = ({ data }) => {
            if (data.type === 'done' || data.type === 'error') {
              worker.terminate();
              data.type === 'done' ? resolve(data.bytes) : reject(new Error(data.message));
            }
          };
          worker.onerror = error => { worker.terminate(); reject(new Error(error.message)); };
          worker.postMessage({ action: 'export', key, endpoint });
        });
      }, { key, endpoint });
      fs.fsyncSync(outputFd);
    } finally { fs.closeSync(outputFd); outputFd = null; }
    if (!exportResult || fs.statSync(partial).size !== exportResult) throw new Error(`Incomplete export: ${key}`);
    fs.renameSync(partial, destination);
    if (!await verifyAndCatalog(destination)) throw new Error(`Independent parsing failed: ${key}`);
    console.log('Exported and independently parsed', key, exportResult);
  }
  if (process.env.RECOVERY_METADATA_ONLY) await recordSafeModeMemory(browser, page, out);
  const after = await page.metrics();
  const report = { out, source, keys, before, after, errors, legacyValueReadsBlocked: Boolean(process.env.RECOVERY_METADATA_ONLY), forbiddenElements: await page.$$eval('canvas,iframe,embed,object', nodes => nodes.length), requests };
  fs.writeFileSync(path.join(out, process.env.RECOVERY_METADATA_ONLY ? 'safe-mode-browser-report.json' : 'export-browser-report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(out, 'browser-report.json'), JSON.stringify(report, null, 2));
  console.log('REPORT', path.join(out, 'browser-report.json'));
} finally { server.close(); await browser.close(); }
