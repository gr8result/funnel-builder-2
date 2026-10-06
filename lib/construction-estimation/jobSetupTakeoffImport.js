import { withTakeoffJambQuoteRows } from './takeoffProcurement.js';
import { V4_DATA_SECTIONS } from "./estimateWorksheetV4Schema.js";
import { INPUT_DATA_SHEET_TEMPLATE } from "./inputDataSheetTemplate.js";

const INPUT_ROWS = new Map(V4_DATA_SECTIONS.find((section) => section.key === "inputDataSheet").rows.map((row) => [row.key, row]));
const TEMPLATE_ROWS = new Map(INPUT_DATA_SHEET_TEMPLATE.rows.map((row) => [row.key, row]));
const own = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
const blank = (value) => value === null || value === undefined || (typeof value === "string" && !value.trim());
const nonempty = (value) => !blank(value);

// These jamb/cage quantities are marked editable in the template only so a job with no AI Plan
// Takeoff attached can still have them entered by hand (e.g. a manual estimate). Once a Takeoff DOES
// supply a value for one of these keys, that recalculation is the correct quantity for the current
// opening set and must always win on reapply - there is no legitimate scenario where a builder wants
// to keep an old jamb-stock or cage-count number instead of the freshly reconciled one, so the
// general manual-override protection (built for values someone deliberately hand-typed to differ
// from what the Takeoff computes, e.g. a manual measurement correction) does not apply to these
// keys. totalCavitySliderCagesEach joins the two jamb keys here for the same reason: it is the
// persisted aggregate behind the "90mm Cavity Slider Cages" row, populated only by Apply Takeoff
// (calculated: false, editable: true) - a stale count from an earlier Takeoff state (e.g. from
// before some openings were reclassified as cavity sliders, or after some were reclassified away
// from cavity sliders) would otherwise survive a reapply exactly like the jamb keys did, while the
// live size-breakdown rows underneath it (cavitySliderSize_* - not persisted, recomputed on every
// render) move on and disagree with it. This is intentionally narrow: it does not change
// manual-override behaviour for any other field.
const ALWAYS_TRUST_TAKEOFF_KEYS = new Set(["jamb90x19StockLengthsEach", "jamb110x19StockLengthsEach", "totalCavitySliderCagesEach"]);

function unitFor(row, metadata) {
  if (row.unit) return row.unit;
  if (metadata?.unit) return metadata.unit;
  if (/M2$/.test(row.key)) return "M2";
  if (/M3$/.test(row.key)) return "M3";
  if (/Lm$/.test(row.key)) return "LM";
  if (/Mm$/.test(row.key)) return "MM";
  if (/CeilingHeight$/.test(row.key)) return "MM";
  return "";
}

function isNumeric(row) {
  if (row.options?.some((option) => !Number.isFinite(Number(option)))) return false;
  return Boolean(unitFor(row)) || /(?:Qty|Count|Percent|Degrees)$/.test(row.key);
}

function validValue(value, row) {
  if (blank(value)) return false;
  if (typeof value !== "string" && typeof value !== "number") return false;
  if (typeof value === "number" && (!Number.isFinite(value) || value < 0)) return false;
  if (isNumeric(row)) return Number.isFinite(Number(value)) && Number(value) >= 0;
  if (row.options?.length) return row.options.includes(String(value).trim());
  return true;
}

function equalValues(a, b, row) {
  if (blank(a) || blank(b)) return blank(a) && blank(b);
  return isNumeric(row) ? Number(a) === Number(b) : String(a).trim() === String(b).trim();
}

/**
 * A takeoff carries the project it was measured under. That id goes stale whenever the
 * takeoff was traced before the job was registered, or the job was re-saved under a new id,
 * so a mismatch is a prompt to check the plan rather than proof the takeoff is the wrong one.
 * Returns null when the ids agree, otherwise the detail needed to describe the difference.
 */
export function describeProjectMismatch(workbook = {}, payload = {}) {
  const owner = String(payload?.provenance?.jobId || "").trim();
  const sourceId = owner || String(payload?.provenance?.projectId || "").trim();
  const targetIds = (owner ? [workbook.jobId] : [workbook?.jobId, workbook?.projectId, workbook?.commercialProjectId, workbook?.registeredJob?.projectId, workbook?.registeredJob?.id, workbook?.registeredJob?.jobId])
    .map((id) => String(id || "").trim()).filter(Boolean);
  if (!sourceId || !targetIds.length || targetIds.includes(sourceId)) return null;
  const sourceName = String(payload?.schedule?.project?.projectName || payload?.projectName || "").trim();
  const sourceClient = String(payload?.schedule?.project?.clientName || payload?.clientName || "").trim();
  const targetName = String(workbook?.data?.inputDataSheet?.rows?.projectName?.value || workbook?.registeredJob?.projectName || "").trim();
  const targetClient = String(workbook?.data?.inputDataSheet?.rows?.clientName?.value || "").trim();
  return {
    sourceId,
    sourceName,
    sourceClient,
    targetId: targetIds[0],
    targetName,
    targetClient,
    clientMatches: Boolean(sourceClient && targetClient && sourceClient.toLowerCase() === targetClient.toLowerCase()),
    message: `This takeoff records a different project id to the open job: ${sourceName ? `"${sourceName}"` : "an unnamed project"} (${sourceId}) rather than ${targetName ? `"${targetName}"` : "this job"} (${targetIds[0]}). Confirm the plan is this job's before importing.`,
  };
}

