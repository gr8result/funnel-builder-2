const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const value = (row) => row.quantity ?? row.lengthM ?? row.netAreaM2 ?? '';
const trace = (row) => [
  row.level || row.floor || '',
  row.planSheet || row.page ? `Sheet ${row.planSheet || row.page}` : '',
  row.itemId || '',
].filter(Boolean).join(' · ');

function table(title, rows = []) {
  const body = rows.length
    ? rows.map((row) => `<tr class="${row.reviewRequired ? 'review' : ''}">
        <td>${escapeHtml(row.category || row.wallType || row.label)}</td>
        <td>${escapeHtml(value(row))}</td>
        <td>${escapeHtml(row.unit || '')}</td>
        <td>${escapeHtml(row.commercialStatus || (row.reviewRequired ? 'Review required' : 'Measured'))}</td>
        <td>${escapeHtml(trace(row))}</td>
        <td>${escapeHtml(row.notes || '')}</td>
      </tr>`).join('')
    : '<tr><td colspan="6">No measured items.</td></tr>';
  return `<section><h2>${escapeHtml(title)}</h2><table><thead><tr><th>Item</th><th>Quantity</th><th>Unit</th><th>Status</th><th>Source</th><th>Evidence / calculation</th></tr></thead><tbody>${body}</tbody></table></section>`;
}

export function buildProfessionalTakeoffReportHtml(schedule) {
  const totals = schedule?.projectTotals || {};
  const review = buildTakeoffReview({
    records: schedule?.measurementRecords || [],
    analysis: schedule?.aiAnalysis,
    jobSetupRows: schedule?.jobSetupRows,
  });
  const pendingRows = [
    ...(totals.floorAreas || []),
    ...(totals.rooms || []),
    ...(totals.wallRecords || []),
    ...(totals.windows || []),
    ...(totals.doors || []),
  ].filter((row) => row.reviewRequired);
  const project = schedule?.project || {};
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(project.projectName || 'Takeoff')} — Commercial Takeoff Report</title>
  <style>
    @page{size:A4 landscape;margin:12mm}body{font-family:Arial,sans-serif;color:#111827;font-size:10px}h1{font-size:22px;margin:0}h2{font-size:14px;margin:18px 0 6px;border-bottom:2px solid #0f766e;padding-bottom:4px}.meta,.quality{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.card{border:1px solid #cbd5e1;border-radius:4px;padding:8px}.fail{background:#fff7ed;border-color:#f97316}table{width:100%;border-collapse:collapse;page-break-inside:auto}tr{page-break-inside:avoid}th,td{border:1px solid #cbd5e1;padding:4px;text-align:left;vertical-align:top}th{background:#e2e8f0}.review td{background:#fff7ed}.footer{margin-top:16px;color:#475569}
  </style></head><body>
  <header><h1>Commercial Takeoff Report</h1><p>Measured quantities with source trace and approval status.</p></header>
  <div class="meta">
    <div class="card"><strong>Project</strong><br>${escapeHtml(project.projectName || '—')}</div>
    <div class="card"><strong>Client</strong><br>${escapeHtml(project.clientName || '—')}</div>
    <div class="card"><strong>Site</strong><br>${escapeHtml(project.siteAddress || '—')}</div>
    <div class="card"><strong>Plan</strong><br>${escapeHtml(project.planFilename || '—')} (${escapeHtml(project.numberOfPlanSheets || 0)} sheets)</div>
  </div>
  <div class="quality">
    <div class="card ${pendingRows.length ? 'fail' : ''}"><strong>Unapproved measured rows</strong><br>${pendingRows.length}</div>
    <div class="card ${review.decisions.length ? 'fail' : ''}"><strong>Required review decisions</strong><br>${review.decisions.length}</div>
    <div class="card"><strong>Generated</strong><br>${escapeHtml(schedule.generatedAt || '')}</div>
    <div class="card"><strong>Commercial rule</strong><br>Only approved quantities may transfer to pricing.</div>
  </div>
  ${table('Required review actions', review.decisions.map((decision) => ({
    category: decision.title,
    commercialStatus: 'Blocking',
    planSheet: decision.pages?.join(', '),
    itemId: decision.id,
    notes: decision.detail,
    reviewRequired: true,
  })))}
  ${table('Floor and building areas', totals.floorAreas)}
  ${table('Room-by-room floor and ceiling areas', totals.rooms)}
  ${table('Individual wall runs', totals.wallRecords)}
  ${table('External wall systems', totals.exteriorWalls)}
  ${table('Internal walls and plasterboard', totals.interiorWallsAndPlasterboard)}
  ${table('Windows', totals.windows)}
  ${table('Doors', totals.doors)}
  ${table('Floor finishes and wet areas', totals.floorFinishes)}
  ${table('Roof areas', totals.roofAreas)}
  ${table('Roof and eaves', totals.roofAndEaves)}
  ${table('Custom takeoffs and drawing evidence', totals.customTakeoffs)}
  <p class="footer">Review every orange row before quotation. Item IDs and sheet references trace each quantity to its measured source.</p>
  </body></html>`;
}
import { buildTakeoffReview } from './ai-integration/reviewSummary.js';
