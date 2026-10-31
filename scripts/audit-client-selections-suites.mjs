// Runs the Client Selections related unit suites and records PASS/FAIL with evidence.
// node scripts/audit-client-selections-suites.mjs  -> artifacts/test-artifacts/client-selections-audit/suites.json
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const out = path.resolve('artifacts/test-artifacts/client-selections-audit'); fs.mkdirSync(out, { recursive: true });
const pattern = /client-selection|selection|schedule|inclusion|product-library|catalogue|room|tiling|flooring|electrical|plumbing|appliance|balustrade|stair|paint|cabinet|benchtop|accessor|hot-water|hvac|lighting|fan|window|door|bathroom|mirror|shower|floor/;
const suites = fs.readdirSync('scripts').filter((name) => /^test-.*\.mjs$/.test(name) && !/browser|live/.test(name) && pattern.test(name)).sort();
const results = []; let next = 0;
const run = (name) => new Promise((resolve) => {
  const started = Date.now(); let text = '';
  const child = spawn(process.execPath, ['--max-old-space-size=4096', '--import', './scripts/register-extensionless-loader.mjs', '--import', './scripts/register-json-loader.mjs', path.join('scripts', name)], { cwd: process.cwd() });
  const timer = setTimeout(() => { child.kill(); }, 240000);
  child.stdout.on('data', (d) => { text += d; }); child.stderr.on('data', (d) => { text += d; });
  child.on('close', (code, signal) => { clearTimeout(timer); resolve({ suite: name, status: code === 0 ? 'PASS' : signal ? 'TIMEOUT' : 'FAIL', seconds: Math.round((Date.now() - started) / 1000), evidence: code === 0 ? '' : text.split(/\r?\n/).filter(Boolean).slice(-8).join('\n').slice(0, 900) }); });
});
await Promise.all(Array.from({ length: 4 }, async () => { while (next < suites.length) { const name = suites[next++]; results.push(await run(name)); } }));
results.sort((a, b) => a.suite.localeCompare(b.suite));
fs.writeFileSync(path.join(out, 'suites.json'), JSON.stringify({ ranAt: new Date().toISOString(), total: results.length, pass: results.filter((r) => r.status === 'PASS').length, results }, null, 1));
console.log(`suites ${results.length} pass ${results.filter((r) => r.status === 'PASS').length} fail ${results.filter((r) => r.status === 'FAIL').length} timeout ${results.filter((r) => r.status === 'TIMEOUT').length}`);
