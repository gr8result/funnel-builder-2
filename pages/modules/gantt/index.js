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

const PROJECT_PALETTE = [
  "#8b5cf6", "#3b82f6", "#f97316", "#22c55e",
  "#ef4444", "#06b6d4", "#f59e0b", "#ec4899",
];

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
  return { complete: "#22c55e", in_progress: "#f59e0b", blocked: "#ef4444" }[s] || "#cbd5e1";
}

export default function GanttDashboard() {
  const router = useRouter();
  const scrollRef  = useRef(null);
  const panRef     = useRef({ active: false, startX: 0, scrollStart: 0 });
  const barDragRef = useRef(null);
  const [grabbing, setGrabbing] = useState(false);

  const [user, setUser]           = useState(null);
  const [projects, setProjects]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showNew, setShowNew]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [focusId, setFocusId]     = useState(null);
  const [expanded, setExpanded]   = useState({});
  const [search, setSearch]       = useState("");
  const [form, setForm] = useState({
    name: "", client_name: "", job_address: "", job_type: "New Build", start_date: "",
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUser(user); });
  }, []);

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("gantt_projects")
      .select("*, gantt_tasks(id, name, phase, phase_order, start_day, duration_days, status, is_milestone)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error) setProjects(data || []);
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
      router.push(`/modules/gantt/${data.id}`);
    } catch (err) {
      alert("Error: " + err.message);
      setSaving(false);
    }
  }

  async function deleteProject(id, name) {
    if (!confirm(`Delete "${name}" and all its Gantt tasks? This cannot be undone.`)) return;
    await supabase.from("gantt_projects").delete().eq("id", id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (focusId === id) setFocusId(null);
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
  const RULER_DAYS = 90;

  const rulerStart = useMemo(() => {
    const starts = projects.filter((p) => p.start_date).map((p) => new Date(p.start_date));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const base = starts.length ? new Date(Math.min(...starts)) : today;
    base.setDate(base.getDate() - 5);
    return base;
  }, [projects]);

  const todayOffset = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return daysBetween(rulerStart, today);
  }, [rulerStart]);

  const dayTicks = useMemo(() =>
    Array.from({ length: RULER_DAYS }, (_, i) => {
      const d = addDays(rulerStart, i);
      return { n: d.getDate(), month: d.getMonth(), year: d.getFullYear(), offset: i };
    }),
  [rulerStart]);

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
        const ao = tasks.find((t) => t.phase === a)?.phase_order ?? 99;
        const bo = tasks.find((t) => t.phase === b)?.phase_order ?? 99;
        return ao - bo;
      });
      out.push({ type: "project", p, pIdx, color, pct, offset, duration });
      if (focusId === p.id) {
        phases.forEach((phase) => {
          const phaseTasks = tasks.filter((t) => t.phase === phase);
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
      const bd = barDragRef.current;
      if (!bd) return;
      barDragRef.current = null;
      const deltaDays = Math.round((e.clientX - bd.startX) / DAY_W);
      if (deltaDays === 0) return;
      try {
        if (bd.entityType === "project" && bd.side === "left" && bd.projectRef?.start_date) {
          const newDate = addDays(new Date(bd.projectRef.start_date), deltaDays);
          const iso = newDate.toISOString().split("T")[0];
          await supabase.from("gantt_projects").update({ start_date: iso }).eq("id", bd.entityId);
          setProjects((prev) => prev.map((pp) => pp.id === bd.entityId ? { ...pp, start_date: iso } : pp));
        } else if (bd.entityType === "task" && bd.side === "left") {
          const newVal = Math.max(0, bd.originalValue + deltaDays);
          await supabase.from("gantt_tasks").update({ start_day: newVal }).eq("id", bd.entityId);
          setProjects((prev) => prev.map((pp) => ({
            ...pp, gantt_tasks: (pp.gantt_tasks || []).map((t) =>
              t.id === bd.entityId ? { ...t, start_day: newVal } : t),
          })));
        } else if (bd.entityType === "task" && bd.side === "right") {
          const newVal = Math.max(1, bd.originalValue + deltaDays);
          await supabase.from("gantt_tasks").update({ duration_days: newVal }).eq("id", bd.entityId);
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

        {/* ── Top bar ── */}
        <div style={S.topBar}>
          <div style={S.topBarLeft}>
            <Link href="/modules/construction" style={S.backLink}>← Construction</Link>
            <div>
              <h1 style={S.pageTitle}>Gantt Charts</h1>
              <p style={S.pageSub}>Plan. Track. Deliver.</p>
            </div>
          </div>
          <div style={S.topBarRight}>
            {focusId ? (
              <button style={S.outlineBtn} onClick={() => setFocusId(null)}>← All Projects</button>
            ) : (
              <input
                style={S.searchInput}
                placeholder="Filter projects…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            )}
            <button style={S.todayBtn} onClick={scrollToToday}>Today</button>
            <button style={S.primaryBtn} onClick={() => setShowNew(true)}>+ New Project</button>
          </div>
        </div>

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
                <span>Task Name</span>
                <div style={{ display: "flex", gap: 4 }}>
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
                    </div>
                  );
                }
                if (row.type === "task") {
                  const { task } = row;
                  return (
                    <div key={`L-t-${task.id}`} style={{ ...S.taskRow, position: "relative" }}>
                      <div style={{ position:"absolute", left:26, top:0, height:"50%", width:2, background:"#94a3b8", pointerEvents:"none" }} />
                      <div style={{ position:"absolute", left:26, top:"50%", width:16, height:2, background:"#94a3b8", pointerEvents:"none" }} />
                      <span style={{ ...S.taskDot, background: statusColor(task.status) }} />
                      <span style={S.taskName}>{task.is_milestone ? "⭐ " : ""}{task.name}</span>
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
                        background: t.offset === todayOffset ? "#fef2f2" : undefined,
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

                {/* Week grid lines */}
                {Array.from({ length: Math.floor(RULER_DAYS / 7) }, (_, i) => (
                  <div key={`grid-${i}`} style={{ position:"absolute", left:(i+1)*7*DAY_W, top:64, width:1, height:9999, background:"#dde3eb", pointerEvents:"none", zIndex:0 }} />
                ))}

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
                    const { task, offset } = row;
                    const left = (offset + (task.start_day || 0)) * DAY_W;
                    const w    = Math.max((task.duration_days || 7) * DAY_W, 12);
                    const sc   = statusColor(task.status);
                    if (task.is_milestone) {
                      return (
                        <div key={`R-t-${task.id}`} style={{ ...S.barRow, height: 40 }}>
                          <div style={{ position: "absolute", top: "50%", left: left + w / 2 - 9, width: 18, height: 18, transform: "translateY(-50%) rotate(45deg)", borderRadius: 3, background: sc }} />
                        </div>
                      );
                    }
                    return (
                      <div key={`R-t-${task.id}`} style={{ ...S.barRow, height: 40 }}>
                        <div id={`bar-task-${task.id}`} style={{ position: "absolute", top: "50%", left, width: w, height: 16, borderRadius: 5, transform: "translateY(-50%)", background: sc }} />
                        <div data-handle="1" title="← Drag to move" style={{ position:"absolute", top:"50%", left, width:12, height:24, marginTop:-12, cursor:"ew-resize", zIndex:6, background:"rgba(0,0,0,0.3)", borderRadius:"5px 0 0 5px", display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.9)", fontSize:9 }}
                          onMouseDown={(e)=>{ e.stopPropagation(); barDragRef.current={ side:"left", entityType:"task", entityId:task.id, startX:e.clientX, originalOffset:offset+(task.start_day||0), originalDuration:task.duration_days||7, originalValue:task.start_day||0, pct:0, trackId:`bar-task-${task.id}`, fillId:null }; }}>⡣</div>
                        <div data-handle="1" title="→ Drag to resize" style={{ position:"absolute", top:"50%", left:left+w-12, width:12, height:24, marginTop:-12, cursor:"e-resize", zIndex:6, background:"rgba(0,0,0,0.3)", borderRadius:"0 5px 5px 0", display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.9)", fontSize:9 }}
                          onMouseDown={(e)=>{ e.stopPropagation(); barDragRef.current={ side:"right", entityType:"task", entityId:task.id, startX:e.clientX, originalOffset:offset+(task.start_day||0), originalDuration:task.duration_days||7, originalValue:task.duration_days||7, pct:0, trackId:`bar-task-${task.id}`, fillId:null }; }}>⡣</div>
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
          </div>
        )}
      </div>

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
                Project Start Date
                <input style={S.input} type="date" value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
              </label>
            </div>
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
    fontSize: 16,
  },
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
    background: "white", border: "1px solid #cbd5e1", borderRadius: 8,
    padding: "9px 18px", fontSize: 16, fontWeight: 600, cursor: "pointer", color: "#334155",
  },
  todayBtn: {
    background: "white", border: "1px solid #cbd5e1", borderRadius: 8,
    padding: "9px 18px", fontSize: 16, fontWeight: 600, cursor: "pointer", color: "#0f172a",
  },
  primaryBtn: {
    background: "#7c3aed", color: "white", border: "none", borderRadius: 8,
    padding: "10px 22px", fontSize: 16, fontWeight: 700, cursor: "pointer",
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
  leftCol: { width: 310, minWidth: 310, flexShrink: 0, borderRight: "2px solid #e2e8f0", overflow: "hidden" },
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
    cursor: "pointer", borderBottom: "1px solid #e2e8f0",
    transition: "background 0.12s", userSelect: "none",
  },
  chevron:  { fontSize: 12, width: 16, flexShrink: 0, textAlign: "center" },
  dot:      { width: 12, height: 12, borderRadius: "50%", flexShrink: 0 },
  pName:    { fontSize: 17, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  pSub:     { fontSize: 14, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  pctLabel: { fontSize: 15, fontWeight: 700, flexShrink: 0 },
  delBtn:   { background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 14, padding: "2px 6px", flexShrink: 0, lineHeight: 1 },
  phaseRow: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "0 10px 0 32px", height: 48,
    cursor: "pointer", borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc", userSelect: "none",
  },
  phChevron: { fontSize: 12, color: "#475569", width: 14, flexShrink: 0 },
  phName:    { flex: 1, fontSize: 16, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  taskRow: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "0 10px 0 48px", height: 40,
    borderBottom: "1px solid #e8edf2", background: "#f8fafc",
  },
  taskDot:  { width: 9, height: 9, borderRadius: "50%", flexShrink: 0 },
  taskName: { flex: 1, fontSize: 15, color: "#1e293b", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
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
  barRow: { borderBottom: "1px solid #e8edf2", position: "relative", display: "flex", alignItems: "center" },
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
  miniBtn:    { background: "#e2e8f0", border: "1px solid #cbd5e1", borderRadius: 6, padding: "5px 12px", fontSize: 14, fontWeight: 600, cursor: "pointer", color: "#1e293b", whiteSpace: "nowrap" },
  legendRow:  { display: "flex", flexWrap: "wrap", gap: "8px 22px", padding: "14px 28px 18px", background: "white", borderTop: "2px solid #e2e8f0", margin: "0 0 80px" },
  legendItem: { display: "flex", alignItems: "center", gap: 8 },
  legendLabel: { fontSize: 14, color: "#334155", fontWeight: 600, whiteSpace: "nowrap" },
};
