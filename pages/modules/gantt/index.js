// pages/modules/gantt/index.js
import { useState, useEffect, useMemo, useRef } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../../utils/supabase-client";

const JOB_TYPES = [
  "New Build", "Knock Down Rebuild", "Renovation", "Extension",
  "Duplex", "Commercial", "Other",
];

const PHASE_COLORS = {
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

const PHASE_DEFS = Object.entries(PHASE_COLORS).map(([key, color], index) => ({
  key,
  color,
  order: index + 1,
}));
const PHASE_ORDER = Object.fromEntries(PHASE_DEFS.map((p) => [p.key, p.order]));

const STATUS_OPTS = [
  { key: "pending",     label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "complete",    label: "Completed" },
  { key: "blocked",     label: "Blocked" },
  { key: "na",          label: "N/A" },
];

const PROJECT_PALETTE = [
  "#8b5cf6", "#3b82f6", "#f97316", "#22c55e",
  "#ef4444", "#06b6d4", "#f59e0b", "#ec4899",
];

const TASK_FORM_DEFAULT = {
  name: "",
  phase: "Pre-Construction",
  sort_order: 1,
  start_day: 0,
  duration_days: 7,
  status: "pending",
  progress_percent: 0,
  assigned_trade: "",
  is_milestone: false,
  is_long_lead: false,
  notes: "",
};

function clampProgress(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function statusFromProgress(progress) {
  if (progress >= 100) return "complete";
  if (progress > 0) return "in_progress";
  return "pending";
}

function progressFromStatus(status) {
  return status === "complete" ? 100 : status === "in_progress" ? 50 : 0;
}

function isMissingProgressColumn(error) {
  return error?.code === "PGRST204" && error?.message?.includes("progress_percent")
    || error?.message?.includes("progress_percent");
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

function tasksFromCSVText(text) {
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
      start_day: Math.max(0, Number(csvValue(row, headers, ["start day", "start_day", "start"])) || 0),
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

function htmlEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function addDays(base, n) {
  const d = new Date(base); d.setDate(d.getDate() + n); return d;
}
function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}
function statusColor(s) {
  return { complete: "#22c55e", in_progress: "#f59e0b", blocked: "#ef4444", na: "#94a3b8", pending: "#ef4444" }[s] || "#ef4444";
}

function statusLabel(s) {
  return { complete: "Completed", in_progress: "In Progress", pending: "Pending", blocked: "Pending", na: "Pending" }[s] || "Pending";
}

function nextStatus(s) {
  return s === "pending" ? "in_progress" : s === "in_progress" ? "complete" : "pending";
}

export default function GanttDashboard() {
  const router = useRouter();
  const scrollRef  = useRef(null);
  const csvImportRef = useRef(null);
  const csvProjectRef = useRef(null);
  const progressColumnAvailableRef = useRef(true);
  const panRef     = useRef({ active: false, startX: 0, scrollStart: 0 });
  const barDragRef = useRef(null);
  const progressDragRef = useRef(null);
  const [grabbing, setGrabbing] = useState(false);

  const [user, setUser]           = useState(null);
  const [projects, setProjects]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showNew, setShowNew]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [focusId, setFocusId]     = useState(null);
  const [expanded, setExpanded]   = useState({});
  const [search, setSearch]       = useState("");
  const [showAddTask, setShowAddTask] = useState(false);
  const [editTask, setEditTask]   = useState(null);
  const [taskForm, setTaskForm]   = useState(TASK_FORM_DEFAULT);
  const [newCsvTasks, setNewCsvTasks] = useState([]);
  const [newCsvName, setNewCsvName] = useState("");
  const [showSetback, setShowSetback] = useState(false);
  const [setbackForm, setSetbackForm] = useState({ days: 1, scope: "all" });
  const [form, setForm] = useState({
    name: "", client_name: "", job_address: "", job_type: "New Build", start_date: "",
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUser(user); });
  }, []);

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    setLoading(true);
    let { data, error } = await supabase
      .from("gantt_projects")
      .select("*, gantt_tasks(id, name, phase, phase_order, sort_order, start_day, duration_days, status, progress_percent, assigned_trade, is_milestone, is_long_lead, dependencies, notes)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (isMissingProgressColumn(error)) {
      progressColumnAvailableRef.current = false;
      const fallback = await supabase
        .from("gantt_projects")
        .select("*, gantt_tasks(id, name, phase, phase_order, sort_order, start_day, duration_days, status, assigned_trade, is_milestone, is_long_lead, dependencies, notes)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      data = (fallback.data || []).map((p) => ({
        ...p,
        gantt_tasks: (p.gantt_tasks || []).map((t) => ({
          ...t,
          progress_percent: progressFromStatus(t.status),
        })),
      }));
      error = fallback.error;
    } else if (!error) {
      progressColumnAvailableRef.current = true;
    }
    if (!error) setProjects(data || []);
    else console.error("Gantt projects failed to load:", error);
    setLoading(false);
  }

  async function createProject() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("gantt_projects")
        .insert({
          user_id:     user.id,
          name:        form.name.trim(),
          client_name: form.client_name.trim() || null,
          job_address: form.job_address.trim() || null,
          job_type:    form.job_type,
          start_date:  form.start_date || null,
        })
        .select()
        .single();
      if (error) throw error;
      if (newCsvTasks.length) {
        const rows = normaliseTaskOrder(newCsvTasks).map((task, index) => ({
          ...task,
          project_id: data.id,
          sort_order: index,
        }));
        const { error: taskErr } = await insertTasksWithProgressFallback(rows);
        if (taskErr) throw taskErr;
      }
      router.push(`/modules/gantt/${data.id}`);
    } catch (err) {
      alert("Error: " + err.message);
      setSaving(false);
    }
  }

  async function deleteProject(id, name) {
    if (!confirm(`Delete "${name}" and all its Gantt tasks? This cannot be undone.`)) return;
    await supabase.from("gantt_projects").delete().eq("id", id).eq("user_id", user.id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (focusId === id) setFocusId(null);
  }

  async function handleNewProjectCSV(file) {
    if (!file) {
      setNewCsvTasks([]);
      setNewCsvName("");
      return;
    }
    const text = await file.text();
    const tasks = tasksFromCSVText(text);
    if (!tasks.length) {
      alert("No valid tasks found. Make sure your CSV has a Task Name or Name column.");
      return;
    }
    setNewCsvTasks(tasks);
    setNewCsvName(file.name);
  }

  function patchProjectTasks(projectId, updater) {
    setProjects((prev) => prev.map((p) => (
      p.id === projectId ? { ...p, gantt_tasks: updater(p.gantt_tasks || []) } : p
    )));
  }

  function focusedTaskProject() {
    if (focusId) return projects.find((p) => p.id === focusId) || null;
    if (visible.length === 1) return visible[0];
    return null;
  }

  function resetTaskForm(overrides = {}) {
    setTaskForm({ ...TASK_FORM_DEFAULT, ...overrides });
  }

  function orderedTasks(tasks = []) {
    return tasks.slice().sort((a, b) => (
      (a.sort_order ?? 9999) - (b.sort_order ?? 9999)
      || (a.phase_order ?? 99) - (b.phase_order ?? 99)
      || (a.start_day || 0) - (b.start_day || 0)
      || String(a.name || "").localeCompare(String(b.name || ""))
    ));
  }

  function normaliseTaskOrder(tasks = [], movedTaskId = null, requestedPosition = 1) {
    const taskList = orderedTasks(tasks);
    if (!taskList.length) return [];
    if (!movedTaskId) return taskList.map((task, index) => ({ ...task, sort_order: index }));

    const movingIndex = taskList.findIndex((task) => task.id === movedTaskId);
    if (movingIndex === -1) return taskList.map((task, index) => ({ ...task, sort_order: index }));

    const [movingTask] = taskList.splice(movingIndex, 1);
    const targetIndex = Math.max(0, Math.min(taskList.length, Math.round(Number(requestedPosition) || 1) - 1));
    taskList.splice(targetIndex, 0, movingTask);
    return taskList.map((task, index) => ({ ...task, sort_order: index }));
  }

  async function insertTasksWithProgressFallback(rows) {
    const insertRows = progressColumnAvailableRef.current
      ? rows
      : rows.map(({ progress_percent: _progress, ...task }) => task);
    let { data, error } = await supabase.from("gantt_tasks").insert(insertRows).select();
    if (isMissingProgressColumn(error)) {
      progressColumnAvailableRef.current = false;
      const rowsWithoutProgress = rows.map(({ progress_percent: _progress, ...task }) => task);
      const retry = await supabase.from("gantt_tasks").insert(rowsWithoutProgress).select();
      data = (retry.data || []).map((task, index) => ({
        ...task,
        progress_percent: rows[index]?.progress_percent ?? progressFromStatus(task.status),
      }));
      error = retry.error;
    }
    return { data: data || [], error };
  }

  function openAddTask(project) {
    const tasks = project?.gantt_tasks || [];
    const lastTask = tasks.slice().sort((a, b) => (b.start_day || 0) - (a.start_day || 0))[0];
    setEditTask(null);
    resetTaskForm({
      phase: lastTask?.phase || "Pre-Construction",
      sort_order: tasks.length + 1,
      start_day: lastTask ? (lastTask.start_day || 0) + (lastTask.duration_days || 7) : 0,
    });
    setShowAddTask(true);
    if (project?.id && !focusId) setFocusId(project.id);
  }

  function openEditTask(task, project) {
    setShowAddTask(false);
    setEditTask({ ...task, project_id: project.id });
    resetTaskForm({
      name: task.name || "",
      phase: task.phase || "Pre-Construction",
      sort_order: (task.sort_order ?? 0) + 1,
      start_day: task.start_day ?? 0,
      duration_days: task.duration_days ?? 7,
      status: task.status || "pending",
      progress_percent: task.progress_percent ?? progressFromStatus(task.status),
      assigned_trade: task.assigned_trade || "",
      is_milestone: !!task.is_milestone,
      is_long_lead: !!task.is_long_lead,
      notes: task.notes || "",
    });
  }

  async function saveTask() {
    const project = editTask?.project_id
      ? projects.find((p) => p.id === editTask.project_id)
      : focusedTaskProject();
    if (!project || !taskForm.name.trim()) return;
    setSaving(true);
    const payload = {
      name: taskForm.name.trim(),
      phase: taskForm.phase,
      phase_order: PHASE_ORDER[taskForm.phase] ?? 99,
      start_day: Math.max(0, Number(taskForm.start_day) || 0),
      duration_days: Math.max(1, Number(taskForm.duration_days) || 1),
      progress_percent: clampProgress(taskForm.progress_percent ?? progressFromStatus(taskForm.status)),
      status: statusFromProgress(clampProgress(taskForm.progress_percent ?? progressFromStatus(taskForm.status))),
      assigned_trade: taskForm.assigned_trade.trim() || null,
      is_milestone: !!taskForm.is_milestone,
      is_long_lead: !!taskForm.is_long_lead,
      notes: taskForm.notes.trim() || null,
    };

    if (editTask) {
      const nextOrderedTasks = normaliseTaskOrder(
        (project.gantt_tasks || []).map((task) => task.id === editTask.id ? { ...task, ...payload } : task),
        editTask.id,
        taskForm.sort_order
      );
      const updatedTask = nextOrderedTasks.find((task) => task.id === editTask.id);
      let { error } = await supabase.from("gantt_tasks").update({ ...payload, sort_order: updatedTask?.sort_order ?? 0 }).eq("id", editTask.id).eq("project_id", project.id);
      if (error?.message?.includes("progress_percent")) {
        const { progress_percent: _progress, ...payloadWithoutProgress } = payload;
        const retry = await supabase.from("gantt_tasks").update({ ...payloadWithoutProgress, sort_order: updatedTask?.sort_order ?? 0 }).eq("id", editTask.id).eq("project_id", project.id);
        error = retry.error;
      }
      if (error) { alert("Error: " + error.message); setSaving(false); return; }
      const changedOrderTasks = nextOrderedTasks.filter((task) => {
        const previous = (project.gantt_tasks || []).find((t) => t.id === task.id);
        return previous && (previous.sort_order ?? 0) !== (task.sort_order ?? 0) && task.id !== editTask.id;
      });
      const orderResults = await Promise.all(changedOrderTasks.map((task) => (
        supabase.from("gantt_tasks").update({ sort_order: task.sort_order }).eq("id", task.id).eq("project_id", project.id)
      )));
      const orderError = orderResults.find((result) => result.error)?.error;
      if (orderError) { alert("Error saving task order: " + orderError.message); setSaving(false); return; }
      patchProjectTasks(project.id, () => nextOrderedTasks);
      setEditTask(null);
    } else {
      const newTask = {
        ...payload,
        project_id: project.id,
        dependencies: [],
        sort_order: Math.max(0, Math.min((project.gantt_tasks || []).length, Math.round(Number(taskForm.sort_order) || 1) - 1)),
      };
      let { data, error } = await supabase.from("gantt_tasks").insert(newTask).select().single();
      if (error?.message?.includes("progress_percent")) {
        const { progress_percent: _progress, ...newTaskWithoutProgress } = newTask;
        const retry = await supabase.from("gantt_tasks").insert(newTaskWithoutProgress).select().single();
        data = retry.data ? { ...retry.data, progress_percent: newTask.progress_percent } : retry.data;
        error = retry.error;
      }
      if (error) { alert("Error: " + error.message); setSaving(false); return; }
      const nextOrderedTasks = normaliseTaskOrder([...(project.gantt_tasks || []), data], data.id, taskForm.sort_order);
      const changedOrderTasks = nextOrderedTasks.filter((task) => {
        const previous = task.id === data.id ? data : (project.gantt_tasks || []).find((t) => t.id === task.id);
        return (previous?.sort_order ?? 0) !== (task.sort_order ?? 0);
      });
      const orderResults = await Promise.all(changedOrderTasks.map((task) => (
        supabase.from("gantt_tasks").update({ sort_order: task.sort_order }).eq("id", task.id).eq("project_id", project.id)
      )));
      const orderError = orderResults.find((result) => result.error)?.error;
      if (orderError) { alert("Error saving task order: " + orderError.message); setSaving(false); return; }
      patchProjectTasks(project.id, () => nextOrderedTasks);
      setShowAddTask(false);
    }
    resetTaskForm();
    setSaving(false);
  }

  async function deleteTask() {
    if (!editTask) return;
    if (!confirm(`Delete "${editTask.name}"?`)) return;
    const { error } = await supabase.from("gantt_tasks").delete().eq("id", editTask.id).eq("project_id", editTask.project_id);
    if (error) { alert("Error: " + error.message); return; }
    const project = projects.find((p) => p.id === editTask.project_id);
    const nextOrderedTasks = normaliseTaskOrder((project?.gantt_tasks || []).filter((t) => t.id !== editTask.id));
    const orderResults = await Promise.all(nextOrderedTasks.map((task) => (
      supabase.from("gantt_tasks").update({ sort_order: task.sort_order }).eq("id", task.id).eq("project_id", editTask.project_id)
    )));
    const orderError = orderResults.find((result) => result.error)?.error;
    if (orderError) return alert("Task deleted, but order cleanup failed: " + orderError.message);
    patchProjectTasks(editTask.project_id, () => nextOrderedTasks);
    setEditTask(null);
    resetTaskForm();
  }

  async function updateTaskStatus(project, task, status) {
    const current = statusFromProgress(clampProgress(task.progress_percent ?? progressFromStatus(task.status)));
    const next = status || nextStatus(current);
    const progress = progressFromStatus(next);
    let { error } = await supabase.from("gantt_tasks").update({ status: next, progress_percent: progress }).eq("id", task.id).eq("project_id", project.id);
    if (error?.message?.includes("progress_percent")) {
      const retry = await supabase.from("gantt_tasks").update({ status: next }).eq("id", task.id).eq("project_id", project.id);
      error = retry.error;
    }
    if (error) return alert("Error updating progress: " + error.message);
    patchProjectTasks(project.id, (tasks) => tasks.map((t) => t.id === task.id ? { ...t, status: next, progress_percent: progress } : t));
  }

  async function applySetback() {
    const project = focusedProject;
    if (!project) return;
    const days = Math.max(1, Math.round(Number(setbackForm.days) || 1));
    const allTasks = project.gantt_tasks || [];
    const tasksToMove = setbackForm.scope === "unfinished"
      ? allTasks.filter((t) => statusFromProgress(clampProgress(t.progress_percent ?? progressFromStatus(t.status))) !== "complete")
      : allTasks;
    if (!tasksToMove.length) return alert("There are no tasks to move for this setback.");
    if (!confirm(`Move ${tasksToMove.length} task${tasksToMove.length !== 1 ? "s" : ""} back by ${days} day${days !== 1 ? "s" : ""}?`)) return;
    setSaving(true);
    try {
      for (const task of tasksToMove) {
        const nextStart = Math.max(0, (task.start_day || 0) + days);
        const { error } = await supabase
          .from("gantt_tasks")
          .update({ start_day: nextStart })
          .eq("id", task.id)
          .eq("project_id", project.id);
        if (error) throw error;
      }
      const ids = new Set(tasksToMove.map((t) => t.id));
      patchProjectTasks(project.id, (tasks) => tasks.map((t) => (
        ids.has(t.id) ? { ...t, start_day: Math.max(0, (t.start_day || 0) + days) } : t
      )));
      setShowSetback(false);
    } catch (err) {
      alert("Setback failed: " + err.message);
    }
    setSaving(false);
  }

  function csvEscape(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function downloadTasksCSV(projectScope) {
    const scope = projectScope ? [projectScope] : visible;
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

  function promptImportTasks(project) {
    csvProjectRef.current = project;
    if (csvImportRef.current) {
      csvImportRef.current.value = "";
      csvImportRef.current.click();
    }
  }

  async function importTasksCSV(file) {
    const project = csvProjectRef.current || focusedProject;
    if (!file || !project) return;
    const text = await file.text();
    const parsedTasks = tasksFromCSVText(text);
    if (!parsedTasks.length) {
      alert("No valid tasks found. Make sure your CSV has a Task Name or Name column.");
      return;
    }
    const replace = (project.gantt_tasks || []).length
      ? confirm(`Import ${parsedTasks.length} tasks into "${project.name}"?\n\nOK = replace existing tasks\nCancel = append to existing tasks`)
      : false;
    setSaving(true);
    try {
      const offset = replace ? 0 : (project.gantt_tasks || []).length;
      const rows = normaliseTaskOrder(parsedTasks).map((task, index) => ({ ...task, project_id: project.id, sort_order: offset + index }));
      const { data, error } = await insertTasksWithProgressFallback(rows);
      if (error) throw error;

      if (replace) {
        const oldTaskIds = (project.gantt_tasks || []).map((task) => task.id).filter(Boolean);
        if (oldTaskIds.length) {
          const { error: deleteError } = await supabase
            .from("gantt_tasks")
            .delete()
            .eq("project_id", project.id)
            .in("id", oldTaskIds);
          if (deleteError) {
            const newTaskIds = data.map((task) => task.id).filter(Boolean);
            if (newTaskIds.length) {
              await supabase.from("gantt_tasks").delete().eq("project_id", project.id).in("id", newTaskIds);
            }
            throw new Error(`The new tasks were uploaded, but the existing tasks could not be replaced: ${deleteError.message}`);
          }
        }
      }

      patchProjectTasks(project.id, (tasks) => replace ? data : [...tasks, ...data]);
      setFocusId(project.id);
      alert(`${replace ? "Replaced the existing schedule with" : "Imported"} ${rows.length} task${rows.length !== 1 ? "s" : ""}.`);
    } catch (err) {
      alert("Import failed: " + err.message);
    }
    setSaving(false);
  }

  function printTasksPDF(projectScope) {
    const scope = projectScope ? [projectScope] : visible;
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

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let totalTasks = 0, doneTasks = 0, onTrack = 0, atRisk = 0, overdue = 0;
    for (const p of projects) {
      const tasks = p.gantt_tasks || [];
      totalTasks += tasks.length;
      const done = tasks.filter((t) => t.status === "complete").length;
      doneTasks += done;
      if (!tasks.length) continue;
      const pct = done / tasks.length;
      const maxDay = Math.max(...tasks.map((t) => (t.start_day || 0) + (t.duration_days || 7)));
      const start = p.start_date ? new Date(p.start_date) : null;
      if (start) {
        const end = addDays(p.start_date, maxDay);
        if (today > end && pct < 1) { overdue++; continue; }
        const elapsed = daysBetween(start, today);
        const expected = Math.min(1, elapsed / maxDay);
        if (pct < expected - 0.15) atRisk++;
        else onTrack++;
      } else {
        if (pct < 0.5) atRisk++; else onTrack++;
      }
    }
    return {
      total: projects.length,
      completePct: totalTasks ? Math.round(doneTasks / totalTasks * 100) : 0,
      onTrack, atRisk, overdue,
    };
  }, [projects]);

  // ── Ruler ─────────────────────────────────────────────────────────────────
  const DAY_W = 20;

  const rulerStart = useMemo(() => {
    const starts = projects.filter((p) => p.start_date).map((p) => new Date(p.start_date));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const base = starts.length ? new Date(Math.min(...starts)) : today;
    base.setDate(base.getDate() - 5);
    return base;
  }, [projects]);

  const RULER_DAYS = useMemo(() => {
    let maxVisibleDay = 90;
    for (const p of projects) {
      const projectStartOffset = p.start_date ? Math.max(0, daysBetween(rulerStart, new Date(p.start_date))) : 2;
      const tasks = p.gantt_tasks || [];
      const projectEnd = tasks.length
        ? Math.max(...tasks.map((t) => (t.start_day || 0) + (t.duration_days || 7)))
        : 60;
      maxVisibleDay = Math.max(maxVisibleDay, projectStartOffset + projectEnd + 21);
    }
    return Math.ceil(maxVisibleDay);
  }, [projects, rulerStart]);

  const todayOffset = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return daysBetween(rulerStart, today);
  }, [rulerStart]);

  const dayTicks = useMemo(() =>
    Array.from({ length: RULER_DAYS }, (_, i) => {
      const d = addDays(rulerStart, i);
      const weekday = d.getDay();
      return { n: d.getDate(), month: d.getMonth(), year: d.getFullYear(), offset: i, isWeekend: weekday === 0 || weekday === 6 };
    }),
  [RULER_DAYS, rulerStart]);

  const monthGroups = useMemo(() => {
    const groups = [];
    for (const t of dayTicks) {
      const key = `${t.month}-${t.year}`;
      if (!groups.length || groups[groups.length - 1].key !== key) {
        groups.push({ key, label: new Date(t.year, t.month, 1).toLocaleString("en", { month: "long", year: "numeric" }), count: 0 });
      }
      groups[groups.length - 1].count++;
    }
    return groups;
  }, [dayTicks]);

  // ── Visibility / expand ───────────────────────────────────────────────────
  const visible = useMemo(() => {
    if (focusId) return projects.filter((p) => p.id === focusId);
    if (search.trim()) {
      const q = search.toLowerCase();
      return projects.filter((p) =>
        p.name.toLowerCase().includes(q) || (p.client_name || "").toLowerCase().includes(q)
      );
    }
    return projects;
  }, [projects, focusId, search]);

  function toggleExpand(pid, phase) {
    const key = `${pid}:${phase}`;
    setExpanded((e) => ({ ...e, [key]: !e[key] }));
  }
  function isExpanded(pid, phase) { return !!expanded[`${pid}:${phase}`]; }
  function expandAll() {
    const next = {};
    visible.forEach((p) => {
      const tasks = p.gantt_tasks || [];
      [...new Set(tasks.map((t) => t.phase))].forEach((ph) => { next[`${p.id}:${ph}`] = true; });
    });
    setExpanded((e) => ({ ...e, ...next }));
  }
  function collapseAll() { setExpanded({}); }
  function getColor(idx) { return PROJECT_PALETTE[idx % PROJECT_PALETTE.length]; }

  function projectPct(p) {
    const tasks = p.gantt_tasks || [];
    if (!tasks.length) return 0;
    return Math.round(tasks.filter((t) => t.status === "complete").length / tasks.length * 100);
  }
  function projectMaxDay(p) {
    const tasks = p.gantt_tasks || [];
    if (!tasks.length) return 60;
    return Math.max(...tasks.map((t) => (t.start_day || 0) + (t.duration_days || 7)));
  }
  function projBarOffset(p) {
    if (!p.start_date) return 2;
    return Math.max(0, daysBetween(rulerStart, new Date(p.start_date)));
  }

  // ── Flat row list (keeps left + right bars in sync) ───────────────────────
  const rows = useMemo(() => {
    const out = [];
    visible.forEach((p, pIdx) => {
      const color    = getColor(pIdx);
      const pct      = projectPct(p);
      const tasks    = p.gantt_tasks || [];
      const offset   = projBarOffset(p);
      const duration = projectMaxDay(p);
      const phases   = [...new Set(tasks.map((t) => t.phase))].sort((a, b) => {
        const aMin = Math.min(...tasks.filter((t) => t.phase === a).map((t) => t.sort_order ?? 9999));
        const bMin = Math.min(...tasks.filter((t) => t.phase === b).map((t) => t.sort_order ?? 9999));
        const ao = tasks.find((t) => t.phase === a)?.phase_order ?? 99;
        const bo = tasks.find((t) => t.phase === b)?.phase_order ?? 99;
        return aMin - bMin || ao - bo;
      });
      out.push({ type: "project", p, pIdx, color, pct, offset, duration });
      if (focusId === p.id) {
        phases.forEach((phase) => {
          const phaseTasks = orderedTasks(tasks.filter((t) => t.phase === phase));
          const phaseColor = PHASE_COLORS[phase] || "#8b5cf6";
          const phasePct   = phaseTasks.length
            ? Math.round(phaseTasks.filter((t) => t.status === "complete").length / phaseTasks.length * 100)
            : 0;
          const minSD      = Math.min(...phaseTasks.map((t) => t.start_day || 0));
          const maxED      = Math.max(...phaseTasks.map((t) => (t.start_day || 0) + (t.duration_days || 7)));
          const exp        = isExpanded(p.id, phase);
          out.push({ type: "phase", p, phase, phaseColor, phasePct, phOffset: offset + minSD, phDuration: maxED - minSD, exp });
          if (exp) {
            phaseTasks.forEach((task) => out.push({ type: "task", p, task, offset }));
          }
        });
      }
    });
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, focusId, expanded]);

  const focusedProject = focusId ? projects.find((p) => p.id === focusId) : null;

  const dependencyLinks = useMemo(() => {
    const taskRows = new Map();
    let y = 0;
    rows.forEach((row) => {
      const h = row.type === "project" ? 56 : row.type === "phase" ? 48 : 40;
      if (row.type === "task") {
        const xStart = (row.offset + (row.task.start_day || 0)) * DAY_W;
        const xEnd = xStart + Math.max((row.task.duration_days || 7) * DAY_W, 12);
        taskRows.set(row.task.id, { task: row.task, p: row.p, y: y + h / 2, xStart, xEnd });
      }
      y += h;
    });
    const links = [];
    taskRows.forEach((to) => {
      (to.task.dependencies || []).forEach((depId) => {
        const from = taskRows.get(depId);
        if (!from || from.p.id !== to.p.id) return;
        const gap = to.xStart - from.xEnd;
        const midX = gap > 0
          ? from.xEnd + Math.min(gap, Math.max(14, gap * 0.5))
          : from.xEnd + 14;
        links.push({
          key: `${depId}-${to.task.id}`,
          d: `M${from.xEnd},${from.y} L${midX},${from.y} L${midX},${to.y} L${to.xStart},${to.y}`,
        });
      });
    });
    return { links, height: y };
  }, [rows]);

  function scrollToToday() {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, todayOffset * DAY_W - 200);
    }
  }
  useEffect(() => {
    if (!loading && scrollRef.current) setTimeout(scrollToToday, 120);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // ── Pan + bar-drag global handlers ────────────────────────────────────────
  useEffect(() => {
    const onMove = (e) => {
      if (panRef.current.active && scrollRef.current) {
        const dx = e.clientX - panRef.current.startX;
        scrollRef.current.scrollLeft = panRef.current.scrollStart - dx;
      }
      const pd = progressDragRef.current;
      if (pd) {
        const dx = e.clientX - pd.startX;
        const next = clampProgress(pd.originalProgress + (dx / pd.width) * 100);
        const fillEl = document.getElementById(pd.fillId);
        if (fillEl) fillEl.style.width = `${next}%`;
        return;
      }
      const bd = barDragRef.current;
      if (!bd) return;
      const dx = e.clientX - bd.startX;
      const deltaDays = dx / DAY_W;
      const trackEl = document.getElementById(bd.trackId);
      if (!trackEl) return;
      if (bd.side === "left") {
        const newLeft = Math.max(0, (bd.originalOffset + deltaDays) * DAY_W);
        trackEl.style.left = newLeft + "px";
        if (bd.fillId) {
          const fillEl = document.getElementById(bd.fillId);
          if (fillEl) fillEl.style.left = newLeft + "px";
        }
      } else {
        const newW = Math.max(DAY_W, (bd.originalDuration + deltaDays) * DAY_W);
        trackEl.style.width = newW + "px";
        if (bd.fillId) {
          const fillEl = document.getElementById(bd.fillId);
          if (fillEl) fillEl.style.width = Math.round(newW * bd.pct / 100) + "px";
        }
      }
    };
    const onUp = async (e) => {
      panRef.current.active = false;
      setGrabbing(false);
      const pd = progressDragRef.current;
      if (pd) {
        progressDragRef.current = null;
        const dx = e.clientX - pd.startX;
        const progress = clampProgress(pd.originalProgress + (dx / pd.width) * 100);
        const status = statusFromProgress(progress);
        try {
          let { error } = await supabase.from("gantt_tasks").update({ progress_percent: progress, status }).eq("id", pd.taskId).eq("project_id", pd.projectId);
          if (error?.message?.includes("progress_percent")) {
            const retry = await supabase.from("gantt_tasks").update({ status }).eq("id", pd.taskId).eq("project_id", pd.projectId);
            error = retry.error;
          }
          if (error) throw error;
          patchProjectTasks(pd.projectId, (tasks) => tasks.map((t) => t.id === pd.taskId ? { ...t, progress_percent: progress, status } : t));
        } catch (err) {
          console.error("Progress drag save failed:", err);
        }
        return;
      }
      const bd = barDragRef.current;
      if (!bd) return;
      barDragRef.current = null;
      const deltaDays = Math.round((e.clientX - bd.startX) / DAY_W);
      if (deltaDays === 0) return;
      try {
        if (bd.entityType === "project" && bd.side === "left" && bd.projectRef?.start_date) {
          const newDate = addDays(new Date(bd.projectRef.start_date), deltaDays);
          const iso = newDate.toISOString().split("T")[0];
          await supabase.from("gantt_projects").update({ start_date: iso }).eq("id", bd.entityId).eq("user_id", user.id);
          setProjects((prev) => prev.map((pp) => pp.id === bd.entityId ? { ...pp, start_date: iso } : pp));
        } else if (bd.entityType === "task" && bd.side === "left") {
          const newVal = Math.max(0, bd.originalValue + deltaDays);
          await supabase.from("gantt_tasks").update({ start_day: newVal }).eq("id", bd.entityId).eq("project_id", bd.projectId);
          setProjects((prev) => prev.map((pp) => ({
            ...pp, gantt_tasks: (pp.gantt_tasks || []).map((t) =>
              t.id === bd.entityId ? { ...t, start_day: newVal } : t),
          })));
        } else if (bd.entityType === "task" && bd.side === "right") {
          const newVal = Math.max(1, bd.originalValue + deltaDays);
          await supabase.from("gantt_tasks").update({ duration_days: newVal }).eq("id", bd.entityId).eq("project_id", bd.projectId);
          setProjects((prev) => prev.map((pp) => ({
            ...pp, gantt_tasks: (pp.gantt_tasks || []).map((t) =>
              t.id === bd.entityId ? { ...t, duration_days: newVal } : t),
          })));
        }
      } catch (err) {
        console.error("Bar drag save failed:", err);
      }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  return (
    <>
      <Head><title>Gantt Charts</title></Head>
      <div style={S.page}>

        {/* ── Banner ── */}
        <div style={S.banner}>
          <div style={S.bannerLeft}>
            <span style={S.bannerIcon}>📊</span>
            <div>
              <h1 style={S.bannerTitle}>Gantt Charts</h1>
              <p style={S.bannerDesc}>
                {stats.total} project{stats.total !== 1 ? "s" : ""}&nbsp;·&nbsp;
                {stats.completePct}% tasks done&nbsp;·&nbsp;
                <span style={{ color: "#86efac" }}>{stats.onTrack} on track</span>&nbsp;·&nbsp;
                <span style={{ color: "#fca5a5" }}>{stats.overdue} overdue</span>
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {focusId ? (
              <button style={S.outlineBtn} onClick={() => setFocusId(null)}>← All Projects</button>
            ) : (
              <input
                style={{ ...S.searchInput, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff" }}
                placeholder="Filter projects…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            )}
            <button style={S.todayBtn} onClick={scrollToToday}>Today</button>
            {focusedProject && (
              <button style={S.todayBtn} onClick={() => openAddTask(focusedProject)}>+ Task</button>
            )}
            {focusedProject && (
              <button style={S.todayBtn} onClick={() => setShowSetback(true)}>Setback</button>
            )}
            {focusedProject && (
              <button style={S.todayBtn} onClick={() => promptImportTasks(focusedProject)}>Import CSV</button>
            )}
            <button
              style={{ ...S.todayBtn, opacity: visible.some((p) => (p.gantt_tasks || []).length) ? 1 : 0.55 }}
              disabled={!visible.some((p) => (p.gantt_tasks || []).length)}
              onClick={() => downloadTasksCSV(focusedProject || null)}
            >
              Export CSV
            </button>
            <button
              style={{ ...S.todayBtn, opacity: visible.some((p) => (p.gantt_tasks || []).length) ? 1 : 0.55 }}
              disabled={!visible.some((p) => (p.gantt_tasks || []).length)}
              onClick={() => printTasksPDF(focusedProject || null)}
            >
              Export PDF
            </button>
            <button style={S.primaryBtn} onClick={() => setShowNew(true)}>+ New Project</button>
            <Link href="/modules/construction"><button style={S.backBtnBanner}>← Back</button></Link>
          </div>
        </div>
        <input
          ref={csvImportRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={(e) => importTasksCSV(e.target.files?.[0])}
        />

        {/* ── Stats ── */}
        <div style={S.statsRow}>
          {[
            { icon: "📁", label: "Total Projects",  value: stats.total,            color: "#8b5cf6", bg: "#f5f3ff", border: "#ede9fe" },
            { icon: "✅", label: "Tasks Completed", value: `${stats.completePct}%`, color: "#3b82f6", bg: "#eff6ff", border: "#dbeafe" },
            { icon: "📅", label: "On Track",        value: stats.onTrack,           color: "#22c55e", bg: "#f0fdf4", border: "#dcfce7" },
            { icon: "⚠️", label: "At Risk",         value: stats.atRisk,            color: "#f97316", bg: "#fff7ed", border: "#fed7aa" },
            { icon: "🚩", label: "Overdue",         value: stats.overdue,           color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
          ].map((s) => (
            <div key={s.label} style={{ ...S.statCard, background: s.bg, borderColor: s.border }}>
              <div style={{ ...S.statIcon, background: s.color + "22", color: s.color }}>{s.icon}</div>
              <div>
                <div style={{ ...S.statValue, color: s.color }}>{s.value}</div>
                <div style={S.statLabel}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Gantt table ── */}
        {loading ? (
          <div style={S.center}>Loading schedules…</div>
        ) : projects.length === 0 ? (
          <div style={S.empty}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "#1e293b", marginBottom: 8 }}>No projects yet</div>
            <div style={{ fontSize: 15, color: "#64748b", marginBottom: 20 }}>
              Create your first schedule to get started.
            </div>
            <button style={S.primaryBtn} onClick={() => setShowNew(true)}>+ New Project</button>
          </div>
        ) : (
          <div style={S.ganttWrap}>

            {/* Left name column */}
            <div style={S.leftCol}>
              <div style={S.nameHeader}>
                <div style={{ ...S.headerGrid, gridTemplateColumns: focusedProject ? "44px minmax(0, 1fr) 138px" : "minmax(0, 1fr) 138px" }}>
                  {focusedProject && <span>No.</span>}
                  <span>{focusedProject ? "Task Name" : "Project Name"}</span>
                  <span>State</span>
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {focusedProject && (
                    <button
                      style={{ ...S.miniBtn, background: "#7c3aed", borderColor: "#6d28d9", color: "#fff" }}
                      title="Add a task to this schedule"
                      onClick={() => openAddTask(focusedProject)}
                    >
                      + Task
                    </button>
                  )}
                  <button style={S.miniBtn} title="Expand all phases" onClick={expandAll}>⊞ All</button>
                  <button style={S.miniBtn} title="Collapse all" onClick={collapseAll}>⊟</button>
                </div>
              </div>
              {rows.map((row) => {
                if (row.type === "project") {
                  const { p, color, pct } = row;
                  return (
                    <div
                      key={`L-p-${p.id}`}
                      style={{ ...S.projectRow, borderLeft: `3px solid ${color}`, background: focusId === p.id ? "#f8faff" : "white" }}
                      onClick={() => setFocusId(focusId === p.id ? null : p.id)}
                    >
                      <span style={{ ...S.chevron, color }}>{focusId === p.id ? "▼" : "▶"}</span>
                      <span style={{ ...S.dot, background: color }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={S.pName}>{p.name}</div>
                        {p.client_name && <div style={S.pSub}>{p.client_name}</div>}
                      </div>
                      <span style={{ ...S.pctLabel, color }}>{pct}%</span>
                      <button
                        style={S.rowActionBtn}
                        title="Add task"
                        onClick={(e) => { e.stopPropagation(); openAddTask(p); }}
                      >
                        +
                      </button>
                      <button
                        style={S.rowActionBtn}
                        title="Download tasks CSV"
                        disabled={!(p.gantt_tasks || []).length}
                        onClick={(e) => { e.stopPropagation(); downloadTasksCSV(p); }}
                      >
                        CSV
                      </button>
                      <button
                        style={S.rowActionBtn}
                        title="Download tasks PDF"
                        disabled={!(p.gantt_tasks || []).length}
                        onClick={(e) => { e.stopPropagation(); printTasksPDF(p); }}
                      >
                        PDF
                      </button>
                      <button
                        style={S.rowActionBtn}
                        title="Import tasks CSV"
                        onClick={(e) => { e.stopPropagation(); promptImportTasks(p); }}
                      >
                        Import
                      </button>
                      <button
                        style={S.delBtn} title="Delete"
                        onClick={(e) => { e.stopPropagation(); deleteProject(p.id, p.name); }}
                      >✕</button>
                    </div>
                  );
                }
                if (row.type === "phase") {
                  const { p, phase, phaseColor, phasePct, exp } = row;
                  return (
                    <div
                      key={`L-ph-${p.id}-${phase}`}
                      style={{ ...S.phaseRow, borderLeft: `3px solid ${phaseColor}`, position: "relative" }}
                      onClick={() => toggleExpand(p.id, phase)}
                    >
                      <div style={{ position:"absolute", left:10, top:0, height:"50%", width:2, background:"#94a3b8", pointerEvents:"none" }} />
                      <div style={{ position:"absolute", left:10, top:"50%", width:18, height:2, background:"#94a3b8", pointerEvents:"none" }} />
                      <span style={S.phChevron}>{exp ? "▼" : "▶"}</span>
                      <span style={S.phName}>{phase}</span>
                      <span style={{ ...S.pctLabel, color: phaseColor }}>{phasePct}%</span>
                      <span style={S.progressSpacer} />
                    </div>
                  );
                }
                if (row.type === "task") {
                  const { task, p } = row;
                  const taskStatus = statusFromProgress(clampProgress(task.progress_percent ?? progressFromStatus(task.status)));
                  return (
                    <div
                      key={`L-t-${task.id}`}
                      style={{ ...S.taskRow, position: "relative", cursor: "pointer" }}
                      title="Click to edit task"
                      onClick={() => openEditTask(task, p)}
                    >
                      <div style={{ position:"absolute", left:26, top:0, height:"50%", width:2, background:"#94a3b8", pointerEvents:"none" }} />
                      <div style={{ position:"absolute", left:26, top:"50%", width:16, height:2, background:"#94a3b8", pointerEvents:"none" }} />
                      <span style={S.orderBadge}>{(task.sort_order ?? 0) + 1}</span>
                      <span style={{ ...S.taskDot, background: statusColor(taskStatus) }} />
                      <span style={S.taskName}>{task.is_milestone ? "⭐ " : ""}{task.name}</span>
                      <button
                        style={S.statusStateBtn}
                        title="Click to move state to the next step"
                        onClick={(e) => { e.stopPropagation(); updateTaskStatus(p, task); }}
                      >
                        <span style={{ ...S.statusStateDot, background: statusColor(taskStatus) }} />
                        <span>{statusLabel(taskStatus)}</span>
                      </button>
                      <button
                        style={{ ...S.rowActionBtn, background: "#7c3aed", borderColor: "#6d28d9", color: "#fff" }}
                        onClick={(e) => { e.stopPropagation(); openEditTask(task, p); }}
                      >
                        Edit
                      </button>
                    </div>
                  );
                }
                return null;
              })}
            </div>

            {/* Right Gantt area */}
            <div
              style={{ ...S.rightCol, cursor: grabbing ? "grabbing" : "grab", userSelect: "none" }}
              ref={scrollRef}
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                panRef.current = { active: true, startX: e.clientX, scrollStart: scrollRef.current.scrollLeft };
                setGrabbing(true);
              }}
            >
              <div style={{ width: RULER_DAYS * DAY_W, position: "relative" }}>

                {/* Month band */}
                <div style={S.monthBand}>
                  {monthGroups.map((mg) => (
                    <div key={mg.key} style={{ ...S.monthCell, width: mg.count * DAY_W, minWidth: mg.count * DAY_W }}>
                      {mg.label}
                    </div>
                  ))}
                </div>

                {/* Day band */}
                <div style={S.dayBand}>
                  {dayTicks.map((t) => (
                    <div
                      key={`d-${t.month}-${t.n}-${t.year}`}
                      style={{
                        ...S.dayCell,
                        width: DAY_W, minWidth: DAY_W,
                        background: t.offset === todayOffset ? "#fef2f2" : t.isWeekend ? "#dcfce7" : undefined,
                        color: t.offset === todayOffset ? "#ef4444" : undefined,
                        fontWeight: t.offset === todayOffset ? 700 : 400,
                      }}
                    >
                      {t.n === 1 || t.n % 5 === 0 || t.offset === todayOffset ? t.n : ""}
                    </div>
                  ))}
                </div>

                {/* Today line */}
                {todayOffset >= 0 && todayOffset < RULER_DAYS && (
                  <div style={{ ...S.todayLine, left: todayOffset * DAY_W + DAY_W / 2 }}>
                    <div style={S.todayBadge}>Today</div>
                  </div>
                )}

                {/* Weekend shading */}
                {dayTicks.filter((t) => t.isWeekend).map((t) => (
                  <div
                    key={`weekend-${t.offset}`}
                    style={{ position:"absolute", left:t.offset*DAY_W, top:64, width:DAY_W, height:9999, background:"#dcfce7", opacity:0.72, pointerEvents:"none", zIndex:0 }}
                  />
                ))}

                {/* Day grid lines */}
                {dayTicks.map((t) => (
                  <div
                    key={`grid-${t.offset}`}
                    style={{ position:"absolute", left:t.offset*DAY_W, top:64, width:1, height:9999, background:t.n === 1 ? "#b8c4d2" : "#dde3eb", pointerEvents:"none", zIndex:1 }}
                  />
                ))}

                {/* Dependency / run-on arrows */}
                {dependencyLinks.links.length > 0 && (
                  <svg
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 64,
                      width: RULER_DAYS * DAY_W,
                      height: dependencyLinks.height,
                      pointerEvents: "none",
                      zIndex: 4,
                      overflow: "visible",
                    }}
                  >
                    <defs>
                      <marker id="gantt-runon-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                        <path d="M0,0 L0,7 L7,3.5 z" fill="#e11d48" />
                      </marker>
                    </defs>
                    {dependencyLinks.links.map((link) => (
                      <path
                        key={link.key}
                        d={link.d}
                        stroke="#e11d48"
                        strokeWidth="1.5"
                        fill="none"
                        markerEnd="url(#gantt-runon-arrow)"
                        opacity="0.8"
                      />
                    ))}
                  </svg>
                )}

                {/* Bar rows (mirrors left column exactly) */}
                {rows.map((row) => {
                  if (row.type === "project") {
                    const { p, color, pct, offset, duration } = row;
                    const left  = offset * DAY_W;
                    const total = Math.max(duration * DAY_W, 50);
                    const fill  = Math.round(total * pct / 100);
                    return (
                      <div key={`R-p-${p.id}`} style={{ ...S.barRow, height: 56 }}>
                        <div id={`track-proj-${p.id}`} style={{ ...S.track, left, width: total, height: 28, borderRadius: 7, background: color }} />
                        {pct > 0 && pct < 100 && <div style={{ position:"absolute", top:"50%", left: left + fill, width: total - fill, height: 28, borderRadius:"0 7px 7px 0", transform:"translateY(-50%)", background:"rgba(255,255,255,0.3)", pointerEvents:"none" }} />}
                        <div id={`fill-proj-${p.id}`} style={{ display:"none" }} />
                        <div style={{ ...S.barPct, left: left + total + 10, color, fontSize: 15 }}>{pct > 0 ? `${pct}%` : ""}</div>
                        <div data-handle="1" title="← Drag to move" style={{ position:"absolute", top:"50%", left, width:12, height:34, marginTop:-17, cursor:"ew-resize", zIndex:6, borderRadius:"7px 0 0 7px", background:"rgba(0,0,0,0.3)", display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.9)", fontSize:10, letterSpacing:"-1px" }}
                          onMouseDown={(e)=>{ e.stopPropagation(); barDragRef.current={ side:"left", entityType:"project", entityId:p.id, projectRef:p, startX:e.clientX, originalOffset:offset, originalDuration:duration, pct, trackId:`track-proj-${p.id}`, fillId:null }; }}>⡣</div>
                        <div data-handle="1" title="→ Drag to resize" style={{ position:"absolute", top:"50%", left:left+total-12, width:12, height:34, marginTop:-17, cursor:"e-resize", zIndex:6, borderRadius:"0 7px 7px 0", background:"rgba(0,0,0,0.3)", display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.9)", fontSize:10, letterSpacing:"-1px" }}
                          onMouseDown={(e)=>{ e.stopPropagation(); barDragRef.current={ side:"right", entityType:"project", entityId:p.id, projectRef:p, startX:e.clientX, originalOffset:offset, originalDuration:duration, pct, trackId:`track-proj-${p.id}`, fillId:null }; }}>⡣</div>
                      </div>
                    );
                  }
                  if (row.type === "phase") {
                    const { p, phase, phaseColor, phasePct, phOffset, phDuration } = row;
                    const left  = phOffset * DAY_W;
                    const total = Math.max(phDuration * DAY_W, 30);
                    const fill  = Math.round(total * phasePct / 100);
                    return (
                      <div key={`R-ph-${p.id}-${phase}`} style={{ ...S.barRow, height: 48 }}>
                        <div style={{ ...S.track, left, width: total, height: 22, borderRadius: 6, background: phaseColor }} />
                        {phasePct > 0 && phasePct < 100 && <div style={{ position:"absolute", top:"50%", left: left + fill, width: total - fill, height: 22, borderRadius:"0 6px 6px 0", transform:"translateY(-50%)", background:"rgba(255,255,255,0.3)", pointerEvents:"none" }} />}
                        <div style={{ ...S.barPct, left: left + total + 8, color: phaseColor, fontSize: 14, fontWeight:700 }}>{phasePct > 0 ? `${phasePct}%` : ""}</div>
                      </div>
                    );
                  }
                  if (row.type === "task") {
                    const { task, offset, p } = row;
                    const left = (offset + (task.start_day || 0)) * DAY_W;
                    const w    = Math.max((task.duration_days || 7) * DAY_W, 12);
                    const phaseColor = PHASE_COLORS[task.phase] || "#3b82f6";
                    const progress = clampProgress(task.progress_percent ?? progressFromStatus(task.status));
                    if (task.is_milestone) {
                      return (
                        <div key={`R-t-${task.id}`} style={{ ...S.barRow, height: 40 }}>
                          <div style={{ position: "absolute", top: "50%", left: left + w / 2 - 9, width: 18, height: 18, transform: "translateY(-50%) rotate(45deg)", borderRadius: 3, background: phaseColor }} />
                        </div>
                      );
                    }
                    return (
                      <div key={`R-t-${task.id}`} style={{ ...S.barRow, height: 40 }}>
                        <div
                          id={`bar-task-${task.id}`}
                          style={{
                            position: "absolute", top: "50%", left, width: w, height: 18,
                            borderRadius: 5, transform: "translateY(-50%)", overflow: "hidden",
                            border: `1px solid ${phaseColor}`,
                            backgroundColor: `${phaseColor}22`,
                            backgroundImage: `repeating-linear-gradient(135deg, ${phaseColor}33 0, ${phaseColor}33 5px, transparent 5px, transparent 10px)`,
                          }}
                        >
                          <div
                            id={`progress-task-${task.id}`}
                            style={{ height: "100%", width: `${progress}%`, background: phaseColor, borderRadius: progress >= 100 ? 4 : "4px 0 0 4px" }}
                          />
                        </div>
                        <div
                          title="Drag to update progress"
                          style={{
                            position: "absolute", top: "50%",
                            left: left + Math.max(0, Math.min(w - 8, (w * progress / 100) - 4)),
                            width: 10, height: 24, marginTop: -12,
                            borderRadius: 6, background: "#0f172a", border: "1px solid #fff",
                            cursor: "ew-resize", zIndex: 7,
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            progressDragRef.current = {
                              taskId: task.id,
                              projectId: p.id,
                              startX: e.clientX,
                              width: w,
                              originalProgress: progress,
                              fillId: `progress-task-${task.id}`,
                            };
                          }}
                        />
                        <div data-handle="1" title="← Drag to move" style={{ position:"absolute", top:"50%", left, width:12, height:24, marginTop:-12, cursor:"ew-resize", zIndex:6, background:"rgba(0,0,0,0.3)", borderRadius:"5px 0 0 5px", display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.9)", fontSize:9 }}
                          onMouseDown={(e)=>{ e.stopPropagation(); barDragRef.current={ side:"left", entityType:"task", entityId:task.id, projectId:p.id, startX:e.clientX, originalOffset:offset+(task.start_day||0), originalDuration:task.duration_days||7, originalValue:task.start_day||0, pct:0, trackId:`bar-task-${task.id}`, fillId:null }; }}>⡣</div>
                        <div data-handle="1" title="→ Drag to resize" style={{ position:"absolute", top:"50%", left:left+w-12, width:12, height:24, marginTop:-12, cursor:"e-resize", zIndex:6, background:"rgba(0,0,0,0.3)", borderRadius:"0 5px 5px 0", display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.9)", fontSize:9 }}
                          onMouseDown={(e)=>{ e.stopPropagation(); barDragRef.current={ side:"right", entityType:"task", entityId:task.id, projectId:p.id, startX:e.clientX, originalOffset:offset+(task.start_day||0), originalDuration:task.duration_days||7, originalValue:task.duration_days||7, pct:0, trackId:`bar-task-${task.id}`, fillId:null }; }}>⡣</div>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Phase legend ── */}
        {!loading && projects.length > 0 && (
          <div style={S.legendRow}>
            {Object.entries(PHASE_COLORS).map(([phase, color]) => (
              <div key={phase} style={S.legendItem}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
                <span style={S.legendLabel}>
                  {phase.replace(" Stage", "").replace("Pre-Construction", "Pre-Con")}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Focus footer bar ── */}
        {focusedProject && (
          <div style={S.focusFooter}>
            <span style={{ fontWeight: 600, color: "#1e293b" }}>{focusedProject.name}</span>
            {focusedProject.client_name && <span style={{ color: "#64748b" }}> · {focusedProject.client_name}</span>}
            {focusedProject.start_date && <span style={{ color: "#64748b" }}> · Started {fmtDate(focusedProject.start_date)}</span>}
            <span style={{ color: "#64748b" }}> · {projectPct(focusedProject)}% complete</span>
            <button style={S.footerBtn} onClick={() => openAddTask(focusedProject)}>+ Add Task</button>
            <button style={S.footerBtn} onClick={() => setShowSetback(true)}>Add Setback</button>
            <button style={S.footerBtn} onClick={() => promptImportTasks(focusedProject)}>Import CSV</button>
          </div>
        )}
      </div>

      {/* ── Setback modal ── */}
      {showSetback && focusedProject && (
        <div style={S.overlay} onClick={() => setShowSetback(false)}>
          <div style={{ ...S.modal, maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={S.modalTitle}>Add Setback</h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>
              Push tasks in {focusedProject.name} later by a number of days.
            </p>

            <label style={S.fieldLabel}>
              Delay
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  style={{ ...S.choiceBtn, ...(setbackForm.days === 7 ? S.choiceBtnActive : {}) }}
                  onClick={() => setSetbackForm((f) => ({ ...f, days: 7 }))}
                >
                  1 Week
                </button>
                <button
                  style={{ ...S.choiceBtn, ...(setbackForm.days === 14 ? S.choiceBtnActive : {}) }}
                  onClick={() => setSetbackForm((f) => ({ ...f, days: 14 }))}
                >
                  2 Weeks
                </button>
              </div>
              <input
                style={S.input}
                type="number"
                min="1"
                value={setbackForm.days}
                onChange={(e) => setSetbackForm((f) => ({ ...f, days: e.target.value }))}
              />
            </label>

            <label style={S.fieldLabel}>
              Move
              <select
                style={S.input}
                value={setbackForm.scope}
                onChange={(e) => setSetbackForm((f) => ({ ...f, scope: e.target.value }))}
              >
                <option value="all">All tasks</option>
                <option value="unfinished">Only pending and in-progress tasks</option>
              </select>
            </label>

            <div style={S.modalActions}>
              <button style={S.cancelBtn} onClick={() => setShowSetback(false)}>Cancel</button>
              <button
                style={{ ...S.primaryBtn, opacity: saving ? 0.5 : 1 }}
                disabled={saving}
                onClick={applySetback}
              >
                {saving ? "Applying..." : "Apply Setback"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / edit task modal ── */}
      {(showAddTask || editTask) && (
        <div
          style={S.overlay}
          onClick={() => { setShowAddTask(false); setEditTask(null); resetTaskForm(); }}
        >
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <h2 style={S.modalTitle}>{editTask ? "Edit Task" : "Add Task"}</h2>
              {editTask && (
                <button style={S.dangerBtn} onClick={deleteTask}>Delete</button>
              )}
            </div>

            <label style={S.fieldLabel}>
              Task Name <span style={{ color: "#ef4444" }}>*</span>
              <input
                style={S.input}
                autoFocus
                value={taskForm.name}
                placeholder="e.g. Frame inspection"
                onChange={(e) => setTaskForm((f) => ({ ...f, name: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") saveTask(); }}
              />
            </label>

            <label style={S.fieldLabel}>
              Task Number
              <input
                style={S.input}
                type="number"
                min="1"
                value={taskForm.sort_order}
                onChange={(e) => setTaskForm((f) => ({ ...f, sort_order: e.target.value }))}
              />
            </label>

            <div style={{ display: "flex", gap: 12 }}>
              <label style={{ ...S.fieldLabel, flex: 1 }}>
                Phase
                <select
                  style={S.input}
                  value={taskForm.phase}
                  onChange={(e) => setTaskForm((f) => ({ ...f, phase: e.target.value }))}
                >
                  {PHASE_DEFS.map((ph) => <option key={ph.key}>{ph.key}</option>)}
                </select>
              </label>
              <label style={{ ...S.fieldLabel, flex: 1 }}>
                Status
                <select
                  style={S.input}
                  value={taskForm.status}
                  onChange={(e) => setTaskForm((f) => ({ ...f, status: e.target.value, progress_percent: progressFromStatus(e.target.value) }))}
                >
                  {STATUS_OPTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </label>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <label style={{ ...S.fieldLabel, flex: 1 }}>
                Start Day
                <input
                  style={S.input}
                  type="number"
                  min="0"
                  value={taskForm.start_day}
                  onChange={(e) => setTaskForm((f) => ({ ...f, start_day: e.target.value }))}
                />
              </label>
              <label style={{ ...S.fieldLabel, flex: 1 }}>
                Duration (days)
                <input
                  style={S.input}
                  type="number"
                  min="1"
                  value={taskForm.duration_days}
                  onChange={(e) => setTaskForm((f) => ({ ...f, duration_days: e.target.value }))}
                />
              </label>
            </div>

            <label style={S.fieldLabel}>
              Progress ({clampProgress(taskForm.progress_percent)}%)
              <input
                style={S.input}
                type="range"
                min="0"
                max="100"
                step="5"
                value={clampProgress(taskForm.progress_percent)}
                onChange={(e) => setTaskForm((f) => ({ ...f, progress_percent: clampProgress(e.target.value), status: statusFromProgress(clampProgress(e.target.value)) }))}
              />
            </label>

            <label style={S.fieldLabel}>
              Assigned Trade
              <input
                style={S.input}
                value={taskForm.assigned_trade}
                placeholder="e.g. Electrician"
                onChange={(e) => setTaskForm((f) => ({ ...f, assigned_trade: e.target.value }))}
              />
            </label>

            <div style={S.checkboxRow}>
              <label style={S.checkLabel}>
                <input
                  type="checkbox"
                  checked={taskForm.is_milestone}
                  onChange={(e) => setTaskForm((f) => ({ ...f, is_milestone: e.target.checked }))}
                />
                Milestone
              </label>
              <label style={S.checkLabel}>
                <input
                  type="checkbox"
                  checked={taskForm.is_long_lead}
                  onChange={(e) => setTaskForm((f) => ({ ...f, is_long_lead: e.target.checked }))}
                />
                Long lead
              </label>
            </div>

            <label style={S.fieldLabel}>
              Notes
              <textarea
                style={{ ...S.input, minHeight: 82, resize: "vertical" }}
                value={taskForm.notes}
                placeholder="Notes, warnings, contacts..."
                onChange={(e) => setTaskForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>

            <div style={S.modalActions}>
              <button
                style={S.cancelBtn}
                onClick={() => { setShowAddTask(false); setEditTask(null); resetTaskForm(); }}
              >
                Cancel
              </button>
              <button
                style={{ ...S.primaryBtn, opacity: (!taskForm.name.trim() || saving) ? 0.5 : 1 }}
                disabled={!taskForm.name.trim() || saving}
                onClick={saveTask}
              >
                {saving ? "Saving..." : editTask ? "Save Changes" : "Add Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New project modal ── */}
      {showNew && (
        <div style={S.overlay} onClick={() => setShowNew(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={S.modalTitle}>New Schedule</h2>

            <label style={S.fieldLabel}>
              Schedule Name <span style={{ color: "#ef4444" }}>*</span>
              <input
                style={S.input} autoFocus
                placeholder="e.g. Smith Residence — New Build"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") createProject(); }}
              />
            </label>
            <label style={S.fieldLabel}>
              Client Name
              <input style={S.input} placeholder="e.g. John & Sarah Smith" value={form.client_name}
                onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} />
            </label>
            <label style={S.fieldLabel}>
              Job Address
              <input style={S.input} placeholder="123 Builder St, Suburb VIC 3000" value={form.job_address}
                onChange={(e) => setForm((f) => ({ ...f, job_address: e.target.value }))} />
            </label>
            <div style={{ display: "flex", gap: 12 }}>
              <label style={{ ...S.fieldLabel, flex: 1 }}>
                Job Type
                <select style={S.input} value={form.job_type}
                  onChange={(e) => setForm((f) => ({ ...f, job_type: e.target.value }))}>
                  {JOB_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label style={{ ...S.fieldLabel, flex: 1 }}>
                Commencement Date
                <input style={S.input} type="date" value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
              </label>
            </div>
            <label style={S.fieldLabel}>
              Upload Tasks CSV
              <input
                style={S.input}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => handleNewProjectCSV(e.target.files?.[0])}
              />
              {newCsvTasks.length > 0 && (
                <span style={{ fontSize: 13, color: "#475569" }}>
                  {newCsvName}: {newCsvTasks.length} task{newCsvTasks.length !== 1 ? "s" : ""} ready to import
                </span>
              )}
            </label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
              <button style={S.cancelBtn} onClick={() => setShowNew(false)}>Cancel</button>
              <button
                style={{ ...S.primaryBtn, opacity: (!form.name.trim() || saving) ? 0.5 : 1 }}
                disabled={!form.name.trim() || saving}
                onClick={createProject}
              >
                {saving ? "Creating…" : "Create Schedule →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    color: "#0f172a",
    fontSize: 14,
  },
  // Banner
  banner:      { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)", padding: "20px 28px", flexWrap: "wrap" },
  bannerLeft:  { display: "flex", alignItems: "center", gap: 18 },
  bannerIcon:  { fontSize: 44, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.16)", borderRadius: 999, width: 68, height: 68, flexShrink: 0 },
  bannerTitle: { margin: 0, fontSize: 26, fontWeight: 700, color: "#fff", lineHeight: 1.2 },
  bannerDesc:  { margin: "3px 0 0", fontSize: 13, opacity: 0.9, color: "#fff" },
  backBtnBanner: { background: "rgba(15,23,42,0.7)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" },
  topBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 28px", background: "white",
    borderBottom: "2px solid #e2e8f0", gap: 16,
    position: "sticky", top: 0, zIndex: 30,
    boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
  },
  topBarLeft:  { display: "flex", alignItems: "center", gap: 20 },
  topBarRight: { display: "flex", alignItems: "center", gap: 10 },
  backLink:  { color: "#475569", textDecoration: "none", fontSize: 16, fontWeight: 500, whiteSpace: "nowrap" },
  pageTitle: { margin: 0, fontSize: 28, fontWeight: 700, color: "#0f172a", lineHeight: 1.2 },
  pageSub:   { margin: "2px 0 0", fontSize: 15, color: "#475569" },
  searchInput: {
    background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8,
    padding: "9px 14px", fontSize: 16, color: "#0f172a", outline: "none", width: 200,
  },
  outlineBtn: {
    background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8,
    padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#fff",
  },
  todayBtn: {
    background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8,
    padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#fff",
  },
  primaryBtn: {
    background: "#fff", color: "#7c3aed", border: "none", borderRadius: 8,
    padding: "10px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer",
  },
  // Stats
  statsRow: {
    display: "flex", gap: 14, padding: "16px 28px",
    background: "white", borderBottom: "2px solid #e2e8f0", flexWrap: "wrap",
  },
  statCard: {
    display: "flex", alignItems: "center", gap: 14,
    padding: "14px 20px", borderRadius: 12, border: "1px solid",
    flex: 1, minWidth: 140,
  },
  statIcon:  { width: 46, height: 46, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 },
  statValue: { fontSize: 28, fontWeight: 700, lineHeight: 1.1 },
  statLabel: { fontSize: 15, color: "#475569", marginTop: 3, fontWeight: 600 },
  // Gantt layout
  ganttWrap: {
    display: "flex", margin: "16px 28px 0",
    background: "white", borderRadius: 14, border: "2px solid #e2e8f0",
    overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", minHeight: 200,
  },
  leftCol: { width: 520, minWidth: 520, flexShrink: 0, borderRight: "2px solid #e2e8f0", overflow: "hidden" },
  nameHeader: {
    height: 64, display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 14px", borderBottom: "2px solid #e2e8f0",
    fontSize: 14, fontWeight: 700, color: "#1e293b", background: "#f1f5f9",
    letterSpacing: "0.05em", textTransform: "uppercase",
  },
  rightCol: { flex: 1, minWidth: 0, overflowX: "auto", overflowY: "hidden", position: "relative" },
  // Left rows
  projectRow: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "0 10px 0 12px", height: 56,
    cursor: "pointer", borderBottom: "1px solid #cbd5e1",
    transition: "background 0.12s", userSelect: "none",
  },
  chevron:  { fontSize: 12, width: 16, flexShrink: 0, textAlign: "center" },
  dot:      { width: 12, height: 12, borderRadius: "50%", flexShrink: 0 },
  pName:    { fontSize: 17, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  pSub:     { fontSize: 14, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  pctLabel: { fontSize: 15, fontWeight: 700, flexShrink: 0 },
  delBtn:   { background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, padding: "2px 6px", flexShrink: 0, lineHeight: 1 },
  rowActionBtn: {
    background: "#e2e8f0", border: "1px solid #cbd5e1", color: "#334155",
    borderRadius: 6, padding: "3px 7px", fontSize: 11, fontWeight: 700,
    cursor: "pointer", flexShrink: 0, lineHeight: 1.2,
  },
  headerGrid: { flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: "44px minmax(0, 1fr) 138px", gap: 10, alignItems: "center" },
  phaseRow: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "0 10px 0 32px", height: 48,
    cursor: "pointer", borderBottom: "1px solid #cbd5e1",
    background: "#f8fafc", userSelect: "none",
  },
  phChevron: { fontSize: 12, color: "#475569", width: 14, flexShrink: 0 },
  phName:    { flex: 1, fontSize: 16, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  progressSpacer: { width: 138, flexShrink: 0 },
  taskRow: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "0 10px 0 48px", height: 40,
    borderBottom: "1px solid #d1d9e4", background: "#f8fafc",
  },
  orderBadge: {
    width: 34, height: 24, borderRadius: 6,
    background: "#eef2ff", border: "1px solid #c7d2fe", color: "#4338ca",
    fontSize: 13, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  taskDot:  { width: 9, height: 9, borderRadius: "50%", flexShrink: 0 },
  taskName: { flex: 1, minWidth: 0, fontSize: 15, color: "#1e293b", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  statusStateBtn: {
    width: 138, border: "none", background: "transparent", color: "#334155",
    padding: "4px 2px", fontSize: 13, fontWeight: 700, cursor: "pointer",
    flexShrink: 0, display: "flex", alignItems: "center", gap: 8,
    justifyContent: "flex-start", textAlign: "left",
  },
  statusStateDot: {
    width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
    boxShadow: "0 0 0 3px rgba(148,163,184,0.14)",
  },
  // Ruler
  monthBand: { display: "flex", height: 34, borderBottom: "1px solid #cbd5e1", background: "#f1f5f9" },
  monthCell: {
    display: "flex", alignItems: "center", paddingLeft: 8,
    fontSize: 14, fontWeight: 700, color: "#0f172a",
    borderRight: "1px solid #cbd5e1", flexShrink: 0,
    whiteSpace: "nowrap", overflow: "hidden",
  },
  dayBand: { display: "flex", height: 30, borderBottom: "2px solid #cbd5e1", background: "#f1f5f9" },
  dayCell: {
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, color: "#475569", flexShrink: 0, fontWeight: 500,
    borderRight: "1px solid #e2e8f0",
  },
  // Today line
  todayLine: {
    position: "absolute", top: 0, bottom: 0, width: 2,
    background: "#ef4444", zIndex: 5, pointerEvents: "none",
  },
  todayBadge: {
    position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)",
    background: "#ef4444", color: "white",
    fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 4, whiteSpace: "nowrap",
  },
  // Bars
  barRow: { borderBottom: "1px solid #cbd5e1", position: "relative", display: "flex", alignItems: "center" },
  track: { position: "absolute", height: 28, borderRadius: 7, top: "50%", transform: "translateY(-50%)" },
  fill:  { position: "absolute", height: 28, borderRadius: 7, top: "50%", transform: "translateY(-50%)" },
  barPct: { position: "absolute", top: "50%", transform: "translateY(-50%)", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" },
  // Focus footer
  focusFooter: {
    position: "fixed", bottom: 0, left: 0, right: 0,
    background: "white", borderTop: "2px solid #e2e8f0",
    padding: "12px 28px", display: "flex", alignItems: "center", gap: 12,
    fontSize: 16, zIndex: 50, boxShadow: "0 -4px 16px rgba(0,0,0,0.1)",
  },
  footerBtn: {
    background: "#7c3aed", color: "#fff", border: "none", borderRadius: 8,
    padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer",
    whiteSpace: "nowrap",
  },
  openFullBtn: {
    marginLeft: "auto", background: "#7c3aed", color: "white",
    borderRadius: 8, padding: "9px 22px", fontWeight: 700,
    fontSize: 16, textDecoration: "none", whiteSpace: "nowrap",
  },
  center: { textAlign: "center", padding: "60px 0", color: "#475569", fontSize: 16 },
  empty:  { textAlign: "center", padding: "80px 28px" },
  // Modal
  overlay:    { position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  modal:      { background: "white", borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 24px 64px rgba(0,0,0,0.18)" },
  modalTitle: { fontSize: 20, fontWeight: 700, color: "#0f172a", margin: 0 },
  fieldLabel: { display: "flex", flexDirection: "column", gap: 5, fontSize: 15, color: "#334155", fontWeight: 600 },
  input:      { background: "white", border: "1px solid #cbd5e1", borderRadius: 8, color: "#0f172a", fontSize: 16, padding: "10px 14px", outline: "none", width: "100%", boxSizing: "border-box" },
  cancelBtn:  { background: "white", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 20px", fontSize: 16, cursor: "pointer" },
  dangerBtn:  { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  checkboxRow: { display: "flex", gap: 20, flexWrap: "wrap" },
  checkLabel: { display: "flex", alignItems: "center", gap: 8, fontSize: 15, color: "#334155", fontWeight: 600, cursor: "pointer" },
  modalActions: { display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 },
  choiceBtn: { background: "#f8fafc", border: "1px solid #cbd5e1", color: "#334155", borderRadius: 8, padding: "9px 12px", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  choiceBtnActive: { background: "#ede9fe", border: "1px solid #7c3aed", color: "#6d28d9" },
  miniBtn:    { background: "#e2e8f0", border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 12px", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "#1e293b", whiteSpace: "nowrap" },
  legendRow:  { display: "flex", flexWrap: "wrap", gap: "8px 22px", padding: "14px 28px 18px", background: "white", borderTop: "2px solid #e2e8f0", margin: "0 0 80px" },
  legendItem: { display: "flex", alignItems: "center", gap: 8 },
  legendLabel: { fontSize: 14, color: "#334155", fontWeight: 600, whiteSpace: "nowrap" },
};
