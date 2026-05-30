// pages/modules/gantt/[id].js
// Builder-grade construction Gantt chart with dependencies, phases, milestones, and procurement tracking
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../../utils/supabase-client";

// ─── Layout constants ────────────────────────────────────────────────────────
const LEFT_W      = 360;  // left panel width px
const HEADER_H    = 80;   // timeline header height px (32 month band + 48 date row)
const PHASE_H     = 52;   // phase group header row height px
const ROW_H       = 48;   // task row height px
const MS_SIZE     = 15;   // milestone diamond size px
const DAY_W_MAP   = { quarter: 4, month: 7, week: 13 };

// ─── Phase definitions (color palette) ──────────────────────────────────────
const PHASE_DEFS = [
  { key: "Pre-Construction",  order: 1,  color: "#3b82f6" },
  { key: "Procurement",       order: 2,  color: "#f59e0b" },
  { key: "Site Preparation",  order: 3,  color: "#8b5cf6" },
  { key: "Foundations",       order: 4,  color: "#ef4444" },
  { key: "Frame Stage",       order: 5,  color: "#f97316" },
  { key: "Lock-Up Stage",     order: 6,  color: "#06b6d4" },
  { key: "Rough-In Stage",    order: 7,  color: "#84cc16" },
  { key: "Internal Lining",   order: 8,  color: "#ec4899" },
  { key: "Fix-Out Stage",     order: 9,  color: "#14b8a6" },
  { key: "External Works",    order: 10, color: "#6366f1" },
  { key: "Completion",        order: 11, color: "#22c55e" },
];
const PHASE_COLOR = Object.fromEntries(PHASE_DEFS.map((p) => [p.key, p.color]));
const PHASE_ORDER = Object.fromEntries(PHASE_DEFS.map((p) => [p.key, p.order]));

const STATUS_OPTS = [
  { key: "pending",     label: "Pending",     color: "#9ca3af" },
  { key: "in_progress", label: "In Progress", color: "#f59e0b" },
  { key: "complete",    label: "Complete",    color: "#22c55e" },
  { key: "blocked",     label: "Blocked 🚫",  color: "#ef4444" },
  { key: "na",          label: "N/A",         color: "#9ca3af" },
];
const STATUS_COLOR = Object.fromEntries(STATUS_OPTS.map((s) => [s.key, s.color]));

