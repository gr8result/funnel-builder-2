export const DEFAULT_ROOM_COLOR = '#2563eb';

export function roomDisplayColor(room) {
  return /^#[0-9a-f]{6}$/i.test(room?.displayColor || '') ? room.displayColor : DEFAULT_ROOM_COLOR;
}

// Fill and outline by state: hovered translucent blue; approved (and locked) green; review amber;
// otherwise the builder's chosen colour, faint, so the drawing stays readable.
export function roomStatusAppearance(room = {}, hovered = false) {
  if (hovered) return { fill: 'rgba(37,99,235,0.30)', stroke: '#1d4ed8', dash: [] };
  if (room.reviewRequired || !room.polygon?.length) return { fill: room.selected ? 'rgba(245,158,11,0.32)' : 'rgba(245,158,11,0.14)', stroke: '#d97706', dash: [6, 4] };
  if (room.confirmed) return { fill: room.selected ? 'rgba(22,163,74,0.32)' : 'rgba(22,163,74,0.16)', stroke: room.boundaryLocked ? '#15803d' : '#16a34a', dash: [] };
  return { fill: roomDisplayFill(room, false), stroke: '#0284c7', dash: [] };
}

export function roomDisplayFill(room, hovered) {
  const color = roomDisplayColor(room);
  const rgb = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16));
  const alpha = room.selected ? .35 : hovered ? .28 : room.displayColor ? .12 : .01;
  return `rgba(${rgb.join(',')},${alpha})`;
}
