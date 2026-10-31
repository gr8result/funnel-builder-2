import { OPEN_SHELVING_SIZES, openShelvingUnit } from '../../lib/construction-estimation/cabinetryRequirements.js';

// Editors for the three Cabinet Schedule items whose quantity is not a plain count
// (cabinetryRequirements.js): MDF bulkhead runs in LM, the Sharkfin handle upgrade worked out from
// the room's doors and drawer fronts, and open shelving units by size. Each sits under its row in
// the room's Cabinet Schedule and writes to the same schedule line the quotation reads.
const CSS = `
  .cse{margin:-4px 0 4px 40px;padding:14px 16px;border:1px solid #99d5cc;border-radius:8px;background:#f0fdfa;color:#0f172a;font-size:16px;display:grid;gap:10px}
  .cse p,.cse span,.cse label,.cse strong,.cse small,.cse li{font-size:16px;line-height:1.45;margin:0}
  .cse small{color:#475569}.cse-row{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}
  .cse label{display:grid;gap:4px;font-weight:700}.cse input,.cse select{padding:9px 10px;border:1px solid #94a3b8;border-radius:6px;font-size:16px;background:#fff;color:#0f172a;min-width:0}
  .cse input[type=number]{width:120px}.cse input[type=checkbox]{width:20px;height:20px}.cse .wide input{width:240px}
  .cse button{padding:9px 14px;border:1px solid #0f766e;border-radius:6px;background:#fff;color:#0f766e;font-size:16px;font-weight:700;cursor:pointer}
  .cse button.danger{border-color:#b91c1c;color:#b91c1c}.cse-total{font-weight:800}.cse-warn{color:#92400e;font-weight:700}
  .cse-unit{border-top:1px solid #99d5cc;padding-top:10px;display:grid;gap:8px}.cse-unit:first-of-type{border-top:0;padding-top:0}.cse ul{margin:0;padding-left:20px}.cse .check{display:flex;gap:8px;align-items:center;font-weight:400}
`;
const whole = value => (value === '' || value == null ? '' : Math.max(0, Math.round(Number(value) || 0)));

// runs: [{ id, location, lengthMm }]; onChange(nextRuns). Lengths are typed in mm and totalled in LM.
export function BulkheadRunsEditor({ runs = [], lm = 0, savedCount = 0, onChange }) {
  const set = (id, patch) => onChange(runs.map(run => (run.id === id ? { ...run, ...patch } : run)));
  return <div className="cse" data-testid="bulkhead-runs">
    <style>{CSS}</style>
    {savedCount > 0 && !(lm > 0) ? <p className="cse-warn" data-testid="bulkhead-count-notice">This bulkhead was saved as a count of {savedCount}. Bulkheads are priced per lineal metre — enter the length of each run. Nothing is priced until a length is entered.</p> : null}
    {runs.map((run, index) => <div className="cse-row" key={run.id} data-testid="bulkhead-run">
      <label className="wide">Run {index + 1} location<input value={run.location || ''} placeholder="e.g. Above overhead cabinets" onChange={event => set(run.id, { location: event.target.value })} /></label>
      <label>Length (mm)<input type="number" min="0" step="1" value={run.lengthMm ?? ''} onChange={event => set(run.id, { lengthMm: whole(event.target.value) })} data-testid="bulkhead-run-length" /></label>
      <span>{Number(run.lengthMm) > 0 ? `${(Number(run.lengthMm) / 1000).toFixed(2)} LM` : 'Length required'}</span>
      <button type="button" className="danger" onClick={() => onChange(runs.filter(item => item.id !== run.id))}>Remove run</button>
    </div>)}
    <div className="cse-row">
      <button type="button" onClick={() => onChange([...runs, { id: `run-${Date.now()}-${runs.length + 1}`, location: '', lengthMm: '' }])} data-testid="bulkhead-add-run">+ Add another run</button>
      <span className="cse-total" data-testid="bulkhead-total">Total: {lm > 0 ? `${lm.toFixed(2)} LM` : 'Measurement required'}</span>
    </div>
  </div>;
}

// upgrade: sharkfinUpgrade() result; override: the manual total on the line ('' = calculated).
export function SharkfinUpgradeDetail({ upgrade, override = '', includeTall = false, onOverride, onIncludeTall }) {
  return <div className="cse" data-testid="sharkfin-upgrade">
    <style>{CSS}</style>
    <p className="cse-total" data-testid="sharkfin-quantity">Sharkfin fronts: {upgrade.quantity}{upgrade.manual ? ` (manual — calculated ${upgrade.calculated})` : ' (calculated from this room’s cabinets)'}</p>
    {upgrade.counted.length ? <ul data-testid="sharkfin-counted">{upgrade.counted.map(item => <li key={item.typeId}>{item.label}: {item.units} × {item.each} = {item.fronts}{item.assumed ? ' (front count assumed — type the door / drawer count on the line to change it)' : ''}</li>)}</ul> : <p>No short doors or external drawer fronts are scheduled in this room yet.</p>}
    {upgrade.excluded.length ? <small data-testid="sharkfin-excluded">Not counted: {upgrade.excluded.map(item => `${item.label} (${item.reason})`).join('; ')}.</small> : null}
    <div className="cse-row">
      <label>Manual quantity<input type="number" min="0" step="1" value={override ?? ''} placeholder={`${upgrade.calculated}`} onChange={event => onOverride(whole(event.target.value))} data-testid="sharkfin-override" /></label>
      {upgrade.manual ? <button type="button" onClick={() => onOverride('')} data-testid="sharkfin-automatic">Return to calculated</button> : null}
      <label className="check"><input type="checkbox" checked={includeTall} onChange={event => onIncludeTall(event.target.checked)} /> Include tall doors</label>
    </div>
    <small>The standard handle allowance is unchanged; only the Sharkfin upgrade is charged, once per door or drawer front.</small>
  </div>;
}

