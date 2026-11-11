// Opening markers on the plan: shape by kind, colour by review state, size label, quick edit and approval.
import assert from 'node:assert/strict';
import { openingMarkerStyle, openingMarkerStatus, openingSizeLabel, applyOpeningQuickEdit, approveOpening, OPENING_MARKER_COLOURS } from '../components/construction-estimation/ai-plan-takeoff/openingMarkers.js';

const window = { id: 'w1', type: 'window', itemTag: 'W3 1809', heightMm: 1800, widthMm: 902, source: 'manual' };
const door = { id: 'd1', type: 'door', itemTag: 'D2', heightMm: 2040, widthMm: 820, source: 'manual' };

// Shape tells windows from doors whatever the state.
assert.equal(openingMarkerStyle(window).shape, 'circle');
assert.equal(openingMarkerStyle(door).shape, 'triangle');
assert.equal(openingMarkerStyle({ ...door, source: 'ai' }).shape, 'triangle');

// Colour: builder-placed window cyan, door violet; AI unapproved / missing size / unconfirmed type amber; approved green.
assert.equal(openingMarkerStyle(window).fill, OPENING_MARKER_COLOURS.window.fill);
assert.equal(openingMarkerStyle(door).fill, OPENING_MARKER_COLOURS.door.fill);
assert.notEqual(OPENING_MARKER_COLOURS.window.fill, OPENING_MARKER_COLOURS.door.fill);
assert.equal(openingMarkerStatus({ ...window, source: 'ai' }), 'review');
assert.equal(openingMarkerStatus({ ...window, heightMm: null }), 'review');
assert.equal(openingMarkerStatus({ ...door, needsClassification: true }), 'review');
assert.equal(openingMarkerStyle({ ...window, source: 'ai' }).fill, OPENING_MARKER_COLOURS.review.fill);
assert.equal(openingMarkerStyle({ ...window, source: 'ai', builderConfirmedAt: 't' }).fill, OPENING_MARKER_COLOURS.approved.fill);

// Size label beside the marker; a missing dimension is "?" and the AI placeholder tag is replaced.
assert.equal(openingSizeLabel(window, 'W1'), 'W3 1809 · 1800H x 902W');
assert.equal(openingSizeLabel({ type: 'window', itemTag: 'W AI geometry:o-12', widthMm: 900 }, 'W4'), 'W4 · 900W · height to confirm');
// Found in the Jesmond browser run: a vector detection ID was shown as the tag.
assert.equal(openingSizeLabel({ type: 'window', itemTag: 'vector-opening-linework-opening:vo-1', widthMm: 722 }, 'W1'), 'W1 · 722W · height to confirm');
assert.equal(openingSizeLabel({ type: 'door', label: 'vectorlineworkopening12345', heightMm: 2040 }, 'D2'), 'D2 · 2040H · width to confirm');
assert.equal(openingSizeLabel({ type: 'door' }, 'D3'), 'D3 · size to confirm');

// Quick edit: changes size, keeps position, withdraws an earlier approval; no change = same object.
const approved = approveOpening({ ...window, source: 'ai', x: 10, y: 20 }, '2026-11-09T00:00:00Z');
assert.equal(approved.builderConfirmedAt, '2026-11-09T00:00:00Z');
const edited = applyOpeningQuickEdit(approved, { heightMm: '2100', widthMm: '902', itemTag: 'W3 1809' }, 'e');
assert.equal(edited.heightMm, 2100); assert.equal(edited.x, 10); assert.equal(edited.y, 20);
assert.equal(edited.builderConfirmedAt, undefined, 'a corrected size must be approved again');
assert.equal(edited.builderEditedAt, 'e');
assert.equal(applyOpeningQuickEdit(approved, { heightMm: '1800', widthMm: '902', itemTag: 'W3 1809' }), approved);
assert.equal(applyOpeningQuickEdit(window, { heightMm: '' }).heightMm, null, 'cleared size is missing, not zero');

// Approval needs a full size and a confirmed type.
assert.equal(approveOpening({ ...window, widthMm: null }).builderConfirmedAt, undefined);
assert.equal(approveOpening({ ...door, needsClassification: true }).builderConfirmedAt, undefined);

console.log('PASS: opening markers - circle windows, triangle doors, review/approved/builder colours, size labels, quick edit and approval.');
