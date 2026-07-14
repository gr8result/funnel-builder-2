import { DYNAMIC_FIELDS, FIELD_FALLBACK } from "./dynamicFields.js";

export function resolveWorkbookField(workbook, fieldId, fallback = FIELD_FALLBACK) {
  const field = DYNAMIC_FIELDS[fieldId];
  if (!field) return fallback;
  const value = readProjectSetupRow(workbook, field.workbookKey);
  if (value !== undefined && value !== null && String(value).trim() !== "") {
    return String(value);
  }
  const pathValue = readPath({ workbook }, field.path);
  if (pathValue !== undefined && pathValue !== null && String(pathValue).trim() !== "") {
    return String(pathValue);
  }
  return field.fallback || fallback;
}

export function resolveDynamicText(text = "", workbook, fallback = FIELD_FALLBACK) {
  return String(text).replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, fieldId) => {
    return resolveWorkbookField(workbook, fieldId, fallback);
  });
}

export function readProjectSetupRow(workbook, key) {
  if (!key || key.includes(".")) return undefined;
  return workbook?.data?.inputDataSheet?.rows?.[key]?.value;
}

export function readPath(source, path) {
  if (!path) return undefined;
  return String(path)
    .split(".")
    .reduce((value, segment) => (value == null ? undefined : value[segment]), source);
}
