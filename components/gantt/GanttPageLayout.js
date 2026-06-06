// pages/modules/gantt/index.js
import { useState, useEffect, useMemo, useRef } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../utils/supabase-client";
import GanttSchedulePlannerModal from "./GanttSchedulePlannerModal";
import { useGanttPlanner } from "../../hooks/gantt/useGanttPlanner";
import { downloadTasksCSVForProjects, printTasksPDFForProjects } from "../../lib/gantt/exportUtils";
import {
  DEFAULT_CONTRACT_START_DATE,
  DELAY_REASONS,
  JOB_TYPES,
  PHASE_COLORS,
  PHASE_DEFS,
  PHASE_ORDER,
  PRE_START_BUFFER_DAYS,
  PROJECT_PALETTE,
  STATUS_OPTS,
  TASK_FORM_DEFAULT,
  clampProgress,
  isMissingContractColumn,
  isMissingProgressColumn,
  nextStatus,
  progressFromStatus,
  projectActualStart,
  projectAllowanceDays,
  statusColor,
  statusFromProgress,
  statusLabel,
  tasksFromCSVText,
} from "../../lib/gantt/taskUtils";
import { addDays, dateISO, daysBetween, domSafeId, fmtDate, fmtMoney } from "../../lib/gantt/dateUtils";
import { ganttStyles as S } from "./ganttStyles";

