import { htmlEscape } from "./dateUtils";

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function downloadTasksCSVForProjects(projects, projectScope = null) {
  const scope = projectScope ? [projectScope] : projects;
  const headers = ["Project", "No.", "Phase", "Task Name", "Start Day", "Duration (days)", "Status", "Trade", "Milestone", "Long Lead", "Notes"];
  const rows = scope.flatMap((p) => (p.gantt_tasks || [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || (a.phase_order ?? 99) - (b.phase_order ?? 99) || (a.start_day || 0) - (b.start_day || 0))
    .map((t) => [
      p.name,
      (t.sort_order ?? 0) + 1,
      t.phase,
      t.name,
      t.start_day ?? 0,
      t.duration_days ?? 0,
      t.status || "pending",
      t.assigned_trade || "",
      t.is_milestone ? "Yes" : "No",
      t.is_long_lead ? "Yes" : "No",
      t.notes || "",
    ].map(csvEscape).join(",")));
  if (!rows.length) return;
  const csv = [headers.map(csvEscape).join(","), ...rows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(projectScope?.name || "gantt-tasks").replace(/[^a-z0-9]+/gi, "-")}-tasks.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function printTasksPDFForProjects(projects, projectScope = null) {
  const scope = projectScope ? [projectScope] : projects;
  const title = projectScope?.name || "Gantt Tasks";
  const rows = scope.flatMap((p) => (p.gantt_tasks || [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || (a.phase_order ?? 99) - (b.phase_order ?? 99) || (a.start_day || 0) - (b.start_day || 0))
    .map((t) => ({ project: p.name, ...t })));
  if (!rows.length) return;
  const win = window.open("", "_blank");
  if (!win) return alert("Popup blocked. Please allow popups to export PDF.");
  win.document.write(`<!doctype html><html><head><title>${htmlEscape(title)}</title><style>
    body{font-family:Arial,sans-serif;margin:28px;color:#0f172a} h1{font-size:22px;margin:0 0 6px} p{margin:0 0 18px;color:#475569}
    table{width:100%;border-collapse:collapse;font-size:12px} th,td{border:1px solid #cbd5e1;padding:7px;text-align:left;vertical-align:top}
    th{background:#e2e8f0} tr:nth-child(even){background:#f8fafc}
    @media print{button{display:none} body{margin:14mm}}
  </style></head><body>
    <button onclick="window.print()" style="margin-bottom:16px;padding:8px 12px">Print / Save PDF</button>
    <h1>${htmlEscape(title)}</h1><p>${rows.length} task${rows.length !== 1 ? "s" : ""}</p>
    <table><thead><tr><th>Project</th><th>No.</th><th>Phase</th><th>Task</th><th>Start Day</th><th>Duration</th><th>Status</th><th>Trade</th><th>Flags</th><th>Notes</th></tr></thead><tbody>
    ${rows.map((t) => `<tr><td>${htmlEscape(t.project)}</td><td>${htmlEscape((t.sort_order ?? 0) + 1)}</td><td>${htmlEscape(t.phase)}</td><td>${htmlEscape(t.name)}</td><td>${htmlEscape(t.start_day ?? 0)}</td><td>${htmlEscape(t.duration_days ?? 0)}</td><td>${htmlEscape(t.status || "pending")}</td><td>${htmlEscape(t.assigned_trade || "")}</td><td>${t.is_milestone ? "Milestone" : ""}${t.is_milestone && t.is_long_lead ? ", " : ""}${t.is_long_lead ? "Long lead" : ""}</td><td>${htmlEscape(t.notes || "")}</td></tr>`).join("")}
    </tbody></table></body></html>`);
  win.document.close();
  win.focus();
}
