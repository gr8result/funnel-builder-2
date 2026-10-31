// Floor-waste double-charge safeguard.
// The tiling floor-waste editor used to append a new identical line each time "Add" was pressed,
// so a room could hold several clone entries (same product, location, quantity and price) and the
// quotation charged each one. These helpers detect and collapse exact clones only; an entry that
// differs in any priced field is treated as a separate legitimate charge and kept.

export const floorWasteSignature = (waste = {}) => [
  waste.productId || "",
  String(waste.application || "").toLowerCase(),
  waste.linear ? "linear" : "point",
  waste.lengthMm || "",
  Number(waste.quantity) || 0,
  Number(waste.unitPrice) || 0,
].join("|");

// True when the room already has this product at this location (used to stop a second line being added).
export const roomHasFloorWaste = (room = {}, productId = "", application = "") =>
  (room.floorWastes || []).some((waste) => waste.productId === productId
    && String(waste.application || "").toLowerCase() === String(application || "").toLowerCase());

export function findDuplicateFloorWastes(rooms = []) {
  const findings = [];
  for (const room of rooms || []) {
    const seen = new Map();
    for (const waste of room?.floorWastes || []) {
      if (waste?.id) continue; // explicitly identified entries are never treated as clones
      const signature = floorWasteSignature(waste);
      seen.set(signature, [...(seen.get(signature) || []), waste]);
    }
    for (const [signature, copies] of seen) {
      if (copies.length < 2) continue;
      const extra = copies.slice(1);
      findings.push({
        roomId: room.id, roomName: room.name, signature, productName: copies[0].productName || "",
        copies: copies.length,
        extraChargeIncGst: Math.round(extra.reduce((sum, w) => sum + (Number(w.unitPrice) || 0) * (Number(w.quantity) || 0), 0) * 100) / 100,
      });
    }
  }
  return findings;
}

export function collapseDuplicateFloorWastes(rooms = []) {
  const removed = findDuplicateFloorWastes(rooms);
  if (!removed.length) return { rooms, removed };
  const next = rooms.map((room) => {
    const seen = new Set();
    const floorWastes = (room.floorWastes || []).filter((waste) => {
      if (waste?.id) return true;
      const signature = floorWasteSignature(waste);
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
    return floorWastes.length === (room.floorWastes || []).length ? room : { ...room, floorWastes };
  });
  return { rooms: next, removed };
}
