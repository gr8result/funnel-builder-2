// Room-by-room tiling quantities for Client Selections (Tiles & Stone).
//
// Pure functions: a tiled room's specification, dimensions, components and openings in, every tiled
// surface's net area out, then wastage, order area and boxes. Nothing is rounded before the final
// figures, and nothing is invented: a surface whose size depends on something not yet known (a
// single-row vanity splashback before its tile is chosen) is returned with area null and a reason.
//
// STANDARD TILING (bathroom / ensuite): shower walls to 2000mm, 600mm bath splashback, 250mm perimeter
// skirting, single-row vanity splashback, full floor.
// FLOOR TO CEILING: full floor + (perimeter x ceiling height - openings). Shower, bath and skirting
// wall areas are part of that wall area and are never added on top of it.
//
// UNITS. Every linear dimension a room stores is in MILLIMETRES (widthMm, lengthMm, heightMm, ...),
// the way builders measure. Areas are always m2: m2 = (a_mm x b_mm) / 1,000,000. Perimeter and run
// lengths are derived and reported in metres. A room saved before this convention held metres
// (widthM, lengthM, ...); tilingRoomInMm converts it, and every calculation runs through it, so an
// old saved room and a new one always calculate the same way.

export const TILING_SPECS = Object.freeze({ standard: "standard", floorToCeiling: "floor-to-ceiling" });
export const TILING_DIMENSION_UNIT = "mm";
export const STANDARD_SHOWER_TILE_HEIGHT_MM = 2000;
export const STANDARD_BATH_SPLASHBACK_HEIGHT_MM = 600;
export const STANDARD_SKIRTING_HEIGHT_MM = 250;
export const DEFAULT_TILE_WASTAGE_PCT = 10;
export const DEFAULT_KITCHEN_SPLASHBACK_HEIGHT_MM = 600;

const n = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};
// A stored millimetre dimension as metres, for the area / run-length arithmetic below.
const m = (valueMm) => n(valueMm) / 1000;
const round = (value, places = 2) => Math.round(value * 10 ** places) / 10 ** places;
const mmText = (valueM) => `${Math.round(valueM * 1000)}mm`;

// ---------------------------------------------------------------------------------------------
// Metres -> millimetres for rooms saved before the mm convention
// ---------------------------------------------------------------------------------------------

// No room, wall, shower or splashback is 30 metres long, and none is under 30 millimetres. So a
// value above 30 in a field that was labelled "m" was typed in millimetres despite the label
// (3000 for a 3m splashback) and is kept as it is; anything else is metres and is multiplied out.
export const LEGACY_METRE_LIMIT = 30;
function legacyToMm(value, assumed, field) {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "";
  if (number > LEGACY_METRE_LIMIT) { assumed.push(field); return Math.round(number); }
  return Math.round(number * 1000);
}

// Returns the room with every linear dimension in millimetres. A room already in millimetres is
// returned unchanged (same object), so this is safe to run on every read.
export function tilingRoomInMm(room = {}) {
  if (!room || room.dimensionUnit === TILING_DIMENSION_UNIT) return room;
  const assumed = [];
  const convert = (source = {}, fields, path) => {
    const next = { ...source };
    for (const [from, to] of fields) {
      if (!(from in next)) continue;
      next[to] = Array.isArray(next[from]) ? next[from].map((value, index) => legacyToMm(value, assumed, `${path}.${to}[${index}]`)) : legacyToMm(next[from], assumed, `${path}.${to}`);
      delete next[from];
    }
    return next;
  };
  const components = { ...(room.components || {}) };
  if (components.shower) components.shower = convert(components.shower, [["widthM", "widthMm"], ["lengthM", "lengthMm"], ["heightM", "heightMm"], ["wallLengthsLm", "wallLengthsMm"]], "shower");
  if (components.bath) components.bath = convert(components.bath, [["lengthsLm", "lengthsMm"], ["splashbackHeightM", "splashbackHeightMm"]], "bath");
  if (components.vanity) components.vanity = convert(components.vanity, [["widthM", "widthMm"], ["customHeightM", "customHeightMm"]], "vanity");
  if (components.feature?.walls) components.feature = { ...components.feature, walls: components.feature.walls.map((wall, index) => convert(wall, [["widthM", "widthMm"], ["heightM", "heightMm"]], `feature[${index}]`)) };
  return {
    ...room,
    dimensionUnit: TILING_DIMENSION_UNIT,
    geometry: convert(room.geometry, [["widthM", "widthMm"], ["lengthM", "lengthMm"], ["ceilingHeightM", "ceilingHeightMm"], ["perimeterLm", "perimeterMm"]], "geometry"),
    components,
    ...(room.splashback ? { splashback: convert(room.splashback, [["lengthM", "lengthMm"], ["heightM", "heightMm"]], "splashback") } : {}),
    // Fields whose saved value was already millimetres under a metre label: shown for checking.
    ...(assumed.length ? { dimensionMigration: { from: "m", keptAsMm: assumed } } : {}),
  };
}

