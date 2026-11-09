import fs from 'node:fs';

// Line-by-line audit of the quotation changes a Client Selections save proposes (read-only).
//   node scripts/audit-selection-quotation-changes.mjs <proposed-reconciliation.json> <stored-workbook.json> <out.md> [out.json]
// proposed-reconciliation.json: captured by accept-client-selections-real-pdf.mjs (impact, proposedQuotation, plan).
// stored-workbook.json: the job as stored (its quotation is the current, approved one).
const [proposedPath, storedPath, outMd, outJson] = process.argv.slice(2);
const proposed = JSON.parse(fs.readFileSync(proposedPath, 'utf8'));
const stored = JSON.parse(fs.readFileSync(storedPath, 'utf8'));
const rowsById = (quotation) => { const map = new Map(); for (const [section, group] of Object.entries(quotation || {})) for (const row of group.rows || []) if (!map.has(row.id)) map.set(row.id, { section, row }); return map; };
const before = rowsById(stored.quotation);
const after = rowsById(proposed.proposedQuotation);
const plan = new Map((proposed.plan?.changes || []).map((change) => [change.rowId, change]));
const money = (value) => (Number(value) || 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD' });
const SELECTION_ROW = /^(allocated-selection|appliance-selection|electrical-schedule|tiling:|flooring:|client-selections-|external-lighting:|entry-door-furniture:|quotation-subheading:)/;

function classify(change) {
  const old = before.get(change.rowId)?.row || {};
  const next = after.get(change.rowId)?.row || {};
  const planned = plan.get(change.rowId);
  const selectionRow = SELECTION_ROW.test(change.rowId) || /client-selection/.test(String(next.source || old.source || ''));
  const mapped = Boolean(next.requirementKey && next.selectionMappingSource);
  const delta = Number(change.delta) || 0;
  if (/^tiling:.*:from-tiling-/.test(change.rowId) || (/^tiling:.*waste/.test(change.rowId) && planned?.kind !== 'ADDED' && Math.abs(delta) <= 60)) return { group: 'Quotation correction (duplicate charge consolidated)', reason: 'Duplicate floor-waste row: its charge moves onto the room’s single waste line (net $0 per room).' };
  if (selectionRow && /^electrical-schedule:location-(pantry|butler-s-pantry)/.test(change.rowId)) return { group: 'Room correction (net $0)', reason: 'Pantry merged into Butler’s Pantry (confirmed 2026-10-25): the same points move to the canonical room.' };
  if (selectionRow) {
    const kind = planned?.kind || (change.before.quantity ? 'UPDATED' : 'ADDED');
    if (/OR001|191526/.test(change.rowId)) return { group: 'Client selection: confirmed removal', reason: 'Product removed by the builder’s confirmed correction (2026-10-25).' };
    if (/labour-/.test(change.rowId)) return { group: 'Client selection: tiling labour now priced', reason: `Tiling labour line for a selected tiled room; rate ${money(change.before.rate)} → ${money(change.after.rate)} per unit (builder labour rate applied to a client-selected tiling scope).` };
    if (!change.before.quantity && change.after.quantity) return { group: 'Client selection: new line priced', reason: `${kind}: client selection now on the quotation (${next.selectedProductName || next.item || change.item}).` };
    return { group: 'Client selection: updated', reason: `${kind}: ${planned?.quantity ? `quantity ${planned.quantity.before || 0} → ${planned.quantity.after || 0} (${planned.quantity.source || ''})` : 'quantity/rate updated from the selection'}.` };
  }
  if (mapped) return { group: 'Mapped builder line (selection replaces it)', reason: `Mapped to requirement "${next.requirementKey}" (${next.selectionMappingSource}); selected ${next.selectedProductName || next.selectedProductId || ''}; selection status ${next.selectionStatus || ''}.` };
  if (delta === 0) return { group: 'No financial change', reason: planned ? `${planned.kind}: ${planned.quantity?.pending ? 'quantity still pending' : 'no value change'}` : 'Structure only.' };
  return { group: 'NOT a client selection: builder construction cost changed', reason: next.progressAllocationHistory?.length ? `Quotation Builder migration: ${next.progressAllocationHistory.at(-1).reason}.` : 'Changed outside the selection plan.' };
}

const lines = proposed.impact.rowChanges.map((change) => {
  const old = before.get(change.rowId)?.row || {};
  const next = after.get(change.rowId)?.row || {};
  const { group, reason } = classify(change);
  return {
    section: change.section, rowId: change.rowId, item: change.item || next.item || old.item || '',
    selection: next.selectedProductName || next.activeProductName || next.productName || '', productId: next.selectedProductId || next.productId || next.activeProductId || '',
    mapping: next.selectionMappingSource || next.source || '', requirementKey: next.requirementKey || old.requirementKey || '',
    before: change.before, after: change.after, delta: Number(change.delta) || 0, group, reason,
  };
});
const groups = new Map();
for (const line of lines) { const entry = groups.get(line.group) || { lines: 0, delta: 0 }; entry.lines += 1; entry.delta += line.delta; groups.set(line.group, entry); }
const total = (filter) => lines.filter(filter).reduce((sum, line) => sum + line.delta, 0);
const unrelated = total((line) => line.group.startsWith('NOT a client selection'));
const md = [
  `# Client Selections quotation change audit`, '',
  `Current approved quotation total: **${money(proposed.impact.before)}**. Proposed by the save: **${money(proposed.impact.after)}** (${money(proposed.impact.delta)}, ${lines.length} lines).`, '',
  '| Group | Lines | Difference |', '|---|---:|---:|',
  ...[...groups].sort((a, b) => Math.abs(b[1].delta) - Math.abs(a[1].delta)).map(([group, entry]) => `| ${group} | ${entry.lines} | ${money(entry.delta)} |`), '',
  `Excluding changes that are not client selections (${money(unrelated)}): **${money(proposed.impact.after - unrelated)}**.`, '',
  '| # | Section | Line | Selection / product | Mapping | Before (qty × rate = total) | After | Difference | Group | Reason |', '|---:|---|---|---|---|---|---|---:|---|---|',
  ...lines.map((line, index) => `| ${index + 1} | ${line.section} | ${line.item.replace(/\|/g, '/')} \`${line.rowId}\` | ${(line.selection || '').replace(/\|/g, '/')} ${line.productId ? `\`${line.productId}\`` : ''} | ${line.mapping} | ${line.before.quantity} × ${money(line.before.rate)} = ${money(line.before.total)} | ${line.after.quantity} × ${money(line.after.rate)} = ${money(line.after.total)} | ${money(line.delta)} | ${line.group} | ${line.reason.replace(/\|/g, '/')} |`),
].join('\n');
fs.writeFileSync(outMd, md);
if (outJson) fs.writeFileSync(outJson, JSON.stringify({ before: proposed.impact.before, after: proposed.impact.after, delta: proposed.impact.delta, groups: Object.fromEntries(groups), lines }, null, 2));
console.log(md.split('\n').slice(0, 20).join('\n'));
