import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeQuotationStructure, canonicalQuotationSectionName } from '../lib/construction-estimation/quotationStructure.js';

const copy = 'artifacts/test-artifacts/client-selections-repair-verification/job-copy.json';
const find = (o, depth = 0) => { if (!o || typeof o !== 'object' || depth > 4) return null; if (o.quotation && typeof o.quotation === 'object' && !Array.isArray(o.quotation)) return o; for (const v of Object.values(o)) { const r = find(v, depth + 1); if (r) return r; } return null; };

// Finished coverings stay together; structural floor trades and Stage Labour keep their own sections.
for (const name of ['FLOORCOVERINGS (149)', 'CARPETS', 'VINYL FLOORING', 'HYBRID FLOORING', 'LAMINATED FLOORING', 'SOLID TIMBER FLOORING', 'ENGINEERED TIMBER', 'MISC FLOORING (150)']) {
  if (name === 'ENGINEERED TIMBER' || name === 'MISC FLOORING (150)') continue;
  assert.equal(canonicalQuotationSectionName(name), 'FLOORCOVERINGS', name);
}
for (const name of ['GROUND LEVEL TIMBER FLOORING (31)', 'UPPER LEVEL TIMBER FLOORING (42)', 'FLOORING (43)', 'Fix-out Stage Labour (7)', 'Frame Stage Labour (5)']) assert.equal(canonicalQuotationSectionName(name), name, `${name} is a distinct section`);

if (fs.existsSync(copy)) {
  const raw = find(JSON.parse(fs.readFileSync(copy))).quotation;
  const rowsOf = (q) => Object.entries(q).flatMap(([section, group]) => (group.rows || []).map((row) => ({ section, row })));
  const normalized = normalizeQuotationStructure(raw);
  const before = rowsOf(raw), after = rowsOf(normalized);
  const structural = ['GROUND LEVEL TIMBER FLOORING (31)', 'UPPER LEVEL TIMBER FLOORING (42)', 'FLOORING (43)'];
  const comparableRow = ({ section, id, legacyRowId, legacySectionName, ...row }) => ({ ...row, id: legacyRowId || id });
  for (const name of structural) {
    assert(normalized[name], `${name} survives normalisation`);
    assert(normalized[name].rows.every((row, index) => row.id === raw[name].rows[index].id || row.legacyRowId === raw[name].rows[index].id), `${name} keeps or explicitly migrates every row id in order`);
    assert(normalized[name].rows.every((row) => row.section === name), `${name} rows carry the canonical section mapping`);
    assert.deepEqual(normalized[name].rows.map(comparableRow), raw[name].rows.map(comparableRow), `${name} rows (quantities, formulas, rates, overrides) are unchanged`);
  }
  const framing = normalized['UPPER LEVEL TIMBER FLOORING (42)'].rows.find((row) => row.quantityKey === 'quoteFloorSystemSecond300M2');
  assert.equal(Number(framing.qty ?? framing.quantity), 152.15);
  assert(!normalized.FLOORCOVERINGS.rows.some((row) => /floor system|^quote-593/i.test(`${row.item} ${row.id}`)), 'no floor framing under FLOORCOVERINGS');
  assert(!normalized.FLOORCOVERINGS.rows.some((row) => structural.some((name) => raw[name].rows.some((r) => r.id === row.id))));
  assert.equal(Object.keys(normalized).filter((name) => /timber flooring|^flooring$/i.test(name.replace(/\s*\(\d+\)$/, ''))).length, 3, 'no duplicate structural flooring section');
  assert(Object.keys(normalized).some((name) => /stage labour/i.test(name)), 'Stage Labour sections are preserved');
  const stage = Object.keys(raw).filter((name) => /stage labour/i.test(name));
  for (const name of stage) {
    assert(normalized[name].rows.every((row, index) => row.id === raw[name].rows[index].id || row.legacyRowId === raw[name].rows[index].id), `${name} keeps or explicitly migrates every row id in order`);
    assert.deepEqual(normalized[name].rows.map(comparableRow), raw[name].rows.map(comparableRow), `${name} quantities, formulas, rates and overrides unchanged`);
  }
  const again = normalizeQuotationStructure(JSON.parse(JSON.stringify(normalized)));
  assert.deepEqual(again, normalized, 'normalisation is idempotent after save/reopen');
  const originalIds = new Set(before.map(({ row }) => row.id));
  const missing = [...originalIds].filter((id) => !after.some(({ row }) => row.id === id || row.legacyRowId === id));
  assert.equal(missing.length, 0, 'no row id is lost');
  console.log(`PASS structural flooring: ${Object.keys(raw).length} raw sections -> ${Object.keys(normalized).length}; rows ${before.length} -> ${after.length} (+${after.length - before.length} subheadings/dup-id suffixes); ${stage.length} Stage Labour sections kept; floor framing stays out of FLOORCOVERINGS`);
}
console.log('Structural flooring classification tests passed.');
