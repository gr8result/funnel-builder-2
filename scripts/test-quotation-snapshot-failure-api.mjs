// Exercise the actual route handler with injected I/O failures; no server or credentials.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync('pages/api/builders/sync-commercial-snapshot.js', 'utf8');
const handlerSource = source.slice(source.indexOf('async function handler('), source.indexOf('export default withWorkspace'));
const workspaceId = 'test-workspace';
async function run({ fail, promotion = true, reused = false } = {}) {
  const calls = [];
  const counts = { boq_sections: 1, boq_items: 1, procurement_items: 1 };
  const deps = {
    plainObject: value => value && typeof value === 'object' ? value : {},
    firstText: (...values) => values.find(Boolean) || '', uuidOrNull: value => value,
    quotationIssueCheck: () => ({ ok: true }), reconcileProductSelections: () => ({ entries: [] }), cabinetryQuotationBriefs: () => [],
    createOrUpdateCommercialProject: async () => ({ id: 'project' }),
    createEstimateSnapshot: async () => ({ snapshot: { id: 'candidate', workbook_metadata: {} }, reused }),
    countSnapshotRows: async () => counts, expectedSnapshotCounts: () => counts,
    buildBoqSectionRows: () => [{}], buildBoqItemRows: () => [{}], buildProcurementRows: () => [{}],
    insertBoqSections: async () => { calls.push('sections'); if (fail === 'sections') throw Error('injected sections failure'); return new Map(); },
    insertRows: async table => { calls.push(table); if (fail === table) throw Error(`injected ${table} failure`); return [{}]; },
    TABLES: { items: 'items', procurement: 'procurement' },
    supabaseAdmin: { rpc: async (name, args) => { calls.push({ name, args }); return { data: promotion, error: fail === 'promotion' ? { message: 'injected RPC failure' } : null }; } },
    console: { error() {} },
  };
  const handler = new Function(...Object.keys(deps), `${handlerSource}; return handler;`)(...Object.values(deps));
  const response = { status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method: 'POST', workspaceId, user: { id: 'user' }, body: { workbook: { jobId: 'job', workspaceId }, calculated: { quotation: { section: {} } } } }, response);
  return { response, calls };
}
for (const fail of ['sections', 'items', 'procurement']) {
  const { response, calls } = await run({ fail });
  assert.equal(response.statusCode, 500);
  assert(!calls.some(call => typeof call === 'object'), 'partial child inserts must never trigger promotion');
}
console.log('PASS section, BOQ and procurement insert failures never promote a partial snapshot');
const complete = await run();
assert.equal(complete.response.statusCode, 200);
assert.deepEqual(complete.calls.slice(0, 3), ['sections', 'items', 'procurement']);
assert.deepEqual(complete.calls[3], { name: 'builder_promote_quotation_snapshot', args: {
  p_workspace_id: workspaceId, p_project_id: 'project', p_snapshot_id: 'candidate', p_sections: 1, p_items: 1, p_procurement: 1,
} });
assert.equal((await run({ fail: 'promotion' })).response.statusCode, 500);
const stale = await run({ promotion: false });
assert.equal(stale.response.statusCode, 409);
assert.equal(stale.response.body.code, 'QUOTATION_SUPERSEDED');
const retry = await run({ reused: true });
assert.equal(retry.response.statusCode, 200);
assert.equal(retry.response.body.already_synced, true);
assert.deepEqual(retry.calls, []);
console.log('PASS completed issuance, RPC failure, stale completion conflict and idempotent retry responses');
