// Load-time safeguard for generated Client Selections tiling rows already stored on a job (ported
// from Quotation V1 7d510db, without its template rate schedule: owner rates now come from
// ownerQuotePrices.js).
//
// The old floor-waste editor appended the same floor waste to a tiling room more than once. Those
// copies are stored in the quotation as identical generated rows (same id, item, quantity and
// rate in one section) and each was charged. This pass:
//   1. keeps one of each exact clone of a generated tiling floor-waste row;
//   2. recounts that room's floor-waste / linear-drain labour from the floor wastes left.
// Saved selections, builder-typed rates and every other row are untouched. Safe to run repeatedly.

const TILING_SOURCE = "client-selections-tiling-room";
const tilingLabourKey = (row) => String(row?.id || "").match(/^tiling:.+:labour-([A-Za-z0-9]+)(?::from-.*)?$/)?.[1] || "";
const baseRowId = (row) => String(row?.legacyRowId || row?.id || "").replace(/:from-[a-z0-9-]+$/, "");
const isTilingWaste = (row) => row?.source === TILING_SOURCE && /^tiling:.+:waste-/.test(baseRowId(row));
const cloneKey = (row) => [baseRowId(row), String(row.item || ""), Number(row.quantity) || 0, String(row.excelRate ?? ""), String(row.manualRate ?? "")].join("|");

export function collapseDuplicateFloorWasteRows(quotation = {}) {
  if (!quotation || typeof quotation !== "object" || Array.isArray(quotation)) return quotation;
  let changed = false;
  const result = {};
  for (const [name, section] of Object.entries(quotation)) {
    const rows = Array.isArray(section?.rows) ? section.rows : null;
    if (!rows) { result[name] = section; continue; }
    const seen = new Set();
    const removedByRoom = new Set();
    let next = rows.filter((row) => {
      if (!isTilingWaste(row)) return true;
      const key = cloneKey(row);
      if (!seen.has(key)) { seen.add(key); return true; }
      removedByRoom.add(row.tilingRoomId || "");
      return false;
    });
    if (removedByRoom.size) {
      next = next.map((row) => {
        if (row?.source !== TILING_SOURCE) return row;
        const labourKey = tilingLabourKey(row);
        if ((labourKey !== "floorWasteQty" && labourKey !== "linearDrainQty") || !removedByRoom.has(row.tilingRoomId || "")) return row;
        const linear = labourKey === "linearDrainQty";
        const count = next.filter((item) => isTilingWaste(item) && (item.tilingRoomId || "") === (row.tilingRoomId || "") && /^Linear drain/i.test(String(item.item || "")) === linear)
          .reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
        if (count === Number(row.quantity)) return row;
        return { ...row, quantity: count, qty: count, quantityCorrection: { from: row.quantity, to: count, reason: "Duplicate floor-waste entries removed from the quotation" } };
      });
    }
    const sectionChanged = next.length !== rows.length || next.some((row, index) => row !== rows[index]);
    if (sectionChanged) changed = true;
    result[name] = sectionChanged ? { ...section, rows: next } : section;
  }
  return changed ? result : quotation;
}
