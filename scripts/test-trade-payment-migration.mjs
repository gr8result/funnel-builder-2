// Applies 20261011090000_trade_payment_schedules.sql to an isolated in-memory Postgres (PGlite) and attacks it as different users.
// Nothing here connects to Supabase. The surrounding schema (workspaces, members, suppliers, projects, purchase orders, auth.uid)
// is a minimal stand-in; the four helper functions the migration depends on are taken verbatim from the earlier migrations.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const dir = 'supabase/migrations';
const migration = fs.readFileSync(`${dir}/20261011090000_trade_payment_schedules.sql`, 'utf8');
const functionSource = (file, name) => {
  const sql = fs.readFileSync(`${dir}/${file}`, 'utf8');
  const start = sql.search(new RegExp(`create (or replace )?function public\\.${name}\\(`));
  assert(start >= 0, `${name} exists in ${file}`);
  const open = sql.indexOf('$$', start), close = sql.indexOf('$$', open + 2);
  return `${sql.slice(start, close + 2)};`;
};

const db = new PGlite();
await db.exec(`
  create role authenticated nologin; create role anon nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  create table public.workspaces (id uuid primary key, name text);
  create table public.workspace_members (workspace_id uuid references public.workspaces(id) on delete cascade, user_id uuid, role text, status text default 'active');
  create table public.builder_commercial_projects (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, unique (id, workspace_id));
  create table public.builder_suppliers (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, unique (id, workspace_id));
  create table public.builder_purchase_orders (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, unique (id, workspace_id));
`);
await db.exec(functionSource('20260813091500_estimate_builder_commercial_backbone_stage1.sql', 'builder_commercial_set_updated_at'));
await db.exec(functionSource('20260813091500_estimate_builder_commercial_backbone_stage1.sql', 'builder_commercial_is_workspace_member'));
await db.exec(functionSource('20261003000100_builder_selection_tenant_foundation.sql', 'builder_selection_immutable_workspace'));
await db.exec(functionSource('20261003000100_builder_selection_tenant_foundation.sql', 'builder_selection_is_config_admin'));

await db.exec(migration);
await db.exec(migration); // re-runnable
console.log('PASS migration applies, and applies again, on a clean isolated database');

const A = 'aaaaaaaa-0000-4000-8000-000000000001', B = 'bbbbbbbb-0000-4000-8000-000000000002';
const U = { ownerA: 'a0000000-0000-4000-8000-000000000001', staffA: 'a0000000-0000-4000-8000-000000000002', designerA: 'a0000000-0000-4000-8000-000000000003', lapsedA: 'a0000000-0000-4000-8000-000000000004', ownerB: 'b0000000-0000-4000-8000-000000000001', stranger: 'c0000000-0000-4000-8000-000000000001' };
const ids = { poA: 'a1000000-0000-4000-8000-000000000001', poA2: 'a1000000-0000-4000-8000-000000000002', poB: 'b1000000-0000-4000-8000-000000000001', supA: 'a2000000-0000-4000-8000-000000000001', supB: 'b2000000-0000-4000-8000-000000000001', projA: 'a3000000-0000-4000-8000-000000000001', projB: 'b3000000-0000-4000-8000-000000000001' };
await db.exec(`
  insert into auth.users select unnest(array['${Object.values(U).join("','")}']::uuid[]);
  insert into public.workspaces values ('${A}', 'Builder A'), ('${B}', 'Builder B');
  insert into public.workspace_members values ('${A}', '${U.ownerA}', 'owner', 'active'), ('${A}', '${U.staffA}', 'builder_staff', 'active'),
    ('${A}', '${U.designerA}', 'interior_designer', 'active'), ('${A}', '${U.lapsedA}', 'owner', 'inactive'), ('${B}', '${U.ownerB}', 'owner', 'active');
  insert into public.builder_purchase_orders values ('${ids.poA}', '${A}'), ('${ids.poA2}', '${A}'), ('${ids.poB}', '${B}');
  insert into public.builder_suppliers values ('${ids.supA}', '${A}'), ('${ids.supB}', '${B}');
  insert into public.builder_commercial_projects values ('${ids.projA}', '${A}'), ('${ids.projB}', '${B}');
`);

// Run SQL the way PostgREST does for a signed-in user: the authenticated role with the user's id in the JWT claim.
async function as(user, sql, params = []) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user || '']);
  await db.exec(`set role ${user === 'anon' ? 'anon' : 'authenticated'}`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claim.sub', '', false)`); }
}
const denied = async (promise, pattern, message) => { await assert.rejects(promise, pattern, message); };
const one = async (user, sql, params) => (await as(user, sql, params)).rows[0];

