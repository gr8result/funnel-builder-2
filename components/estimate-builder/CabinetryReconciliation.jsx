import { useState } from 'react';
import { cabinetryApplies } from '../../lib/construction-estimation/finalCabinetryQuotation.js';
import { CABINETRY_MATCHED, cabinetryRequirementTypes, cabinetryRoomGroup, collectCabinetryRequirements } from '../../lib/construction-estimation/cabinetryRequirements.js';
import { CABINETRY_ROOMS } from '../../lib/builders/cabinetryRoomSelection.js';

const ROOMS = [...CABINETRY_ROOMS.map(room => room.label), 'Wardrobes'];
const cell = { padding: '6px 8px', borderBottom: '1px solid #e2e8f0', textAlign: 'left', verticalAlign: 'top' };

// Cabinetry requirements (what and how many) with their reconciliation against the quotation.
// Finish is never chosen here: it comes from Client Selections, then the Inclusion Schedule.
export default function CabinetryReconciliation({ workbook, readonly, onChange }) {
  const [draft, setDraft] = useState({ room: 'Kitchen', type: '', quantity: '' });
  if (!cabinetryApplies(workbook.workspaceId)) return null;
  const requirements = collectCabinetryRequirements(workbook);
  const { entries = [], summary = { total: 0, matched: 0, unmatched: 0, selectionRequired: 0 } } = workbook.cabinetryReconciliation || {};
  const explicit = workbook.cabinetryRequirements?.items || [];
  const quoteQuantity = Object.fromEntries((workbook.quotation?.CABINETRY?.rows || []).filter(row => row.importKey).map(row => [row.importKey, row.quantity]));
  const types = cabinetryRequirementTypes(cabinetryRoomGroup(draft.room));
  const quantity = Number(draft.quantity);
  return <details data-testid="cabinetry-reconciliation" style={{ padding: 12, border: '1px solid #cbd5e1', borderRadius: 8 }}>
    <summary>Cabinetry requirements — {summary.matched} matched, {summary.unmatched} unmatched{summary.selectionRequired ? ` — CABINETRY SELECTION REQUIRED (${summary.selectionRequired})` : ''}{summary.manualOverrides ? ` — MANUAL OVERRIDE (${summary.manualOverrides})` : ''}</summary>
    <p>Quantities come from the takeoff / Job Setup requirements below until a room&apos;s Cabinet Schedule in Client Selections sets the unit; that schedule then owns the quantity and the takeoff figure is kept as the baseline. The finish comes from Client Selections, then the Inclusion Schedule. A quantity typed on a linked quote row is kept and shown as MANUAL OVERRIDE.</p>
    {!readonly && <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
      <label>Room <select aria-label="Cabinetry requirement room" value={draft.room} onChange={event => setDraft({ room: event.target.value, type: '', quantity: '' })}>{ROOMS.map(room => <option key={room}>{room}</option>)}</select></label>
      <label>Requirement <select aria-label="Cabinetry requirement type" value={draft.type} onChange={event => setDraft({ ...draft, type: event.target.value })}><option value="">Choose type</option>{types.map(type => <option key={`${type.area}:${type.key}`} value={type.key}>{type.key}</option>)}</select></label>
      <label>Qty / LM <input aria-label="Cabinetry requirement quantity" type="number" min="0" step="any" value={draft.quantity} onChange={event => setDraft({ ...draft, quantity: event.target.value })} style={{ width: 90 }} /></label>
      <button type="button" disabled={!draft.type || !(quantity > 0)} onClick={() => { onChange([...explicit, { room: draft.room, type: draft.type, quantity, source: 'JOB_SETUP' }]); setDraft({ ...draft, type: '', quantity: '' }); }}>Add requirement</button>
    </div>}
    {requirements.length > 0 && <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
      <thead><tr>{['Takeoff requirement', 'Room', 'Type', 'Dimensions', 'Qty', 'Selected finish', 'Matched quote row', 'Quote Qty', 'Status', ''].map(heading => <th key={heading} style={cell}>{heading}</th>)}</tr></thead>
      <tbody>{requirements.map(requirement => {
        const entry = entries.find(item => item.requirementId === requirement.id) || {};
        const removable = !readonly && explicit.some(item => item.id === requirement.id);
        return <tr key={requirement.id} data-cabinetry-requirement={requirement.id} data-cabinetry-status={entry.status || ''}>
          <td style={cell}>{requirement.source}{requirement.planReference ? ` · ${requirement.planReference}` : ''}</td>
          <td style={cell}>{requirement.room}</td>
          <td style={cell}>{entry.label || requirement.legacyLabel || requirement.type}{entry.type && entry.label ? <div style={{ color: '#64748b' }}>{entry.type}</div> : null}</td>
          <td style={cell}>{entry.dimensions || ''}</td>
          <td style={cell}>{requirement.quantity}</td>
          <td style={cell}>{entry.selectedFinish || ''}{entry.finishSource ? ` (${entry.finishSource})` : ''}</td>
          <td style={cell}>{entry.matchedQuoteRow || ''}</td>
          <td style={cell}>{entry.matchedImportKey ? quoteQuantity[entry.matchedImportKey] ?? '' : ''}</td>
          <td style={{ ...cell, fontWeight: 700, color: entry.status === CABINETRY_MATCHED ? '#166534' : '#b91c1c' }}>{entry.flag || entry.status || 'Pending'}{entry.reason ? <div style={{ fontWeight: 400 }}>{entry.reason}</div> : null}</td>
          <td style={cell}>{removable && <button type="button" aria-label={`Remove ${requirement.type} from ${requirement.room}`} onClick={() => onChange(explicit.filter(item => item.id !== requirement.id))}>Remove</button>}</td>
        </tr>;
      })}</tbody>
    </table>}
  </details>;
}
