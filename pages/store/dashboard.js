// /pages/store/dashboard.js
// TASKS + PLATFORM DASHBOARD -imports tasks from tasks + crm_tasks
// with subscriber/lead avatars, coloured module cards matching the side nav.

import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { createClient } from "@supabase/supabase-js";
import { BarChart3, LineChart } from "lucide-react";
import ICONS from "../../components/iconMap";
import SubscriberAvatar from "../../components/crm/SubscriberAvatar";
import LeadDetailsModal from "../../components/crm/LeadDetailsModal";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Same Communities icon as SideNav
const CommunitiesIcon = ({ size = 22, color = "#000" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="7" cy="7" r="3.2" />
    <circle cx="17" cy="7" r="3.2" />
    <circle cx="12" cy="17" r="3.2" />
    <line x1="9" y1="8.6" x2="10.6" y2="14.4" />
    <line x1="15" y1="8.6" x2="13.4" y2="14.4" />
  </svg>
);



// Card colour + icon map (matches SideNav colours)
const MODULE_META = {
  "email-marketing": {
    color: "#ffd11bdc", // u10
    Icon: ICONS.email,
  },
  // separate cards for vendors and affiliate revenue
  "affiliate-vendors": {
    // match Vendor Performance Reports (orange/graph)
    color: "#f97316",
    Icon: LineChart,
  },
  "affiliate-revenue": {
    // match Affiliate Analytics banner (pink/bar chart)
    color: "#ec4899",
    Icon: BarChart3,
  },
  // physical + digital split
  "physical-products": {
    color: "#0ea5e9", // u13
    Icon: ICONS.products,
  },
  "digital-products": {
    color: "#4f46e5", // purple-ish, matches digital/tech feel
    Icon: ICONS.products,
  },
  // keep old products meta around in case LS still has it
  products: {
    color: "#0ea5e9",
    Icon: ICONS.products,
  },
  leads: {
    color: "#f43f5e", // u04
    Icon: ICONS.leads,
  },
  subscriptions: {
    color: "#ec4899", // u12
    Icon: ICONS.courses,
  },
  webinars: {
    color: "#ef4444", // u14
    Icon: ICONS.webinars,
  },
  social: {
    color: "#06b6d4", // u18
    Icon: ICONS.social,
  },
  subaccounts: {
    color: "#10b981", // u19
    Icon: ICONS.subaccounts,
  },
  community: {
    color: "#14b8a6", // u17
    Icon: CommunitiesIcon,
  },
};

// ─── 11 MODULE USAGE BARS — SideNav order, exact nav border colours ──────────
// Each entry maps a nav module to its plan resource key + hex colour from SideNav.
// resourceKey: null = module exists but usage is not yet tracked (shown as "—")
const MODULE_USAGE_BARS = [
  { key: "teams",      label: "Teams",      emoji: "👥", color: "#f97316", resourceKey: "team_members",    href: "/modules/email/crm/teams",              monthly: false },
  { key: "ai_credits", label: "AI Credits", emoji: "🤖", color: "#a78bfa", resourceKey: "ai_credits_monthly", href: "/modules/ai",                        monthly: true  },
  { key: "email",      label: "Email",      emoji: "📧", color: "#facc15", resourceKey: "email_monthly",   href: "/modules/email/reports",               monthly: true  },
  { key: "crm",        label: "CRM",        emoji: "🗂", color: "#ec4899", resourceKey: "leads",           href: "/modules/email/crm",                   monthly: false },
  { key: "jobboard",   label: "Job Board",  emoji: "📋", color: "#fb923c", resourceKey: null,              href: "/modules/jobboard",                    monthly: false },
  { key: "gantt",      label: "Gantt",      emoji: "📊", color: "#38bdf8", resourceKey: null,              href: "/modules/gantt",                       monthly: false },
  { key: "sms",        label: "SMS",        emoji: "💬", color: "#06b6d4", resourceKey: "sms_monthly",     href: "/modules/email/crm/sms-dashboard",      monthly: true  },
  { key: "social",     label: "Social",     emoji: "📱", color: "#8126e9", resourceKey: "social_profiles", href: "/modules/social_media/dashboard",       monthly: false },
  { key: "community",  label: "Community",  emoji: "🏘", color: "#14b8a6", resourceKey: "communities",     href: "/modules/communities",                  monthly: false },
  { key: "calendar",   label: "Calendar",   emoji: "📅", color: "#84cc16", resourceKey: null,              href: "/modules/calendar/dashboard",           monthly: false },
  { key: "websites",   label: "Websites",   emoji: "🌐", color: "#2d94c3", resourceKey: "websites",        href: "/modules/website-builder",              monthly: false },
  { key: "funnels",    label: "Funnels",    emoji: "🧱", color: "#ef465d", resourceKey: "funnels",         href: "/funnels",                              monthly: false },
  { key: "automation", label: "Automation", emoji: "⚙",  color: "#fb923c", resourceKey: "automations",     href: "/modules/business-automation",          monthly: false },
  { key: "webinars",   label: "Webinars",   emoji: "🎥", color: "#ef4444", resourceKey: null,              href: "/modules/webinars",                     monthly: false },
  { key: "pipelines",  label: "Pipelines",  emoji: "🌿", color: "#7c3aed", resourceKey: "pipelines",       href: "/modules/pipelines",                    monthly: false },
  { key: "hr",         label: "HR",         emoji: "👨‍💼", color: "#3b82f6", resourceKey: null,              href: "/modules/hr",                          monthly: false },
];

// Set to true to preview bar colours/fills — flip to false for live data
const USE_DUMMY_DATA = false;

// Dummy usage data — used when USE_DUMMY_DATA = true
const DUMMY_RESOURCES = {
  team_members:       { key: "team_members",       used: 3,    limit: 5,     atLimit: false, untracked: false, label: "Teams"      },
  ai_credits_monthly: { key: "ai_credits_monthly", used: 8700, limit: 10000, atLimit: false, untracked: false, label: "AI Credits" },
  email_monthly:      { key: "email_monthly",      used: 4200, limit: 5000,  atLimit: false, untracked: false, label: "Email"      },
  leads:              { key: "leads",              used: 238,  limit: null,  atLimit: false, untracked: false, label: "CRM"        },
  sms_monthly:        { key: "sms_monthly",        used: 450,  limit: 1000,  atLimit: false, untracked: false, label: "SMS"        },
  social_profiles:    { key: "social_profiles",    used: 2,    limit: 10,    atLimit: false, untracked: false, label: "Social"     },
  communities:        { key: "communities",        used: 1,    limit: 1,     atLimit: true,  untracked: false, label: "Community"  },
  websites:           { key: "websites",           used: 1,    limit: 3,     atLimit: false, untracked: false, label: "Websites"   },
  funnels:            { key: "funnels",            used: 12,   limit: 20,    atLimit: false, untracked: false, label: "Funnels"    },
  automations:        { key: "automations",        used: 8,    limit: 10,    atLimit: false, untracked: false, label: "Automation" },
  pipelines:          { key: "pipelines",          used: 10,   limit: 10,    atLimit: true,  untracked: false, label: "Pipelines"  },
};

// Previous month final levels — overlaid as a dashed reference line on the current bars
const DUMMY_PREV_MONTH = {
  team_members:       { used: 2,    limit: 5     },
  ai_credits_monthly: { used: 6200, limit: 10000 },
  email_monthly:      { used: 3100, limit: 5000  },
  leads:              { used: 195,  limit: null  },
  sms_monthly:        { used: 280,  limit: 1000  },
  social_profiles:    { used: 2,    limit: 10    },
  communities:        { used: 0,    limit: 1     },
  websites:           { used: 1,    limit: 3     },
  funnels:            { used: 9,    limit: 20    },
  automations:        { used: 6,    limit: 10    },
  pipelines:          { used: 7,    limit: 10    },
};

// where each module card should send you
const MODULE_ROUTES = {
  "email-marketing": "/modules/email/reports",
  "affiliate-vendors":
    "/modules/affiliates/vendor/manage-products/performance-reports",
  "affiliate-revenue": "/modules/affiliates/affiliate-marketplace/analytics",
  "physical-products": "/modules/physical-products",
  "digital-products": "/modules/digital-products",
  leads: "/leads",
  subscriptions: "/modules/online-courses",
  webinars: "/modules/webinars",
  social: "/modules/social_media/dashboard",
  subaccounts: "/modules/subaccounts",
  community: "/modules/communities",
};

const DEFAULT_MODULE_CARDS = [
  {
    id: "email-marketing",
    title: "Email Marketing",
    subtitle: "Broadcasts, campaigns, piplines, crm, automations, autoresponders",
    enabled: true,
  },
  {
    id: "affiliate-vendors",
    title: "Vendor's Sales Revenue",
    subtitle: "Vendor's products you sell using affiliates",
    enabled: true,
  },
  {
    id: "affiliate-revenue",
    title: "Affiliate Sales - Other People's Products",
    subtitle: "Revenue earned selling other people's products",
    enabled: true,
  },
  {
    id: "physical-products",
    title: "Physical Products",
    subtitle: "Inventory, orders & fulfilment",
    enabled: true,
  },
  {
    id: "digital-products",
    title: "Digital Products",
    subtitle: "Files, access and delivery",
    enabled: true,
  },
  {
    id: "leads",
    title: "Leads & Contacts",
    subtitle: "New leads today, this week, this month",
    enabled: true,
  },
  {
    id: "subscriptions",
    title: "Subscriptions & Online Courses",
    subtitle: "New subscribers and course enrolments",
    enabled: true,
  },
  {
    id: "webinars",
    title: "Webinars & Live Events",
    subtitle: "Sessions held or booked",
    enabled: true,
  },
  {
    id: "social",
    title: "Social Media",
    subtitle: "Posts pushed out across channels",
    enabled: true,
  },
  {
    id: "subaccounts",
    title: "Agency / Sub-Accounts",
    subtitle: "Revenue from client sub-accounts",
    enabled: true,
  },
  {
    id: "community",
    title: "Community",
    subtitle: "New messages & total members",
    enabled: true,
  },
];

// same labels as CRM "Quick Actions"
const TASK_FILTERS = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
  { key: "dueToday", label: "Due today" },
];