function projectMismatch(workbook, payload, options = {}) {
  if (options.allowProjectMismatch && !payload?.provenance?.jobId) return "";
  return describeProjectMismatch(workbook, payload)?.message || "";
}

function importedFieldHistory(workbook) {
  const sync = workbook?.takeoffEngine?.lastJobSetupSync;
  if (sync?.importedFields || sync?.appliedFields) return sync.importedFields || sync.appliedFields;
  return Object.fromEntries(Object.entries(sync?.payload?.dataInputFields || {}).map(([key, value]) => [key, {
    value,
    source: "AI Plan Takeoff schedule",
    provenance: { ...(sync?.payload?.provenance || {}) },
    syncedAt: sync?.syncedAt || "",
  }]));
}

function previousImportedValue(workbook, key) {
  const sync = workbook?.takeoffEngine?.lastJobSetupSync;
  const imported = sync?.importedFields || sync?.appliedFields;
  if (own(imported, key)) {
    const entry = imported[key];
    return { found: true, value: entry && typeof entry === "object" ? entry.value : entry };
  }
  // Older imports wrote every dataInputFields entry, before selection was supported.
  if (!imported && own(sync?.payload?.dataInputFields, key)) {
    return { found: true, value: sync.payload.dataInputFields[key] };
  }
  return { found: false };
}

function unavailableReason(workbook, key, value, metadata) {
  const definition = INPUT_ROWS.get(key);
  const template = TEMPLATE_ROWS.get(key);
  const section = workbook?.data?.inputDataSheet;
  const saved = section?.rows?.[key];
  if (!definition || template?.editable !== true || definition.heading) return "No editable Job Setup destination exists.";
  if (!own(section?.rows, key) || !saved || typeof saved !== "object") return "The Job Setup row is missing.";
  if (section.hiddenRows?.includes(key) || saved.deleted || saved.deletedAt) return "The Job Setup row has been deleted.";
  const custom = section.customRows?.find((row) => row.key === key);
  if (definition.calculated || saved.calculated || custom?.calculated || saved.editable === false) return "This Job Setup row is calculated or read only.";
  // Editable roof-plan inputs have descriptive fallback text in the template's
  // formula column. That text is not an executable or user-authored formula and
  // must not block a measured override of these existing editable fields.
  const roofFallback = /^(lower|upper|third)RoofPlanAreaM2$/.test(key) && template?.calculated === false;
  const formulas = [workbook.formulas?.[key], saved.formula, custom?.formula, definition.defaultFormula]
    .filter((formula) => !(roofFallback && formula === template.formula));
  if (formulas.some(nonempty)) return "This Job Setup row uses a formula.";
  if (metadata?.status === "missing" || metadata?.status === "unavailable") return metadata.reason || "The takeoff has no measured value for this row.";
  if (blank(value)) return "The takeoff has no measured value for this row.";
  if (!validValue(value, definition)) return isNumeric(definition)
    ? "The takeoff quantity must be a finite, non-negative number."
    : "The takeoff value is invalid for this Job Setup row.";
  return "";
}

