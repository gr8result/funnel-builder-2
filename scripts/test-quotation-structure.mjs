import assert from 'node:assert/strict';
import { normalizeQuotationStructure } from '../lib/construction-estimation/quotationStructure.js';

const plumbingRow = {
  id: 'selected-tap', section: 'PLUMBING FIT OFF - CLIENT SELECTIONS', item: 'Selected kitchen tap',
  quantity: 2, manualRate: '$125.00', excelRate: '$110.00', quantityManualOverride: true,
  formulas: { G: 'B2400*F2400' }, productId: 'tap-1', locationSchedule: [{ location: 'Kitchen', quantity: 2 }],
};
const tileRow = {
  id: 'tile-room-row', section: 'TILING - MAIN BATHROOM', item: 'Main bathroom floor tile',
  quantity: 12.4, manualRate: '$45.00', productId: 'tile-1', tilingRoomId: 'main-bathroom',
};
const ceramicRow = {
  id: 'floor-tile-catalogue-row', section: 'CERAMIC TILES', item: '600x600 Ceramic Tile',
  quantity: '', excelRate: '$185.00', formulas: { G: 'B201103*F201103' },
};
const electricalRow = {
  id: 'electrical-schedule:kitchen:double-gpo', section: 'ELECTRICAL - CLIENT SELECTIONS',
  item: 'Double Powerpoint - Kitchen', quantity: 6, manualRate: '$82.00', source: 'client-selections-electrical-schedule',
};
const original = {
  'PLUMBING (83)': { collapsed: false, rows: [{ id: 'plumbing-labour', section: 'PLUMBING (83)', item: 'Plumbing rough-in', quantity: 1, manualRate: '$900.00' }] },
  'PLUMBING FIT OFF - CLIENT SELECTIONS': { collapsed: true, stageNumber: '7', rows: [plumbingRow] },
  'PLUMBING - HOT WATER - CLIENT SELECTIONS': { collapsed: true, rows: [{ id: 'selected-hot-water', section: 'PLUMBING - HOT WATER - CLIENT SELECTIONS', item: 'Selected hot water unit', quantity: 1, productId: 'hws-1', excelRate: '$3,000.00' }] },
  'ELECTRICAL (84)': { collapsed: false, rows: [{ id: 'electrical-rate', section: 'ELECTRICAL (84)', item: 'Double Powerpoint', quantity: 1, excelRate: '$82.00' }] },
  'ELECTRICAL - CLIENT SELECTIONS': { collapsed: true, rows: [electricalRow] },
  'STAIRS (87)': { collapsed: true, rows: [{ id: 'stairs-row', section: 'STAIRS (87)', item: 'Stair flight', quantity: 1 }] },
  'PLASTERER - SUPPLY AND INSTALL (85)': { collapsed: true, rows: [{ id: 'plaster-row', section: 'PLASTERER - SUPPLY AND INSTALL (85)', item: 'Plasterboard', quantity: 100 }] },
  'TILING (108)': { collapsed: true, rows: [{ id: 'tiling-template-row', section: 'TILING (108)', item: 'Tiling allowance', quantity: '' }] },
  'TILING - MAIN BATHROOM': { collapsed: true, rows: [tileRow] },
  'FLOORCOVERINGS (149)': { collapsed: true, rows: [{ id: 'carpet', section: 'FLOORCOVERINGS (149)', item: 'Carpet', quantity: 80 }] },
  'CERAMIC TILES': { collapsed: true, rows: [ceramicRow] },
  'CABINETRY': { collapsed: false, rows: [{ id: 'cabinetry', section: 'CABINETRY', item: 'Approved vanity', quantity: 2, excelRate: '$640.00' }] },
  'DOORS (71)': { collapsed: true, rows: [{ id: 'entry-door', section: 'DOORS (71)', item: 'Entry door', quantity: 1 }] },
  'DOOR JAMB MATERIALS': { collapsed: true, rows: [{ id: 'jamb', section: 'DOOR JAMB MATERIALS', item: '90 x 19 jamb', quantity: 4, manualRate: '$26.00' }] },
  'APPLIANCES & WHITE GOODS - ARISTON': { collapsed: true, rows: [{ id: 'appliance-shared', section: 'APPLIANCES & WHITE GOODS - ARISTON', item: 'Ariston oven', quantity: 1, excelRate: '$1,100.00' }] },
  'APPLIANCES & WHITE GOODS - SMEG': { collapsed: true, rows: [{ id: 'appliance-shared', section: 'APPLIANCES & WHITE GOODS - SMEG', item: 'Smeg oven', quantity: 1, excelRate: '$1,200.00' }] },
};
const before = structuredClone(original);
const migrated = normalizeQuotationStructure(original);
assert.deepEqual(original, before, 'migration does not mutate the source job');
for (const name of ['PLUMBING', 'PLUMBING FIXTURES & HOT WATER', 'AIR CONDITIONING', 'SHOWER SCREENS, MIRRORS & SLIDING DOORS', 'STAIRS & BALUSTRADES', 'TILING', 'FLOORCOVERINGS', 'CABINETRY', 'ENTRY DOORS', 'FIX OUT', 'ELECTRICAL', 'APPLIANCES & WHITE GOODS']) assert(migrated[name], name);
assert.equal(migrated['PLUMBING'].rows.find(row => row.id === 'plumbing-labour').quantity, 1);
assert.deepEqual(migrated['PLUMBING FIXTURES & HOT WATER'].rows.find(row => row.id === 'selected-tap'), { ...plumbingRow, section: 'PLUMBING FIXTURES & HOT WATER' });
assert.deepEqual(migrated.ELECTRICAL.rows.find(row => row.id === electricalRow.id), { ...electricalRow, section: 'ELECTRICAL' });
assert.equal(migrated.TILING.rows.find(row => row.id === tileRow.id).manualRate, '$45.00');
assert.equal(migrated.TILING.rows.find(row => row.id === ceramicRow.id).excelRate, '$185.00');
assert.equal(migrated.FLOORCOVERINGS.rows.some(row => /tile/i.test(row.item)), false);
assert.equal(migrated['ENTRY DOORS'].rows.find(row => row.id === 'entry-door').quantity, 1);
assert.equal(migrated['FIX OUT'].rows.find(row => row.id === 'jamb').manualRate, '$26.00');
assert.equal(migrated['APPLIANCES & WHITE GOODS'].rows.find(row => row.item === 'Smeg oven').excelRate, '$1,200.00');
assert.equal(migrated['PLUMBING FIXTURES & HOT WATER'].rows.some(row => row.quotationSubgroupHeadingLevel), true);
assert.equal(migrated['PLUMBING FIXTURES & HOT WATER'].rows.filter(row => row.quotationSubgroupHeadingLevel && row.item === 'CLIENT SELECTIONS').length, 1, 'plumbing and hot-water selections share one subgroup');
assert.equal(migrated['PLUMBING FIXTURES & HOT WATER'].rows.find(row => row.id === 'selected-hot-water').excelRate, '$3,000.00');
assert.equal(migrated.TILING.rows.find(row => row.quotationSubgroupHeadingLevel)?.item, 'MAIN BATHROOM');
assert.equal(Object.hasOwn(migrated, 'CERAMIC TILES'), false);
assert.equal(Object.hasOwn(migrated, 'TILING - MAIN BATHROOM'), false);
assert.equal(Object.keys(migrated).filter(name => name === 'ELECTRICAL').length, 1);
const migratedRowIds = Object.values(migrated).flatMap(section => section.rows || []).map(row => row.id).filter(Boolean);
assert.equal(new Set(migratedRowIds).size, migratedRowIds.length, 'row IDs remain unique after consolidation');
assert.equal(migrated['APPLIANCES & WHITE GOODS'].rows.find(row => row.legacyRowId === 'appliance-shared')?.item, 'Smeg oven');
assert.equal(Object.keys(migrated).indexOf('STAIRS & BALUSTRADES'), Object.keys(migrated).indexOf('PLASTERER - SUPPLY AND INSTALL (85)') + 1);
assert.deepEqual(normalizeQuotationStructure(migrated), migrated, 'migration is idempotent');

const repeatedHeadingId = 'quotation-subheading:fix-out:fix-out-bathroom-accessories-client-selections';
const mergedExistingHeading = normalizeQuotationStructure({
  'FIX OUT': { rows: [{ id: repeatedHeadingId, item: 'CLIENT SELECTIONS', section: 'FIX OUT', quotationSubgroupHeadingLevel: 1 }, { id: 'fix-out-row', item: 'Skirting', section: 'FIX OUT' }] },
  'FIX OUT - BATHROOM ACCESSORIES - CLIENT SELECTIONS': { rows: [{ id: 'accessory-row', item: 'Towel Rail', section: 'FIX OUT - BATHROOM ACCESSORIES - CLIENT SELECTIONS' }] },
});
assert.equal(mergedExistingHeading['FIX OUT'].rows.filter(row => row.id === repeatedHeadingId).length, 1, 'a connector-owned alias must not add a second existing heading');
assert.equal(mergedExistingHeading['FIX OUT'].rows.find(row => row.id === 'accessory-row').item, 'Towel Rail');

console.log('Quotation structure migration: rows, rates, formulas, selections, sections, order, and idempotence passed.');