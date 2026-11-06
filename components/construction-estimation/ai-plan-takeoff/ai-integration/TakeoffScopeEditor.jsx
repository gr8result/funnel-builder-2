import { INCLUSION_SCHEDULES, ROOM_GROUPS, FLOOR_FINISHES, ROOF_CATEGORIES, emptyScopeProfile, roomScopeKey } from './inclusionScope.js';

const inputStyle = { width: '100%', padding: 5, border: '1px solid #94a3b8', borderRadius: 4, marginTop: 3 };
function RuleEditor({ rule, onChange, label }) {
  return <fieldset style={{ border: '1px solid #cbd5e1', borderRadius: 5, marginTop: 8, padding: 8 }}>
    <legend>{label}</legend>
    <label>Floor finish<select aria-label={`${label} floor finish`} value={rule.floorFinish || ''} onChange={(e) => onChange({ ...rule, floorFinish: e.target.value })} style={inputStyle}>
      <option value="">Select specification</option>{FLOOR_FINISHES.map((f) => <option key={f}>{f}</option>)}
    </select></label>
    <label>Wall tiles<select aria-label={`${label} wall tiles`} value={rule.wallTiling || ''} onChange={(e) => onChange({ ...rule, wallTiling: e.target.value })} style={inputStyle}>
      <option value="">Select specification</option><option value="none">No wall tiling</option><option value="standard">Standard perimeter plus shower walls</option><option value="perimeter">Room perimeter to specified height</option><option value="full-height">Full room perimeter to ceiling</option>
    </select></label>
    {['perimeter', 'standard'].includes(rule.wallTiling) && <label>Tiling height (mm)<input aria-label={`${label} tiling height in mm`} type="number" min="1" max="6000" value={rule.wallTileHeightMm || ''} onChange={(e) => onChange({ ...rule, wallTileHeightMm: e.target.value ? Number(e.target.value) : null })} style={inputStyle} /></label>}
    {rule.wallTiling === 'standard' && <label>Shower tiling height (mm)<input aria-label={`${label} shower tiling height in mm`} type="number" min="1" max="6000" value={rule.showerTileHeightMm || ''} onChange={(e) => onChange({ ...rule, showerTileHeightMm: e.target.value ? Number(e.target.value) : null })} style={inputStyle} /></label>}
    <label>Kitchen / laundry splashbacks<select aria-label={`${label} splashbacks`} value={rule.splashback || ''} onChange={(e) => onChange({ ...rule, splashback: e.target.value })} style={inputStyle}>
      <option value="">Select specification</option><option value="none">No splashback</option><option value="measured">Use documented splashback dimensions</option>
    </select></label>
  </fieldset>;
}
export function TakeoffScopeEditor({ analysis, disabled }) {
  const profile = analysis.scopeProfile;
  const update = analysis.updateScopeProfile;
  return <div style={{ marginBottom: 10 }}>
    <label style={{ fontWeight: 700 }}>Inclusion schedule<select id="takeoff-inclusion-schedule" disabled={disabled} value={profile.schedule} onChange={(e) => update(emptyScopeProfile(e.target.value))} style={inputStyle}>
      <option value="">Select inclusion schedule</option>{INCLUSION_SCHEDULES.map((s) => <option key={s} value={s}>{s} Inclusions</option>)}
    </select></label>
    <p style={{ margin: '6px 0', color: '#475569' }}>Set the actual builder specification below. Changing the schedule starts a fresh specification; saved room geometry is reused.</p>
    {profile.schedule && <details><summary>Configure {profile.schedule} takeoff scope</summary>
      <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}>
        {ROOM_GROUPS.map((group) => {
          const rule = profile.rules.find((r) => r.group === group) || { group };
          return <RuleEditor key={group} label={group} rule={rule} onChange={(next) => update({ ...profile, rules: [...profile.rules.filter((r) => r.group !== group), next] })} />;
        })}
        <details style={{ marginTop: 8 }}><summary>Room overrides</summary>
          {(analysis.report?.rooms || []).map((room, index) => {
            const rule = profile.overrides.find((r) => r.roomKey === roomScopeKey(room));
            return <div key={`${room.page}:${index}`}>
              <label><input type="checkbox" checked={Boolean(rule)} onChange={(e) => update({ ...profile, overrides: e.target.checked ? [...profile.overrides, { roomName: room.name, roomKey: roomScopeKey(room) }] : profile.overrides.filter((r) => r.roomKey !== roomScopeKey(room)) })} /> Override {room.name}</label>
              {rule && <RuleEditor label={room.name} rule={rule} onChange={(next) => update({ ...profile, overrides: [...profile.overrides.filter((r) => r.roomKey !== roomScopeKey(room)), next] })} />}
            </div>;
          })}
        </details>
        <details style={{ marginTop: 8 }}><summary>Roof items confirmed absent by design</summary>
          <p>Only tick an item when the plans or builder specification confirm it is not required.</p>
          {ROOF_CATEGORIES.map((category) => <label key={category} style={{ display: 'block' }}><input type="checkbox" checked={profile.roofNotApplicable.includes(category)} onChange={(e) => update({ ...profile, roofNotApplicable: e.target.checked ? [...profile.roofNotApplicable, category] : profile.roofNotApplicable.filter((c) => c !== category) })} /> {category}</label>)}
        </details>
      </fieldset>
    </details>}
  </div>;
}