/** Missing measurements retain inputs; explicitly removed measurements can update their own prior imports. */
export function createJobSetupImportPreview(workbook = {}, payload = {}, options = {}) {
  const warnings = Array.isArray(payload.warnings) ? payload.warnings.filter((warning) => typeof warning === "string") : [];
  const mismatchDetail = describeProjectMismatch(workbook, payload);
  const mismatch = projectMismatch(workbook, payload, options);
  if (mismatchDetail) warnings.push(mismatchDetail.message);
  const metadata = new Map((Array.isArray(payload.mappingPreview) ? payload.mappingPreview : []).map((row) => [row.destinationKey, row]));
  const fields = payload.dataInputFields && typeof payload.dataInputFields === "object" && !Array.isArray(payload.dataInputFields) ? { ...payload.dataInputFields } : {};
  const previousSync = workbook?.takeoffEngine?.lastJobSetupSync;
  const previousTakeoffId = previousSync?.takeoffId || previousSync?.payload?.provenance?.takeoffId;
  const takeoffId = String(payload.provenance?.takeoffId || '').trim();
  const history = importedFieldHistory(workbook);
  if (takeoffId && takeoffId === previousTakeoffId && Array.isArray(payload.absentMaterialFields)) {
    for (const key of payload.absentMaterialFields) {
      const prior = history[key];
      const sourceId = prior?.provenance?.takeoffId || previousTakeoffId;
      if (!own(fields, key) && own(history, key) && sourceId === takeoffId && INPUT_ROWS.has(key) && isNumeric(INPUT_ROWS.get(key))) {
        fields[key] = 0;
        metadata.set(key, { source: 'Previously imported measurement removed from this saved takeoff' });
      }
    }
  }
  if (previousTakeoffId && previousTakeoffId === payload.provenance?.takeoffId) {
    for (const key of Object.keys(history)) {
      const definition = INPUT_ROWS.get(key);
      const currentValue = workbook?.data?.inputDataSheet?.rows?.[key]?.value;
      if (!own(fields, key) && definition && isNumeric(definition) && !blank(currentValue) && Number(currentValue) > 0) {
        warnings.push(`${definition.label}: No new measurement was provided. The current value (${currentValue} ${unitFor(definition)}) has been retained; review it before quoting.`);
      }
    }
  }
  const rows = Object.entries(fields).map(([destinationKey, value]) => {
    const definition = INPUT_ROWS.get(destinationKey);
    const entry = metadata.get(destinationKey);
    const currentValue = workbook?.data?.inputDataSheet?.rows?.[destinationKey]?.value ?? "";
    const reason = mismatch || unavailableReason(workbook, destinationKey, value, entry);
    const prior = previousImportedValue(workbook, destinationKey);
    const status = reason ? "unavailable" : blank(currentValue) ? "new" : equalValues(currentValue, value, definition) ? "unchanged" : "changed";
    const manualOverride = status === "changed" && !ALWAYS_TRUST_TAKEOFF_KEYS.has(destinationKey) && !(prior.found && equalValues(currentValue, prior.value, definition));
    if (reason && !mismatch) warnings.push(`${definition?.label || destinationKey}: ${reason}`);
    return {
      destinationKey,
      label: definition?.label || entry?.label || destinationKey,
      unit: definition ? unitFor(definition, entry) : entry?.unit || "",
      value,
      currentValue,
      source: entry?.source || "AI Plan Takeoff summary",
      status,
      selected: status === "new" || (status === "changed" && !manualOverride),
      manualOverride,
      reason,
    };
  });
  return { rows, warnings: [...new Set(warnings)], projectMismatch: mismatchDetail };
}

/**
 * Apply reviewed values in one immutable update. The caller persists this workbook
 * and verifies the payload came from the currently saved takeoff. A rejected
 * selection throws before any change. An empty/unchanged selection is a no-op.
 */
export function applyJobSetupImport(workbook = {}, payload = {}, selectedKeys, options = {}) {
  const mismatch = projectMismatch(workbook, payload, options);
  if (mismatch) throw new Error(mismatch);
  const preview = createJobSetupImportPreview(workbook, payload, options);
  const selected = new Set(selectedKeys ?? preview.rows.filter((row) => row.selected).map((row) => row.destinationKey));
  const byKey = new Map(preview.rows.map((row) => [row.destinationKey, row]));
  for (const key of selected) {
    const row = byKey.get(key);
    if (!row || row.status === "unavailable") throw new Error(`Cannot import ${row?.label || key}: ${row?.reason || "No mapped Job Setup destination exists."}`);
  }
  const changes = preview.rows.filter((row) => selected.has(row.destinationKey) && row.status !== "unchanged");
  if (!changes.length) return workbook;
  const provenance = { ...(payload.provenance || {}) };
  const syncedAt = options.syncedAt || provenance.transferredAt || "";
  const appliedFields = Object.fromEntries(changes.map((row) => [row.destinationKey, {
    value: String(row.value).trim(),
    previousValue: row.currentValue,
    source: row.source,
    unit: row.unit,
    provenance: { ...provenance },
    syncedAt,
  }]));
  const section = workbook.data.inputDataSheet;
  const updatedInputRows = { ...section.rows, ...Object.fromEntries(changes.map((row) => [row.destinationKey, { ...section.rows[row.destinationKey], value: appliedFields[row.destinationKey].value }])) };
  return {
    ...workbook,
    quotation: withTakeoffJambQuoteRows(workbook.quotation, updatedInputRows),
    data: {
      ...workbook.data,
      inputDataSheet: {
        ...section,
        rows: {
          ...section.rows,
          ...Object.fromEntries(changes.map((row) => [row.destinationKey, {
            ...section.rows[row.destinationKey],
            value: appliedFields[row.destinationKey].value,
          }])),
        },
      },
    },
    takeoffEngine: {
      ...(workbook.takeoffEngine || {}),
      lastJobSetupSync: {
        payload,
        syncedAt,
        projectId: provenance.projectId || workbook.projectId || workbook.registeredJob?.id || "",
        takeoffId: provenance.takeoffId || "",
        revision: Number(provenance.revision) || 0,
        transferTime: provenance.transferredAt || syncedAt,
        appliedFields,
        importedFields: { ...importedFieldHistory(workbook), ...appliedFields },
        projectMismatchAcknowledged: options.allowProjectMismatch
          ? { ...(describeProjectMismatch(workbook, payload) || {}), acknowledgedAt: syncedAt || new Date().toISOString() }
          : null,
      },
    },
  };
}
