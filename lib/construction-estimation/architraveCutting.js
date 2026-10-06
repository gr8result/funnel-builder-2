/**
 * Architrave is bought in fixed lengths and cut to size, so the quantity is a cutting problem
 * rather than a division. Two things drive it:
 *
 *  - A piece is longer than the opening it trims. A door architrave starts at the floor, below the
 *    door itself, and runs past the head far enough to carry its mitre. A window is mitred at all
 *    four corners, so every piece is longer than its opening on both ends.
 *  - An offcut is not automatically waste. The 1620mm left after cutting two 1890mm heads from a
 *    5400mm length will trim a smaller window elsewhere in the job, so pieces are packed across
 *    every opening together rather than opening by opening.
 */
export const ARCHITRAVE_DEFAULTS = {
  stockLengthM: 5.4,
  /** Mitre allowance: a piece runs past the opening by the width of the architrave at each mitre. */
  widthMm: 45,
  /** A door architrave starts at the floor, below the door opening. */
  floorGapMm: 25,
};

/**
 * Openings are trimmed on the faces that are lined, and never along a door sill: internal (robe and
 * cavity included), entry/external and glass sliding/stacker doors take a head and two jambs; garage
 * doors take no architrave; a window is trimmed on all four sides unless it is full height (see
 * FULL_HEIGHT_WINDOW_MM).
 */
export const ARCHITRAVE_RULES = {
  "Internal Door": { sides: "head-and-jambs", faces: 2 },
  "External Door": { sides: "head-and-jambs", faces: 1 },
  "Large Glazed/Stacker/Sliding Door": { sides: "head-and-jambs", faces: 1 },
  "Garage Door": { sides: "none", faces: 0 },
  Window: { sides: "perimeter", faces: 1 },
  "Other Opening": { sides: "none", faces: 0 },
};

/** A window this tall (the same full-height rule brick sills use) runs to the floor like a door: head and two jambs, no sill. */
export const FULL_HEIGHT_WINDOW_MM = 2100;

const round = (value) => Math.round(value * 1000) / 1000;
const config = (options = {}) => ({ ...ARCHITRAVE_DEFAULTS, ...options });

/**
 * The pieces one opening needs, in metres, at their cut length rather than the opening size.
 * Returns null when the opening has not been measured, so a caller can refuse to total it rather
 * than counting it as zero.
 */
export function architravePieces(openingClass, widthMm, heightMm, options = {}) {
  const rule = ARCHITRAVE_RULES[openingClass];
  if (!rule || rule.sides === "none") return [];
  const { widthMm: trim, floorGapMm } = config(options);
  const width = Number(widthMm);
  const height = Number(heightMm);
  if (!(width > 0) || !(height > 0)) return null;
  const sides = openingClass === "Window" && height >= FULL_HEIGHT_WINDOW_MM ? "head-and-jambs" : rule.sides;
  // A head or sill is mitred at both ends; a jamb is mitred where it meets the head, and at the
  // sill too on a window. A door jamb runs to the floor instead.
  const head = round((width + (trim * 2)) / 1000);
  const jamb = sides === "perimeter"
    ? round((height + (trim * 2)) / 1000)
    : round((height + floorGapMm + trim) / 1000);
  const face = sides === "perimeter" ? [jamb, jamb, head, head] : [jamb, jamb, head];
  return Array.from({ length: rule.faces }, () => face).flat();
}

/**
 * First Fit Decreasing: cut the longest pieces first and start a new length only when a piece will
 * not fit in any length already open, so an earlier offcut is used before new stock is broken into.
 * Optimal bin packing is NP-hard; FFD is what happens at the saw and never needs more than about
 * 22% above the true optimum.
 */
export function packLengths(pieces, options = {}) {
  const { stockLengthM } = config(options);
  const stock = Number(stockLengthM) > 0 ? Number(stockLengthM) : ARCHITRAVE_DEFAULTS.stockLengthM;
  const cuts = [...pieces].filter((piece) => Number(piece) > 0).sort((a, b) => b - a);
  const requiredM = round(cuts.reduce((sum, piece) => sum + piece, 0));
  if (cuts.some((piece) => piece > stock)) return { lengths: null, requiredM, wasteM: null, offcuts: [], oversized: true };
  const remaining = [];
  for (const piece of cuts) {
    const bin = remaining.findIndex((free) => free >= piece - 1e-9);
    if (bin === -1) remaining.push(round(stock - piece));
    else remaining[bin] = round(remaining[bin] - piece);
  }
  return {
    lengths: remaining.length,
    requiredM,
    wasteM: round((remaining.length * stock) - requiredM),
    offcuts: remaining.filter((free) => free > 0.001).sort((a, b) => b - a),
    oversized: false,
  };
}

/**
 * Pack every opening in the job from one pool of stock, so an offcut left by a wide window is
 * available to a narrower one. Openings that were never measured are reported rather than counted
 * as zero.
 */
export function packOpenings(openings, options = {}) {
  const pieces = [];
  const unmeasured = [];
  const perClass = {};
  for (const opening of openings) {
    const cut = architravePieces(opening.openingClass, opening.widthMm, opening.heightMm, options);
    if (cut === null) { unmeasured.push(opening); continue; }
    if (!cut.length) continue;
    // One placed opening can stand for several identical ones (quantity), each trimmed in full.
    const quantity = Number.isFinite(Number(opening.quantity)) && Number(opening.quantity) > 0 ? Number(opening.quantity) : 1;
    // A head wider than one stock length (a very wide sliding/stacker opening) is joined on site from a full length
    // plus the remainder, rather than blocking the whole job total.
    const { stockLengthM } = config(options);
    const joined = cut.flatMap((piece) => piece > stockLengthM ? [...Array(Math.floor(piece / stockLengthM)).fill(stockLengthM), round(piece % stockLengthM)].filter((part) => part > 0) : [piece]);
    for (let copy = 0; copy < quantity; copy += 1) pieces.push(...joined);
    perClass[opening.openingClass] = round((perClass[opening.openingClass] || 0) + (cut.reduce((sum, piece) => sum + piece, 0) * quantity));
  }
  return { ...packLengths(pieces, options), unmeasured, perClass, pieceCount: pieces.length };
}
