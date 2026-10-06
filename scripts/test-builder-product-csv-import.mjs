import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { parseBuilderCsv, previewBuilderCsv } from '../lib/product-library/builderCsvImport.js';
import { mapDbProductToEntity } from '../lib/product-library/productLibraryDbMapper.js';
import { createJobInclusionSnapshot } from '../lib/builders/selectionRegistry.js';
import * as importer from '../lib/product-library/builderCsvImport.js';
import * as registry from '../lib/builders/selectionRegistry.js';
import { createRequire } from 'node:module';
const db = new PGlite();
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const U = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let checks = 0;
async function check(name, fn) { await fn(); console.log('PASS', name); checks++; }
const csv = (price = 120) => `TenantId,Supplier,Item Code,Product,Category,Price,Trade Price,Unit,Active\n${B},Acme,TAP-1,Kitchen mixer,Kitchen Tapware,${price},80,each,yes`;
async function preview(workspaceId, text = csv(), slotMappings = { 'Kitchen Tapware': 'kitchen_mixer' }) {
  const records = {};
  for (const [key, table] of Object.entries({ products: 'builder_products', suppliers: 'builder_product_suppliers', aliases: 'builder_selection_aliases' })) {
    // PostgreSQL JSON output matches the representation returned by PostgREST.
    records[key] = (await db.query(`select to_jsonb(t) as record from ${table} t where workspace_id=$1`, [workspaceId])).rows.map(row => row.record);
  }
  const plan = previewBuilderCsv({ workspaceId, csv: text, slotMappings, ...records });
  const baseline = Object.fromEntries(Object.entries(records).map(([key, rows]) => [key, Object.fromEntries(rows.map(row => [row.id, row]))]));
  const batch = (await db.query('insert into builder_product_imports(workspace_id,created_by,plan,baseline) values($1,$2,$3,$4) returning id', [workspaceId, U, JSON.stringify(plan), JSON.stringify(baseline)])).rows[0].id;
  return { ...plan, batch };
}
async function commit(workspaceId, plan, rows = plan.rows.filter(row => ['NEW', 'UPDATE', 'UNCHANGED'].includes(row.action)).map(row => row.row)) {
  return (await db.query('select commit_builder_product_import($1,$2,$3,$4) as report', [workspaceId, U, plan.batch, rows])).rows[0].report;
}
async function products(workspaceId) { return (await db.query('select * from builder_products where workspace_id=$1 order by id', [workspaceId])).rows; }
try {
  await db.exec(`create role authenticated; create role service_role; create schema auth;
    create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    create table workspaces(id uuid primary key,name text); create table workspace_members(workspace_id uuid,user_id uuid,role text,status text);
    insert into auth.users values('${U}'); insert into workspaces values('${A}','Builder A'),('${B}','Builder B');
    insert into workspace_members values('${A}','${U}','owner','active'),('${B}','${U}','admin','active');`);
  for (const name of ['20260813091500_estimate_builder_commercial_backbone_stage1.sql', '20260813091600_builder_inclusion_templates.sql', '20260813091800_builder_selection_books.sql', '20260813092100_builder_product_library.sql', '20260813092400_seed_gr8_standard_specifications.sql', '20260813093000_selection_budget_manager.sql', '20261003000100_builder_selection_tenant_foundation.sql', '20261004000100_builder_product_csv_import.sql']) {
    await db.exec((await fs.readFile(`supabase/migrations/${name}`, 'utf8')).replace(/create extension if not exists pgcrypto;/gi, ''));
  }
  await check('quoted CSV, BOM, multiline cells, header aliases and ignored tenant column', () => {
    const parsed = parseBuilderCsv('\uFEFFSupplier,Item Code,Product,Trade Price\nAcme,1,"Mixer,\nchrome",42');
    assert.equal(parsed.mapping[1], 'supplierSku'); assert.equal(parsed.mapping[3], 'cost'); assert.equal(parsed.data[0][2], 'Mixer,\nchrome');
    assert.equal(parseBuilderCsv(csv()).mapping[0], '');
    assert.throws(() => parseBuilderCsv('Name,Name\na,b'), /unique/);
  });
  await check('upload preview does not write products and unknown categories remain UNMAPPED', async () => {
    assert.equal((await preview(A, csv(), {})).rows[0].action, 'UNMAPPED');
    assert.equal((await products(A)).length, 0);
  });
  await check('identical supplier/SKU creates isolated products for two tenants', async () => {
    assert.equal((await commit(A, await preview(A))).NEW, 1);
    assert.equal((await commit(B, await preview(B))).NEW, 1);
    assert.equal((await products(A))[0].workspace_id, A);
    assert.equal((await products(B))[0].workspace_id, B);
    assert.notEqual((await products(A))[0].id, (await products(B))[0].id);
  });
  const originalB = await products(B);
  const schedule = (await db.query('insert into builder_inclusion_schedules(workspace_id,name,display_name) values($1,$2,$2) returning *', [A, 'Contract inclusions'])).rows[0];
  const item = (await db.query(`insert into builder_inclusion_schedule_items(workspace_id,inclusion_schedule_id,selection_slot_id,default_product_id,allowance) values($1,$2,'kitchen_mixer',$3,'120'::jsonb) returning *`, [A, schedule.id, (await products(A))[0].id])).rows[0];
  const snapshot = createJobInclusionSnapshot(A, schedule, [item]);
  const project = (await db.query("insert into builder_commercial_projects(workspace_id,project_name,job_inclusion_schedule_id,job_inclusion_snapshot,contract_total) values($1,'Contracted job',$2,$3,120) returning id", [A, schedule.id, JSON.stringify(snapshot)])).rows[0];
  await db.query("insert into builder_client_selections(workspace_id,project_id,title,baseline_product_id,baseline_unit_price,active_unit_price) values($1,$2,'Mixer',$3,120,120)", [A, project.id, item.default_product_id]);
  const jobBefore = (await db.query('select * from builder_commercial_projects')).rows;
  const selectionBefore = (await db.query('select * from builder_client_selections')).rows;
  await check('re-import updates only correct tenant and saved alias resolves automatically', async () => {
    const plan = await preview(A, csv(150), {});
    assert.equal(plan.rows[0].action, 'UPDATE'); assert.equal(plan.rows[0].slot, 'kitchen_mixer');
    assert.equal((await commit(A, plan)).UPDATE, 1);
    assert.equal(Number((await products(A))[0].upgrade_cost), 150);
    assert.deepEqual(await products(B), originalB);
    assert.equal((await commit(A, plan)).UPDATE, 1); // Idempotent retry, no duplicate writes.
  });
  await check('existing job inclusion snapshots and contracted prices unchanged', async () => {
    assert.deepEqual((await db.query('select * from builder_commercial_projects')).rows, jobBefore);
    assert.deepEqual((await db.query('select * from builder_client_selections')).rows, selectionBefore);
    assert.equal(Number((await db.query('select allowance from builder_inclusion_schedule_items where id=$1', [item.id])).rows[0].allowance), 120);
  });
  await check('Product Library reload reads persisted import and repeated import is UNCHANGED', async () => {
    const entity = mapDbProductToEntity((await products(A))[0]);
    assert.equal(entity.clientPrice, 150); assert.equal(entity.supplierSku, 'TAP-1'); assert.equal(entity.category, 'Kitchen Tapware');
    assert.equal((await preview(A, csv(150), {})).rows[0].action, 'UNCHANGED');
  });
  await check('cross-tenant preview IDs and non-admin commit rejected', async () => {
    const plan = await preview(A, csv(180));
    await assert.rejects(commit(B, plan), /Preview not found/);
    await db.query("update workspace_members set role='member' where workspace_id=$1", [A]);
    await assert.rejects(commit(A, plan), /administrator/);
    await db.query("update workspace_members set role='owner' where workspace_id=$1", [A]);
  });
  await check('stale previews reject concurrent edits without overwriting prices', async () => {
    const plan = await preview(A, csv(190));
    await db.query("update builder_products set description='Concurrent edit' where workspace_id=$1", [A]);
    await assert.rejects(commit(A, plan), /changed; preview again/);
    assert.equal(Number((await products(A))[0].upgrade_cost), 150);
  });
  await check('invalid, duplicate/conflicting and unmapped rows can be excluded', async () => {
    const text = 'Supplier,SKU,Product,Selection Slot,Price\nAcme,NEW,Good,kitchen_mixer,25\nAcme,BAD,Bad,kitchen_mixer,no\nAcme,DUP,First,kitchen_mixer,10\nAcme,DUP,Second,kitchen_mixer,20\nAcme,UNKNOWN,Unknown,Uncertain,20';
    const plan = await preview(A, text, {});
    assert.deepEqual(plan.rows.map(row => row.action), ['NEW', 'INVALID', 'CONFLICT', 'CONFLICT', 'UNMAPPED']);
    await assert.rejects(commit(A, plan, [2, 3]), /Only valid/);
    const report = await commit(A, plan);
    assert.equal(report.NEW, 1); assert.equal(report.CONFLICT, 2); assert.equal(report.INVALID, 1); assert.equal(report.UNMAPPED, 1);
  });
  await check('ambiguous existing matches never merge; missing SKU requires explicit stable key', async () => {
    const current = (await products(A)).find(row => row.sku === 'TAP-1');
    await db.query('insert into builder_products(workspace_id,product_name,sku,metadata) values($1,$2,$3,$4)', [A, current.product_name, current.sku, JSON.stringify(current.metadata)]);
    assert.equal((await preview(A)).rows[0].action, 'CONFLICT');
    assert.equal((await preview(A, 'Product,Selection Slot\nDescription only,kitchen_mixer', {})).rows[0].action, 'INVALID');
    const text = 'Import Key,Product,Selection Slot,Price\nmy-stable-123,Custom product,kitchen_mixer,10';
    await commit(A, await preview(A, text, {}));
    assert.equal((await preview(A, text, {})).rows[0].action, 'UNCHANGED');
  });
  await check('authenticated clients cannot forge staged plans or call privileged commit', async () => {
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from builder_product_imports'), /permission denied/);
    await assert.rejects(db.query('select commit_builder_product_import($1,$2,$3,$4)', [A, U, A, [2]]), /permission denied/);
    await db.exec('reset role');
  });
  await check('import UI uploads, maps headers and slots, confirms, commits and displays persisted products', async () => {
    const require = createRequire(import.meta.url);
    const React = require('react');
    const { JSDOM } = require('jsdom');
    const ts = require('typescript');
    const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
    globalThis.window = dom.window; globalThis.document = dom.window.document;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const { createRoot } = require('react-dom/client');
    const source = await fs.readFile('components/product-library/BuilderCsvImport.jsx', 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', compiled)(name => {
      if (name.includes('supabase-client')) return { supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) } } };
      if (name.includes('builderCsvImport')) return importer;
      if (name.includes('selectionRegistry')) return registry;
      if (name.includes('productLibraryDbMapper')) return { mapDbProductToEntity };
      return require(name);
    }, module, module.exports);
    const Component = module.exports.default;
    const originalFetch = globalThis.fetch;
    const requests = [];
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(options.body); requests.push(body);
      assert.equal(body.workspace_id, A);
      if (body.action === 'preview') {
        const plan = await preview(A, body.csv, body.slotMappings);
        // The UI chose the nonstandard price header explicitly.
        const records = {};
        for (const [key, table] of Object.entries({ products: 'builder_products', suppliers: 'builder_product_suppliers', aliases: 'builder_selection_aliases' })) records[key] = (await db.query(`select to_jsonb(t) record from ${table} t where workspace_id=$1`, [A])).rows.map(row => row.record);
        const mapped = previewBuilderCsv({ workspaceId: A, csv: body.csv, mapping: body.mapping, slotMappings: body.slotMappings, ...records });
        await db.query('update builder_product_imports set plan=$1 where id=$2', [JSON.stringify(mapped), plan.batch]);
        return { ok: true, json: async () => ({ ...mapped, batchId: plan.batch }) };
      }
      assert.equal(body.confirmed, true);
      return { ok: true, json: async () => ({ report: await commit(A, { batch: body.batchId }, body.rows) }) };
    };
    const root = createRoot(document.getElementById('root'));
    const render = async () => root.render(React.createElement(Component, { workspaceId: A, products: await products(A), onImported: render }));
    const click = async text => { const button = [...document.querySelectorAll('button')].find(node => node.textContent === text); assert(button, text); await React.act(async () => button.click()); };
    try {
      await React.act(render);
      await click('Import builder product CSV');
      const upload = document.querySelector('input[type=file]');
      Object.defineProperty(upload, 'files', { value: [{ size: 120, text: async () => 'Supplier,SKU,Product,Category,Builder Price\nAcme,UI-1,UI mixer,Custom Kitchen,77' }] });
      await React.act(async () => upload.dispatchEvent(new dom.window.Event('change', { bubbles: true })));
      assert.equal(requests.length, 0);
      const price = document.querySelector('[aria-label="Map Builder Price"]');
      await React.act(async () => { price.value = 'price'; price.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
      await click('Validate and preview');
      assert(document.body.textContent.includes('UNMAPPED'));
      const select = document.querySelector('[aria-label="Selection Slot for Custom Kitchen"]');
      await React.act(async () => { select.value = 'kitchen_mixer'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
      assert([...document.querySelectorAll('button')].find(node => node.textContent === 'Commit import').disabled);
      await click('Revalidate mappings');
      const confirm = [...document.querySelectorAll('input[type=checkbox]')].find(node => node.parentElement.textContent.includes('I confirm'));
      await React.act(async () => confirm.click());
      await click('Commit import');
      assert(document.body.textContent.includes('Import committed.'));
      assert(document.body.textContent.includes('UI mixer'));
      assert.equal(Number((await products(A)).find(row => row.sku === 'UI-1').upgrade_cost), 77);
      assert.equal(requests.filter(body => body.action === 'commit').length, 1);
    } finally { await React.act(async () => root.unmount()); dom.window.close(); globalThis.fetch = originalFetch; delete globalThis.window; delete globalThis.document; delete globalThis.IS_REACT_ACT_ENVIRONMENT; }
  });
  console.log(`Builder CSV import: ${checks} checks passed.`);
} finally { await db.close(); }
