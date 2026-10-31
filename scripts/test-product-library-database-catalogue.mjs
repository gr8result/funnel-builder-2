import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { createBuilderCatalogueRepository } from '../lib/product-library/builderCatalogueRepository.js';
import { configureBuilderCataloguePersistence, flushBuilderCatalogueWrites, getEffectiveProductCatalogue, getMasterProducts, hydrateBuilderCatalogue, retryBuilderCatalogueWrites, setBuilderDatabaseProducts, setCatalogueStorage, updateBuilderProductOverride } from '../lib/product-library/catalogueService.js';

const builderA = '11111111-1111-4111-8111-111111111111';
const builderB = '22222222-2222-4222-8222-222222222222';
const values = new Map();
setCatalogueStorage({ getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) });
const row = { id: '33333333-3333-4333-8333-333333333333', workspace_id: builderA, sku: 'PRIVATE-MIXER', product_name: 'Private kitchen mixer', unit: 'EACH', upgrade_cost: 132, primary_image_url: '/private-mixer.jpg', selection_slot_ids: ['kitchen_mixer'], metadata: { productEntity: { familyKey: 'sink-mixer', topLevelArea: 'kitchen', category: 'Kitchen Tapware', requirementKeys: ['sink-mixer'], gstIncluded: false, priceStatus: 'verified' } } };
const masterIds = getMasterProducts(builderA).map(product => product.productId);
setBuilderDatabaseProducts(builderA, [row]);
const catalogue = getEffectiveProductCatalogue({ organisationId: builderA });
const product = catalogue.products.find(candidate => candidate.productId === row.id);
assert(product, 'database product must appear in the public effective catalogue');
assert.equal(product.clientPrice, 132);
assert.equal(product.primaryImageUrl, '/private-mixer.jpg');
assert.equal(catalogue.canonicalProducts.find(candidate => candidate.stableProductId === row.id).price, 132);
assert.deepEqual(getMasterProducts(builderA).map(candidate => candidate.productId), masterIds);
assert(!getEffectiveProductCatalogue({ organisationId: builderB }).products.some(candidate => candidate.productId === row.id));
assert.throws(() => setBuilderDatabaseProducts(builderB, [row]), /another workspace/);
setBuilderDatabaseProducts(builderA, [row]);
assert.equal(getEffectiveProductCatalogue({ organisationId: builderA }).products.filter(candidate => candidate.productId === row.id).length, 1);
console.log('PASS database catalogue identity, price, images, master preservation, tenant isolation and idempotent hydration');
const writes = [];
configureBuilderCataloguePersistence(builderA, async (action, record) => writes.push({ action, record }));
updateBuilderProductOverride(builderA, row.id, { builderPrice: 155 });
await flushBuilderCatalogueWrites(builderA);
assert.equal(writes[0].action, 'override');
assert.equal(writes[0].record.builderPrice, 155);
values.clear();
hydrateBuilderCatalogue(builderA, { products: [row], overrides: [{ workspace_id: builderA, catalogue_product_id: row.id, metadata: { productLibraryOverride: writes[0].record } }] });
assert.equal(getEffectiveProductCatalogue({ organisationId: builderA }).canonicalProducts.find(candidate => candidate.stableProductId === row.id).price, 155);
assert.throws(() => hydrateBuilderCatalogue(builderB, { products: [], overrides: [{ workspace_id: builderA }] }), /another workspace/);
console.log('PASS durable override write queue, fresh-device hydration and private override isolation');
configureBuilderCataloguePersistence(builderA, async () => { throw new Error('Offline test'); });
updateBuilderProductOverride(builderA, row.id, { builderPrice: 156 });
await assert.rejects(flushBuilderCatalogueWrites(builderA), /Offline test/);
configureBuilderCataloguePersistence(builderA, async (action, record) => writes.push({ action, record }));
await retryBuilderCatalogueWrites(builderA);
assert.equal(writes.at(-1).record.builderPrice, 156);
console.log('PASS failed cloud writes remain recoverable and retry without losing builder price');

