// A progress allocation is the share of a subcontract contract (e.g. the plumber's underslab stage) that falls due at one stage.
// It is a payment against a contract already priced in the quotation, so it never adds to a quotation, BOQ or variation total.
//
// row.progressAllocation = { stage, sourceSection, percent, manualAmount, remainder }
//   amount = manualAmount when set, else the balance of the contract when `remainder`, else percent x contract total.

export const UNDERSLAB_PROGRESS_DEFAULT = Object.freeze({ stage: "UNDERSLAB", sourceSection: "PLUMBING", percent: 25, manualAmount: "", remainder: false, milestoneKey: "UNDERSLAB" });

const TOLERANCE = 0.005;
const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;
const blank = (value) => String(value ?? "").trim() === "";
const parseNumber = (value) => (blank(value) ? null : Number(String(value).replace(/[$,%\s]/g, "")));

export function isProgressAllocationRow(row) {
  return Boolean(row && typeof row === "object" && row.progressAllocation);
}

export function formatAllocationMoney(value) {
  return `$${roundMoney(value).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Estimator edits. Percentage is kept as typed so an invalid entry is flagged, not silently replaced.
export function updateProgressAllocationField(row, key, value) {
  const current = row.progressAllocation || {};
  if (key === "progressPercent") return { ...row, progressAllocation: { ...current, percent: blank(value) ? UNDERSLAB_PROGRESS_DEFAULT.percent : String(value).replace(/[%\s]/g, "") } };
  if (key === "progressManualAmount") {
    const amount = parseNumber(value);
    return { ...row, progressAllocation: { ...current, manualAmount: amount === null ? "" : Number.isFinite(amount) ? formatAllocationMoney(amount) : String(value).trim() } };
  }
  return row;
}

// One contract: every allocation drawn against the same total. Returns a result per allocation key.
export function resolveProgressAllocations(contractTotal, allocations = []) {
  const total = roundMoney(contractTotal);
  const entries = allocations.map(({ key, allocation = {} }) => {
    const percent = parseNumber(allocation.percent ?? UNDERSLAB_PROGRESS_DEFAULT.percent);
    const override = parseNumber(allocation.manualAmount);
    const validPercent = percent !== null && Number.isFinite(percent) && percent >= 0 && percent <= 100;
    const validOverride = override === null || (Number.isFinite(override) && override >= 0);
    const hasOverride = override !== null && validOverride;
    return {
      key, allocation, percent, override: hasOverride ? roundMoney(override) : null,
      flags: [...(validPercent ? [] : ["INVALID_PERCENT"]), ...(validOverride ? [] : ["INVALID_OVERRIDE"])],
      calculated: validPercent ? roundMoney(total * percent / 100) : 0,
      remainder: Boolean(allocation.remainder) && !hasOverride,
    };
  });
  const fixed = entries.filter((entry) => !entry.remainder);
  const fixedTotal = roundMoney(fixed.reduce((sum, entry) => sum + (entry.override ?? entry.calculated), 0));
  const balance = Math.max(0, roundMoney(total - fixedTotal));
  let balanceTaken = false;
  const amounts = new Map(entries.map((entry) => {
    if (!entry.remainder) return [entry.key, entry.override ?? entry.calculated];
    if (balanceTaken) return [entry.key, 0];
    balanceTaken = true;
    return [entry.key, balance];
  }));
  const allocated = roundMoney([...amounts.values()].reduce((sum, amount) => sum + amount, 0));
  const overBy = allocated - total > TOLERANCE ? roundMoney(allocated - total) : 0;
  return new Map(entries.map((entry) => {
    const amount = amounts.get(entry.key);
    const mode = entry.override !== null ? "MANUAL_OVERRIDE" : entry.remainder ? "REMAINDER" : "PERCENT";
    const flags = [...entry.flags, ...(overBy ? ["OVER_ALLOCATED"] : [])];
    const percentText = entry.percent === null ? String(entry.allocation.percent ?? "") : `${entry.percent}%`;
    const formula = mode === "MANUAL_OVERRIDE" ? "Manual dollar override" : mode === "REMAINDER" ? "Contract total \u2212 other stage allocations" : `${percentText} \u00d7 contract total`;
    const working = mode === "MANUAL_OVERRIDE"
      ? `Manual override ${formatAllocationMoney(amount)} (percentage would give ${formatAllocationMoney(entry.calculated)})`
      : mode === "REMAINDER" ? `${formatAllocationMoney(total)} \u2212 ${formatAllocationMoney(fixedTotal)} = ${formatAllocationMoney(amount)}`
        : `${percentText} \u00d7 ${formatAllocationMoney(total)} = ${formatAllocationMoney(amount)}`;
    return [entry.key, {
      stage: entry.allocation.stage || "", contractTotal: total, percent: entry.percent, calculatedAmount: entry.calculated, manualOverride: entry.override,
      allocatedAmount: amount, mode, formula, working, flags, status: flags[0] || "OK",
      groupAllocated: allocated, remaining: roundMoney(total - allocated), overAllocatedBy: overBy,
    }];
  }));
}