// Room types and the tiled surfaces each one CAN have. A room is only ever judged on the surfaces
// that apply to it (tilingRoomStatus): a kitchen is a splashback, an alfresco is a floor.
// floorOptional: the floor is not tiled unless the builder says it is (room.floorTiled === true).
// floorOnly: a SIMPLE FLOOR TILING AREA (alfresco, patio, balcony, entry, hallway ...) - an area in
// m2 and a floor tile, nothing else. These are listed as rows under Additional Floor Tiling, never
// taken through the room workflow, and get an upstand only if one is explicitly asked for.
export const TILING_ROOM_TYPES = Object.freeze([
  { type: "bathroom", label: "Bathroom", wet: true, spec: true, components: ["shower", "bath", "vanity", "toilet"] },
  { type: "ensuite", label: "Ensuite", wet: true, spec: true, components: ["shower", "bath", "vanity", "toilet"] },
  { type: "powder-room", label: "Powder Room", wet: true, spec: true, components: ["vanity", "toilet"] },
  { type: "laundry", label: "Laundry", wet: true, spec: false, surfaces: ["floor", "skirting", "tub-splashback"] },
  { type: "kitchen", label: "Kitchen", wet: false, spec: false, floorOptional: true, surfaces: ["splashback", "floor"] },
  { type: "butlers-pantry", label: "Butler's Pantry", wet: false, spec: false, surfaces: ["splashback", "floor"] },
  { type: "alfresco", label: "Alfresco", wet: false, spec: false, external: true, floorOnly: true, surfaces: ["floor"] },
  { type: "balcony", label: "Balcony", wet: true, spec: false, external: true, floorOnly: true, surfaces: ["floor", "skirting"] },
  { type: "patio", label: "Patio", wet: false, spec: false, external: true, floorOnly: true, surfaces: ["floor"] },
  { type: "porch", label: "Porch", wet: false, spec: false, external: true, floorOnly: true, surfaces: ["floor"] },
  { type: "verandah", label: "Verandah", wet: false, spec: false, external: true, floorOnly: true, surfaces: ["floor"] },
  { type: "terrace", label: "Terrace", wet: false, spec: false, external: true, floorOnly: true, surfaces: ["floor", "skirting"] },
  { type: "pool-area", label: "Pool Area", wet: true, spec: false, external: true, pool: true, floorOnly: true, surfaces: ["floor"] },
  { type: "entry", label: "Entry", wet: false, spec: false, floorOnly: true, surfaces: ["floor"] },
  { type: "hallway", label: "Hallway", wet: false, spec: false, floorOnly: true, surfaces: ["floor"] },
  { type: "other", label: "Other", wet: false, spec: false, floorOnly: true, surfaces: ["floor"] },
]);
export const tilingRoomType = (type) => TILING_ROOM_TYPES.find((item) => item.type === type) || TILING_ROOM_TYPES.at(-1);
export const isFloorAreaRoom = (room = {}) => Boolean(tilingRoomType(room.type).floorOnly);
// External or internal: the builder's choice on the row, else what the area type implies.
export const roomIsExternal = (room = {}) => (typeof room.external === "boolean" ? room.external : Boolean(tilingRoomType(room.type).external));

