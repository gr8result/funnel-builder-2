// Stair height for the stair configuration: lower ceiling height and floor system thickness come
// from Job Setup (stairFlightsFromJobSetup), floor-to-floor and risers are calculated by
// stairGeometry.js. A value can be overridden for this stair only; the Job Setup value stays
// visible with "Reset to Job Setup". Readable text is never below 16px.
import { formatRiserHeight } from '../../lib/construction-estimation/stairGeometry.js';

const box = { border: '1px solid #b8c6d8', borderRadius: 10, padding: 16, display: 'grid', gap: 12, background: '#f8fafc' };
const row = { display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(140px, 200px) minmax(180px, 1.2fr)', gap: 12, alignItems: 'center' };

function SourceField({ label, field, testId, onOverride, onReset }) {
  return (
    <div style={row} data-testid={testId} data-overridden={field.overridden ? 'true' : 'false'}>
      <strong>{label}</strong>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="number" min="1" step="1" aria-label={label} value={field.valueMm ?? ''} onChange={(event) => onOverride(event.target.value)} style={{ width: '100%', padding: 10, fontWeight: 700 }} />
        <span>mm</span>
      </label>
      <span>
        {field.overridden
          ? <><b style={{ color: '#b45309' }} data-testid={`${testId}-source`}>Manual override</b>{' '}<button type="button" className="stairNav" data-testid={`${testId}-reset`} onClick={onReset}>Reset to Job Setup{field.jobSetupMm ? `: ${field.jobSetupMm}mm` : ''}</button></>
          : <span data-testid={`${testId}-source`} style={{ color: field.valueMm ? '#0f766e' : '#b91c1c', fontWeight: 700 }}>{field.source || 'Not set in Job Setup'}</span>}
        {field.floorSystem && !field.overridden ? <span style={{ display: 'block', color: '#475569' }}>{field.floorSystem}</span> : null}
      </span>
    </div>
  );
}

export default function StairHeightPanel({ flights = [], flightKey = '', resolved = null, onFlight, onOverride, onReset }) {
  if (!resolved) return <div style={box} data-testid="stair-height-panel"><strong>Stair height</strong><p>Choose a stair type first.</p></div>;
  return (
    <section style={box} data-testid="stair-height-panel" data-flight={resolved.flightKey}>
      <h4 style={{ margin: 0 }}>Stair height</h4>
      {flights.length > 1 ? (
        <label>Stair between
          <select aria-label="Stair between levels" value={flightKey} onChange={(event) => onFlight(event.target.value)} style={{ display: 'block', padding: 10 }}>
            {flights.map((flight) => <option key={flight.flightKey} value={flight.flightKey}>{flight.label}</option>)}
          </select>
        </label>
      ) : <p style={{ margin: 0 }}>{resolved.label}</p>}
      <SourceField label={resolved.ceilingHeight.fieldLabel || 'Lower ceiling height'} field={resolved.ceilingHeight} testId="stair-ceiling-height" onOverride={(value) => onOverride('ceilingHeightMm', value)} onReset={() => onReset('ceilingHeightMm')} />
      <SourceField label={`Floor thickness (${resolved.floorThickness.fieldLabel || 'floor system'})`} field={resolved.floorThickness} testId="stair-floor-thickness" onOverride={(value) => onOverride('floorThicknessMm', value)} onReset={() => onReset('floorThicknessMm')} />
      <div style={row}><strong>Floor-to-floor height</strong><b data-testid="stair-floor-to-floor">{resolved.floorToFloorMm ? `${resolved.floorToFloorMm} mm` : '—'}</b><span>{resolved.floorToFloorMm ? `Calculated from: ${resolved.ceilingHeight.valueMm}mm ceiling height + ${resolved.floorThickness.valueMm}mm floor system` : 'Needs both values above'}</span></div>
      <div style={row}><strong>Max riser</strong><b data-testid="stair-max-riser">{resolved.maxRiserHeightMm} mm</b><span /></div>
      <div style={row}><strong>Calculated risers</strong><b data-testid="stair-riser-count">{resolved.riserCount ?? '—'}</b><span>{resolved.riserCount ? `ceil(${resolved.floorToFloorMm} / ${resolved.maxRiserHeightMm})` : ''}</span></div>
      <div style={row}><strong>Actual riser height</strong><b data-testid="stair-riser-height">{resolved.riserCount ? `${formatRiserHeight(resolved.actualRiserHeightMm)} mm` : '—'}</b><span data-testid="stair-riser-summary">{resolved.riserCount ? `${resolved.riserCount} risers @ ${formatRiserHeight(resolved.actualRiserHeightMm)}mm` : ''}</span></div>
    </section>
  );
}
