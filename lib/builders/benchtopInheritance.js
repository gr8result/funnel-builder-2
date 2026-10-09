// "Use same benchtop as Main Benchtop" - the island inherits the main benchtop's product, colour
// and finish by default. Only the SELECTION is inherited: an island's length, depth and quantity
// are its own and are never read from, or written to, the main benchtop.
//
// Stored on the island area: sameAsMain (undefined = ON), and on an inherited surface
// inheritedFromAreaId. Turning the link OFF keeps the inherited surface as the starting point.
// Pure functions, no imports: used by the Client Selections workflow, the quotation engine and the
// schedule, so every module sees the same surface for every benchtop.
//
// The same shape serves any "match another selection" link: sourceArea -> target area.

export const ISLAND_AREA_ID = "benchtop-island";
export const MAIN_AREA_ID = "benchtop-main";

const text = (value) => String(value ?? "").trim();
const labelOf = (area = {}) => `${area.id || ""} ${area.label || ""}`;

export const isIslandArea = (area) => Boolean(area) && (area.id === ISLAND_AREA_ID || /\bisland\b/i.test(text(area.label)));
const isMainCandidate = (area) => Boolean(area) && !isIslandArea(area) && !/breakfast|return|peninsula/i.test(labelOf(area));

// The main benchtop: the area the room names "main", else the first wall run.
export function mainBenchtopArea(areas = []) {
  return areas.find((area) => area?.id === MAIN_AREA_ID) || areas.find(isMainCandidate) || null;
}

export const islandInheritsMain = (area) => isIslandArea(area) && area.sameAsMain !== false;

export function surfaceName(surface) {
  if (!surface || typeof surface !== "object") return "";
  return [surface.supplier, surface.colourName || surface.colour || surface.productName || surface.range || surface.materialChoice].map(text).filter(Boolean).join(" ");
}

// What makes two surfaces "the same selection" - product, colour, material and finish. The
// application label and the edge profile are applied per area and do not count.
export function surfaceSignature(surface) {
  if (!surface || typeof surface !== "object") return "";
  return [surface.productId || surface.id, surface.supplier, surface.colourName || surface.colour, surface.materialChoice, surface.finish || surface.selectedFinish || surface.surfaceFinish, surface.rangeKey].map(text).join("|");
}

const strip = ({ inheritedFromAreaId, inheritedFromLabel, ...surface }) => surface;

export function inheritedSurface(main, island) {
  if (!main?.surface) return null;
  return { ...strip(main.surface), applications: [text(island.label) || "Island benchtop"], inheritedFromAreaId: main.id, inheritedFromLabel: text(main.label) || "Main benchtop" };
}

// Every inheriting island takes the main benchtop's current surface (or none while the main has
// none). Areas that are independent, and every non-island area, are returned unchanged.
export function applyIslandInheritance(areas = []) {
  if (!Array.isArray(areas)) return areas;
  const main = mainBenchtopArea(areas);
  if (!main) return areas;
  return areas.map((area) => (islandInheritsMain(area) ? { ...area, sameAsMain: true, surface: inheritedSurface(main, area) } : area));
}

// The island's link switched ON or OFF.
//  OFF: the surface the island has now (the inherited one) stays, as the starting point.
//  ON : an independent island surface that differs from the main's is NOT replaced until
//       force = true; the caller shows `replacing` / `with` and asks first.
export function setIslandSameAsMain(areas = [], on, { force = false } = {}) {
  const island = areas.find(isIslandArea);
  const main = mainBenchtopArea(areas);
  if (!island || !main) return { areas, blocked: false };
  if (!on) {
    const current = island.surface ? strip(island.surface) : null;
    return { areas: areas.map((area) => (area === island ? { ...area, sameAsMain: false, surface: current } : area)), blocked: false };
  }
  const independent = island.sameAsMain === false && island.surface;
  if (independent && surfaceSignature(island.surface) !== surfaceSignature(main.surface) && !force) {
    return { areas, blocked: true, replacing: surfaceName(island.surface), with: surfaceName(main.surface) || "no benchtop selected yet" };
  }
  return { areas: applyIslandInheritance(areas.map((area) => (area === island ? { ...area, sameAsMain: true } : area))), blocked: false };
}