// Whether the room's floor is tiled: the builder's explicit choice, else the room type's default.
export function roomFloorTiled(room = {}) {
  const type = tilingRoomType(room.type);
  if (!type.spec && !(type.surfaces || []).includes("floor")) return false;
  if (room.floorTiled === true || room.floorTiled === false) return room.floorTiled;
  return !type.floorOptional;
}

// geometry: a room's geometry in millimetres (widthMm, lengthMm, ceilingHeightMm; custom rooms give
// floorAreaM2 and perimeterMm). Returns the derived figures: area in m2, lengths in metres.
export function roomGeometry(geometry = {}) {
  const custom = geometry.mode === "custom";
  const width = m(geometry.widthMm);
  const length = m(geometry.lengthMm);
  const floorAreaM2 = custom ? n(geometry.floorAreaM2) : width * length;
  const perimeterLm = custom ? m(geometry.perimeterMm) : (width && length ? (width + length) * 2 : 0);
  return { floorAreaM2, perimeterLm, ceilingHeightM: m(geometry.ceilingHeightMm), complete: Boolean(floorAreaM2) };
}

// Shower walls: 2 tiled walls = one width + one length; 3 = back wall (width) + both sides (length).
// Any explicitly entered tiled wall lengths win. Returned in metres.
export function showerWallLengthLm(shower = {}) {
  const entered = (shower.wallLengthsMm || []).map(m).filter(Boolean);
  if (entered.length) return entered.reduce((sum, value) => sum + value, 0);
  const width = m(shower.widthMm);
  const length = m(shower.lengthMm);
  return Number(shower.tiledWalls) === 3 ? width + 2 * length : width + length;
}

export const openingAreaM2 = (openings = []) => openings.reduce((sum, opening) => sum + (n(opening.widthMm) / 1000) * (n(opening.heightMm) / 1000) * (n(opening.quantity) || 1), 0);
const doorWidthLm = (openings = []) => openings.filter((opening) => opening.type === "door").reduce((sum, opening) => sum + (n(opening.widthMm) / 1000) * (n(opening.quantity) || 1), 0);

// Row height of a single-row splashback: the tile's short side (laid landscape).
export function singleRowHeightM(tile = null) {
  const length = n(tile?.attributes?.tileLengthMm ?? tile?.tileLengthMm);
  const width = n(tile?.attributes?.tileWidthMm ?? tile?.tileWidthMm);
  const shortSide = Math.min(...[length, width].filter(Boolean));
  return Number.isFinite(shortSide) && shortSide > 0 ? shortSide / 1000 : 0;
}

const surface = (key, label, slot, labour, areaM2, extra = {}) => ({ key, label, slot, labour, areaM2: areaM2 === null ? null : Math.max(0, areaM2), ...extra });

