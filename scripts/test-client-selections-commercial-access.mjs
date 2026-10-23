import assert from 'node:assert/strict';
import fs from 'node:fs';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const read = name => fs.readFileSync(name, 'utf8');
const workspaceSource = read('lib/withWorkspace.js')
  .replace(/import .*supabaseAdmin.*;/, 'const supabaseAdmin = globalThis.__selectionSecurityDb;')
  .replace(/import .*getWorkspaceDemoState.*;/, 'const getWorkspaceDemoState = async () => ({});');
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, setHeader() {} });
let role = 'client';
let membershipWorkspace = 'workspace-a';
let handlerCalls = 0;
globalThis.__selectionSecurityDb = {
  auth: { getUser: async token => token === 'valid' ? { data: { user: { id: 'user-a', email: 'client@example.test' } } } : { error: new Error('invalid') } },
  from(table) {
    assert.equal(table, 'workspace_members', 'only membership may be read before role authorization');
    const filters = {};
    return { select() { return this; }, eq(key, value) { filters[key] = value; return this; }, async maybeSingle() {
      return { data: filters.workspace_id === membershipWorkspace ? { role, status: 'active' } : null };
    } };
  },
};
const { withWorkspace, INTERNAL_COMMERCIAL_ROLES } = await import(moduleUrl(workspaceSource));
const internal = withWorkspace(async (req, res) => { handlerCalls += 1; return res.json({ allowed: true, workspaceId: req.workspaceId }); }, { roles: INTERNAL_COMMERCIAL_ROLES });
for (const denied of ['client', 'customer', 'guest', 'unknown', 'member']) {
  role = denied;
  for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
    const res = response();
    await internal({ method, headers: { authorization: 'Bearer valid' }, query: { workspace_id: 'workspace-a' } }, res);
    assert.equal(res.code, 403, `${denied} cannot use internal commercial ${method}`);
    assert.equal(handlerCalls, 0, 'commercial handler and its service-role queries never execute');
  }
}
for (const allowed of INTERNAL_COMMERCIAL_ROLES) {
  role = allowed;
  const res = response();
  await internal({ headers: { authorization: 'Bearer valid' }, query: { workspace_id: 'workspace-a' } }, res);
  assert.equal(res.code, 200, `${allowed} retains authorized staff access`);
}
role = 'estimator';
const foreign = response();
await internal({ headers: { authorization: 'Bearer valid' }, query: { workspace_id: 'workspace-b' } }, foreign);
assert.equal(foreign.code, 403, 'staff cannot select another workspace without membership');
const anonymous = response();
await internal({ headers: {}, query: { workspace_id: 'workspace-a' } }, anonymous);
assert.equal(anonymous.code, 401);

const routes = [
  'pages/api/project-estimate/instances/index.js',
  'pages/api/project-estimate/instances/[id].js',
  'pages/api/project-estimate/templates/index.js',
  'pages/api/project-estimate/templates/[id].js',
  'pages/api/project-estimate/templates/[id]/versions.js',
  'pages/api/builders/sync-commercial-snapshot.js',
  'pages/api/builders/convert-to-live-project.js',
  'pages/api/builders/selection-foundation.js',
  'pages/api/builders/final-inclusions-schedule/generate.js',
  'pages/api/builders/publish-client-selections.js',
];
for (const name of routes) assert.match(read(name), /export default withWorkspace\(\w+, \{ roles: INTERNAL_COMMERCIAL_ROLES \}\)/, `${name} enforces the tested server policy`);

const portalSource = read('client-portal/serverShared.js')
  .replace(/import \{ supabaseAdmin \} from .*;/, 'const supabaseAdmin = globalThis.__portalSecurityDb;');
let clientActive = true;
let portalEnabled = true;
globalThis.__portalSecurityDb = {
  from(table) {
    const filters = {};
    const data = () => {
      if (table === 'workspace_members') return { data: { role: 'client', status: 'active' } };
      if (table === 'client_portal_settings') return { data: { portal_enabled: portalEnabled } };
      assert.equal(table, 'client_portal_clients');
      return { data: filters.project_id === 'job-a' && clientActive ? [{ id: 'assignment-a', user_id: 'user-a', client_email: 'client@example.test', status: 'active' }] : [] };
    };
    return { select() { return this; }, eq(key, value) { filters[key] = value; return this; }, neq() { return this; }, order() { return Promise.resolve(data()); }, maybeSingle() { return Promise.resolve(data()); } };
  },
};
const { authorizePortalRequest } = await import(moduleUrl(portalSource));
const user = { id: 'user-a', email: 'client@example.test' };
const project = { id: 'job-a', workspace_id: 'workspace-a' };
assert.equal((await authorizePortalRequest({ project, user })).access, 'client', 'assigned active client retains portal selection access');
assert.equal((await authorizePortalRequest({ project, user, requireBuilder: true })).allowed, false, 'portal client cannot impersonate a builder');
assert.equal((await authorizePortalRequest({ project, user, requestedMode: 'preview' })).access, 'client', 'preview parameter does not elevate client access');
assert.equal((await authorizePortalRequest({ project: { ...project, id: 'job-b' }, user })).allowed, false, 'client assignment cannot access another job');
assert.equal((await authorizePortalRequest({ project, user, requestedWorkspaceId: 'workspace-b' })).allowed, false, 'foreign workspace is denied');
clientActive = false;
assert.equal((await authorizePortalRequest({ project, user })).allowed, false, 'revoked assignment is denied');
clientActive = true;
portalEnabled = false;
assert.equal((await authorizePortalRequest({ project, user })).allowed, false, 'unpublished portal is denied');

