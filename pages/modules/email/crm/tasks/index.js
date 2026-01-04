// /pages/modules/email/crm/tasks.js
// CRM Tasks & Reminders – control dashboard + structured tasks

import { useEffect, useState, useMemo } from "react";
import Head from "next/head";
import Link from "next/link";
import { supabase } from "../../../../../utils/supabase-client";
import SubscriberAvatar from "../../../../../components/crm/SubscriberAvatar";
import LeadDetailsModal from "../../../../../components/crm/LeadDetailsModal";

export default function CRMTasks() {
  const [userId, setUserId] = useState(null);

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // subscribers used for linking + avatars
  const [leads, setLeads] = useState([]);

  // pipeline stages for LeadDetailsModal
  const [stages, setStages] = useState([]);

  // Stats for dashboard strip
  const [stats, setStats] = useState({
    subscribersTotal: 0,
    subscribers7d: 0,
    tasksToday: 0,
    tasksOverdue: 0,
    tasksCompleted: 0,
    emailsSent7d: 0,
    opens7d: 0,
    unsubscribes7d: 0,
  });

  // Modal / form state (tasks)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const [form, setForm] = useState({
    title: "",
    notesBody: "",
    type: "Phone call",
    date: "",
    time: "",
    location: "",
    contact_id: "",
  });

  const [filter, setFilter] = useState("all"); // all | today | upcoming | overdue | completed

  // Lead details modal (same as pipelines)
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  // bulk selection for subscriber tasks
  const [selectedTasks, setSelectedTasks] = useState([]);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error("loadUser error:", error);
      return;
    }
    if (!data?.user) return;
    const uid = data.user.id;
    setUserId(uid);
    await Promise.all([
      loadTasks(uid),
      loadStats(uid),
      loadLeads(uid),
      loadStages(uid),
    ]);
  }

  async function loadTasks(uid) {
    setLoading(true);
    const { data, error } = await supabase
      .from("crm_tasks")
      .select("*")
      .eq("user_id", uid)
      .order("due_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("loadTasks error:", error);
      setTasks([]);
    } else {
      setTasks(data || []);
    }
    setSelectedTasks([]); // clear selections whenever list reloads
    setLoading(false);
  }

  async function loadLeads(uid) {
    const { data, error } = await supabase
      .from("leads")
      .select("id, name, email")
      .eq("user_id", uid)
      .order("name", { ascending: true });

    if (error) {
      console.error("loadLeads error:", error);
      setLeads([]);
    } else {
      setLeads(data || []);
    }
  }

  async function loadStages(uid) {
    // same stages used in CRM Pipelines
    const { data, error } = await supabase
      .from("crm_pipelines")
      .select("*")
      .eq("user_id", uid)
      .order("position", { ascending: true });

    if (error) {
      console.error("loadStages error:", error);
      setStages([]);
    } else {
      setStages(data || []);
    }
  }

  async function loadStats(uid) {
    try {
      // subscribers (leads)
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select("id, created_at")
        .eq("user_id", uid);

      let subscribersTotal = 0;
      let subscribers7d = 0;
      if (!leadsError && leadsData) {
        subscribersTotal = leadsData.length;
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        subscribers7d = leadsData.filter((l) => {
          const d = l.created_at ? new Date(l.created_at) : null;
          return d && d >= sevenDaysAgo;
        }).length;
      }

      // tasks stats from current tasks array after it loads
      const computeTaskStats = (taskList) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let tasksToday = 0;
        let tasksOverdue = 0;
        let tasksCompleted = 0;

        taskList.forEach((t) => {
          if (t.completed) tasksCompleted++;
          if (!t.due_date) return;
          const d = new Date(t.due_date);
          d.setHours(0, 0, 0, 0);
          if (!t.completed && d < today) tasksOverdue++;
          if (!t.completed && d.getTime() === today.getTime()) tasksToday++;
        });

        return { tasksToday, tasksOverdue, tasksCompleted };
      };

      const taskStats = computeTaskStats(tasks);

      // email stats – best effort, non-fatal
      let emailsSent7d = 0;
      let opens7d = 0;
      let unsubscribes7d = 0;
      try {
        const sevenDaysAgoIso = new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000
        ).toISOString();

        const { data: events, error: eventsError } = await supabase
          .from("email_events")
          .select("id, event_type, created_at")
          .eq("user_id", uid)
          .gte("created_at", sevenDaysAgoIso);

        if (!eventsError && events) {
          emailsSent7d = events.filter((e) =>
            ["sent", "delivered"].includes(
              String(e.event_type || "").toLowerCase()
            )
          ).length;
          opens7d = events.filter(
            (e) =>
              String(e.event_type || "").toLowerCase() === "open" ||
              String(e.event_type || "").toLowerCase() === "opened"
          ).length;
          unsubscribes7d = events.filter((e) =>
            ["unsubscribe", "unsubscribed"].includes(
              String(e.event_type || "").toLowerCase()
            )
          ).length;
        }
      } catch (err) {
        console.warn("email_events stats error (non-fatal):", err);
      }

      setStats({
        subscribersTotal,
        subscribers7d,
        tasksToday: taskStats.tasksToday,
        tasksOverdue: taskStats.tasksOverdue,
        tasksCompleted: taskStats.tasksCompleted,
        emailsSent7d,
        opens7d,
        unsubscribes7d,
      });
    } catch (err) {
      console.error("loadStats fatal error:", err);
    }
  }

  // recompute task-related stats whenever tasks change
  useEffect(() => {
    if (!userId) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let tasksToday = 0;
    let tasksOverdue = 0;
    let tasksCompleted = 0;

    tasks.forEach((t) => {
      if (t.completed) tasksCompleted++;
      if (!t.due_date) return;
      const d = new Date(t.due_date);
      d.setHours(0, 0, 0, 0);
      if (!t.completed && d < today) tasksOverdue++;
      if (!t.completed && d.getTime() === today.getTime()) tasksToday++;
    });

    setStats((prev) => ({
      ...prev,
      tasksToday,
      tasksOverdue,
      tasksCompleted,
    }));
  }, [tasks, userId]);

  // ---------- helpers for dates + filtering ----------

  function isToday(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const t = new Date();
    d.setHours(0, 0, 0, 0);
    t.setHours(0, 0, 0, 0);
    return d.getTime() === t.getTime();
  }

  function isOverdue(task) {
    if (task.completed || !task.due_date) return false;
    const d = new Date(task.due_date);
    const t = new Date();
    d.setHours(0, 0, 0, 0);
    t.setHours(0, 0, 0, 0);
    return d < t;
  }

  function isUpcoming(task) {
    if (task.completed || !task.due_date) return false;
    const d = new Date(task.due_date);
    const t = new Date();
    d.setHours(0, 0, 0, 0);
    t.setHours(0, 0, 0, 0);
    return d > t;
  }

  const filteredTasks = tasks.filter((t) => {
    switch (filter) {
      case "today":
        return isToday(t.due_date) && !t.completed;
      case "upcoming":
        return isUpcoming(t);
      case "overdue":
        return isOverdue(t);
      case "completed":
        return t.completed;
      default:
        return true;
    }
  });

  // map of leadId -> lead object (for avatars + names)
  const leadsById = useMemo(() => {
    const map = {};
    (leads || []).forEach((l) => {
      if (l?.id) map[l.id] = l;
    });
    return map;
  }, [leads]);

  // ---------- NOTES PARSER / BUILDER ----------
  function parseNotes(raw) {
    if (!raw) {
      return {
        type: "Phone call",
        time: "",
        location: "",
        body: "",
      };
    }

    raw = String(raw);
    if (!raw.startsWith("[")) {
      return {
        type: "Phone call",
        time: "",
        location: "",
        body: raw,
      };
    }

    const closeIdx = raw.indexOf("]");
    if (closeIdx === -1) {
      return {
        type: "Phone call",
        time: "",
        location: "",
        body: raw,
      };
    }

    const meta = raw.slice(1, closeIdx);
    const body = raw.slice(closeIdx + 1).trim();

    const result = {
      type: "Phone call",
      time: "",
      location: "",
      body,
    };

    meta.split("•").forEach((chunk) => {
      const [labelRaw, valueRaw] = chunk.split(":");
      if (!labelRaw || !valueRaw) return;
      const label = labelRaw.trim().toLowerCase();
      const value = valueRaw.trim();
      if (label === "type") result.type = value || result.type;
      if (label === "time") result.time = value || "";
      if (label === "location") result.location = value || "";
    });

    return result;
  }

  function buildNotesFromForm(formState) {
    const metaParts = [];
    if (formState.type) metaParts.push(`Type: ${formState.type}`);
    if (formState.time) metaParts.push(`Time: ${formState.time}`);
    if (formState.type === "Meeting in Person" && formState.location) {
      metaParts.push(`Location: ${formState.location}`);
    }

    const metaString =
      metaParts.length > 0 ? `[${metaParts.join(" • ")}]` : "";

    if (!metaString && !formState.notesBody) return null;
    if (!metaString) return formState.notesBody;

    if (!formState.notesBody) return metaString;
    return `${metaString}\n\n${formState.notesBody}`;
  }

  // ---------- MODAL OPEN/CLOSE (TASKS) ----------

  function openNewTaskModal() {
    const todayIso = new Date().toISOString().slice(0, 10);
    setEditingTask(null);
    setForm({
      title: "",
      notesBody: "",
      type: "Phone call",
      date: todayIso,
      time: "",
      location: "",
      contact_id: "",
    });
    setIsModalOpen(true);
  }

  function openEditTaskModal(task) {
    // still here for future if you want it, but TaskRow no longer calls this
    const parsed = parseNotes(task.notes || "");
    setEditingTask(task);
    setForm({
      title: task.title || "",
      notesBody: parsed.body || "",
      type: parsed.type || "Phone call",
      date: task.due_date || "",
      time: parsed.time || "",
      location: parsed.location || "",
      contact_id: task.contact_id || "",
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingTask(null);
  }

  function handleFormChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // ---------- LEAD MODAL HELPERS ----------

  function openLeadModal(lead) {
    if (!lead) return;
    setSelectedLead(lead);
    setIsLeadModalOpen(true);
  }

  // ---------- SAVE / TOGGLE / DELETE ----------

  async function handleSaveTask() {
    if (!userId) {
      alert("No user loaded.");
      return;
    }
    if (!form.title.trim()) {
      alert("Please enter a task title.");
      return;
    }
    if (!form.contact_id || !leadsById[form.contact_id]) {
      alert(
        "Please select a subscriber to link this task to. If you have none yet, add one in Subscribers first."
      );
      return;
    }

    const notesToSave = buildNotesFromForm(form);

    const payload = {
      user_id: userId,
      contact_id: form.contact_id,
      title: form.title.trim(),
      notes: notesToSave,
      due_date: form.date || null,
      // store structured fields in dedicated columns
      task_type: form.type || null,
      task_time: form.time || null, // "HH:mm" string will cast into time
      location:
        form.type === "Meeting in Person" && form.location
          ? form.location
          : null,
    };

    let error;
    if (editingTask) {
      const { error: updError } = await supabase
        .from("crm_tasks")
        .update(payload)
        .eq("id", editingTask.id);
      error = updError;
    } else {
      const { error: insError } = await supabase
        .from("crm_tasks")
        .insert([payload]);
      error = insError;
    }

    if (error) {
      console.error("saveTask error:", error);
      alert("There was an error saving the task.");
      return;
    }

    closeModal();
    await loadTasks(userId);
  }

  async function toggleCompleted(task) {
    if (!userId) return;
    const { error } = await supabase
      .from("crm_tasks")
      .update({ completed: !task.completed })
      .eq("id", task.id);

    if (error) {
      console.error("toggleCompleted error:", error);
      alert("Error updating task status.");
      return;
    }

    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, completed: !t.completed } : t
      )
    );
  }

  async function deleteTask(task) {
    if (!window.confirm("Delete this task?")) return;
    const { error } = await supabase
      .from("crm_tasks")
      .delete()
      .eq("id", task.id);

    if (error) {
      console.error("deleteTask error:", error);
      alert("Error deleting task.");
      return;
    }

    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    setSelectedTasks((prev) => prev.filter((id) => id !== task.id));
  }

  // toggle selection of a single task
  function toggleSelectTask(taskId) {
    setSelectedTasks((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  }

  // bulk delete selected tasks
  async function deleteSelectedTasks() {
    if (selectedTasks.length === 0) return;
    if (
      !window.confirm(`Delete ${selectedTasks.length} selected task(s)?`)
    )
      return;

    const { error } = await supabase
      .from("crm_tasks")
      .delete()
      .in("id", selectedTasks);

    if (error) {
      console.error("deleteSelectedTasks error:", error);
      alert("Error deleting selected tasks.");
      return;
    }

    setTasks((prev) => prev.filter((t) => !selectedTasks.includes(t.id)));
    setSelectedTasks([]);
  }

  const totalTasks = tasks.length;

  if (loading) {
    return (
      <main style={styles.main}>
        <Head>
          <title>CRM • Tasks & Reminders</title>
        </Head>
        <p style={{ textAlign: "center", color: "#fff", fontSize: 20 }}>
          Loading CRM activity…
        </p>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <Head>
        <title>CRM • Tasks & Reminders</title>
      </Head>

      {/* BANNERS ROW */}
      <div style={styles.bannerWrap}>
        <div style={styles.bannerRow}>
          {/* LEFT – main hub banner with back button */}
          <div
            style={{
              ...styles.banner,
              background:
                "linear-gradient(175deg, #38bdf8 0%, #0ea5e9 50%, #0369a1 100%)",
              border: "1px solid #0ea5e9",
            }}
          >
            <div style={styles.bannerLeft}>
              <div style={styles.iconCircle}>🧭</div>
              <div>
                <h1 style={styles.bannerTitle}>CRM Activity Hub</h1>
                <p style={styles.bannerSubtitle}>
                  Live overview of tasks, contacts, and email engagement.
                </p>
              </div>
            </div>
            <div style={styles.bannerRight}>
              <Link href="/modules/email/crm" style={styles.backBtn}>
                ← Back
              </Link>
            </div>
          </div>

          {/* RIGHT – quick actions banner (New Task + filters) */}
          <div style={styles.sideBanner}>
            <div style={styles.sideBannerHeaderRow}>
              <span style={styles.sideBannerTitle}>Quick Actions</span>
              <button style={styles.newBtn} onClick={openNewTaskModal}>
                ＋ New Task
              </button>
            </div>

            <div style={styles.filterRow}>
              <span style={styles.filterLabel}>View:</span>
              {[
                { key: "all", label: "All" },
                { key: "today", label: "Today" },
                { key: "upcoming", label: "Upcoming" },
                { key: "overdue", label: "Overdue" },
                { key: "completed", label: "Completed" },
              ].map((f) => (
                <button
                  key={f.key}
                  style={
                    filter === f.key
                      ? styles.filterBtnActive
                      : styles.filterBtn
                  }
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.container}>
        {/* TOP METRICS STRIP */}
        <div style={styles.metricsGrid}>
          <MetricCard
            label="Subscribers"
            primary={stats.subscribersTotal}
            secondary={`Joined last 7 days: ${stats.subscribers7d}`}
            color="#22c55e"
          />
          <MetricCard
            label="Tasks Today"
            primary={stats.tasksToday}
            secondary={`Overdue: ${stats.tasksOverdue}`}
            color="#eab308"
          />
          <MetricCard
            label="Completed Tasks"
            primary={stats.tasksCompleted}
            secondary={`Total tasks: ${totalTasks}`}
            color="#38bdf8"
          />
          <MetricCard
            label="Email Activity (7 days)"
            primary={`${stats.emailsSent7d} sent`}
            secondary={`${stats.opens7d} opens • ${stats.unsubscribes7d} unsub`}
            color="#a855f7"
          />
        </div>

        {/* MAIN CARD: TASK LIST */}
        <div style={styles.card}>
          <div style={styles.cardHeaderRow}>
            <div>
              <h2 style={styles.cardTitle}>Tasks & Reminders</h2>
              <p style={styles.cardSubtitle}>
                Create structured tasks (call, text, Zoom, WhatsApp, meeting)
                and they’ll feed into your CRM schedule.
              </p>
            </div>

            {/* DELETE SELECTED BUTTON */}
            <button
              type="button"
              onClick={deleteSelectedTasks}
              disabled={selectedTasks.length === 0}
              style={{
                background:
                  selectedTasks.length === 0
                    ? "rgba(15,23,42,0.85)"
                    : "#ef4444",
                border: "1px solid #ef4444",
                borderRadius: 999,
                padding: "8px 18px",
                fontSize: 18,
                fontWeight: 800,
                color:
                  selectedTasks.length === 0 ? "#9ca3af" : "#fef2f2",
                cursor:
                  selectedTasks.length === 0 ? "not-allowed" : "pointer",
                boxShadow:
                  selectedTasks.length === 0
                    ? "none"
                    : "0 10px 22px rgba(239,68,68,0.45)",
                whiteSpace: "nowrap",
              }}
            >
              🗑 Delete Selected ({selectedTasks.length})
            </button>
          </div>

          {/* TASK LIST */}
          {filteredTasks.length === 0 ? (
            <p style={styles.emptyText}>
              Nothing in this view yet. Create a task to start your follow-up
              schedule.
            </p>
          ) : (
            <div style={styles.list}>
              {filteredTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  lead={leadsById[task.contact_id]}
                  onToggle={() => toggleCompleted(task)}
                  onDelete={() => deleteTask(task)}
                  onOpenLead={openLeadModal}
                  isOverdue={isOverdue(task)}
                  isToday={isToday(task.due_date)}
                  parseNotes={parseNotes}
                  selected={selectedTasks.includes(task.id)}
                  onToggleSelect={() => toggleSelectTask(task.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TASK MODAL (create / manual edit) */}
      {isModalOpen && (
        <div style={styles.modalOverlay} onClick={closeModal}>
          <div
            style={styles.modal}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <h2 style={styles.modalTitle}>
              {editingTask ? "Edit Task" : "New Task"}
            </h2>

            {/* TYPE SELECT */}
            <label style={styles.label}>
              Task type
              <select
                value={form.type}
                onChange={(e) => handleFormChange("type", e.target.value)}
                style={styles.select}
              >
                <option>Phone call</option>
                <option>Text message</option>
                <option>Zoom Call</option>
                <option>WhatsApp</option>
                <option>Meeting in Person</option>
                <option>Other</option>
              </select>
            </label>

            {/* TITLE */}
            <label style={styles.label}>
              Title
              <input
                type="text"
                value={form.title}
                onChange={(e) => handleFormChange("title", e.target.value)}
                style={styles.input}
                placeholder="e.g. Call Bill about finance options"
              />
            </label>

            {/* DATE / TIME + CALENDAR CARD */}
            <div style={styles.dateTimeRow}>
              <div style={styles.calendarCard}>
                <div style={styles.calendarHeader}>When?</div>
                <div style={styles.calendarBody}>
                  <label style={styles.calendarLabel}>
                    Date
                    <input
                      type="date"
                      value={form.date || ""}
                      onChange={(e) =>
                        handleFormChange("date", e.target.value)
                      }
                      style={styles.input}
                    />
                  </label>
                  <label style={styles.calendarLabel}>
                    Time
                    <input
                      type="time"
                      value={form.time || ""}
                      onChange={(e) =>
                        handleFormChange("time", e.target.value)
                      }
                      style={styles.input}
                    />
                  </label>
                  <div style={styles.calendarPreview}>
                    {form.date ? (
                      <>
                        <span style={styles.calendarPreviewTitle}>
                          Selected:
                        </span>
                        <span style={styles.calendarPreviewText}>
                          {new Date(form.date).toLocaleDateString("en-AU", {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                          {form.time ? ` • ${form.time}` : ""}
                        </span>
                      </>
                    ) : (
                      <span style={styles.calendarPreviewText}>
                        Today is highlighted – pick a day then time.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* LOCATION (only for Meeting in Person) */}
              {form.type === "Meeting in Person" && (
                <div style={styles.locationCol}>
                  <label style={styles.label}>
                    Location / Address
                    <input
                      type="text"
                      value={form.location}
                      onChange={(e) =>
                        handleFormChange("location", e.target.value)
                      }
                      style={styles.input}
                      placeholder="e.g. 123 Smith St, Boardroom 2"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* NOTES */}
            <label style={styles.label}>
              Short notes (optional)
              <textarea
                value={form.notesBody}
                onChange={(e) =>
                  handleFormChange("notesBody", e.target.value)
                }
                style={styles.textarea}
                rows={4}
                placeholder="Any extra information, promises, or context."
              />
            </label>

            {/* LINKED SUBSCRIBER (REQUIRED) */}
            <label style={styles.label}>
              Linked subscriber (required)
              <select
                value={form.contact_id || ""}
                onChange={(e) =>
                  handleFormChange("contact_id", e.target.value)
                }
                style={styles.select}
              >
                <option value="">Select a subscriber…</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {(lead.name || "No name").trim()}{" "}
                    {lead.email ? `– ${lead.email}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={closeModal}>
                Cancel
              </button>
              <button style={styles.saveBtn} onClick={handleSaveTask}>
                Save Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEAD DETAILS MODAL – same client card as Pipelines */}
      <LeadDetailsModal
        isOpen={isLeadModalOpen}
        lead={selectedLead}
        stages={stages}
        userId={userId}
        fontScale={1.35}
        onClose={() => {
          setIsLeadModalOpen(false);
          setSelectedLead(null);
        }}
        onNotesUpdated={(leadId, notes) => {
          // optional – keep this page's leads in sync later if needed
        }}
      />
    </main>
  );
}

/* ---------- METRICS CARD ---------- */
function MetricCard({ label, primary, secondary, color }) {
  return (
    <div
      style={{
        ...styles.metricCard,
        borderColor: color,
        boxShadow: `0 0 26px ${color}35`,
      }}
    >
      <div style={styles.metricLabel}>{label}</div>
      <div style={{ ...styles.metricPrimary, color }}>{primary}</div>
      <div style={styles.metricSecondary}>{secondary}</div>
    </div>
  );
}

/* ---------- TASK ROW ---------- */
function TaskRow({
  task,
  lead,
  onToggle,
  onDelete,
  onOpenLead,
  isOverdue,
  isToday,
  parseNotes,
  selected,
  onToggleSelect,
}) {
  const parsed = parseNotes(task.notes || "");
  const dueLabel = task.due_date
    ? new Date(task.due_date).toLocaleDateString("en-AU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "No date";

  let statusLabel = "Scheduled";
  let statusColor = "#38bdf8";

  if (task.completed) {
    statusLabel = "Completed";
    statusColor = "#22c55e";
  } else if (isOverdue) {
    statusLabel = "Overdue";
    statusColor = "#f97316";
  } else if (isToday) {
    statusLabel = "Due today";
    statusColor = "#eab308";
  }

  const handleLeadClick = () => {
    if (lead && onOpenLead) onOpenLead(lead);
  };

  const handleToggleStatusClick = () => {
    if (onToggle) onToggle();
  };

  const handleCheckboxChange = () => {
    if (onToggleSelect) onToggleSelect();
  };

  return (
    <div style={styles.taskRow}>
      <div style={styles.taskLeft}>
        {/* Checkbox for selection only */}
        <div style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={!!selected}
            onChange={handleCheckboxChange}
            style={styles.checkbox}
          />
          <div style={{ width: "100%" }}>
            {/* subscriber icon + name – click opens LeadDetailsModal only */}
            <div style={styles.leadLine} onClick={handleLeadClick}>
              {lead ? (
                <>
                  <SubscriberAvatar lead={lead} size={28} fontSize={16} />
                  <span style={styles.leadName}>
                    {lead.name || "Unnamed subscriber"}
                  </span>
                </>
              ) : (
                <span style={styles.leadName}>Subscriber removed</span>
              )}
            </div>

            <div style={styles.taskTypeLine}>
              <span style={styles.taskTypePill}>{parsed.type}</span>
            </div>
            <div
              style={{
                ...styles.taskTitle,
                textDecoration: task.completed ? "line-through" : "none",
                opacity: task.completed ? 0.7 : 1,
              }}
            >
              {task.title || "Untitled task"}
            </div>
            {parsed.body && <p style={styles.taskNotes}>{parsed.body}</p>}
          </div>
        </div>
      </div>

      <div style={styles.taskRight}>
        <div style={styles.dueBlock}>
          <span style={styles.dueLabel}>Due</span>
          <span style={styles.dueValue}>{dueLabel}</span>
        </div>

        {/* Status pill is now the ONLY control that flips Scheduled <-> Completed */}
        <button
          type="button"
          onClick={handleToggleStatusClick}
          style={{
            ...styles.statusPill,
            background: statusColor,
          }}
        >
          {statusLabel}
        </button>

        <button style={styles.smallBtnDanger} onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}

/* ---------- STYLES (min font-size ~18px) ---------- */

const styles = {
  main: {
    minHeight: "100vh",
    background: "#020617",
    color: "#fff",
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },

  bannerWrap: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    marginTop: 24,
  },
  bannerRow: {
    width: "1320px",
    display: "flex",
    gap: 16,
  },
  banner: {
    flex: 1.4,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "20px 24px",
    borderRadius: 18,
    boxShadow: "0 16px 40px rgba(0,0,0,.7)",
  },
  sideBanner: {
    flex: 1,
    padding: "14px 18px",
    borderRadius: 18,
    background:
      "linear-gradient(175deg, #22c55e 0%, #16a34a 40%, #166534 100%)",
    border: "1px solid #22c55e",
    boxShadow: "0 16px 40px rgba(34,197,94,.45)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: 10,
  },
  sideBannerHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sideBannerTitle: {
    fontSize: 28,
    fontWeight: 600,
  },

  bannerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    fontSize: 38,
    background: "rgba(15,23,42,.9)",
    border: "1px solid rgba(255,255,255,.35)",
  },
  bannerTitle: {
    fontSize: 32,
    fontWeight: 700,
    margin: 0,
  },
  bannerSubtitle: {
    margin: 0,
    fontSize: 20,
    opacity: 0.95,
  },
  bannerRight: {
    display: "flex",
    alignItems: "center",
  },
  backBtn: {
    background: "rgba(15,23,42,.9)",
    border: "1px solid rgba(255,255,255,.4)",
    borderRadius: 10,
    padding: "8px 12px",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 800,
    fontSize: 18,
  },

  container: {
    width: "100%",
    maxWidth: "1320px",
    margin: "36px auto 60px",
    padding: "0 20px",
  },

  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 20,
    marginBottom: 26,
  },
  metricCard: {
    background:
      "radial-gradient(circle at top, #0f172a 0%, #020617 55%, #020617 100%)",
    borderRadius: 18,
    padding: "14px 16px 16px",
    border: "1px solid #1f2937",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  metricLabel: {
    fontSize: 18,
    opacity: 0.85,
  },
  metricPrimary: {
    fontSize: 26,
    fontWeight: 900,
  },
  metricSecondary: {
    fontSize: 18,
    opacity: 0.9,
  },

  card: {
    background:
      "linear-gradient(145deg, #0b1220 0%, #020617 55%, #020617 100%)",
    borderRadius: 20,
    border: "1px solid #38bdf8",
    boxShadow: "0 0 34px rgba(56,189,248,.3)",
    padding: "18px 20px 22px",
  },
  cardHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    gap: 16,
  },
  cardTitle: {
    fontSize: 22,
    margin: 0,
    fontWeight: 800,
  },
  cardSubtitle: {
    fontSize: 18,
    margin: "4px 0 0 0",
    opacity: 0.9,
  },

  newBtn: {
    background: "#f97316",
    border: "none",
    borderRadius: 999,
    padding: "8px 18px",
    fontWeight: 800,
    fontSize: 18,
    color: "#0b1120",
    cursor: "pointer",
  },

  filterRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
  filterLabel: {
    fontSize: 18,
    opacity: 0.9,
    marginRight: 4,
  },
  filterBtn: {
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,.8)",
    background: "rgba(15,23,42,.3)",
    padding: "4px 10px",
    color: "#e5e7eb",
    cursor: "pointer",
    fontSize: 18,
  },
  filterBtnActive: {
    borderRadius: 999,
    border: "1px solid #0f172a",
    background: "#facc15",
    padding: "4px 12px",
    color: "#0b1120",
    cursor: "pointer",
    fontSize: 18,
    fontWeight: 700,
  },

  list: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 14,
  },
  emptyText: {
    fontSize: 18,
    opacity: 0.9,
    marginTop: 6,
  },

  taskRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    padding: "10px 14px",
    borderRadius: 16,
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.9) 60%, rgba(15,23,42,0.8) 100%)",
    border: "1px solid #1f2937",
  },
  taskLeft: {
    flex: 1,
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    width: "100%",
  },
  checkbox: {
    width: 22,
    height: 22,
    marginTop: 4,
  },
  leadLine: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 4,
    cursor: "pointer",
  },
  leadName: {
    display: "inline-block",
    fontSize: 18,
    fontWeight: 600,
  },
  taskTypeLine: {
    marginBottom: 4,
  },
  taskTypePill: {
    display: "inline-block",
    fontSize: 16,
    padding: "2px 10px",
    borderRadius: 999,
    background: "rgba(56,189,248,.16)",
    border: "1px solid rgba(56,189,248,.6)",
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  taskNotes: {
    marginTop: 4,
    fontSize: 18,
    opacity: 0.9,
    whiteSpace: "pre-wrap",
  },
  taskRight: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  dueBlock: {
    textAlign: "right",
  },
  dueLabel: {
    fontSize: 16,
    opacity: 0.8,
  },
  dueValue: {
    fontSize: 18,
    fontWeight: 600,
  },
  statusPill: {
    fontSize: 18,
    fontWeight: 700,
    borderRadius: 999,
    padding: "4px 10px",
    color: "#020617",
    border: "none",
    cursor: "pointer",
  },
  smallBtnDanger: {
    fontSize: 18,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid #ef4444",
    background: "transparent",
    color: "#fecaca",
    cursor: "pointer",
  },

  // Modal
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.78)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: "#020617",
    borderRadius: 18,
    padding: "20px 22px 18px",
    width: 620,
    maxWidth: "96vw",
    border: "1px solid #38bdf8",
    boxShadow: "0 0 38px rgba(56,189,248,.45)",
  },
  modalTitle: {
    fontSize: 22,
    marginTop: 0,
    marginBottom: 12,
  },
  label: {
    display: "block",
    fontSize: 18,
    marginTop: 6,
    marginBottom: 4,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #1f2937",
    background: "#020617",
    color: "#fff",
    fontSize: 18,
    marginTop: 4,
  },
  select: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #1f2937",
    background: "#020617",
    color: "#fff",
    fontSize: 18,
    marginTop: 4,
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #1f2937",
    background: "#020617",
    color: "#fff",
    fontSize: 18,
    marginTop: 4,
    resize: "vertical",
  },
  dateTimeRow: {
    display: "flex",
    gap: 16,
    marginTop: 8,
    alignItems: "stretch",
  },
  calendarCard: {
    flex: 1.3,
    background:
      "radial-gradient(circle at top, #0f172a 0%, #020617 55%, #020617 100%)",
    borderRadius: 14,
    border: "1px solid #1f2937",
    boxShadow: "0 0 26px rgba(56,189,248,.25)",
    padding: 12,
  },
  calendarHeader: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  calendarBody: {},
  calendarLabel: {
    fontSize: 18,
    display: "block",
    marginTop: 4,
    marginBottom: 4,
  },
  calendarPreview: {
    marginTop: 8,
    padding: "6px 10px",
    borderRadius: 10,
    background: "rgba(15,23,42,.9)",
    border: "1px dashed rgba(148,163,184,.7)",
  },
  calendarPreviewTitle: {
    fontSize: 18,
    fontWeight: 700,
    marginRight: 4,
  },
  calendarPreviewText: {
    fontSize: 18,
    opacity: 0.95,
  },
  locationCol: {
    flex: 1,
  },
  modalActions: {
    marginTop: 18,
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  },
  cancelBtn: {
    background: "rgba(148,163,184,.35)",
    borderRadius: 999,
    border: "none",
    padding: "8px 16px",
    fontSize: 18,
    color: "#e5e7eb",
    cursor: "pointer",
  },
  saveBtn: {
    background: "#22c55e",
    borderRadius: 999,
    border: "none",
    padding: "8px 20px",
    fontSize: 18,
    fontWeight: 800,
    color: "#020617",
    cursor: "pointer",
  },
};