// Every tiled surface of one room. `tiles` resolves the product chosen for a slot (for sizes).
export function roomTileSurfaces(sourceRoom = {}, { tiles = {} } = {}) {
  const room = tilingRoomInMm(sourceRoom);
  const type = tilingRoomType(room.type);
  const geo = roomGeometry(room.geometry);
  const components = room.components || {};
  const openings = room.openings || [];
  const feature = components.feature?.enabled ? (components.feature.walls || []).reduce((sum, wall) => sum + m(wall.widthMm) * m(wall.heightMm), 0) : 0;
  const featureReplacesWall = components.feature?.enabled && components.feature.replacesWallTiles !== false;
  const surfaces = [];
  const floorBase = Math.max(0, geo.floorAreaM2 - n(room.floorDeductionM2));

  if (type.spec) {
    surfaces.push(surface("floor", "Floor tiles", "floor", "floor", floorBase));
    if (room.spec === TILING_SPECS.floorToCeiling) {
      const gross = geo.perimeterLm * geo.ceilingHeightM;
      const openingsM2 = openingAreaM2(openings);
      surfaces.push(surface("walls", "Wall tiles (floor to ceiling)", "wall", "wall", gross - openingsM2 - (featureReplacesWall ? feature : 0), {
        grossM2: gross, openingsM2, featureM2: featureReplacesWall ? feature : 0,
        working: `${round(geo.perimeterLm).toFixed(2)}m perimeter × ${mmText(geo.ceilingHeightM)} = ${round(gross)}m² − ${round(openingsM2)}m² openings${featureReplacesWall && feature ? ` − ${round(feature)}m² feature` : ""}`,
      }));
    } else if (room.spec === TILING_SPECS.standard) {
      const shower = components.shower?.enabled ? components.shower : null;
      const bath = components.bath?.enabled ? components.bath : null;
      const vanity = components.vanity?.enabled ? components.vanity : null;
      if (shower) {
        const lengthLm = showerWallLengthLm(shower);
        const height = m(shower.heightMm || STANDARD_SHOWER_TILE_HEIGHT_MM);
        surfaces.push(surface("shower-walls", "Shower wall tiles", "wall", "wall", lengthLm * height - (featureReplacesWall ? Math.min(feature, lengthLm * height) : 0), { lengthLm, heightM: height, working: `${mmText(lengthLm)} × ${mmText(height)}` }));
      }
      if (bath) {
        const lengthLm = (bath.lengthsMm || []).map(m).reduce((sum, value) => sum + value, 0);
        const height = m(bath.splashbackHeightMm || STANDARD_BATH_SPLASHBACK_HEIGHT_MM);
        surfaces.push(surface("bath-splashback", "Bath splashback", "wall", "splashback", lengthLm * height, { lengthLm, heightM: height, working: `${mmText(lengthLm)} × ${mmText(height)}` }));
      }
      if (vanity) {
        const custom = vanity.splashback === "custom";
        const tile = tiles.splashback || tiles.wall || null;
        const height = custom ? m(vanity.customHeightMm) : singleRowHeightM(tile);
        surfaces.push(surface("vanity-splashback", custom ? "Vanity splashback (custom height)" : "Vanity splashback (single row)", tiles.splashback ? "splashback" : "wall", "splashback", height ? m(vanity.widthMm) * height : null, {
          lengthLm: m(vanity.widthMm), heightM: height || null, pendingReason: height ? "" : "Single row - calculated once the splashback / wall tile is chosen",
          working: height ? `${mmText(m(vanity.widthMm))} × ${mmText(height)}` : "Single row",
        }));
      }
      // Skirting runs the room perimeter except where the wall is already tiled from the floor
      // (shower walls), hidden behind a bath, or open (doorways).
      const skirtingLm = Math.max(0, geo.perimeterLm - (shower ? showerWallLengthLm(shower) : 0) - (bath ? (bath.lengthsMm || []).map(m).reduce((sum, value) => sum + value, 0) : 0) - doorWidthLm(openings));
      surfaces.push(surface("skirting", "Skirting tiles (250mm)", "floor", "skirting", skirtingLm * m(STANDARD_SKIRTING_HEIGHT_MM), { lengthLm: skirtingLm, heightM: m(STANDARD_SKIRTING_HEIGHT_MM), working: `${round(skirtingLm).toFixed(2)}m × ${STANDARD_SKIRTING_HEIGHT_MM}mm` }));
    }
  } else {
    const wants = new Set(type.surfaces || []);
    if (wants.has("floor") && roomFloorTiled(room)) surfaces.push(surface("floor", roomIsExternal(room) ? "External floor tiles" : "Floor tiles", "floor", "floor", floorBase));
    if (wants.has("skirting") && (type.floorOnly ? room.skirting === true : room.skirting !== false) && roomFloorTiled(room)) {
      const skirtingLm = Math.max(0, geo.perimeterLm - doorWidthLm(openings));
      surfaces.push(surface("skirting", "Skirting tiles (250mm)", "floor", "skirting", skirtingLm * m(STANDARD_SKIRTING_HEIGHT_MM), { lengthLm: skirtingLm, heightM: m(STANDARD_SKIRTING_HEIGHT_MM), working: `${round(skirtingLm).toFixed(2)}m × ${STANDARD_SKIRTING_HEIGHT_MM}mm` }));
    }
    for (const key of ["splashback", "tub-splashback"]) {
      if (!wants.has(key)) continue;
      const entry = room.splashback || {};
      const height = m(entry.heightMm || (key === "splashback" ? DEFAULT_KITCHEN_SPLASHBACK_HEIGHT_MM : 0));
      surfaces.push(surface(key, key === "splashback" ? "Splashback" : "Tub splashback", "splashback", "splashback", height ? m(entry.lengthMm) * height : null, {
        lengthLm: m(entry.lengthMm), heightM: height || null, pendingReason: height ? "" : "Enter the splashback height", working: height ? `${mmText(m(entry.lengthMm))} × ${mmText(height)}` : "",
      }));
    }
  }
  if (feature) surfaces.push(surface("feature", "Feature wall tiles", "feature", "feature", feature, { working: (components.feature.walls || []).map((wall) => `${n(wall.widthMm)}mm × ${n(wall.heightMm)}mm`).join(" + ") }));
  if (n(room.mosaicAreaM2)) surfaces.push(surface("mosaic", "Mosaic tiles", "mosaic", "mosaic", n(room.mosaicAreaM2)));
  return surfaces;
}

