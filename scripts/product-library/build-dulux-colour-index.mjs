import fs from 'node:fs/promises';

// Writes the compact colour index the Client Selections colour selector loads, from the full
// imported catalogue (AU-DULUX-COLOURS.json). The index carries only what a selector needs; the
// descriptions and import bookkeeping stay in the catalogue. No value is changed or invented here.
// Usage: node scripts/product-library/build-dulux-colour-index.mjs
const dir = 'data/product-library/catalogues/residential';
const catalogue = JSON.parse(await fs.readFile(`${dir}/AU-DULUX-COLOURS.json`, 'utf8'));
const origin = 'https://www.dulux.com.au';
const fields = ['id', 'name', 'code', 'hex', 'lrv', 'families', 'collection', 'popular', 'path'];
const rows = catalogue.colours
  .filter(colour => colour.id && colour.name && colour.code && /^#[0-9a-f]{6}$/i.test(colour.hex || '') && String(colour.sourceUrl || '').startsWith(origin))
  .map(colour => [colour.id, colour.name, colour.code, colour.hex.toLowerCase(), colour.lrv ?? null,
    (colour.families?.length ? colour.families : [colour.family]).filter(Boolean).join('|'), colour.collection || '', colour.isPopular ? 1 : 0,
    colour.sourceUrl.slice(origin.length)]);
// Dulux Ceiling White is a ready-mixed ceiling paint, not a tinted colour: Dulux publishes a product
// page for it but no colour code and no swatch value. It is carried as a standard specification,
// read from the imported paint record, so a ceiling can default to it without inventing a colour.
const paints = JSON.parse(await fs.readFile(`${dir}/AU-DULUX-PAINT.json`, 'utf8')).products;
const ceilingWhite = paints.find(product => product.range === 'Ceiling White' && product.productType === 'Ceiling Paint' && product.finish === 'Flat' && String(product.officialProductUrl || '').startsWith(origin));
if (!ceilingWhite) throw new Error('The imported Dulux paint catalogue has no Ceiling White (Flat) record.');
const standardSpecifications = { ceilingWhite: { id: 'dulux-ceiling-white', manufacturer: ceilingWhite.manufacturer, name: ceilingWhite.range, finish: ceilingWhite.finish,
  productCode: ceilingWhite.productCode, path: ceilingWhite.officialProductUrl.slice(origin.length) } };
await fs.writeFile(`${dir}/AU-DULUX-COLOUR-INDEX.json`, JSON.stringify({ manufacturer: 'Dulux', origin, importedAt: catalogue.atlasImportedAt || catalogue.importedAt, standardSpecifications, fields, rows }) + '\n');
console.log(JSON.stringify({ catalogue: catalogue.colours.length, indexed: rows.length, skipped: catalogue.colours.length - rows.length }));