// ─── Full 63-task construction template ─────────────────────────────────────
const DEFAULT_TEMPLATE = [
  // PRE-CONSTRUCTION
  { _tid:"t1",  phase:"Pre-Construction", phase_order:1, name:"Initial Client Consultation",     start_day:0,   duration_days:7,  is_milestone:false, is_long_lead:false, assigned_trade:"Builder / Designer",      dependencies:[] },
  { _tid:"t2",  phase:"Pre-Construction", phase_order:1, name:"Site Investigation",               start_day:7,   duration_days:21, is_milestone:false, is_long_lead:false, assigned_trade:"Surveyor / Engineer",     dependencies:["t1"] },
  { _tid:"t3",  phase:"Pre-Construction", phase_order:1, name:"Concept Design",                   start_day:21,  duration_days:21, is_milestone:false, is_long_lead:false, assigned_trade:"Architect / Designer",    dependencies:["t2"] },
  { _tid:"t4",  phase:"Pre-Construction", phase_order:1, name:"Working Drawings",                 start_day:42,  duration_days:35, is_milestone:false, is_long_lead:false, assigned_trade:"Architect / Engineer",    dependencies:["t3"] },
  { _tid:"t5",  phase:"Pre-Construction", phase_order:1, name:"Approvals & Permits",              start_day:70,  duration_days:56, is_milestone:true,  is_long_lead:false, assigned_trade:"Builder / Council",       dependencies:["t4"] },
  // PROCUREMENT
  { _tid:"t6",  phase:"Procurement", phase_order:2, name:"Final Selections & Variations",        start_day:63,  duration_days:21, is_milestone:false, is_long_lead:false, assigned_trade:"Client / Designer",       dependencies:["t3"] },
  { _tid:"t7",  phase:"Procurement", phase_order:2, name:"🚨 Windows & Doors — Order",           start_day:77,  duration_days:70, is_milestone:false, is_long_lead:true,  assigned_trade:"Window Supplier",         dependencies:["t4"] },
  { _tid:"t8",  phase:"Procurement", phase_order:2, name:"Windows — Delivery to Site",           start_day:147, duration_days:1,  is_milestone:true,  is_long_lead:true,  assigned_trade:"Window Supplier",         dependencies:["t7"] },
  { _tid:"t9",  phase:"Procurement", phase_order:2, name:"Roof Materials — Ordered",             start_day:84,  duration_days:28, is_milestone:false, is_long_lead:false, assigned_trade:"Roofing Supplier",        dependencies:["t4"] },
  { _tid:"t10", phase:"Procurement", phase_order:2, name:"🚨 Frame & Truss — Order",             start_day:77,  duration_days:35, is_milestone:false, is_long_lead:true,  assigned_trade:"Frame Supplier",          dependencies:["t4"] },
  { _tid:"t11", phase:"Procurement", phase_order:2, name:"🚨 Kitchen & Cabinetry — Order",       start_day:84,  duration_days:84, is_milestone:false, is_long_lead:true,  assigned_trade:"Cabinet Maker",           dependencies:["t6"] },
  { _tid:"t12", phase:"Procurement", phase_order:2, name:"Plumbing Fixtures — Order",            start_day:84,  duration_days:42, is_milestone:false, is_long_lead:false, assigned_trade:"Plumber",                 dependencies:["t6"] },
  { _tid:"t13", phase:"Procurement", phase_order:2, name:"Electrical & Lighting — Order",        start_day:84,  duration_days:42, is_milestone:false, is_long_lead:false, assigned_trade:"Electrician",             dependencies:["t6"] },
  { _tid:"t14", phase:"Procurement", phase_order:2, name:"Appliances — Order",                   start_day:112, duration_days:35, is_milestone:false, is_long_lead:false, assigned_trade:"Client / Builder",        dependencies:["t6"] },
  { _tid:"t15", phase:"Procurement", phase_order:2, name:"Flooring — Order",                     start_day:168, duration_days:21, is_milestone:false, is_long_lead:false, assigned_trade:"Flooring Supplier",       dependencies:["t6"] },
  // SITE PREPARATION
  { _tid:"t16", phase:"Site Preparation", phase_order:3, name:"Site Setup",                      start_day:119, duration_days:7,  is_milestone:false, is_long_lead:false, assigned_trade:"Builder",                 dependencies:["t5"] },
  { _tid:"t17", phase:"Site Preparation", phase_order:3, name:"Site Cut & Excavation",           start_day:126, duration_days:10, is_milestone:false, is_long_lead:false, assigned_trade:"Excavator",               dependencies:["t16"] },
  { _tid:"t18", phase:"Site Preparation", phase_order:3, name:"Sewer & Stormwater Prep",         start_day:136, duration_days:7,  is_milestone:false, is_long_lead:false, assigned_trade:"Plumber",                 dependencies:["t17"] },
  // FOUNDATIONS
  { _tid:"t19", phase:"Foundations", phase_order:4, name:"Footings & Slab Prep",                 start_day:143, duration_days:7,  is_milestone:false, is_long_lead:false, assigned_trade:"Concreter",               dependencies:["t18"] },
  { _tid:"t20", phase:"Foundations", phase_order:4, name:"Plumbing Inspection ⭐",               start_day:150, duration_days:1,  is_milestone:true,  is_long_lead:false, assigned_trade:"Inspector",               dependencies:["t19"] },
  { _tid:"t21", phase:"Foundations", phase_order:4, name:"Steel Inspection ⭐",                  start_day:151, duration_days:1,  is_milestone:true,  is_long_lead:false, assigned_trade:"Inspector",               dependencies:["t19"] },
  { _tid:"t22", phase:"Foundations", phase_order:4, name:"Slab Pour",                            start_day:152, duration_days:3,  is_milestone:false, is_long_lead:false, assigned_trade:"Concreter",               dependencies:["t20","t21"] },
  { _tid:"t23", phase:"Foundations", phase_order:4, name:"Slab Cure & Inspection ⭐",            start_day:155, duration_days:7,  is_milestone:true,  is_long_lead:false, assigned_trade:"Inspector",               dependencies:["t22"] },
  // FRAME STAGE
  { _tid:"t24", phase:"Frame Stage", phase_order:5, name:"Frame Delivery to Site ⭐",            start_day:162, duration_days:1,  is_milestone:true,  is_long_lead:true,  assigned_trade:"Frame Supplier",          dependencies:["t10","t23"] },
  { _tid:"t25", phase:"Frame Stage", phase_order:5, name:"Wall Framing",                         start_day:163, duration_days:10, is_milestone:false, is_long_lead:false, assigned_trade:"Framer",                  dependencies:["t24"] },
  { _tid:"t26", phase:"Frame Stage", phase_order:5, name:"Roof Truss Installation",              start_day:173, duration_days:5,  is_milestone:false, is_long_lead:false, assigned_trade:"Framer",                  dependencies:["t25"] },
  { _tid:"t27", phase:"Frame Stage", phase_order:5, name:"Frame Straightening & Bracing",        start_day:178, duration_days:5,  is_milestone:false, is_long_lead:false, assigned_trade:"Framer",                  dependencies:["t26"] },
  { _tid:"t28", phase:"Frame Stage", phase_order:5, name:"Frame Inspection ⭐",                  start_day:183, duration_days:1,  is_milestone:true,  is_long_lead:false, assigned_trade:"Inspector",               dependencies:["t27"] },
  // LOCK-UP STAGE
  { _tid:"t29", phase:"Lock-Up Stage", phase_order:6, name:"Roof Installation",                  start_day:184, duration_days:10, is_milestone:false, is_long_lead:false, assigned_trade:"Roofer",                  dependencies:["t28","t9"] },
  { _tid:"t30", phase:"Lock-Up Stage", phase_order:6, name:"🚨 Window Installation",             start_day:194, duration_days:5,  is_milestone:false, is_long_lead:true,  assigned_trade:"Window Installer",        dependencies:["t29","t8"] },
  { _tid:"t31", phase:"Lock-Up Stage", phase_order:6, name:"External Doors Install",             start_day:199, duration_days:3,  is_milestone:false, is_long_lead:false, assigned_trade:"Carpenter",               dependencies:["t30"] },
  { _tid:"t32", phase:"Lock-Up Stage", phase_order:6, name:"Garage Door Install",                start_day:199, duration_days:2,  is_milestone:false, is_long_lead:false, assigned_trade:"Garage Door Co.",         dependencies:["t30"] },
  { _tid:"t33", phase:"Lock-Up Stage", phase_order:6, name:"External Cladding / Brickwork",      start_day:194, duration_days:21, is_milestone:false, is_long_lead:false, assigned_trade:"Bricklayer / Renderer",   dependencies:["t29"] },
  { _tid:"t34", phase:"Lock-Up Stage", phase_order:6, name:"Lock-Up Inspection ⭐",              start_day:215, duration_days:1,  is_milestone:true,  is_long_lead:false, assigned_trade:"Inspector",               dependencies:["t31","t32","t33"] },
  // ROUGH-IN STAGE
  { _tid:"t35", phase:"Rough-In Stage", phase_order:7, name:"Electrical Rough-In",               start_day:216, duration_days:10, is_milestone:false, is_long_lead:false, assigned_trade:"Electrician",             dependencies:["t34"] },
  { _tid:"t36", phase:"Rough-In Stage", phase_order:7, name:"Plumbing Rough-In",                 start_day:216, duration_days:10, is_milestone:false, is_long_lead:false, assigned_trade:"Plumber",                 dependencies:["t34"] },
  { _tid:"t37", phase:"Rough-In Stage", phase_order:7, name:"HVAC / Air Conditioning Rough-In",  start_day:216, duration_days:7,  is_milestone:false, is_long_lead:false, assigned_trade:"HVAC",                    dependencies:["t34"] },
  { _tid:"t38", phase:"Rough-In Stage", phase_order:7, name:"Insulation Install",                start_day:226, duration_days:5,  is_milestone:false, is_long_lead:false, assigned_trade:"Insulation Co.",          dependencies:["t35","t36","t37"] },
  // INTERNAL LINING
  { _tid:"t39", phase:"Internal Lining", phase_order:8, name:"Plasterboard Installation",        start_day:231, duration_days:14, is_milestone:false, is_long_lead:false, assigned_trade:"Plasterer",               dependencies:["t38"] },
  { _tid:"t40", phase:"Internal Lining", phase_order:8, name:"Waterproofing (Bathrooms)",        start_day:245, duration_days:5,  is_milestone:false, is_long_lead:false, assigned_trade:"Waterproofer",            dependencies:["t39"] },
  { _tid:"t41", phase:"Internal Lining", phase_order:8, name:"Waterproof Inspection ⭐",         start_day:250, duration_days:1,  is_milestone:true,  is_long_lead:false, assigned_trade:"Inspector",               dependencies:["t40"] },
  { _tid:"t42", phase:"Internal Lining", phase_order:8, name:"Internal Plaster Setting",         start_day:251, duration_days:14, is_milestone:false, is_long_lead:false, assigned_trade:"Plasterer",               dependencies:["t41"] },
  // FIX-OUT STAGE
  { _tid:"t43", phase:"Fix-Out Stage", phase_order:9, name:"Internal Doors Install",             start_day:265, duration_days:5,  is_milestone:false, is_long_lead:false, assigned_trade:"Carpenter",               dependencies:["t42"] },
  { _tid:"t44", phase:"Fix-Out Stage", phase_order:9, name:"Skirting & Architraves",             start_day:265, duration_days:7,  is_milestone:false, is_long_lead:false, assigned_trade:"Carpenter",               dependencies:["t42"] },
  { _tid:"t45", phase:"Fix-Out Stage", phase_order:9, name:"🚨 Cabinetry Installation",          start_day:272, duration_days:7,  is_milestone:false, is_long_lead:true,  assigned_trade:"Cabinet Maker",           dependencies:["t11","t44"] },
  { _tid:"t46", phase:"Fix-Out Stage", phase_order:9, name:"🚨 Stone Benchtop Templating",       start_day:279, duration_days:2,  is_milestone:false, is_long_lead:true,  assigned_trade:"Stone Mason",             dependencies:["t45"] },
  { _tid:"t47", phase:"Fix-Out Stage", phase_order:9, name:"🚨 Stone Benchtop Install",          start_day:293, duration_days:2,  is_milestone:false, is_long_lead:true,  assigned_trade:"Stone Mason",             dependencies:["t46"] },
  { _tid:"t48", phase:"Fix-Out Stage", phase_order:9, name:"Tiling",                             start_day:272, duration_days:21, is_milestone:false, is_long_lead:false, assigned_trade:"Tiler",                   dependencies:["t42"] },
  { _tid:"t49", phase:"Fix-Out Stage", phase_order:9, name:"Painting — Undercoat",               start_day:279, duration_days:7,  is_milestone:false, is_long_lead:false, assigned_trade:"Painter",                 dependencies:["t44"] },
  { _tid:"t50", phase:"Fix-Out Stage", phase_order:9, name:"Painting — Final Coats",             start_day:295, duration_days:7,  is_milestone:false, is_long_lead:false, assigned_trade:"Painter",                 dependencies:["t49","t47"] },
  { _tid:"t51", phase:"Fix-Out Stage", phase_order:9, name:"Electrical Fit-Off",                 start_day:302, duration_days:7,  is_milestone:false, is_long_lead:false, assigned_trade:"Electrician",             dependencies:["t50"] },
  { _tid:"t52", phase:"Fix-Out Stage", phase_order:9, name:"Plumbing Fit-Off",                   start_day:302, duration_days:7,  is_milestone:false, is_long_lead:false, assigned_trade:"Plumber",                 dependencies:["t50"] },
  { _tid:"t53", phase:"Fix-Out Stage", phase_order:9, name:"Shower Screens & Mirrors",           start_day:309, duration_days:3,  is_milestone:false, is_long_lead:false, assigned_trade:"Glazier",                 dependencies:["t52","t48"] },
  { _tid:"t54", phase:"Fix-Out Stage", phase_order:9, name:"Flooring Installation",              start_day:302, duration_days:10, is_milestone:false, is_long_lead:false, assigned_trade:"Flooring Co.",            dependencies:["t50","t15"] },
  // EXTERNAL WORKS
  { _tid:"t55", phase:"External Works", phase_order:10, name:"Driveways & Paths",                start_day:295, duration_days:7,  is_milestone:false, is_long_lead:false, assigned_trade:"Concreter",               dependencies:["t34"] },
  { _tid:"t56", phase:"External Works", phase_order:10, name:"Landscaping",                      start_day:302, duration_days:14, is_milestone:false, is_long_lead:false, assigned_trade:"Landscaper",              dependencies:["t55"] },
  { _tid:"t57", phase:"External Works", phase_order:10, name:"Retaining Walls",                  start_day:295, duration_days:10, is_milestone:false, is_long_lead:false, assigned_trade:"Concreter",               dependencies:["t34"] },
  { _tid:"t58", phase:"External Works", phase_order:10, name:"Fencing & Gates",                  start_day:309, duration_days:5,  is_milestone:false, is_long_lead:false, assigned_trade:"Fencing Co.",             dependencies:["t55"] },
  // COMPLETION
  { _tid:"t59", phase:"Completion", phase_order:11, name:"Final Cleaning",                       start_day:316, duration_days:3,  is_milestone:false, is_long_lead:false, assigned_trade:"Cleaner",                 dependencies:["t51","t52","t54"] },
  { _tid:"t60", phase:"Completion", phase_order:11, name:"PCI / Defect Inspection ⭐",           start_day:319, duration_days:1,  is_milestone:true,  is_long_lead:false, assigned_trade:"Builder / Client",        dependencies:["t59"] },
  { _tid:"t61", phase:"Completion", phase_order:11, name:"Defects Rectification",                start_day:320, duration_days:10, is_milestone:false, is_long_lead:false, assigned_trade:"Builder",                 dependencies:["t60"] },
  { _tid:"t62", phase:"Completion", phase_order:11, name:"Final Certifications ⭐",              start_day:330, duration_days:7,  is_milestone:true,  is_long_lead:false, assigned_trade:"Certifier",               dependencies:["t61"] },
  { _tid:"t63", phase:"Completion", phase_order:11, name:"🏆 Handover",                          start_day:337, duration_days:1,  is_milestone:true,  is_long_lead:false, assigned_trade:"Builder",                 dependencies:["t62"] },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}