// ---- Templates: owner/admin only, per builder, revision owned by the database ------------------------------------------
const milestones = JSON.stringify([{ key: 'UNDERSLAB', percent: 25 }, { key: 'ROUGH_IN', percent: 40 }, { key: 'FIT_OFF', remainder: true }]);
const tplSql = `insert into public.builder_trade_payment_templates (workspace_id, trade, name, source_section, milestones, revision) values ($1, 'PLUMBING', 'Plumbing', 'PLUMBING', $2::jsonb, 99) returning id, revision, updated_by`;
const tplA = await one(U.ownerA, tplSql, [A, milestones]);
assert.equal(tplA.revision, 1); assert.equal(tplA.updated_by, U.ownerA);
assert.equal((await one(U.ownerA, `update public.builder_trade_payment_templates set name = 'Plumbing 2', revision = 50 where id = $1 returning revision`, [tplA.id])).revision, 2);
await denied(as(U.ownerA, tplSql, [B, milestones]), /row-level security/, 'an owner of A cannot write a template into B');
await denied(as(U.staffA, `insert into public.builder_trade_payment_templates (workspace_id, trade, name, source_section, milestones) values ($1, 'ELECTRICAL', 'E', 'ELECTRICAL', $2::jsonb)`, [A, milestones]), /row-level security/, 'staff cannot write templates');
await as(U.ownerB, tplSql, [B, milestones]);
assert.equal((await as(U.ownerB, `select workspace_id from public.builder_trade_payment_templates`)).rows.map((r) => r.workspace_id).join(), B, 'B sees only its own template');
assert.equal((await as(U.ownerB, `update public.builder_trade_payment_templates set name = 'hijack' where workspace_id = $1`, [A])).affectedRows, 0);
assert.equal((await as(U.staffA, `select name from public.builder_trade_payment_templates`)).rows[0].name, 'Plumbing 2', 'members read their own builder template');
await denied(as(U.ownerA, `update public.builder_trade_payment_templates set workspace_id = $1 where id = $2`, [B, tplA.id]), /immutable|row-level security/);
console.log('PASS templates: owner/admin write, member read, no cross-builder read or write, database-owned revision');

// ---- Contracts ---------------------------------------------------------------------------------------------------------
const contractSql = `insert into public.builder_trade_contracts (workspace_id, job_id, contract_key, trade, contract_amount, purchase_order_id, supplier_id, project_id) values ($1, $2, $3, 'PLUMBING', $4, $5, $6, $7) returning id`;
const cA = (await one(U.ownerA, contractSql, [A, 'job-1', 'tc:job-1:PLUMBING', 58270, ids.poA, ids.supA, ids.projA])).id;
const cA2 = (await one(U.ownerA, contractSql, [A, 'job-1', 'tc:job-1:ELECTRICAL', 10000, ids.poA2, null, null])).id;
const cB = (await one(U.ownerB, contractSql, [B, 'job-1', 'tc:job-1:PLUMBING', 1000, ids.poB, ids.supB, ids.projB])).id;
await denied(as(U.ownerA, contractSql, [A, 'job-2', 'k', 1, ids.poB, null, null]), /foreign key/, "another builder's purchase order cannot be attached");
await denied(as(U.ownerA, contractSql, [A, 'job-2', 'k', 1, null, ids.supB, null]), /foreign key/, "another builder's supplier cannot be attached");
await denied(as(U.ownerA, contractSql, [A, 'job-2', 'k', 1, null, null, ids.projB]), /foreign key/, "another builder's project cannot be attached");
await denied(as(U.ownerA, contractSql, [A, 'job-2', 'k', 1, ids.poA, null, null]), /unique/, 'one purchase order carries one contract');
await denied(as(U.ownerA, contractSql, [A, 'job-1', 'tc:job-1:PLUMBING', 1, null, null, null]), /unique/, 'one contract per job and trade');
await denied(as(U.ownerA, contractSql, [B, 'job-9', 'k', 1, null, null, null]), /row-level security/);
for (const user of [U.staffA, U.designerA, U.lapsedA, U.stranger]) await denied(as(user, contractSql, [A, 'job-3', 'k', 1, null, null, null]), /row-level security/, 'only owners, admins and builder admins create contracts');
assert.deepEqual((await as(U.ownerB, `select id from public.builder_trade_contracts`)).rows.map((r) => r.id), [cB]);
assert.equal((await as(U.lapsedA, `select id from public.builder_trade_contracts`)).rows.length, 0, 'an inactive member sees nothing');
assert.equal((await as(U.stranger, `select id from public.builder_trade_contracts`)).rows.length, 0);
assert.equal((await as(U.ownerB, `update public.builder_trade_contracts set contract_amount = 1 where id = $1`, [cA])).affectedRows, 0);
assert.equal((await as(U.staffA, `update public.builder_trade_contracts set contract_amount = 1 where id = $1`, [cA])).affectedRows, 0, 'staff cannot change a contract value');
await denied(as(U.ownerA, `update public.builder_trade_contracts set job_id = 'job-2' where id = $1`, [cA]), /immutable/);
await denied(as('anon', `select 1 from public.builder_trade_contracts`), /permission denied/);
console.log('PASS contracts: correct builder and job, cross-builder supplier/project/PO refused, one PO per contract, manager-only writes');

