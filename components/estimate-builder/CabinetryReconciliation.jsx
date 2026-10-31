import { useState } from 'react';
import { cabinetryApplies } from '../../lib/construction-estimation/finalCabinetryQuotation.js';
import { CABINETRY_ACTION_REQUIRED, CABINETRY_MANUAL_OVERRIDE, CABINETRY_OUTCOME_MATCHED, cabinetryRequirementTypes, cabinetryScheduleGroup } from '../../lib/construction-estimation/cabinetryRequirements.js';
import { CABINETRY_ROOMS } from '../../lib/builders/cabinetryRoomSelection.js';
import { houseRoomNames, projectLocationNames } from '../../lib/builders/projectLocations.js';

const cell = { padding: '6px 8px', borderBottom: '1px solid #e2e8f0', textAlign: 'left', verticalAlign: 'top' };
const button = { padding: '6px 12px', borderRadius: 6, border: '1px solid #0f766e', background: '#fff', color: '#0f766e', fontWeight: 700, cursor: 'pointer' };
const OUTCOME_COLOUR = { [CABINETRY_OUTCOME_MATCHED]: '#166534', [CABINETRY_MANUAL_OVERRIDE]: '#92400e', [CABINETRY_ACTION_REQUIRED]: '#b45309' };

// The rooms a requirement can be entered against: the cabinetry rooms, then the job's own rooms
// (so a wardrobe is entered against Bedroom 1 / WIR, not one generic "Wardrobes" line).
function requirementRooms(workbook) {
  const book = workbook.clientSelectionsBook || workbook.selectionsBook || null;
  let project = [];
  try { project = houseRoomNames(projectLocationNames({ book, workbook })); } catch { project = []; }
  const names = [...CABINETRY_ROOMS.map(room => room.label), ...project];
  const seen = new Set();
  return names.filter(name => name && !seen.has(name.toLowerCase()) && seen.add(name.toLowerCase()));
}
const outcomeOf = entry => entry.outcome || (entry.status === 'MATCHED TO QUOTE ROW' ? (entry.flag === CABINETRY_MANUAL_OVERRIDE ? CABINETRY_MANUAL_OVERRIDE : CABINETRY_OUTCOME_MATCHED) : CABINETRY_ACTION_REQUIRED);

