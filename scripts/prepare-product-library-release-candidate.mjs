import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import dotenv from 'dotenv';

const root = process.cwd();
const baseCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const output = path.resolve('artifacts/product-library-release-candidate');
const seeds = [
  'pages/modules/builders/product-library.js', 'pages/modules/builders/selections-book.js',
  'pages/modules/builders/procurement-schedule.js', 'pages/modules/builders/variations.js',
  'components/estimate-builder/EstimateBuilderWorkbook.js', 'hooks/estimate-builder/useEstimateBuilderWorkbook.js',
  'pages/api/builders/product-catalogue.js', 'pages/api/builders/product-import.js',
  'pages/api/builders/selection-foundation.js', 'pages/api/builders/proposal-document-export.js',
  'scripts/test-builder-product-csv-import.mjs', 'scripts/test-product-library-database-catalogue.mjs',
  'scripts/test-product-selection-integrity.mjs', 'scripts/test-appliance-selection-quotation-sync.mjs',
  'scripts/test-selection-commercial-e2e.mjs', 'scripts/test-quotation-builder-save-reopen-regression.mjs',
  'scripts/test-procurement-embedded-isolation.mjs', 'scripts/test-procurement-isolated-window-evidence.mjs',
  'scripts/register-extensionless-loader.mjs', 'scripts/register-json-loader.mjs',
  'scripts/audit-product-selection-release-blockers.mjs', 'scripts/verify-product-selection-reconciled-copy.mjs',
  'scripts/inspect-product-library-schema-readonly.mjs', 'scripts/prepare-product-library-release-candidate.mjs',
  'scripts/verify-product-library-release-regressions.mjs',
  'supabase/migrations/20261004000100_builder_product_csv_import.sql',
  'supabase/review/product_library_release_readonly.sql', 'docs/product-library-release-recovery-runbook.md',
  'package.json', 'package-lock.json',
];
const excluded = /^(?:lib\/(?:landing-pages|email|smsglobal|website-builder)\/|components\/(?:landing-pages|website-builder|construction-estimation\/ai-plan-takeoff)\/|pages\/api\/(?:email|smsglobal|social|automation|landing-pages|website-builder)\/)|(?:tradePayment|TradePayment|managedSubcontract|ManagedSubcontract|SubcontractCashflow)/;
const allowed = /^(?:lib\/(?:product-library|builders|construction-estimation|job-storage|standard-inclusions)\/|components\/(?:product-library|client-selections|estimate-builder)\/|data\/product-library\/|scripts\/|supabase\/(?:migrations|review)\/|docs\/product-library-)/;
const shared = new Set(['lib/withWorkspace.js', 'lib/authSessionState.js', 'lib/jobFile.ts', 'lib/nonStealingLock.js', 'lib/lockRetry.js']);
const sha = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const baseBytes = (file) => {
  try { return execFileSync('git', ['show', `${baseCommit}:${file}`], { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return null; }
};
const resolveLocal = (importer, request) => {
  if (!request.startsWith('.')) return null;
  const prefix = path.resolve(path.dirname(path.join(root, importer)), request);
  for (const file of [prefix, ...['.js', '.jsx', '.ts', '.tsx', '.mjs', '.json', '.css'].map((ext) => prefix + ext), ...['index.js', 'index.jsx', 'index.ts'].map((name) => path.join(prefix, name))]) {
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      const relative = path.relative(root, file).replaceAll('\\', '/');
      assert(!relative.startsWith('../'), 'An import escapes the workspace');
      return relative;
    }
  }
  return { missing: request };
};
const queue = seeds.map((file) => ({ file, from: null }));
const visited = new Set();
const overlay = [];
const inherited = [];
const blocked = [];
const privateValues = Object.entries({ ...dotenv.parse(fs.existsSync('.env') ? fs.readFileSync('.env') : ''), ...dotenv.parse(fs.existsSync('.env.local') ? fs.readFileSync('.env.local') : '') })
  .filter(([name, value]) => !name.startsWith('NEXT_PUBLIC_') && /SECRET|PASSWORD|TOKEN|PRIVATE|SERVICE_ROLE|SERVICE_KEY|API_KEY/.test(name) && value.length >= 20);
const secretFindings = [];
while (queue.length) {
  const { file, from } = queue.shift();
  if (visited.has(file)) continue;
  visited.add(file);
  if (!fs.existsSync(file)) { blocked.push({ file, from, reason: 'MISSING_REQUIRED_FILE' }); continue; }
  const current = fs.readFileSync(file);
  const baseline = baseBytes(file);
  const changed = !baseline || !baseline.equals(current);
  const permitted = seeds.includes(file) || allowed.test(file) || shared.has(file);
  if (changed && (!permitted || excluded.test(file))) {
    blocked.push({ file, from, reason: 'DIRTY_DEPENDENCY_OUTSIDE_RELEASE_SCOPE' });
  }
  const selected = changed && permitted && !excluded.test(file) ? current : baseline;
  if (!selected) { blocked.push({ file, from, reason: 'EXCLUDED_DEPENDENCY_NOT_IN_BASE_COMMIT' }); continue; }
  const record = { path: file, sha256: sha(selected), bytes: selected.length, importedBy: from };
  if (changed && permitted && !excluded.test(file)) overlay.push(record); else inherited.push(record);
  if (selected.length < 10 * 1024 * 1024) {
    const text = selected.toString('utf8');
    for (const [name, value] of privateValues) if (text.includes(value)) secretFindings.push({ path: file, credentialName: name });
    if (/\.(?:js|jsx|ts|tsx|mjs)$/.test(file)) {
      const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.JS);
      const requests = new Set();
      const visit = (node) => {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) requests.add(node.moduleSpecifier.text);
        if (ts.isCallExpression(node) && node.arguments.length && ts.isStringLiteral(node.arguments[0]) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(source) === 'require')) requests.add(node.arguments[0].text);
        ts.forEachChild(node, visit);
      };
      visit(source);
      for (const request of requests) {
        const dependency = resolveLocal(file, request);
        if (dependency?.missing) blocked.push({ file, request, reason: 'MISSING_LOCAL_IMPORT' });
        else if (dependency) queue.push({ file: dependency, from: file });
      }
    }
  }
}
assert.equal(secretFindings.length, 0, `Private credential values found in release sources: ${JSON.stringify(secretFindings)}`);
fs.mkdirSync(output, { recursive: true });
for (const record of overlay) {
  const target = path.join(output, 'overlay', record.path);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(record.path, target);
  assert.equal(sha(fs.readFileSync(target)), record.sha256, 'Source changed during candidate snapshot');
}
const manifest = {
  capturedAt: new Date().toISOString(), sourceDirectory: root, candidateDirectory: output,
  baseCommit, releaseCommit: null, type: 'REVIEW_ONLY_BASE_PLUS_OVERLAY',
  status: blocked.length ? 'BLOCKED_REQUIRED_SHARED_DEPENDENCIES' : 'SOURCE_CLOSURE_CAPTURED_NOT_ACCEPTED',
  overlay, inherited, blockers: blocked, secretCheck: { exactPrivateEnvironmentValueMatches: secretFindings.length, credentialFilesCopied: false, scope: 'Selected source files only; not a comprehensive secret scanner.' },
  exclusions: ['No .env files, credentials, job/customer archives, node_modules or build output', 'No unrelated landing-page, email, SMS, social scheduler or website-builder changes', 'No unfinished trade-payment/subcontract modules or AI takeoff UI changes'],
  limitations: ['No release commit created.', 'Import closure does not verify dynamic asset references or deployment route completeness.', 'This overlay is not an accepted clean-install/build candidate; blocked shared-file dependencies must be resolved before reconstruction/testing.'],
};
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ candidate: output, baseCommit, status: manifest.status, overlayFiles: overlay.length, inheritedDependencies: inherited.length, blockers: blocked, secretCheck: manifest.secretCheck }, null, 2));