// ---- Milestones --------------------------------------------------------------------------------------------------------
const msSql = `insert into public.builder_trade_contract_milestones (workspace_id, contract_id, milestone_key, label, sort_order, percent, is_remainder) values ($1, $2, $3, $3, $4, $5, $6) returning id`;
const m = {};
m.underslab = (await one(U.ownerA, msSql, [A, cA, 'UNDERSLAB', 1, 25, false])).id;
m.roughIn = (await one(U.ownerA, msSql, [A, cA, 'ROUGH_IN', 2, 40, false])).id;
m.fitOff = (await one(U.ownerA, msSql, [A, cA, 'FIT_OFF', 3, null, true])).id;
m.elec = (await one(U.ownerA, msSql, [A, cA2, 'ROUGH', 1, 100, false])).id;
m.b = (await one(U.ownerB, msSql, [B, cB, 'UNDERSLAB', 1, 100, false])).id;
await denied(as(U.ownerA, msSql, [A, cB, 'X', 9, 1, false]), /foreign key/, "a milestone cannot name another builder's contract");
await denied(as(U.ownerB, msSql, [B, cA, 'X', 9, 1, false]), /foreign key/, "B cannot hang a milestone on A's contract under its own workspace id");
await denied(as(U.ownerA, msSql, [B, cB, 'X', 9, 1, false]), /row-level security/);
await denied(as(U.staffA, msSql, [A, cA, 'X', 9, 1, false]), /row-level security/, 'staff cannot add milestones');
await denied(as(U.ownerA, msSql, [A, cA, 'UNDERSLAB', 9, 1, false]), /unique/);
await denied(as(U.staffA, `update public.builder_trade_contract_milestones set percent = 90 where id = $1`, [m.underslab]), /contract manager/, 'staff cannot re-allocate');
await denied(as(U.ownerA, `update public.builder_trade_contract_milestones set contract_id = $1 where id = $2`, [cA2, m.underslab]), /immutable/);
assert.equal((await as(U.ownerB, `update public.builder_trade_contract_milestones set completion_status = 'COMPLETE' where id = $1`, [m.underslab])).affectedRows, 0);
console.log('PASS milestones: same workspace as the contract, manager-only structure, immutable parent');

// ---- Completion never approves -----------------------------------------------------------------------------------------
const claimSql = `insert into public.builder_trade_contract_claims (workspace_id, contract_id, milestone_id, claimed_amount) values ($1, $2, $3, $4) returning id, status, claimed_by`;
await denied(as(U.staffA, claimSql, [A, cA, m.underslab, 14567.5]), /not complete/, 'no claim before the work is complete');
assert.equal((await as(U.staffA, `update public.builder_trade_contract_milestones set completion_status = 'COMPLETE', completion_source = 'JOB_BOARD', completed_at = now() where id = any($1::uuid[])`, [[m.underslab, m.roughIn, m.elec]])).affectedRows, 3, 'staff (Job Board) may record completion');
assert.equal((await as(U.ownerA, `select count(*)::int as n from public.builder_trade_contract_claims`)).rows[0].n, 0, 'completing work creates no claim, approval or payment');
assert.equal((await as(U.ownerA, `select count(*)::int as n from public.builder_trade_contract_invoices`)).rows[0].n, 0);

