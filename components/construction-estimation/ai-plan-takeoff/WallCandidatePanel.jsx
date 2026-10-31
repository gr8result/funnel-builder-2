import React from 'react';

// Decisions concern one highlighted, measured wall; there is deliberately no
// bulk acceptance of uncertain geometry.
export default function WallCandidatePanel({ candidates, selectedId, onSelect, onResolve, busy, readOnly }) {
  if (!candidates.length) return null;
  const selected = candidates.find(item => item.id === selectedId);
  return (
    <section aria-label="Review measured walls" data-testid="wall-candidate-controls"
      style={{ position: 'absolute', top: 12, right: 12, zIndex: 4, width: 300, maxWidth: 'calc(100% - 24px)', padding: 12, border: '1px solid #d97706', borderRadius: 6, background: '#fffbeb', color: '#713f12', fontSize: 12 }}>
      <strong>{candidates.length} walls need your decision</strong>
      <p style={{ margin: '6px 0' }}>Select an amber wall on the plan, then classify it. Unresolved walls do not contribute quantities.</p>
      <label>Measured wall
        <select aria-label="Measured wall to review" value={selected?.id || ''} onChange={event => onSelect(event.target.value)} disabled={busy}
          style={{ width: '100%', margin: '6px 0', padding: 6 }}>
          <option value="">Select a wall…</option>
          {candidates.map((item, index) => <option key={item.id} value={item.id}>Wall {index + 1} — {Math.round(item.thicknessMm)} mm</option>)}
        </select>
      </label>
      {selected && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {[['interior', 'Internal'], ['exterior', 'External'], ['reject', 'Not a wall']].map(([value, label]) => (
          <button key={value} type="button" disabled={busy || readOnly} onClick={() => onResolve(selected.id, value)} style={{ padding: '7px 10px' }}>{label}</button>
        ))}
      </div>}
      {busy && <div role="status">Updating walls and hosted openings…</div>}
    </section>
  );
}
