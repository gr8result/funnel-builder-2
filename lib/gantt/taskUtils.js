export const JOB_TYPES = [
  "New Build", "Knock Down Rebuild", "Renovation", "Extension",
  "Duplex", "Commercial", "Other",
];

export const PHASE_COLORS = {
  "Pre-Construction":  "#3b82f6",
  "Procurement":       "#f59e0b",
  "Site Preparation":  "#8b5cf6",
  "Foundations":       "#ef4444",
  "Frame Stage":       "#f97316",
  "Lock-Up Stage":     "#06b6d4",
  "Rough-In Stage":    "#84cc16",
  "Internal Lining":   "#ec4899",
  "Fix-Out Stage":     "#14b8a6",
  "External Works":    "#6366f1",
  "Completion":        "#22c55e",
};

export const PHASE_DEFS = Object.entries(PHASE_COLORS).map(([key, color], index) => ({
  key,
  color,
  order: index + 1,
}));

export const PHASE_ORDER = Object.fromEntries(PHASE_DEFS.map((p) => [p.key, p.order]));

export const STATUS_OPTS = [
  { key: "pending",     label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "complete",    label: "Completed" },
  { key: "blocked",     label: "Blocked" },
  { key: "na",          label: "N/A" },
];

export const DELAY_REASONS = [
  "Wet weather",
  "Material shortage",
  "Subcontractor unavailable",
  "Inspection delay",
  "Client change",
  "Site access",
  "Other",
];

export const PRE_START_BUFFER_DAYS = 21;
export const DEFAULT_CONTRACT_START_DATE = "2026-07-01";

export const PROJECT_PALETTE = [
  "#8b5cf6", "#3b82f6", "#f97316", "#22c55e",
  "#ef4444", "#06b6d4", "#f59e0b", "#ec4899",
];

export const TASK_FORM_DEFAULT = {
  name: "",
  phase: "Pre-Construction",
  sort_order: 1,
  position_mode: "insert",
  start_day: 0,
  duration_days: 7,
  status: "pending",
  progress_percent: 0,
  assigned_trade: "",
  is_milestone: false,
  is_long_lead: false,
  notes: "",
};

export function clampProgress(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

export function statusFromProgress(progress) {
  if (progress >= 100) return "complete";
  if (progress > 0) return "in_progress";
  return "pending";
}

export function progressFromStatus(status) {
  return status === "complete" ? 100 : status === "in_progress" ? 50 : 0;
}

export function isMissingProgressColumn(error) {
  return error?.code === "PGRST204" && error?.message?.includes("progress_percent")
    || error?.message?.includes("progress_percent");
}

export function isMissingContractColumn(error) {
  return error?.code === "PGRST204" && /actual_start_date|contract_days|lost_day_allowance|daily_ld_rate/.test(error?.message || "")
    || /actual_start_date|contract_days|weather_lost_day_allowance|misc_lost_day_allowance|unforeseen_lost_day_allowance|daily_ld_rate/.test(error?.message || "");
}

function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"' && quoted && next === '"') { cell += '"'; i++; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === "," && !quoted) { row.push(cell); cell = ""; continue; }
    if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = []; cell = "";
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}

function csvValue(row, headers, names) {
  for (const name of names) {
    const idx = headers.indexOf(name.toLowerCase());
    if (idx >= 0) return row[idx] ?? "";
  }
  return "";
}

function parseBool(value) {
  return /^(yes|true|1|y)$/i.test(String(value || "").trim());
}

function normalizeStatus(value) {
  const v = String(value || "pending").trim().toLowerCase().replace(/\s+/g, "_").replace("-", "_");
  return STATUS_OPTS.some((s) => s.key === v) ? v : "pending";
}

function normalizePhase(value) {
  const raw = String(value || "").trim();
  return PHASE_DEFS.find((p) => p.key.toLowerCase() === raw.toLowerCase())?.key || "Pre-Construction";
}

export function tasksFromCSVText(text) {
  const parsed = parseCSV(text);
  if (parsed.length < 2) return [];
  const headers = parsed[0].map((h) => h.trim().toLowerCase());
  return parsed.slice(1).map((row, index) => {
    const phase = normalizePhase(csvValue(row, headers, ["phase"]));
    const name = csvValue(row, headers, ["task name", "name", "task"]).trim();
    const position = Number(csvValue(row, headers, ["no.", "no", "number", "order", "position", "task number"]));
    const status = normalizeStatus(csvValue(row, headers, ["status"]));
    const rawProgress = csvValue(row, headers, ["progress", "progress_percent", "percent complete", "% complete"]);
    const progress = rawProgress === "" ? progressFromStatus(status) : clampProgress(rawProgress);
    return {
      phase,
      phase_order: PHASE_ORDER[phase] ?? 99,
      name,
      start_day: Math.round(Number(csvValue(row, headers, ["start day", "start_day", "start"])) || 0),
      duration_days: Math.max(1, Number(csvValue(row, headers, ["duration (days)", "duration_days", "duration", "days"])) || 1),
      progress_percent: progress,
      status: statusFromProgress(progress),
      assigned_trade: csvValue(row, headers, ["trade", "assigned trade", "assigned_trade"]).trim() || null,
      is_milestone: parseBool(csvValue(row, headers, ["milestone", "is milestone", "is_milestone"])),
      is_long_lead: parseBool(csvValue(row, headers, ["long lead", "long_lead", "is long lead", "is_long_lead"])),
      dependencies: [],
      notes: csvValue(row, headers, ["notes", "note"]).trim() || null,
      sort_order: Number.isFinite(position) && position > 0 ? Math.round(position) - 1 : index,
    };
  }).filter((t) => t.name);
}

export function projectActualStart(project) {
  return project?.actual_start_date || project?.start_date || null;
}

export function projectAllowanceDays(project) {
  return (Number(project?.weather_lost_day_allowance) || 0)
    + (Number(project?.misc_lost_day_allowance) || 0)
    + (Number(project?.unforeseen_lost_day_allowance) || 0);
}

export function statusColor(s) {
  return { complete: "#22c55e", in_progress: "#f59e0b", blocked: "#ef4444", na: "#94a3b8", pending: "#ef4444" }[s] || "#ef4444";
}

export function statusLabel(s) {
  return { complete: "Completed", in_progress: "In Progress", pending: "Pending", blocked: "Pending", na: "Pending" }[s] || "Pending";
}

export function nextStatus(s) {
  return s === "pending" ? "in_progress" : s === "in_progress" ? "complete" : "pending";
}