// ---- Claims and approval -----------------------------------------------------------------------------------------------
await denied(as(U.staffA, `insert into public.builder_trade_contract_claims (workspace_id, contract_id, milestone_id, claimed_amount, status, approved_amount) values ($1, $2, $3, 14567.5, 'APPROVED', 14567.5)`, [A, cA, m.underslab]), /starts as CLAIMED/, 'a claim cannot be born approved');
await denied(as(U.designerA, claimSql, [A, cA, m.underslab, 14567.5]), /row-level security/);
await denied(as(U.ownerB, claimSql, [B, cA, m.underslab, 1]), /does not belong/);
await denied(as(U.ownerA, claimSql, [A, cA2, m.underslab, 1]), /does not belong/, 'a claim cannot pair a milestone with a different contract');
const claim = await one(U.staffA, claimSql, [A, cA, m.underslab, 14567.5]);
assert.equal(claim.status, 'CLAIMED'); assert.equal(claim.claimed_by, U.staffA);
await denied(as(U.staffA, claimSql, [A, cA, m.underslab, 1]), /unique/, 'a milestone holds one live claim');
const approveSql = `update public.builder_trade_contract_claims set status = 'APPROVED' where id = $1 returning approved_amount, approved_by`;
await denied(as(U.staffA, approveSql, [claim.id]), /contract manager/, 'staff cannot approve');
assert.equal((await as(U.ownerB, approveSql, [claim.id])).affectedRows, 0, 'another builder cannot approve');
await denied(as(U.staffA, `update public.builder_trade_contract_claims set approved_amount = 1 where id = $1`, [claim.id]), /Approval fields|check constraint/);
await denied(db.query(approveSql, [claim.id]), /contract manager/, 'even a privileged connection cannot approve without a signed-in person');
const big = (await one(U.staffA, claimSql, [A, cA, m.roughIn, 50000])).id;
const approved = await one(U.ownerA, `update public.builder_trade_contract_claims set status = 'APPROVED', approved_by = $2 where id = $1 returning approved_amount, approved_by`, [claim.id, U.staffA]);
assert.equal(Number(approved.approved_amount), 14567.5); assert.equal(approved.approved_by, U.ownerA, 'the approver is the signed-in user, whatever the client sends');
await denied(as(U.ownerA, `update public.builder_trade_contract_claims set approved_amount = 1 where id = $1`, [claim.id]), /decided claim/, 'an approved claim is final');
await denied(as(U.ownerA, approveSql, [big]), /exceed the contract/, 'approvals cannot exceed the contract');
assert.equal((await one(U.ownerA, `update public.builder_trade_contract_claims set status = 'REJECTED', rejected_reason = 'too much' where id = $1 returning status`, [big])).status, 'REJECTED');
const claim2 = (await one(U.staffA, claimSql, [A, cA, m.roughIn, 23308])).id; // a rejected claim can be followed by a new one
await denied(as(U.ownerA, `delete from public.builder_trade_contract_claims where id = $1`, [claim2]), /permission denied/, 'claims are never deleted');
await denied(as(U.ownerA, `update public.builder_trade_contract_milestones set percent = 30 where id = $1`, [m.underslab]), /cannot be re-allocated/);
await denied(as(U.ownerA, `delete from public.builder_trade_contract_milestones where id = $1`, [m.underslab]), /cannot be removed|foreign key/);
console.log('PASS claims: completed work only, one live claim, manager-only approval by a signed-in person, final, capped at the contract');

