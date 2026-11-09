// How an opening is drawn on the plan: a small centre marker instead of a filled box over the drawing.
// Shape says what it is (circle = window, triangle = door); colour says where it stands (review /
// approved / placed by the builder). The size label sits beside the marker.

export const OPENING_MARKER_COLOURS = {
  review: { fill: '#f59e0b', stroke: '#92400e', label: 'Review required' },
  approved: { fill: '#16a34a', stroke: '#14532d', label: 'Builder approved' },
  window: { fill: '#06b6d4', stroke: '#155e75', label: 'Window' },
  door: { fill: '#7c3aed', stroke: '#3b0764', label: 'Door' },
};

const positive = (value) => Number(value) > 0;

// Review: an AI-placed opening not yet approved, an unconfirmed type, or a missing size.
// Approved: the builder approved it (builderConfirmedAt). Otherwise it was placed by the builder.
export function openingMarkerStatus(opening = {}) {
  if (opening.builderConfirmedAt) return 'approved';
  if (opening.needsClassification || opening.reviewRequired) return 'review';
  if (!positive(opening.widthMm) || !positive(opening.heightMm)) return 'review';
  if (opening.source === 'ai') return 'review';
  return 'standard';
}

export function openingMarkerStyle(opening = {}) {
  const status = openingMarkerStatus(opening);
  const shape = opening.type === 'window' ? 'circle' : 'triangle';
  const colours = status === 'standard' ? OPENING_MARKER_COLOURS[opening.type === 'window' ? 'window' : 'door'] : OPENING_MARKER_COLOURS[status];
  return { status, shape, ...colours };
}

// "W3 1809 · 1800H x 902W"; a missing dimension shows as "?" so it is never read as a size.
export function openingSizeLabel(opening = {}, fallbackTag = '') {
  const tag = String(opening.itemTag || opening.label || fallbackTag || '').replace(/^[WD]\s*AI\s+\S+$/i, fallbackTag).trim();
  const h = positive(opening.heightMm) ? Math.round(Number(opening.heightMm)) : '?';
  const w = positive(opening.widthMm) ? Math.round(Number(opening.widthMm)) : '?';
  return [tag, `${h}H x ${w}W`].filter(Boolean).join(' · ');
}

// Builder correction from the quick-edit popup: geometry position is untouched; an approval made
// before the change no longer stands, so the builder approves the corrected size again.
export function applyOpeningQuickEdit(opening = {}, changes = {}, editedAt = new Date().toISOString()) {
  const next = { ...opening };
  for (const key of ['heightMm', 'widthMm']) {
    if (changes[key] === undefined) continue;
    const value = Number(changes[key]);
    next[key] = positive(value) ? Math.round(value) : null;
  }
  if (changes.itemTag !== undefined) next.itemTag = String(changes.itemTag);
  const changed = ['heightMm', 'widthMm', 'itemTag'].some((key) => next[key] !== opening[key]);
  if (!changed) return opening;
  const { builderConfirmedAt, ...rest } = next;
  return { ...rest, builderEditedAt: editedAt };
}

export function approveOpening(opening = {}, approvedAt = new Date().toISOString()) {
  if (!positive(opening.widthMm) || !positive(opening.heightMm) || opening.needsClassification) return opening;
  return { ...opening, builderConfirmedAt: approvedAt };
}