// localStorage keys
const DASHBOARD_CARD_STYLE_KEY = "gr8_dashboard_card_style";
const MODULE_CARDS_LS_KEY = "gr8_dashboard_module_cards_v2";
const MODULE_CARDS_LS_FALLBACK_KEY = "gr8_dashboard_module_cards";

// choose which timestamp to use for a task date
// supports:
//  - tasks:  due_at | created_at
//  - crm_tasks: due_date + task_time | created_at
function getTaskDate(task) {
  if (!task) return null;

  if (task.due_at) return task.due_at;

  if (task.due_date) {
    // crm_tasks style
    const dateStr = task.due_date; // 'YYYY-MM-DD'
    const timeStr = task.task_time || "00:00:00";
    return `${dateStr}T${timeStr}`;
  }

  return task.created_at || null;
}

// centralised "is this task still open?"
function isOpenTask(task) {
  if (!task) return false;
  // tasks table style (status string)
  if (typeof task.status === "string") {
    const s = task.status.toLowerCase();
    return !(s === "done" || s === "completed");
  }
  // crm_tasks style (completed boolean)
  if (typeof task.completed === "boolean") {
    return !task.completed;
  }
  // default
  return true;
}

// mark completed for status pill logic
function isTaskCompleted(task) {
  if (!task) return false;
  if (typeof task.completed === "boolean") return !!task.completed;
  if (typeof task.status === "string") {
    const s = task.status.toLowerCase();
    return s === "done" || s === "completed";
  }
  return false;
}

// filter tasks for a given yyyy-mm-dd (used mainly for stats)
function filterTasksForDate(tasksArray, dateStr) {
  if (!tasksArray || tasksArray.length === 0) return [];
  const base = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setHours(23, 59, 59, 999);

  return tasksArray.filter((t) => {
    const ts = getTaskDate(t);
    if (!ts) return false;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return false;
    return d >= start && d <= end;
  });
}

function getToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hexToRgba(hex, alpha) {
  if (!hex) return `rgba(15,23,42,${alpha})`;
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const num = parseInt(h, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

// Returns true if hex colour is perceptually light (use dark text on top)
function isLightColor(hex) {
  if (!hex) return false;
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const num = parseInt(h, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 145;
}

// ===============================
// CALLS / VOICEMAIL SUMMARY HELPERS
// ===============================

const CALLS_LS_KEY = "gr8:crm:readCalls:v1";

function getCallsReadSet() {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(CALLS_LS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

// same logic as crm/calls.js, but only used to detect recordings
function getRecordingSrcForDashboard(call) {
  if (!call) return null;
  const sidFromField = call.recording_sid;
  let sidFromUrl = null;

  if (!sidFromField && call.recording_url) {
    const m = String(call.recording_url).match(/Recordings\/(RE[\w\d]+)/i);
    if (m && m[1]) sidFromUrl = m[1];
  }

  const sid = sidFromField || sidFromUrl;
  if (!sid) return null;

  return `/api/twilio/recording?sid=${encodeURIComponent(sid)}`;
}

// apply CRM-style quick filters to the full combined task list
function applyTaskFilter(allTasks, view, dateStr) {
  if (!Array.isArray(allTasks) || allTasks.length === 0) return [];
  const selectedDate = dateStr || getToday();

  let filtered = allTasks;

  const todayStart = new Date(selectedDate);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(selectedDate);
  todayEnd.setHours(23, 59, 59, 999);

  if (view === "today") {
    filtered = filterTasksForDate(allTasks, selectedDate);
  } else if (view === "dueToday") {
    filtered = filterTasksForDate(allTasks, selectedDate).filter((t) =>
      isOpenTask(t)
    );
  } else if (view === "upcoming") {
    filtered = allTasks.filter((t) => {
      const ts = getTaskDate(t);
      if (!ts) return false;
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return false;
      return d > todayEnd && isOpenTask(t);
    });
  } else if (view === "overdue") {
    filtered = allTasks.filter((t) => {
      const ts = getTaskDate(t);
      if (!ts) return false;
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return false;
      return d < todayStart && isOpenTask(t);
    });
  } else if (view === "completed") {
    filtered = allTasks.filter((t) => !isOpenTask(t));
  } else {
    // "all"
    filtered = allTasks;
  }

  // always sort by datetime ascending so feed is sensible
  return [...filtered].sort((a, b) => {
    const da = new Date(getTaskDate(a) || 0).getTime();
    const db = new Date(getTaskDate(b) || 0).getTime();
    return da - db;
  });
}

// simple notes parser adapted from CRM/tasks
function parseNotes(raw) {
  if (!raw) {
    return {
      type: "Task",
      time: "",
      location: "",
      body: "",
    };
  }

  raw = String(raw);
  if (!raw.startsWith("[")) {
    return {
      type: "Task",
      time: "",
      location: "",
      body: raw,
    };
  }

  const closeIdx = raw.indexOf("]");
  if (closeIdx === -1) {
    return {
      type: "Task",
      time: "",
      location: "",
      body: raw,
    };
  }

  const meta = raw.slice(1, closeIdx);
  const body = raw.slice(closeIdx + 1).trim();

  const result = {
    type: "Task",
    time: "",
    location: "",
    body,
  };

  meta.split("â€¢").forEach((chunk) => {
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

export default function StoreDashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenueCents: 0,
    totalOrders: 0,
    abandonedCount: 0,
    openTasksToday: 0,
    tasksToday: 0,
    totalTasks: 0,
    overdueTasks: 0,
    completedTasks: 0,
    subscribersTotal: 0,
    subscribersLast7: 0,
  });

  // NEW: email stats (last 7 days)
  const [emailStats, setEmailStats] = useState({
    broadcasts7d: 0,
    campaigns7d: 0,
    automations7d: 0,
    autoresponders7d: 0,
    total7d: 0,
  });

  // NEW: calls summary + voicemail pill state
  const [callsSummary, setCallsSummary] = useState({
    total: 0,
    unread: 0,
    withRecording: 0,
    unreadWithRecording: 0,
  });
  const [hasUnheard, setHasUnheard] = useState(false);

  const [orders, setOrders] = useState([]);
  const [checkouts, setCheckouts] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [subscriberMap, setSubscriberMap] = useState({});

  const [taskDate, setTaskDate] = useState(getToday());
  const [taskView, setTaskView] = useState("overdue"); // default: show overdue
  const [error, setError] = useState("");

  // Ã°Å¸â€ â€¢ moduleCards: initialise directly from localStorage (so hidden modules stick)
  const [moduleCards, setModuleCards] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_MODULE_CARDS;
    }
    try {
      let raw = window.localStorage.getItem(MODULE_CARDS_LS_KEY);
      if (!raw) {
        raw = window.localStorage.getItem(MODULE_CARDS_LS_FALLBACK_KEY);
      }
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Failed to load module cards from localStorage:", e);
    }
    return DEFAULT_MODULE_CARDS;
  });

  
  // Ã°Å¸â€â€˜ Card style -default glass, then read LS on first client render
  const [cardStyle, setCardStyle] = useState("glass");

  // client edit modal
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [stages] = useState([]); // we're not using pipeline stages here, keep empty
  const [userId, setUserId] = useState(null);

  // selected tasks (checkbox) -dashboard version
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

  // plan usage summary
  const [planUsage, setPlanUsage] = useState(null);

  // social media stats
  const [socialStats, setSocialStats] = useState({ total: 0, scheduled: 0, published: 0, failed: 0 });

  // job board: first open task for the busiest active job
  const [jobBoardPriority, setJobBoardPriority] = useState(null);
  // shape: { job: { id, name, client }, nextTask: { key, label }, openCount, totalJobs }
  // all jobs with task progress, sorted most-urgent first
  const [allJobData, setAllJobData] = useState([]);

  const handleOpenLeadDetails = (lead) => {
    if (!lead) return;
    setSelectedLead(lead);
    setIsLeadModalOpen(true);
  };

  const handleOpenModuleRoute = (id) => {
    const route = MODULE_ROUTES[id];
    if (route) {
      router.push(route);
    }
  };

  // helper to persist card style
  const persistCardStyle = (style) => {
    setCardStyle(style);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DASHBOARD_CARD_STYLE_KEY, style);
    }
  };

  // âœ… Read saved card style from localStorage (glass / solid)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DASHBOARD_CARD_STYLE_KEY);
      if (raw === "glass" || raw === "solid") {
        setCardStyle(raw);
      }
    } catch {
      // ignore
    }
  }, []);

  // save layout whenever moduleCards changes (enabled/disabled or order)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        MODULE_CARDS_LS_KEY,
        JSON.stringify(moduleCards)
      );
    } catch (e) {
      console.warn("Failed to save module cards layout:", e);
    }
  }, [moduleCards]);

  // MAIN LOAD -stats + tasks + subscribers + email stats
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");

        const { data: sess } = await supabase.auth.getSession();
        const user = sess?.session?.user;
        if (!user) {
          setError("You must be logged in to view this page.");
          setLoading(false);
          return;
        }
        const currentUserId = user.id;
        setUserId(currentUserId);

        // orders and checkouts
        const [
          { data: ordersData, error: ordersErr },
          { data: sessionsData, error: sessionsErr },
        ] = await Promise.all([
          supabase
            .from("orders")
            .select("*")
            .eq("user_id", currentUserId)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("checkout_sessions")
            .select("*")
            .eq("user_id", currentUserId)
            .in("status", ["open", "abandoned"])
            .order("updated_at", { ascending: false })
            .limit(50),
        ]);

        if (ordersErr) {
          console.error(ordersErr);
          setError("Error loading orders.");
        }
        if (sessionsErr) {
          console.error(sessionsErr);
          setError("Error loading checkout sessions.");
        }

        const safeOrders = ordersData || [];
        const safeSessions = sessionsData || [];

        setOrders(safeOrders);
        setCheckouts(safeSessions);

        // tasks from main tasks table
        const {
          data: tasksData,
          error: tasksErr,
        } = await supabase
          .from("tasks")
          .select("*")
          .eq("owner", currentUserId);

        if (tasksErr) {
          console.error(tasksErr);
        }

        let combinedTasks = tasksData || [];

        // ALSO import subscriber tasks from crm_tasks table
        try {
          const {
            data: crmTasksData,
            error: crmErr,
          } = await supabase
            .from("crm_tasks")
            .select("*")
            .eq("user_id", currentUserId);

          if (!crmErr && Array.isArray(crmTasksData) && crmTasksData.length) {
            combinedTasks = [...combinedTasks, ...crmTasksData];
          } else if (crmErr) {
            console.warn(
              "crm_tasks query error (safe to ignore if not used):",
              crmErr
            );
          }
        } catch (e) {
          console.warn("crm_tasks lookup failed (table may not exist):", e);
        }

        // sort tasks by date/time
        combinedTasks.sort((a, b) => {
          const da = new Date(getTaskDate(a) || 0).getTime();
          const db = new Date(getTaskDate(b) || 0).getTime();
          return da - db;
        });

        setAllTasks(combinedTasks);

        // Subscriber stats (for mini cards -total + last 7 days)
        let subscribersTotal = 0;
        let subscribersLast7 = 0;
        try {
          const {
            data: subsForStats,
            error: subsStatsErr,
          } = await supabase
            .from("subscribers")
            .select("id, created_at")
            .eq("user_id", currentUserId);

          if (!subsStatsErr && Array.isArray(subsForStats)) {
            subscribersTotal = subsForStats.length;
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            subscribersLast7 = subsForStats.filter((s) => {
              const d = new Date(s.created_at);
              return !Number.isNaN(d.getTime()) && d >= sevenDaysAgo;
            }).length;
          } else if (subsStatsErr) {
            console.error("subscriber stats error:", subsStatsErr);
          }
        } catch (e) {
          console.error("subscriber stats lookup failed:", e);
        }

        // build subscriber/lead map from contact_id, lead_id and subscriber_id
        const contactIds = Array.from(
          new Set(
            combinedTasks
              .flatMap((t) => [t.contact_id, t.lead_id, t.subscriber_id])
              .filter((v) => v && typeof v === "string")
          )
        );

        if (contactIds.length > 0) {
          const [subsRes, leadsRes] = await Promise.all([
            supabase
              .from("subscribers")
              .select("*")
              .eq("user_id", currentUserId)
              .in("id", contactIds),
            supabase
              .from("leads")
              .select("*")
              .eq("user_id", currentUserId)
              .in("id", contactIds),
          ]);

          const map = {};
          if (!subsRes.error && Array.isArray(subsRes.data)) {
            for (const s of subsRes.data) map[s.id] = s;
          } else if (subsRes.error) {
            console.error("subscribers lookup error:", subsRes.error);
          }

          if (!leadsRes.error && Array.isArray(leadsRes.data)) {
            for (const l of leadsRes.data) map[l.id] = l;
          } else if (leadsRes.error) {
            console.error("leads lookup error:", leadsRes.error);
          }

          setSubscriberMap(map);
        } else {
          setSubscriberMap({});
        }

        // stats -revenue + orders
        const totalRevenueCents = safeOrders.reduce(
          (sum, o) => sum + (o.amount_cents || 0),
          0
        );
        const totalOrders = safeOrders.length;
        const abandonedCount = safeSessions.filter(
          (s) => s.status === "abandoned"
        ).length;

        // task stats to feed mini cards
        const todayStr = getToday();
        const todayTasksArr = filterTasksForDate(combinedTasks, todayStr);
        const openTasksToday = todayTasksArr.filter((t) =>
          isOpenTask(t)
        ).length;
        const tasksToday = todayTasksArr.length;
        const totalTasks = combinedTasks.length;

        const now = new Date();
        const overdueTasks = combinedTasks.filter((t) => {
          const ts = getTaskDate(t);
          if (!ts) return false;
          const d = new Date(ts);
          if (Number.isNaN(d.getTime())) return false;
          return d < now && isOpenTask(t);
        }).length;

        const completedTasks = combinedTasks.filter(
          (t) => !isOpenTask(t)
        ).length;

        setStats({
          totalRevenueCents,
          totalOrders,
          abandonedCount,
          openTasksToday,
          tasksToday,
          totalTasks,
          overdueTasks,
          completedTasks,
          subscribersTotal,
          subscribersLast7,
        });

        // EMAIL STATS (last 7 days)
        const sevenDaysAgoISO = new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000
        ).toISOString();

        let broadcasts7d = 0;
        let campaigns7d = 0;
        let automations7d = 0;
        let autoresponders7d = 0;

        try {
          const {
            data: broadcastsData,
            error: broadcastsErr,
          } = await supabase
            .from("email_broadcasts")
            .select("id, sent_at, status")
            .eq("user_id", currentUserId)
            .eq("status", "sent")
            .gte("sent_at", sevenDaysAgoISO);

          if (!broadcastsErr && Array.isArray(broadcastsData)) {
            broadcasts7d = broadcastsData.length;
          } else if (broadcastsErr) {
            console.warn("email_broadcasts stats error:", broadcastsErr.message);
          }
        } catch (e) {
          console.warn(
            "email_broadcasts table might not exist, skipping email stats:",
            e.message
          );
        }

        try {
          const {
            data: campaignsData,
            error: campaignsErr,
          } = await supabase
            .from("email_campaigns_emails")
            .select("id, sent_at")
            .eq("user_id", currentUserId)
            .gte("sent_at", sevenDaysAgoISO);

          if (!campaignsErr && Array.isArray(campaignsData)) {
            campaigns7d = campaignsData.length;
          } else if (campaignsErr) {
            console.warn(
              "email_campaigns_emails stats error:",
              campaignsErr.message
            );
          }
        } catch (e) {
          console.warn(
            "email_campaigns_emails table might not exist, skipping:",
            e.message
          );
        }

        try {
          const {
            data: autoData,
            error: autoErr,
          } = await supabase
            .from("email_automation_sends")
            .select("id, sent_at, kind")
            .eq("user_id", currentUserId)
            .gte("sent_at", sevenDaysAgoISO);

          if (!autoErr && Array.isArray(autoData)) {
            automations7d = autoData.filter(
              (row) =>
                (row.kind || "").toLowerCase() === "automation" ||
                (row.kind || "").toLowerCase() === "flow"
            ).length;

            autoresponders7d = autoData.filter(
              (row) => (row.kind || "").toLowerCase() === "autoresponder"
            ).length;
          } else if (autoErr) {
            console.warn(
              "email_automation_sends stats error:",
              autoErr.message
            );
          }
        } catch (e) {
          console.warn(
            "email_automation_sends table might not exist, skipping:",
            e.message
          );
        }

        setEmailStats({
          broadcasts7d,
          campaigns7d,
          automations7d,
          autoresponders7d,
          total7d:
            broadcasts7d + campaigns7d + automations7d + autoresponders7d,
        });

        // SOCIAL MEDIA STATS
        try {
          const { data: socialData, error: socialErr } = await supabase
            .from("social_posts")
            .select("id, status")
            .eq("user_id", currentUserId);
          if (!socialErr && Array.isArray(socialData)) {
            setSocialStats({
              total: socialData.length,
              scheduled: socialData.filter(r => r.status === "scheduled").length,
              published: socialData.filter(r => r.status === "published").length,
              failed: socialData.filter(r => r.status === "failed").length,
            });
          }
        } catch (e) {
          console.warn("social_posts stats skipped:", e.message);
        }

        // JOB BOARD PRIORITY — find the first open task for the job with the most remaining work
        try {
          const { data: jbJobs } = await supabase
            .from("job_board_jobs")
            .select("id, name, client, sort_order")
            .eq("user_id", currentUserId)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true });

          if (jbJobs?.length) {
            const [{ data: jbBoards }, { data: jbTasksData }] = await Promise.all([
              supabase
                .from("job_board_boards")
                .select("task_list")
                .eq("user_id", currentUserId)
                .order("sort_order", { ascending: true })
                .limit(1),
              supabase
                .from("job_board_tasks")
                .select("job_id, task_key, status, card_order")
                .in("job_id", jbJobs.map(j => j.id)),
            ]);

            const taskList = jbBoards?.[0]?.task_list || [];

            // Build a per-job lookup
            const tasksByJob = {};
            for (const j of jbJobs) tasksByJob[j.id] = {};
            for (const t of jbTasksData || []) {
              if (tasksByJob[t.job_id]) tasksByJob[t.job_id][t.task_key] = t;
            }

            // A task is "done" if its card_order contains "done" OR status === "done"
            const isJbTaskDone = (rec) => {
              if (!rec) return false;
              if (rec.card_order && rec.card_order.split(",").includes("done")) return true;
              return rec.status === "done";
            };

            // Pick the job with the most open tasks; surface its first open task
            let bestJob = null, bestNextTask = null, bestOpenCount = -1;
            for (const job of jbJobs) {
              const jobTasks = tasksByJob[job.id] || {};
              const openTasks = taskList.filter(t => !isJbTaskDone(jobTasks[t.key]));
              if (openTasks.length > bestOpenCount) {
                bestOpenCount = openTasks.length;
                bestJob = job;
                bestNextTask = openTasks[0] || null;
              }
            }

            // Build full per-job data for the Job Board section (sorted most-urgent first)
            const allJobsBuilt = jbJobs.map(job => {
              const jt = tasksByJob[job.id] || {};
              const openTasks = taskList.filter(t => !isJbTaskDone(jt[t.key]));
              return { job, taskList, jobTasks: jt, openCount: openTasks.length, nextTask: openTasks[0] || null, totalTasks: taskList.length };
            });
            // keep natural sort_order (list order) — no re-sort
            setAllJobData(allJobsBuilt);

            if (bestJob && bestNextTask) {
              setJobBoardPriority({
                job: bestJob,
                nextTask: bestNextTask,
                openCount: bestOpenCount,
                totalTasks: taskList.length,
                totalJobs: jbJobs.length,
              });
            }
          }
        } catch (e) {
          console.warn("job board priority fetch skipped:", e.message);
        }

        // visible tasks list -default to "overdue"
        setTasks(applyTaskFilter(combinedTasks, "overdue", taskDate));
        setSelectedTaskIds([]);

        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("Unexpected error loading dashboard.");
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // LOAD CALLS SUMMARY (for top card + pill)
  useEffect(() => {
    async function loadCallsSummary() {
      try {
        const res = await fetch("/api/crm/calls?limit=200");
        const data = await res.json();

        if (!res.ok) {
          console.error("calls summary error:", data.error || res.statusText);
          setCallsSummary({
            total: 0,
            unread: 0,
            withRecording: 0,
            unreadWithRecording: 0,
          });
          setHasUnheard(false);
          return;
        }

        const calls = Array.isArray(data.calls) ? data.calls : [];
        const readSet = getCallsReadSet();

        let total = calls.length;
        let unread = 0;
        let withRecording = 0;
        let unreadWithRecording = 0;

        for (const c of calls) {
          const hasRec = !!getRecordingSrcForDashboard(c);
          const isUnread = !readSet.has(c.id);

          if (isUnread) unread++;
          if (hasRec) withRecording++;
          if (hasRec && isUnread) unreadWithRecording++;
        }

        setCallsSummary({
          total,
          unread,
          withRecording,
          unreadWithRecording,
        });
        setHasUnheard(unreadWithRecording > 0);
      } catch (err) {
        console.error("loadCallsSummary fatal:", err);
        setCallsSummary({
          total: 0,
          unread: 0,
          withRecording: 0,
          unreadWithRecording: 0,
        });
        setHasUnheard(false);
      }
    }

    loadCallsSummary();
  }, []);

  // fetch plan usage summary
  useEffect(() => {
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess?.session?.access_token;
        if (!token) return;
        const res = await fetch("/api/usage/summary", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await res.json();
        if (j?.ok) setPlanUsage(j);
      } catch (e) {
        console.warn("plan usage fetch failed:", e);
      }
    })();
  }, []);

  // when tasks, view or date changes, refresh visible tasks
  useEffect(() => {
    setTasks(applyTaskFilter(allTasks, taskView, taskDate));
    setSelectedTaskIds((prev) =>
      prev.filter((id) => allTasks.some((t) => t.id === id))
    );
  }, [allTasks, taskView, taskDate]);

  const formatCurrency = (cents, currency = "AUD") => {
    const value = (cents || 0) / 100;
    try {
      return new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: currency || "AUD",
      }).format(value);
    } catch {
      return `${value.toFixed(2)} ${currency || ""}`;
    }
  };

  const formatDateTime = (value) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString();
  };

  const renderCartSummary = (cart_items) => {
    if (!cart_items) return "-";

    let itemsObj = cart_items;
    if (typeof cart_items === "string") {
      try {
        itemsObj = JSON.parse(cart_items);
      } catch {
        return "-";
      }
    }

    const items = itemsObj.items || [];
    if (!Array.isArray(items) || items.length === 0) return "-";

    if (items.length === 1) {
      const it = items[0];
      return `${it.name || "Item"} x${it.quantity || 1}`;
    }

    return `${items.length} items`;
  };

  // drag & drop for module cards
  const handleModuleDragStart = (e, id) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleModuleDrop = (e, targetId) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === targetId) return;

    setModuleCards((prev) => {
      const fromIndex = prev.findIndex((c) => c.id === sourceId);
      const toIndex = prev.findIndex((c) => c.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return prev;

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const handleModuleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const toggleModuleVisibility = (id) => {
    setModuleCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const toggleSelectTask = (taskId) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleDeleteSelectedTasks = async () => {
    if (selectedTaskIds.length === 0) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete ${selectedTaskIds.length} selected task(s)?`)
    ) {
      return;
    }

    try {
      // try delete from both crm_tasks and tasks (ids that don't exist will be ignored)
      const ids = selectedTaskIds;

      const { error: crmErr } = await supabase
        .from("crm_tasks")
        .delete()
        .in("id", ids);

      if (crmErr) {
        console.error("crm_tasks delete error:", crmErr);
      }

      const { error: coreErr } = await supabase
        .from("tasks")
        .delete()
        .in("id", ids);

      if (coreErr) {
        console.error("tasks delete error:", coreErr);
      }

      setAllTasks((prev) => prev.filter((t) => !ids.includes(t.id)));
      setTasks((prev) => prev.filter((t) => !ids.includes(t.id)));
      setSelectedTaskIds([]);
    } catch (e) {
      console.error("deleteSelectedTasks fatal:", e);
    }
  };

  const handleToggleTaskStatus = async (task) => {
    if (!task) return;
    try {
      const updates = {};
      let table = null;

      if (typeof task.completed === "boolean") {
        table = "crm_tasks";
        updates.completed = !task.completed;
      } else if (typeof task.status === "string") {
        table = "tasks";
        const currentlyDone = isTaskCompleted(task);
        updates.status = currentlyDone ? "open" : "completed";
      } else {
        return;
      }

      const { error: updateErr } = await supabase
        .from(table)
        .update(updates)
        .eq("id", task.id);

      if (updateErr) {
        console.error("toggleTaskStatus error:", updateErr);
      }

      setAllTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, ...updates } : t))
      );
    } catch (e) {
      console.error("toggleTaskStatus fatal:", e);
    }
  };

  const enabledCards = moduleCards.filter((c) => c.enabled);
  const disabledCards = moduleCards.filter((c) => !c.enabled);

  const allTasksSelected =
    tasks.length > 0 && selectedTaskIds.length === tasks.length;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0b1120",
      color: "#f1f5f9",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>
      <Head>
        <title>Command Centre · Platform Overview</title>
      </Head>

      {/* ═══════ BANNER ═══════ */}
      <div style={{ background: "#0b1120", padding: "28px 22px 0" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#22c55e",
            borderRadius: 16, padding: "16px 22px",
          }}>
            {/* Left: icon + title */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 58, height: 58, borderRadius: 14, background: "rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 34, lineHeight: 1 }}>📌</span>
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 36, fontWeight: 700, color: "#ffffff", lineHeight: 1.1 }}>Command Centre</h1>
                <p style={{ margin: "4px 0 0", fontSize: 18, color: "rgba(255,255,255,0.85)" }}>Central control for tasks, revenue and activity</p>
              </div>
            </div>
            {/* Right: date + actions */}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ fontSize: 16, color: "rgba(255,255,255,0.8)", fontWeight: 500, whiteSpace: "nowrap" }}>
                {new Date().toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              </div>
              {hasUnheard && (
                <button type="button" onClick={() => router.push("/modules/email/crm/calls")} style={{ borderRadius: 8, padding: "8px 16px", fontSize: 16, fontWeight: 600, border: "2px solid rgba(255,255,255,0.4)", background: "rgba(239,68,68,0.3)", color: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}>
                  📞 {callsSummary.unreadWithRecording} Voicemail{callsSummary.unreadWithRecording !== 1 ? "s" : ""}
                </button>
              )}
              <Link href="/dashboard" style={{ borderRadius: 8, padding: "8px 16px", fontSize: 16, fontWeight: 600, border: "2px solid rgba(255,255,255,0.35)", background: "rgba(0,0,0,0.15)", color: "#fff", textDecoration: "none" }}>
                ← Back
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ MAIN CONTENT ═══════ */}
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "28px 22px 64px" }}>

        {error && !loading && (
          <div style={{ background: "rgba(239,68,68,0.1)", color: "#fca5a5", padding: "14px 18px", borderRadius: 12, marginBottom: 24, fontsize: 16, border: "1px solid rgba(239,68,68,0.25)" }}>{error}</div>
        )}

        {/* ═══════ PRIORITY — what needs action right now ═══════ */}
        {(stats.overdueTasks > 0 || jobBoardPriority?.nextTask) && (
          <div style={{
            display: "grid",
            gridTemplateColumns: stats.overdueTasks > 0 && jobBoardPriority?.nextTask ? "1fr 1fr" : "1fr",
            gap: 12,
            marginBottom: 20,
          }}>
            {/* Overdue tasks alert */}
            {stats.overdueTasks > 0 && (
              <div
                onClick={() => setTaskView("overdue")}
                style={{ background: "#111827", border: "1px solid rgba(239,68,68,0.25)", borderLeft: "4px solid #ef4444", borderRadius: 12, padding: "14px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 16 }}
              >
                <span style={{ fontSize: 26, flexShrink: 0 }}>⚠</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#ef4444", marginBottom: 2 }}>
                    {stats.overdueTasks} Overdue Task{stats.overdueTasks !== 1 ? "s" : ""}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Scroll down · filter set to Overdue</div>
                </div>
              </div>
            )}
            {/* Job board: next action */}
            {jobBoardPriority?.nextTask && (
              <div
                onClick={() => router.push("/modules/jobboard")}
                style={{ background: "#111827", border: "1px solid rgba(251,146,60,0.25)", borderLeft: "4px solid #fb923c", borderRadius: 12, padding: "14px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 16 }}
              >
                <span style={{ fontSize: 26, flexShrink: 0 }}>📋</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#fb923c", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>
                    Next · {jobBoardPriority.job.name}{jobBoardPriority.job.client ? ` · ${jobBoardPriority.job.client}` : ""}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#f9fafb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2 }}>
                    ▸ {jobBoardPriority.nextTask.label}
                  </div>
                  <div style={{ fontSize: 16, color: "#6b7280" }}>
                    {jobBoardPriority.openCount} of {jobBoardPriority.totalTasks} tasks remaining · {jobBoardPriority.totalJobs} active job{jobBoardPriority.totalJobs !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ KPI STRIP ═══════ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 16, marginBottom: 28 }}>
          <KpiCard label="Total Revenue" value={formatCurrency(stats.totalRevenueCents, "AUD")} accent="#10b981" gradient="linear-gradient(135deg,#052e16,#064e3b)" icon="💰" sub="All time" />
          <KpiCard label="Total Orders" value={stats.totalOrders} accent="#60a5fa" gradient="linear-gradient(135deg,#0c1a3a,#0f2d6e)" icon="🛍" sub={stats.abandonedCount + " abandoned"} subAlert={stats.abandonedCount > 0} />
          <KpiCard label="Subscribers" value={stats.subscribersTotal.toLocaleString()} accent="#a78bfa" gradient="linear-gradient(135deg,#1a0938,#2d1060)" icon="👥" sub={"+" + stats.subscribersLast7 + " this week"} />
          <KpiCard label="Overdue Tasks" value={stats.overdueTasks} accent="#f97316" gradient="linear-gradient(135deg,#2c0a00,#431407)" icon="⚠" sub={stats.completedTasks + " completed"} alert={stats.overdueTasks > 0} />
          <KpiCard label="Emails (7 days)" value={emailStats.total7d} accent="#fbbf24" gradient="linear-gradient(135deg,#1c1000,#2a1d00)" icon="✉" sub={emailStats.broadcasts7d + " broadcasts"} />
          <KpiCard label="Calls Logged" value={callsSummary.total} accent="#f472b6" gradient="linear-gradient(135deg,#1c0016,#2d0024)" icon="📞" sub={hasUnheard ? callsSummary.unreadWithRecording + " unheard" : "All heard"} alert={hasUnheard} />
        </div>

        {/* ═══════ JOB BOARD ═══════ */}
        {allJobData.length > 0 && (
          <div style={{ background: "#111827", border: "1px solid #1f2937", borderTop: "2px solid #fb923c", borderRadius: 20, padding: "22px 28px", marginBottom: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: 14, background: "rgba(251,146,60,0.15)", border: "1px solid rgba(251,146,60,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📋</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: "#f9fafb" }}>Job Board</div>
                  <div style={{ fontSize: 16, color: "#6b7280", marginTop: 2 }}>{allJobData.length} active job{allJobData.length !== 1 ? "s" : ""}</div>
                </div>
              </div>
              <button type="button" onClick={() => router.push("/modules/jobboard")} style={{ padding: "8px 18px", borderRadius: 10, background: "rgba(251,146,60,0.12)", border: "1px solid rgba(251,146,60,0.3)", color: "#fb923c", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
                Open Job Board →
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {allJobData.map(({ job, openCount, nextTask, totalTasks }, idx) => {
                const doneCount = totalTasks - openCount;
                const pct = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;
                const allDone = openCount === 0;
                const accentColor = allDone ? "#10b981" : openCount >= 4 ? "#ef4444" : openCount >= 2 ? "#fb923c" : "#facc15";
                return (
                  <div key={job.id} onClick={() => router.push("/modules/jobboard")} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: idx < allJobData.length - 1 ? "1px solid #1f2937" : "none", cursor: "pointer" }}>
                    {/* Status dot */}
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: accentColor, flexShrink: 0 }} />
                    {/* Job name + client */}
                    <div style={{ minWidth: 0, width: 220, flexShrink: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#f9fafb", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.name}</div>
                      {job.client && <div style={{ fontSize: 12, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.client}</div>}
                    </div>
                    {/* Next task */}
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: allDone ? "#10b981" : "#3b82f6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {allDone ? "✓ All tasks complete" : "▸ " + (nextTask?.label || "")}
                    </div>
                    {/* Progress bar + fraction */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <div style={{ width: 80, height: 4, background: "#1f2937", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: pct + "%", background: accentColor, borderRadius: 2 }} />
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280", width: 32, textAlign: "right" }}>{doneCount}/{totalTasks}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══════ EMAIL MARKETING ═══════ */}
        <div style={{ background: "#111827", border: "1px solid #1f2937", borderTop: "2px solid #facc15", borderRadius: 20, padding: "22px 28px", marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: "rgba(250,204,21,0.15)", border: "1px solid rgba(250,204,21,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📧</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#f9fafb" }}>Email Marketing</div>
                <div style={{ fontSize: 16, color: "#6b7280", marginTop: 2 }}>Last 7 days</div>
              </div>
            </div>
            <button type="button" onClick={() => router.push("/modules/email/reports")} style={{ padding: "8px 18px", borderRadius: 10, background: "rgba(250,204,21,0.12)", border: "1px solid rgba(250,204,21,0.3)", color: "#facc15", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
              Open Reports →
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 14 }}>
            {[
              { label: "Total Emails",    value: emailStats.total7d,          icon: "✉",  color: "#facc15", bg: "rgba(250,204,21,0.08)",   border: "rgba(250,204,21,0.22)",   desc: "Sent this week" },
              { label: "Broadcasts",      value: emailStats.broadcasts7d,     icon: "📢", color: "#fb923c", bg: "rgba(251,146,60,0.08)",   border: "rgba(251,146,60,0.22)",   desc: "One-off sends" },
              { label: "Campaigns",       value: emailStats.campaigns7d,      icon: "🎯", color: "#60a5fa", bg: "rgba(96,165,250,0.08)",   border: "rgba(96,165,250,0.22)",   desc: "Campaign series" },
              { label: "Automations",     value: emailStats.automations7d,    icon: "⚙",  color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.22)", desc: "Auto-triggered" },
              { label: "Autoresponders",  value: emailStats.autoresponders7d, icon: "🔄", color: "#34d399", bg: "rgba(52,211,153,0.08)",   border: "rgba(52,211,153,0.22)",   desc: "Sequence emails" },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, border: "1px solid " + s.border, borderRadius: 16, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 24 }}>{s.icon}</span>
                  <span style={{ fontSize: 32, fontWeight: 600, color: s.color, lineHeight: 1 }}>{s.value}</span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#e5e7eb" }}>{s.label}</div>
                <div style={{ fontSize: 16, color: "#6b7280" }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════ SOCIAL MEDIA ═══════ */}
        <div style={{ background: "#111827", border: "1px solid #1f2937", borderTop: "2px solid #22d3ee", borderRadius: 20, padding: "22px 28px", marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📱</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#f9fafb" }}>Social Media</div>
                <div style={{ fontSize: 16, color: "#6b7280", marginTop: 2 }}>Posts overview · all time</div>
              </div>
            </div>
            <button type="button" onClick={() => router.push("/modules/social_media/dashboard")} style={{ padding: "8px 18px", borderRadius: 10, background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.3)", color: "#22d3ee", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
              Open Social →
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14 }}>
            {[
              { label: "Total Posts", value: socialStats.total, icon: "📝", color: "#22d3ee", bg: "rgba(6,182,212,0.1)", border: "rgba(6,182,212,0.25)", desc: "All content created" },
              { label: "Published", value: socialStats.published, icon: "✅", color: "#34d399", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.25)", desc: "Posted & live" },
              { label: "Scheduled", value: socialStats.scheduled, icon: "🗓", color: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.25)", desc: "Upcoming posts" },
              { label: "Needs Attention", value: socialStats.failed, icon: socialStats.failed > 0 ? "⚠" : "💚", color: socialStats.failed > 0 ? "#fca5a5" : "#6b7280", bg: socialStats.failed > 0 ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.03)", border: socialStats.failed > 0 ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.06)", desc: socialStats.failed > 0 ? "Failed — retry required" : "All good" },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, border: "1px solid " + s.border, borderRadius: 16, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 24 }}>{s.icon}</span>
                  <span style={{ fontSize: 32, fontWeight: 600, color: s.color, lineHeight: 1 }}>{s.value}</span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#e5e7eb" }}>{s.label}</div>
                <div style={{ fontSize: 16, color: "#6b7280" }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════ TASKS + SIDEBAR ═══════ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 356px", gap: 24, marginBottom: 28, alignItems: "start" }}>

          {/* TASKS PANEL */}
          <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 20, overflow: "hidden" }}>
            {/* Header */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0d1525" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 22 }}>📋</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#f9fafb" }}>Today's Schedule & To-Dos</div>
                  <div style={{ fontSize: 16, color: "#6b7280", marginTop: 2 }}>
                    <span style={{ color: "#60a5fa", fontWeight: 600 }}>Tasks</span>
                    <span style={{ color: "#374151" }}> · </span>
                    <span style={{ color: "#a78bfa", fontWeight: 600 }}>CRM Tasks</span>
                    <span style={{ color: "#374151" }}> · </span>
                    <span style={{ color: "#6b7280" }}>Labels</span>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input type="date" value={taskDate} onChange={e => setTaskDate(e.target.value)}
                  style={{ borderRadius: 8, padding: "7px 12px", background: "#1f2937", border: "1px solid #374151", color: "#f9fafb", fontSize: 16, cursor: "pointer" }} />
                {stats.openTasksToday > 0 && (
                  <span style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)", borderRadius: 8, padding: "4px 12px", fontSize: 16, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {stats.openTasksToday} open today
                  </span>
                )}
                <button type="button" onClick={() => router.push("/modules/email/crm/tasks")} style={{ borderRadius: 8, padding: "8px 16px", fontSize: 16, fontweight: 600, background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
                  + Add Task
                </button>
              </div>
            </div>

            {/* Delete selected */}
            {selectedTaskIds.length > 0 && (
              <div style={{ background: "rgba(239,68,68,0.07)", borderBottom: "1px solid rgba(239,68,68,0.12)", padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" checked={allTasksSelected} onChange={() => { if (allTasksSelected) setSelectedTaskIds([]); else setSelectedTaskIds(tasks.map(t => t.id)); }} style={{ accentColor: "#10b981" }} />
                  <span style={{ fontsize: 16, color: "#94a3b8" }}>{selectedTaskIds.length} selected</span>
                </div>
                <button type="button" onClick={handleDeleteSelectedTasks} style={{ borderRadius: 8, padding: "6px 14px", fontsize: 16, fontweight: 600, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", cursor: "pointer" }}>Delete Selected</button>
              </div>
            )}

            {/* Filter tabs */}
            <div style={{ padding: "10px 20px", borderBottom: "1px solid #1f2937", display: "flex", gap: 4, background: "rgba(0,0,0,0.2)" }}>
              {TASK_FILTERS.map(f => (
                <button key={f.key} type="button" onClick={() => setTaskView(f.key)} style={{ borderRadius: 8, padding: "6px 14px", fontsize: 16, fontWeight: 600, cursor: "pointer", border: "none", background: taskView === f.key ? "#1d4ed8" : "transparent", color: taskView === f.key ? "#bfdbfe" : "#6b7280" }}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Task list */}
            <div style={{ maxHeight: 520, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {tasks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 20px", color: "#4b5563" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                  <div style={{ fontsize: 16, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>All clear!</div>
                  <div style={{ fontsize: 16, color: "#4b5563" }}>No tasks for this date</div>
                </div>
              ) : tasks.map(task => {
                const sub = subscriberMap[task.lead_id] || subscriberMap[task.subscriber_id] || null;
                return (
                  <TaskRow key={task.id} task={task} subscriber={sub}
                    selected={selectedTaskIds.includes(task.id)}
                    onToggleSelect={() => toggleSelectTask(task.id)}
                    onOpenLead={() => handleOpenLeadDetails(sub)}
                    onToggleStatus={() => handleToggleTaskStatus(task)}
                  />
                );
              })}
            </div>
          </div>

          {/* SIDEBAR */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Calls alert */}
            {callsSummary.total > 0 && (
              <div style={{ borderRadius: 16, border: hasUnheard ? "1px solid rgba(239,68,68,0.45)" : "1px solid #1f2937", borderLeft: hasUnheard ? "3px solid #ef4444" : "1px solid #1f2937", background: "#111827", padding: "16px 20px", cursor: "pointer", animation: hasUnheard ? "ccPulse 2s ease-in-out infinite" : "none" }} onClick={() => router.push("/modules/email/crm/calls")}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontsize: 16, fontweight: 600, color: hasUnheard ? "#fca5a5" : "#f9fafb" }}>{hasUnheard ? "🔴 Voicemails Waiting" : "📞 Calls"}</div>
                  <span style={{ fontSize: 26, fontweight: 600, color: hasUnheard ? "#ef4444" : "#94a3b8" }}>{callsSummary.total}</span>
                </div>
                <div style={{ fontsize: 16, color: hasUnheard ? "#fca5a5" : "#6b7280" }}>
                  {hasUnheard ? callsSummary.unreadWithRecording + " unheard recording" + (callsSummary.unreadWithRecording !== 1 ? "s" : "") : callsSummary.total + " total logged"}
                </div>
              </div>
            )}

            {/* 2x2 stat grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <MiniStatCard title="Subscribers" primary={stats.subscribersTotal.toLocaleString()} secondary={"+" + stats.subscribersLast7 + " this week"} accent="#a78bfa" />
              <MiniStatCard title="Tasks Today" primary={"" + stats.tasksToday} secondary={"Overdue: " + stats.overdueTasks} accent="#f97316" />
              <MiniStatCard title="Completed" primary={"" + stats.completedTasks} secondary={"Total: " + stats.totalTasks} accent="#10b981" />
              <MiniStatCard title="Emails (7d)" primary={"" + emailStats.total7d} secondary={"Broadcasts: " + emailStats.broadcasts7d} accent="#fbbf24" />
            </div>

            {/* Revenue + Orders */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <MiniStatCard title="Revenue" primary={formatCurrency(stats.totalRevenueCents, "AUD")} secondary="All time" accent="#10b981" />
              <MiniStatCard title="Orders" primary={"" + stats.totalOrders} secondary={stats.abandonedCount + " abandoned"} accent="#60a5fa" />
            </div>

            {/* Module configurator — auto-shown when any card is hidden */}
            {disabledCards.length > 0 && (
              <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 16, padding: "16px 18px" }}>
                <div style={{ fontsize: 16, fontweight: 600, color: "#6b7280", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Hidden Modules</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {disabledCards.map(c => (
                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #1f2937" }}>
                      <span style={{ fontsize: 16, color: "#94a3b8" }}>{c.title}</span>
                      <button type="button" onClick={() => toggleModuleVisibility(c.id)} style={{ borderRadius: 6, padding: "4px 12px", fontsize: 16, fontweight: 600, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: "#34d399", cursor: "pointer" }}>Show</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══════ PLATFORM MODULES ═══════ */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 18, fontweight: 600, color: "#f9fafb" }}>Platform Modules</div>
              <div style={{ fontsize: 16, color: "#6b7280", marginTop: 2 }}>{enabledCards.length} visible · drag to reorder</div>
            </div>
            <div style={{ fontsize: 16, color: "#4b5563" }}>Drag to reorder · ✖ to hide</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16 }}>
            {enabledCards.map(card => (
              <ModuleCard key={card.id} card={card} emailStats={emailStats}
                onDragStart={handleModuleDragStart} onDrop={handleModuleDrop} onDragOver={e => e.preventDefault()}
                onHide={toggleModuleVisibility}
                onOpenModule={id => { const route = MODULE_ROUTES[id]; if (route) router.push(route); }}
              />
            ))}
            {enabledCards.length === 0 && (
              <div style={{ gridColumn: "1/-1", padding: "40px 20px", textAlign: "center", borderRadius: 16, border: "1px dashed #374151", color: "#4b5563", fontsize: 16 }}>
                No modules visible. Open Customise to add them back.
              </div>
            )}
          </div>
        </div>

        {/* ═══════ PLATFORM USAGE — 11 module bars (SideNav colours) ═══════ */}
        {planUsage && (
          <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 20, padding: "26px 28px 22px", marginBottom: 28 }}>
            {/* Header row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#f9fafb", letterSpacing: -0.3 }}>Platform Usage</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                  {planUsage.planName} Plan &middot; {planUsage.monthLabel} &middot; Full bar = limit reached &middot; <span style={{ borderBottom: "1.5px dashed rgba(255,255,255,0.4)", paddingBottom: 1 }}>&nbsp;&nbsp;&nbsp;&nbsp;</span> last month
                </div>
              </div>
              <Link href="/billing" style={{ padding: "9px 20px", borderRadius: 10, background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", fontWeight: 600, fontSize: 14, textDecoration: "none", boxShadow: "0 4px 14px rgba(16,185,129,0.3)", whiteSpace: "nowrap" }}>
                Manage Plan
              </Link>
            </div>

            {/* 14 module bars — fill from bottom; dashed line = last month */}
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", position: "relative" }}>
              {MODULE_USAGE_BARS.map((bar, idx) => {
                const resource = (USE_DUMMY_DATA && bar.resourceKey)
                  ? (DUMMY_RESOURCES[bar.resourceKey] ?? null)
                  : (planUsage.resources?.find(r => r.key === bar.resourceKey) ?? null);
                const prevResource = bar.resourceKey ? (DUMMY_PREV_MONTH[bar.resourceKey] ?? null) : null;
                return <ModuleUsageSingleBar key={bar.key} bar={bar} resource={resource} prevResource={prevResource} />;
              })}
              {/* SVG dashed line connecting previous-month markers across tracked bars */}
              {(() => {
                const n = MODULE_USAGE_BARS.length;
                const pts = MODULE_USAGE_BARS.map((bar, i) => {
                  if (!bar.resourceKey) return null;
                  const prev = DUMMY_PREV_MONTH[bar.resourceKey];
                  if (!prev) return null;
                  const pct = prev.limit != null ? Math.min(100, (prev.used / prev.limit) * 100) : 100;
                  return { x: (i + 0.5) / n * 100, y: (1 - pct / 100) * 100 };
                });
                const segments = [];
                let run = [];
                pts.forEach(p => {
                  if (p) { run.push(p); }
                  else if (run.length > 1) { segments.push(run); run = []; }
                  else { run = []; }
                });
                if (run.length > 1) segments.push(run);
                if (!segments.length) return null;
                return (
                  <svg
                    key="prev-line"
                    style={{ position: "absolute", top: BAR_LABEL_TOP_H, left: 0, width: "100%", height: BAR_TRACK_H, pointerEvents: "none", zIndex: 3 }}
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    {segments.map((seg, si) => (
                      <polyline
                        key={si}
                        points={seg.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ")}
                        fill="none"
                        stroke="rgba(255,255,255,0.45)"
                        strokeWidth="2"
                        strokeDasharray="6 4"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </svg>
                );
              })()}
            </div>

            {/* Warning strip — only shown when ≥1 resource is at/near limit */}
            {planUsage.resources.some(r => !r.untracked && (r.atLimit || (r.limit && r.used !== null && r.used / r.limit >= 0.8))) && (
              <div style={{ marginTop: 20, padding: "12px 18px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 14, color: "#fca5a5" }}>
                  {planUsage.resources.filter(r => r.atLimit).length > 0
                    ? "⚠ " + planUsage.resources.filter(r => r.atLimit).map(r => r.label).join(", ") + " " + (planUsage.resources.filter(r => r.atLimit).length === 1 ? "has" : "have") + " reached the limit."
                    : "⚡ Some resources are approaching their limit."}
                </div>
                <Link href="/billing" style={{ whiteSpace: "nowrap", padding: "7px 16px", borderRadius: 9, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontWeight: 600, fontSize: 14, textDecoration: "none" }}>Upgrade</Link>
              </div>
            )}
          </div>
        )}

        {/* ═══════ ORDERS + CHECKOUTS ═══════ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 20 }}>
          {/* Orders */}
          <div style={{ background: "#111827", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 20, overflow: "hidden" }}>
            <div style={{ padding: "16px 22px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(16,185,129,0.04)" }}>
              <div style={{ fontsize: 16, fontweight: 600, color: "#f9fafb" }}>Recent Orders</div>
              <div style={{ fontsize: 16, color: "#6b7280", background: "#1f2937", padding: "3px 10px", borderRadius: 6 }}>Last {orders.length}</div>
            </div>
            {orders.length === 0 ? (
              <div style={{ padding: "40px 18px", textAlign: "center", color: "#4b5563", fontsize: 16 }}>No orders yet.</div>
            ) : (
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontsize: 16 }}>
                  <thead>
                    <tr style={{ background: "#0d1525" }}>
                      {["Date", "Amount", "Status"].map(h => <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#6b7280", fontweight: 600, fontsize: 16, textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #1f2937" }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => (
                      <tr key={o.id} style={{ borderBottom: "1px solid #1f2937" }}>
                        <td style={{ padding: "11px 16px", color: "#94a3b8", fontsize: 16 }}>{formatDateTime(o.created_at)}</td>
                        <td style={{ padding: "11px 16px", color: "#ffffff", fontweight: 600, fontSize: 16 }}>{formatCurrency(o.amount_cents || 0, o.currency || "AUD")}</td>
                        <td style={{ padding: "11px 16px" }}>
                          <span style={{ padding: "3px 10px", borderRadius: 6, fontsize: 16, fontweight: 600, background: o.status === "paid" ? "rgba(16,185,129,0.15)" : "rgba(234,179,8,0.15)", color: o.status === "paid" ? "#34d399" : "#fbbf24", border: o.status === "paid" ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(234,179,8,0.3)" }}>
                            {o.status || "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Checkouts */}
          <div style={{ background: "#111827", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 20, overflow: "hidden" }}>
            <div style={{ padding: "16px 22px", borderBottom: "1px solid #1f2937", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(249,115,22,0.04)" }}>
              <div style={{ fontsize: 16, fontweight: 600, color: "#f9fafb" }}>Open &amp; Abandoned Checkouts</div>
              <div style={{ fontsize: 16, color: "#6b7280", background: "#1f2937", padding: "3px 10px", borderRadius: 6 }}>Last {checkouts.length}</div>
            </div>
            {checkouts.length === 0 ? (
              <div style={{ padding: "40px 18px", textAlign: "center", color: "#4b5563", fontsize: 16 }}>No open or abandoned checkouts yet.</div>
            ) : (
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontsize: 16 }}>
                  <thead>
                    <tr style={{ background: "#0d1525" }}>
                      {["Updated", "Status", "Cart"].map(h => <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#6b7280", fontweight: 600, fontsize: 16, textTransform: "uppercase", letterSpacing: 1, borderBottom: "1px solid #1f2937" }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {checkouts.map(s => (
                      <tr key={s.id} style={{ borderBottom: "1px solid #1f2937" }}>
                        <td style={{ padding: "11px 16px", color: "#94a3b8", fontsize: 16 }}>{formatDateTime(s.updated_at)}</td>
                        <td style={{ padding: "11px 16px" }}>
                          <span style={{ padding: "3px 10px", borderRadius: 6, fontsize: 16, fontweight: 600, textTransform: "uppercase", background: s.status === "abandoned" ? "rgba(239,68,68,0.15)" : "rgba(234,179,8,0.15)", color: s.status === "abandoned" ? "#fca5a5" : "#fbbf24", border: s.status === "abandoned" ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(234,179,8,0.3)" }}>
                            {s.status}
                          </span>
                        </td>
                        <td style={{ padding: "11px 16px", color: "#94a3b8" }}>{renderCartSummary(s.cart_items)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "28px", color: "#6b7280", fontsize: 16, marginTop: 24 }}>Loading data…</div>
        )}
      </div>

      <LeadDetailsModal
        isOpen={isLeadModalOpen}
        lead={selectedLead}
        stages={stages}
        userId={userId}
        fontScale={1.35}
        onClose={() => { setIsLeadModalOpen(false); setSelectedLead(null); }}
        onNotesUpdated={() => {}}
      />

      <style jsx>{`
        @keyframes ccPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.65; }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   KPI CARD — gradient hero metric tile
═══════════════════════════════════════════════════════ */
function KpiCard({ label, value, accent, gradient, icon, sub, subAlert, alert }) {
  return (
    <div style={{
      borderRadius: 14,
      background: "#111827",
      border: "1px solid " + (alert ? accent + "66" : "#1f2937"),
      borderLeft: "4px solid " + accent,
      padding: "20px 22px",
      animation: alert ? "ccPulse 2s ease-in-out infinite" : "none",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div style={{ fontSize: 26 }}>{icon}</div>
        {alert && <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent, display: "inline-block" }} />}
      </div>
      <div style={{ fontSize: 34, fontWeight: 600, color: "#ffffff", lineHeight: 1, marginBottom: 6, letterSpacing: -0.8 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: accent, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      {sub && <div style={{ fontSize: 13, color: subAlert ? accent : "#6b7280", marginTop: 4, fontWeight: subAlert ? 700 : 400 }}>{sub}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TASK ROW — clean left-border status row
═══════════════════════════════════════════════════════ */
function TaskRow({ task, subscriber, selected, onToggleSelect, onOpenLead, onToggleStatus }) {
  const parsed = parseNotes(task.notes || "");
  const taskDateVal = getTaskDate(task);
  const dueDateStr = task.due_date || (taskDateVal ? taskDateVal.slice(0, 10) : "");
  let dueLabel = "No date";
  if (dueDateStr) {
    const d = new Date(dueDateStr);
    if (!isNaN(d.getTime())) dueLabel = d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  }
  const completed = isTaskCompleted(task);
  let statusLabel = "Scheduled"; let statusColor = "#3b82f6"; let borderColor = "#1d4ed8";
  if (completed) { statusLabel = "Done"; statusColor = "#10b981"; borderColor = "#059669"; }
  else if (dueDateStr) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(dueDateStr); d.setHours(0, 0, 0, 0);
    if (d < today) { statusLabel = "Overdue"; statusColor = "#ef4444"; borderColor = "#b91c1c"; }
    else if (d.getTime() === today.getTime()) { statusLabel = "Due Today"; statusColor = "#f59e0b"; borderColor = "#b45309"; }
  }
  const name = (subscriber && (subscriber.name || subscriber.full_name || [subscriber.first_name, subscriber.last_name].filter(Boolean).join(" "))) || "No contact";
  const email = subscriber ? subscriber.email || "" : "";
  const initials = name.split(" ").filter(Boolean).map(p => p[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderRadius: 12, background: completed ? "rgba(16,185,129,0.04)" : "#1a2232", border: "1px solid #1f2937", borderLeft: "3px solid " + borderColor }}>
      <input type="checkbox" checked={!!selected} onChange={onToggleSelect} style={{ width: 15, height: 15, marginTop: 3, accentColor: "#10b981", cursor: "pointer", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, cursor: subscriber ? "pointer" : "default" }} onClick={subscriber ? onOpenLead : undefined}>
          {subscriber ? (
            <SubscriberAvatar lead={subscriber} size={26} fontSize={11} />
          ) : (
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", fontsize: 16, fontweight: 600, color: "#fff", flexShrink: 0 }}>{initials}</div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontsize: 16, fontWeight: 600, color: completed ? "#6b7280" : "#e5e7eb", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
            {email && <div style={{ fontsize: 16, color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>}
          </div>
        </div>
        <div style={{ fontsize: 16, fontWeight: 600, color: completed ? "#6b7280" : "#f9fafb", textDecoration: completed ? "line-through" : "none", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {task.title || "Untitled task"}
        </div>
        {parsed.body && <div style={{ fontsize: 16, color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{parsed.body}</div>}
        <div style={{ marginTop: 6 }}>
          <span style={{ display: "inline-block", fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.2)", color: "#60a5fa", fontWeight: 600 }}>
            {parsed.type || "Task"}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
        <div style={{ fontsize: 16, color: "#6b7280" }}>{dueLabel}</div>
        <span onClick={onToggleStatus} style={{ fontsize: 16, fontweight: 600, borderRadius: 7, padding: "4px 10px", color: "#fff", background: statusColor, cursor: "pointer", whiteSpace: "nowrap" }}>{statusLabel}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MODULE CARD — solid accent colour matching SideNav
═══════════════════════════════════════════════════════ */
function ModuleCard({ card, emailStats, onDragStart, onDrop, onDragOver, onHide, onOpenModule }) {
  const meta = MODULE_META[card.id] || {};
  const accent = meta.color || "#3b82f6";
  const Icon = meta.Icon || null;
  const isEmail = card.id === "email-marketing";
  const broadcastCount = emailStats ? emailStats.broadcasts7d || 0 : 0;
  const campaignsCount = emailStats ? emailStats.campaigns7d || 0 : 0;
  const autoCount = emailStats ? emailStats.automations7d || 0 : 0;
  const autoresCount = emailStats ? emailStats.autoresponders7d || 0 : 0;
  const textColor = isLightColor(accent) ? "#111827" : "#ffffff";
  const mutedColor = isLightColor(accent) ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.65)";
  return (
    <div draggable onDragStart={e => onDragStart(e, card.id)} onDragOver={onDragOver} onDrop={e => onDrop(e, card.id)} onClick={() => onOpenModule && onOpenModule(card.id)}
      style={{ borderRadius: 18, border: "1px solid " + accent, background: accent, padding: "18px 20px", cursor: "pointer", position: "relative", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(0,0,0,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {Icon ? <Icon color={textColor} size={20} /> : "?"}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: textColor }}>{card.title}</div>
            <div style={{ fontSize: 16, color: mutedColor, marginTop: 1 }}>{card.subtitle}</div>
          </div>
        </div>
        <button type="button" onClick={e => { e.stopPropagation(); onHide(card.id); }} style={{ border: "none", background: "rgba(0,0,0,0.15)", borderRadius: 6, color: textColor, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "4px 7px" }} title="Hide">✖</button>
      </div>
      {isEmail ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <SmallMetric label="Broadcasts"    value={broadcastCount}  labelColor={mutedColor} valueColor={textColor} />
          <SmallMetric label="Campaigns"     value={campaignsCount}  labelColor={mutedColor} valueColor={textColor} />
          <SmallMetric label="Automations"   value={autoCount}       labelColor={mutedColor} valueColor={textColor} />
          <SmallMetric label="Autoresponders" value={autoresCount}   labelColor={mutedColor} valueColor={textColor} />
        </div>
      ) : (
        <div style={{ marginTop: 10, fontSize: 15, color: mutedColor, fontStyle: "italic" }}>Click to open module</div>
      )}
    </div>
  );
}

function SmallMetric({ label, value, labelColor, valueColor }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: labelColor || "#6b7280" }}>{label}</div>
      <div style={{ fontSize: 20, fontweight: 600, color: valueColor || "#f9fafb" }}>{value}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   BAR GAUGE — vertical colored bar chart tile
   Colors keyed to each resource type
═══════════════════════════════════════════════════════ */
const RESOURCE_BAR_COLORS = {
  funnels:           "#f97316",   // orange
  websites:          "#8b5cf6",   // violet
  automations:       "#f59e0b",   // amber
  leads:             "#f43f5e",   // rose
  team_members:      "#0ea5e9",   // sky
  communities:       "#14b8a6",   // teal
  sms_monthly:       "#06b6d4",   // cyan
  email_monthly:     "#ffd11b",   // yellow
  ai_credits_monthly:"#a78bfa",   // purple
};
function BarGauge({ r }) {
  const isUntracked = r.untracked;
  const isUnlimited = !isUntracked && r.limit === null;
  const pct = (!isUntracked && r.limit && r.used !== null) ? Math.min(100, (r.used / r.limit) * 100) : (isUnlimited ? 60 : 0);
  const color = r.atLimit ? "#ef4444" : pct >= 80 ? "#f59e0b" : (RESOURCE_BAR_COLORS[r.key] || "#60a5fa");
  const usedLabel = r.used !== null ? (r.used >= 1000 ? (r.used / 1000).toFixed(1) + "k" : String(r.used)) : "—";
  const limitLabel = r.limit != null ? (r.limit >= 1000 ? (r.limit / 1000).toFixed(0) + "k" : String(r.limit)) : null;
  return (
    <Link href={r.href} style={{ textDecoration: "none", flex: 1, minWidth: 52, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      {/* used / limit above bar */}
      <div style={{ fontSize: 12, fontWeight: 700, color: color, lineHeight: 1 }}>
        {isUnlimited ? "∞" : isUntracked ? "—" : usedLabel}
      </div>
      {limitLabel && !isUnlimited && !isUntracked && (
        <div style={{ fontSize: 10, color: "#4b5563", lineHeight: 1 }}>/ {limitLabel}</div>
      )}
      {/* vertical bar — flex grows to fill height */}
      <div style={{ width: "100%", flex: 1, background: "#1f2937", borderRadius: 8, position: "relative", overflow: "hidden", minHeight: 60 }}>
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: (isUntracked ? 0 : pct) + "%",
          background: "linear-gradient(to top, " + color + ", " + color + "99)",
          borderRadius: 8,
          transition: "height 0.7s ease",
          boxShadow: "inset 0 0 0 1px " + color + "44, 0 0 10px " + color + "33",
        }} />
        {!isUntracked && !isUnlimited && pct > 10 && (
          <div style={{ position: "absolute", bottom: 5, left: 0, right: 0, textAlign: "center", fontSize: 10, fontWeight: 700, color: pct > 35 ? "rgba(255,255,255,0.9)" : color }}>
            {Math.round(pct)}%
          </div>
        )}
        {r.atLimit && (
          <div style={{ position: "absolute", top: 4, left: 0, right: 0, textAlign: "center", fontSize: 12 }}>⚠</div>
        )}
      </div>
      {/* label */}
      <div style={{ fontSize: 10, color: "#9ca3af", textAlign: "center", fontWeight: 600, lineHeight: 1.2, textTransform: "uppercase", letterSpacing: 0.3, paddingTop: 2 }}>
        {r.icon} {r.label}
      </div>
      {r.monthly && <div style={{ fontSize: 9, color: "#4b5563", textAlign: "center", lineHeight: 1 }}>monthly</div>}
      {isUnlimited && <div style={{ fontSize: 9, color: "#10b981" }}>Unlimited</div>}
      {isUntracked && <div style={{ fontSize: 9, color: "#4b5563" }}>Soon</div>}
      {r.atLimit && <div style={{ fontSize: 9, color: "#ef4444", fontWeight: 700 }}>⚠ Limit</div>}
    </Link>
  );
}

/* ═══════════════════════════════════════════════════════
   MODULE USAGE SINGLE BAR
   Tall vertical bar (300 px track = 100%) for one nav module.
   Color is exact match of that module's SideNav border colour.
   - Fills from the bottom  →  used / limit
   - At-limit: bar turns red + ⚠ badge
   - Near-limit (≥80%): bar turns amber
   - Unlimited: full-height faint shimmer + ∞ label
   - Untracked (no resourceKey): grey track, "—" label
═══════════════════════════════════════════════════════ */
const BAR_TRACK_H     = 300; // px — identical "100%" height across every bar
const BAR_LABEL_TOP_H = 44;  // fixed zone above track — keeps all bar tops aligned
const BAR_LABEL_BOT_H = 96;  // fixed zone below track — extra height for rotated labels

function ModuleUsageSingleBar({ bar, resource, prevResource }) {
  const isUntracked = !resource || resource.untracked === true;
  const isUnlimited = !isUntracked && resource.limit === null;

  const pct = isUntracked
    ? 0
    : isUnlimited
    ? 100
    : resource.limit > 0 && resource.used !== null
    ? Math.min(100, (resource.used / resource.limit) * 100)
    : 0;

  const isAtLimit   = !isUntracked && !isUnlimited && !!resource?.atLimit;
  const isNearLimit = !isAtLimit && pct >= 80 && !isUnlimited;

  // MODULE COLOUR IS ALWAYS USED — warnings show via border/badge only, NEVER override the fill colour
  const barColor = bar.color;
  const fillPx   = Math.round((pct / 100) * BAR_TRACK_H);

  const prevPct     = prevResource ? (prevResource.limit != null ? Math.min(100, (prevResource.used / prevResource.limit) * 100) : 100) : null;
  const prevMarkerY = prevPct !== null ? Math.round((1 - prevPct / 100) * BAR_TRACK_H) : null;

  const fmt      = (n) => n >= 1000 ? (n / 1000).toFixed(1).replace(".0", "") + "k" : String(n);
  const usedStr  = !isUntracked && resource?.used  != null ? fmt(resource.used)  : null;
  const limitStr = !isUntracked && !isUnlimited && resource?.limit != null ? fmt(resource.limit) : null;

  return (
    <a href={bar.href || "#"} style={{ textDecoration: "none", flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>

      {/* ── TOP LABEL (fixed 44 px) — counts sit flush at the bottom of this zone ── */}
      <div style={{ height: BAR_LABEL_TOP_H, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", paddingBottom: 6, textAlign: "center" }}>
        {isUnlimited ? (
          <span style={{ fontSize: 16, fontWeight: 700, color: barColor }}>∞</span>
        ) : isUntracked ? (
          <span style={{ fontSize: 16, color: "#374151" }}>—</span>
        ) : (
          <>
            <span style={{ fontSize: 16, fontWeight: 700, color: barColor, lineHeight: 1 }}>{usedStr}</span>
            {limitStr && <span style={{ fontSize: 16, color: "#4b5563", lineHeight: 1.3 }}>/{limitStr}</span>}
          </>
        )}
      </div>

      {/* ── BAR TRACK (fixed 300 px) ── */}
      <div style={{
        width: "100%", height: BAR_TRACK_H, flexShrink: 0,
        background: "#151e30", borderRadius: 10, position: "relative", overflow: "hidden",
        border: isAtLimit
          ? "1px solid rgba(239,68,68,0.6)"
          : isNearLimit
          ? "1px solid rgba(245,158,11,0.5)"
          : `1px solid ${barColor}28`,
        boxShadow: isAtLimit ? "0 0 0 2px rgba(239,68,68,0.14)" : "none",
      }}>
        {/* Per-module background glow */}
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at bottom, ${barColor}14 0%, transparent 65%)`, pointerEvents: "none" }} />

        {/* FILL — always the module colour */}
        {!isUntracked && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: fillPx,
            background: isUnlimited
              ? `linear-gradient(to top, ${barColor}70, ${barColor}28)`
              : `linear-gradient(to top, ${barColor}, ${barColor}cc)`,
            borderRadius: 10,
            transition: "height 0.9s cubic-bezier(.4,0,.2,1)",
            boxShadow: `0 0 20px ${barColor}44, inset 0 1px 0 rgba(255,255,255,0.2)`,
          }} />
        )}

        {/* % inside fill when bar is tall enough to read */}
        {!isUntracked && !isUnlimited && pct > 14 && (
          <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, textAlign: "center", fontSize: 16, fontWeight: 700, color: pct > 30 ? "rgba(255,255,255,0.93)" : barColor, pointerEvents: "none" }}>
            {Math.round(pct)}%
          </div>
        )}

        {/* At-limit ⚠ badge at top of fill */}
        {isAtLimit && <div style={{ position: "absolute", top: 8, left: 0, right: 0, textAlign: "center", fontSize: 16, pointerEvents: "none" }}>⚠</div>}
        {/* Previous month reference line */}
        {prevMarkerY !== null && (
          <div style={{ position: "absolute", left: 4, right: 4, top: prevMarkerY, height: 2, background: "rgba(255,255,255,0.35)", borderRadius: 1, pointerEvents: "none", zIndex: 2 }} />
        )}
      </div>

      {/* ── FOOTER — emoji + label rotated -50° for full readability ── */}
      <div style={{ height: BAR_LABEL_BOT_H, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", paddingTop: 6, overflow: "visible" }}>
        <div style={{ fontSize: 13, lineHeight: 1, marginBottom: 5 }}>{bar.emoji}</div>
        <div style={{
          fontSize: 11, fontWeight: 700,
          color: isUnlimited ? "#10b981" : "#9ca3af",
          textTransform: "uppercase", letterSpacing: 0.4, lineHeight: 1,
          whiteSpace: "nowrap",
          transform: "rotate(-50deg)",
          transformOrigin: "top center",
        }}>
          {bar.label}
        </div>
      </div>
    </a>
  );
}

/* ═══════════════════════════════════════════════════════
   MINI STAT CARD — sidebar metric tile
═══════════════════════════════════════════════════════ */
function MiniStatCard({ title, primary, secondary, accent }) {
  return (
    <div style={{ borderRadius: 14, border: "1px solid #1f2937", borderLeft: "3px solid " + accent, padding: "14px 16px", background: "#111827" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: accent, lineHeight: 1, marginBottom: 3 }}>{primary}</div>
      <div style={{ fontSize: 13, color: "#4b5563" }}>{secondary}</div>
    </div>
  );
}