// ---- Invoices and payment ----------------------------------------------------------------------------------------------
const invSql = `insert into public.builder_trade_contract_invoices (workspace_id, contract_id, claim_id, invoice_ref, amount, paid_amount, paid_date) values ($1, $2, $3, $4, $5, $6, $7) returning id, created_by, paid_recorded_by`;
await denied(as(U.staffA, invSql, [A, cA, claim.id, 'INV-001', 14567.5, 14567.5, '2026-11-01']), /contract manager/, 'staff cannot record a payment');
const inv = await one(U.staffA, invSql, [A, cA, claim.id, 'INV-001', 14567.5, 0, null]);
assert.equal(inv.created_by, U.staffA); assert.equal(inv.paid_recorded_by, null);
await denied(as(U.staffA, invSql, [A, cA, claim2, ' inv-001', 23308, 0, null]), /unique/, 'an invoice reference is used once per contract');
await denied(as(U.ownerB, invSql, [B, cA, claim.id, 'X', 1, 0, null]), /foreign key/);
await denied(as(U.ownerA, invSql, [A, cA2, claim.id, 'X', 1, 0, null]), /foreign key/, 'an invoice cannot pair a claim with a different contract');
const inv2 = (await one(U.staffA, invSql, [A, cA, claim2, 'INV-002', 23308, 0, null])).id;
const paySql = `update public.builder_trade_contract_invoices set paid_amount = $2, paid_date = $3 where id = $1 returning paid_amount, paid_recorded_by`;
await denied(as(U.staffA, paySql, [inv.id, 14567.5, '2026-11-01']), /contract manager/);
await denied(as(U.ownerA, paySql, [inv2, 23308, '2026-11-01']), /approved claim/, 'an unapproved claim cannot be paid');
await denied(as(U.ownerA, paySql, [inv.id, 14567.5, null]), /check constraint/, 'a payment needs a date');
assert.equal((await as(U.ownerB, paySql, [inv.id, 14567.5, '2026-11-01'])).affectedRows, 0);
const paid = await one(U.ownerA, paySql, [inv.id, 14567.5, '2026-11-01']);
assert.equal(Number(paid.paid_amount), 14567.5); assert.equal(paid.paid_recorded_by, U.ownerA);
await denied(as(U.ownerA, invSql, [A, cA, claim.id, 'INV-001B', 100, 100, '2026-11-02']), /exceeds the approved amount/, 'a milestone cannot be paid twice');
await denied(as(U.ownerA, paySql, [inv.id, 100, '2026-11-01']), /cannot be reduced/);
await denied(as(U.ownerA, `update public.builder_trade_contract_invoices set invoice_ref = 'OTHER' where id = $1`, [inv.id]), /cannot be re-written/);
await denied(as(U.ownerA, `delete from public.builder_trade_contract_invoices where id = $1`, [inv.id]), /cannot be removed/);
console.log('PASS payments: manager-only, approved claims only, dated, never above approval, never reduced, no duplicate invoice');

// ---- Audit -------------------------------------------------------------------------------------------------------------
const audit = (await as(U.ownerA, `select source_table, action, actor_id from public.builder_trade_contract_audit where contract_id = $1 order by created_at`, [cA])).rows;
assert(audit.some((r) => r.source_table === 'builder_trade_contracts' && r.action === 'INSERT' && r.actor_id === U.ownerA));
assert(audit.some((r) => r.source_table === 'builder_trade_contract_claims' && r.action === 'UPDATE' && r.actor_id === U.ownerA), 'the approval is in the history under the approver');
assert(audit.some((r) => r.source_table === 'builder_trade_contract_invoices' && r.action === 'UPDATE' && r.actor_id === U.ownerA), 'the payment is in the history');
assert(audit.some((r) => r.source_table === 'builder_trade_contract_milestones' && r.actor_id === U.staffA), 'completion is in the history under the person who recorded it');
for (const sql of [`update public.builder_trade_contract_audit set action = 'x'`, `delete from public.builder_trade_contract_audit`, `insert into public.builder_trade_contract_audit (workspace_id, contract_id, source_table, action) values ('${A}', '${cA}', 'x', 'x')`]) {
  for (const user of [U.ownerA, U.staffA, U.ownerB]) await denied(as(user, sql), /permission denied/, 'no client role can write audit history');
}
await denied(db.exec(`update public.builder_trade_contract_audit set action = 'x'`), /append-only/, 'history cannot be rewritten even by the table owner');
await denied(db.exec(`delete from public.builder_trade_contract_audit`), /append-only/);
assert.equal((await as(U.ownerB, `select 1 from public.builder_trade_contract_audit where contract_id = $1`, [cA])).rows.length, 0, "B cannot read A's history");
await denied(as(U.ownerA, `delete from public.builder_trade_contracts where id = $1`, [cA]), /foreign key/, 'a contract with history is cancelled, not deleted');
assert.equal((await one(U.ownerA, `update public.builder_trade_contracts set status = 'CANCELLED' where id = $1 returning status`, [cA2])).status, 'CANCELLED');
console.log('PASS audit: written by the database for every change, readable by the builder only, not editable or deletable');

// ---- A builder leaving takes only its own rows -------------------------------------------------------------------------
await db.exec(`delete from public.workspaces where id = '${B}'`);
const left = (await db.query(`select (select count(*) from public.builder_trade_contracts where workspace_id = '${B}')::int as b, (select count(*) from public.builder_trade_contract_audit where workspace_id = '${B}')::int as audit_b, (select count(*) from public.builder_trade_contracts where workspace_id = '${A}')::int as a, (select count(*) from public.builder_trade_contract_invoices where workspace_id = '${A}')::int as inv_a`)).rows[0];
assert.deepEqual(left, { b: 0, audit_b: 0, a: 2, inv_a: 2 });
console.log('PASS removing one builder removes only that builder\'s contracts and history');

await db.close();
console.log('Trade payment migration tests passed (isolated PGlite database; not applied to Supabase).');