// One-time classification of a cabinet saved before it had an exact item.
function Classify({ entry, onClassify }) {
  const [choice, setChoice] = useState('');
  const { componentId, options = [] } = entry.action;
  if (!componentId) return <span>{entry.action.label}</span>;
  return <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
    <select aria-label={`Choose the cabinet for ${entry.label} in ${entry.room}`} value={choice} onChange={event => setChoice(event.target.value)}>
      <option value="">Choose the cabinet</option>
      {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
    <button type="button" style={button} disabled={!choice} onClick={() => onClassify(componentId, choice)}>Apply</button>
    <button type="button" style={{ ...button, borderColor: '#94a3b8', color: '#475569' }} onClick={() => onClassify(componentId, '')}>Not required</button>
  </span>;
}

function Measurement({ entry, onResolve }) {
  const [value, setValue] = useState('');
  const amount = Number(value);
  return <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
    <input aria-label={`${entry.label} length in LM for ${entry.room}`} type="number" min="0" step="0.01" value={value} onChange={event => setValue(event.target.value)} style={{ width: 90 }} />
    <span>LM</span>
    <button type="button" style={button} disabled={!(amount > 0)} onClick={() => onResolve(entry.requirementId, entry.action.kind === 'enter-benchtop-length' ? { kind: 'length', value: amount } : amount)}>Save</button>
  </span>;
}

function BenchtopRange({ entry, onResolve }) {
  const [choice, setChoice] = useState('');
  return <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
    <select aria-label={`Quotation range for ${entry.label} in ${entry.room}`} value={choice} onChange={event => setChoice(event.target.value)}>
      <option value="">Choose quotation range</option>
      {(entry.action.options || []).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
    <button type="button" style={button} disabled={!choice} onClick={() => onResolve(entry.requirementId, { kind: 'range', value: choice })}>Save</button>
  </span>;
}

// Cabinetry in one line, with a Review panel behind it. Every requirement of the job (takeoff, Job
// Setup, Client Selections) is listed there as MATCHED, MANUAL OVERRIDE or ACTION REQUIRED, and
// every item needing attention carries the one thing to do about it.
export default function CabinetryReconciliation({ workbook, readonly, onChange, onClassify, onResolve, onReturnToAutomatic, onRestoreRow }) {
  const [open, setOpen] = useState(false);
  const [attentionOnly, setAttentionOnly] = useState(true);
  const [draft, setDraft] = useState({ room: 'Kitchen', type: '', quantity: '' });
  if (!cabinetryApplies(workbook.workspaceId)) return null;
  const { entries = [] } = workbook.cabinetryReconciliation || {};
  const explicit = workbook.cabinetryRequirements?.items || [];
  const quoteQuantity = Object.fromEntries((workbook.quotation?.CABINETRY?.rows || []).filter(row => row.importKey).map(row => [row.importKey, row.quantity]));
  const count = outcome => entries.filter(entry => outcomeOf(entry) === outcome).length;
  const matched = count(CABINETRY_OUTCOME_MATCHED), overrides = count(CABINETRY_MANUAL_OVERRIDE), attention = count(CABINETRY_ACTION_REQUIRED);
  const shown = entries.filter(entry => !attentionOnly || outcomeOf(entry) !== CABINETRY_OUTCOME_MATCHED);
  const rooms = requirementRooms(workbook);
  const types = cabinetryRequirementTypes(cabinetryScheduleGroup(draft.room));
  const quantity = Number(draft.quantity);
  const action = entry => {
    const kind = entry.action?.kind;
    if (readonly || !kind) return entry.action?.label || '';
    if (kind === 'classify' && onClassify) return <Classify entry={entry} onClassify={onClassify} />;
    if ((kind === 'enter-bulkhead-length' || kind === 'enter-benchtop-length') && onResolve) return <Measurement entry={entry} onResolve={onResolve} />;
    if (kind === 'choose-benchtop-range' && onResolve) return <BenchtopRange entry={entry} onResolve={onResolve} />;
    if (kind === 'return-to-automatic' && onReturnToAutomatic) return <button type="button" style={button} onClick={() => onReturnToAutomatic(entry.action.importKey)}>Return to automatic</button>;
    if (kind === 'restore-row' && onRestoreRow) return <button type="button" style={button} onClick={() => onRestoreRow(entry.action.importKey)}>{entry.action.label}</button>;
    const removable = explicit.some(item => item.id === entry.requirementId);
    return <span>{entry.action.label}{removable ? <> <button type="button" style={{ ...button, marginLeft: 6 }} aria-label={`Remove ${entry.label || entry.type} from ${entry.room}`} onClick={() => onChange(explicit.filter(item => item.id !== entry.requirementId))}>Remove</button></> : null}</span>;
  };
  return <section data-testid="cabinetry-reconciliation" data-cabinetry-attention={attention} style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 8 }}>
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <strong>CABINETRY</strong>
      <span data-testid="cabinetry-matched-count">{matched} matched</span>
      {overrides > 0 && <span style={{ color: OUTCOME_COLOUR[CABINETRY_MANUAL_OVERRIDE] }}>{overrides} manual override{overrides === 1 ? '' : 's'}</span>}
      {attention > 0 && <span data-testid="cabinetry-attention-count" style={{ color: OUTCOME_COLOUR[CABINETRY_ACTION_REQUIRED], fontWeight: 700 }}>{attention} require{attention === 1 ? 's' : ''} attention</span>}
      <button type="button" style={button} data-testid="cabinetry-review-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Close review' : 'Review'}</button>
    </div>
    {open && <div data-testid="cabinetry-review-panel" style={{ marginTop: 12 }}>
      <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={attentionOnly} onChange={event => setAttentionOnly(event.target.checked)} /> Show only items needing attention</label>
      {shown.length > 0 ? <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <thead><tr>{['Room', 'Requirement', 'Qty', 'Finish', 'Matched quote row', 'Quote Qty', 'Issue', 'Action'].map(heading => <th key={heading} style={cell}>{heading}</th>)}</tr></thead>
        <tbody>{shown.map(entry => {
          const outcome = outcomeOf(entry);
          return <tr key={entry.requirementId} data-cabinetry-requirement={entry.requirementId} data-cabinetry-outcome={outcome}>
            <td style={cell}>{entry.room}</td>
            <td style={cell}>{entry.label || entry.type}{entry.dimensions ? <div style={{ color: '#64748b' }}>{entry.dimensions}</div> : null}</td>
            <td style={cell}>{entry.quantity || ''}{entry.basis ? <div style={{ color: '#64748b' }}>{entry.basis}</div> : null}</td>
            <td style={cell}>{entry.selectedFinish || ''}</td>
            <td style={cell}>{entry.matchedQuoteRow || ''}</td>
            <td style={cell}>{entry.matchedImportKey ? quoteQuantity[entry.matchedImportKey] ?? '' : ''}</td>
            <td style={{ ...cell, color: OUTCOME_COLOUR[outcome], fontWeight: 700 }}>{outcome === CABINETRY_OUTCOME_MATCHED ? 'Matched' : outcome === CABINETRY_MANUAL_OVERRIDE ? 'Manual override' : entry.reason || 'Action required'}{outcome === CABINETRY_OUTCOME_MATCHED && entry.reason ? <div style={{ fontWeight: 400, color: '#64748b' }}>{entry.reason}</div> : null}</td>
            <td style={cell}>{outcome === CABINETRY_OUTCOME_MATCHED ? (!readonly && explicit.some(item => item.id === entry.requirementId) ? <button type="button" style={button} aria-label={`Remove ${entry.label || entry.type} from ${entry.room}`} onClick={() => onChange(explicit.filter(item => item.id !== entry.requirementId))}>Remove</button> : '') : action(entry)}</td>
          </tr>;
        })}</tbody>
      </table> : <p style={{ margin: '8px 0 0' }}>{entries.length ? 'Nothing needs attention.' : 'No cabinetry requirements yet.'}</p>}
      {!readonly && <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end', marginTop: 12 }}>
        <label>Room <select aria-label="Cabinetry requirement room" value={draft.room} onChange={event => setDraft({ room: event.target.value, type: '', quantity: '' })}>{rooms.map(room => <option key={room}>{room}</option>)}</select></label>
        <label>Requirement <select aria-label="Cabinetry requirement type" value={draft.type} onChange={event => setDraft({ ...draft, type: event.target.value })}><option value="">Choose item</option>{types.map(type => <option key={`${type.area}:${type.key}`} value={type.key}>{type.label}</option>)}</select></label>
        <label>Qty / LM <input aria-label="Cabinetry requirement quantity" type="number" min="0" step="any" value={draft.quantity} onChange={event => setDraft({ ...draft, quantity: event.target.value })} style={{ width: 90 }} /></label>
        <button type="button" style={button} disabled={!draft.type || !(quantity > 0)} onClick={() => { onChange([...explicit, { room: draft.room, type: draft.type, quantity, source: 'JOB_SETUP' }]); setDraft({ ...draft, type: '', quantity: '' }); }}>Add requirement</button>
      </div>}
    </div>}
  </section>;
}
