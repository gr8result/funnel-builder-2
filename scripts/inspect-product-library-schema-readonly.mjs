import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ path: '.env', quiet: true });
const expectedProject = 'bvtxfphktypdqmlnveqf';
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
assert(url, 'Supabase URL is required');
assert.equal(new URL(url).hostname, `${expectedProject}.supabase.co`, 'Refusing an unexpected production project');
const keys = {
  anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
  service: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY,
};
const tables = ['builder_products', 'builder_product_suppliers', 'builder_selection_aliases', 'builder_product_imports'];
const probes = [];
for (const [role, key] of Object.entries(keys)) {
  if (!key) { probes.push({ role, configured: false }); continue; }
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  for (const table of tables) {
    const response = await fetch(`${url}/rest/v1/${table}?select=id&limit=0`, { headers, signal: AbortSignal.timeout(20_000) });
    const body = await response.json();
    probes.push({ role, table, method: 'GET', status: response.status, zeroRowArray: Array.isArray(body) && body.length === 0, errorCode: body?.code || null });
  }
  const response = await fetch(`${url}/rest/v1/`, { headers: { ...headers, Accept: 'application/openapi+json' }, signal: AbortSignal.timeout(20_000) });
  const body = await response.json();
  probes.push({ role, method: 'GET', resource: 'openapi', status: response.status,
    importsTableAdvertised: Boolean(body.paths?.['/builder_product_imports']),
    commitRpcAdvertised: Boolean(body.paths?.['/rpc/commit_builder_product_import']), errorCode: body?.code || null });
}
const migration = 'supabase/migrations/20261004000100_builder_product_csv_import.sql';
const report = { capturedAt: new Date().toISOString(), projectRef: expectedProject, productionReadOnly: true,
  customerRowsRequested: 0, migrationSha256: crypto.createHash('sha256').update(fs.readFileSync(migration)).digest('hex'), probes,
  limitations: ['PostgREST metadata visibility does not prove PostgreSQL grants, object definitions or migration history.', 'No SQL connection is configured; execute supabase/review/product_library_release_readonly.sql through an approved read-only session.', 'No schema cache reload, RPC call, migration or production write was executed.'] };
const output = 'artifacts/test-artifacts/product-selection-integrity/production-schema-readonly.json';
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));