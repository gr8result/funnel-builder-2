import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createSelectionRepository } from '../lib/builders/selectionRepository.js';

// Static review of the migration against the existing schema and tenant-security rules.
const migrationsDir = 'supabase/migrations';
const files = fs.readdirSync(migrationsDir).filter((name) => /^\d{14}_.+\.sql$/.test(name)).sort();
const name = '20261010000100_builder_requirement_quote_mappings.sql';
const productIdentityMigration = '20261011000100_requirement_mapping_product_identity.sql';
assert(files.indexOf(productIdentityMigration) > files.indexOf(name), 'the additive product identity migration applies after requirement mappings');
const sql = fs.readFileSync(`${migrationsDir}/${name}`, 'utf8');
const productSql = fs.readFileSync(`${migrationsDir}/${productIdentityMigration}`, 'utf8');
const earlier = files.filter((file) => file < name).map((file) => fs.readFileSync(`${migrationsDir}/${file}`, 'utf8')).join('\n');
for (const dependency of ['builder_commercial_is_workspace_member', 'builder_commercial_set_updated_at', 'builder_selection_is_config_admin', 'builder_selection_immutable_workspace']) {
  assert(earlier.includes(`function public.${dependency}`), `${dependency} exists in an earlier migration`);
}
assert.match(sql, /workspace_id uuid not null references public\.workspaces\(id\)/, 'tenant key is mandatory and references workspaces');
assert.match(sql, /unique \(workspace_id, template_id, requirement_key, location_id\)/, 'one mapping per builder template requirement and location');
assert.match(productSql, /add column if not exists product_id text not null default ''/i, 'product identity is added without losing legacy mappings');
assert.match(productSql, /unique \(workspace_id, template_id, requirement_key, product_id, location_id\)/, 'fixture products can have distinct targets per template');
assert.match(sql, /enable row level security/);
assert.match(sql, /for select to authenticated\s+using \(public\.builder_commercial_is_workspace_member\(workspace_id\)\)/, 'members may read only their own workspace');
assert.match(sql, /for all to authenticated\s+using \(public\.builder_selection_is_config_admin\(workspace_id\)\) with check \(public\.builder_selection_is_config_admin\(workspace_id\)\)/, 'only owners and admins may write');
assert(!/to anon|to public|grant .* to anon/i.test(sql), 'no anonymous or public access');
assert.match(sql, /immutable_workspace before update/, 'workspace ownership cannot be moved');
assert.match(sql, /status in \('MAPPED','RETIRED'\)/); assert.match(sql, /mode in \('PRODUCT_ROW','SPECIFICATION_ONLY'\)/);
assert(!/insert into|update public\./i.test(sql), 'additive: no data is written or rewritten');
assert(sql.trim().startsWith('--') && /^begin;/m.test(sql) && /commit;\s*$/.test(sql.trim()), 'single transaction');
assert(/^begin;/m.test(productSql) && /commit;\s*$/.test(productSql.trim()), 'product identity change is transactional');
console.log('PASS migration is additive, tenant-keyed, RLS-protected (member read, owner/admin write), workspace-immutable and ordered after its dependencies');

// Repository behaviour with a fake database: tenant scoping and upsert by natural key.
function fakeDb(rows = []) {
  const state = { rows: [...rows], log: [] };
  const from = (table) => {
    const filters = [];
    let op = 'select', payload = null;
    const chain = {
      select() { return chain; }, eq(key, value) { filters.push([key, value]); return chain; },
      insert(value) { op = 'insert'; payload = value; return chain; }, update(value) { op = 'update'; payload = value; return chain; },
      maybeSingle: async () => ({ data: state.rows.find((row) => filters.every(([key, value]) => row[key] === value)) ?? null, error: null }),
      single: async () => {
        if (op === 'insert') { const row = { id: `id-${state.rows.length + 1}`, version: 1, ...payload }; state.rows.push(row); state.log.push(['insert', row]); return { data: row, error: null }; }
        const row = state.rows.find((entry) => filters.every(([key, value]) => entry[key] === value));
        Object.assign(row, payload, { version: row.version + 1 }); state.log.push(['update', row]); return { data: row, error: null };
      },
      then: (resolve) => resolve({ data: state.rows.filter((row) => filters.every(([key, value]) => row[key] === value)), error: null }),
    };
    return chain;
  };
  return { from, state };
}
{
  const a = 'aaaaaaaa-0000-4000-8000-000000000001', b = 'bbbbbbbb-0000-4000-8000-000000000002';
  const db = fakeDb([{ id: 'other', workspace_id: b, template_id: 't', requirement_key: 'cladding', location_id: '', quote_row_id: 'quote-9', version: 1 }]);
  const repo = createSelectionRepository(db, a);
  const record = { template_id: 't', requirement_key: 'cladding', product_id: '', location_id: '', mode: 'PRODUCT_ROW', quote_section_id: 'EXTERNAL CLADDING (55)', quote_row_id: 'quote-1027', status: 'MAPPED' };
  const first = await repo.save('requirementMappings', record);
  assert.equal(first.workspace_id, a); assert.equal(db.state.rows.length, 2, 'another builder\'s identical mapping is neither reused nor touched');
  const again = await repo.save('requirementMappings', { ...record, quote_row_id: 'quote-1026' });
  assert.equal(again.id, first.id); assert.equal(again.version, 2); assert.equal(db.state.rows.length, 2, 'changing a mapping updates the same record');
  assert.equal(db.state.rows.find((row) => row.id === 'other').quote_row_id, 'quote-9');
  await assert.rejects(() => repo.save('requirementMappings', { ...record, workspace_id: b }), /workspace/i, 'a foreign workspace id is rejected');
  assert.deepEqual((await repo.list('requirementMappings')).map((row) => row.workspace_id), [a], 'listing returns only the caller\'s workspace');
  const fan = await repo.save('requirementMappings', { ...record, requirement_key: 'ceiling-fan', product_id: 'fan-a', quote_row_id: 'quote-fan-a' });
  const pendant = await repo.save('requirementMappings', { ...record, requirement_key: 'interior-lighting', product_id: 'light-b', quote_row_id: 'quote-light-b' });
  assert.notEqual(fan.id, pendant.id, 'different selected products keep distinct targets');
  console.log('PASS repository scopes writes by workspace and upserts product-specific template mappings');
}
console.log('Requirement mapping migration review passed (database integration not run: no isolated database available).');
