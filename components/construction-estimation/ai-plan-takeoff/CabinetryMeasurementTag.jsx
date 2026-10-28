import React from 'react';
import { BENCHTOP_DEPTHS_MM, BULKHEAD_TYPES, MEASUREMENT_REVIEW, cabinetryMeasurementIssues, measurementLengthMm, measurementPage, sheetPixelsPerMm, tagCabinetryMeasurement } from '../../../lib/construction-estimation/takeoffCabinetryMeasurements.js';

const DEFAULT_ROOMS = ['Kitchen', "Butler's Pantry", 'Laundry', 'Bathroom', 'Ensuite', 'Powder Room'];
const field = { display: 'block', width: '100%', fontSize: 12, marginTop: 2 };

// Tags one calibrated measurement as a benchtop or MDF bulkhead run and records the review decision.
export function CabinetryMeasurementTag({ measurement, job, rooms = [], readOnly, onChange }) {
  const tag = measurement.cabinetry;
  const pixelsPerMm = sheetPixelsPerMm(job, measurementPage(measurement));
  const lengthMm = measurementLengthMm(measurement, pixelsPerMm);
  const issues = tag ? cabinetryMeasurementIssues(measurement, job) : [];
  const update = patch => onChange(tagCabinetryMeasurement(measurement, patch, job));
  const roomOptions = [...new Set([...rooms, ...DEFAULT_ROOMS])];
  const listId = `cabinetry-rooms-${measurement.id}`;
  const approved = tag?.status === MEASUREMENT_REVIEW.APPROVED && !issues.length;
  return <details data-testid="cabinetry-measurement-tag" style={{ marginTop: 4 }} open={Boolean(tag)}>
    <summary style={{ fontSize: 12, cursor: 'pointer' }}>
      {tag ? `${tag.kind === 'bulkhead' ? 'MDF bulkhead' : 'Benchtop'} · ${tag.room || 'no room'} · ${approved ? 'Approved' : 'Review required'}` : 'Cabinetry run (benchtop / bulkhead)'}
    </summary>
    <label style={{ fontSize: 12 }}>Type
      <select aria-label="Cabinetry run type" style={field} disabled={readOnly} value={tag?.kind || ''} onChange={event => event.target.value ? update({ kind: event.target.value }) : onChange(Object.fromEntries(Object.entries(measurement).filter(([key]) => key !== 'cabinetry')))}>
        <option value="">Not a cabinetry run</option><option value="benchtop">Benchtop</option><option value="bulkhead">MDF bulkhead</option>
      </select>
    </label>
    {tag && <>
      <label style={{ fontSize: 12 }}>Room
        <input aria-label="Cabinetry run room" list={listId} style={field} disabled={readOnly} defaultValue={tag.room || ''} onBlur={event => event.target.value.trim() !== (tag.room || '') && update({ room: event.target.value.trim() })} />
        <datalist id={listId}>{roomOptions.map(name => <option key={name} value={name} />)}</datalist>
      </label>
      {tag.kind === 'benchtop' && <>
        <label style={{ fontSize: 12 }}>Benchtop area (as named in Client Selections)
          <input aria-label="Benchtop area" style={field} disabled={readOnly} defaultValue={tag.label || ''} placeholder="Main benchtop, Island benchtop..." onBlur={event => event.target.value.trim() !== (tag.label || '') && update({ label: event.target.value.trim(), areaId: event.target.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') })} />
        </label>
        <label style={{ fontSize: 12 }}>Depth
          <select aria-label="Benchtop depth" style={field} disabled={readOnly} value={tag.depthMm || ''} onChange={event => update({ depthMm: Number(event.target.value) || '' })}>
            <option value="">Choose depth</option>{BENCHTOP_DEPTHS_MM.map(depth => <option key={depth} value={depth}>{depth}mm</option>)}
          </select>
        </label>
      </>}
      {tag.kind === 'bulkhead' && <label style={{ fontSize: 12 }}>Bulkhead size
        <select aria-label="Bulkhead size" style={field} disabled={readOnly} value={tag.bulkheadType || ''} onChange={event => update({ bulkheadType: event.target.value })}>
          <option value="">Choose size</option>{BULKHEAD_TYPES.map(type => <option key={type.key} value={type.key}>{type.label}</option>)}
        </select>
      </label>}
      <div style={{ fontSize: 12, marginTop: 4 }}>{lengthMm > 0 ? `Calibrated length ${lengthMm} mm` : 'No calibrated length'}{tag.source === 'ai' ? ' · suggested by AI' : ''}</div>
      {[...new Set([...issues, ...(tag.approvalBlocked || [])])].map(issue => <div key={issue} role="alert" style={{ fontSize: 12, color: '#a16207' }}>{issue}</div>)}
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button type="button" data-testid="approve-cabinetry-run" disabled={readOnly || approved} onClick={() => update({ status: MEASUREMENT_REVIEW.APPROVED })}>Approve run</button>
        <button type="button" disabled={readOnly || tag.status === MEASUREMENT_REVIEW.PENDING} onClick={() => update({ status: MEASUREMENT_REVIEW.PENDING })}>Revoke approval</button>
        <button type="button" disabled={readOnly || tag.status === MEASUREMENT_REVIEW.REJECTED} onClick={() => update({ status: MEASUREMENT_REVIEW.REJECTED })}>Reject</button>
      </div>
    </>}
  </details>;
}