export function GanttPageLayout() {
  const router = useRouter();
  const scrollRef  = useRef(null);
  const csvImportRef = useRef(null);
  const csvProjectRef = useRef(null);
  const progressColumnAvailableRef = useRef(true);
  const panRef     = useRef({ active: false, startX: 0, scrollStart: 0 });
  const barDragRef = useRef(null);
  const progressDragRef = useRef(null);
  const delayDragRef = useRef(null);
  const [grabbing, setGrabbing] = useState(false);

  const [user, setUser]           = useState(null);
  const [projects, setProjects]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showNew, setShowNew]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [focusId, setFocusId]     = useState(null);
  const [expanded, setExpanded]   = useState({});
  const [search, setSearch]       = useState("");
  const [isolatedTaskId, setIsolatedTaskId] = useState(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [editTask, setEditTask]   = useState(null);
  const [taskForm, setTaskForm]   = useState(TASK_FORM_DEFAULT);
  const [newCsvTasks, setNewCsvTasks] = useState([]);
  const [newCsvName, setNewCsvName] = useState("");
  const [lostDays, setLostDays] = useState([]);
  const [delaySelection, setDelaySelection] = useState(null);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [delayForm, setDelayForm] = useState({ reason: "Wet weather", notes: "" });
  const [form, setForm] = useState({
    name: "", client_name: "", job_address: "", job_type: "New Build", start_date: DEFAULT_CONTRACT_START_DATE,
    contract_days: "", weather_lost_day_allowance: "", misc_lost_day_allowance: "", unforeseen_lost_day_allowance: "", daily_ld_rate: "",
  });
  const {
    showPlanner,
    setShowPlanner,
    plannerStep,
    setPlannerStep,
    plannerAnswers,
    plannerPlan,
    visiblePlannerQuestions,
    openPlanner,
    updatePlannerAnswer,
    generatePlannerPreview,
    requestCreateGanttFromPlan,
  } = useGanttPlanner();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUser(user); });
  }, []);

  useEffect(() => { if (user) load(); }, [user]);

  function localDelayKey() {
    return `gantt-delays:${user?.id || "local"}`;
  }

  function localContractKey() {
    return `gantt-contracts:${user?.id || "local"}`;
  }

  function readLocalDelays() {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(window.localStorage.getItem(localDelayKey()) || "[]");
    } catch {
      return [];
    }
  }

  function writeLocalDelays(delays) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(localDelayKey(), JSON.stringify(delays));
  }

  function readLocalContracts() {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(window.localStorage.getItem(localContractKey()) || "{}");
    } catch {
      return {};
    }
  }

  function writeLocalContract(projectId, patch) {
    if (typeof window === "undefined" || !projectId) return;
    const contracts = readLocalContracts();
    contracts[projectId] = { ...(contracts[projectId] || {}), ...patch };
    window.localStorage.setItem(localContractKey(), JSON.stringify(contracts));
  }

  function mergeLocalContractFields(projectRows = []) {
    const contracts = readLocalContracts();
    return projectRows.map((project) => ({
      ...project,
      ...(contracts[project.id] || {}),
    }));
  }

  async function loadLostDays(projectRows) {
    const projectIds = (projectRows || []).map((project) => project.id);
    if (!projectIds.length) {
      setLostDays([]);
      return;
    }
    const { data, error } = await supabase
      .from("gantt_delays")
      .select("id, project_id, start_date, end_date, day_count, reason, notes, created_at")
      .in("project_id", projectIds)
      .order("start_date", { ascending: true });
    if (error) {
      setLostDays(readLocalDelays().filter((delay) => projectIds.includes(delay.project_id)));
      return;
    }
    const databaseDelays = data || [];
    const databaseIds = new Set(databaseDelays.map((delay) => delay.id));
    const localDelays = readLocalDelays().filter((delay) => (
      projectIds.includes(delay.project_id) && !databaseIds.has(delay.id)
    ));
    setLostDays([...databaseDelays, ...localDelays]);
  }

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
    if (!error) {
      const mergedProjects = mergeLocalContractFields(data || []);
      setProjects(mergedProjects);
      await loadLostDays(mergedProjects);
    }
    else console.error("Gantt projects failed to load:", error);
    setLoading(false);
  }

  async function createProject() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const projectPayload = {
        user_id:     user.id,
        name:        form.name.trim(),
        client_name: form.client_name.trim() || null,
        job_address: form.job_address.trim() || null,
        job_type:    form.job_type,
        start_date:  form.start_date || null,
        actual_start_date: form.start_date || null,
        contract_days: Math.max(0, Number(form.contract_days) || 0),
        weather_lost_day_allowance: Math.max(0, Number(form.weather_lost_day_allowance) || 0),
        misc_lost_day_allowance: Math.max(0, Number(form.misc_lost_day_allowance) || 0),
        unforeseen_lost_day_allowance: Math.max(0, Number(form.unforeseen_lost_day_allowance) || 0),
        daily_ld_rate: Math.max(0, Number(form.daily_ld_rate) || 0),
      };
      let { data, error } = await supabase
        .from("gantt_projects")
        .insert(projectPayload)
        .select()
        .single();
      let usedContractFallback = false;
      if (isMissingContractColumn(error)) {
        const {
          actual_start_date: _actualStart,
          contract_days: _contractDays,
          weather_lost_day_allowance: _weatherAllowance,
          misc_lost_day_allowance: _miscAllowance,
          unforeseen_lost_day_allowance: _unforeseenAllowance,
          daily_ld_rate: _dailyLdRate,
          ...fallbackPayload
        } = projectPayload;
        const retry = await supabase.from("gantt_projects").insert(fallbackPayload).select().single();
        data = retry.data;
        error = retry.error;
        usedContractFallback = true;
      }
      if (error) throw error;
      if (usedContractFallback && data?.id) {
        writeLocalContract(data.id, {
          actual_start_date: projectPayload.actual_start_date,
          start_date: projectPayload.start_date,
          contract_days: projectPayload.contract_days,
          weather_lost_day_allowance: projectPayload.weather_lost_day_allowance,
          misc_lost_day_allowance: projectPayload.misc_lost_day_allowance,
          unforeseen_lost_day_allowance: projectPayload.unforeseen_lost_day_allowance,
          daily_ld_rate: projectPayload.daily_ld_rate,
        });
      }
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

  function patchProject(projectId, patch) {
    setProjects((prev) => prev.map((p) => (
      p.id === projectId ? { ...p, ...patch } : p
    )));
  }

  async function updateProjectContractField(project, field, rawValue) {
    if (!project) return;
    const numericFields = new Set([
      "contract_days",
      "weather_lost_day_allowance",
      "misc_lost_day_allowance",
      "unforeseen_lost_day_allowance",
    ]);
    const moneyFields = new Set(["daily_ld_rate"]);
    const value = moneyFields.has(field)
      ? Math.max(0, Number(rawValue) || 0)
      : numericFields.has(field)
      ? Math.max(0, Math.round(Number(rawValue) || 0))
      : (rawValue || null);
    const patch = field === "actual_start_date"
      ? { actual_start_date: value, start_date: value }
      : { [field]: value };
    patchProject(project.id, patch);
    const { error } = await supabase
      .from("gantt_projects")
      .update(patch)
      .eq("id", project.id)
      .eq("user_id", user.id);
    if (error) {
      if (isMissingContractColumn(error)) {
        writeLocalContract(project.id, patch);
        console.warn("Contract fields saved locally until the Supabase migration is applied.", error);
      } else {
        alert("Could not save contract field: " + error.message);
        load();
      }
    }
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

  function openAddTask(project, anchorTask = null) {
    const tasks = project?.gantt_tasks || [];
    const lastTask = tasks.slice().sort((a, b) => (b.start_day || 0) - (a.start_day || 0))[0];
    const anchorPosition = anchorTask ? (anchorTask.sort_order ?? 0) + 1 : tasks.length + 1;
    setEditTask(null);
    resetTaskForm({
      phase: anchorTask?.phase || lastTask?.phase || "Pre-Construction",
      sort_order: anchorPosition,
      position_mode: "insert",
      start_day: anchorTask ? (anchorTask.start_day ?? 0) : lastTask ? (lastTask.start_day || 0) + (lastTask.duration_days || 7) : 0,
      duration_days: anchorTask ? Math.max(1, anchorTask.duration_days || 7) : TASK_FORM_DEFAULT.duration_days,
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
      start_day: Math.round(Number(taskForm.start_day) || 0),
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
      if (taskForm.position_mode === "replace") {
        const targetIndex = Math.max(0, Math.min((project.gantt_tasks || []).length - 1, Math.round(Number(taskForm.sort_order) || 1) - 1));
        const targetTask = orderedTasks(project.gantt_tasks || [])[targetIndex];
        if (!targetTask) {
          alert("There is no task at that number to replace.");
          setSaving(false);
          return;
        }
        let { error } = await supabase
          .from("gantt_tasks")
          .update({ ...payload, sort_order: targetTask.sort_order ?? targetIndex })
          .eq("id", targetTask.id)
          .eq("project_id", project.id);
        if (error?.message?.includes("progress_percent")) {
          const { progress_percent: _progress, ...payloadWithoutProgress } = payload;
          const retry = await supabase
            .from("gantt_tasks")
            .update({ ...payloadWithoutProgress, sort_order: targetTask.sort_order ?? targetIndex })
            .eq("id", targetTask.id)
            .eq("project_id", project.id);
          error = retry.error;
        }
        if (error) { alert("Error: " + error.message); setSaving(false); return; }
        const nextOrderedTasks = normaliseTaskOrder((project.gantt_tasks || []).map((task) => (
          task.id === targetTask.id ? { ...task, ...payload, sort_order: targetTask.sort_order ?? targetIndex } : task
        )));
        patchProjectTasks(project.id, () => nextOrderedTasks);
        setShowAddTask(false);
        resetTaskForm();
        setSaving(false);
        return;
      }
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

  function beginDelaySelection(offset, event) {
    if (!focusedProject || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    delayDragRef.current = { start: offset, end: offset };
    setDelaySelection({ start: offset, end: offset });
  }

  function extendDelaySelection(offset) {
    if (!delayDragRef.current) return;
    delayDragRef.current.end = offset;
    setDelaySelection({ start: delayDragRef.current.start, end: offset });
  }

  function finishDelaySelection(event) {
    if (!delayDragRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    const { start, end } = delayDragRef.current;
    delayDragRef.current = null;
    setDelaySelection({ start: Math.min(start, end), end: Math.max(start, end) });
    setDelayForm({ reason: "Wet weather", notes: "" });
    setShowDelayModal(true);
  }

  async function applyLostDays() {
    const project = focusedProject;
    if (!project || !delaySelection) return;

    const selectionStart = Math.min(delaySelection.start, delaySelection.end);
    const selectionEnd = Math.max(delaySelection.start, delaySelection.end);
    const dayCount = selectionEnd - selectionStart + 1;
    const lostStartDate = addDays(rulerStart, selectionStart);
    const lostEndDate = addDays(rulerStart, selectionEnd);
    const actualStart = projectActualStart(project);
    const projectStartDate = actualStart ? new Date(actualStart) : addDays(rulerStart, projBarOffset(project));
    const lostStartDay = daysBetween(projectStartDate, lostStartDate);
    const changedTasks = (project.gantt_tasks || []).map((task) => {
      const start = task.start_day || 0;
      const duration = task.duration_days || 1;
      const end = start + duration;
      if (end <= lostStartDay) return task;
      if (start >= lostStartDay) return { ...task, start_day: start + dayCount };
      return { ...task, duration_days: duration + dayCount };
    });
    const tasksToSave = changedTasks.filter((task) => {
      const previous = (project.gantt_tasks || []).find((item) => item.id === task.id);
      return previous && (previous.start_day !== task.start_day || previous.duration_days !== task.duration_days);
    });
    if (!tasksToSave.length) {
      alert("There is no scheduled work on or after the selected dates.");
      return;
    }

    setSaving(true);
    try {
      const taskResults = await Promise.all(tasksToSave.map((task) => (
        supabase
          .from("gantt_tasks")
          .update({ start_day: task.start_day, duration_days: task.duration_days })
          .eq("id", task.id)
          .eq("project_id", project.id)
      )));
      const taskError = taskResults.find((result) => result.error)?.error;
      if (taskError) {
        await Promise.all(tasksToSave.map((task) => {
          const previous = (project.gantt_tasks || []).find((item) => item.id === task.id);
          return supabase
            .from("gantt_tasks")
            .update({ start_day: previous?.start_day || 0, duration_days: previous?.duration_days || 1 })
            .eq("id", task.id)
            .eq("project_id", project.id);
        }));
        throw taskError;
      }

      const delayRecord = {
        project_id: project.id,
        start_date: dateISO(lostStartDate),
        end_date: dateISO(lostEndDate),
        day_count: dayCount,
        reason: delayForm.reason,
        notes: delayForm.notes.trim() || null,
      };
      const { data: savedDelay, error: delayError } = await supabase
        .from("gantt_delays")
        .insert(delayRecord)
        .select()
        .single();
      const recordedDelay = savedDelay || {
        ...delayRecord,
        id: `local-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      if (delayError) {
        const localDelays = [...readLocalDelays(), recordedDelay];
        writeLocalDelays(localDelays);
      }

      patchProjectTasks(project.id, () => changedTasks);
      setLostDays((current) => [...current, recordedDelay]);
      setShowDelayModal(false);
      setDelaySelection(null);
    } catch (err) {
      alert("Lost days could not be applied: " + err.message);
    }
    setSaving(false);
  }

  async function deleteLostDay(delay) {
    if (!delay) return;
    const label = `${delay.reason || "Lost days"} (${delay.day_count || 0} day${Number(delay.day_count) === 1 ? "" : "s"})`;
    if (!confirm(`Delete this claimed lost-time event?\n\n${label}`)) return;
    setSaving(true);
    try {
      if (!String(delay.id || "").startsWith("local-")) {
        const { error } = await supabase
          .from("gantt_delays")
          .delete()
          .eq("id", delay.id)
          .eq("project_id", delay.project_id);
        if (error) throw error;
      }
      const nextLocalDelays = readLocalDelays().filter((item) => item.id !== delay.id);
      writeLocalDelays(nextLocalDelays);
      setLostDays((current) => current.filter((item) => item.id !== delay.id));
    } catch (err) {
      alert("Could not delete lost-day claim: " + (err?.message || "Unknown error"));
    }
    setSaving(false);
  }

  function downloadTasksCSV(projectScope) {
    downloadTasksCSVForProjects(visible, projectScope);
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
    printTasksPDFForProjects(visible, projectScope);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  function getProjectStatusSummary(project) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tasks = project?.gantt_tasks || [];
    const doneTasks = tasks.filter((t) => t.status === "complete").length;
    if (!project || !tasks.length) {
      return { taskCount: 0, doneTasks: 0, completePct: 0, onTrack: 0, atRisk: 0, overdue: 0, state: "No tasks" };
    }
    const completePct = Math.round(doneTasks / tasks.length * 100);
    const maxDay = Math.max(...tasks.map((t) => (t.start_day || 0) + (t.duration_days || 7)));
    const actualStart = projectActualStart(project);
    const start = actualStart ? new Date(actualStart) : null;
    if (!start) {
      const atRisk = completePct < 50 ? 1 : 0;
      return { taskCount: tasks.length, doneTasks, completePct, onTrack: atRisk ? 0 : 1, atRisk, overdue: 0, state: atRisk ? "At Risk" : "On Track" };
    }
    const end = addDays(actualStart, maxDay);
    if (today > end && completePct < 100) {
      return { taskCount: tasks.length, doneTasks, completePct, onTrack: 0, atRisk: 0, overdue: 1, state: "Overdue" };
    }
    const elapsed = daysBetween(start, today);
    const expected = Math.min(1, elapsed / maxDay);
    const atRisk = doneTasks / tasks.length < expected - 0.15 ? 1 : 0;
    return { taskCount: tasks.length, doneTasks, completePct, onTrack: atRisk ? 0 : 1, atRisk, overdue: 0, state: atRisk ? "At Risk" : "On Track" };
  }

  const stats = useMemo(() => {
    let totalTasks = 0, doneTasks = 0, onTrack = 0, atRisk = 0, overdue = 0;
    for (const p of projects) {
      const tasks = p.gantt_tasks || [];
      totalTasks += tasks.length;
      const summary = getProjectStatusSummary(p);
      doneTasks += summary.doneTasks;
      onTrack += summary.onTrack;
      atRisk += summary.atRisk;
      overdue += summary.overdue;
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
    const sourceProjects = focusId ? projects.filter((p) => p.id === focusId) : projects;
    const starts = sourceProjects.filter((p) => projectActualStart(p)).map((p) => {
      const actualStart = new Date(projectActualStart(p));
      const tasks = p.gantt_tasks || [];
      const earliestTaskDay = tasks.length ? Math.min(...tasks.map((task) => task.start_day ?? 0)) : 0;
      return addDays(actualStart, Math.min(-PRE_START_BUFFER_DAYS, earliestTaskDay - PRE_START_BUFFER_DAYS));
    });
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const base = starts.length ? new Date(Math.min(...starts)) : today;
    return base;
  }, [projects, focusId]);

  const RULER_DAYS = useMemo(() => {
    let maxVisibleDay = 90;
    for (const p of projects) {
      const actualStart = projectActualStart(p);
      const projectStartOffset = actualStart ? daysBetween(rulerStart, new Date(actualStart)) : 2;
      const tasks = p.gantt_tasks || [];
      const projectEnd = tasks.length
        ? Math.max(...tasks.map((t) => (t.start_day || 0) + (t.duration_days || 7)))
        : 60;
      const projectMin = tasks.length ? Math.min(...tasks.map((t) => t.start_day ?? 0)) : 0;
      maxVisibleDay = Math.max(maxVisibleDay, projectStartOffset + projectEnd + 21, projectStartOffset + projectMin + 42);
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
  function isolateTaskConnections(project, task) {
    if (!project || !task) return;
    setIsolatedTaskId((current) => current === task.id ? null : task.id);
    const nextExpanded = {};
    [...new Set((project.gantt_tasks || []).map((item) => item.phase))].forEach((phase) => {
      nextExpanded[`${project.id}:${phase}`] = true;
    });
    setExpanded((current) => ({ ...current, ...nextExpanded }));
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

  useEffect(() => {
    if (!focusId) setIsolatedTaskId(null);
  }, [focusId]);

  function projectPct(p) {
    const tasks = p.gantt_tasks || [];
    if (!tasks.length) return 0;
    return Math.round(tasks.filter((t) => t.status === "complete").length / tasks.length * 100);
  }
  function projectMaxDay(p) {
    const tasks = p.gantt_tasks || [];
    if (!tasks.length) return 60;
    return Math.max(...tasks.map((t) => (t.start_day ?? 0) + (t.duration_days || 7)));
  }
  function projectMinDay(p) {
    const tasks = p.gantt_tasks || [];
    if (!tasks.length) return 0;
    return Math.min(...tasks.map((t) => t.start_day ?? 0));
  }
  function projBarOffset(p) {
    const actualStart = projectActualStart(p);
    if (!actualStart) return 2;
    return daysBetween(rulerStart, new Date(actualStart));
  }

  const focusedProject = focusId ? projects.find((p) => p.id === focusId) : null;

  const isolatedTaskIds = useMemo(() => {
    if (!focusedProject || !isolatedTaskId) return null;
    const tasks = focusedProject.gantt_tasks || [];
    const byId = new Map(tasks.map((task) => [task.id, task]));
    if (!byId.has(isolatedTaskId)) return null;

    const forward = new Map();
    const backward = new Map();
    const hasExplicitLinks = tasks.some((task) => (task.dependencies || []).length);
    if (hasExplicitLinks) {
      tasks.forEach((task) => {
        (task.dependencies || []).forEach((depId) => {
          if (!byId.has(depId)) return;
          const nextForward = forward.get(depId) || [];
          nextForward.push(task.id);
          forward.set(depId, nextForward);
          const nextBackward = backward.get(task.id) || [];
          nextBackward.push(depId);
          backward.set(task.id, nextBackward);
        });
      });
    } else {
      const ordered = orderedTasks(tasks);
      ordered.forEach((task, index) => {
        const previous = ordered[index - 1];
        if (!previous) return;
        forward.set(previous.id, [...(forward.get(previous.id) || []), task.id]);
        backward.set(task.id, [...(backward.get(task.id) || []), previous.id]);
      });
    }

    const connected = new Set([isolatedTaskId]);
    const queue = [isolatedTaskId];
    while (queue.length) {
      const current = queue.shift();
      [...(forward.get(current) || []), ...(backward.get(current) || [])].forEach((nextId) => {
        if (connected.has(nextId)) return;
        connected.add(nextId);
        queue.push(nextId);
      });
    }
    return connected;
  }, [focusedProject, isolatedTaskId]);

  // ── Flat row list (keeps left + right bars in sync) ───────────────────────
  const rows = useMemo(() => {
    const out = [];
    visible.forEach((p, pIdx) => {
      const color    = getColor(pIdx);
      const pct      = projectPct(p);
      const tasks    = p.gantt_tasks || [];
      const offset   = projBarOffset(p);
      const minDay   = projectMinDay(p);
      const maxDay   = projectMaxDay(p);
      const barOffset = offset + minDay;
      const duration = Math.max(1, maxDay - minDay);
      const phases   = [...new Set(tasks.map((t) => t.phase))].sort((a, b) => {
        const aMin = Math.min(...tasks.filter((t) => t.phase === a).map((t) => t.sort_order ?? 9999));
        const bMin = Math.min(...tasks.filter((t) => t.phase === b).map((t) => t.sort_order ?? 9999));
        const ao = tasks.find((t) => t.phase === a)?.phase_order ?? 99;
        const bo = tasks.find((t) => t.phase === b)?.phase_order ?? 99;
        return aMin - bMin || ao - bo;
      });
      out.push({ type: "project", p, pIdx, color, pct, offset, barOffset, duration });
      if (focusId === p.id) {
        phases.forEach((phase) => {
          const phaseTasksAll = orderedTasks(tasks.filter((t) => t.phase === phase));
          const phaseTasks = isolatedTaskIds
            ? phaseTasksAll.filter((task) => isolatedTaskIds.has(task.id))
            : phaseTasksAll;
          if (!phaseTasks.length) return;
          const phaseColor = PHASE_COLORS[phase] || "#8b5cf6";
          const phasePct   = phaseTasks.length
            ? Math.round(phaseTasks.filter((t) => t.status === "complete").length / phaseTasks.length * 100)
            : 0;
          const minSD      = Math.min(...phaseTasks.map((t) => t.start_day ?? 0));
          const maxED      = Math.max(...phaseTasks.map((t) => (t.start_day ?? 0) + (t.duration_days || 7)));
          const exp        = isExpanded(p.id, phase);
          out.push({
            type: "phase",
            p,
            phase,
            phaseColor,
            phasePct,
            phOffset: offset + minSD,
            phDuration: maxED - minSD,
            exp,
            phaseTaskStarts: phaseTasks.map((task) => ({ id: task.id, start_day: task.start_day ?? 0 })),
          });
          if (exp) {
            phaseTasks.forEach((task) => out.push({ type: "task", p, task, offset }));
          }
        });
      }
    });
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, focusId, expanded, isolatedTaskIds]);

  const focusedLostDays = useMemo(() => {
    if (!focusedProject) return [];
    return lostDays
      .filter((delay) => delay.project_id === focusedProject.id)
      .map((delay) => {
        const start = daysBetween(rulerStart, new Date(`${delay.start_date}T00:00:00`));
        const end = daysBetween(rulerStart, new Date(`${delay.end_date}T00:00:00`));
        return { ...delay, start, end };
      })
      .filter((delay) => delay.end >= 0 && delay.start < RULER_DAYS);
  }, [focusedProject, lostDays, rulerStart, RULER_DAYS]);

  const focusedEotSummary = useMemo(() => {
    if (!focusedProject) return { totalDays: 0, events: [], reasons: [] };
    const events = lostDays
      .filter((delay) => delay.project_id === focusedProject.id)
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
    const totalDays = events.reduce((sum, delay) => sum + (Number(delay.day_count) || 0), 0);
    const reasonTotals = new Map();
    events.forEach((delay) => {
      const reason = delay.reason || "Other";
      reasonTotals.set(reason, (reasonTotals.get(reason) || 0) + (Number(delay.day_count) || 0));
    });
    const reasons = Array.from(reasonTotals.entries())
      .map(([reason, days]) => ({ reason, days }))
      .sort((a, b) => b.days - a.days || a.reason.localeCompare(b.reason));
    return { totalDays, events, reasons };
  }, [focusedProject, lostDays]);

  const focusedContractSummary = useMemo(() => {
    if (!focusedProject) {
      return {
        actualStart: null,
        contractDays: 0,
        allowanceDays: 0,
        lostDays: 0,
        excessDays: 0,
        contractCompletion: null,
        adjustedCompletion: null,
        latestNoticeDue: null,
        noticeStatus: "No job selected",
        dailyLdRate: 0,
        liquidatedDamages: 0,
      };
    }
    const actualStart = projectActualStart(focusedProject);
    const contractDays = Math.max(0, Number(focusedProject.contract_days) || 0);
    const dailyLdRate = Math.max(0, Number(focusedProject.daily_ld_rate) || 0);
    const allowanceDays = projectAllowanceDays(focusedProject);
    const lostDaysTotal = focusedEotSummary.totalDays;
    const excessDays = Math.max(0, lostDaysTotal - allowanceDays);
    const contractCompletion = actualStart && contractDays
      ? addDays(actualStart, Math.max(0, contractDays - 1))
      : null;
    const adjustedCompletion = contractCompletion
      ? addDays(contractCompletion, excessDays)
      : null;
    const tasks = focusedProject.gantt_tasks || [];
    const maxTaskDay = tasks.length
      ? Math.max(...tasks.map((task) => (task.start_day ?? 0) + (task.duration_days || 1)))
      : 0;
    const scheduleCompletion = actualStart && maxTaskDay
      ? addDays(actualStart, Math.max(0, maxTaskDay - 1))
      : null;
    const scheduleOverrunDays = adjustedCompletion && scheduleCompletion
      ? Math.max(0, daysBetween(adjustedCompletion, scheduleCompletion))
      : 0;
    const liquidatedDamages = scheduleOverrunDays * dailyLdRate;
    const latestEvent = focusedEotSummary.events[focusedEotSummary.events.length - 1] || null;
    const latestNoticeDue = latestEvent ? addDays(latestEvent.end_date, 10) : null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let noticeStatus = "No lost time recorded";
    if (latestNoticeDue) {
      noticeStatus = today > latestNoticeDue ? "Notice overdue" : `Notice due by ${fmtDate(latestNoticeDue)}`;
    }
    const claimStatus = excessDays > 0
      ? `EOT claim required for ${excessDays} day${excessDays !== 1 ? "s" : ""}`
      : lostDaysTotal > 0
        ? "Notify owner; allowance not exceeded"
        : "Within contract allowance";
    return {
      actualStart,
      contractDays,
      allowanceDays,
      lostDays: lostDaysTotal,
      excessDays,
      contractCompletion,
      adjustedCompletion,
      scheduleCompletion,
      scheduleOverrunDays,
      dailyLdRate,
      liquidatedDamages,
      latestNoticeDue,
      noticeStatus,
      claimStatus,
    };
  }, [focusedProject, focusedEotSummary]);

  const selectedProjectStats = useMemo(() => {
    if (!focusedProject) return null;
    const summary = getProjectStatusSummary(focusedProject);
    return {
      ...summary,
      lostDays: focusedEotSummary.totalDays,
      delayEvents: focusedEotSummary.events.length,
    };
  }, [focusedProject, focusedEotSummary]);

  const isolatedTask = useMemo(() => {
    if (!focusedProject || !isolatedTaskId) return null;
    return (focusedProject.gantt_tasks || []).find((task) => task.id === isolatedTaskId) || null;
  }, [focusedProject, isolatedTaskId]);

  const dependencyLinks = useMemo(() => {
    const taskRows = new Map();
    const projectTaskRows = new Map();
    let y = 0;
    rows.forEach((row) => {
      const h = row.type === "project" ? 56 : row.type === "phase" ? 48 : 40;
      if (row.type === "task") {
        const xStart = (row.offset + (row.task.start_day || 0)) * DAY_W;
        const xEnd = xStart + Math.max((row.task.duration_days || 7) * DAY_W, 12);
        const taskRow = { task: row.task, p: row.p, y: y + h / 2, xStart, xEnd };
        taskRows.set(row.task.id, taskRow);
        const projectRows = projectTaskRows.get(row.p.id) || [];
        projectRows.push(taskRow);
        projectTaskRows.set(row.p.id, projectRows);
      }
      y += h;
    });
    const links = [];
    const linkedProjects = new Set();
    function addDependencyLink(from, to, key) {
      const gap = to.xStart - from.xEnd;
      const midX = gap > 0
        ? from.xEnd + Math.min(gap, Math.max(14, gap * 0.5))
        : from.xEnd + 14;
      links.push({
        key,
        d: `M${from.xEnd},${from.y} L${midX},${from.y} L${midX},${to.y} L${to.xStart},${to.y}`,
      });
      linkedProjects.add(to.p.id);
    }
    taskRows.forEach((to) => {
      (to.task.dependencies || []).forEach((depId) => {
        const from = taskRows.get(depId);
        if (!from || from.p.id !== to.p.id) return;
        addDependencyLink(from, to, `${depId}-${to.task.id}`);
      });
    });
    projectTaskRows.forEach((projectRows, projectId) => {
      if (linkedProjects.has(projectId)) return;
      projectRows.forEach((to, index) => {
        const from = projectRows[index - 1];
        if (!from) return;
        addDependencyLink(from, to, `runon-${from.task.id}-${to.task.id}`);
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
      const pd = progressDragRef.current;
      if (pd) {
        const dx = e.clientX - pd.startX;
        const next = clampProgress(pd.originalProgress + (dx / pd.width) * 100);
        const fillEl = document.getElementById(pd.fillId);
        if (fillEl) fillEl.style.width = `${next}%`;
        return;
      }
      const bd = barDragRef.current;
      if (bd) {
        const dx = e.clientX - bd.startX;
        const deltaDays = dx / DAY_W;
        const trackEl = document.getElementById(bd.trackId);
        if (!trackEl) return;
        if (bd.side === "left" || bd.side === "move") {
          const newLeft = Math.max(0, bd.originalLeftPx != null ? bd.originalLeftPx + dx : (bd.originalOffset + deltaDays) * DAY_W);
          trackEl.style.left = newLeft + "px";
          (bd.handleIds || []).forEach((item) => {
            const handleEl = document.getElementById(item.id);
            if (handleEl) handleEl.style.left = `${item.left + dx}px`;
          });
          if (bd.progressHandleId && bd.originalProgressHandleLeft != null) {
            const progressHandleEl = document.getElementById(bd.progressHandleId);
            if (progressHandleEl) progressHandleEl.style.left = `${bd.originalProgressHandleLeft + dx}px`;
          }
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
        return;
      }
      if (panRef.current.active && scrollRef.current) {
        const dx = e.clientX - panRef.current.startX;
        scrollRef.current.scrollLeft = panRef.current.scrollStart - dx;
      }
    };
    const onUp = async (e) => {
      if (delayDragRef.current) {
        const { start, end } = delayDragRef.current;
        delayDragRef.current = null;
        setDelaySelection({ start: Math.min(start, end), end: Math.max(start, end) });
        setDelayForm({ reason: "Wet weather", notes: "" });
        setShowDelayModal(true);
      }
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
        } else if (bd.entityType === "phase" && bd.side === "left") {
          const phaseStarts = bd.phaseTaskStarts || [];
          const updates = phaseStarts.map((item) => ({
            id: item.id,
            start_day: item.start_day + deltaDays,
          }));
          const results = await Promise.all(updates.map((item) => (
            supabase
              .from("gantt_tasks")
              .update({ start_day: item.start_day })
              .eq("id", item.id)
              .eq("project_id", bd.projectId)
          )));
          const saveError = results.find((result) => result.error)?.error;
          if (saveError) throw saveError;
          const updateMap = new Map(updates.map((item) => [item.id, item.start_day]));
          patchProjectTasks(bd.projectId, (tasks) => tasks.map((task) => (
            updateMap.has(task.id) ? { ...task, start_day: updateMap.get(task.id) } : task
          )));
        } else if (bd.entityType === "task" && (bd.side === "left" || bd.side === "move")) {
          const newVal = bd.originalValue + deltaDays;
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
        alert("Could not save the bar move: " + (err?.message || "Unknown error"));
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
            <button style={{ ...S.todayBtn, background: "#0f766e", borderColor: "#0f766e" }} onClick={openPlanner}>+ Plan From Template</button>
            {focusedProject && (
              <button style={S.todayBtn} onClick={() => openAddTask(focusedProject)}>+ Task</button>
            )}
            {focusedProject && (
              <button style={S.todayBtn} onClick={() => promptImportTasks(focusedProject)}>Import CSV</button>
            )}
            {isolatedTask && (
              <button
                style={{ ...S.todayBtn, background: "#fef3c7", borderColor: "#f59e0b", color: "#92400e" }}
                title="Show the full schedule again"
                onClick={() => setIsolatedTaskId(null)}
              >
                Connected to: {isolatedTask.name} ×
              </button>
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
          <div style={{ ...S.statCard, ...S.jobSelectorCard, background: "#f5f3ff", borderColor: "#ede9fe" }}>
            <div style={{ ...S.statIcon, background: "#8b5cf622", color: "#8b5cf6" }}>📁</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ ...S.statValue, color: "#8b5cf6" }}>{stats.total}</div>
              <div style={S.statLabel}>Total Projects</div>
            </div>
            <select
              style={S.jobSelect}
              value={focusId || ""}
              onChange={(e) => {
                setSearch("");
                setFocusId(e.target.value || null);
              }}
            >
              <option value="">Select job</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>

          {[
            { icon: "✅", label: "Tasks Done", value: selectedProjectStats ? `${selectedProjectStats.completePct}%` : "-", sub: selectedProjectStats ? `${selectedProjectStats.doneTasks}/${selectedProjectStats.taskCount}` : "Select job", color: "#3b82f6", bg: "#eff6ff", border: "#dbeafe" },
            { icon: "📅", label: "On Track", value: selectedProjectStats ? selectedProjectStats.onTrack : "-", sub: selectedProjectStats?.state || "Select job", color: "#22c55e", bg: "#f0fdf4", border: "#dcfce7" },
            { icon: "⚠️", label: "At Risk", value: selectedProjectStats ? selectedProjectStats.atRisk : "-", sub: selectedProjectStats?.atRisk ? "Behind expected" : "No risk flag", color: "#f97316", bg: "#fff7ed", border: "#fed7aa" },
            { icon: "🚩", label: "Overdue", value: selectedProjectStats ? selectedProjectStats.overdue : "-", sub: selectedProjectStats?.overdue ? "Past finish" : "Not overdue", color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
            { icon: "🗓️", label: "Lost Days", value: selectedProjectStats ? selectedProjectStats.lostDays : "-", sub: selectedProjectStats ? `${selectedProjectStats.delayEvents} EOT event${selectedProjectStats.delayEvents !== 1 ? "s" : ""}` : "Select job", color: "#c2410c", bg: "#fff7ed", border: "#fed7aa" },
          ].map((s) => (
            <div key={s.label} style={{ ...S.statCard, ...S.compactStatCard, background: s.bg, borderColor: s.border }}>
              <div style={{ ...S.statIcon, ...S.compactStatIcon, background: s.color + "22", color: s.color }}>{s.icon}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...S.statValue, ...S.compactStatValue, color: s.color }}>{s.value}</div>
                <div style={S.statLabel}>{s.label}</div>
                <div style={S.statSubLabel}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {focusedProject && (
          <div style={S.contractPanel}>
            <div style={S.contractFields}>
              <label style={S.contractField}>
                Contract Start
                <input
                  style={S.contractInput}
                  type="date"
                  value={projectActualStart(focusedProject) || ""}
                  onChange={(e) => updateProjectContractField(focusedProject, "actual_start_date", e.target.value)}
                />
              </label>
              <label style={S.contractField}>
                Contract Days
                <input
                  style={S.contractInput}
                  type="number"
                  min="0"
                  value={focusedProject.contract_days ?? 0}
                  onChange={(e) => patchProject(focusedProject.id, { contract_days: e.target.value })}
                  onBlur={(e) => updateProjectContractField(focusedProject, "contract_days", e.target.value)}
                />
              </label>
              <label style={S.contractField}>
                Weather Allowance
                <input
                  style={S.contractInput}
                  type="number"
                  min="0"
                  value={focusedProject.weather_lost_day_allowance ?? 0}
                  onChange={(e) => patchProject(focusedProject.id, { weather_lost_day_allowance: e.target.value })}
                  onBlur={(e) => updateProjectContractField(focusedProject, "weather_lost_day_allowance", e.target.value)}
                />
              </label>
              <label style={S.contractField}>
                Misc Allowance
                <input
                  style={S.contractInput}
                  type="number"
                  min="0"
                  value={focusedProject.misc_lost_day_allowance ?? 0}
                  onChange={(e) => patchProject(focusedProject.id, { misc_lost_day_allowance: e.target.value })}
                  onBlur={(e) => updateProjectContractField(focusedProject, "misc_lost_day_allowance", e.target.value)}
                />
              </label>
              <label style={S.contractField}>
                Unforeseen Allowance
                <input
                  style={S.contractInput}
                  type="number"
                  min="0"
                  value={focusedProject.unforeseen_lost_day_allowance ?? 0}
                  onChange={(e) => patchProject(focusedProject.id, { unforeseen_lost_day_allowance: e.target.value })}
                  onBlur={(e) => updateProjectContractField(focusedProject, "unforeseen_lost_day_allowance", e.target.value)}
                />
              </label>
              <label style={S.contractField}>
                Daily LD
                <input
                  style={S.contractInput}
                  type="number"
                  min="0"
                  step="0.01"
                  value={focusedProject.daily_ld_rate ?? 0}
                  onChange={(e) => patchProject(focusedProject.id, { daily_ld_rate: e.target.value })}
                  onBlur={(e) => updateProjectContractField(focusedProject, "daily_ld_rate", e.target.value)}
                />
              </label>
            </div>
            <div style={S.contractSummary}>
              <div style={S.contractSummaryItem}>
                <span>Contract completion</span>
                <strong>{fmtDate(focusedContractSummary.contractCompletion)}</strong>
              </div>
              <div style={S.contractSummaryItem}>
                <span>Allowance used</span>
                <strong>{focusedContractSummary.lostDays}/{focusedContractSummary.allowanceDays} days</strong>
              </div>
              <div style={S.contractSummaryItem}>
                <span>Adjusted completion</span>
                <strong>{fmtDate(focusedContractSummary.adjustedCompletion)}</strong>
              </div>
              <div style={S.contractSummaryItem}>
                <span>Schedule finish</span>
                <strong>{fmtDate(focusedContractSummary.scheduleCompletion)}</strong>
              </div>
              <div style={S.contractSummaryItem}>
                <span>Daily LD</span>
                <strong>{fmtMoney(focusedContractSummary.dailyLdRate)}</strong>
              </div>
              <div style={S.contractSummaryItem}>
                <span>LD exposure</span>
                <strong>{fmtMoney(focusedContractSummary.liquidatedDamages)}</strong>
              </div>
              <div style={{
                ...S.contractStatus,
                borderColor: focusedContractSummary.excessDays > 0 ? "#fecaca" : "#bbf7d0",
                background: focusedContractSummary.excessDays > 0 ? "#fef2f2" : "#f0fdf4",
                color: focusedContractSummary.excessDays > 0 ? "#991b1b" : "#166534",
              }}>
                {focusedContractSummary.claimStatus}
              </div>
              <div style={{
                ...S.contractStatus,
                borderColor: focusedContractSummary.noticeStatus === "Notice overdue" ? "#fecaca" : "#fed7aa",
                background: focusedContractSummary.noticeStatus === "Notice overdue" ? "#fef2f2" : "#fff7ed",
                color: focusedContractSummary.noticeStatus === "Notice overdue" ? "#991b1b" : "#9a3412",
              }}>
                {focusedContractSummary.noticeStatus}
              </div>
              {focusedContractSummary.scheduleOverrunDays > 0 && (
                <div style={{ ...S.contractStatus, borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b" }}>
                  Schedule is {focusedContractSummary.scheduleOverrunDays} day{focusedContractSummary.scheduleOverrunDays !== 1 ? "s" : ""} outside adjusted contract period
                </div>
              )}
            </div>
          </div>
        )}

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
                      <button
                        style={S.insertTaskBtn}
                        title={`Insert or replace task #${(task.sort_order ?? 0) + 1}`}
                        onClick={(e) => { e.stopPropagation(); openAddTask(p, task); }}
                      >
                        +
                      </button>
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
                  {dayTicks.map((t) => {
                    const selectionStart = delaySelection ? Math.min(delaySelection.start, delaySelection.end) : -1;
                    const selectionEnd = delaySelection ? Math.max(delaySelection.start, delaySelection.end) : -1;
                    const selected = t.offset >= selectionStart && t.offset <= selectionEnd;
                    return (
                      <div
                        key={`d-${t.month}-${t.n}-${t.year}`}
                        title={focusedProject ? dateISO(addDays(rulerStart, t.offset)) : undefined}
                        style={{
                          ...S.dayCell,
                          width: DAY_W, minWidth: DAY_W,
                          background: selected ? "#fbbf24" : t.offset === todayOffset ? "#fef2f2" : t.isWeekend ? "#dcfce7" : undefined,
                          color: selected ? "#78350f" : t.offset === todayOffset ? "#ef4444" : undefined,
                          fontWeight: selected || t.offset === todayOffset ? 700 : 400,
                          cursor: focusedProject ? "crosshair" : "default",
                        }}
                        onMouseDown={(event) => beginDelaySelection(t.offset, event)}
                        onMouseEnter={() => extendDelaySelection(t.offset)}
                        onMouseUp={finishDelaySelection}
                      >
                        {t.n === 1 || t.n % 5 === 0 || t.offset === todayOffset || selected ? t.n : ""}
                      </div>
                    );
                  })}
                </div>

                {/* Contract day band */}
                <div style={S.contractDayBand}>
                  {dayTicks.map((t) => {
                    const contractStart = focusedContractSummary.actualStart ? new Date(focusedContractSummary.actualStart) : null;
                    const contractDay = contractStart ? daysBetween(contractStart, addDays(rulerStart, t.offset)) + 1 : null;
                    const isToday = t.offset === todayOffset;
                    return (
                      <div
                        key={`cd-${t.offset}`}
                        title={contractDay && contractDay > 0 ? `Contract day ${contractDay}` : "Before contract start"}
                        style={{
                          ...S.contractDayCell,
                          width: DAY_W,
                          minWidth: DAY_W,
                          background: isToday ? "#fee2e2" : t.isWeekend ? "#dcfce7" : undefined,
                          color: isToday ? "#b91c1c" : contractDay && contractDay > 0 ? "#334155" : "#94a3b8",
                          fontWeight: isToday ? 900 : 700,
                        }}
                      >
                        {contractDay && contractDay > 0 ? contractDay : ""}
                      </div>
                    );
                  })}
                </div>

                {/* Today line */}
                {todayOffset >= 0 && todayOffset < RULER_DAYS && (
                  <div style={{ ...S.todayLine, left: todayOffset * DAY_W + DAY_W / 2 }}>
                    <div style={S.todayBadge}>Today</div>
                  </div>
                )}

                {focusedProject && focusedContractSummary.actualStart && (() => {
                  const offset = daysBetween(rulerStart, new Date(focusedContractSummary.actualStart));
                  if (offset < 0 || offset >= RULER_DAYS) return null;
                  return (
                    <div style={{ ...S.contractLine, left: offset * DAY_W + DAY_W / 2, background: "#16a34a", boxShadow: "0 0 0 1px rgba(22,163,74,0.25)" }}>
                      <div style={{ ...S.contractBadge, background: "#16a34a" }}>Contract Start</div>
                    </div>
                  );
                })()}

                {focusedProject && focusedContractSummary.contractCompletion && (() => {
                  const offset = daysBetween(rulerStart, new Date(focusedContractSummary.contractCompletion));
                  if (offset < 0 || offset >= RULER_DAYS) return null;
                  return (
                    <div style={{ ...S.contractLine, left: offset * DAY_W + DAY_W / 2, background: "#dc2626", boxShadow: "0 0 0 1px rgba(220,38,38,0.25)" }}>
                      <div style={{ ...S.contractBadge, background: "#dc2626" }}>Contract End</div>
                    </div>
                  );
                })()}

                {focusedProject && focusedContractSummary.adjustedCompletion && focusedContractSummary.excessDays > 0 && (() => {
                  const offset = daysBetween(rulerStart, new Date(focusedContractSummary.adjustedCompletion));
                  if (offset < 0 || offset >= RULER_DAYS) return null;
                  return (
                    <div style={{ ...S.contractLine, left: offset * DAY_W + DAY_W / 2, background: "#c2410c" }}>
                      <div style={{ ...S.contractBadge, background: "#c2410c" }}>Adjusted</div>
                    </div>
                  );
                })()}

                {/* Weekend shading */}
                {dayTicks.filter((t) => t.isWeekend).map((t) => (
                  <div
                    key={`weekend-${t.offset}`}
                    style={{ position:"absolute", left:t.offset*DAY_W, top:90, width:DAY_W, height:9999, background:"#dcfce7", opacity:0.72, pointerEvents:"none", zIndex:0 }}
                  />
                ))}

                {/* Recorded lost-day blocks */}
                {focusedLostDays.map((delay) => {
                  const start = Math.max(0, delay.start);
                  const end = Math.min(RULER_DAYS - 1, delay.end);
                  return (
                    <div
                      key={`delay-${delay.id}`}
                      title={`${delay.reason}: ${delay.day_count} lost day${delay.day_count !== 1 ? "s" : ""}${delay.notes ? ` - ${delay.notes}` : ""}`}
                      style={{
                        position: "absolute",
                        left: start * DAY_W,
                        top: 60,
                        width: (end - start + 1) * DAY_W,
                        height: 9999,
                        backgroundColor: "rgba(239,68,68,0.18)",
                        backgroundImage: "repeating-linear-gradient(135deg, rgba(185,28,28,0.22) 0, rgba(185,28,28,0.22) 5px, transparent 5px, transparent 10px)",
                        borderLeft: "2px solid #dc2626",
                        borderRight: "2px solid #dc2626",
                        pointerEvents: "none",
                        zIndex: 2,
                      }}
                    >
                      <span style={S.delayBlockLabel}>{delay.reason}</span>
                      <button
                        type="button"
                        title="Delete this lost-day claim"
                        style={S.delayDeleteBtn}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteLostDay(delay);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}

                {/* Current lost-day selection */}
                {delaySelection && focusedProject && (
                  <div
                    style={{
                      position: "absolute",
                      left: Math.min(delaySelection.start, delaySelection.end) * DAY_W,
                      top: 60,
                      width: (Math.abs(delaySelection.end - delaySelection.start) + 1) * DAY_W,
                      height: 9999,
                      background: "rgba(245,158,11,0.2)",
                      borderLeft: "2px solid #d97706",
                      borderRight: "2px solid #d97706",
                      pointerEvents: "none",
                      zIndex: 3,
                    }}
                  />
                )}

                {/* Day grid lines */}
                {dayTicks.map((t) => (
                  <div
                    key={`grid-${t.offset}`}
                    style={{ position:"absolute", left:t.offset*DAY_W, top:90, width:1, height:9999, background:t.n === 1 ? "#b8c4d2" : "#dde3eb", pointerEvents:"none", zIndex:1 }}
                  />
                ))}

                {/* Dependency / run-on arrows */}
                {dependencyLinks.links.length > 0 && (
                  <svg
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 90,
                      width: RULER_DAYS * DAY_W,
                      height: dependencyLinks.height,
                      pointerEvents: "none",
                      zIndex: 9,
                      overflow: "visible",
                    }}
                  >
                    <defs>
                      <marker id="gantt-runon-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                        <path d="M0,0 L0,7 L7,3.5 z" fill="#be123c" />
                      </marker>
                    </defs>
                    {dependencyLinks.links.map((link) => (
                      <path
                        key={link.key}
                        d={link.d}
                        stroke="#be123c"
                        strokeWidth="2"
                        fill="none"
                        markerEnd="url(#gantt-runon-arrow)"
                        opacity="0.95"
                      />
                    ))}
                  </svg>
                )}

                {/* Bar rows (mirrors left column exactly) */}
                {rows.map((row) => {
                  if (row.type === "project") {
                    const { p, color, pct, barOffset, duration } = row;
                    const left  = barOffset * DAY_W;
                    const total = Math.max(duration * DAY_W, 50);
                    const fill  = Math.round(total * pct / 100);
                    return (
                      <div key={`R-p-${p.id}`} style={{ ...S.barRow, height: 56 }}>
                        <div id={`track-proj-${p.id}`} style={{ ...S.track, left, width: total, height: 28, borderRadius: 7, background: color }} />
                        {pct > 0 && pct < 100 && <div style={{ position:"absolute", top:"50%", left: left + fill, width: total - fill, height: 28, borderRadius:"0 7px 7px 0", transform:"translateY(-50%)", background:"rgba(255,255,255,0.3)", pointerEvents:"none" }} />}
                        <div id={`fill-proj-${p.id}`} style={{ display:"none" }} />
                        <div style={{ ...S.barPct, left: left + total + 10, color, fontSize: 15 }}>{pct > 0 ? `${pct}%` : ""}</div>
                      </div>
                    );
                  }
                  if (row.type === "phase") {
                    const { p, phase, phaseColor, phasePct, phOffset, phDuration, phaseTaskStarts } = row;
                    const phaseTrackId = `bar-phase-${p.id}-${domSafeId(phase)}`;
                    const left  = phOffset * DAY_W;
                    const total = Math.max(phDuration * DAY_W, 30);
                    const fill  = Math.round(total * phasePct / 100);
                    return (
                      <div key={`R-ph-${p.id}-${phase}`} style={{ ...S.barRow, height: 48 }}>
                        <div
                          id={phaseTrackId}
                          style={{ ...S.track, left, width: total, height: 22, borderRadius: 6, background: phaseColor, overflow: "hidden" }}
                        >
                          {phasePct > 0 && phasePct < 100 && (
                            <div
                              style={{
                                position: "absolute",
                                top: 0,
                                right: 0,
                                width: total - fill,
                                height: "100%",
                                background: "rgba(255,255,255,0.3)",
                                pointerEvents: "none",
                              }}
                            />
                          )}
                          <div
                            data-handle="1"
                            title="Drag to move this whole phase"
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: 16,
                              height: "100%",
                              cursor: "ew-resize",
                              zIndex: 6,
                              borderRadius: "6px 0 0 6px",
                              background: "rgba(0,0,0,0.35)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "rgba(255,255,255,0.9)",
                              fontSize: 10,
                              letterSpacing: "-1px",
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              panRef.current.active = false;
                              barDragRef.current = {
                                side: "left",
                                entityType: "phase",
                                entityId: phase,
                                projectId: p.id,
                                startX: e.clientX,
                                originalOffset: phOffset,
                                originalDuration: phDuration,
                                pct: phasePct,
                                trackId: phaseTrackId,
                                fillId: null,
                                phaseTaskStarts,
                              };
                            }}
                          >
                            ⡣
                          </div>
                        </div>
                        <div style={{ ...S.barPct, left: left + total + 8, color: phaseColor, fontSize: 14, fontWeight:700 }}>{phasePct > 0 ? `${phasePct}%` : ""}</div>
                      </div>
                    );
                  }
                  if (row.type === "task") {
                    const { task, offset, p } = row;
                    const left = (offset + (task.start_day ?? 0)) * DAY_W;
                    const w    = Math.max((task.duration_days || 7) * DAY_W, 12);
                    const phaseColor = PHASE_COLORS[task.phase] || "#3b82f6";
                    const progress = clampProgress(task.progress_percent ?? progressFromStatus(task.status));
                    const leftHandleId = `handle-left-task-${task.id}`;
                    const rightHandleId = `handle-right-task-${task.id}`;
                    const progressHandleId = `handle-progress-task-${task.id}`;
                    if (task.is_milestone) {
                      return (
                        <div key={`R-t-${task.id}`} style={{ ...S.barRow, height: 40 }}>
                          <div
                            id={`bar-task-${task.id}`}
                            title="Drag to move. Double-click to show connected tasks."
                            style={{ position: "absolute", top: "50%", left: left + w / 2 - 9, width: 18, height: 18, transform: "translateY(-50%) rotate(45deg)", borderRadius: 3, background: phaseColor, cursor: "grab" }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              isolateTaskConnections(p, task);
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              barDragRef.current = {
                                side: "move",
                                entityType: "task",
                                entityId: task.id,
                                projectId: p.id,
                                startX: e.clientX,
                                originalOffset: offset + (task.start_day ?? 0),
                                originalLeftPx: left + w / 2 - 9,
                                originalDuration: task.duration_days || 1,
                                originalValue: task.start_day ?? 0,
                                pct: 0,
                                trackId: `bar-task-${task.id}`,
                                fillId: null,
                              };
                            }}
                          />
                        </div>
                      );
                    }
                    return (
                      <div key={`R-t-${task.id}`} style={{ ...S.barRow, height: 40 }}>
                        <div
                          id={`task-group-${task.id}`}
                          title="Drag to move. Double-click to show connected tasks."
                          style={{
                            position: "absolute",
                            top: "50%",
                            left,
                            width: w,
                            height: 24,
                            marginTop: -12,
                            cursor: "grab",
                            zIndex: 6,
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            isolateTaskConnections(p, task);
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            panRef.current.active = false;
                            barDragRef.current = {
                              side: "move",
                              entityType: "task",
                              entityId: task.id,
                              projectId: p.id,
                              startX: e.clientX,
                              originalOffset: offset + (task.start_day ?? 0),
                              originalDuration: task.duration_days || 7,
                              originalValue: task.start_day ?? 0,
                              pct: 0,
                              trackId: `task-group-${task.id}`,
                              fillId: null,
                            };
                          }}
                        >
                          <div
                            id={`bar-task-${task.id}`}
                            style={{
                              position: "absolute", top: "50%", left: 0, width: "100%", height: 18,
                              borderRadius: 5, transform: "translateY(-50%)", overflow: "hidden",
                              border: `1px solid ${phaseColor}`,
                              backgroundColor: `${phaseColor}22`,
                              backgroundImage: `repeating-linear-gradient(135deg, ${phaseColor}33 0, ${phaseColor}33 5px, transparent 5px, transparent 10px)`,
                              pointerEvents: "none",
                            }}
                          >
                            <div
                              id={`progress-task-${task.id}`}
                              style={{ height: "100%", width: `${progress}%`, background: phaseColor, borderRadius: progress >= 100 ? 4 : "4px 0 0 4px" }}
                            />
                          </div>
                          <div
                            title="Drag to update progress"
                            id={progressHandleId}
                            style={{
                              position: "absolute", top: "50%",
                              left: Math.max(0, Math.min(w - 8, (w * progress / 100) - 4)),
                              width: 10, height: 24, marginTop: -12,
                              borderRadius: 6, background: "#0f172a", border: "1px solid #fff",
                              cursor: "ew-resize", zIndex: 7,
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              panRef.current.active = false;
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
                          <div id={leftHandleId} data-handle="1" title="← Drag to move start" style={{ position:"absolute", top:"50%", left:0, width:12, height:24, marginTop:-12, cursor:"ew-resize", zIndex:6, background:"rgba(0,0,0,0.3)", borderRadius:"5px 0 0 5px", display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.9)", fontSize:9 }}
                            onMouseDown={(e)=>{ e.stopPropagation(); panRef.current.active = false; barDragRef.current={ side:"left", entityType:"task", entityId:task.id, projectId:p.id, startX:e.clientX, originalOffset:offset+(task.start_day ?? 0), originalDuration:task.duration_days||7, originalValue:task.start_day ?? 0, pct:0, trackId:`task-group-${task.id}`, fillId:null }; }}>⡣</div>
                          <div id={rightHandleId} data-handle="1" title="→ Drag to resize end" style={{ position:"absolute", top:"50%", right:0, width:12, height:24, marginTop:-12, cursor:"e-resize", zIndex:6, background:"rgba(0,0,0,0.3)", borderRadius:"0 5px 5px 0", display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.9)", fontSize:9 }}
                            onMouseDown={(e)=>{ e.stopPropagation(); panRef.current.active = false; barDragRef.current={ side:"right", entityType:"task", entityId:task.id, projectId:p.id, startX:e.clientX, originalOffset:offset+(task.start_day ?? 0), originalDuration:task.duration_days||7, originalValue:task.duration_days||7, pct:0, trackId:`task-group-${task.id}`, fillId:null }; }}>⡣</div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          </div>
        )}

        {focusedProject && (
          <div style={S.eotPanel}>
            <div style={S.eotMain}>
              <span style={S.eotKicker}>EOT tally</span>
              <span style={S.eotDays}>{focusedEotSummary.totalDays}</span>
              <span style={S.eotLabel}>
                lost day{focusedEotSummary.totalDays !== 1 ? "s" : ""} recorded
              </span>
              <span style={S.eotMeta}>
                {focusedEotSummary.events.length} event{focusedEotSummary.events.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div style={S.eotReasons}>
              {focusedEotSummary.reasons.length ? focusedEotSummary.reasons.map((item) => (
                <span key={item.reason} style={S.eotReasonPill}>
                  {item.reason}: {item.days} day{item.days !== 1 ? "s" : ""}
                </span>
              )) : (
                <span style={S.eotEmpty}>Drag over dates in the chart header to record lost days.</span>
              )}
            </div>
            {focusedEotSummary.events.length > 0 && (
              <div style={S.eotRecent}>
                Last recorded: {fmtDate(focusedEotSummary.events[focusedEotSummary.events.length - 1].start_date)}
                {" - "}
                {fmtDate(focusedEotSummary.events[focusedEotSummary.events.length - 1].end_date)}
                {" · "}
                {focusedEotSummary.events[focusedEotSummary.events.length - 1].reason}
              </div>
            )}
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
            {projectActualStart(focusedProject) && <span style={{ color: "#64748b" }}> · Actual start {fmtDate(projectActualStart(focusedProject))}</span>}
            <span style={{ color: "#64748b" }}> · {projectPct(focusedProject)}% complete</span>
            <button style={S.footerBtn} onClick={() => openAddTask(focusedProject)}>+ Add Task</button>
            <button style={S.footerBtn} onClick={() => promptImportTasks(focusedProject)}>Import CSV</button>
          </div>
        )}
      </div>

      {/* ── Lost days modal ── */}
      {showDelayModal && focusedProject && delaySelection && (
        <div
          style={S.overlay}
          onClick={() => { setShowDelayModal(false); setDelaySelection(null); }}
        >
          <div style={{ ...S.modal, maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={S.modalTitle}>Record Lost Days</h2>
            <p style={{ margin: 0, color: "#64748b", fontSize: 14, lineHeight: 1.5 }}>
              {fmtDate(addDays(rulerStart, Math.min(delaySelection.start, delaySelection.end)))} to{" "}
              {fmtDate(addDays(rulerStart, Math.max(delaySelection.start, delaySelection.end)))} ·{" "}
              {Math.abs(delaySelection.end - delaySelection.start) + 1} day{Math.abs(delaySelection.end - delaySelection.start) !== 0 ? "s" : ""}
            </p>

            <label style={S.fieldLabel}>
              Reason
              <select
                style={S.input}
                value={delayForm.reason}
                onChange={(e) => setDelayForm((form) => ({ ...form, reason: e.target.value }))}
              >
                {DELAY_REASONS.map((reason) => <option key={reason}>{reason}</option>)}
              </select>
            </label>

            <label style={S.fieldLabel}>
              Details
              <textarea
                style={{ ...S.input, minHeight: 84, resize: "vertical" }}
                value={delayForm.notes}
                placeholder="Optional details"
                onChange={(e) => setDelayForm((form) => ({ ...form, notes: e.target.value }))}
              />
            </label>

            <div style={S.modalActions}>
              <button
                style={S.cancelBtn}
                onClick={() => { setShowDelayModal(false); setDelaySelection(null); }}
              >
                Cancel
              </button>
              <button
                style={{ ...S.primaryBtn, opacity: saving ? 0.5 : 1 }}
                disabled={saving}
                onClick={applyLostDays}
              >
                {saving ? "Applying..." : "Add Lost Days"}
              </button>
            </div>
          </div>
        </div>
      )}

      <GanttSchedulePlannerModal
        S={S}
        showPlanner={showPlanner}
        setShowPlanner={setShowPlanner}
        plannerStep={plannerStep}
        setPlannerStep={setPlannerStep}
        plannerAnswers={plannerAnswers}
        plannerPlan={plannerPlan}
        visiblePlannerQuestions={visiblePlannerQuestions}
        updatePlannerAnswer={updatePlannerAnswer}
        generatePlannerPreview={generatePlannerPreview}
        requestCreateGanttFromPlan={requestCreateGanttFromPlan}
      />

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
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    style={S.insertFromEditBtn}
                    onClick={() => {
                      const project = projects.find((p) => p.id === editTask.project_id);
                      if (project) openAddTask(project, editTask);
                    }}
                  >
                    + New Task Here
                  </button>
                  <button style={S.dangerBtn} onClick={deleteTask}>Delete</button>
                </div>
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
              {editTask ? "Task Number / Position" : "Task Number"}
              <input
                style={S.input}
                type="number"
                min="1"
                value={taskForm.sort_order}
                onChange={(e) => setTaskForm((f) => ({ ...f, sort_order: e.target.value }))}
              />
              {editTask && (
                <span style={S.fieldHint}>
                  Changing this number moves this task into that position, pushes following tasks down, and closes the old gap.
                </span>
              )}
            </label>

            {!editTask && (
              <label style={S.fieldLabel}>
                Number Action
                <div style={S.modeToggle}>
                  <button
                    type="button"
                    style={{ ...S.modeBtn, ...(taskForm.position_mode !== "replace" ? S.modeBtnActive : {}) }}
                    onClick={() => setTaskForm((f) => ({ ...f, position_mode: "insert" }))}
                  >
                    New task - move others down
                  </button>
                  <button
                    type="button"
                    style={{ ...S.modeBtn, ...(taskForm.position_mode === "replace" ? S.modeBtnActive : {}) }}
                    onClick={() => setTaskForm((f) => ({ ...f, position_mode: "replace" }))}
                  >
                    Replace task at this number
                  </button>
                </div>
              </label>
            )}

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
                Contract Start
                <input style={S.input} type="date" value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
              <label style={S.fieldLabel}>
                Total Contract Days
                <input style={S.input} type="number" min="0" value={form.contract_days}
                  onChange={(e) => setForm((f) => ({ ...f, contract_days: e.target.value }))} />
              </label>
              <label style={S.fieldLabel}>
                Weather Allowance Days
                <input style={S.input} type="number" min="0" value={form.weather_lost_day_allowance}
                  onChange={(e) => setForm((f) => ({ ...f, weather_lost_day_allowance: e.target.value }))} />
              </label>
              <label style={S.fieldLabel}>
                Misc Allowance Days
                <input style={S.input} type="number" min="0" value={form.misc_lost_day_allowance}
                  onChange={(e) => setForm((f) => ({ ...f, misc_lost_day_allowance: e.target.value }))} />
              </label>
              <label style={S.fieldLabel}>
                Unforeseen Allowance Days
                <input style={S.input} type="number" min="0" value={form.unforeseen_lost_day_allowance}
                  onChange={(e) => setForm((f) => ({ ...f, unforeseen_lost_day_allowance: e.target.value }))} />
              </label>
              <label style={S.fieldLabel}>
                Daily LD
                <input style={S.input} type="number" min="0" step="0.01" value={form.daily_ld_rate}
                  onChange={(e) => setForm((f) => ({ ...f, daily_ld_rate: e.target.value }))} />
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



