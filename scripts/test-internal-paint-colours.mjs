import assert from 'node:assert/strict';
import fs from 'node:fs';
import { COLOUR_DISCLAIMER, COLOUR_GROUPS, DULUX_COLOURS, builderColourIds, coloursInGroup, findColour, groupCounts, searchColours } from '../lib/builders/duluxColourLibrary.js';
import {
  PAINT_COLOUR_SURFACES, confirmHouseScheme, internalPaintScheduleLines, internalPaintSchemeStatus, linkInternalPaintColoursToQuotation, normaliseInternalPaintScheme,
  paintInclusionBaseline, paintableRoomNames, removeFeatureWall, resolveRoomColours, saveFeatureWall, setHouseColour, setRoomOverride, storedInternalPaintScheme,
} from '../lib/builders/internalPaintColours.js';
import { getMasterProducts } from '../lib/product-library/catalogueService.js';

// Internal Paint Colours: the Dulux colour library, the house scheme with room overrides and
// feature walls, completion, and the link to the Quotation Builder.
// Usage: node --import ./scripts/register-extensionless-loader.mjs --import ./scripts/register-json-loader.mjs scripts/test-internal-paint-colours.mjs
const pass = message => console.log(`PASS ${message}`);

// ---- Colour library: genuine imported Dulux data only ----
const catalogue = JSON.parse(fs.readFileSync('data/product-library/catalogues/residential/AU-DULUX-COLOURS.json', 'utf8')).colours;
const source = new Map(catalogue.map(colour => [colour.id, colour]));
assert(DULUX_COLOURS.length >= 4800, `colour library holds the imported catalogue (${DULUX_COLOURS.length})`);
for (const colour of DULUX_COLOURS) {
  const imported = source.get(colour.id);
  assert(imported, `${colour.id} comes from the imported catalogue`);
  assert.equal(colour.name, imported.name); assert.equal(colour.code, imported.code); assert.equal(colour.hex, imported.hex.toLowerCase());
  assert.equal(colour.sourceUrl, imported.sourceUrl); assert(colour.sourceUrl.startsWith('https://www.dulux.com.au/'));
  assert(/^#[0-9a-f]{6}$/.test(colour.hex) && colour.code && colour.manufacturer === 'Dulux');
  assert(colour.groups.length, `${colour.name} can be browsed`);
}
assert.equal(new Set(DULUX_COLOURS.map(colour => colour.id)).size, DULUX_COLOURS.length, 'no duplicate colours');
pass(`${DULUX_COLOURS.length} colours, every name, code, swatch and source URL identical to the imported Dulux record`);

const naturalWhite = searchColours('Natural White')[0];
assert.equal(naturalWhite.name, 'Natural White™'); assert.equal(naturalWhite.code, 'SW1F4'); assert(naturalWhite.groups.includes('whites'));
assert.equal(searchColours('sw1f4')[0].id, naturalWhite.id, 'search by Dulux colour code');
assert.equal(searchColours('natural  WHITE', 'blues')[0].id, naturalWhite.id, 'a search looks in every family');
const vividWhite = searchColours('Vivid White')[0]; assert.equal(vividWhite.code, 'SW1G1');
const domino = searchColours('Domino')[0]; assert.equal(domino.code, 'SG6G8'); assert(domino.groups.includes('dark') && domino.groups.includes('greys'));
const lexiconQuarter = searchColours('Lexicon Quarter')[0]; assert.equal(lexiconQuarter.code, 'SW1E1');
assert.deepEqual(searchColours('zzzz not a colour'), []);
const counts = groupCounts();
for (const group of COLOUR_GROUPS.filter(item => item.key !== 'popular')) assert(counts[group.key] > 0, `${group.label} has colours`);
// Dulux lists 98 Whites & Neutrals; every one is browsable as a white or a neutral.
const whitesAndNeutrals = DULUX_COLOURS.filter(colour => colour.families.includes('whites-and-neutrals'));
assert(whitesAndNeutrals.length >= 98, `all Dulux Whites & Neutrals are filed there (${whitesAndNeutrals.length})`);
assert.equal(coloursInGroup('popular').length, 20, 'the whites Dulux lists as favourites are the popular colours');
assert.equal(searchColours('Snowy Mountains Quarter')[0].code, 'SW1G3', 'a colour published only in the Dulux atlas is available');
assert(whitesAndNeutrals.every(colour => colour.groups.includes('whites') || colour.groups.includes('neutrals')));
assert(coloursInGroup('popular', builderColourIds('Dulux Wash & Wear, Lexicon Quarter to walls')).some(colour => colour.id === lexiconQuarter.id), 'a colour named in the Standard Inclusions is a builder colour');
assert(/indicative only/.test(COLOUR_DISCLAIMER) && /physical colour sample/.test(COLOUR_DISCLAIMER));
pass('search by name and code, colour families, builder colours, disclaimer');

// Colours are a colour library, never Product Library products.
const products = getMasterProducts();
assert(!products.some(product => /natural white|lexicon|vivid white|domino/i.test(`${product.productName} ${product.colour || ''}`) && /dulux/i.test(product.manufacturer || '') && /colour/i.test(product.familyKey || '')), 'no colour is a priced product');
assert(!products.some(product => String(product.productCode || '').startsWith('dulux-') && DULUX_COLOURS.some(colour => colour.id === product.productCode)));
pass('no Dulux colour exists as a Product Library product');

// ---- House scheme ----
const inclusions = { selectedPackageId: 'p1', sections: [
  { title: 'Painting', package_id: 'p1', bullets: ['Dulux paint throughout', 'Walls: builder standard colour range in low sheen', 'Ceilings: flat white', 'Trim and doors: standard white, gloss enamel', 'External walls: Weathershield low sheen'] },
  { title: 'Painting', package_id: 'other', bullets: ['Walls: matt'] }, { title: 'Flooring', bullets: ['Carpet to bedrooms'] }] };
const baseline = paintInclusionBaseline(inclusions);
assert.equal(baseline.manufacturer, 'Dulux'); assert.equal(baseline.lines.length, 4, 'internal lines of the selected package only');
assert.deepEqual(baseline.finishes, { walls: 'Low Sheen', trims: 'Gloss Enamel', ceilings: 'Flat' });
assert.deepEqual(paintInclusionBaseline().finishes, { walls: 'Low Sheen', trims: 'Semi Gloss', ceilings: 'Flat' }, 'builder defaults without inclusions');

let scheme = normaliseInternalPaintScheme(null, baseline);
assert.deepEqual(internalPaintSchemeStatus(scheme), { required: PAINT_COLOUR_SURFACES.map(surface => ({ key: surface.key, label: surface.label, done: false })), ready: false, complete: false, chosen: 0 });
scheme = setHouseColour(scheme, 'walls', naturalWhite, baseline);
assert.deepEqual(scheme.defaults.walls, { manufacturer: 'Dulux', colourId: naturalWhite.id, colourName: 'Natural White™', colourCode: 'SW1F4', hex: naturalWhite.hex, finish: 'Low Sheen', sourceUrl: naturalWhite.sourceUrl });
assert.equal(confirmHouseScheme(scheme), scheme, 'cannot confirm before the three colours are chosen');
scheme = setHouseColour(setHouseColour(scheme, 'trims', vividWhite, baseline), 'ceilings', vividWhite, baseline);
assert.equal(scheme.defaults.trims.finish, 'Gloss Enamel'); assert.equal(scheme.defaults.ceilings.finish, 'Flat');
assert(internalPaintSchemeStatus(scheme).ready && !internalPaintSchemeStatus(scheme).complete);
scheme = confirmHouseScheme(scheme, '2026-10-05T00:00:00.000Z');
assert(internalPaintSchemeStatus(scheme).complete, 'complete with no feature walls and no overrides');
pass('one wall, trim and ceiling colour for the house; finishes from the inclusions; complete on confirmation');

// Feature wall: house default untouched, still complete.
const confirmedDefaults = JSON.stringify(scheme.defaults);
scheme = saveFeatureWall(scheme, { location: 'Master Bedroom', wall: 'Bedhead Wall', notes: 'Behind the bed', colour: domino }, baseline);
assert.equal(scheme.featureWalls.length, 1); assert.equal(scheme.featureWalls[0].choice.colourName, 'Domino');
assert.equal(JSON.stringify(scheme.defaults), confirmedDefaults); assert(internalPaintSchemeStatus(scheme).complete);
scheme = saveFeatureWall(scheme, { location: 'Study', wall: 'Window wall', colour: lexiconQuarter }, baseline);
scheme = saveFeatureWall(scheme, { id: scheme.featureWalls[1].id, location: 'Study', wall: 'Desk wall', colour: lexiconQuarter }, baseline);
assert.deepEqual(scheme.featureWalls.map(wall => wall.wall), ['Bedhead Wall', 'Desk wall'], 'several feature walls; editing one replaces it');
assert.equal(saveFeatureWall(scheme, { location: 'Study', wall: '', colour: domino }), scheme, 'a feature wall needs a description');
scheme = removeFeatureWall(scheme, scheme.featureWalls[1].id);
// Room override: only that room and that surface change.
scheme = setRoomOverride(scheme, 'Media Room', 'walls', domino, baseline);
assert.equal(JSON.stringify(scheme.defaults), confirmedDefaults); assert(internalPaintSchemeStatus(scheme).complete);
const media = resolveRoomColours(scheme, 'Media Room');
assert.equal(media.walls.choice.colourName, 'Domino'); assert(media.walls.overridden);
assert.equal(media.trims.choice.colourName, 'Vivid White™'); assert(!media.trims.overridden && !media.ceilings.overridden);
const bedroom = resolveRoomColours(scheme, 'Bedroom 2');
assert.equal(bedroom.walls.choice.colourName, 'Natural White™'); assert(!bedroom.walls.overridden);
assert.equal(resolveRoomColours(setRoomOverride(scheme, 'Media Room', 'walls', null), 'Media Room').walls.overridden, false, 'an override can be returned to the house default');
// Changing a house colour needs confirming again; the room keeps its own colour.
const changed = setHouseColour(scheme, 'walls', lexiconQuarter, baseline);
assert(!internalPaintSchemeStatus(changed).complete); assert.equal(resolveRoomColours(changed, 'Media Room').walls.choice.colourName, 'Domino');
assert(internalPaintSchemeStatus(setHouseColour(scheme, 'walls', naturalWhite, baseline)).complete, 're-selecting the same colour keeps the confirmation');
pass('feature walls and room overrides never alter the house default or completion');

assert.deepEqual(paintableRoomNames(['External Walls', 'Roof', 'Windows', 'Garage', 'Kitchen', 'Bedroom 1', 'Electrical', 'Lighting', 'Paint', 'External', 'Media Room', 'Kitchen', '']), ['Garage', 'Kitchen', 'Bedroom 1', 'Media Room'], 'only rooms are offered');
// Stored and re-read, including a job saved by the earlier paint screen.
const stored = JSON.parse(JSON.stringify(storedInternalPaintScheme(scheme, '2026-10-05T01:00:00.000Z')));
assert.equal(stored.defaults.doors.colourName, 'Vivid White™'); assert.equal(stored.defaults.skirting.colourName, 'Vivid White™');
const reread = normaliseInternalPaintScheme(stored);
assert.deepEqual(reread.defaults, scheme.defaults); assert.deepEqual(reread.overrides, scheme.overrides); assert.deepEqual(reread.featureWalls, scheme.featureWalls); assert(reread.confirmed);
const legacy = normaliseInternalPaintScheme({ schemaVersion: 1, confirmed: true, defaults: {
  walls: { productCode: 'DLX-WW', colourId: naturalWhite.id, finish: 'Matt', colourSnapshot: { id: naturalWhite.id, name: 'Natural White™', code: 'SW1F4', hex: '#eeece5', manufacturer: 'Dulux' } },
  doors: { productCode: 'DLX-AQ', colourName: 'Vivid White™', colourCode: 'SW1G1', hex: '#f7f8f4', finish: 'Gloss' }, ceilings: { colourName: 'Vivid White™', finish: 'Flat' } },
  overrides: [{ surface: 'skirting', location: 'Study', choice: { colourName: 'Domino', colourCode: 'SG6G8', hex: '#3c3e3f', finish: 'Gloss' } }], featureWalls: [{ id: 'Study:North', location: 'Study', wall: 'North', choice: { colourName: 'Domino' } }] });
assert.equal(legacy.defaults.walls.colourName, 'Natural White™'); assert.equal(legacy.defaults.walls.finish, 'Matt'); assert.equal(legacy.defaults.trims.colourCode, 'SW1G1');
assert.equal(legacy.overrides[0].surface, 'trims'); assert.equal(legacy.featureWalls[0].wall, 'North'); assert(internalPaintSchemeStatus(legacy).complete);
pass('saved scheme re-reads identically; a job saved by the earlier paint screen still opens');

// Schedule lines: what the client, builder, painter and supervisor read.
const lines = internalPaintScheduleLines(scheme);
assert.deepEqual(lines.map(line => `${line.label} | ${line.choice.manufacturer} ${line.choice.colourName} | ${line.choice.finish}`), [
  'Main Walls | Dulux Natural White™ | Low Sheen', 'Trims & Internal Doors | Dulux Vivid White™ | Gloss Enamel', 'Ceilings | Dulux Vivid White™ | Flat',
  'Media Room - Walls | Dulux Domino | Low Sheen', 'Feature wall - Master Bedroom - Bedhead Wall | Dulux Domino | Low Sheen']);
pass('schedule lists house colours, room overrides and feature walls with finish');

// ---- Quotation Builder: specification only ----
const book = { rooms: [{ id: 'guided-interior', name: 'Interior', rows: [{ id: 'r1', guidedRequirementKey: 'interior-paint', guidedSelection: { requirementKey: 'interior-paint', paintScheme: stored } }] }] };
const workbook = { quotation: {
  'PAINTER (142)': { rows: [
    { id: 'q1', item: 'GENERAL PAINTING - INTERIOR LOWER', unit: 'M2', qty: 412.5, excelRate: 18.5, manualRate: '', cost: 7631.25 },
    { id: 'q2', item: 'GENERAL PAINTING - INTERIOR UPPER', unit: 'M2', qty: 0, excelRate: 18.5, selectionSpec: 'Painter to confirm' },
    { id: 'q3', item: 'EXTERIOR CLADDING LOWER LEVEL', unit: 'M2', qty: 120, excelRate: 22 },
    { id: 'q4', item: 'PATIO CEILINGS ETC', unit: 'M2', qty: 30, excelRate: 20 },
    { id: 'q5', item: 'EAVES', unit: 'LM', qty: 60, excelRate: 9 },
    { id: 'q6', item: 'Internal ceilings', unit: 'M2', qty: 200, excelRate: 12 }] },
  ELECTRICAL: { rows: [{ id: 'e1', item: 'Internal wall lights', qty: 4, excelRate: 90 }] } } };
const linked = linkInternalPaintColoursToQuotation(workbook, book);
const before = workbook.quotation['PAINTER (142)'].rows, after = linked.quotation['PAINTER (142)'].rows;
assert.equal(after.length, before.length, 'no quotation row is added');
for (const [index, row] of after.entries()) for (const field of ['id', 'item', 'unit', 'qty', 'excelRate', 'manualRate', 'cost']) assert.deepEqual(row[field], before[index][field], `${row.id}.${field} unchanged`);
assert.equal(after[0].selectionSpec, 'Walls: Dulux Natural White™ (SW1F4) - Low Sheen; Trims & doors: Dulux Vivid White™ (SW1G1) - Gloss Enamel; Ceilings: Dulux Vivid White™ (SW1G1) - Flat');
assert.deepEqual(after[0].paintColourSpecification.roomOverrides, [{ location: 'Media Room', surface: 'walls', text: 'Dulux Domino (SG6G8)' }]);
assert.deepEqual(after[0].paintColourSpecification.featureWalls, [{ location: 'Master Bedroom', wall: 'Bedhead Wall', text: 'Dulux Domino (SG6G8)' }]);
assert.equal(after[1].selectionSpec, 'Painter to confirm', 'a specification someone typed is kept'); assert(after[1].paintColourSpecification);
for (const index of [2, 3, 4]) assert.equal(after[index], before[index], 'external, patio and eaves lines are untouched');
assert.deepEqual(after[5].paintColourSpecification.surfaces.map(item => item.surface), ['ceilings']); assert.deepEqual(after[5].paintColourSpecification.featureWalls, []);
assert.equal(linked.quotation.ELECTRICAL, workbook.quotation.ELECTRICAL, 'other sections untouched');
assert.equal(linkInternalPaintColoursToQuotation(linked, book), linked, 'linking again changes nothing');
// A changed colour replaces the text it wrote; clearing the scheme removes it and nothing else.
const rebooked = { rooms: [{ ...book.rooms[0], rows: [{ ...book.rooms[0].rows[0], guidedSelection: { requirementKey: 'interior-paint', paintScheme: storedInternalPaintScheme(setHouseColour(scheme, 'walls', lexiconQuarter, baseline)) } }] }] };
assert(linkInternalPaintColoursToQuotation(linked, rebooked).quotation['PAINTER (142)'].rows[0].selectionSpec.startsWith('Walls: Dulux Lexicon® Quarter (SW1E1)'));
const cleared = linkInternalPaintColoursToQuotation(linked, { rooms: [] }).quotation['PAINTER (142)'].rows;
assert.deepEqual(cleared[0], before[0]); assert.deepEqual(cleared[1], before[1]);
assert.equal(linkInternalPaintColoursToQuotation(workbook, { rooms: [] }), workbook);
pass('colours attach to the existing painting lines as a specification; rows, quantities and rates are unchanged');
// ---- Standard ceiling: Dulux Ceiling White unless the builder says otherwise ----
const { paintBaselineWithStandards } = await import('../lib/builders/paintStandards.js');
const { DULUX_CEILING_WHITE, colourNamedIn } = await import('../lib/builders/duluxColourLibrary.js');
const { choiceSwatch, isStandardCeiling, resetCeilingToStandard, standardCeilingChoice } = await import('../lib/builders/internalPaintColours.js');
const paintRecord = JSON.parse(fs.readFileSync('data/product-library/catalogues/residential/AU-DULUX-PAINT.json', 'utf8')).products.find(product => product.productCode === 'DULUX-615D0115');
assert.equal(DULUX_CEILING_WHITE.name, paintRecord.range); assert.equal(DULUX_CEILING_WHITE.finish, paintRecord.finish); assert.equal(DULUX_CEILING_WHITE.sourceUrl, paintRecord.officialProductUrl);
assert.equal(DULUX_CEILING_WHITE.manufacturer, 'Dulux'); assert.equal(`${DULUX_CEILING_WHITE.name} / ${DULUX_CEILING_WHITE.finish}`, 'Ceiling White / Flat');
assert.equal(DULUX_CEILING_WHITE.code, ''); assert.equal(DULUX_CEILING_WHITE.hex, '', 'no colour code or swatch value is invented for a ready-mixed white');
assert(!DULUX_COLOURS.some(colour => colour.id === DULUX_CEILING_WHITE.id), 'Ceiling White is a standard specification, not an entry in the colour atlas');
assert.equal(findColour('dulux-ceiling-white'), DULUX_CEILING_WHITE);
pass('Dulux Ceiling White (Flat) is read from the imported Dulux record');

// Source priority: Standard Inclusions, then the builder's paint defaults, then Dulux Ceiling White.
const standardOf = inclusions => { const standard = paintBaselineWithStandards(inclusions).standards.ceilings; return `${standard.colour.name} | ${standard.finish} | ${standard.source} | ${standard.label}`; };
assert.equal(standardOf({}), 'Ceiling White | Flat | default | Standard');
assert.equal(standardOf({ sections: [{ title: 'Painting', bullets: ['Internal wall paint system', 'Ceiling paint system', 'Standard colour allowance'] }] }), 'Ceiling White | Flat | default | Standard', 'an inclusion line that names no colour does not set one');
assert.equal(standardOf({ sections: [{ title: 'Painting', bullets: ['Ceilings: Dulux Ceiling White, flat'] }] }), 'Ceiling White | Flat | inclusions | Standard Inclusion');
assert.equal(standardOf({ sections: [{ title: 'Painting', bullets: ['Walls: Lexicon Quarter low sheen. Ceilings: Vivid White, matt'] }] }), 'Vivid White™ | Matt | inclusions | Standard Inclusion', 'the ceiling part of a line decides the ceiling');
assert.equal(standardOf({ paintScheme: { defaults: { ceilings: { colourId: lexiconQuarter.id } } } }), 'Lexicon® Quarter | Flat | builder | Builder standard');
assert.equal(standardOf({ paintScheme: { defaults: { ceilings: { colourId: lexiconQuarter.id } } }, sections: [{ title: 'Painting', bullets: ['Ceilings: Dulux Ceiling White'] }] }), 'Ceiling White | Flat | inclusions | Standard Inclusion', 'Standard Inclusions come first');
assert.equal(colourNamedIn('walls in dulux lexicon quarter'), lexiconQuarter); assert.equal(colourNamedIn('two coats flat acrylic'), null);
pass('standard ceiling: Standard Inclusions, then builder paint defaults, then Dulux Ceiling White');

// A fresh project: ceilings already selected, 1 of 3, and it counts.
const withStandards = paintBaselineWithStandards({});
let fresh = normaliseInternalPaintScheme(null, withStandards);
assert.deepEqual(fresh.defaults.ceilings, { manufacturer: 'Dulux', colourId: 'dulux-ceiling-white', colourName: 'Ceiling White', colourCode: '', hex: '', finish: 'Flat',
  sourceUrl: 'https://www.dulux.com.au/paint/ceiling/ceiling-white/', displaySwatch: '#ffffff', standard: true, standardSource: 'default' });
assert.equal(choiceSwatch(fresh.defaults.ceilings), '#ffffff'); assert.equal(choiceSwatch(fresh.defaults.walls), '');
assert.equal(internalPaintSchemeStatus(fresh).chosen, 1); assert(!internalPaintSchemeStatus(fresh).ready); assert(isStandardCeiling(fresh, withStandards));
fresh = setHouseColour(setHouseColour(fresh, 'walls', naturalWhite, withStandards), 'trims', vividWhite, withStandards);
assert.equal(internalPaintSchemeStatus(fresh).chosen, 3); assert(internalPaintSchemeStatus(fresh).ready, 'walls and trims are all the client has to choose');
fresh = confirmHouseScheme(fresh);
assert(internalPaintSchemeStatus(fresh).complete);
// Client override, then reset to standard.
const overridden = setHouseColour(fresh, 'ceilings', lexiconQuarter, withStandards);
assert.equal(overridden.defaults.ceilings.colourName, 'Lexicon® Quarter'); assert.equal(overridden.defaults.ceilings.finish, 'Flat'); assert(!isStandardCeiling(overridden, withStandards));
assert.equal(overridden.defaults.ceilings.standard, undefined); assert(!internalPaintSchemeStatus(overridden).complete, 'a changed house colour is confirmed again');
const reset = resetCeilingToStandard(overridden, withStandards);
assert.deepEqual(reset.defaults.ceilings, fresh.defaults.ceilings); assert(isStandardCeiling(reset, withStandards));
assert.deepEqual([reset.defaults.walls, reset.defaults.trims], [fresh.defaults.walls, fresh.defaults.trims], 'reset touches the ceiling only');
assert(isStandardCeiling(setHouseColour(overridden, 'ceilings', DULUX_CEILING_WHITE, withStandards), withStandards), 'choosing the standard colour by hand is the standard');
// Stored and re-read: both states persist.
for (const state of [fresh, overridden]) assert.deepEqual(normaliseInternalPaintScheme(JSON.parse(JSON.stringify(storedInternalPaintScheme(state))), withStandards).defaults, state.defaults);
// Existing jobs: no ceiling recorded takes the standard; a ceiling the client chose is never replaced.
const existingWithout = normaliseInternalPaintScheme({ schemaVersion: 2, confirmed: false, defaults: { walls: fresh.defaults.walls, trims: fresh.defaults.trims, ceilings: null } }, withStandards);
assert.equal(existingWithout.defaults.ceilings.colourName, 'Ceiling White'); assert.equal(existingWithout.defaults.walls.colourName, 'Natural White™');
const existingChosen = normaliseInternalPaintScheme({ schemaVersion: 2, defaults: { ceilings: { colourId: vividWhite.id, colourName: 'Vivid White™', colourCode: 'SW1G1', hex: vividWhite.hex, finish: 'Flat' } } }, withStandards);
assert.equal(existingChosen.defaults.ceilings.colourName, 'Vivid White™'); assert(!isStandardCeiling(existingChosen, withStandards));
assert.equal(standardCeilingChoice(paintInclusionBaseline()), null, 'without a builder standard nothing is defaulted');
// Schedule and quotation read a ceiling with no colour code cleanly.
assert.equal(internalPaintScheduleLines(fresh).find(line => line.surface === 'ceilings' && line.kind === 'house').choice.colourName, 'Ceiling White');
const ceilingBook = { rooms: [{ rows: [{ guidedRequirementKey: 'interior-paint', guidedSelection: { requirementKey: 'interior-paint', paintScheme: storedInternalPaintScheme(fresh) } }] }] };
assert.equal(linkInternalPaintColoursToQuotation({ quotation: { PAINTER: { rows: [{ id: 'c', item: 'Internal ceilings', qty: 200, excelRate: 12 }] } } }, ceilingBook).quotation.PAINTER.rows[0].selectionSpec, 'Ceilings: Dulux Ceiling White - Flat');
pass('ceilings default to the standard, count towards completion, can be overridden and reset, and persist');
console.log('\nInternal paint colours: all checks passed');
