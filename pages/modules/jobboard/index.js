// /pages/modules/jobboard/index.js
// Job Board — jobs as rows, task columns across the top, stacked sticky notes per cell
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { supabase } from "../../../utils/supabase-client";

// ── Standard task columns ─────────────────────────────────────────────────────
const TASKS = [
  { key: "prelims_payment",     label: "Prelims Payment" },
  { key: "quote_to_client",     label: "Quote to Client" },
  { key: "contracts",           label: "Contracts" },
  { key: "contract_deposit",    label: "Contract Deposit 💰" },
  { key: "bldg_auth_insurance", label: "Bldg Authority Insurance" },
  { key: "lsl",                 label: "LSL (Long Service Levy)" },
  { key: "site_survey",         label: "Site Survey" },
  { key: "soil_tests",          label: "Soil Tests" },
  { key: "design_drafting",     label: "Design / Drafting" },
  { key: "engineering",         label: "Engineering" },
  { key: "council_approval",    label: "Council Approval" },
  { key: "building_permit",     label: "Building Permit" },
  { key: "insurance",           label: "Insurance" },
  { key: "site_prep",           label: "Site Prep" },
  { key: "base_stage_insp",     label: "Slab / Base Inspection" },
  { key: "foundation",          label: "Foundation / Slab" },
  { key: "base_stage_claim",    label: "Base Stage Claim 💰" },
  { key: "frame",               label: "Frame" },
  { key: "frame_stage_insp",    label: "Frame Inspection" },
  { key: "roofing",             label: "Roofing" },
  { key: "rough_plumbing",      label: "Rough Plumbing" },
  { key: "rough_electrical",    label: "Rough Electrical" },
  { key: "insulation",          label: "Insulation" },
  { key: "brickwork",           label: "Brickwork" },
  { key: "frame_stage_claim",   label: "Frame Stage Claim 💰" },
  { key: "windows_doors",       label: "Windows & Doors" },
  { key: "ext_cladding",        label: "Ext. Cladding" },
  { key: "lockup_claim",        label: "Lockup Claim 💰" },
  { key: "gyprock",             label: "Gyprock / Plaster" },
  { key: "fix_plumbing",        label: "Fix Plumbing" },
  { key: "fix_electrical",      label: "Fix Electrical" },
  { key: "tiling",              label: "Tiling" },
  { key: "flooring",            label: "Flooring" },
  { key: "painting",            label: "Painting" },
  { key: "cabinetry",           label: "Cabinetry / Joinery" },
  { key: "fitout",              label: "Fit-Out" },
  { key: "fixout_claim",        label: "Fix Out Claim 💰" },
  { key: "landscaping",         label: "Landscaping" },
  { key: "final_inspection",    label: "Final Inspection" },
  { key: "prac_completion",     label: "Prac. Completion" },
  { key: "prac_comp_claim",     label: "Prac. Completion Claim 💰" },
  { key: "handover",            label: "Handover" },
  { key: "final_payment",       label: "Final Payment 💰" },
];

// ── Note dimensions ────────────────────────────────────────────────────────────
const NOTE_H   = 100;
const NOTE_OFF = 26;
const CELL_H   = NOTE_H + NOTE_OFF * 2 + 8;

