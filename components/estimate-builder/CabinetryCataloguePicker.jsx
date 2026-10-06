import { useState } from 'react';
import { cabinetryApplies } from '../../lib/construction-estimation/finalCabinetryQuotation.js';

import { FINAL_CABINETRY } from '../../lib/construction-estimation/finalCabinetryQuotation.js';
const productsSource = FINAL_CABINETRY.rows.filter(row => row.type === 'product').map(row => ({quotation_section:row.room, finish_range:row.range, import_key:row.key || row.key || `final-cabinetry:${row.sourceRow}`, product_name:row.description, price:row.price, unit:row.unit}));

export default function CabinetryCataloguePicker({ workspaceId, onAdd }) {
  const [section, setSection] = useState('KITCHEN CABINETRY');
  const [finish, setFinish] = useState('');
  const [key, setKey] = useState('');
  const [message, setMessage] = useState('');
  if (!cabinetryApplies(workspaceId)) return null;
  const rows = productsSource.filter(r => r.quotation_section === section);
  const products = rows.filter(r => !finish || r.finish_range === finish);
  return <details data-testid="cabinetry-replacement-picker" style={{ padding: 12, border: '1px solid #cbd5e1', borderRadius: 8 }}>
    <summary>Cabinetry, benchtops &amp; wardrobes catalogue — {productsSource.length} products</summary>
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingTop: 12 }}>
      <label>Room / group <select aria-label="Cabinetry catalogue section" value={section} onChange={e => { setSection(e.target.value); setFinish(''); setKey(''); setMessage(''); }}>{[...new Set(productsSource.map(row => row.quotation_section))].map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Finish range <select aria-label="Cabinetry finish range" value={finish} onChange={e => { setFinish(e.target.value); setKey(''); }}><option value="">All ranges</option>{[...new Set(rows.map(r => r.finish_range))].map(f => <option key={f}>{f}</option>)}</select></label>
      <label>Product <select aria-label="Cabinetry catalogue product" value={key} onChange={e => setKey(e.target.value)}><option value="">Choose product</option>{products.map(r => <option key={r.import_key} value={r.import_key}>{r.finish_range} — {r.product_name} — ${r.price.toFixed(2)} / {r.unit}</option>)}</select></label>
      <button type="button" disabled={!key} style={{ padding: '10px 16px', borderRadius: 6, background: '#0f766e', color: '#fff', fontWeight: 700, opacity: key ? 1 : 0.5, cursor: key ? 'pointer' : 'default' }} onClick={() => { onAdd(key); setMessage('Product available in the Cabinetry section. Existing quantities and prices are preserved.'); }}>Add to quotation</button>
    </div>
    <p>Approved final cabinetry allowances. Quantities come from the job. Benchtop widths and extras retain their imported units.</p>
    {message && <p role="status">{message}</p>}
  </details>;
}