function getWeekLabel(day) {
  return `W${Math.floor(day / 7) + 1}`;
}
// Returns a Set of all task IDs that are transitively downstream of taskId
function getDownstreamIds(taskId, allTasks) {
  const visited = new Set();
  const queue   = [taskId];
  while (queue.length) {
    const cur = queue.shift();
    for (const t of allTasks) {
      if ((t.dependencies || []).includes(cur) && !visited.has(t.id)) {
        visited.add(t.id);
        queue.push(t.id);
      }
    }
  }
  return visited;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function GanttChart() {
  const router = useRouter();
  const { id }  = router.query;

  const [project, setProject]         = useState(null);
  const [tasks, setTasks]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [zoom, setZoom]               = useState("month");    // quarter | month | week
  const [showDeps, setShowDeps]       = useState(false);
  const [collapsedPhases, setCollapsedPhases] = useState(new Set());
  const [editTask, setEditTask]       = useState(null);       // task being edited
  const [editForm, setEditForm]       = useState({});
  const [saving, setSaving]           = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [addForm, setAddForm]         = useState({ name: "", phase: "Pre-Construction", start_day: 0, duration_days: 7, assigned_trade: "", is_milestone: false, is_long_lead: false, notes: "" });
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [todayLine, setTodayLine]     = useState(null); // day offset from project start
  const [taskDrag, setTaskDrag]     = useState(null); // { taskId, startX, deltaDay, affectedIds }
  const [taskResize, setTaskResize] = useState(null); // { taskId, origDuration, startX, deltaDays }

  const scrollRef     = useRef(null);
  const taskDragRef   = useRef(null);
  const taskResizeRef = useRef(null);
  const latestRef     = useRef({});
  const dayWidthRef   = useRef(DAY_W_MAP["month"] || 7);
  const dayWidth      = DAY_W_MAP[zoom] || 7;

  // Keep refs in sync with latest state (avoids stale closures in window listeners)
  useEffect(() => { latestRef.current = { tasks }; }, [tasks]);
  useEffect(() => { dayWidthRef.current = dayWidth; }, [dayWidth]);

  // ── Task bar: drag body to MOVE (cascades downstream) ────────────────────
  function onTaskBarMouseDown(e, task) {
    if (e.button !== 0) return;
    e.preventDefault();
    const { tasks: currentTasks } = latestRef.current;
    const affectedIds = new Set([task.id, ...getDownstreamIds(task.id, currentTasks || [])]);
    taskDragRef.current = { taskId: task.id, startX: e.clientX, deltaDay: 0, affectedIds };
    setTaskDrag({ ...taskDragRef.current });
  }

  // ── Right-edge handle: drag to RESIZE duration only ───────────────────────
  function onTaskResizeMouseDown(e, task) {
    if (e.button !== 0) return;
    e.preventDefault();
    taskResizeRef.current = { taskId: task.id, origDuration: task.duration_days, startX: e.clientX, deltaDays: 0 };
    setTaskResize({ ...taskResizeRef.current });
  }

  // Global mouse listeners for bar drag + resize
  useEffect(() => {
    function onMove(e) {
      if (taskDragRef.current) {
        const dx       = e.clientX - taskDragRef.current.startX;
        const deltaDay = Math.round(dx / dayWidthRef.current);
        if (deltaDay !== taskDragRef.current.deltaDay) {
          taskDragRef.current = { ...taskDragRef.current, deltaDay };
          setTaskDrag({ ...taskDragRef.current });
        }
      }
      if (taskResizeRef.current) {
        const dx        = e.clientX - taskResizeRef.current.startX;
        const deltaDays = Math.round(dx / dayWidthRef.current);
        if (deltaDays !== taskResizeRef.current.deltaDays) {
          taskResizeRef.current = { ...taskResizeRef.current, deltaDays };
          setTaskResize({ ...taskResizeRef.current });
        }
      }
    }
    function onUp() {
      const dt = taskDragRef.current;
      if (dt) {
        taskDragRef.current = null;
        setTaskDrag(null);
        if (Math.abs(dt.deltaDay) >= 1) applyTaskDrag(dt.taskId, dt.deltaDay, dt.affectedIds);
      }
      const dr = taskResizeRef.current;
      if (dr) {
        taskResizeRef.current = null;
        setTaskResize(null);
        const newDuration = Math.max(1, dr.origDuration + dr.deltaDays);
        if (newDuration !== dr.origDuration) {
          setTasks((prev) => prev.map((t) => t.id === dr.taskId ? { ...t, duration_days: newDuration } : t));
          supabase.from("gantt_tasks").update({ duration_days: newDuration }).eq("id", dr.taskId);
        }
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, []);

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!router.isReady || !id) return;
    load();
  }, [router.isReady, id]);

  async function load() {
    setLoading(true);
    const [{ data: proj, error: pErr }, { data: taskData, error: tErr }] = await Promise.all([
      supabase.from("gantt_projects").select("*").eq("id", id).single(),
      supabase.from("gantt_tasks").select("*").eq("project_id", id).order("phase_order").order("start_day"),
    ]);
    if (pErr || !proj) { alert("Project not found"); router.push("/modules/gantt"); return; }
    setProject(proj);
    setTasks(taskData || []);
    if (proj.start_date) {
      const diff = daysBetween(proj.start_date, new Date());
      if (diff >= 0) setTodayLine(diff);
    }
    setLoading(false);
  }

  // ── Load default template ─────────────────────────────────────────────────
  async function loadTemplate() {
    if (!confirm("This will load all 63 construction tasks into this schedule. Continue?")) return;
    setLoadingTemplate(true);
    try {
      // Two-pass: generate UUIDs then resolve dependencies
      const idMap = {};
      DEFAULT_TEMPLATE.forEach((t) => { idMap[t._tid] = crypto.randomUUID(); });

      const rows = DEFAULT_TEMPLATE.map((t, i) => ({
        id:           idMap[t._tid],
        project_id:   id,
        phase:        t.phase,
        phase_order:  t.phase_order,
        name:         t.name,
        start_day:    t.start_day,
        duration_days: t.duration_days,
        status:       "pending",
        assigned_trade: t.assigned_trade || null,
        is_milestone: t.is_milestone,
        is_long_lead: t.is_long_lead,
        dependencies: t.dependencies.map((d) => idMap[d]).filter(Boolean),
        notes:        null,
        sort_order:   i,
      }));

      const { error } = await supabase.from("gantt_tasks").insert(rows);
      if (error) throw error;
      setTasks(rows);
    } catch (err) {
      alert("Error loading template: " + err.message);
    }
    setLoadingTemplate(false);
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const orderedPhases = useMemo(() => {
    const seen = new Set();
    const phases = [];
    for (const t of tasks) {
      if (!seen.has(t.phase)) {
        seen.add(t.phase);
        phases.push({ key: t.phase, order: PHASE_ORDER[t.phase] ?? 99, color: PHASE_COLOR[t.phase] ?? "#6b7280" });
      }
    }
    return phases.sort((a, b) => a.order - b.order);
  }, [tasks]);

  const tasksByPhase = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      if (!map[t.phase]) map[t.phase] = [];
      map[t.phase].push(t);
    }
    // Sort within each phase by start_day
    for (const ph in map) map[ph].sort((a, b) => a.start_day - b.start_day);
    return map;
  }, [tasks]);

  const maxDay = useMemo(() => {
    if (!tasks.length) return 365;
    return Math.max(...tasks.map((t) => t.start_day + t.duration_days)) + 14;
  }, [tasks]);

  const totalTimelineW = maxDay * dayWidth;

  // Stats
  const stats = useMemo(() => {
    const total    = tasks.length;
    const complete = tasks.filter((t) => t.status === "complete").length;
    const blocked  = tasks.filter((t) => t.status === "blocked").length;
    const longLead = tasks.filter((t) => t.is_long_lead).length;
    const milestones = tasks.filter((t) => t.is_milestone).length;
    const pct = total ? Math.round((complete / total) * 100) : 0;
    return { total, complete, blocked, longLead, milestones, pct };
  }, [tasks]);

  // Y position map for dependency arrows
  const rowYMap = useMemo(() => {
    const map = {};
    let y = 0;
    for (const ph of orderedPhases) {
      y += PHASE_H;
      if (!collapsedPhases.has(ph.key)) {
        for (const task of (tasksByPhase[ph.key] || [])) {
          map[task.id] = y + ROW_H / 2;
          y += ROW_H;
        }
      }
    }
    return { map, totalH: y };
  }, [orderedPhases, tasksByPhase, collapsedPhases]);

  // Week header markers
  const weekMarkers = useMemo(() => {
    const markers = [];
    let day = 0;
    const step = zoom === "week" ? 7 : zoom === "month" ? 14 : 28;
    while (day < maxDay) {
      let label;
      if (project?.start_date) {
        const d = addDays(project.start_date, day);
        label = d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
      } else {
        label = `W${Math.floor(day / 7) + 1}`;
      }
      markers.push({ day, label });
      day += step;
    }
    return markers;
  }, [maxDay, dayWidth, zoom, project]);

  // Month band labels for the top header row
  const monthBands = useMemo(() => {
    if (!project?.start_date) return [];
    const startDate = new Date(project.start_date);
    const bands = [];
    let cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (true) {
      const dStart = Math.max(0, Math.round((cur - startDate) / 86400000));
      if (dStart >= maxDay) break;
      const next  = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const dEnd  = Math.min(maxDay, Math.round((next - startDate) / 86400000));
      if (dEnd > dStart) {
        bands.push({
          x:     dStart * dayWidth,
          width: (dEnd - dStart) * dayWidth,
          label: cur.toLocaleDateString("en-AU", { month: "long", year: "numeric" }),
        });
      }
      cur = next;
    }
    return bands;
  }, [project, maxDay, dayWidth]);

  // ── Task update ────────────────────────────────────────────────────────────
  async function saveEditTask() {
    if (!editTask) return;
    setSaving(true);
    const payload = {
      name:          editForm.name,
      phase:         editForm.phase,
      phase_order:   PHASE_ORDER[editForm.phase] ?? 99,
      start_day:     Number(editForm.start_day),
      duration_days: Math.max(1, Number(editForm.duration_days)),
      status:        editForm.status,
      assigned_trade: editForm.assigned_trade || null,
      is_milestone:  editForm.is_milestone,
      is_long_lead:  editForm.is_long_lead,
      notes:         editForm.notes || null,
    };
    const { error } = await supabase.from("gantt_tasks").update(payload).eq("id", editTask.id);
    if (error) { alert("Error: " + error.message); setSaving(false); return; }
    setTasks((prev) => prev.map((t) => t.id === editTask.id ? { ...t, ...payload } : t));
    setSaving(false);
    setEditTask(null);
  }

  async function deleteEditTask() {
    if (!editTask) return;
    if (!confirm(`Delete "${editTask.name}"?`)) return;
    await supabase.from("gantt_tasks").delete().eq("id", editTask.id);
    setTasks((prev) => prev.filter((t) => t.id !== editTask.id));
    setEditTask(null);
  }

  async function addTask() {
    if (!addForm.name.trim()) return;
    setSaving(true);
    const newTask = {
      project_id:    id,
      phase:         addForm.phase,
      phase_order:   PHASE_ORDER[addForm.phase] ?? 99,
      name:          addForm.name.trim(),
      start_day:     Number(addForm.start_day),
      duration_days: Math.max(1, Number(addForm.duration_days)),
      status:        "pending",
      assigned_trade: addForm.assigned_trade || null,
      is_milestone:  addForm.is_milestone,
      is_long_lead:  addForm.is_long_lead,
      dependencies:  [],
      notes:         null,
      sort_order:    tasks.length,
    };
    const { data, error } = await supabase.from("gantt_tasks").insert(newTask).select().single();
    if (error) { alert("Error: " + error.message); setSaving(false); return; }
    setTasks((prev) => [...prev, data]);
    setSaving(false);
    setShowAddTask(false);
    setAddForm({ name: "", phase: "Pre-Construction", start_day: 0, duration_days: 7, assigned_trade: "", is_milestone: false, is_long_lead: false, notes: "" });
  }

  function openEdit(task) {
    setEditTask(task);
    setEditForm({
      name:          task.name,
      phase:         task.phase,
      start_day:     task.start_day,
      duration_days: task.duration_days,
      status:        task.status,
      assigned_trade: task.assigned_trade || "",
      is_milestone:  task.is_milestone,
      is_long_lead:  task.is_long_lead,
      notes:         task.notes || "",
    });
  }

  function togglePhase(phaseKey) {
    setCollapsedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseKey)) next.delete(phaseKey);
      else next.add(phaseKey);
      return next;
    });
  }

  // Cascade-reschedule: move the dragged task AND all downstream tasks by deltaDay
  async function applyTaskDrag(taskId, deltaDay, affectedIds) {
    const { tasks: currentTasks } = latestRef.current;
    const idsToMove = affectedIds || new Set([taskId, ...getDownstreamIds(taskId, currentTasks || [])]);
    // Optimistic state update
    setTasks((prev) => prev.map((t) =>
      idsToMove.has(t.id) ? { ...t, start_day: Math.max(0, t.start_day + deltaDay) } : t
    ));
    // Persist to DB
    for (const t of (currentTasks || []).filter((t) => idsToMove.has(t.id))) {
      const newStartDay = Math.max(0, t.start_day + deltaDay);
      await supabase.from("gantt_tasks").update({ start_day: newStartDay }).eq("id", t.id);
    }
  }

  // ── Rendering ─────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0c111c", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 18 }}>
      Loading schedule…
    </div>
  );

  if (!project) return null;

  return (
    <>
      <Head><title>{project.name} — Gantt Chart</title></Head>
      <div style={{ minHeight: "100vh", background: "#0c111c", display: "flex", flexDirection: "column", color: "#f1f5f9" }}>

        {/* ── Banner ───────────────────────────────────────────────────────── */}
        <div style={S.banner}>
          <div style={S.bannerLeft}>
            <span style={S.bannerIcon}>📊</span>
            <div>
              <h1 style={S.bannerTitle}>{project.name}</h1>
              <p style={S.bannerDesc}>
                {[project.client_name, project.job_address && `📍 ${project.job_address}`, project.start_date && `▶ ${fmtDate(project.start_date)}`].filter(Boolean).join(' · ') || 'Gantt Chart'}
              </p>
            </div>
          </div>
          <Link href="/modules/gantt">
            <button style={S.backBtn}>← Back</button>
          </Link>
        </div>

        {/* ── Controls bar ─────────────────────────────────────────────────── */}
        <div style={S.controlsBar}>
          {/* Zoom */}
          <div style={S.zoomGroup}>
            {["quarter", "month", "week"].map((z) => (
              <button
                key={z}
                style={{ ...S.zoomBtn, ...(zoom === z ? S.zoomBtnActive : {}) }}
                onClick={() => setZoom(z)}
              >
                {z.charAt(0).toUpperCase() + z.slice(1)}
              </button>
            ))}
          </div>
          <button style={{ ...S.toolBtn, background: showDeps ? "#1d3a5e" : "#1e2d45", color: showDeps ? "#60a5fa" : "#6b7280" }} onClick={() => setShowDeps((v) => !v)}>
            Deps {showDeps ? "On" : "Off"}
          </button>
          <button style={S.toolBtn} onClick={() => setShowAddTask(true)}>+ Task</button>
          {tasks.length === 0 && (
            <button
              style={{ ...S.toolBtn, background: "#0f4c2a", border: "1px solid #16a34a", color: "#4ade80" }}
              onClick={loadTemplate}
              disabled={loadingTemplate}
            >
              {loadingTemplate ? "Loading…" : "⚡ Load Template"}
            </button>
          )}
        </div>

        {/* ── Stats strip ──────────────────────────────────────────────────── */}
        <div style={S.statsStrip}>
          <Stat label="Total Tasks" value={stats.total} color="#60a5fa" />
          <Stat label="Complete" value={`${stats.complete} (${stats.pct}%)`} color="#22c55e" />
          <Stat label="Blocked" value={stats.blocked} color={stats.blocked ? "#ef4444" : "#4b5563"} />
          <Stat label="Long Lead" value={stats.longLead} color="#f59e0b" />
          <Stat label="Milestones" value={stats.milestones} color="#ec4899" />
          {project.start_date && todayLine !== null && (
            <Stat label="Days In" value={todayLine} color="#a78bfa" />
          )}
          <div style={{ flex: 1 }} />
          {/* Phase legend */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {orderedPhases.map((ph) => (
              <span key={ph.key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 16, color: "#9ca3af" }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: ph.color, display: "inline-block" }} />
                {ph.key.replace(" Stage", "").replace("-Construction", "-Con")}
              </span>
            ))}
          </div>
        </div>

        {/* ── Progress bar ─────────────────────────────────────────────────── */}
        {tasks.length > 0 && (
          <div style={{ height: 4, background: "#1e2d45" }}>
            <div style={{ height: "100%", width: `${stats.pct}%`, background: stats.pct === 100 ? "#22c55e" : "#3b82f6", transition: "width .4s" }} />
          </div>
        )}

        {/* ── Empty state ───────────────────────────────────────────────────── */}
        {tasks.length === 0 && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 52 }}>📋</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>No tasks yet</div>
            <div style={{ fontSize: 16, color: "#9ca3af", maxWidth: 480 }}>
              Load the full 63-task construction template to get started, or add tasks manually.
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                style={{ background: "#0f4c2a", border: "1px solid #16a34a", color: "#4ade80", borderRadius: 8, padding: "12px 24px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}
                onClick={loadTemplate} disabled={loadingTemplate}
              >
                {loadingTemplate ? "Loading template…" : "⚡ Load Full Construction Template"}
              </button>
              <button
                style={{ background: "#1e2d45", border: "1px solid #2d4a6e", color: "#9ca3af", borderRadius: 8, padding: "12px 24px", fontSize: 16, cursor: "pointer" }}
                onClick={() => setShowAddTask(true)}
              >
                + Add Task Manually
              </button>
            </div>
          </div>
        )}

        {/* ── Gantt chart ───────────────────────────────────────────────────── */}
        {tasks.length > 0 && (
          <div
            ref={scrollRef}
            style={{ flex: 1, overflow: "auto", position: "relative", cursor: taskDrag ? "grabbing" : taskResize ? "col-resize" : "default", userSelect: "none" }}
          >
            <div style={{ minWidth: LEFT_W + totalTimelineW + 40, position: "relative" }}>

              {/* ── Sticky header row ───────────────────────────────────── */}
              <div style={{ position: "sticky", top: 0, zIndex: 30, display: "flex", background: "#0c111c", borderBottom: "1px solid #1e2d45" }}>
                {/* Left corner */}
                <div style={{ width: LEFT_W, flexShrink: 0, padding: "0 14px", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: HEADER_H, borderRight: "1px solid #1e2d45", background: "#0c111c", paddingBottom: 10 }}>
                  <span style={{ fontSize: 13, color: "#9ca3af", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>TASK</span>
                  <span style={{ fontSize: 11, color: "#4b5563", marginTop: 2 }}>drag bar to reschedule →</span>
                </div>
                {/* Two-row timeline header */}
                <div style={{ flex: 1, position: "relative", height: HEADER_H, overflow: "hidden" }}>
                  {/* Top row: month bands */}
                  {monthBands.map(({ x, width, label }) => (
                    <div key={x} style={{
                      position: "absolute",
                      left: x, top: 0,
                      width: width, height: 32,
                      borderLeft: "1px solid #2d4a6e",
                      display: "flex", alignItems: "center",
                      paddingLeft: 8,
                      background: "#0e1520",
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#60a5fa", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        {label}
                      </span>
                    </div>
                  ))}
                  {/* Fallback: no start date — just a thin top band */}
                  {monthBands.length === 0 && (
                    <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: 32, background: "#0e1520", borderBottom: "1px solid #1e2d45", display: "flex", alignItems: "center", paddingLeft: 8 }}>
                      <span style={{ fontSize: 11, color: "#4b5563" }}>Set a project start date to see real dates</span>
                    </div>
                  )}
                  {/* Bottom row: week/date markers */}
                  {weekMarkers.map(({ day, label }) => (
                    <div key={day} style={{
                      position: "absolute",
                      left: day * dayWidth,
                      top: 32,
                      width: (zoom === "week" ? 7 : zoom === "month" ? 14 : 28) * dayWidth,
                      height: 48,
                      borderLeft: "1px solid #1e2d45",
                      display: "flex",
                      alignItems: "center",
                      paddingLeft: 6,
                    }}>
                      <span style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap" }}>{label}</span>
                    </div>
                  ))}
                  {/* Today line in header */}
                  {todayLine !== null && (
                    <div style={{
                      position: "absolute",
                      left: todayLine * dayWidth,
                      top: 0, bottom: 0, width: 2,
                      background: "#ef4444",
                      zIndex: 5,
                    }} />
                  )}
                </div>
              </div>

              {/* ── Phase rows ──────────────────────────────────────────── */}
              {orderedPhases.map((ph) => {
                const phaseTasks = tasksByPhase[ph.key] || [];
                const isCollapsed = collapsedPhases.has(ph.key);
                const phComplete  = phaseTasks.filter((t) => t.status === "complete").length;
                const phPct       = phaseTasks.length ? Math.round((phComplete / phaseTasks.length) * 100) : 0;
                return (
                  <div key={ph.key}>
                    {/* Phase header row */}
                    <div style={{ display: "flex", height: PHASE_H, position: "sticky", top: HEADER_H, zIndex: 20 }}>
                      {/* Left: phase name */}
                      <div
                        style={{
                          width: LEFT_W, flexShrink: 0, position: "sticky", left: 0, zIndex: 25,
                          background: ph.color + "18", borderLeft: `3px solid ${ph.color}`,
                          borderRight: "1px solid #1e2d45", borderBottom: "1px solid #1e2d45",
                          display: "flex", alignItems: "center", padding: "0 10px", gap: 8,
                          cursor: "pointer",
                        }}
                        onClick={() => togglePhase(ph.key)}
                      >
                        <span style={{ fontSize: 17, color: ph.color, transform: isCollapsed ? "rotate(-90deg)" : "none", transition: "transform .15s", display: "inline-block" }}>▾</span>
                        <span style={{ fontSize: 18, fontWeight: 700, color: ph.color, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ph.key}</span>
                        <span style={{ fontSize: 15, color: "#6b7280", whiteSpace: "nowrap" }}>{phPct}% · {phaseTasks.length}</span>
                      </div>
                      {/* Right: phase band */}
                      <div style={{ flex: 1, background: ph.color + "08", borderBottom: "1px solid #1e2d45", position: "relative" }}>
                        {todayLine !== null && (
                          <div style={{ position: "absolute", left: todayLine * dayWidth, top: 0, bottom: 0, width: 1, background: "#ef444455", zIndex: 2 }} />
                        )}
                      </div>
                    </div>

                    {/* Task rows */}
                    {!isCollapsed && phaseTasks.map((task, taskIdx) => {
                      const color      = ph.color;
                      const statClr    = STATUS_COLOR[task.status] || "#4b5563";
                      const barLeft    = task.start_day * dayWidth;
                      const dragOffset = taskDrag?.affectedIds?.has(task.id) ? taskDrag.deltaDay * dayWidth : 0;
                      const rowBg      = taskIdx % 2 === 1 ? "#0e1520" : "#0c111c";
                      return (
                        <div key={task.id} style={{ display: "flex", height: ROW_H }}>
                          {/* Left: task name — click to edit */}
                          <div
                            style={{
                              width: LEFT_W, flexShrink: 0, position: "sticky", left: 0, zIndex: 10,
                              background: rowBg,
                              borderRight: "1px solid #1e2d45", borderBottom: "1px solid #1a2540",
                              display: "flex", alignItems: "center", padding: "0 10px", gap: 7,
                              cursor: "pointer",
                              borderLeft: "3px solid transparent",
                            }}
                            onClick={() => openEdit(task)}
                          >
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: statClr, flexShrink: 0 }} />
                            {task.is_long_lead && <span style={{ fontSize: 15, color: "#f59e0b", flexShrink: 0 }}>🚨</span>}
                            {task.is_milestone && <span style={{ fontSize: 15, flexShrink: 0 }}>⭐</span>}
                            <span style={{ fontSize: 15, color: "#e2e8f0", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {task.name}
                            </span>
                          </div>

                          {/* Right: timeline bar */}
                          <div style={{ flex: 1, position: "relative", background: rowBg, borderBottom: "1px solid #1a2540" }}>
                            {todayLine !== null && (
                              <div style={{ position: "absolute", left: todayLine * dayWidth, top: 0, bottom: 0, width: 1, background: "#ef444440", zIndex: 2 }} />
                            )}
                            {task.is_milestone ? (
                              <div
                                onClick={() => openEdit(task)}
                                onMouseDown={(e) => onTaskBarMouseDown(e, task)}
                                title={task.name}
                                style={{
                                  position: "absolute",
                                  left: barLeft - MS_SIZE / 2 + dragOffset,
                                  top: ROW_H / 2 - MS_SIZE / 2,
                                  width: MS_SIZE, height: MS_SIZE,
                                  background: color,
                                  transform: "rotate(45deg)",
                                  cursor: "grab", zIndex: 3,
                                  boxShadow: `0 0 6px ${color}80`,
                                }}
                              />
                            ) : (() => {
                              const resizeDelta = taskResize?.taskId === task.id ? taskResize.deltaDays : 0;
                              const displayW    = Math.max((task.duration_days + resizeDelta) * dayWidth, 8);
                              const isActive    = !!dragOffset || taskResize?.taskId === task.id;
                              const barBg =
                                task.status === "complete"    ? "#22c55e" :
                                task.status === "in_progress" ? color :
                                task.status === "blocked"     ? "#ef4444" :
                                task.status === "na"          ? "#1e2d45" :
                                color + "55";
                              return (
                                <div style={{
                                  position: "absolute", left: barLeft + dragOffset, top: 5,
                                  width: displayW, height: ROW_H - 12,
                                  borderRadius: 5, background: barBg,
                                  border: task.is_long_lead ? `1px solid ${color}` : "none",
                                  boxShadow: isActive ? `0 0 18px ${color}bb` : "none",
                                  zIndex: 3, display: "flex", alignItems: "center", overflow: "hidden",
                                }}>
                                  {/* Body — drag to MOVE */}
                                  <div
                                    onClick={() => openEdit(task)}
                                    onMouseDown={(e) => onTaskBarMouseDown(e, task)}
                                    title="Click to edit · Drag to move (shifts all downstream tasks)"
                                    style={{ flex: 1, height: "100%", cursor: "grab", display: "flex", alignItems: "center", paddingLeft: 6, minWidth: 0 }}
                                  >
                                    {displayW > 50 && (
                                      <span style={{ fontSize: 13, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", pointerEvents: "none" }}>
                                        {task.name}
                                      </span>
                                    )}
                                  </div>
                                  {/* Right edge — drag to RESIZE */}
                                  <div
                                    onMouseDown={(e) => onTaskResizeMouseDown(e, task)}
                                    title="Drag to change duration"
                                    style={{
                                      width: 10, height: "100%", flexShrink: 0,
                                      cursor: "col-resize",
                                      borderLeft: `2px solid ${color}88`,
                                      borderRadius: "0 5px 5px 0",
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                    }}
                                  >
                                    <span style={{ fontSize: 8, color: color, pointerEvents: "none" }}>⋮⋮</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* ── Vertical week grid lines (always visible) ──────── */}
              <svg
                style={{
                  position: "absolute",
                  top: HEADER_H,
                  left: LEFT_W,
                  width: totalTimelineW,
                  height: rowYMap.totalH,
                  pointerEvents: "none",
                  zIndex: 2,
                  overflow: "visible",
                }}
              >
                {weekMarkers.map(({ day }) => (
                  <line key={`vg-${day}`}
                    x1={day * dayWidth} y1={0}
                    x2={day * dayWidth} y2={rowYMap.totalH}
                    stroke="#1e2d45" strokeWidth="1"
                  />
                ))}
              </svg>

              {/* ── Dependency SVG overlay ───────────────────────────── */}
              {showDeps && (
                <svg
                  style={{
                    position: "absolute",
                    top: HEADER_H,
                    left: LEFT_W,
                    width: totalTimelineW,
                    height: rowYMap.totalH,
                    pointerEvents: "none",
                    zIndex: 5,
                    overflow: "visible",
                  }}
                >
                  <defs>
                    <marker id="arr" markerWidth="5" markerHeight="5" refX="5" refY="2.5" orient="auto">
                      <path d="M0,0 L0,5 L5,2.5 z" fill="#374151" />
                    </marker>
                  </defs>
                  {tasks.map((task) =>
                    (task.dependencies || []).map((depId) => {
                      const dep = tasks.find((t) => t.id === depId);
                      if (!dep) return null;
                      const y1 = rowYMap.map[dep.id];
                      const y2 = rowYMap.map[task.id];
                      if (y1 === undefined || y2 === undefined) return null;
                      const x1 = (dep.start_day + dep.duration_days) * dayWidth;
                      const x2 = task.start_day * dayWidth;
                      const mx = x1 + Math.max(30, (x2 - x1) * 0.5);
                      return (
                        <path
                          key={`${depId}-${task.id}`}
                          d={`M${x1},${y1} L${mx},${y1} L${mx},${y2} L${x2},${y2}`}
                          stroke="#2d4a6e"
                          strokeWidth={1.5}
                          fill="none"
                          markerEnd="url(#arr)"
                          opacity={0.7}
                        />
                      );
                    })
                  )}
                </svg>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Task Modal ───────────────────────────────────────────────── */}
      {editTask && (
        <div style={S.overlay} onClick={() => setEditTask(null)}>
          <div style={{ ...S.modal, maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={S.modalTitle}>Edit Task</h2>
              <button
                style={{ background: "#1a0a0a", border: "1px solid #7f1d1d", color: "#ef4444", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 16 }}
                onClick={deleteEditTask}
              >
                Delete
              </button>
            </div>

            <ModalField label="Task Name">
              <input style={S.inp} value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </ModalField>

            <div style={{ display: "flex", gap: 12 }}>
              <ModalField label="Phase" style={{ flex: 1 }}>
                <select style={S.inp} value={editForm.phase} onChange={(e) => setEditForm((f) => ({ ...f, phase: e.target.value }))}>
                  {PHASE_DEFS.map((ph) => <option key={ph.key}>{ph.key}</option>)}
                </select>
              </ModalField>
              <ModalField label="Status" style={{ flex: 1 }}>
                <select style={S.inp} value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                  {STATUS_OPTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </ModalField>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <ModalField label="Start Day (from project start)" style={{ flex: 1 }}>
                <input style={S.inp} type="number" min="0" value={editForm.start_day} onChange={(e) => setEditForm((f) => ({ ...f, start_day: e.target.value }))} />
              </ModalField>
              <ModalField label="Duration (days)" style={{ flex: 1 }}>
                <input style={S.inp} type="number" min="1" value={editForm.duration_days} onChange={(e) => setEditForm((f) => ({ ...f, duration_days: e.target.value }))} />
              </ModalField>
            </div>

            <ModalField label="Assigned Trade">
              <input style={S.inp} value={editForm.assigned_trade} onChange={(e) => setEditForm((f) => ({ ...f, assigned_trade: e.target.value }))} placeholder="e.g. Framer, Electrician…" />
            </ModalField>

            <div style={{ display: "flex", gap: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, color: "#9ca3af", cursor: "pointer" }}>
                <input type="checkbox" checked={editForm.is_milestone} onChange={(e) => setEditForm((f) => ({ ...f, is_milestone: e.target.checked }))} />
                Milestone ⭐
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, color: "#f59e0b", cursor: "pointer" }}>
                <input type="checkbox" checked={editForm.is_long_lead} onChange={(e) => setEditForm((f) => ({ ...f, is_long_lead: e.target.checked }))} />
                Long Lead Item 🚨
              </label>
            </div>

            <ModalField label="Notes">
              <textarea style={{ ...S.inp, minHeight: 72, resize: "vertical" }} value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Notes, warnings, contacts…" />
            </ModalField>

            {project?.start_date && (
              <div style={{ fontSize: 16, color: "#9ca3af" }}>
                Start: {fmtDate(addDays(project.start_date, editForm.start_day))} →
                End: {fmtDate(addDays(project.start_date, Number(editForm.start_day) + Number(editForm.duration_days)))}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={S.cancelBtn} onClick={() => setEditTask(null)}>Cancel</button>
              <button style={{ ...S.primaryBtn, opacity: saving ? 0.5 : 1 }} disabled={saving} onClick={saveEditTask}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Task Modal ────────────────────────────────────────────────── */}
      {showAddTask && (
        <div style={S.overlay} onClick={() => setShowAddTask(false)}>
          <div style={{ ...S.modal, maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={S.modalTitle}>Add Task</h2>

            <ModalField label="Task Name *">
              <input style={S.inp} autoFocus value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Pool Excavation" />
            </ModalField>

            <div style={{ display: "flex", gap: 12 }}>
              <ModalField label="Phase" style={{ flex: 1 }}>
                <select style={S.inp} value={addForm.phase} onChange={(e) => setAddForm((f) => ({ ...f, phase: e.target.value }))}>
                  {PHASE_DEFS.map((ph) => <option key={ph.key}>{ph.key}</option>)}
                </select>
              </ModalField>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <ModalField label="Start Day" style={{ flex: 1 }}>
                <input style={S.inp} type="number" min="0" value={addForm.start_day} onChange={(e) => setAddForm((f) => ({ ...f, start_day: e.target.value }))} />
              </ModalField>
              <ModalField label="Duration (days)" style={{ flex: 1 }}>
                <input style={S.inp} type="number" min="1" value={addForm.duration_days} onChange={(e) => setAddForm((f) => ({ ...f, duration_days: e.target.value }))} />
              </ModalField>
            </div>

            <ModalField label="Assigned Trade">
              <input style={S.inp} value={addForm.assigned_trade} onChange={(e) => setAddForm((f) => ({ ...f, assigned_trade: e.target.value }))} placeholder="e.g. Roofer" />
            </ModalField>

            <div style={{ display: "flex", gap: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, color: "#9ca3af", cursor: "pointer" }}>
                <input type="checkbox" checked={addForm.is_milestone} onChange={(e) => setAddForm((f) => ({ ...f, is_milestone: e.target.checked }))} />
                Milestone ⭐
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, color: "#f59e0b", cursor: "pointer" }}>
                <input type="checkbox" checked={addForm.is_long_lead} onChange={(e) => setAddForm((f) => ({ ...f, is_long_lead: e.target.checked }))} />
                Long Lead 🚨
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={S.cancelBtn} onClick={() => setShowAddTask(false)}>Cancel</button>
              <button style={{ ...S.primaryBtn, opacity: (!addForm.name.trim() || saving) ? 0.5 : 1 }} disabled={!addForm.name.trim() || saving} onClick={addTask}>
                {saving ? "Adding…" : "Add Task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Small components ────────────────────────────────────────────────────────
function Stat({ label, value, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 64 }}>
      <span style={{ fontSize: 20, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 13, color: "#6b7280", whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}
function ModalField({ label, children, style }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 16, color: "#9ca3af", fontWeight: 500, ...style }}>
      {label}
      {children}
    </label>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  // Banner
  banner:       { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", padding: "22px 28px", flexShrink: 0 },
  bannerLeft:   { display: "flex", alignItems: "center", gap: 18 },
  bannerIcon:   { fontSize: 48, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.16)", borderRadius: 999, width: 76, height: 76, flexShrink: 0 },
  bannerTitle:  { margin: 0, fontSize: 48, fontWeight: 600, lineHeight: 1.1, color: "#fff" },
  bannerDesc:   { margin: "4px 0 0", fontSize: 18, opacity: 0.92, color: "#fff" },
  backBtn:      { background: "rgba(15,23,42,0.85)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10, padding: "9px 18px", fontSize: 18, cursor: "pointer", whiteSpace: "nowrap" },
  controlsBar:  { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "10px 20px", background: "#0c111c", borderBottom: "1px solid #1e2d45", flexShrink: 0 },
  topBar:       { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", background: "#0c111c", borderBottom: "1px solid #1e2d45", flexWrap: "wrap", gap: 12 },
  backLink:     { color: "#60a5fa", fontSize: 15, textDecoration: "none", whiteSpace: "nowrap" },
  projectTitle: { fontSize: 20, fontWeight: 700, color: "#f1f5f9" },
  projectMeta:  { fontSize: 14, color: "#9ca3af", marginTop: 3 },
  statsStrip:   { display: "flex", alignItems: "center", gap: 28, padding: "12px 22px", background: "#0f1624", borderBottom: "1px solid #1e2d45", overflowX: "auto" },
  zoomGroup:    { display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid #2d3748" },
  zoomBtn:      { background: "#1e2d45", border: "none", color: "#9ca3af", padding: "6px 14px", cursor: "pointer", fontSize: 16 },
  zoomBtnActive:{ background: "#1d4ed8", color: "#fff" },
  toolBtn:      { background: "#1e2d45", border: "1px solid #2d3748", color: "#9ca3af", padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 16 },
  // Modal
  overlay:      { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  modal:        { background: "#111827", border: "1px solid #1e2d45", borderRadius: 16, padding: 26, width: "100%", display: "flex", flexDirection: "column", gap: 14, maxHeight: "90vh", overflowY: "auto" },
  modalTitle:   { fontSize: 18, fontWeight: 600, color: "#f1f5f9", margin: 0 },
  inp:          { background: "#1a2235", border: "1px solid #2d3748", borderRadius: 7, color: "#f1f5f9", fontSize: 16, padding: "8px 11px", outline: "none", width: "100%", boxSizing: "border-box" },
  primaryBtn:   { background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 16, fontWeight: 600, cursor: "pointer" },
  cancelBtn:    { background: "#1e2d45", color: "#9ca3af", border: "1px solid #2d3748", borderRadius: 8, padding: "9px 18px", fontSize: 16, cursor: "pointer" },
};