// ── Industry templates ─────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    key: "construction_prelims", icon: "📋", label: "Construction – Prelims",
    tasks: [
      { key:"lead_enquiry",       label:"Lead / Enquiry" },
      { key:"site_visit",         label:"Site Visit" },
      { key:"site_survey",        label:"Site Survey" },
      { key:"soil_tests",         label:"Soil Tests" },
      { key:"design_drafting",    label:"Design / Drafting" },
      { key:"engineering",        label:"Engineering" },
      { key:"quote_to_client",    label:"Quote to Client" },
      { key:"quote_accepted",     label:"Quote Accepted" },
      { key:"prelims_payment",    label:"Prelims Payment 💰" },
      { key:"contracts",          label:"Contracts Signed" },
      { key:"contract_deposit",   label:"Contract Deposit 💰" },
      { key:"bldg_auth_insurance",label:"Bldg Authority Insurance" },
      { key:"lsl",                label:"LSL (Long Service Levy)" },
      { key:"council_approval",   label:"Council Approval" },
      { key:"building_permit",    label:"Building Permit" },
      { key:"insurance",          label:"Insurance" },
      { key:"handover_to_build",  label:"Handover to Build Board" },
    ],
  },
  {
    key: "construction_build", icon: "🏗️", label: "Construction – Build",
    tasks: [
      // ── Site & foundations ─────────────────────────────────────────────────
      { key:"site_prep",          label:"Site Prep" },
      { key:"base_stage_insp",    label:"Slab / Base Inspection" },
      { key:"foundation",         label:"Foundation / Slab" },
      { key:"base_stage_claim",   label:"Base Stage Claim 💰" },
      // ── Frame & structure ──────────────────────────────────────────────────
      { key:"frame",              label:"Frame" },
      { key:"frame_stage_insp",   label:"Frame Inspection" },
      { key:"roofing",            label:"Roofing" },
      { key:"rough_plumbing",     label:"Rough Plumbing" },
      { key:"rough_electrical",   label:"Rough Electrical" },
      { key:"insulation",         label:"Insulation" },
      { key:"brickwork",          label:"Brickwork" },
      { key:"frame_stage_claim",  label:"Frame Stage Claim 💰" },
      // ── Lockup ─────────────────────────────────────────────────────────────
      { key:"windows_doors",      label:"Windows & Doors" },
      { key:"ext_cladding",       label:"Ext. Cladding" },
      { key:"lockup_claim",       label:"Lockup Claim 💰" },
      // ── Fix & fit-out ──────────────────────────────────────────────────────
      { key:"gyprock",            label:"Gyprock / Plaster" },
      { key:"fix_plumbing",       label:"Fix Plumbing" },
      { key:"fix_electrical",     label:"Fix Electrical" },
      { key:"tiling",             label:"Tiling" },
      { key:"flooring",           label:"Flooring" },
      { key:"painting",           label:"Painting" },
      { key:"cabinetry",          label:"Cabinetry" },
      { key:"fitout",             label:"Fit-Out" },
      { key:"fixout_claim",       label:"Fix Out Claim 💰" },
      // ── Completion ─────────────────────────────────────────────────────────
      { key:"landscaping",        label:"Landscaping" },
      { key:"final_inspection",   label:"Final Inspection" },
      { key:"prac_completion",    label:"Prac. Completion" },
      { key:"prac_comp_claim",    label:"Prac. Completion Claim 💰" },
      { key:"handover",           label:"Handover" },
      { key:"final_payment",      label:"Final Payment 💰" },
    ],
  },
  {
    key: "real_estate", icon: "🏠", label: "Real Estate",
    tasks: [
      { key:"lead_intake",      label:"Lead Intake" },      { key:"property_appraisal",label:"Appraisal" },
      { key:"listing_agreement",label:"Listing Agreement"}, { key:"photography",      label:"Photography" },
      { key:"marketing",        label:"Marketing" },        { key:"open_homes",       label:"Open Homes" },
      { key:"offers_received",  label:"Offers" },           { key:"negotiation",      label:"Negotiation" },
      { key:"contract_signed",  label:"Contract Signed" },  { key:"building_pest",    label:"B&P Inspection" },
      { key:"finance_approval", label:"Finance Approval" }, { key:"solicitor",        label:"Solicitor / Conveyancer" },
      { key:"settlement_prep",  label:"Settlement Prep" },  { key:"settlement",       label:"Settlement" },
      { key:"handover_keys",    label:"Key Handover" },     { key:"post_sale",        label:"Post-Sale Follow-up" },
    ],
  },
  {
    key: "marketing_agency", icon: "📣", label: "Marketing / Agency",
    tasks: [
      { key:"brief",            label:"Brief" },            { key:"proposal",         label:"Proposal" },
      { key:"contract",         label:"Contract" },         { key:"strategy",         label:"Strategy" },
      { key:"research",         label:"Research" },         { key:"creative_brief",   label:"Creative Brief" },
      { key:"content_creation", label:"Content Creation" }, { key:"design",           label:"Design" },
      { key:"client_review",    label:"Client Review" },    { key:"revisions",        label:"Revisions" },
      { key:"final_approval",   label:"Final Approval" },   { key:"scheduling",       label:"Scheduling" },
      { key:"go_live",          label:"Go Live" },          { key:"reporting",        label:"Reporting" },
      { key:"invoice",          label:"Invoice" },
    ],
  },
  {
    key: "software_dev", icon: "💻", label: "Software Development",
    tasks: [
      { key:"requirements",     label:"Requirements" },     { key:"design_ux",        label:"UX / Design" },
      { key:"backend",          label:"Backend" },          { key:"frontend",         label:"Frontend" },
      { key:"database",         label:"Database" },         { key:"api_integration",  label:"API Integration" },
      { key:"unit_tests",       label:"Unit Tests" },       { key:"qa_testing",       label:"QA Testing" },
      { key:"bug_fixes",        label:"Bug Fixes" },        { key:"staging_deploy",   label:"Staging Deploy" },
      { key:"client_sign_off",  label:"Client Sign-Off" },  { key:"prod_deploy",      label:"Production Deploy" },
      { key:"monitoring",       label:"Monitoring" },       { key:"documentation",    label:"Documentation" },
      { key:"retrospective",    label:"Retrospective" },
    ],
  },
  {
    key: "event_planning", icon: "🎉", label: "Event Planning",
    tasks: [
      { key:"concept",          label:"Concept" },          { key:"venue_search",     label:"Venue Search" },
      { key:"venue_booked",     label:"Venue Booked" },     { key:"budget",           label:"Budget" },
      { key:"catering",         label:"Catering" },         { key:"av_equipment",     label:"AV / Equipment" },
      { key:"invitations",      label:"Invitations" },      { key:"rsvp_management",  label:"RSVP Management" },
      { key:"entertainment",    label:"Entertainment" },    { key:"decorations",      label:"Decorations" },
      { key:"run_sheet",        label:"Run Sheet" },        { key:"logistics",        label:"Logistics" },
      { key:"on_day",           label:"On the Day" },       { key:"pack_down",        label:"Pack Down" },
      { key:"post_event",       label:"Post-Event" },       { key:"invoicing",        label:"Invoicing" },
    ],
  },
  {
    key: "legal", icon: "⚖️", label: "Legal / Law Firm",
    tasks: [
      { key:"intake",           label:"Client Intake" },    { key:"conflict_check",   label:"Conflict Check" },
      { key:"engagement_letter",label:"Engagement Letter"}, { key:"research",         label:"Legal Research" },
      { key:"drafting",         label:"Drafting" },         { key:"client_review",    label:"Client Review" },
      { key:"filing",           label:"Filing / Lodgement"},{ key:"court_prep",       label:"Court Prep" },
      { key:"hearings",         label:"Hearings" },         { key:"negotiations",     label:"Negotiations" },
      { key:"settlement",       label:"Settlement" },       { key:"billing",          label:"Billing" },
      { key:"file_closure",     label:"File Closure" },
    ],
  },
  {
    key: "recruitment", icon: "🧑‍💼", label: "HR / Recruitment",
    tasks: [
      { key:"job_brief",        label:"Job Brief" },        { key:"job_ad",           label:"Job Ad" },
      { key:"applications",     label:"Applications" },     { key:"shortlisting",     label:"Shortlisting" },
      { key:"phone_screen",     label:"Phone Screen" },     { key:"interview_1",      label:"Interview 1" },
      { key:"interview_2",      label:"Interview 2" },      { key:"reference_check",  label:"Reference Check" },
      { key:"offer",            label:"Offer" },            { key:"acceptance",       label:"Acceptance" },
      { key:"contract_sent",    label:"Contract Sent" },    { key:"onboarding",       label:"Onboarding" },
      { key:"probation",        label:"Probation Review" },
    ],
  },
  {
    key: "trade_services", icon: "🔧", label: "Trade Services (Plumbing / Electrical)",
    tasks: [
      { key:"quote_request",    label:"Quote Request" },    { key:"site_visit",       label:"Site Visit" },
      { key:"quote_sent",       label:"Quote Sent" },       { key:"quote_accepted",   label:"Quote Accepted" },
      { key:"materials_order",  label:"Materials Order" },  { key:"scheduling",       label:"Scheduling" },
      { key:"job_start",        label:"Job Start" },        { key:"rough_in",         label:"Rough-In" },
      { key:"inspection",       label:"Inspection" },       { key:"completion",       label:"Completion" },
      { key:"photos",           label:"Photos" },           { key:"invoice_sent",     label:"Invoice Sent" },
      { key:"payment",          label:"Payment" },          { key:"warranty",         label:"Warranty" },
    ],
  },
  {
    key: "ecommerce", icon: "🛒", label: "E-Commerce / Retail",
    tasks: [
      { key:"product_idea",     label:"Product Idea" },     { key:"supplier_sourcing",label:"Supplier Sourcing" },
      { key:"samples",          label:"Samples" },          { key:"listing_prep",     label:"Listing Prep" },
      { key:"photography",      label:"Photography" },      { key:"listing_live",     label:"Listing Live" },
      { key:"ads",              label:"Ads / Marketing" },  { key:"inventory",        label:"Inventory" },
      { key:"order_fulfilment", label:"Order Fulfilment" }, { key:"customer_service", label:"Customer Service" },
      { key:"returns",          label:"Returns" },          { key:"review_campaign",  label:"Review Campaign" },
      { key:"reorder",          label:"Reorder" },
    ],
  },
  {
    key: "landscape", icon: "🌿", label: "Landscaping / Horticulture",
    tasks: [
      { key:"enquiry",          label:"Enquiry" },          { key:"site_measure",     label:"Site Measure" },
      { key:"design",           label:"Design" },           { key:"quote",            label:"Quote" },
      { key:"quote_accepted",   label:"Quote Accepted" },   { key:"materials",        label:"Materials" },
      { key:"demolition",       label:"Demolition" },       { key:"earthworks",       label:"Earthworks" },
      { key:"irrigation",       label:"Irrigation" },       { key:"paving",           label:"Paving / Concrete" },
      { key:"planting",         label:"Planting" },         { key:"turf",             label:"Turf" },
      { key:"fencing",          label:"Fencing" },          { key:"lighting",         label:"Lighting" },
      { key:"final_clean",      label:"Final Clean" },      { key:"invoice",          label:"Invoice" },
    ],
  },
  {
    key: "healthcare", icon: "🏥", label: "Healthcare / Allied Health",
    tasks: [
      { key:"referral",         label:"Referral" },         { key:"intake",           label:"Intake" },
      { key:"initial_consult",  label:"Initial Consult" },  { key:"assessment",       label:"Assessment" },
      { key:"treatment_plan",   label:"Treatment Plan" },   { key:"treatment",        label:"Treatment" },
      { key:"progress_review",  label:"Progress Review" },  { key:"specialist_ref",   label:"Specialist Referral" },
      { key:"tests",            label:"Tests / Imaging" },  { key:"results",          label:"Results Review" },
      { key:"discharge",        label:"Discharge Plan" },   { key:"follow_up",        label:"Follow-Up" },
      { key:"billing",          label:"Billing / Claim" },
    ],
  },
  {
    key: "architecture", icon: "📐", label: "Architecture / Design",
    tasks: [
      { key:"brief",            label:"Client Brief" },     { key:"feasibility",      label:"Feasibility" },
      { key:"concept_design",   label:"Concept Design" },   { key:"client_approval",  label:"Client Approval" },
      { key:"design_dev",       label:"Design Development"},{ key:"documentation",    label:"Documentation" },
      { key:"planning_permit",  label:"Planning Permit" },  { key:"building_permit",  label:"Building Permit" },
      { key:"tender",           label:"Tender" },           { key:"construction",     label:"Construction" },
      { key:"site_visits",      label:"Site Visits" },      { key:"practical_comp",   label:"Practical Completion" },
      { key:"defects",          label:"Defects" },          { key:"final_cert",       label:"Final Certificate" },
    ],
  },
  {
    key: "education", icon: "🎓", label: "Education / Training",
    tasks: [
      { key:"course_design",    label:"Course Design" },    { key:"content",          label:"Content Creation" },
      { key:"enrolment",        label:"Enrolment" },        { key:"delivery",         label:"Delivery" },
      { key:"assessments",      label:"Assessments" },      { key:"marking",          label:"Marking" },
      { key:"feedback",         label:"Feedback" },         { key:"certification",    label:"Certification" },
      { key:"follow_up",        label:"Follow-Up" },        { key:"review",           label:"Course Review" },
    ],
  },
];


// ── Colours per level ──────────────────────────────────────────────────────────
// Auto-assigned header backgrounds — one per column, cycles if more than 20
const COL_AUTO_BG = [
  "#2563eb","#7c3aed","#059669","#dc2626","#d97706",
  "#0891b2","#db2777","#65a30d","#9333ea","#0284c7",
  "#b45309","#16a34a","#6d28d9","#be185d","#0f766e",
  "#b91c1c","#1d4ed8","#15803d","#a21caf","#0369a1",
];

const LVL = {
  todo:        { bg: "#60a5fa", top: "#1d4ed8", text: "#172554", label: "To Do",        noteField: "note_blue"   },
  in_progress: { bg: "#fbbf24", top: "#b45309", text: "#451a03", label: "In Progress",   noteField: "note_yellow" },
  quote:       { bg: "#c084fc", top: "#7e22ce", text: "#3b0764", label: "Quote 💰",      noteField: "note_purple" },
  revision:    { bg: "#fb923c", top: "#c2410c", text: "#431407", label: "Revision ✏️",   noteField: "note_orange" },
  ordered:     { bg: "#f87171", top: "#b91c1c", text: "#450a0a", label: "Ordered 📋",    noteField: "note_red"    },
  done:        { bg: "#34d399", top: "#047857", text: "#022c22", label: "Done ✓",         noteField: "note_green"  },
};

// Derive ordered list of active cards from a DB record
const getCardOrder = (rec) => {
  if (rec?.card_order) return rec.card_order.split(",").filter((k) => LVL[k]);
  const s = rec?.status || "none";
  if (s === "todo")        return ["todo"];
  if (s === "in_progress") return ["todo", "in_progress"];
  if (s === "done")        return ["todo", "in_progress", "done"];
  return [];
};

// Compute legacy status from card order (kept for backward compat)
const computeStatus = (order) => {
  if (order.includes("done"))        return "done";
  if (order.includes("in_progress")) return "in_progress";
  if (order.includes("todo"))        return "todo";
  return "none";
};

