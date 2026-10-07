// One generic cladding-plank calculation for every job and every supported board.
// The job supplies the measurements, the product supplies the coverage, the formula produces
// the quantity. Nothing is rounded until display.

// PRODUCT DATA: effective board coverage (M2 per plank) for each cladding product, keyed by the
// Takeoff wall's exteriorFinish. quantityKey is where the result is published for the quotation.
export const CLADDING_PLANK_PRODUCTS = [
  { exteriorFinish: "James Hardie Linea Weatherboard - 150mm", label: "150mm JH Linea", boardCoverageM2: 0.55, quantityKey: "quote150LineaBoardPlankQty" },
  { exteriorFinish: "James Hardie Linea Weatherboard - 180mm", label: "180mm JH Linea", boardCoverageM2: 0.63, quantityKey: "quote180LineaBoardPlankQty" },
];

export const CLADDING_PLANK_FORMULA =
  "CEIL((SUM(Cladded wall LM × Ceiling height M, per level) - Applicable openings M2) ÷ Board coverage M2)";

// levels: [{ level, claddedWallLm, ceilingHeightM }]
export function calculateCladdingPlankQty({ levels = [], openingsAreaM2 = 0, boardCoverageM2 = 0 } = {}) {
  const claddedWallLm = levels.reduce((sum, level) => sum + (Number(level.claddedWallLm) || 0), 0);
  const grossCladdingM2 = levels.reduce((sum, level) => sum + (Number(level.claddedWallLm) || 0) * (Number(level.ceilingHeightM) || 0), 0);
  const netCladdingM2 = Math.max(0, grossCladdingM2 - (Number(openingsAreaM2) || 0));
  const exactPlankQty = boardCoverageM2 > 0 ? netCladdingM2 / boardCoverageM2 : 0;
  // The tolerance only stops float noise (e.g. 300.00000000000006) buying an extra plank.
  const plankQty = exactPlankQty > 0 ? Math.ceil(exactPlankQty - 1e-9) : 0;
  return { levels, claddedWallLm, grossCladdingM2, openingsAreaM2: Number(openingsAreaM2) || 0, netCladdingM2, boardCoverageM2, exactPlankQty, plankQty };
}

// The formula written out with one result's own inputs, for display (Calculations page, Selection).
export function claddingPlankWorkingText(result = {}) {
  const f = (value) => (Number(value) || 0).toFixed(2);
  const levels = (result.levels || []).filter((level) => Number(level.claddedWallLm) > 0);
  if (!levels.length) return "No walls with this cladding in the Takeoff";
  const gross = levels.map((level) => `${f(level.claddedWallLm)}LM × ${f(level.ceilingHeightM)}M`).join(" + ");
  return `CEIL((${gross} - ${f(result.openingsAreaM2)}m2 openings) ÷ ${f(result.boardCoverageM2)}m2)`
    + ` = CEIL(${f(result.netCladdingM2)} ÷ ${f(result.boardCoverageM2)}) = CEIL(${f(result.exactPlankQty)}) = ${result.plankQty} planks`;
}