const db = new PGlite();
try {
	await db.exec(`
		create table builder_products (id uuid primary key, workspace_id uuid not null, product_name text not null, sku text, model text, description text, primary_image_url text, product_url text, unit text, upgrade_cost numeric, base_allowance numeric, active boolean default true, metadata jsonb default '{}', updated_at timestamptz default now());
		create table builder_product_configurations (id uuid default gen_random_uuid(), workspace_id uuid not null, catalogue_product_id text not null, metadata jsonb default '{}', updated_at timestamptz default now(), unique(workspace_id,catalogue_product_id));
		create table builder_product_suppliers (id uuid primary key, workspace_id uuid not null, supplier_name text);
		create table builder_product_manufacturers (id uuid primary key, workspace_id uuid not null, manufacturer_name text);
	`);
	const tables = new Set(['builder_products', 'builder_product_configurations', 'builder_product_suppliers', 'builder_product_manufacturers']);
	const client = { from(table) {
		assert(tables.has(table));
		const filters = [];
		let operation = 'select';
		let payload;
		let conflict;
		let offset = 0;
		let limit = 1000;
		const query = {
			select() { return query; },
			eq(field, value) { assert(['id', 'workspace_id', 'catalogue_product_id'].includes(field)); filters.push([field, value]); return query; },
			order() { return query; },
			range(start, end) { offset = start; limit = end - start + 1; return query; },
			maybeSingle() { return execute(true); },
			single() { return execute(true); },
			insert(record) { operation = 'insert'; payload = record; return query; },
			update(record) { operation = 'update'; payload = record; return query; },
			upsert(record, options) { operation = 'insert'; payload = record; conflict = options.onConflict; return query; },
			then(resolve, reject) { return execute(false).then(resolve, reject); },
		};
		async function execute(single) {
			try {
				const parameters = [];
				const parameter = value => { parameters.push(value); return `$${parameters.length}`; };
				const where = filters.map(([field, value]) => `${field}=${parameter(value)}`).join(' and ');
				let statement;
				if (operation === 'select') statement = `select to_jsonb(t) as record from ${table} t${where ? ` where ${where}` : ''} order by id offset ${offset} limit ${limit}`;
				else {
					const fields = Object.keys(payload);
					assert(fields.every(field => /^[a-z_]+$/.test(field)));
					const values = fields.map(field => parameter(typeof payload[field] === 'object' ? JSON.stringify(payload[field]) : payload[field]));
					if (operation === 'update') statement = `update ${table} set ${fields.map((field, index) => `${field}=${values[index]}`).join(',')} where ${where} returning to_jsonb(${table}.*) as record`;
					else statement = `insert into ${table} (${fields.join(',')}) values (${values.join(',')})${conflict ? ' on conflict(workspace_id,catalogue_product_id) do update set metadata=excluded.metadata,updated_at=excluded.updated_at' : ''} returning to_jsonb(${table}.*) as record`;
				}
				const result = (await db.query(statement, parameters)).rows.map(result => result.record);
				return { data: single ? result[0] || null : result, error: null };
			} catch (error) { return { data: null, error }; }
		}
		return query;
	} };
	const repository = createBuilderCatalogueRepository(client, builderA);
	const foreign = createBuilderCatalogueRepository(client, builderB);
	const privateProduct = { productId: row.id, organisationId: builderA, productCode: 'PRIVATE-MIXER', productName: 'Persisted mixer', familyKey: 'sink-mixer', priceUnit: 'EACH', clientPrice: 132, gstIncluded: false, priceStatus: 'verified', primaryImageUrl: '/private-mixer.jpg' };
	await repository.save('product', privateProduct);
	const persistedProduct = (await repository.load()).products[0];
	assert.equal(persistedProduct.unit, 'EACH');
	assert.equal(persistedProduct.upgrade_cost, 132);
	configureBuilderCataloguePersistence(builderA, (action, record) => repository.save(action, record));
	hydrateBuilderCatalogue(builderA, await repository.load());
	updateBuilderProductOverride(builderA, row.id, { builderPrice: 166, notes: 'Builder private negotiated price' });
	await flushBuilderCatalogueWrites(builderA);
	values.clear();
	hydrateBuilderCatalogue(builderA, await repository.load());
	assert.equal(getEffectiveProductCatalogue({ organisationId: builderA }).canonicalProducts.find(product => product.stableProductId === row.id).price, 166);
	assert.equal((await foreign.load()).products.length, 0);
	assert.equal((await foreign.load()).overrides.length, 0);
	await assert.rejects(foreign.save('product', privateProduct), /another workspace/);
	await db.query('update builder_product_configurations set metadata=metadata || $1::jsonb where workspace_id=$2', [JSON.stringify({ quotationOwnerData: { preserve: true } }), builderA]);
	await repository.save('override', { organisationId: builderA, masterProductCode: row.id, builderPrice: 170, updatedAt: '2099-01-01T00:00:00.000Z' });
	assert.deepEqual((await repository.load()).overrides[0].metadata.quotationOwnerData, { preserve: true });
	await assert.rejects(repository.save('override', { organisationId: builderA, masterProductCode: row.id, updatedAt: '2000-01-01T00:00:00.000Z' }), /another device/);
	console.log('PASS PGlite product/override persistence, fresh-device reload, tenant isolation, metadata preservation and stale-write rejection');
} finally {
	await db.close();
}