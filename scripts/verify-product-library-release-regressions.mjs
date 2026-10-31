import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';

const scripts = [
  'test-builder-product-csv-import.mjs', 'test-product-library-database-catalogue.mjs',
  'test-product-selection-integrity.mjs', 'test-appliance-selection-quotation-sync.mjs',
  'test-selection-commercial-e2e.mjs', 'test-quotation-builder-save-reopen-regression.mjs',
  'test-procurement-embedded-isolation.mjs', 'test-procurement-isolated-window-evidence.mjs',
  'test-plumbing-selection-gst.mjs',
];
const directory = 'artifacts/test-artifacts/product-selection-integrity/release-regressions';
fs.mkdirSync(directory, { recursive: true });
const requested = process.argv.slice(2);
assert(requested.every((name) => scripts.includes(name)), 'Only the fixed release suites can be run');
const resultPath = path.join(directory, 'results.json');
const previous = requested.length && fs.existsSync(resultPath) ? JSON.parse(fs.readFileSync(resultPath, 'utf8')).results : [];
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/SUPABASE|API_KEY|SERVICE_KEY|SERVICE_ROLE|SECRET|PASSWORD|ACCESS_TOKEN/.test(name)));
Object.assign(env, { NEXT_PUBLIC_SUPABASE_URL: 'https://offline.invalid', SUPABASE_URL: 'https://offline.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'isolated-unused', SUPABASE_SERVICE_ROLE_KEY: 'isolated-unused' });
const results = previous.filter((entry) => !requested.includes(path.basename(entry.script)));
for (const script of requested.length ? requested : scripts) {
  const file = path.join('scripts', script);
  const startedAt = Date.now();
  const result = spawnSync(process.execPath, ['--import', './scripts/register-extensionless-loader.mjs', '--import', './scripts/register-json-loader.mjs', file], {
    env, encoding: 'utf8', timeout: 180_000, maxBuffer: 4 * 1024 * 1024,
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  const log = path.join(directory, `${script}.log`);
  fs.writeFileSync(log, output);
  const entry = { capturedAt: new Date().toISOString(), script: file, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), passed: result.status === 0, exitCode: result.status,
    error: result.error?.message || null, elapsedMs: Date.now() - startedAt, log };
  results.push(entry);
  console.log(`${entry.passed ? 'PASS' : 'FAIL'} ${script}`);
}
const report = { capturedAt: new Date().toISOString(), baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  evidenceType: 'Offline/unit/database-fixture regressions only; not real Supabase authenticated browser acceptance',
  node: process.version, results, passed: results.filter((entry) => entry.passed).length, total: results.length };
fs.writeFileSync(path.join(directory, 'results.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ passed: report.passed, total: report.total, report: path.join(directory, 'results.json') }));
if (report.passed !== report.total) process.exitCode = 1;