portalEnabled = true;
const portalReads = [];
const secret = 'INTERNAL-COMMERCIAL-SECRET';
const publishedSelection = {
  id: 'selection-a', selected_product_name: 'Selected Basin', selection_status: 'approved', client_visible: true,
  purchase_price: secret, supplier_cost: secret, quotation: { margin: secret }, workbook_snapshot: { internal: secret },
  metadata: { quantity: 1, clientNotes: 'White finish', internalReconciliation: secret, productLibrarySnapshot: { purchasePrice: secret } },
};
const projectDb = {
  from(table) {
    const filters = {};
    const result = () => {
      if (['client_portal_clients', 'client_portal_settings'].includes(table)) return { data: [] };
      portalReads.push({ table, filters });
      assert.ok(!['builder_estimate_snapshots', 'builder_boq_sections', 'builder_boq_items', 'builder_procurement_items'].includes(table), 'client response must not query raw commercial tables');
      if (table === 'builder_client_selections') return { data: [publishedSelection, { ...publishedSelection, id: 'hidden', client_visible: false }, { ...publishedSelection, id: 'internal-only', metadata: { internalOnly: true } }] };
      if (table === 'builder_variations') return { data: [
        { id: 'variation-a', title: 'Approved client change', total: 110, client_visible: true, status: 'submitted', purchase_price: secret, metadata: { margin: secret } },
        { id: 'variation-internal', title: secret, total: 999, client_visible: true, metadata: { internalOnly: true } },
      ] };
      if (table === 'builder_variation_items') return { data: [
        { id: 'item-a', variation_id: 'variation-a', description: 'Client finish change', purchase_price: secret },
        { id: 'item-internal', variation_id: 'variation-a', description: secret, metadata: { internalOnly: true } },
      ] };
      return { data: [] };
    };
    const query = {
      select() { return this; }, update() { return this; }, eq(key, value) { filters[key] = value; return this; },
      neq() { return this; }, order() { return this; }, then(resolve, reject) { return Promise.resolve().then(result).then(resolve, reject); },
    };
    return query;
  },
};
globalThis.__portalProjectDependencies = {
  supabaseAdmin: projectDb,
  authorizePortalRequest,
  getAuthenticatedUser: async () => ({ user }),
  getProject: async id => ({ project: { ...project, id, project_name: 'Client Job', currency: 'AUD', source_metadata: { workbook_snapshot: secret, margin: secret } } }),
  getPortalClients: async () => ({ clients: [{ id: 'assignment-a', client_name: 'Client' }] }),
  getPortalSettings: async () => ({ settings: { portal_enabled: true, enabled_sections: { selections: true }, visibility: {} } }),
  recordPortalAudit: async () => {},
  formatDate: value => value || '',
  toMoney: value => value == null ? '' : String(value),
};
const projectSource = read('client-portal/serverProject.js')
  .replace(/import \{[\s\S]*?\} from "\.\/clientPortalData";/, 'const DOCUMENT_CATEGORY_LABELS = {}; const SELECTION_STATUS_LABELS = {}; const VARIATION_STATUS_LABELS = {};')
  .replace(/import \{([\s\S]*?)\} from "\.\/serverShared";/, 'const {$1} = globalThis.__portalProjectDependencies;');
const { default: portalProject } = await import(moduleUrl(projectSource));
const clientResponse = response();
await portalProject({ method: 'GET', query: { projectId: 'job-a' } }, clientResponse);
assert.equal(clientResponse.code, 200);
assert.equal(clientResponse.body.access, 'client');
assert.deepEqual(clientResponse.body.selections.map(selection => selection.id), ['selection-a'], 'published selections remain accessible; hidden/internal-only records stay private');
assert.equal(clientResponse.body.selections[0].selectedProduct, 'Selected Basin');
assert.deepEqual(clientResponse.body.variations.map(variation => variation.id), ['variation-a'], 'only published non-internal variations are returned');
assert.equal(clientResponse.body.variations[0].priceIncludingGst, '110', 'authorized client variation amount stays available');
assert.deepEqual(clientResponse.body.variations[0].supportingItems.map(item => item.id), ['item-a'], 'internal variation items are not returned');
assert.equal(JSON.stringify(clientResponse.body).includes(secret), false, 'raw snapshots, costs, margins, metadata and reconciliation never serialize into the portal response');
for (const { table, filters } of portalReads) {
  assert.equal(filters.project_id, 'job-a', `${table} is scoped to the assigned job`);
  if (table !== 'gantt_tasks') assert.equal(filters.workspace_id, 'workspace-a', `${table} is workspace-scoped`);
}
portalReads.length = 0;
const otherJobResponse = response();
await portalProject({ method: 'GET', query: { projectId: 'job-b' } }, otherJobResponse);
assert.equal(otherJobResponse.code, 403);
assert.equal(portalReads.length, 0, 'unassigned job is denied before project data queries');

delete globalThis.__selectionSecurityDb;
delete globalThis.__portalSecurityDb;
delete globalThis.__portalProjectDependencies;
console.log('PASS commercial API denial, staff access, assigned client selections, raw response filtering, cross-job/workspace isolation, preview non-escalation and revocation.');