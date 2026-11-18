import { useState } from 'react';
import Router from 'next/router';
import { cabinetryApplies } from '../../lib/construction-estimation/finalCabinetryQuotation.js';
import { CABINETRY_ACTION_REQUIRED, CABINETRY_MANUAL_OVERRIDE, CABINETRY_OUTCOME_MATCHED, cabinetryQuotationBriefs, cabinetryRequirementTypes, cabinetryScheduleGroup } from '../../lib/construction-estimation/cabinetryRequirements.js';
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
  // LM for benchtop and bulkhead runs; EACH for the builder's verified number of Sharkfin fronts.
  const unit = entry.action?.unit || entry.unit || 'LM';
  const count = unit !== 'LM';
  return <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
    <input aria-label={count ? `${entry.label} number of fronts for ${entry.room}` : `${entry.label} length in LM for ${entry.room}`} type="number" min="0" step={count ? '1' : '0.01'} value={value} onChange={event => setValue(event.target.value)} style={{ width: 90 }} />
    <span>{unit}</span>
    <button type="button" style={button} disabled={!(amount > 0)} onClick={() => onResolve(entry.requirementId, entry.action.kind === 'enter-benchtop-length' ? { kind: 'length', value: amount } : entry.action.kind === 'enter-benchtop-edge-length' ? { kind: 'edge-length', value: amount } : amount)}>Save</button>
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

// The builder's island count for one cabinet line (18 Nov 2026): how many of this line's cabinets
// stand in the island. The line and its charge are unchanged - the island is not a second cabinet.
function IslandLine({ line, room, readonly, onResolve }) {
  const [value, setValue] = useState(String(line.islandQuantity || 0));
  const count = Number(value);
  const changed = count !== (line.islandQuantity || 0);
  return <li data-island-line={line.componentId} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
    <span style={{ minWidth: 240 }}>{line.label} <span style={{ color: '#64748b' }}>({line.quantity} in the room)</span></span>
    {readonly || !onResolve ? <b>{line.islandQuantity || 0} in island</b> : <>
      <input aria-label={`${line.label} cabinets in the ${room} island`} type="number" min="0" max={line.quantity} step="1" value={value} onChange={event => setValue(event.target.value)} style={{ width: 70 }} />
      <span>in island</span>
      <button type="button" style={button} disabled={!changed || !(count >= 0) || count > line.quantity} onClick={() => onResolve(`island:${line.componentId}`, count)}>Save</button>
    </>}
  </li>;
}

function IslandConfiguration({ brief, readonly, onResolve }) {
  const island = brief.island;
  if (!island?.hasIsland) return null;
  return <section data-testid="cabinetry-island-configuration" data-identified={island.identified ? 'yes' : 'no'} style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 10px' }}>
    <strong>Island — {brief.room}</strong>
    <div style={{ color: '#334155' }}>Bench back: {island.benchBack || 'not in this room'} · {island.benchtop || 'no island benchtop'}</div>
    <div style={{ color: '#475569', margin: '4px 0' }}>Mark which of the room's cabinets and end panels stand in the island. Nothing is added to the quotation; each cabinet is charged once, on its own line.</div>
    <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
      {island.lines.map(line => <IslandLine key={line.componentId} line={line} room={brief.room} readonly={readonly} onResolve={onResolve} />)}
    </ul>
  </section>;
}

// The stone's construction for the client's finished thickness (full slab or mitred) - builder only.
function BenchtopConstructions({ brief, readonly, onResolve }) {
  if (!brief.benchtopConstructions?.length) return null;
  return <section data-testid="cabinetry-benchtop-constructions" style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 10px' }}>
    <strong>Benchtop construction — {brief.room}</strong>
    <ul style={{ margin: '4px 0 0', paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
      {brief.benchtopConstructions.map(item => <li key={item.requirementId} data-benchtop-construction={item.requirementId} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ minWidth: 240 }}>{item.label} · {item.thicknessMm} mm finished</span>
        {readonly || !onResolve ? <b>{(item.options.find(option => option.key === item.edgeConstruction) || {}).label || 'Not set'}</b>
          : <select aria-label={`Edge construction for ${item.label} in ${brief.room}`} value={item.edgeConstruction || ''} onChange={event => event.target.value && onResolve(item.requirementId, { kind: 'edge-construction', value: event.target.value })}>
            {item.edgeConstruction ? null : <option value="">Choose construction</option>}
            {item.options.map(option => <option key={option.key} value={option.key}>{option.label}{option.confirm ? ' - confirm with fabricator' : ''}</option>)}
          </select>}
      </li>)}
    </ul>
  </section>;
}