// ── Single cell with stacked sticky notes ─────────────────────────────────────
function NoteCell({ rec, onOpen }) {
  const order = getCardOrder(rec);

  if (order.length === 0) {
    return (
      <div style={{ height: CELL_H, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="add-btn" style={N.addBtn} onClick={() => onOpen("todo")}>+</div>
      </div>
    );
  }

  const containerH = NOTE_H + NOTE_OFF * (order.length - 1) + 12;
  return (
    <div style={{ position: "relative", height: containerH }}>
      {order.map((lvlKey, idx) => {
        const l = LVL[lvlKey];
        if (!l) return null;
        const snippet = rec?.[l.noteField];
        return (
          <div
            key={lvlKey}
            className="note-hover"
            style={{ ...N.note, background: l.bg, borderTopColor: l.top, top: NOTE_OFF * idx, zIndex: idx + 1 }}
            onClick={() => onOpen(lvlKey)}
          >
            <span style={{ ...N.tag, color: l.text }}>{l.label}</span>
            {snippet && <p style={N.snip}>{snippet.slice(0, 55)}{snippet.length > 55 ? "…" : ""}</p>}
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function JobBoard() {
  const [user, setUser]         = useState(null);
  const [jobs, setJobs]         = useState([]);
  const [taskMap, setTaskMap]   = useState({}); // { jobId: { taskKey: record } }
  const [loading, setLoading]   = useState(true);

  // Popup state
  const [popup, setPopup]       = useState(null); // { job, task, level, rec }
  const [popText, setPopText]   = useState("");
  const [saving, setSaving]     = useState(false);

  // New job modal
  const [showNew, setShowNew]   = useState(false);
  const [newForm, setNewForm]   = useState({ name: "", client: "", address: "", notes: "" });

  // Edit job modal
  const [editJob, setEditJob]   = useState(null);
  const [editForm, setEditForm] = useState({});

  // Column header customisation (persisted in localStorage)
  const [colSettings, setColSettings] = useState({});
  const [editCol, setEditCol]         = useState(null);
  const [colForm, setColForm]         = useState({});

  // Boards (each board = its own column set + jobs)
  const [boards, setBoards]             = useState([]);
  const [activeBoardId, setActiveBoardId] = useState(() => {
    try { return localStorage.getItem("jobboard_active_board") || null; } catch { return null; }
  });
  const [showNewBoard, setShowNewBoard]   = useState(false);
  const [newBoardForm, setNewBoardForm]   = useState({ name: "", templateKey: "" });
  const [showAddCol, setShowAddCol]       = useState(false);
  const [addColName, setAddColName]       = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  // Column drag-and-drop reordering
  const [dragColKey, setDragColKey]   = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);

  // Pan-to-scroll (grab-drag on board body)
  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef  = useRef(false);
  const panStartXRef  = useRef(0);
  const panScrollLeft = useRef(0);
  const boardScrollRef = useRef(null);

  // Card automations (work-order emails per task + card type)
  const [automations, setAutomations]       = useState([]);
  const [workOrderModal, setWorkOrderModal] = useState(null); // { to, subject, body, job_name, task_name }
  const [autoEditKey, setAutoEditKey]       = useState(null); // { task_key, card_level } being configured
  const [autoForm, setAutoForm]             = useState({});   // { email_to, email_subject, email_body, enabled }

  useEffect(() => {
    try { const s = localStorage.getItem("jobboard_cols"); if (s) setColSettings(JSON.parse(s)); } catch (e) {}
  }, []);

  const getColLabel = (t)       => colSettings[t.key]?.label   || t.label;
  const getColBg    = (t, idx)  => colSettings[t.key]?.bgColor || COL_AUTO_BG[(idx ?? 0) % COL_AUTO_BG.length];
  const getColColor = (t)       => colSettings[t.key]?.txtColor || "#f1f5f9";
  const getColFs    = (t)       => colSettings[t.key]?.fontSize || 16;

  const saveColSettings = () => {
    const updated = { ...colSettings, [editCol.key]: { label: colForm.label, bgColor: colForm.bgColor, txtColor: colForm.txtColor, fontSize: colForm.fontSize } };
    setColSettings(updated);
    try { localStorage.setItem("jobboard_cols", JSON.stringify(updated)); } catch (e) {}
    setEditCol(null);
  };

  const resetColSettings = (key) => {
    const updated = { ...colSettings };
    delete updated[key];
    setColSettings(updated);
    try { localStorage.setItem("jobboard_cols", JSON.stringify(updated)); } catch (e) {}
    setEditCol(null);
  };

  const saveTaskList = (list) => {
    if (!activeBoardId) return;
    setBoards((prev) => prev.map((b) => b.id === activeBoardId ? { ...b, task_list: list } : b));
    supabase.from("job_board_boards").update({ task_list: list }).eq("id", activeBoardId).then(() => {});
  };

  // Drag-and-drop column reorder
  const dropColumn = (targetKey) => {
    if (!dragColKey || dragColKey === targetKey) return;
    const from = taskList.findIndex((c) => c.key === dragColKey);
    const to   = taskList.findIndex((c) => c.key === targetKey);
    if (from === -1 || to === -1) return;
    const next = [...taskList];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    saveTaskList(next);
    setDragColKey(null);
    setDragOverKey(null);
  };

  // Grab-to-pan horizontal scroll
  const handleBoardMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    if (e.target.closest("th, button, input, textarea, a, select")) return;
    isPanningRef.current  = true;
    setIsPanning(true);
    panStartXRef.current  = e.clientX;
    panScrollLeft.current = boardScrollRef.current?.scrollLeft || 0;
    e.preventDefault();
  }, []);

  const handleBoardMouseMove = useCallback((e) => {
    if (!isPanningRef.current || !boardScrollRef.current) return;
    boardScrollRef.current.scrollLeft = panScrollLeft.current - (e.clientX - panStartXRef.current);
  }, []);

  const handleBoardMouseUp = useCallback(() => {
    if (!isPanningRef.current) return;
    isPanningRef.current = false;
    setIsPanning(false);
  }, []);

  const addColumn = () => {
    const name = addColName.trim();
    if (!name) return;
    saveTaskList([...taskList, { key: "col_" + Date.now(), label: name }]);
    setShowAddCol(false);
    setAddColName("");
  };

  const deleteColumn = (key) => {
    if (!confirm("Remove this column from the board? Existing notes are kept in the database.")) return;
    saveTaskList(taskList.filter((t) => t.key !== key));
    setEditCol(null);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) setUser(user); });
  }, []);

  useEffect(() => { if (user) { load(); loadBoards(); loadAutomations(); } }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: jobsData, error } = await supabase
      .from("job_board_jobs")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) { alert("Error loading jobs: " + error.message); setLoading(false); return; }
    const js = jobsData || [];
    setJobs(js);

    if (js.length) {
      const { data: taskData } = await supabase
        .from("job_board_tasks")
        .select("*")
        .in("job_id", js.map((j) => j.id));

      const map = {};
      for (const j of js) {
        map[j.id] = {};
      }
      for (const rec of taskData || []) {
        if (map[rec.job_id]) map[rec.job_id][rec.task_key] = rec;
      }
      setTaskMap(map);
    }

    setLoading(false);
  }, [user]);

  // ── Load + manage boards ──────────────────────────────────────────────────
  const loadBoards = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("job_board_boards").select("*").eq("user_id", user.id).order("sort_order", { ascending: true });
    const list = data || [];

    // First-time migration: create a "General" board and assign existing boardless jobs to it
    if (list.length === 0) {
      const stored = (() => { try { const s = localStorage.getItem("jobboard_task_list"); return s ? JSON.parse(s) : TASKS; } catch { return TASKS; } })();
      const { data: newBoard } = await supabase.from("job_board_boards").insert({ user_id: user.id, name: "General", task_list: stored, sort_order: 0 }).select().single();
      if (newBoard) {
        await supabase.from("job_board_jobs").update({ board_id: newBoard.id }).eq("user_id", user.id).is("board_id", null);
        setBoards([newBoard]);
        setActiveBoardId(newBoard.id);
        localStorage.setItem("jobboard_active_board", newBoard.id);
        // Reload jobs so they have board_id set
        load();
      }
      return;
    }

    setBoards(list);
    setActiveBoardId((prev) => {
      const exists = list.find((b) => b.id === prev);
      const id = exists ? prev : list[0].id;
      localStorage.setItem("jobboard_active_board", id);
      return id;
    });
  }, [user]);

  const createBoard = async () => {
    const name = newBoardForm.name.trim();
    if (!name) return;
    const tpl = TEMPLATES.find((t) => t.key === newBoardForm.templateKey);
    const task_list = tpl ? tpl.tasks : TASKS;
    const { data } = await supabase.from("job_board_boards").insert({ user_id: user.id, name, task_list, sort_order: boards.length }).select().single();
    if (data) {
      setBoards((prev) => [...prev, data]);
      setActiveBoardId(data.id);
      localStorage.setItem("jobboard_active_board", data.id);
    }
    setShowNewBoard(false);
    setNewBoardForm({ name: "", templateKey: "" });
  };

  const deleteBoard = async (boardId) => {
    if (boards.length <= 1) { alert("You need at least one board."); return; }
    if (!confirm("Delete this board? Jobs in it will be unassigned but not deleted.")) return;
    await supabase.from("job_board_boards").delete().eq("id", boardId);
    const remaining = boards.filter((b) => b.id !== boardId);
    setBoards(remaining);
    if (activeBoardId === boardId) {
      const next = remaining[0].id;
      setActiveBoardId(next);
      localStorage.setItem("jobboard_active_board", next);
    }
  };

  const renameBoard = async (boardId, name) => {
    await supabase.from("job_board_boards").update({ name }).eq("id", boardId);
    setBoards((prev) => prev.map((b) => b.id === boardId ? { ...b, name } : b));
  };

  // ── Load + save automations ───────────────────────────────────────────────
  const loadAutomations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("job_board_automations").select("*").eq("user_id", user.id);
    setAutomations(data || []);
  }, [user]);

  const saveAutomation = async (task_key, card_level, fields) => {
    const row = { user_id: user.id, task_key, card_level, ...fields };
    const { data } = await supabase.from("job_board_automations").upsert(row, { onConflict: "user_id,task_key,card_level" }).select().single();
    if (data) setAutomations((prev) => {
      const others = prev.filter((a) => !(a.task_key === task_key && a.card_level === card_level));
      return [...others, data];
    });
  };

  const deleteAutomation = async (task_key, card_level) => {
    await supabase.from("job_board_automations").delete().eq("user_id", user.id).eq("task_key", task_key).eq("card_level", card_level);
    setAutomations((prev) => prev.filter((a) => !(a.task_key === task_key && a.card_level === card_level)));
  };

  const getAutomation = (task_key, card_level) =>
    automations.find((a) => a.task_key === task_key && a.card_level === card_level && a.enabled);

  const fillTemplate = (text, job, task) =>
    String(text || "")
      .replace(/\{\{job_name\}\}/g, job?.name || "")
      .replace(/\{\{client\}\}/g, job?.client || "")
      .replace(/\{\{address\}\}/g, job?.address || "")
      .replace(/\{\{task_name\}\}/g, task?.label || "");

  // ── Open popup for a cell + level ─────────────────────────────────────────
  const openPopup = (job, task, level, rec) => {
    setPopup({ job, task, level, rec });
    setPopText(rec?.[LVL[level]?.noteField] || "");
  };

  // ── Save notes for current level ──────────────────────────────────────────
  const saveNotes = async () => {
    if (!popup) return;
    setSaving(true);
    const { job, task, level, rec } = popup;
    const noteField    = LVL[level].noteField;
    const currentOrder = getCardOrder(rec);
    const newOrder     = currentOrder.includes(level) ? currentOrder : [...currentOrder, level];

    const payload = { job_id: job.id, task_key: task.key, [noteField]: popText, status: computeStatus(newOrder), card_order: newOrder.join(",") };
    let saved;
    if (rec?.id) {
      const { data } = await supabase.from("job_board_tasks").update(payload).eq("id", rec.id).select().single();
      saved = data;
    } else {
      const { data } = await supabase.from("job_board_tasks").insert(payload).select().single();
      saved = data;
    }
    if (saved) {
      setTaskMap((prev) => ({
        ...prev,
        [job.id]: { ...prev[job.id], [task.key]: saved },
      }));
      // Trigger automation only when adding this card type for the first time
      const wasNew = !rec?.id || !currentOrder.includes(level);
      if (wasNew) {
        const auto = getAutomation(task.key, level);
        if (auto) {
          setWorkOrderModal({
            to:        fillTemplate(auto.email_to,      job, task),
            subject:   fillTemplate(auto.email_subject, job, task),
            body:      fillTemplate(auto.email_body,    job, task),
            job_name:  job.name,
            task_name: task.label,
          });
        }
      }
    }
    setSaving(false);
    setPopup(null);
  };

  // ── Advance to next level ─────────────────────────────────────────────────
  const advance = async () => {
    if (!popup) return;
    setSaving(true);
    const { job, task, level, rec } = popup;

    const noteField    = LVL[level].noteField;
    const nextLevel    = level === "todo" ? "in_progress" : "done";
    const currentOrder = getCardOrder(rec);
    let newOrder;
    if (currentOrder.includes(nextLevel)) {
      newOrder = currentOrder;
    } else {
      newOrder = [...currentOrder];
      newOrder.splice(currentOrder.indexOf(level) + 1, 0, nextLevel);
    }
    const payload = {
      job_id: job.id, task_key: task.key,
      [noteField]: popText,
      status: computeStatus(newOrder),
      card_order: newOrder.join(","),
    };
    let saved;
    if (rec?.id) {
      const { data } = await supabase.from("job_board_tasks").update(payload).eq("id", rec.id).select().single();
      saved = data;
    } else {
      const { data } = await supabase.from("job_board_tasks").insert(payload).select().single();
      saved = data;
    }
    if (saved) setTaskMap((prev) => ({ ...prev, [job.id]: { ...prev[job.id], [task.key]: saved } }));
    setSaving(false);
    setPopup(null);
  };

  // ── Remove a specific note level ────────────────────────────────────────────
  const removeLevel = async () => {
    if (!popup) return;
    const { job, task, level, rec } = popup;
    const currentOrder = getCardOrder(rec);
    const newOrder     = currentOrder.filter((k) => k !== level);
    const payload = {
      status: computeStatus(newOrder),
      [LVL[level].noteField]: null,
      card_order: newOrder.length ? newOrder.join(",") : null,
    };
    setSaving(true);
    if (rec?.id) {
      await supabase.from("job_board_tasks").update(payload).eq("id", rec.id);
      setTaskMap((prev) => ({ ...prev, [job.id]: { ...prev[job.id], [task.key]: { ...rec, ...payload } } }));
    }
    setSaving(false);
    setPopup(null);
  };

  // ── Clear a cell entirely ─────────────────────────────────────────────────
  const clearCell = async () => {
    if (!popup || !popup.rec?.id) { setPopup(null); return; }
    if (!confirm("Remove all notes from this cell?")) return;
    setSaving(true);
    const blank = { status: "none", note_blue: null, note_yellow: null, note_green: null, note_purple: null, note_orange: null, note_red: null, card_order: null };
    await supabase.from("job_board_tasks").update(blank).eq("id", popup.rec.id);
    setTaskMap((prev) => ({
      ...prev,
      [popup.job.id]: { ...prev[popup.job.id], [popup.task.key]: { ...popup.rec, ...blank } },
    }));
    setSaving(false);
    setPopup(null);
  };

  // ── Reorder a card within the cell ──────────────────────────────────
  const reorderCard = async (dir) => {
    if (!popup) return;
    const { job, task, level, rec } = popup;
    const order = getCardOrder(rec);
    const idx   = order.indexOf(level);
    if (dir === "back" && idx <= 0) return;
    if (dir === "fwd"  && idx >= order.length - 1) return;
    const newOrder = [...order];
    const swapWith = dir === "back" ? idx - 1 : idx + 1;
    [newOrder[idx], newOrder[swapWith]] = [newOrder[swapWith], newOrder[idx]];
    const payload = { card_order: newOrder.join(",") };
    setSaving(true);
    await supabase.from("job_board_tasks").update(payload).eq("id", rec.id);
    const newRec = { ...rec, card_order: newOrder.join(",") };
    setTaskMap((prev) => ({ ...prev, [job.id]: { ...prev[job.id], [task.key]: newRec } }));
    setPopup((p) => ({ ...p, rec: newRec }));
    setSaving(false);
  };

  // ── Add an extra card type to a cell ────────────────────────────────
  const addExtraCard = async (lvlKey) => {
    if (!popup) return;
    const { job, task, rec } = popup;
    const currentOrder = getCardOrder(rec);
    const newOrder     = [...currentOrder, lvlKey];
    const payload      = { job_id: job.id, task_key: task.key, status: computeStatus(newOrder), card_order: newOrder.join(",") };
    setSaving(true);
    let saved;
    if (rec?.id) {
      const { data, error } = await supabase.from("job_board_tasks").update(payload).eq("id", rec.id).select().single();
      if (error) { alert("Error adding card: " + error.message); setSaving(false); return; }
      saved = data;
    } else {
      const { data, error } = await supabase.from("job_board_tasks").insert(payload).select().single();
      if (error) { alert("Error adding card: " + error.message); setSaving(false); return; }
      saved = data;
    }
    if (saved) {
      setTaskMap((prev) => ({ ...prev, [job.id]: { ...prev[job.id], [task.key]: saved } }));
      setPopup((p) => ({ ...p, level: lvlKey, rec: saved }));
      setPopText("");
      // Check for work-order automation
      const auto = getAutomation(task.key, lvlKey);
      if (auto) {
        setWorkOrderModal({
          to:        fillTemplate(auto.email_to,      job, task),
          subject:   fillTemplate(auto.email_subject, job, task),
          body:      fillTemplate(auto.email_body,    job, task),
          job_name:  job.name,
          task_name: task.label,
        });
      }
    }
    setSaving(false);
  };

  // ── Create new job ────────────────────────────────────────────────────────
  const createJob = async () => {
    if (!newForm.name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("job_board_jobs")
      .insert({ name: newForm.name, client: newForm.client, address: newForm.address, notes: newForm.notes, user_id: user.id, sort_order: jobs.length, board_id: activeBoardId })
      .select().single();
    if (error) { alert(error.message); setSaving(false); return; }
    setJobs((prev) => [...prev, data]);
    setTaskMap((prev) => {
      const init = {};
      taskList.forEach((t) => { init[t.key] = null; });
      return { ...prev, [data.id]: init };
    });
    setSaving(false);
    setShowNew(false);
    setNewForm({ name: "", client: "", address: "", notes: "" });
  };

  // ── Save edited job ───────────────────────────────────────────────────────
  const saveEdit = async () => {
    if (!editJob) return;
    setSaving(true);
    const { error } = await supabase.from("job_board_jobs").update(editForm).eq("id", editJob.id);
    if (error) { alert(error.message); setSaving(false); return; }
    setJobs((prev) => prev.map((j) => j.id === editJob.id ? { ...j, ...editForm } : j));
    setSaving(false);
    setEditJob(null);
  };

  const deleteJob = async (jobId) => {
    if (!confirm("Delete this job and all its notes?")) return;
    await supabase.from("job_board_jobs").delete().eq("id", jobId);
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    setEditJob(null);
  };

  // ── Derived: active board's columns + jobs ────────────────────────────────
  const taskList    = boards.find((b) => b.id === activeBoardId)?.task_list || TASKS;
  const visibleJobs = jobs.filter((j) => j.board_id === activeBoardId);

  // ── Derived stats (count each card type across ALL boards) ────────────────
  const stats = { todo: 0, in_progress: 0, quote: 0, revision: 0, ordered: 0, done: 0 };
  for (const j of jobs) {
    const jBoard    = boards.find((b) => b.id === j.board_id);
    const jTaskList = Array.isArray(jBoard?.task_list) && jBoard.task_list.length ? jBoard.task_list : TASKS;
    for (const t of jTaskList) {
      const rec = taskMap[j.id]?.[t.key];
      for (const lvlKey of getCardOrder(rec)) {
        if (stats[lvlKey] !== undefined) stats[lvlKey]++;
      }
    }
  }

  // ── Popup helpers ─────────────────────────────────────────────────────────
  const popLevel       = popup ? LVL[popup.level] : null;
  const popCardOrder   = popup ? getCardOrder(popup.rec) : [];
  const popIdx         = popup ? popCardOrder.indexOf(popup.level) : -1;
  const canMoveBack    = popIdx > 0;
  const canMoveFwd     = popIdx >= 0 && popIdx < popCardOrder.length - 1;
  const canAdvance     = popup && (
    (popup.level === "todo" && !popCardOrder.includes("in_progress")) ||
    (popup.level === "in_progress" && !popCardOrder.includes("done"))
  );
  const nextLevelLabel = popup?.level === "todo" ? "In Progress" : "Done";
  const missingExtras  = popup ? Object.keys(LVL).filter((k) => !popCardOrder.includes(k)) : [];

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) return (
    <div style={P.page}>
      <div style={P.loadWrap}><div style={P.spinner} /></div>
    </div>
  );

  return (
    <div style={P.page}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .add-btn { opacity: 0; transition: opacity 0.15s; }
        td:hover .add-btn { opacity: 1; }
        .job-row:hover td:first-child { background: #1a2236 !important; }
        .note-hover:hover { transform: translateY(-1px); box-shadow: 3px 5px 12px rgba(0,0,0,0.4) !important; }
      `}</style>

      {/* ── Banner ── */}
      <div style={P.banner}>
        <div style={P.bannerLeft}>
          <span style={P.bannerIcon}>🗂️</span>
          <div>
            <h1 style={P.bannerTitle}>Job Board</h1>
            <p style={P.bannerDesc}>
              {jobs.length} job{jobs.length !== 1 ? "s" : ""}
              &nbsp;·&nbsp;
              <span style={{ color: "#fde68a" }}>🔵 {stats.todo} to do</span>
              &nbsp;·&nbsp;
              <span style={{ color: "#fde68a" }}>🟡 {stats.in_progress} in progress</span>
              &nbsp;·&nbsp;
              <span style={{ color: "#fde68a" }}>🟣 {stats.quote} quotes</span>
              &nbsp;·&nbsp;
              <span style={{ color: "#fde68a" }}>🟠 {stats.revision} revisions</span>
              &nbsp;·&nbsp;
              <span style={{ color: "#fde68a" }}>🟢 {stats.done} done</span>
            </p>
          </div>
        </div>
        <Link href="/modules/construction">
          <button style={P.backBtn}>← Back</button>
        </Link>
      </div>

      {/* ── Controls bar ── */}
      <div style={P.controlsBar}>
        <button style={{ ...P.addBtn, background: "#1e3a5f" }} onClick={() => setShowTemplates(true)}>📋 Templates</button>
        <button style={P.addBtn} onClick={() => setShowNew(true)}>+ New Job</button>
      </div>

      {/* ── Board Tabs ── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        {boards.map((b) => {
          const isActive = b.id === activeBoardId;
          return (
            <div key={b.id} style={{ display: "flex", alignItems: "center", background: isActive ? "#1e3a8a" : "#0d1424", border: `1px solid ${isActive ? "#3b82f6" : "#2d3f58"}`, borderRadius: 8, overflow: "hidden" }}>
              <button
                style={{ padding: "8px 16px", fontSize: 16, fontWeight: isActive ? 600 : 400, color: isActive ? "#fff" : "#94a3b8", background: "none", border: "none", cursor: "pointer" }}
                onClick={() => { setActiveBoardId(b.id); localStorage.setItem("jobboard_active_board", b.id); }}
              >{b.name}</button>
              {isActive && boards.length > 1 && (
                <button onClick={() => deleteBoard(b.id)} style={{ padding: "4px 8px", fontSize: 16, color: "#64748b", background: "none", border: "none", borderLeft: "1px solid #2d3f58", cursor: "pointer" }} title="Delete board">✕</button>
              )}
            </div>
          );
        })}
        <button onClick={() => setShowNewBoard(true)}
          style={{ padding: "8px 14px", fontSize: 16, color: "#6366f1", background: "none", border: "1px dashed #334155", borderRadius: 8, cursor: "pointer" }}>
          + New Board
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setShowAddCol(true)}
          style={{ padding: "8px 16px", fontSize: 16, fontWeight: 600, color: "#fff", background: "#0f4c2a", border: "1px solid #16a34a", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" }}
          title="Add a new column to this board">
          + Add Column
        </button>
      </div>

      {/* ── All Boards stacked ── */}
      <div
        ref={boardScrollRef}
        style={{ ...P.boardWrap, overflowX: "auto", overflowY: "auto", cursor: isPanning ? "grabbing" : "grab", userSelect: "none" }}
        onMouseDown={handleBoardMouseDown}
        onMouseMove={handleBoardMouseMove}
        onMouseUp={handleBoardMouseUp}
        onMouseLeave={handleBoardMouseUp}
      >
        <div>
          {boards.map((board, boardIdx) => {
            const bTaskList = Array.isArray(board.task_list) && board.task_list.length ? board.task_list : TASKS;
            const bJobs     = jobs.filter((j) => j.board_id === board.id);
            const isActive  = board.id === activeBoardId;
            return (
              <div key={board.id} style={{ marginBottom: boardIdx < boards.length - 1 ? 64 : 0 }}>
                {/* Board section header — only shown when multiple boards exist */}
                {boards.length > 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, paddingBottom: 12, borderBottom: "2px solid #1e2d45" }}>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: isActive ? "#93c5fd" : "#cbd5e1", letterSpacing: -0.3 }}>{board.name}</h2>
                    <span style={{ fontSize: 16, color: "#475569" }}>{bJobs.length} job{bJobs.length !== 1 ? "s" : ""}</span>
                    {isActive
                      ? <span style={{ fontSize: 16, color: "#3b82f6", padding: "2px 10px", background: "rgba(59,130,246,0.1)", borderRadius: 6, border: "1px solid #1d4ed8" }}>● Active — new jobs go here</span>
                      : <button onClick={() => { setActiveBoardId(board.id); localStorage.setItem("jobboard_active_board", board.id); }} style={{ fontSize: 16, padding: "3px 12px", color: "#6366f1", background: "none", border: "1px solid #334155", borderRadius: 6, cursor: "pointer" }} title="New jobs + Add Column will target this board">Set Active</button>
                    }
                    {boards.length > 1 && (
                      <button onClick={() => deleteBoard(board.id)} style={{ marginLeft: "auto", fontSize: 16, padding: "3px 10px", color: "#64748b", background: "none", border: "1px solid #1e293b", borderRadius: 6, cursor: "pointer" }} title="Delete this board">Delete board</button>
                    )}
                  </div>
                )}

                {bJobs.length === 0 ? (
                  <div style={{ ...P.empty, marginTop: 0 }}>No jobs yet — {boards.length > 1 ? "set this board active then " : ""}click "+ New Job" to add your first job.</div>
                ) : (
                  <table style={P.table}>
                    <thead>
                      <tr>
                        <th style={P.cornerTh}>Job</th>
                        {bTaskList.map((t, idx) => (
                          <th
                            key={t.key}
                            draggable
                            onDragStart={() => { setActiveBoardId(board.id); localStorage.setItem("jobboard_active_board", board.id); setDragColKey(t.key); }}
                            onDragOver={(e) => { e.preventDefault(); setDragOverKey(t.key); }}
                            onDrop={() => {
                              if (!dragColKey || dragColKey === t.key) return;
                              const list = [...bTaskList];
                              const fromIdx = list.findIndex((c) => c.key === dragColKey);
                              const toIdx   = list.findIndex((c) => c.key === t.key);
                              if (fromIdx === -1 || toIdx === -1) return;
                              const [moved] = list.splice(fromIdx, 1);
                              list.splice(toIdx, 0, moved);
                              setBoards((prev) => prev.map((b) => b.id === board.id ? { ...b, task_list: list } : b));
                              supabase.from("job_board_boards").update({ task_list: list }).eq("id", board.id).then(() => {});
                              setDragColKey(null);
                              setDragOverKey(null);
                            }}
                            onDragEnd={() => { setDragColKey(null); setDragOverKey(null); }}
                            style={{
                              ...P.taskTh,
                              background: getColBg(t, idx),
                              color: getColColor(t),
                              fontSize: getColFs(t),
                              cursor: dragColKey ? "grabbing" : "grab",
                              opacity: dragColKey === t.key ? 0.45 : 1,
                              outline: dragOverKey === t.key && dragColKey !== t.key ? "2px dashed #ffffff80" : "none",
                              transition: "opacity 0.15s",
                            }}
                            onClick={() => { setActiveBoardId(board.id); localStorage.setItem("jobboard_active_board", board.id); setEditCol({ key: t.key }); setColForm({ label: getColLabel(t), bgColor: getColBg(t, idx), txtColor: getColColor(t), fontSize: getColFs(t) }); }}
                            title="Drag to reorder · Click to customise"
                          >
                            {getColLabel(t)}
                            <span style={{ display: "block", fontSize: 16, opacity: 0.45, marginTop: 2 }}>⠿ drag · ✏️ edit</span>
                          </th>
                        ))}
                        <th style={{ ...P.taskTh, width: 60, minWidth: 60, cursor: "pointer", background: "#0d1424" }} onClick={() => { setActiveBoardId(board.id); localStorage.setItem("jobboard_active_board", board.id); setShowAddCol(true); }}>+ col</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bJobs.map((job) => {
                        const allDone   = bTaskList.every((t) => { const s = taskMap[job.id]?.[t.key]?.status || "none"; return s === "done" || s === "none"; });
                        const anyActive = bTaskList.some((t)  => { const s = taskMap[job.id]?.[t.key]?.status || "none"; return s !== "none"; });
                        return (
                          <tr key={job.id} className="job-row">
                            <td style={{ ...P.jobCell, background: allDone && anyActive ? "rgba(34,197,94,0.06)" : "#161d2e" }}>
                              <div style={P.jobName}>{job.name}</div>
                              {job.client  && <div style={P.jobClient}>{job.client}</div>}
                              {job.address && <div style={P.jobAddr}>{job.address}</div>}
                              <button style={P.editBtn} onClick={() => { setEditJob(job); setEditForm({ name: job.name, client: job.client || "", address: job.address || "", notes: job.notes || "" }); }}>✏️</button>
                            </td>
                            {bTaskList.map((task) => {
                              const rec = taskMap[job.id]?.[task.key] || null;
                              return (
                                <td key={task.key} style={P.taskCell}>
                                  <NoteCell rec={rec} onOpen={(level) => openPopup(job, task, level, rec)} />
                                </td>
                              );
                            })}
                            <td style={{ ...P.taskCell, width: 60, minWidth: 60 }} />
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          Note popup
      ══════════════════════════════════════════════════ */}
      {popup && (
        <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && setPopup(null)}>
          <div style={M.box}>
            {/* Header badge */}
            <div style={{ ...M.badge, background: popLevel.bg, borderLeft: `4px solid ${popLevel.top}` }}>
              <span style={{ ...M.badgeLabel, color: popLevel.text }}>{popLevel.label}</span>
              <span style={M.badgeSub}> — {popup.task.label}</span>
            </div>

            <div style={M.jobLine}>{popup.job.name}{popup.job.client ? ` / ${popup.job.client}` : ""}</div>

            <label style={M.lbl}>Notes</label>
            <textarea
              style={M.ta}
              value={popText}
              onChange={(e) => setPopText(e.target.value)}
              placeholder={`Add notes for "${popup.task.label}"…`}
              rows={5}
              autoFocus
            />

            {/* Reorder position */}
            {popCardOrder.length > 1 && (
              <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
                <span style={{ color: "#94a3b8", fontSize: 16 }}>Position:</span>
                <button style={{ ...M.btnCancel, padding: "6px 12px", fontSize: 16 }} onClick={() => reorderCard("back")} disabled={!canMoveBack || saving}>← Back</button>
                <button style={{ ...M.btnCancel, padding: "6px 12px", fontSize: 16 }} onClick={() => reorderCard("fwd")}  disabled={!canMoveFwd  || saving}>Forward →</button>
              </div>
            )}

            {/* Actions */}
            <div style={M.actions}>
              <div style={{ display: "flex", gap: 8 }}>
                {popup.rec?.id && (
                  <button style={M.btnRemove} onClick={removeLevel} disabled={saving} title={`Remove this ${popLevel.label} note`}>
                    🗑 Remove note
                  </button>
                )}
                {popup.rec?.status === "done" || popup.rec?.status === "in_progress" ? (
                  <button style={M.btnClear} onClick={clearCell} disabled={saving}>Clear all</button>
                ) : null}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button style={M.btnCancel} onClick={() => setPopup(null)}>Cancel</button>
                <button style={M.btnSave} onClick={saveNotes} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>

            {/* Add extra card types */}
            {missingExtras.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ color: "#94a3b8", fontSize: 16, marginBottom: 8 }}>Add card to this cell:</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {missingExtras.map((k) => (
                    <button key={k} onClick={() => addExtraCard(k)} disabled={saving}
                      style={{ background: LVL[k].bg, color: LVL[k].text, border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
                      {LVL[k].label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Level legend */}
            <div style={M.legend}>
              {["todo","in_progress","quote","revision","done"].map((lv) => {
                const l = LVL[lv];
                const isActive = popup.level === lv;
                return (
                  <div key={lv} style={{ ...M.legendItem, opacity: isActive ? 1 : 0.35, background: l.bg, borderTop: `3px solid ${l.top}` }}>
                    <span style={{ fontSize: 16, fontWeight: 600, color: l.text }}>{l.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          New Job modal
      ══════════════════════════════════════════════════ */}
      {showNew && (
        <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && setShowNew(false)}>
          <div style={M.box}>
            <div style={M.modalTitle}>New Job</div>
            <label style={M.lbl}>Job Name *</label>
            <input style={M.inp} value={newForm.name} onChange={(e) => setNewForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. 14 Smith St — New Build" autoFocus />
            <label style={M.lbl}>Client Name</label>
            <input style={M.inp} value={newForm.client} onChange={(e) => setNewForm((p) => ({ ...p, client: e.target.value }))} placeholder="Client name" />
            <label style={M.lbl}>Address</label>
            <input style={M.inp} value={newForm.address} onChange={(e) => setNewForm((p) => ({ ...p, address: e.target.value }))} placeholder="Site address" />
            <label style={M.lbl}>Notes</label>
            <textarea style={{ ...M.inp, resize: "vertical" }} value={newForm.notes} onChange={(e) => setNewForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Any initial notes…" rows={2} />
            <div style={{ ...M.actions, marginTop: 20 }}>
              <div />
              <div style={{ display: "flex", gap: 10 }}>
                <button style={M.btnCancel} onClick={() => setShowNew(false)}>Cancel</button>
                <button style={M.btnSave} onClick={createJob} disabled={saving || !newForm.name.trim()}>
                  {saving ? "Creating…" : "Add Job"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          Edit Job modal
      ══════════════════════════════════════════════════ */}
      {editJob && (
        <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && setEditJob(null)}>
          <div style={M.box}>
            <div style={M.modalTitle}>Edit Job</div>
            <label style={M.lbl}>Job Name *</label>
            <input style={M.inp} value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} />
            <label style={M.lbl}>Client</label>
            <input style={M.inp} value={editForm.client} onChange={(e) => setEditForm((p) => ({ ...p, client: e.target.value }))} />
            <label style={M.lbl}>Address</label>
            <input style={M.inp} value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} />
            <label style={M.lbl}>Notes</label>
            <textarea style={{ ...M.inp, resize: "vertical" }} value={editForm.notes} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
            <div style={{ ...M.actions, marginTop: 20 }}>
              <button style={{ ...M.btnClear, color: "#ef4444", borderColor: "#ef4444" }} onClick={() => deleteJob(editJob.id)}>Delete Job</button>
              <div style={{ display: "flex", gap: 10 }}>
                <button style={M.btnCancel} onClick={() => setEditJob(null)}>Cancel</button>
                <button style={M.btnSave} onClick={saveEdit} disabled={saving || !editForm.name?.trim()}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          Edit Column Header modal
      ══════════════════════════════════════════════════ */}
      {editCol && (
        <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && setEditCol(null)}>
          <div style={M.box}>
            <div style={M.modalTitle}>✏️ Edit Column Header</div>

            <label style={M.lbl}>Column Label</label>
            <input style={M.inp} value={colForm.label} onChange={(e) => setColForm((p) => ({ ...p, label: e.target.value }))} autoFocus />

            <label style={M.lbl}>Header Background</label>
            <input
              type="color"
              value={colForm.bgColor || "#0d1424"}
              onChange={(e) => setColForm((p) => ({ ...p, bgColor: e.target.value }))}
              style={{ width: "100%", height: 44, border: "1px solid #334155", borderRadius: 8, cursor: "pointer", background: "none", padding: 2 }}
            />

            <label style={M.lbl}>Text Colour</label>
            <input
              type="color"
              value={colForm.txtColor || "#f1f5f9"}
              onChange={(e) => setColForm((p) => ({ ...p, txtColor: e.target.value }))}
              style={{ width: "100%", height: 44, border: "1px solid #334155", borderRadius: 8, cursor: "pointer", background: "none", padding: 2 }}
            />

            <label style={M.lbl}>Font Size: {colForm.fontSize}px</label>
            <input
              type="range" min={12} max={24} step={1}
              value={colForm.fontSize}
              onChange={(e) => setColForm((p) => ({ ...p, fontSize: Number(e.target.value) }))}
              style={{ width: "100%", accentColor: "#6366f1", marginTop: 4 }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, color: "#64748b" }}><span>12px</span><span>24px</span></div>

            {/* Live preview */}
            <div style={{ marginTop: 14, borderRadius: 8, padding: "12px 16px", background: colForm.bgColor, color: colForm.txtColor, fontSize: colForm.fontSize, fontWeight: 600, textAlign: "center", border: "1px solid #334155" }}>
              {colForm.label || "Preview"}
            </div>

            {/* ── Card Automations ── */}
            <div style={{ marginTop: 22, borderTop: "1px solid #2d3f58", paddingTop: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#f1f5f9", marginBottom: 12 }}>⚡ Card Automations</div>
              <p style={{ fontSize: 16, color: "#64748b", marginTop: 0, marginBottom: 12 }}>
                When a card is added to this column, optionally prompt to send a work-order email.<br />
                Use <code style={{ background: "#0c111c", padding: "1px 4px", borderRadius: 4 }}>{"{{job_name}}"}</code>, <code style={{ background: "#0c111c", padding: "1px 4px", borderRadius: 4 }}>{"{{client}}"}</code>, <code style={{ background: "#0c111c", padding: "1px 4px", borderRadius: 4 }}>{"{{address}}"}</code> in subject/body.
              </p>
              {Object.entries(LVL).map(([lvlKey, lvl]) => {
                const existing = automations.find((a) => a.task_key === editCol?.key && a.card_level === lvlKey);
                const isEditing = autoEditKey?.task_key === editCol?.key && autoEditKey?.card_level === lvlKey;
                return (
                  <div key={lvlKey} style={{ marginBottom: 10, borderRadius: 8, border: "1px solid #2d3f58", background: "#0d1424", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
                      <div style={{ width: 12, height: 12, borderRadius: "50%", background: lvl.bg, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 16, color: "#f1f5f9" }}>{lvl.label}</span>
                      {existing && <span style={{ fontSize: 16, color: "#34d399" }}>✓ configured</span>}
                      <button onClick={() => {
                        if (isEditing) { setAutoEditKey(null); return; }
                        setAutoEditKey({ task_key: editCol.key, card_level: lvlKey });
                        setAutoForm({ email_to: existing?.email_to || "", email_subject: existing?.email_subject || `Work Order – ${colForm.label || editCol.key} – {{job_name}}`, email_body: existing?.email_body || `Hi,\n\nPlease arrange the following for:\n\nJob: {{job_name}}\nClient: {{client}}\nAddress: {{address}}\n\nTask: ${colForm.label || editCol.key}\n\nPlease confirm receipt.\n\nThanks`, enabled: existing?.enabled ?? true });
                      }} style={{ fontSize: 16, padding: "4px 10px", borderRadius: 6, border: "1px solid #334155", background: isEditing ? "#1e3a8a" : "transparent", color: "#93c5fd", cursor: "pointer" }}>
                        {isEditing ? "▲ Close" : existing ? "✏️ Edit" : "+ Add"}
                      </button>
                      {existing && (
                        <button onClick={() => deleteAutomation(editCol.key, lvlKey)}
                          style={{ fontSize: 16, padding: "4px 8px", borderRadius: 6, border: "1px solid #7f1d1d", background: "transparent", color: "#f87171", cursor: "pointer" }}>🗑</button>
                      )}
                    </div>
                    {isEditing && (
                      <div style={{ padding: "0 12px 14px", borderTop: "1px solid #2d3f58" }}>
                        <label style={{ ...M.lbl, marginTop: 12 }}>Send to (comma-separated emails)</label>
                        <input style={M.inp} value={autoForm.email_to} onChange={(e) => setAutoForm((p) => ({ ...p, email_to: e.target.value }))} placeholder="soil@company.com, office@firm.com" />
                        <label style={M.lbl}>Subject</label>
                        <input style={M.inp} value={autoForm.email_subject} onChange={(e) => setAutoForm((p) => ({ ...p, email_subject: e.target.value }))} />
                        <label style={M.lbl}>Message body</label>
                        <textarea style={{ ...M.ta, minHeight: 100 }} rows={5} value={autoForm.email_body} onChange={(e) => setAutoForm((p) => ({ ...p, email_body: e.target.value }))} />
                        <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button style={M.btnCancel} onClick={() => setAutoEditKey(null)}>Cancel</button>
                          <button style={M.btnSave} disabled={!autoForm.email_to.trim()} onClick={async () => {
                            await saveAutomation(editCol.key, lvlKey, { email_to: autoForm.email_to, email_subject: autoForm.email_subject, email_body: autoForm.email_body, enabled: true });
                            setAutoEditKey(null);
                          }}>Save Automation</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ ...M.actions, marginTop: 20 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...M.btnClear, color: "#f87171", borderColor: "#f87171" }} onClick={() => resetColSettings(editCol.key)}>Reset</button>
                <button style={{ ...M.btnClear, color: "#f87171", borderColor: "#f87171" }} onClick={() => deleteColumn(editCol.key)}>🗑 Delete</button>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button style={M.btnCancel} onClick={() => setEditCol(null)}>Cancel</button>
                <button style={M.btnSave} onClick={saveColSettings}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          New Board modal
      ══════════════════════════════════════════════════ */}
      {showNewBoard && (
        <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && setShowNewBoard(false)}>
          <div style={{ ...M.box, maxWidth: 460 }}>
            <div style={M.modalTitle}>+ New Board</div>
            <p style={{ color: "#94a3b8", fontSize: 16, marginTop: 0, marginBottom: 18 }}>
              Each board has its own column set and jobs. Great for different lines of business.
            </p>
            <label style={M.lbl}>Board Name *</label>
            <input style={M.inp} value={newBoardForm.name} autoFocus
              onChange={(e) => setNewBoardForm((p) => ({ ...p, name: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && newBoardForm.name.trim() && createBoard()}
              placeholder="e.g. Construction, Marketing, Trade Services…" />
            <label style={M.lbl}>Start from template (optional)</label>
            <select style={{ ...M.inp, color: newBoardForm.templateKey ? "#ffffff" : "#64748b" }}
              value={newBoardForm.templateKey}
              onChange={(e) => setNewBoardForm((p) => ({ ...p, templateKey: e.target.value }))}>
              <option value="">— Blank board (add columns manually) —</option>
              {TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.icon} {t.label} ({t.tasks.length} columns)</option>)}
            </select>
            <div style={{ ...M.actions, marginTop: 22 }}>
              <div />
              <div style={{ display: "flex", gap: 10 }}>
                <button style={M.btnCancel} onClick={() => setShowNewBoard(false)}>Cancel</button>
                <button style={M.btnSave} onClick={createBoard} disabled={!newBoardForm.name.trim()}>Create Board</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          Industry Templates modal
      ══════════════════════════════════════════════════ */}
      {showTemplates && (
        <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && setShowTemplates(false)}>
          <div style={{ ...M.box, maxWidth: 700, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={M.modalTitle}>📋 Industry Templates</div>
            <p style={{ color: "#94a3b8", fontSize: 16, marginTop: 0, marginBottom: 20 }}>
              Pick a template to load a pre-built column set. Your current columns will be replaced — custom automations are kept.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
              {TEMPLATES.map((tpl) => (
                <button key={tpl.key} onClick={() => {
                  if (!confirm(`Replace current columns with the "${tpl.label}" template?\n\nThis will overwrite your column list (automations are unaffected).`)) return;
                  // Stamp fresh keys so they don't collide with old data
                  const newList = tpl.tasks.map((t) => ({ ...t }));
                  saveTaskList(newList);
                  setShowTemplates(false);
                }} style={{ background: "#0d1424", border: "1px solid #2d3f58", borderRadius: 12, padding: "18px 14px", cursor: "pointer", textAlign: "left", transition: "border-color 0.15s" }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = "#6366f1"}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = "#2d3f58"}
                >
                  <div style={{ fontSize: 26, marginBottom: 8 }}>{tpl.icon}</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#f1f5f9", marginBottom: 6 }}>{tpl.label}</div>
                  <div style={{ fontSize: 16, color: "#64748b" }}>{tpl.tasks.length} columns</div>
                  <div style={{ marginTop: 8, fontSize: 16, color: "#475569", lineHeight: 1.5 }}>
                    {tpl.tasks.slice(0, 4).map((t) => t.label).join(" · ")}{tpl.tasks.length > 4 ? " …" : ""}
                  </div>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 24, textAlign: "right" }}>
              <button style={M.btnCancel} onClick={() => setShowTemplates(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          Add Column modal
      ══════════════════════════════════════════════════ */}
      {showAddCol && (
        <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && setShowAddCol(false)}>
          <div style={{ ...M.box, maxWidth: 380 }}>
            <div style={M.modalTitle}>Add Column</div>
            <label style={M.lbl}>Column Name</label>
            <input
              style={M.inp}
              value={addColName}
              onChange={(e) => setAddColName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && addColName.trim() && addColumn()}
              placeholder="e.g. Soil Report, Defects…"
            />
            <div style={{ ...M.actions, marginTop: 20 }}>
              <div />
              <div style={{ display: "flex", gap: 10 }}>
                <button style={M.btnCancel} onClick={() => { setShowAddCol(false); setAddColName(""); }}>Cancel</button>
                <button style={M.btnSave} onClick={addColumn} disabled={!addColName.trim()}>Add Column</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          Work Order confirm modal
      ══════════════════════════════════════════════════ */}
      {workOrderModal && (
        <div style={M.overlay}>
          <div style={{ ...M.box, maxWidth: 520 }}>
            <div style={M.modalTitle}>⚡ Send Work Order?</div>
            <p style={{ color: "#94a3b8", fontSize: 16, marginTop: 0, marginBottom: 16 }}>
              An automation is set up for this card. Review and send, or skip.
            </p>

            <label style={M.lbl}>To (comma-separated)</label>
            <input style={M.inp} value={workOrderModal.to}
              onChange={(e) => setWorkOrderModal((p) => ({ ...p, to: e.target.value }))} />

            <label style={M.lbl}>Subject</label>
            <input style={M.inp} value={workOrderModal.subject}
              onChange={(e) => setWorkOrderModal((p) => ({ ...p, subject: e.target.value }))} />

            <label style={M.lbl}>Message</label>
            <textarea style={{ ...M.ta, minHeight: 120 }} value={workOrderModal.body}
              onChange={(e) => setWorkOrderModal((p) => ({ ...p, body: e.target.value }))} rows={5} />

            <div style={{ ...M.actions, marginTop: 20 }}>
              <button style={M.btnCancel} onClick={() => setWorkOrderModal(null)}>Skip</button>
              <button style={M.btnSave} disabled={saving} onClick={async () => {
                setSaving(true);
                const { data: { session } } = await supabase.auth.getSession();
                const res = await fetch("/api/jobboard/send-work-order", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
                  body: JSON.stringify({ to: workOrderModal.to, subject: workOrderModal.subject, body: workOrderModal.body, job_name: workOrderModal.job_name, task_name: workOrderModal.task_name }),
                });
                const json = await res.json();
                setSaving(false);
                if (!res.ok) { alert("Failed to send: " + (json.error || "Unknown error")); return; }
                setWorkOrderModal(null);
              }}>
                {saving ? "Sending…" : "Send Email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  Styles
// ══════════════════════════════════════════════════════════════════════════════

const P = {
  page:     { padding: "22px 18px", minHeight: "100vh", background: "#0c111c", color: "#f1f5f9", fontFamily: "system-ui, sans-serif", fontSize: 16 },
  loadWrap: { display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" },
  spinner:  { width: 36, height: 36, border: "3px solid #1e293b", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite" },

  // Banner
  banner:      { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)", padding: "22px 28px", borderRadius: 16, marginBottom: 20 },
  bannerLeft:  { display: "flex", alignItems: "center", gap: 18 },
  bannerIcon:  { fontSize: 48, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.16)", borderRadius: 999, width: 76, height: 76, flexShrink: 0 },
  bannerTitle: { margin: 0, fontSize: 48, fontWeight: 600, lineHeight: 1.1, color: "#fff" },
  bannerDesc:  { margin: "4px 0 0", fontSize: 18, opacity: 0.92, color: "#fff" },
  backBtn:     { background: "rgba(15,23,42,0.85)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10, padding: "9px 18px", fontSize: 18, cursor: "pointer", whiteSpace: "nowrap" },

  // Controls bar
  controlsBar: { display: "flex", gap: 10, marginBottom: 18 },

  header:   { display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 },
  title:    { fontSize: 24, fontWeight: 600, margin: 0, color: "#ffffff" },
  sub:      { fontSize: 16, color: "#cbd5e1", marginTop: 6 },
  addBtn:   { background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "12px 24px", fontSize: 16, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
  empty:    { textAlign: "center", color: "#cbd5e1", padding: "70px 20px", fontSize: 16 },

  boardWrap: { overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 220px)", borderRadius: 10, border: "2px solid #1e293b" },
  table:     { borderCollapse: "collapse", tableLayout: "fixed" },

  cornerTh: { position: "sticky", top: 0, left: 0, zIndex: 5, background: "#0d1424", padding: "12px 14px", textAlign: "left", fontSize: 16, fontWeight: 600, color: "#ffffff", borderBottom: "2px solid #334155", borderRight: "2px solid #334155", width: 200, minWidth: 200 },
  taskTh:   { position: "sticky", top: 0, zIndex: 4, background: "#0d1424", padding: "10px 8px", textAlign: "center", fontSize: 16, fontWeight: 600, color: "#f1f5f9", borderBottom: "2px solid #334155", borderRight: "1px solid #334155", width: 200, minWidth: 200, lineHeight: 1.4 },

  jobCell:  { position: "sticky", left: 0, zIndex: 2, padding: "12px 14px", borderRight: "2px solid #334155", borderBottom: "1px solid #334155", width: 200, minWidth: 200, verticalAlign: "top" },
  jobName:  { fontWeight: 600, fontSize: 16, color: "#ffffff", lineHeight: 1.3 },
  jobClient:{ fontSize: 16, color: "#818cf8", marginTop: 3 },
  jobAddr:  { fontSize: 16, color: "#94a3b8", marginTop: 2 },
  editBtn:  { background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: "2px 0", marginTop: 6, color: "#94a3b8", display: "block" },

  taskCell: { padding: "6px 6px", verticalAlign: "top", borderBottom: "1px solid #334155", borderRight: "1px solid #334155" },
};

// Note styles
const N = {
  note: {
    position: "absolute",
    left: 4, right: 4,
    height: NOTE_H,
    borderRadius: 3,
    borderTop: "5px solid",
    border: "1px solid rgba(0,0,0,0.15)",
    padding: "8px 10px",
    cursor: "pointer",
    boxShadow: "2px 3px 10px rgba(0,0,0,0.35)",
    transition: "transform 0.1s, box-shadow 0.1s",
    overflow: "hidden",
  },
  tag:    { fontSize: 16, fontWeight: 600, letterSpacing: "0.02em", display: "block", userSelect: "none" },
  snip:   { fontSize: 16, color: "rgba(0,0,0,0.65)", marginTop: 4, lineHeight: 1.35, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" },
  addBtn: { width: 34, height: 34, borderRadius: "50%", border: "2px dashed #334155", background: "none", color: "#94a3b8", fontSize: 20, textAlign: "center", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
};

// Modal styles
const M = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 },
  box:     { background: "#1a2535", border: "1px solid #2d3f58", borderRadius: 16, padding: "26px 28px", width: "100%", maxWidth: 500, boxShadow: "0 30px 70px rgba(0,0,0,0.7)" },

  badge:      { borderRadius: 8, padding: "12px 16px", marginBottom: 14 },
  badgeLabel: { fontSize: 18, fontWeight: 600, letterSpacing: "0.02em" },
  badgeSub:   { fontSize: 16, color: "rgba(0,0,0,0.5)" },
  jobLine:    { fontSize: 16, color: "#cbd5e1", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: 600, color: "#ffffff", marginBottom: 18 },

  lbl: { display: "block", fontSize: 16, fontWeight: 600, color: "#cbd5e1", marginBottom: 6, marginTop: 14 },
  inp: { width: "100%", background: "#0c111c", border: "1px solid #2d3f58", borderRadius: 8, padding: "12px 14px", color: "#ffffff", fontSize: 16, boxSizing: "border-box", fontFamily: "inherit", outline: "none" },
  ta:  { width: "100%", background: "#0c111c", border: "1px solid #2d3f58", borderRadius: 8, padding: "12px 14px", color: "#ffffff", fontSize: 16, boxSizing: "border-box", fontFamily: "inherit", outline: "none", resize: "vertical", marginTop: 2 },

  actions:    { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 22 },
  btnCancel:  { background: "transparent", border: "1px solid #2d3f58", color: "#cbd5e1", borderRadius: 8, padding: "11px 18px", fontSize: 16, cursor: "pointer" },
  btnSave:    { background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "11px 22px", fontSize: 16, fontWeight: 600, cursor: "pointer" },
  btnAdvance: { background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "11px 20px", fontSize: 16, fontWeight: 600, cursor: "pointer" },
  btnRemove:  { background: "transparent", border: "1px solid #ef4444", color: "#fca5a5", borderRadius: 8, padding: "11px 16px", fontSize: 16, cursor: "pointer" },
  btnClear:   { background: "transparent", border: "1px solid #2d3f58", color: "#94a3b8", borderRadius: 8, padding: "11px 16px", fontSize: 16, cursor: "pointer" },

  legend:     { display: "flex", gap: 8, marginTop: 20, paddingTop: 16, borderTop: "1px solid #1e293b" },
  legendItem: { flex: 1, borderRadius: 4, padding: "8px", textAlign: "center", fontSize: 16 },
};
