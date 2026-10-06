import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { SELECTION_SLOTS, createSelectionConfiguration, resolveSelectionSlot, resolveQuoteTarget, updateActiveSelection, createJobInclusionSnapshot, resolveLocationSelection, withStableQuoteTargets, preserveQuoteQuantityOwnership } from '../lib/builders/selectionRegistry.js';
import { currentBuilderScheduleSeeds, CURRENT_BUILDER_WORKSPACE_ID } from '../lib/builders/currentBuilderSeed.js';
import { adoptLegacyWorkbook } from '../lib/builders/tenantScope.js';
import { createSelectionRepository } from '../lib/builders/selectionRepository.js';
import { connectTenantSelectionMetadata } from '../lib/builders/tenantSelectionQuotation.js';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let checks = 0;
async function check(name, run) { await run(); checks += 1; console.log('PASS', name); }
try {
  await db.exec(`create role authenticated; create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.workspaces (id uuid primary key, name text);
    create table public.workspace_members (workspace_id uuid, user_id uuid, role text, status text);
    alter table public.workspace_members enable row level security;
    insert into auth.users values ('${USER_A}'),('${USER_B}');
    insert into workspaces values ('${A}','Builder A'),('${B}','Builder B'),('${CURRENT_BUILDER_WORKSPACE_ID}','Current builder');
    insert into workspace_members values ('${A}','${USER_A}','owner','active'),('${B}','${USER_B}','owner','active');
    grant usage on schema public,auth to authenticated; grant select on workspace_members to authenticated;`);
  for (const filename of [
    '20260813091500_estimate_builder_commercial_backbone_stage1.sql',
    '20260813091600_builder_inclusion_templates.sql',
    '20260813091800_builder_selection_books.sql',
    '20260813092100_builder_product_library.sql',
    '20260813092400_seed_gr8_standard_specifications.sql',
    '20260813093000_selection_budget_manager.sql',
    '20261003000100_builder_selection_tenant_foundation.sql',
  ]) {
    const sql = (await fs.readFile(`supabase/migrations/${filename}`, 'utf8')).replace(/create extension if not exists pgcrypto;/gi, '');
    try { await db.exec(sql); } catch (error) { throw new Error(`${filename}: ${error.message}`, { cause: error }); }
  }
  await db.exec('grant select,insert,update,delete on all tables in schema public to authenticated');
  const productA = (await db.query(`insert into builder_products(workspace_id,product_name,selection_slot_ids) values ($1,'Product A',array['kitchen_sink']) returning *`, [A])).rows[0];
  const productB = (await db.query(`insert into builder_products(workspace_id,product_name,selection_slot_ids) values ($1,'Product B',array['kitchen_sink']) returning *`, [B])).rows[0];
  const scheduleA = (await db.query(`insert into builder_inclusion_schedules(workspace_id,name,display_name) values ($1,'Classic Inclusions','Classic Inclusions') returning *`, [A])).rows[0];
  const scheduleB = (await db.query(`insert into builder_inclusion_schedules(workspace_id,name,display_name) values ($1,'Signature Inclusions','Signature Inclusions') returning *`, [B])).rows[0];
  for (const [workspace, section, row] of [[A,'section-a','row-a'],[B,'section-b','row-b']]) {
    await db.query(`insert into builder_selection_quote_mappings(workspace_id,selection_slot_id,template_id,quote_section_id,quote_row_id,status) values ($1,'kitchen_sink','template',$2,$3,'MAPPED')`, [workspace,section,row]);
    await db.query(`insert into builder_selection_configurations(workspace_id,selection_slot_id,builder_display_name,enabled) values ($1,'kitchen_sink','Kitchen Tapware',true)`, [workspace]);
  }
  const asUser = async user => {
    await db.exec('reset role'); await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[user]); await db.exec('set role authenticated');
  };
  for (const [user, own, other] of [[USER_A,A,B],[USER_B,B,A]]) {
    await asUser(user);
    for (const table of ['builder_products','builder_inclusion_schedules','builder_selection_quote_mappings','builder_selection_configurations']) {
      await check(`${own === A ? 'A' : 'B'} cannot read the other builder's ${table} (actual PostgreSQL RLS)`,async () => {
        const all = (await db.query(`select * from ${table}`)).rows;
        assert(all.length > 0); assert(all.every(row => row.workspace_id === own));
        assert.equal((await db.query(`select * from ${table} where workspace_id = $1`,[other])).rows.length,0);
        assert.equal((await db.query(`update ${table} set workspace_id = workspace_id where workspace_id = $1 returning id`,[other])).rows.length,0);
      });
    }
  }
  await asUser(USER_A);
  await check('forged tenant insert blocked by RLS',async () => {
    await assert.rejects(db.query(`insert into builder_inclusion_schedules(workspace_id,name,display_name) values ($1,'Forged','Forged')`,[B]),/row-level security/);
  });
  await check('cross-tenant schedule/product references blocked by database',async () => {
    await assert.rejects(db.query(`insert into builder_inclusion_schedule_items(workspace_id,inclusion_schedule_id,selection_slot_id,default_product_id) values ($1,$2,'kitchen_sink',$3)`,[A,scheduleA.id,productB.id]),/foreign key/);
    await assert.rejects(db.query(`insert into builder_inclusion_schedule_items(workspace_id,inclusion_schedule_id,selection_slot_id) values ($1,$2,'kitchen_sink')`,[A,scheduleB.id]),/foreign key/);
  });
  await db.exec('reset role');
  await check('existing supplier relationships cannot cross tenants, including service role',async () => {
    const supplier = (await db.query(`insert into builder_product_suppliers(workspace_id,supplier_name) values ($1,'Private supplier') returning id`,[B])).rows[0];
    await assert.rejects(db.query(`update builder_products set supplier_id=$1 where id=$2`,[supplier.id,productA.id]),/Cross-workspace reference/);
  });
  await check('schedule version advances; job snapshot stays immutable',async () => {
    const snapshot = createJobInclusionSnapshot(A,scheduleA,[]);
    const { rows } = await db.query(`update builder_inclusion_schedules set display_name='Changed' where id=$1 returning *`,[scheduleA.id]);
    assert.equal(rows[0].version,2); assert.equal(snapshot.jobInclusionScheduleVersion,1); assert.equal(snapshot.jobInclusionSnapshot.schedule.display_name,'Classic Inclusions');
  });
  await check('current builder schedules are owned records; no three-schedule limit',async () => {
    const rows = (await db.query(`select * from builder_inclusion_schedules where workspace_id=$1`,[CURRENT_BUILDER_WORKSPACE_ID])).rows;
    assert.deepEqual(rows.map(row => row.name).sort(),currentBuilderScheduleSeeds(CURRENT_BUILDER_WORKSPACE_ID).map(row => row.name).sort());
    assert.deepEqual(currentBuilderScheduleSeeds(B),[]);
    for (const name of ['Base','Deluxe','Prestige','Investor']) await db.query(`insert into builder_inclusion_schedules(workspace_id,name,display_name) values ($1,$2,$2)`,[B,name]);
    assert.equal((await db.query(`select * from builder_inclusion_schedules where workspace_id=$1`,[B])).rows.length,5);
  });
  await check('registry agrees with database and never guesses a quote destination',async () => {
    assert.deepEqual((await db.query('select id from selection_slot_definitions order by id')).rows.map(row => row.id),SELECTION_SLOTS.map(slot => slot.selectionSlotId).sort());
    assert.equal(resolveSelectionSlot(A,'Kitchen Tapware',[{workspace_id:B,alias:'Kitchen Tapware',selection_slot_id:'kitchen_mixer'}]),'UNMAPPED');
    assert.equal(resolveQuoteTarget(A,'kitchen_sink',[], 'template').status,'UNMAPPED');
    const mappings = (await db.query('select * from builder_selection_quote_mappings')).rows;
    assert.equal(resolveQuoteTarget(A,'kitchen_sink',mappings,'template').rowId,'row-a');
    assert.equal(resolveQuoteTarget(B,'kitchen_sink',mappings,'template').rowId,'row-b');
    assert.equal(createSelectionConfiguration(B,'oven').enabled,false);
  });
  await check('product changes preserve baseline, formulas, quantities and ordering',() => {
    const row = { id:'row-1', quantity:7, quantityFormula:'doors * 2', formulaSelection:'takeoff', baselineProductId:'base',baselineUnitPrice:50,sortOrder:13 };
    const updated = updateActiveSelection(row,{productId:'upgrade',unitPrice:70,quantity:0,quantityFormula:'0'});
    for (const key of Object.keys(row)) assert.deepEqual(updated[key],row[key]);
    const job = {quotation:{'Section Z':{rows:[updated]}},quotationSectionOrder:['Section Z'],formulas:{doors:'takeoffDoors'}};
    const imported = JSON.parse(JSON.stringify(adoptLegacyWorkbook(job,A)));
    assert.deepEqual(imported.quotation,job.quotation); assert.deepEqual(imported.formulas,job.formulas);
    assert.throws(() => adoptLegacyWorkbook(imported,B),/another builder/);
    const protectedJob = preserveQuoteQuantityOwnership(job,{...job,quotation:{'Section Z':{rows:[{...updated,quantity:0,quantityFormula:'0',baselineProductId:'overwritten'}]}}});
    assert.deepEqual(protectedJob.quotation,job.quotation);
    const stable = withStableQuoteTargets(job.quotation,()=> 'new-section-uuid');
    assert.equal(stable['Section Z'].id,'new-section-uuid');
    assert.equal(stable['Section Z'].rows[0].id,updated.id);
    assert.equal(withStableQuoteTargets(stable),stable);
  });
  await check('arbitrary job locations inherit defaults and preserve room overrides',() => {
    const selections = [{workspace_id:A,selectionSlotId:'wall_tile',locationId:null,activeProductId:'default'}, {workspace_id:A,selectionSlotId:'wall_tile',locationId:'pool-shower-7',activeProductId:'override'}, {workspace_id:B,selectionSlotId:'wall_tile',locationId:null,activeProductId:'secret'}];
    assert.equal(resolveLocationSelection(A,selections,'wall_tile','guest-3').activeProductId,'default');
    assert.equal(resolveLocationSelection(A,selections,'wall_tile','pool-shower-7').activeProductId,'override');
  });
  await check('tenant quote integration changes only the mapped product fields', () => {
    const row = {id:'row-b',item:'Manual quote item',quantity:12,quantityFormula:'takeoffArea * waste',sortOrder:4,baselineProductId:'baseline',baselineUnitPrice:11};
    const workbook = {workspaceId:B,templateKey:'template',quotation:{'Custom name':{id:'section-b',rows:[row]}},formulas:{takeoffArea:'area + offset'}};
    const foundation = {workspace_id:B,aliases:[],configurations:[{workspace_id:B,selection_slot_id:'kitchen_sink',enabled:true}],mappings:[{workspace_id:B,selection_slot_id:'kitchen_sink',template_id:'template',quote_section_id:'section-b',quote_row_id:'row-b',status:'MAPPED'}]};
    const book = {rooms:[{id:'outdoor-kitchen',rows:[{guidedSelection:{selectionSlotId:'kitchen_sink',productId:'sink-b',selectedPrice:17}}]}]};
    const next = connectTenantSelectionMetadata(workbook,book,foundation);
    const updated = next.quotation['Custom name'].rows[0];
    assert.equal(updated.activeProductId,'sink-b');
    for (const field of Object.keys(row)) assert.deepEqual(updated[field],row[field]);
    assert.deepEqual(next.formulas,workbook.formulas);
    assert.throws(() => connectTenantSelectionMetadata({...workbook,workspaceId:A},book,foundation),/workspace mismatch/);
  });
  // Real SQL-backed Supabase-shaped adapter exercises the API repository with service-role access.
  const adapter = {from(table) {
    assert(/^[a-z_]+$/.test(table)); const filters=[];
    const query = {select(){return query;}, eq(key,value){filters.push([key,value]);return query;},maybeSingle(){query.single=true;return query;},
      then(resolve,reject){const sql=`select * from ${table} where ${filters.map(([key],i)=>`${key}=$${i+1}`).join(' and ')}`;
        return db.query(sql,filters.map(([,value])=>value)).then(result => resolve({data:query.single ? result.rows[0] || null : result.rows}),reject);}};
    return query;
  }};
  await check('API repository scopes service-role queries and rejects foreign writes',async () => {
    const repo = createSelectionRepository(adapter,A);
    assert.equal(await repo.get('products',productB.id),null);
    assert((await repo.list('mappings')).every(row=>row.workspace_id===A));
    await assert.rejects(repo.save('schedules',{id:scheduleB.id,name:'stolen'}),/not found/);
    await assert.rejects(repo.save('schedules',{workspace_id:B,name:'stolen'}),/does not belong/);
    assert.throws(()=>createSelectionRepository(adapter,''),/workspace/);
  });
  console.log(`Tenant foundation: ${checks} checks passed.`);
} finally { await db.close(); }