// Wastage, order area and boxes for one net area of one tile.
export function tileOrder(netAreaM2, { wastagePct = DEFAULT_TILE_WASTAGE_PCT, boxCoverageM2 = 0 } = {}) {
  const net = Math.max(0, Number(netAreaM2) || 0);
  const pct = Number.isFinite(Number(wastagePct)) && Number(wastagePct) >= 0 ? Number(wastagePct) : DEFAULT_TILE_WASTAGE_PCT;
  const orderAreaM2 = net * (1 + pct / 100);
  const coverage = n(boxCoverageM2);
  // Never round a tile requirement down: 1e-9 only absorbs float noise.
  const boxes = coverage && orderAreaM2 ? Math.ceil(orderAreaM2 / coverage - 1e-9) : null;
  return { netAreaM2: net, wastagePct: pct, orderAreaM2, boxCoverageM2: coverage || null, boxes, suppliedAreaM2: boxes ? boxes * coverage : null };
}

// Everything one room needs downstream: surfaces with products, orders, labour and floor wastes.
export function calculateTilingRoom(sourceRoom = {}, { productById = () => null } = {}) {
  const room = tilingRoomInMm(sourceRoom);
  const slots = room.products || {};
  const tiles = Object.fromEntries(Object.entries(slots).map(([slot, id]) => [slot, id ? productById(id) : null]));
  const geometry = roomGeometry(room.geometry);
  const wastagePct = room.wastagePct ?? DEFAULT_TILE_WASTAGE_PCT;
  const surfaces = roomTileSurfaces(room, { tiles }).map((item) => {
    const tile = tiles[item.slot] || (item.slot === "splashback" ? tiles.wall : null) || null;
    const order = item.areaM2 === null ? null : tileOrder(item.areaM2, { wastagePct, boxCoverageM2: tile?.attributes?.boxCoverageM2 });
    return { ...item, productId: tile?.productId || "", product: tile, order };
  });
  const labour = { floorM2: 0, wallM2: 0, featureM2: 0, mosaicM2: 0, splashbackM2: 0, skirtingM2: 0, skirtingLm: 0 };
  for (const item of surfaces) {
    const area = item.areaM2 || 0;
    if (item.labour === "floor") labour.floorM2 += area;
    else if (item.labour === "wall") labour.wallM2 += area;
    else if (item.labour === "feature") labour.featureM2 += area;
    else if (item.labour === "mosaic") labour.mosaicM2 += area;
    else if (item.labour === "splashback") labour.splashbackM2 += area;
    else if (item.labour === "skirting") { labour.skirtingM2 += area; labour.skirtingLm += item.lengthLm || 0; }
  }
  const wastes = (room.floorWastes || []).filter((waste) => waste.productId && n(waste.quantity));
  labour.floorWasteQty = wastes.filter((waste) => !waste.linear).reduce((sum, waste) => sum + n(waste.quantity), 0);
  labour.linearDrainQty = wastes.filter((waste) => waste.linear).reduce((sum, waste) => sum + n(waste.quantity), 0);
  return { geometry, surfaces, labour, floorWastes: wastes, floorWasteCount: labour.floorWasteQty + labour.linearDrainQty };
}