// Opens the builder-only cabinetry setup in Client Selections (quantities, schedule, builder checks).
function openBuilderSetup(room) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('page', 'clientSelections');
  for (const key of ['selectionArea', 'selectionCategory', 'selectionRequirement']) url.searchParams.delete(key);
  url.searchParams.set('cabinetryBuilder', '1');
  url.searchParams.set('cabinetryRoom', String(room || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
  Router.push(`${url.pathname}${url.search}`);
}

// One card per cabinetry room (16 Nov 2026): the client's confirmed specification, imported from
// Client Selections, and the builder's measurements - each approved, or BUILDER ACTION REQUIRED with
// the length entered right here. Approved measurements and client finishes are kept apart: a finish
// change never alters a measured quantity.
function RoomBrief({ brief, readonly, onResolve }) {
  const required = brief.measurements.filter(item => item.status === 'required');
  const roomTitle = brief.room.toUpperCase();
  return <article data-testid="cabinetry-room-brief" data-room={brief.room} data-outstanding={brief.outstanding} style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', background: '#fff', display: 'grid', gap: 8 }}>
    <h4 style={{ margin: 0, fontSize: 16, letterSpacing: '.02em', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>{roomTitle} — CABINETRY {brief.approved ? <span style={{ color: '#047857', fontWeight: 700 }}>· Client approved</span> : <span style={{ color: '#92400e', fontWeight: 700 }}>· Client approval pending</span>}
      {readonly ? null : <button type="button" style={{ ...button, marginLeft: 'auto', fontSize: 13 }} data-testid="cabinetry-open-builder-setup" onClick={() => openBuilderSetup(brief.room)}>Builder cabinetry setup</button>}</h4>
    {required.length ? (
      <div role="alert" data-testid="cabinetry-builder-action" style={{ border: '2px solid #b45309', background: '#fffbeb', borderRadius: 8, padding: '8px 10px' }}>
        <strong style={{ color: '#92400e' }}>BUILDER MEASUREMENT REQUIRED — {roomTitle} CABINETRY</strong>
        <div style={{ color: '#334155' }}>Selected in Client Selections and imported. The client does not measure; enter each quantity here:</div>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18, display: 'grid', gap: 6 }}>
          {required.map(item => <li key={item.requirementId} data-cabinetry-measurement={item.requirementId} data-unit={item.unit}>
            <span style={{ fontWeight: 700 }}>BUILDER MEASUREMENT REQUIRED: {brief.room} · {item.label} · {item.unit}</span> — {item.reason || 'Measurement required'}
            {!readonly && onResolve && item.action ? <div style={{ marginTop: 4 }}><Measurement entry={{ ...item, room: brief.room }} onResolve={onResolve} /></div> : null}
          </li>)}
        </ul>
      </div>
    ) : <div data-testid="cabinetry-measurements-complete" style={{ color: '#166534', fontWeight: 800 }}>MEASUREMENTS COMPLETE</div>}
    {(brief.builderReviews || []).filter(item => !item.verified && !(/^sharkfin:/.test(item.requirementId) && required.some(req => req.requirementId === item.requirementId))).map(item => /^sharkfin:/.test(item.requirementId) ? (
      <div key={item.requirementId} role="alert" data-testid="cabinetry-builder-review" data-requirement={item.requirementId} style={{ border: '2px solid #b45309', background: '#fffbeb', borderRadius: 8, padding: '8px 10px' }}>
        <strong style={{ color: '#92400e' }}>BUILDER REVIEW — {roomTitle} · {item.label.toUpperCase()}</strong>
        <div style={{ color: '#334155' }}>{item.note}. Charged on the verified number of fronts only, once per room.{item.basis ? <span style={{ color: '#64748b' }}> · {item.basis}</span> : null}</div>
        {!readonly && onResolve ? <div style={{ marginTop: 4 }}><Measurement entry={{ requirementId: item.requirementId, label: item.label, room: brief.room, unit: 'EACH', action: { kind: 'enter-sharkfin-fronts', unit: 'EACH' } }} onResolve={onResolve} /></div> : null}
      </div>
    ) : (
      // Benchtop fabrication checks (thickness availability, semi-recessed basin, narrow vanity): builder / stone fabricator.
      <div key={item.requirementId} role="alert" data-testid="cabinetry-builder-review" data-requirement={item.requirementId} style={{ border: '2px solid #b45309', background: '#fffbeb', borderRadius: 8, padding: '8px 10px' }}>
        <strong style={{ color: '#92400e' }}>BUILDER REVIEW — {roomTitle} · {item.label.toUpperCase()}</strong>
        <ul style={{ margin: '4px 0 0', paddingLeft: 18, color: '#334155' }}>{item.note.split('; ').map(note => <li key={note}>{note}</li>)}</ul>
      </div>
    ))}
    <IslandConfiguration brief={brief} readonly={readonly} onResolve={onResolve} />
    <BenchtopConstructions brief={brief} readonly={readonly} onResolve={onResolve} />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
      <section>
        <strong>Client selections</strong>
        {brief.clientSelections.length ? <dl style={{ margin: '4px 0 0', display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '2px 10px' }}>
          {brief.clientSelections.map((line, index) => <div key={`${line.label}:${index}`} style={{ display: 'contents' }}><dt style={{ color: '#475569' }}>{line.label}</dt><dd style={{ margin: 0 }} data-product-id={line.productId || undefined}>{line.value}</dd></div>)}
        </dl> : <p style={{ margin: '4px 0 0', color: '#64748b' }}>No client selections yet.</p>}
      </section>
      <section>
        <strong>Builder measurements</strong>
        {brief.measurements.length ? <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
          {brief.measurements.map(item => <li key={item.requirementId} data-measurement-status={item.status}>{item.label}: {item.status === 'approved' ? <b>{item.quantity} {item.unit}</b> : <b style={{ color: '#b45309' }}>measurement required</b>}{item.basis ? <span style={{ color: '#64748b' }}> · {item.basis}</span> : null}</li>)}
        </ul> : <p style={{ margin: '4px 0 0', color: '#64748b' }}>No measured items (benchtop or bulkhead runs) in this room.</p>}
        {brief.otherActions.length ? <p style={{ margin: '6px 0 0', color: '#92400e' }}>Also open: {brief.otherActions.map(item => `${item.label} (${item.reason || item.action?.label || 'action required'}${item.action?.kind === 'builder-rate-required' && item.reason ? ` - ${item.action.label}` : ''})`).join('; ')} — see Review below.</p> : null}
      </section>
    </div>
  </article>;
}

// Builder action notes at the top of the CABINETRY quotation section itself (17 Nov 2026): every
// room and item still needing a builder measurement or verification, named with its unit. The
// quantities are entered in the cabinetry card above the quotation; nothing is invented here.
export function CabinetrySectionBuilderNotes({ workbook }) {
  if (!cabinetryApplies(workbook?.workspaceId)) return null;
  const briefs = cabinetryQuotationBriefs(workbook);
  const notes = briefs.flatMap(brief => [
    ...brief.measurements.filter(item => item.status === 'required').map(item => ({ key: `${brief.room}:${item.requirementId}`, text: `BUILDER MEASUREMENT REQUIRED: ${brief.room} · ${item.label} · ${item.unit}`, reason: item.reason })),
    ...(brief.builderReviews || []).filter(item => !item.verified && !brief.measurements.some(m => m.requirementId === item.requirementId && m.status === 'required')).map(item => ({ key: `${brief.room}:${item.requirementId}:review`, text: `BUILDER REVIEW: ${brief.room} · ${item.label}`, reason: item.note })),
  ]);
  if (!notes.length) return null;
  return <div role="alert" data-testid="cabinetry-section-builder-notes" style={{ margin: '6px 8px', border: '2px solid #b45309', background: '#fffbeb', borderRadius: 8, padding: '8px 10px', color: '#78350f' }}>
    <strong>Builder actions for cabinetry ({notes.length})</strong>
    <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{notes.map(note => <li key={note.key}><b>{note.text}</b>{note.reason ? ` — ${note.reason}` : ''}</li>)}</ul>
  </div>;
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
  const briefs = cabinetryQuotationBriefs(workbook);
  const outstandingRooms = briefs.filter(brief => brief.outstanding > 0);
  const outstandingTotal = outstandingRooms.reduce((total, brief) => total + brief.outstanding, 0);
  const action = entry => {
    const kind = entry.action?.kind;
    if (readonly || !kind) return entry.action?.label || '';
    if (kind === 'classify' && onClassify) return <Classify entry={entry} onClassify={onClassify} />;
    if ((kind === 'enter-bulkhead-length' || kind === 'enter-benchtop-length' || kind === 'enter-benchtop-edge-length' || kind === 'enter-sharkfin-fronts') && onResolve) return <Measurement entry={entry} onResolve={onResolve} />;
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
    {briefs.length ? <div data-testid="cabinetry-room-briefs" style={{ marginTop: 10, display: 'grid', gap: 10 }}>
      <div data-testid="cabinetry-outstanding-summary" role={outstandingTotal ? 'alert' : 'status'} style={{ fontWeight: 800, color: outstandingTotal ? '#92400e' : '#166534' }}>
        {outstandingTotal ? `Outstanding cabinetry measurements: ${outstandingTotal} — ${outstandingRooms.map(brief => `${brief.room} ${brief.outstanding}`).join(', ')}. These must be measured before the quotation is issued.` : 'All cabinetry measurements complete.'}
      </div>
      {briefs.map(brief => <RoomBrief key={brief.roomId || brief.room} brief={brief} readonly={readonly} onResolve={onResolve} />)}
    </div> : null}
    {open && <div data-testid="cabinetry-review-panel" style={{ marginTop: 12 }}>
      <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={attentionOnly} onChange={event => setAttentionOnly(event.target.checked)} /> Show only items needing attention</label>
      {shown.length > 0 ? <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <thead><tr>{['Room', 'Requirement', 'Qty', 'Finish', 'Matched quote row', 'Quote Qty', 'Issue', 'Action'].map(heading => <th key={heading} style={cell}>{heading}</th>)}</tr></thead>
        <tbody>{shown.map(entry => {
          const outcome = outcomeOf(entry);
          return <tr key={entry.requirementId} data-cabinetry-requirement={entry.requirementId} data-cabinetry-outcome={outcome}>
            <td style={cell}>{entry.room}</td>
            <td style={cell}>{entry.label || entry.type}{entry.dimensions ? <div style={{ color: '#64748b' }}>{entry.dimensions}</div> : null}{entry.specification ? <div style={{ color: '#334155' }} data-testid="cabinetry-entry-specification">{entry.specification}</div> : null}</td>
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
