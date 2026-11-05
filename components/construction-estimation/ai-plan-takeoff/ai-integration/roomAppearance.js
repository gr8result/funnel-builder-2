export const DEFAULT_ROOM_COLOR = '#2563eb';

export function roomDisplayColor(room) {
  return /^#[0-9a-f]{6}$/i.test(room?.displayColor || '') ? room.displayColor : DEFAULT_ROOM_COLOR;
}

export function roomDisplayFill(room, hovered) {
  const color = roomDisplayColor(room);
  const rgb = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16));
  const alpha = room.selected ? .35 : hovered ? .28 : room.displayColor ? .12 : .01;
  return `rgba(${rgb.join(',')},${alpha})`;
}