export const formatM2 = (value) => (value === null || value === undefined ? "—" : `${round(Number(value) || 0).toFixed(2)}m²`);
export const formatLm = (value) => `${round(Number(value) || 0).toFixed(2)} m`;
export const formatMm = (value) => (n(value) ? `${Math.round(n(value))} mm` : "—");

// ---------------------------------------------------------------------------------------------
// Room completion
// ---------------------------------------------------------------------------------------------
// A room is COMPLETE when every tiled surface that applies to it has its dimensions and its tile,
// and the room has been confirmed. Surfaces the room does not have (a kitchen has no shower) are
// never asked for, and a surface the builder marked as not tiled is a decision, not a gap.
// Returns { status: "not_started" | "incomplete" | "complete", ready, missing[], decisions[] }.
export function tilingRoomStatus(sourceRoom = {}, { productById = () => null } = {}) {
  const room = tilingRoomInMm(sourceRoom);
  const type = tilingRoomType(room.type);
  const result = calculateTilingRoom(room, { productById });
  const components = room.components || {};
  const missing = [];
  const need = (text) => { if (!missing.includes(text)) missing.push(text); };
  const tileName = (label) => label.replace(/\s*\(.*\)$/, "").replace(/ tiles?$/i, "");
  const slotsAsked = new Set();
  if (type.spec && !room.spec) need("Tiling specification not chosen");
  else {
    if (!result.surfaces.length) need("Nothing in this room is marked as tiled");
    for (const item of result.surfaces) {
      const name = tileName(item.label);
      if (item.key === "skirting" && !(item.areaM2 > 0) && !result.geometry.complete) continue; // reported by the floor
      if (item.areaM2 === null) {
        // A single-row splashback has no height until its tile is chosen; anything else is a dimension.
        if (/single row/i.test(item.pendingReason || "")) { if (!item.lengthLm) need("Vanity width not entered"); need("Wall or splashback tile not selected (sets the single-row vanity splashback)"); }
        else need(`${name}: ${String(item.pendingReason || "dimensions not entered").replace(/^Enter the /, "").replace(/^./, (letter) => letter.toLowerCase())} not entered`.replace("not entered not entered", "not entered"));
        continue;
      }
      if (!(item.areaM2 > 0)) {
        if (item.key === "floor") need(type.floorOnly ? "Area not entered" : "Room dimensions not entered");
        else if (item.key === "walls") need("Room dimensions and ceiling height not entered");
        else if (item.key === "shower-walls") { if (!showerWallLengthLm(components.shower)) need("Shower dimensions not entered"); }
        else if (item.key === "bath-splashback") need("Tiled bath length not entered");
        else if (item.key === "splashback" || item.key === "tub-splashback") need(`${name} length not entered`);
        else if (item.key === "vanity-splashback") need("Vanity width not entered");
        continue;
      }
      // Surfaces sharing a tile (floor + skirting, shower walls + bath splashback) ask for it once.
      if (!item.product && !slotsAsked.has(item.slot)) { slotsAsked.add(item.slot); need(`${name} tile not selected`); }
    }
    if (components.feature?.enabled && !result.surfaces.some((item) => item.key === "feature")) need("Feature wall dimensions not entered");
  }
  // Explicit "not tiled" / "not required" decisions - shown, and never counted as missing.
  const decisions = [];
  const surfaces = type.surfaces || [];
  if (!type.spec && surfaces.includes("floor") && surfaces.length > 1 && !roomFloorTiled(room)) decisions.push({ label: "Floor tiles", state: "Not tiled" });
  if (!type.spec && !type.floorOnly && surfaces.includes("skirting") && room.skirting === false) decisions.push({ label: type.external ? "Upstand / skirting tiles" : "Skirting tiles", state: "Not required" });
  const started = Boolean(room.spec) || result.geometry.complete || Object.values(room.products || {}).some(Boolean) || n(room.splashback?.lengthMm) > 0 || Boolean(room.confirmed);
  const ready = missing.length === 0;
  return { status: ready && room.confirmed ? "complete" : started ? "incomplete" : "not_started", ready, confirmed: Boolean(room.confirmed), missing, decisions };
}
