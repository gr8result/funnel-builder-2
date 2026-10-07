// Stair height geometry: the ONE calculation every module uses (Job Setup quantities, stair
// configuration, the saved stair selection that feeds Quotation Builder / BOQ / procurement).
//
//   floorToFloorMm      = lower level ceiling height + upper level floor system thickness
//   riserCount          = ceil(floorToFloorMm / maxRiserHeightMm)   (never rounded down)
//   actualRiserHeightMm = floorToFloorMm / riserCount
//
// A stair runs between each pair of consecutive included levels (Ground -> Second, Second ->
// Third ...), so nothing here assumes a two-storey house. Values come from Job Setup; a stair may
// override them for its own configuration (the original Job Setup value is kept beside it and
// Job Setup itself is never changed from here).

// Maximum riser height used by the stair configuration / estimating calculation (mm).
export const DEFAULT_MAX_RISER_HEIGHT_MM = 190;

const positive = (value) => { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : null; };

// Risers for one floor-to-floor height. 1e-9 only absorbs float noise so an exact multiple
// (3040 / 190 = 16) is not pushed up to 17.
export function stairRiserCalculation(floorToFloorMm, maxRiserHeightMm = DEFAULT_MAX_RISER_HEIGHT_MM) {
  const height = positive(floorToFloorMm);
  const max = positive(maxRiserHeightMm) ?? DEFAULT_MAX_RISER_HEIGHT_MM;
  if (!height) return { floorToFloorMm: null, maxRiserHeightMm: max, riserCount: null, actualRiserHeightMm: null };
  const riserCount = Math.ceil(height / max - 1e-9);
  return { floorToFloorMm: height, maxRiserHeightMm: max, riserCount, actualRiserHeightMm: height / riserCount };
}

// levels: [{ key, label, ceilingHeightMm, ceilingSource, floorThicknessMm, floorSource, floorSystem }]
// in order (ground first). Returns one flight per consecutive pair.
export function stairFlightsFromLevels(levels = []) {
  const flights = [];
  for (let index = 0; index + 1 < levels.length; index += 1) {
    const from = levels[index];
    const to = levels[index + 1];
    flights.push({
      flightKey: `${from.key}-${to.key}`,
      fromLevel: from.label,
      toLevel: to.label,
      label: `${from.label} to ${to.label}`,
      ceilingHeight: { valueMm: positive(from.ceilingHeightMm), source: from.ceilingSource || "", fieldKey: from.ceilingFieldKey || "", fieldLabel: `${from.label} ceiling height` },
      floorThickness: { valueMm: positive(to.floorThicknessMm), source: to.floorSource || "", fieldKey: to.floorFieldKey || "", fieldLabel: `${to.label} floor system`, floorSystem: to.floorSystem || "" },
    });
  }
  return flights;
}

// One flight with any stair-specific overrides applied. Overrides are kept separate from the Job
// Setup values, which stay visible for "Reset to Job Setup".
export function resolveStairFlight(flight = null, overrides = {}, { maxRiserHeightMm = DEFAULT_MAX_RISER_HEIGHT_MM } = {}) {
  if (!flight) return null;
  const field = (base, overrideValue) => {
    const override = positive(overrideValue);
    return { ...base, jobSetupMm: base.valueMm, valueMm: override ?? base.valueMm, overridden: override !== null && override !== base.valueMm };
  };
  const ceilingHeight = field(flight.ceilingHeight, overrides?.ceilingHeightMm);
  const floorThickness = field(flight.floorThickness, overrides?.floorThicknessMm);
  const floorToFloorMm = ceilingHeight.valueMm && floorThickness.valueMm ? ceilingHeight.valueMm + floorThickness.valueMm : null;
  const risers = stairRiserCalculation(floorToFloorMm, maxRiserHeightMm);
  return {
    ...flight,
    ceilingHeight,
    floorThickness,
    ...risers,
    complete: risers.riserCount !== null,
    explanation: floorToFloorMm ? `${ceilingHeight.valueMm}mm ceiling height + ${floorThickness.valueMm}mm floor system = ${floorToFloorMm}mm; ceil(${floorToFloorMm} / ${risers.maxRiserHeightMm}) = ${risers.riserCount} risers @ ${formatRiserHeight(risers.actualRiserHeightMm)}mm` : "",
  };
}

export function formatRiserHeight(value) {
  return value === null || value === undefined ? "" : (Math.round(value * 10) / 10).toFixed(1);
}

// The figures carried by a saved stair selection (quotation, BOQ, supplier scope read these).
export function stairHeightSnapshot(resolved = null) {
  if (!resolved) return null;
  return {
    flightKey: resolved.flightKey,
    flight: resolved.label,
    ceilingHeightMm: resolved.ceilingHeight.valueMm,
    ceilingHeightJobSetupMm: resolved.ceilingHeight.jobSetupMm,
    ceilingHeightOverridden: resolved.ceilingHeight.overridden,
    floorThicknessMm: resolved.floorThickness.valueMm,
    floorThicknessJobSetupMm: resolved.floorThickness.jobSetupMm,
    floorThicknessOverridden: resolved.floorThickness.overridden,
    floorSystem: resolved.floorThickness.floorSystem,
    floorToFloorMm: resolved.floorToFloorMm,
    maxRiserHeightMm: resolved.maxRiserHeightMm,
    riserCount: resolved.riserCount,
    actualRiserHeightMm: resolved.actualRiserHeightMm === null ? null : Math.round(resolved.actualRiserHeightMm * 100) / 100,
    explanation: resolved.explanation,
  };
}
