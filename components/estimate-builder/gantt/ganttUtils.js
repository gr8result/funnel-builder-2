// ganttUtils.js — date calculation, dependency resolution, export helpers.

// ── Date helpers ──────────────────────────────────────────────────────────────

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Math.round(days));
  return d;
}

export function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86_400_000);
}

export function formatDate(date) {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

export function toIsoDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

// ── Dependency resolver ───────────────────────────────────────────────────────
// Calculates startOffsetDays for each task based on its dependencies.
// Uses topological sort (Kahn's algorithm) to handle dependency graphs.

export function resolveDependencies(tasks) {
  if (!tasks || !tasks.length) return tasks;

  const byId    = Object.fromEntries(tasks.map(t => [t.id, t]));
  const inDegree = Object.fromEntries(tasks.map(t => [t.id, 0]));
  const children = Object.fromEntries(tasks.map(t => [t.id, []]));

  for (const t of tasks) {
    for (const dep of (t.dependsOn || [])) {
      if (byId[dep]) {
        inDegree[t.id] = (inDegree[t.id] || 0) + 1;
        children[dep].push(t.id);
      }
    }
  }

  // Kahn's topological sort
  const queue   = tasks.filter(t => !inDegree[t.id]).map(t => t.id);
  const startOffset = {};

  while (queue.length) {
    const id  = queue.shift();
    const task = byId[id];
    if (!task) continue;

    // Start = max(end of all predecessors)
    let maxPredEnd = 0;
    for (const dep of (task.dependsOn || [])) {
      if (byId[dep]) {
        const predEnd = (startOffset[dep] ?? 0) + (byId[dep].durationDays || 1);
        if (predEnd > maxPredEnd) maxPredEnd = predEnd;
      }
    }
    startOffset[id] = Math.max(maxPredEnd, task.startOffsetDays || 0);

    // Propagate to children
    for (const childId of (children[id] || [])) {
      inDegree[childId]--;
      if (inDegree[childId] === 0) queue.push(childId);
    }
  }

  return tasks.map(t => ({
    ...t,
    startOffsetDays: startOffset[t.id] ?? t.startOffsetDays ?? 0,
  }));
}

// ── Task date calculation ─────────────────────────────────────────────────────

export function tasksWithDates(tasks, projectStartDate) {
  const start = new Date(projectStartDate || new Date());
  return tasks.map(t => ({
    ...t,
    startDate: addDays(start, t.startOffsetDays || 0),
    endDate:   addDays(start, (t.startOffsetDays || 0) + (t.durationDays || 1)),
  }));
}

// ── Project total duration ────────────────────────────────────────────────────

export function projectEndOffset(tasks) {
  return tasks.reduce((max, t) => {
    const end = (t.startOffsetDays || 0) + (t.durationDays || 1);
    return end > max ? end : max;
  }, 0);
}

// ── Group by stage ────────────────────────────────────────────────────────────

export function groupByStage(tasks) {
  const groups = {};
  for (const t of tasks) {
    if (!groups[t.stage]) groups[t.stage] = [];
    groups[t.stage].push(t);
  }
  return groups;
}

// ── CSV export ────────────────────────────────────────────────────────────────

export function tasksToCSV(tasks, projectStartDate) {
  const dated = tasksWithDates(tasks, projectStartDate);
  const header = [
    "Stage", "Task", "Trade/Supplier", "Duration (Days)",
    "Start Date", "End Date", "Depends On",
    "Required Order Date", "Procurement Type", "Notes",
  ].join(",");

  const rows = dated.filter(t => t.included).map(t => [
    q(t.stage),
    q(t.task),
    q(t.trade),
    t.durationDays,
    formatDate(t.startDate),
    formatDate(t.endDate),
    q((t.dependsOn || []).join("; ")),
    t.requiredOrderDate ? formatDate(t.requiredOrderDate) : "",
    q(t.procurementType || ""),
    q(t.notes || ""),
  ].join(","));

  return [header, ...rows].join("\n");
}

function q(s) {
  const str = String(s || "");
  return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
}

// ── Procurement cards from tasks ──────────────────────────────────────────────

export function buildProcurementCards(tasks, projectStartDate) {
  return tasks
    .filter(t => t.included && t.isProcurement && t.procurementType)
    .map(t => {
      const dated = tasksWithDates([t], projectStartDate)[0];
      return {
        id:          `pc-${t.id}`,
        ganttTaskId: t.id,
        type:        t.procurementType,
        stage:       t.stage,
        item:        t.task,
        trade:       t.trade,
        targetDate:  t.requiredOrderDate || (dated?.startDate ? toIsoDate(dated.startDate) : null),
        notes:       t.notes,
        status:      "pending",
        createdAt:   new Date().toISOString(),
      };
    });
}

// ── Storage helpers ───────────────────────────────────────────────────────────

const STORAGE_KEY = "gr8:gantt-projects:v1";

export function saveGanttProject(project) {
  try {
    const all = loadAllGanttProjects();
    const idx = all.findIndex(p => p.id === project.id);
    const next = { ...project, updatedAt: new Date().toISOString() };
    if (idx >= 0) all[idx] = next; else all.push(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

export function loadAllGanttProjects() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}

export function loadGanttByJobId(jobId) {
  return loadAllGanttProjects().find(p => p.jobId === jobId) || null;
}