// units: the room's open shelving lines; onAdd(shelfUnit), onChange(componentId, patch), onRemove(componentId).
export function OpenShelvingUnitsEditor({ units = [], onAdd, onChange, onRemove }) {
  const setUnit = (line, patch) => onChange(line.componentId, { shelfUnit: { ...(line.shelfUnit || {}), ...patch } });
  const field = (line, key, label, placeholder = '') => <label>{label}<input type="number" min="0" step="1" value={line.shelfUnit?.[key] ?? ''} placeholder={placeholder} onChange={event => setUnit(line, { [key]: whole(event.target.value) })} data-testid={`open-shelf-${key}`} /></label>;
  return <div className="cse" data-testid="open-shelving-units">
    <style>{CSS}</style>
    {units.map((line, index) => {
      const unit = openShelvingUnit(line);
      const size = OPEN_SHELVING_SIZES.find(item => item.key === line.shelfUnit?.sizeKey);
      return <div className="cse-unit" key={line.componentId} data-testid="open-shelf-unit">
        <strong>{unit ? unit.label : `Open shelving module (selected before sizes were available) × ${line.quantity}`}</strong>
        <div className="cse-row">
          <label>Size<select value={unit ? unit.sizeKey : ''} onChange={event => { const next = OPEN_SHELVING_SIZES.find(item => item.key === event.target.value);
            onChange(line.componentId, { shelfUnit: next ? { ...(line.shelfUnit || {}), sizeKey: next.key, heightMm: next.heightMm, widthMm: next.widthMm, shelves: next.shelves ?? line.shelfUnit?.shelves ?? '' } : { ...(line.shelfUnit || {}), sizeKey: 'custom' } }); }} data-testid="open-shelf-size">
            {unit ? null : <option value="">Keep as selected</option>}
            {OPEN_SHELVING_SIZES.map(item => <option key={item.key} value={item.key}>{item.label} — {item.heightMm}H × {item.widthMm}W</option>)}
            <option value="custom">Custom dimensions</option>
          </select></label>
          <label>Quantity<input type="number" min="0" step="1" value={line.quantity ?? ''} onChange={event => onChange(line.componentId, { quantity: whole(event.target.value) || 0, handleQuantity: 0 })} data-testid="open-shelf-quantity" /></label>
          <button type="button" className="danger" onClick={() => onRemove(line.componentId)}>Remove unit</button>
        </div>
        {unit ? <>
          <div className="cse-row">
            {field(line, 'heightMm', 'Height (mm)', `${size?.heightMm || ''}`)}{field(line, 'widthMm', 'Width (mm)', `${size?.widthMm || ''}`)}{field(line, 'depthMm', 'Depth (mm)')}
            {field(line, 'shelves', 'Adjustable shelves', size?.shelves != null ? `${size.shelves}` : 'Set quantity')}{field(line, 'boardThicknessMm', 'Board thickness (mm)')}
          </div>
          <div className="cse-row">
            <label className="wide">Material<input value={line.shelfUnit?.material || ''} placeholder="As the room’s cabinetry" onChange={event => setUnit(line, { material: event.target.value })} /></label>
            <label className="wide">Finish / colour<input value={line.shelfUnit?.finish || ''} placeholder="As the room’s cabinetry" onChange={event => setUnit(line, { finish: event.target.value })} /></label>
            <label className="wide">Position in room<input value={line.shelfUnit?.position || ''} placeholder="e.g. Beside the fridge" onChange={event => setUnit(line, { position: event.target.value })} /></label>
          </div>
          {unit.shelves == null ? <p className="cse-warn">Set the number of shelves for this unit.</p> : null}
          <small>Priced each (EA) by size. No rate is set for this size yet, so it is listed for pricing in the quotation’s Cabinetry review and is not charged at the generic module rate.</small>
        </> : <small>Still priced as the existing Open shelving module. Choose a size to configure it as a standard unit.</small>}
        {index === units.length - 1 ? null : null}
      </div>;
    })}
    <div className="cse-row">
      {OPEN_SHELVING_SIZES.map(size => <button type="button" key={size.key} onClick={() => onAdd({ sizeKey: size.key, heightMm: size.heightMm, widthMm: size.widthMm, shelves: size.shelves ?? '' })} data-testid={`open-shelf-add-${size.key}`}>+ {size.label} ({size.heightMm} × {size.widthMm})</button>)}
      <button type="button" onClick={() => onAdd({ sizeKey: 'custom', heightMm: '', widthMm: '', shelves: '' })} data-testid="open-shelf-add-custom">+ Custom size</button>
    </div>
  </div>;
}
