// Runs Client Selections unit suites and records PASS/FAIL/SKIP with evidence.
// npm run test:client-selections -> artifacts/test-artifacts/client-selections-audit/suites.json
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const out = path.resolve('artifacts/test-artifacts/client-selections-audit'); fs.mkdirSync(out, { recursive: true });
const pattern = /^test-(?:client-selection|selection-|selections-|estimate-builder-client-selections-|residential-selections(?:-|\.)|(?:appliance|balustrade|benchtop|cabinetry|carpet|flooring|plumbing|product|service|exterior)-.*selection|exterior-doors-client-selections-)/;
const fixtureSuites = new Set(['test-selection-allocation-rooms.mjs', 'test-selection-cross-category-duplicates.mjs']);
const skipReasons = new Map([
  ['test-client-selections-memory.mjs', 'requires a running authenticated Client Selections browser app'],
  ['test-selections-cover.mjs', 'requires headless Chrome and a recovered-job PDF acceptance fixture'],
]);
const fixturePath = path.resolve('artifacts/recovered-03-09-123-profile.gr8job');
const suites = fs.readdirSync('scripts').filter((name) => /^test-.*\.mjs$/.test(name)
  && !/browser|live/.test(name)
  && pattern.test(name)).sort();
if (!suites.length) throw new Error('No Client Selections test suites were discovered.');
const results = []; let next = 0;
const run = (name) => new Promise((resolve) => {
  const started = Date.now(); let text = '';
  const child = spawn(process.execPath, ['--max-old-space-size=4096', '--import', './scripts/register-extensionless-loader.mjs', '--import', './scripts/register-json-loader.mjs', path.join('scripts', name)], { cwd: process.cwd() });
  const timeoutMs = name === 'test-carpet-selection.mjs' ? 600000 : 240000;
  const timer = setTimeout(() => { child.kill(); }, timeoutMs);
  child.stdout.on('data', (d) => { text += d; }); child.stderr.on('data', (d) => { text += d; });
  child.on('close', (code, signal) => { clearTimeout(timer); resolve({ suite: name, status: code === 0 ? 'PASS' : signal ? 'TIMEOUT' : 'FAIL', seconds: Math.round((Date.now() - started) / 1000), evidence: code === 0 ? '' : text.split(/\r?\n/).filter(Boolean).slice(-8).join('\n').slice(0, 900) }); });
});
await Promise.all(Array.from({ length: 2 }, async () => {
  while (next < suites.length) {
    const name = suites[next++];
    if (skipReasons.has(name)) {
      results.push({ suite: name, status: 'SKIP', seconds: 0, evidence: skipReasons.get(name) });
      continue;
    }
    if (fixtureSuites.has(name) && !fs.existsSync(fixturePath)) {
      results.push({ suite: name, status: 'SKIP', seconds: 0, evidence: `requires local job fixture: ${fixturePath}` });
      continue;
    }
    results.push(await run(name));
  }
}));
results.sort((a, b) => a.suite.localeCompare(b.suite));
const pass = results.filter((result) => result.status === 'PASS').length;
const fail = results.filter((result) => result.status === 'FAIL').length;
const timeout = results.filter((result) => result.status === 'TIMEOUT').length;
const skipped = results.filter((result) => result.status === 'SKIP').length;
fs.writeFileSync(path.join(out, 'suites.json'), JSON.stringify({ ranAt: new Date().toISOString(), total: results.length, pass, fail, timeout, skipped, results }, null, 1));
console.log(`suites ${results.length} pass ${pass} fail ${fail} timeout ${timeout} skipped ${skipped}`);
if (fail || timeout) process.exitCode = 1;
