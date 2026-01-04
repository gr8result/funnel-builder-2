// /pages/modules/email/crm/pipelines/index.js
// CRM PIPELINE – drag/drop, card style chooser, pipeline selector,
// default template for new pipelines, and reusable LeadDetailsModal.

import { useEffect, useState, useRef } from "react";
import Head from "next/head";
import Link from "next/link";
import { supabase } from "../../../../../utils/supabase-client";

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  rectIntersection,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";

import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import SubscriberAvatar from "../../../../../components/crm/SubscriberAvatar";
import LeadDetailsModal from "../../../../../components/crm/LeadDetailsModal";

/* -------------------------------------------------------------
   CONSTANTS
------------------------------------------------------------- */

// Default starting stages for a brand-new pipeline
const DEFAULT_STAGES = [
  {
    id: "not_qualified",
    title: "Not Qualified",
    color: "#64748b",
  },
  {
    id: "new_lead",
    title: "New Lead",
    color: "#22c55e",
  },
  {
    id: "first_contact",
    title: "First Contact",
    color: "#0ea5e9",
  },
  {
    id: "follow_up",
    title: "Follow up",
    color: "#eab308",
  },
];

// localStorage keys
const LAST_PIPELINE_KEY = "crm:pipeline:lastPipelineId";
const CARD_STYLE_KEY = "crm:pipeline:cardStyle";

// helper for card visuals – outline = stage colour
function getCardVisualStyles(styleKey, color) {
  const baseBlue = "#2297c5"; // fallback / legacy

  switch (styleKey) {
    case "glass":
      return {
        background: `linear-gradient(135deg, ${color}aa, rgba(3,7,18,0.95))`,
        border: `2px solid ${color}`,
        boxShadow: "0 10px 25px rgba(0,0,0,0.6)",
        backdropFilter: "blur(10px)",
      };
    case "solid":
      return {
        background: color || baseBlue,
        border: `2px solid ${color || baseBlue}`,
        boxShadow: "0 8px 18px rgba(0,0,0,0.7)",
      };
    case "minimal":
    default:
      return {
        background: "rgba(15,23,42,0.95)",
        borderLeft: `4px solid ${color}`,
        borderRight: "1px solid rgba(255,255,255,0.12)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        borderBottom: "1px solid rgba(0,0,0,0.8)",
        boxShadow: "0 6px 14px rgba(0,0,0,0.6)",
      };
  }
}

export default function Pipelines() {
  const [userId, setUserId] = useState(null);

  // Pipelines + current pipeline
  const [pipelines, setPipelines] = useState([]);
  const [currentPipeline, setCurrentPipeline] = useState(null);

  // Stages + leads
  const [stages, setStages] = useState([]);
  const [leads, setLeads] = useState([]);
  const [activeLead, setActiveLead] = useState(null);

  // Lists (for “List to use in this board”)
  const [lists, setLists] = useState([]);
  const [listFilter, setListFilter] = useState("all"); // which list this board is using

  const [loading, setLoading] = useState(true);
  const [collapsedStages, setCollapsedStages] = useState({});
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [isStageEditorOpen, setIsStageEditorOpen] = useState(false);

  // file menu
  const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
  const [isSaveAsOpen, setIsSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const [saveAsLocation, setSaveAsLocation] = useState("");
  const [isSavingAs, setIsSavingAs] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileMenuRef = useRef(null);

  // card style selector
  const [cardStyle, setCardStyle] = useState("glass"); // "glass" | "solid" | "minimal"

  // reusable lead modal
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  // font size scaling inside modal – fixed
  const fontScale = 1.35;

  // drag & drop sensor – small distance so click still works
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Create / edit pipeline modal
  const [isPipelineModalOpen, setIsPipelineModalOpen] = useState(false);
  const [pipelineModalMode, setPipelineModalMode] = useState("create"); // "create" | "edit"
  const [pipelineNameInput, setPipelineNameInput] = useState("");
  const [pipelineListIdInput, setPipelineListIdInput] = useState("all");

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // load saved card style from localStorage on first mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedStyle = window.localStorage.getItem(CARD_STYLE_KEY);
    if (
      storedStyle === "glass" ||
      storedStyle === "solid" ||
      storedStyle === "minimal"
    ) {
      setCardStyle(storedStyle);
    }
  }, []);

  function persistCardStyle(style) {
    setCardStyle(style);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CARD_STYLE_KEY, style);
    }
  }

  async function loadUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error("loadUser error:", error);
      return;
    }
    if (!data?.user) return;

    const uid = data.user.id;
    setUserId(uid);

    await Promise.all([loadLists(uid), loadPipelines(uid), loadLeads(uid)]);
    setLoading(false);
  }

  async function loadLists(uid) {
    try {
      const { data, error } = await supabase
        .from("lead_lists")
        .select("*")
        .eq("user_id", uid)
        .order("name", { ascending: true });

      if (error) {
        console.warn("loadLists error (safe if table differs):", error);
        setLists([]);
      } else {
        setLists(data || []);
      }
    } catch (err) {
      console.warn("loadLists exception:", err);
      setLists([]);
    }
  }

  // helper: per-pipeline list key for localStorage
  function pipelineListKey(id) {
    return `crm:pipeline:list:${id}`;
  }

  async function loadPipelines(uid) {
    const { data, error } = await supabase
      .from("crm_pipelines")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("loadPipelines error:", error);
      setPipelines([]);
      return;
    }

    const rows = data || [];
    setPipelines(rows);

    if (rows.length > 0) {
      let pipeline = rows[0];

      // try to restore last open pipeline from localStorage
      if (typeof window !== "undefined") {
        const lastId = window.localStorage.getItem(LAST_PIPELINE_KEY);
        if (lastId) {
          const found = rows.find((p) => String(p.id) === String(lastId));
          if (found) {
            pipeline = found;
          }
        }
      }

      setCurrentPipeline(pipeline);
      setStages(pipeline.stages || DEFAULT_STAGES);

      // per-pipeline list selection from localStorage
      let initialFilter = "all";
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem(pipelineListKey(pipeline.id));
        if (stored) initialFilter = stored;
        // make sure last pipeline id is up to date
        window.localStorage.setItem(LAST_PIPELINE_KEY, pipeline.id);
      }
      setListFilter(initialFilter);
    } else {
      setCurrentPipeline(null);
      setStages(DEFAULT_STAGES);
      setListFilter("all");
    }
  }

  async function loadLeads(uid) {
    setLoading(true);

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("user_id", uid);

    if (error) {
      console.error("loadLeads error:", error);
      setLeads([]);
      setLoading(false);
      return;
    }

    setLeads(data || []);
    setLoading(false);
  }

  // whenever currentPipeline changes, load listFilter from storage
  useEffect(() => {
    if (!currentPipeline) return;

    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(
        pipelineListKey(currentPipeline.id)
      );
      setListFilter(stored || "all");
      window.localStorage.setItem(LAST_PIPELINE_KEY, currentPipeline.id);
    } else {
      setListFilter("all");
    }
  }, [currentPipeline]);

  // helper: quick stage names
  function getStageTitleById(id) {
    return stages.find((s) => s.id === id)?.title || id || "Unknown stage";
  }

  // auto log when stage changes – add note + lightweight task
  async function logStageMove(lead, fromStageId, toStageId) {
    if (!userId || !lead) return;

    const fromTitle = getStageTitleById(fromStageId);
    const toTitle = getStageTitleById(toStageId);

    const now = new Date();
    const stamp = now.toLocaleString("en-AU", {
      timeZone: "Australia/Brisbane",
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const line = `[${stamp}] Stage changed from "${fromTitle}" to "${toTitle}".`;

    // 1) update notes on the lead
    const existingNotes = lead.notes || "";
    const newNotes = existingNotes ? `${existingNotes.trim()}\n\n${line}` : line;

    const { error: notesError } = await supabase
      .from("leads")
      .update({ notes: newNotes, updated_at: new Date() })
      .eq("id", lead.id);

    if (notesError) {
      console.error("logStageMove notes error:", notesError);
    } else {
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, notes: newNotes } : l))
      );
      setSelectedLead((prev) =>
        prev && prev.id === lead.id ? { ...prev, notes: newNotes } : prev
      );
    }

    // 2) add a “check” task so it appears on future Tasks page
    const todayISO = new Date().toISOString().slice(0, 10);
    const title = `${
      lead.name || "This contact"
    } – Stage check: ${fromTitle} → ${toTitle}`;

    const { error: taskError } = await supabase.from("crm_tasks").insert({
      user_id: userId,
      contact_id: lead.id,
      title,
      notes: line,
      completed: false,
      due_date: todayISO,
    });

    if (taskError) {
      console.error("logStageMove task error:", taskError);
    }
  }

  function handleDragStart(event) {
    const lead = leads.find((l) => l.id === event.active.id);
    setActiveLead(lead || null);
  }

  async function handleDragEnd(event) {
    setActiveLead(null);
    const { active, over } = event;
    if (!active || !over) return;

    const leadId = active.id;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    let targetStageId = null;

    const stageById = stages.find((s) => s.id === over.id);
    if (stageById) {
      targetStageId = stageById.id;
    } else {
      const overLead = leads.find((l) => l.id === over.id);
      if (overLead) {
        targetStageId = overLead.stage;
      }
    }

    if (!targetStageId || targetStageId === lead.stage) return;

    const previousStageId = lead.stage;

    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stage: targetStageId } : l))
    );

    const { error } = await supabase
      .from("leads")
      .update({ stage: targetStageId, updated_at: new Date() })
      .eq("id", leadId);

    if (error) {
      console.error("Drag update error:", error);
    } else {
      logStageMove(lead, previousStageId, targetStageId);
    }
  }

  function toggleCollapse(id) {
    setCollapsedStages((p) => ({ ...p, [id]: !p[id] }));
  }

  function collapseAll() {
    const obj = {};
    stages.forEach((s) => (obj[s.id] = true));
    setCollapsedStages(obj);
  }

  function expandAll() {
    setCollapsedStages({});
  }

  async function saveStagesToPipeline(newStages) {
    setStages(newStages);

    if (currentPipeline) {
      const { error } = await supabase
        .from("crm_pipelines")
        .update({ stages: newStages, updated_at: new Date() })
        .eq("id", currentPipeline.id);

      if (error) {
        console.error("saveStagesToPipeline error:", error);
      }
    }

    setIsStageEditorOpen(false);
  }

  function getNewLeadStage() {
    if (!stages || !stages.length) return null;
    const match =
      stages.find(
        (s) =>
          s.id === "new" ||
          s.id === "new_lead" ||
          s.title?.toLowerCase() === "new lead" ||
          s.title?.toLowerCase() === "new leads"
      ) || stages[1] || stages[0];
    return match || null;
  }

  // ---------- FILE MENU ----------

  async function handleFileSave() {
    if (!currentPipeline) return;

    const { error } = await supabase
      .from("crm_pipelines")
      .update({
        stages,
        updated_at: new Date(),
      })
      .eq("id", currentPipeline.id);

    if (error) {
      console.error(error);
      alert("There was an error saving this pipeline.");
    } else {
      alert("Pipeline saved.");
    }
    setIsFileMenuOpen(false);
  }

  function handleFileSaveAs() {
    const defaultName =
      (currentPipeline?.name
        ? `Copy of ${currentPipeline.name}`
        : "New Pipeline") || "New Pipeline";

    setSaveAsName(defaultName);
    setSaveAsLocation("");
    setIsSaveAsOpen(true);
    setIsFileMenuOpen(false);
  }

  async function handleConfirmSaveAs() {
    if (!userId) {
      alert("No user logged in.");
      return;
    }

    const name = saveAsName.trim() || "New Pipeline";

    setIsSavingAs(true);
    const { data, error } = await supabase
      .from("crm_pipelines")
      .insert({
        user_id: userId,
        name,
        description: currentPipeline?.description || null,
        stages,
      })
      .select()
      .single();

    setIsSavingAs(false);

    if (error) {
      console.error(error);
      alert("Error saving pipeline: " + error.message);
      return;
    }

    setPipelines((prev) => [...prev, data]);
    setCurrentPipeline(data);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_PIPELINE_KEY, data.id);
    }

    setIsSaveAsOpen(false);
    alert('Pipeline saved as "' + name + '"');
  }

  // "Import" = reload leads from DB (lists already fill leads table)
  async function handleFileImport() {
    if (!userId) {
      alert("User not loaded yet.");
      return;
    }
    setIsImporting(true);
    try {
      await loadLeads(userId);
      alert("Leads reloaded from the database.");
    } catch (err) {
      console.error("Import/reload error:", err);
      alert("There was an error reloading leads.");
    } finally {
      setIsImporting(false);
      setIsFileMenuOpen(false);
    }
  }

  function handleFileExport() {
    alert("Export: hook this up to your export logic.");
    setIsFileMenuOpen(false);
  }

  function handleFileEditPipeline() {
    setIsStageEditorOpen(true);
    setIsFileMenuOpen(false);
  }

  // Close file menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (!isFileMenuOpen) return;
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target)) {
        setIsFileMenuOpen(false);
      }
    }

    if (isFileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isFileMenuOpen]);

  // ---------- PIPELINE SELECTOR + MODAL ----------

  function openCreatePipelineModal() {
    setPipelineModalMode("create");
    setPipelineNameInput("");
    // default list to current board filter, so it's not "all" every time
    setPipelineListIdInput(listFilter || "all");
    setIsPipelineModalOpen(true);
  }

  function openEditPipelineModal() {
    if (!currentPipeline) return;
    setPipelineModalMode("edit");
    setPipelineNameInput(currentPipeline.name || "");

    let initialList = "all";
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(
        pipelineListKey(currentPipeline.id)
      );
      if (stored) initialList = stored;
    }
    setPipelineListIdInput(initialList);
    setIsPipelineModalOpen(true);
  }

  async function handleConfirmPipelineModal() {
    if (!userId) return;
    const trimmedName = pipelineNameInput.trim() || "New Pipeline";
    const listSelection = pipelineListIdInput || "all";

    if (pipelineModalMode === "create") {
      const { data, error } = await supabase
        .from("crm_pipelines")
        .insert({
          user_id: userId,
          name: trimmedName,
          description: null,
          stages: DEFAULT_STAGES,
        })
        .select()
        .single();

      if (error) {
        console.error("create pipeline error:", error);
        alert("Error creating pipeline: " + error.message);
        return;
      }

      // remember list selection for this pipeline
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          pipelineListKey(data.id),
          listSelection || "all"
        );
        window.localStorage.setItem(LAST_PIPELINE_KEY, data.id);
      }

      setPipelines((prev) => [...prev, data]);
      setCurrentPipeline(data);
      setStages(DEFAULT_STAGES);
      setListFilter(listSelection || "all");
      setIsPipelineModalOpen(false);
    } else {
      if (!currentPipeline) return;

      const { data, error } = await supabase
        .from("crm_pipelines")
        .update({
          name: trimmedName,
          updated_at: new Date(),
        })
        .eq("id", currentPipeline.id)
        .select()
        .single();

      if (error) {
        console.error("update pipeline error:", error);
        alert("Error updating pipeline: " + error.message);
        return;
      }

      // remember list selection for this pipeline
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          pipelineListKey(currentPipeline.id),
          listSelection || "all"
        );
        window.localStorage.setItem(LAST_PIPELINE_KEY, data.id);
      }

      setPipelines((prev) =>
        prev.map((p) => (p.id === data.id ? { ...p, ...data } : p))
      );
      setCurrentPipeline(data);
      setListFilter(listSelection || "all");
      setIsPipelineModalOpen(false);
    }
  }

  async function handleDeletePipeline() {
    if (!currentPipeline) return;
    const ok = window.confirm(
      `Delete pipeline "${currentPipeline.name}"? This does NOT delete leads – only this board.`
    );
    if (!ok) return;

    const { error } = await supabase
      .from("crm_pipelines")
      .delete()
      .eq("id", currentPipeline.id);

    if (error) {
      console.error("delete pipeline error:", error);
      alert("Could not delete pipeline: " + error.message);
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.removeItem(pipelineListKey(currentPipeline.id));
    }

    const remaining = pipelines.filter((p) => p.id !== currentPipeline.id);
    setPipelines(remaining);

    if (remaining.length) {
      const next = remaining[0];
      setCurrentPipeline(next);
      setStages(next.stages || DEFAULT_STAGES);

      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem(pipelineListKey(next.id));
        setListFilter(stored || "all");
        window.localStorage.setItem(LAST_PIPELINE_KEY, next.id);
      } else {
        setListFilter("all");
      }
    } else {
      setCurrentPipeline(null);
      setStages(DEFAULT_STAGES);
      setListFilter("all");
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(LAST_PIPELINE_KEY);
      }
    }
  }

  function handlePipelineSelectChange(e) {
    const value = e.target.value;
    if (value === "__new__") {
      // "Create new pipeline…" option
      e.target.value = currentPipeline ? currentPipeline.id : "";
      openCreatePipelineModal();
      return;
    }

    const found = pipelines.find((p) => String(p.id) === String(value));
    if (found) {
      setCurrentPipeline(found);
      setStages(found.stages || DEFAULT_STAGES);

      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem(pipelineListKey(found.id));
        setListFilter(stored || "all");
        window.localStorage.setItem(LAST_PIPELINE_KEY, found.id);
      } else {
        setListFilter("all");
      }
    }
  }

  // ---------- MODAL HANDLERS ----------

  function handleOpenLeadModal(lead) {
    setSelectedLead(lead);
    setIsLeadModalOpen(true);
  }

  function handleCloseLeadModal() {
    setIsLeadModalOpen(false);
    setSelectedLead(null);
  }

  function handleNotesUpdated(leadId, newNotes) {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, notes: newNotes } : l))
    );
    setSelectedLead((prev) =>
      prev && prev.id === leadId ? { ...prev, notes: newNotes } : prev
    );
  }

  if (loading)
    return <p style={{ textAlign: "center", color: "#fff" }}>Loading…</p>;

  const anyCollapsed = stages.some((s) => collapsedStages[s.id]);
  const newLeadStage = getNewLeadStage();
  const newLeadStageId = newLeadStage?.id;
  const stageIdSet = new Set(stages.map((s) => s.id));

  // filtered leads by list (for this board)
  const leadsForBoard =
    listFilter === "all"
      ? leads
      : leads.filter((l) => String(l.list_id) === String(listFilter));

  return (
    <>
      <Head>
        <title>CRM • Pipelines</title>
      </Head>

      <main style={styles.main}>
        {/* HEADER + CONTROL STRIP */}
        <div style={styles.bannerRow}>
          {/* main green banner – title + back only */}
          <div style={styles.bannerMain}>
            <div style={styles.bannerLeft}>
              <div style={styles.iconCircle}>📈</div>
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 48,
                    fontWeight: 700,
                  }}
                >
                  CRM Pipeline
                </h1>
                <p
                  style={{
                    margin: 0,
                    opacity: 0.9,
                    fontSize: 18,
                  }}
                >
                  Manage and move contacts between stages.
                </p>
              </div>
            </div>

            <Link href="/modules/email/crm">
              <button style={styles.backBtn}>← Back</button>
            </Link>
          </div>

          {/* slim control strip – all other buttons */}
          <div style={styles.bannerControls}>
            <div style={styles.bannerControlsInner}>
              <button
                onClick={() => setIsCompactMode((p) => !p)}
                style={
                  isCompactMode ? styles.compactActiveBtn : styles.compactBtn
                }
              >
                {isCompactMode ? "Expanded Mode" : "Compact Mode"}
              </button>

              <button
                onClick={() => {
                  if (anyCollapsed) {
                    expandAll();
                  } else {
                    collapseAll();
                  }
                }}
                style={styles.greenBtn}
              >
                {anyCollapsed ? "➕ Expand All" : "➖ Collapse All"}
              </button>

              {/* List picker */}
              <div style={styles.listPicker}>
                <span style={styles.listLabel}>List:</span>
                <select
                  style={styles.listSelect}
                  value={listFilter}
                  onChange={(e) => setListFilter(e.target.value)}
                >
                  <option value="all">All leads</option>
                  {lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Card style picker */}
              <div style={styles.cardStylePicker}>
                <span style={styles.cardStyleLabel}>Card style:</span>
                <button
                  style={
                    cardStyle === "glass"
                      ? styles.cardStyleButtonActive
                      : styles.cardStyleButton
                  }
                  onClick={() => persistCardStyle("glass")}
                >
                  Glass
                </button>
                <button
                  style={
                    cardStyle === "solid"
                      ? styles.cardStyleButtonActive
                      : styles.cardStyleButton
                  }
                  onClick={() => persistCardStyle("solid")}
                >
                  Solid
                </button>
                <button
                  style={
                    cardStyle === "minimal"
                      ? styles.cardStyleButtonActive
                      : styles.cardStyleButton
                  }
                  onClick={() => persistCardStyle("minimal")}
                >
                  Minimal
                </button>
              </div>

              {/* Pipeline selector pill */}
              <div style={styles.pipelineSelector}>
                <span style={styles.pipelineLabel}>Pipeline:</span>
                <select
                  style={styles.pipelineSelect}
                  value={currentPipeline ? currentPipeline.id : ""}
                  onChange={handlePipelineSelectChange}
                >
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || "Untitled pipeline"}
                    </option>
                  ))}
                  <option value="__new__">＋ Create new pipeline…</option>
                </select>
                <button
                  style={styles.pipelineSmallBtn}
                  onClick={openEditPipelineModal}
                  disabled={!currentPipeline}
                  title="Edit this pipeline"
                >
                  ✏
                </button>
                <button
                  style={styles.pipelineSmallBtn}
                  onClick={handleDeletePipeline}
                  disabled={!currentPipeline}
                  title="Delete this pipeline"
                >
                  🗑
                </button>
              </div>

              {/* File menu – pushed to far right */}
              <div style={styles.fileMenuWrapper} ref={fileMenuRef}>
                <button
                  onClick={() => setIsFileMenuOpen((p) => !p)}
                  style={styles.fileBtn}
                >
                  ☰ File
                </button>

                {isFileMenuOpen && (
                  <div style={styles.fileMenu}>
                    <button style={styles.fileMenuItem} onClick={handleFileSave}>
                      💾 Save
                    </button>
                    <button
                      style={styles.fileMenuItem}
                      onClick={handleFileSaveAs}
                    >
                      📝 Save As…
                    </button>
                    <button
                      style={styles.fileMenuItem}
                      onClick={handleFileImport}
                      disabled={isImporting}
                    >
                      📥{" "}
                      {isImporting ? "Importing…" : "Import (Reload Leads)"}
                    </button>
                    <button
                      style={styles.fileMenuItem}
                      onClick={handleFileExport}
                    >
                      📤 Export
                    </button>
                    <div style={styles.fileMenuDivider} />
                    <button
                      style={styles.fileMenuItem}
                      onClick={handleFileEditPipeline}
                    >
                      ✏ Edit Pipeline Stages
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* BOARD */}
        <div style={styles.scrollWrap}>
          <DndContext
            sensors={sensors}
            collisionDetection={rectIntersection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div style={styles.board}>
              {stages.map((stage) => {
                const filteredLeads = leadsForBoard.filter((l) => {
                  const effectiveStage =
                    !l.stage || !stageIdSet.has(l.stage)
                      ? newLeadStageId
                      : l.stage;
                  return effectiveStage === stage.id;
                });

                return (
                  <StageColumn
                    key={stage.id}
                    stage={stage}
                    leads={filteredLeads}
                    collapsed={collapsedStages[stage.id]}
                    onToggleCollapse={() => toggleCollapse(stage.id)}
                    isCompactMode={isCompactMode}
                    onLeadOpen={handleOpenLeadModal}
                    cardStyle={cardStyle}
                  />
                );
              })}
            </div>

            <DragOverlay>
              {activeLead ? (
                <LeadCard
                  lead={activeLead}
                  color={
                    stages.find((s) => s.id === activeLead.stage)?.color ||
                    "#3b82f6"
                  }
                  isCompactMode={isCompactMode}
                  cardStyle={cardStyle}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Save As */}
        {isSaveAsOpen && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <h2 style={styles.modalTitle}>Save Pipeline As</h2>
              <p style={styles.modalText}>
                Choose a name and (optional) location for the new pipeline. It
                will be saved to your account.
              </p>

              <label style={styles.modalLabel}>
                <span>Name</span>
                <input
                  type="text"
                  value={saveAsName}
                  onChange={(e) => setSaveAsName(e.target.value)}
                  style={styles.stageInput}
                  placeholder="New pipeline name"
                />
              </label>

              <label style={styles.modalLabel}>
                <span>Location (optional)</span>
                <input
                  type="text"
                  value={saveAsLocation}
                  onChange={(e) => setSaveAsLocation(e.target.value)}
                  style={styles.stageInput}
                  placeholder="e.g. /CRM/Health & Fitness"
                />
              </label>

              <div style={styles.modalActionsRight}>
                <button
                  onClick={() => setIsSaveAsOpen(false)}
                  style={styles.backBtn2}
                  disabled={isSavingAs}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSaveAs}
                  style={styles.saveBtn}
                  disabled={isSavingAs || !saveAsName.trim()}
                >
                  {isSavingAs ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stage editor */}
        {isStageEditorOpen && (
          <StageEditor
            stages={stages}
            onClose={() => setIsStageEditorOpen(false)}
            onSave={saveStagesToPipeline}
          />
        )}

        {/* Create / Edit Pipeline modal */}
        {isPipelineModalOpen && (
          <div style={styles.modalOverlay}>
            <div style={styles.pipelineModal}>
              <h2 style={styles.modalTitle}>
                {pipelineModalMode === "create"
                  ? "Create Pipeline"
                  : "Edit Pipeline"}
              </h2>
              <p style={styles.modalText}>
                Give this pipeline a clear name and choose which list of
                contacts you want to work with in this board.
              </p>

              <label style={styles.modalLabel}>
                <span>Pipeline name</span>
                <input
                  type="text"
                  style={styles.pipelineInput}
                  value={pipelineNameInput}
                  onChange={(e) => setPipelineNameInput(e.target.value)}
                  placeholder="e.g. Health & Fitness – New Enquiries"
                />
              </label>

              <label style={styles.modalLabel}>
                <span>List to use in this board</span>
                <select
                  style={styles.pipelineSelectLarge}
                  value={pipelineListIdInput}
                  onChange={(e) => setPipelineListIdInput(e.target.value)}
                >
                  <option value="all">All leads</option>
                  {lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </select>
              </label>

              <div style={styles.modalActionsRight}>
                <button
                  style={styles.backBtn2}
                  onClick={() => setIsPipelineModalOpen(false)}
                >
                  Cancel
                </button>
                <button style={styles.saveBtn} onClick={handleConfirmPipelineModal}>
                  {pipelineModalMode === "create"
                    ? "Create pipeline"
                    : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lead details modal – REUSABLE COMPONENT */}
        <LeadDetailsModal
          isOpen={isLeadModalOpen}
          lead={selectedLead}
          stages={stages}
          userId={userId}
          fontScale={fontScale}
          onClose={handleCloseLeadModal}
          onNotesUpdated={handleNotesUpdated}
        />
      </main>
    </>
  );
}

/* -------------------------------------------------------------
   STAGE COLUMN
------------------------------------------------------------- */
function StageColumn({
  stage,
  leads,
  collapsed,
  onToggleCollapse,
  isCompactMode,
  onLeadOpen,
  cardStyle,
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  if (collapsed)
    return (
      <div
        onClick={onToggleCollapse}
        style={{
          ...styles.columnCollapsed,
          borderRight: `5px solid ${stage.color}`,
        }}
      >
        <div
          style={{
            ...styles.collapsedText,
            color: stage.color,
          }}
        >
          {stage.title} ({leads.length})
        </div>
      </div>
    );

  return (
    <div
      ref={setNodeRef}
      style={{
        ...styles.column,
        border: `1px solid ${stage.color}`,
        background: isOver
          ? "rgba(255,255,255,0.12)"
          : "rgba(255,255,255,0.04)",
      }}
    >
      <div style={styles.columnHeader}>
        <h3 style={{ margin: 0, color: stage.color }}>
          {stage.title} ({leads.length})
        </h3>

        <button onClick={onToggleCollapse} style={styles.collapseBtn}>
          ➖
        </button>
      </div>

      <SortableContext
        items={leads.map((l) => l.id)}
        strategy={verticalListSortingStrategy}
      >
        <div style={styles.cardList}>
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              color={stage.color}
              isCompactMode={isCompactMode}
              onOpen={() => onLeadOpen && onLeadOpen(lead)}
              cardStyle={cardStyle}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

/* -------------------------------------------------------------
   LEAD CARD – whole card draggable, inner area clickable
------------------------------------------------------------- */
function LeadCard({ lead, color, isCompactMode, onOpen, cardStyle }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const visualStyles = getCardVisualStyles(cardStyle, color);

  const handleClick = (e) => {
    e.stopPropagation();
    if (isDragging) return;
    if (onOpen) onOpen();
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ...styles.card,
        ...visualStyles,
        opacity: isDragging ? 0.6 : 1,
        cursor: "grab",
      }}
    >
      <div
        style={styles.cardInner}
        onClick={handleClick}
        onDoubleClick={handleClick}
      >
        <span style={styles.dragHandle}>☰</span>

        <SubscriberAvatar lead={lead} size={28} fontSize={16} />

        <div style={{ flex: 1 }}>
          {isCompactMode ? (
            <strong style={styles.textWrap}>{lead.name || "Unnamed"}</strong>
          ) : (
            <>
              <h4 style={styles.textWrap}>{lead.name || "Unnamed"}</h4>
              <p style={styles.textWrap}>{lead.email || ""}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
   STAGE EDITOR MODAL
------------------------------------------------------------- */
function StageEditor({ stages, onClose, onSave }) {
  const [localStages, setLocalStages] = useState([...stages]);

  function updateStage(index, field, value) {
    const newStages = [...localStages];
    newStages[index][field] = value;
    setLocalStages(newStages);
  }

  function deleteStage(index) {
    const newStages = localStages.filter((_, i) => i !== index);
    setLocalStages(newStages);
  }

  function addStage() {
    setLocalStages([
      ...localStages,
      {
        id: "stage_" + Date.now(),
        title: "New Stage",
        color: "#ffffff",
      },
    ]);
  }

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <h2 style={styles.modalTitle}>Edit Pipeline Stages</h2>

        {localStages.map((stage, index) => (
          <div key={stage.id} style={styles.stageRow}>
            <input
              type="text"
              value={stage.title}
              onChange={(e) => updateStage(index, "title", e.target.value)}
              style={styles.stageInput}
            />
            <input
              type="color"
              value={stage.color}
              onChange={(e) => updateStage(index, "color", e.target.value)}
              style={styles.colorPicker}
            />
            <button onClick={() => deleteStage(index)} style={styles.deleteBtn}>
              🗑
            </button>
          </div>
        ))}

        <button onClick={addStage} style={styles.addBtn}>
          + Add Stage
        </button>

        <div style={styles.modalActionsRight}>
          <button onClick={onClose} style={styles.backBtn2}>
            Cancel
          </button>
          <button onClick={() => onSave(localStages)} style={styles.saveBtn}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------
   STYLES
------------------------------------------------------------- */
const styles = {
  main: {
    background: "#020617",
    color: "#fff",
    minHeight: "100vh",
    fontFamily:
      'Arial, "Helvetica Neue", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },

  // wrapper so banner + controls line up with board
  bannerRow: {
    width: "1320px",
    margin: "0 auto 18px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  // main green banner (title + back)
  bannerMain: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderRadius: "16px",
    background: "linear-gradient(175deg,#22c55e 0%,#15803d 100%)",
    boxShadow: "0 14px 35px rgba(0,0,0,0.6)",
  },

  bannerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
  },

  iconCircle: {
    width: "54px",
    height: "54px",
    borderRadius: "10px",
    display: "grid",
    placeItems: "center",
    background: "rgba(0,0,0,0.25)",
    fontSize: 40,
  },

  // control strip – same shape + gradient as bannerMain
  bannerControls: {
    borderRadius: 16,
    padding: "10px 14px",
    background: "linear-gradient(175deg,#22c55e 0%,#15803d 100%)",
    border: "1px solid rgba(34,197,94,0.85)",
    boxShadow: "0 10px 26px rgba(0,0,0,0.7)",
  },

  bannerControlsInner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 10,
    flexWrap: "wrap",
  },

  compactBtn: {
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.35)",
    borderRadius: "10px",
    padding: "8px 14px",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 16,
  },

  compactActiveBtn: {
    background: "#f59e0b",
    border: "none",
    borderRadius: "10px",
    padding: "8px 14px",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 16,
  },

  greenBtn: {
    background: "#22c55e",
    border: "none",
    borderRadius: "10px",
    padding: "8px 14px",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 16,
  },

  listPicker: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.32)",
  },

  listLabel: {
    fontSize: 16,
    opacity: 0.9,
  },

  listSelect: {
    fontSize: 16,
    padding: "4px 8px",
    borderRadius: 999,
    border: "none",
    background: "#020617",
    color: "#fff",
  },

  cardStylePicker: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.32)",
  },

  cardStyleLabel: {
    fontSize: 16,
    opacity: 0.9,
    marginRight: 4,
  },

  cardStyleButton: {
    border: "none",
    borderRadius: 999,
    padding: "4px 9px",
    fontSize: 16,
    cursor: "pointer",
    background: "transparent",
    color: "#f9fafb",
  },

  cardStyleButtonActive: {
    border: "none",
    borderRadius: 999,
    padding: "4px 11px",
    fontSize: 16,
    cursor: "pointer",
    background: "#0ea5e9",
    color: "#fff",
    fontWeight: 700,
  },

  pipelineSelector: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.32)",
  },

  pipelineLabel: {
    fontSize: 16,
  },

  pipelineSelect: {
    fontSize: 16,
    padding: "4px 10px",
    borderRadius: 999,
    border: "none",
    background: "#020617",
    color: "#fff",
    minWidth: 220,
  },

  pipelineSmallBtn: {
    background: "rgba(0,0,0,0.45)",
    borderRadius: 999,
    border: "none",
    padding: "4px 8px",
    cursor: "pointer",
    color: "#fff",
    fontSize: 16,
  },

  fileMenuWrapper: {
    position: "relative",
    marginLeft: "auto",
  },

  fileBtn: {
    background: "rgba(0,0,0,0.4)",
    borderRadius: "10px",
    padding: "9px 18px",
    color: "#fff",
    fontWeight: 700,
    border: "1px solid rgba(255,255,255,0.35)",
    cursor: "pointer",
    fontSize: 18,
  },

  fileMenu: {
    position: "absolute",
    top: "110%",
    right: 0,
    background: "#020617",
    borderRadius: "10px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.6)",
    padding: "8px 0",
    minWidth: "220px",
    zIndex: 20,
    border: "1px solid rgba(255,255,255,0.15)",
  },

  fileMenuItem: {
    width: "100%",
    padding: "8px 14px",
    textAlign: "left",
    background: "transparent",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    fontSize: 16,
  },

  fileMenuDivider: {
    height: "1px",
    margin: "4px 0",
    background: "rgba(255,255,255,0.15)",
  },

  backBtn: {
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.35)",
    borderRadius: "10px",
    padding: "8px 14px",
    color: "#fff",
    fontWeight: 500,
    cursor: "pointer",
    fontSize: 18,
  },

  scrollWrap: {
    width: "100%",
    overflowX: "auto",
  },

  board: {
    display: "flex",
    gap: "22px",
    padding: "0 20px 24px",
    alignItems: "flex-start",
    justifyContent: "center",
    margin: "0 auto",
    minWidth: "fit-content",
  },

  column: {
    flex: "0 0 auto",
    minWidth: "280px",
    maxWidth: "340px",
    borderRadius: "16px",
    padding: "12px",
    minHeight: "calc(100vh - 260px)",
    background: "rgba(15,23,42,0.9)",
  },

  columnCollapsed: {
    flex: "0 0 40px",
    width: "40px",
    borderRadius: "12px",
    minHeight: "calc(100vh - 260px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    position: "relative",
    background: "rgba(15,23,42,0.9)",
  },

  collapsedText: {
    position: "absolute",
    left: "50%",
    top: "50%",
    transform: "translate(-50%, -50%) rotate(-90deg)",
    transformOrigin: "center",
    fontWeight: 800,
    fontSize: 16,
    textAlign: "center",
    width: "160px",
  },

  columnHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: "6px",
    marginBottom: "10px",
  },

  collapseBtn: {
    background: "rgba(255,255,255,0.15)",
    border: "none",
    borderRadius: "8px",
    width: "28px",
    height: "28px",
    cursor: "pointer",
    color: "#fff",
    fontWeight: "bold",
  },

  cardList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  card: {
    padding: "10px 12px",
    borderRadius: "14px",
    userSelect: "none",
  },

  cardInner: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    cursor: "pointer",
  },

  dragHandle: {
    fontSize: 16,
    padding: "2px 6px",
    background: "rgba(0,0,0,0.25)",
    borderRadius: "999px",
    marginTop: 2,
  },

  textWrap: {
    margin: 0,
    wordBreak: "break-word",
    fontSize: 16,
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },

  modal: {
    background: "#020617",
    padding: "24px 26px",
    borderRadius: "16px",
    width: "520px",
    maxWidth: "90vw",
    maxHeight: "80vh",
    overflowY: "auto",
    border: "1px solid rgba(255,255,255,0.18)",
    boxShadow: "0 22px 60px rgba(0,0,0,0.8)",
  },

  pipelineModal: {
    background: "#020617",
    padding: "26px 28px",
    borderRadius: "18px",
    width: "560px",
    maxWidth: "92vw",
    maxHeight: "82vh",
    overflowY: "auto",
    border: "1px solid rgba(34,197,94,0.5)",
    boxShadow: "0 26px 70px rgba(0,0,0,0.9)",
  },

  modalTitle: {
    marginTop: 0,
    marginBottom: 10,
    fontSize: 24,
    fontWeight: 700,
  },

  modalText: {
    fontSize: 16,
    lineHeight: 1.5,
    marginBottom: 18,
    opacity: 0.9,
  },

  modalLabel: {
    display: "block",
    marginBottom: 14,
    fontSize: 16,
  },

  modalActionsRight: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 20,
    gap: 10,
  },

  stageRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "12px",
  },

  stageInput: {
    flex: 1,
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid #444",
    background: "#020617",
    color: "#fff",
    fontSize: 16,
  },

  colorPicker: {
    width: "48px",
    height: "34px",
    borderRadius: "6px",
    border: "1px solid #333",
    cursor: "pointer",
  },

  deleteBtn: {
    background: "#ef4444",
    border: "none",
    borderRadius: "6px",
    padding: "6px 10px",
    cursor: "pointer",
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },

  addBtn: {
    background: "#22c55e",
    border: "none",
    borderRadius: "8px",
    padding: "10px 14px",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    marginTop: "10px",
    fontSize: 16,
  },

  backBtn2: {
    background: "rgba(255,255,255,0.2)",
    borderRadius: "8px",
    padding: "8px 16px",
    color: "#fff",
    cursor: "pointer",
    border: "none",
    fontSize: 16,
  },

  saveBtn: {
    background: "#3b82f6",
    border: "none",
    borderRadius: "8px",
    padding: "8px 18px",
    color: "#fff",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: 16,
  },

  pipelineInput: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.9)",
    background: "#020617",
    color: "#fff",
    fontSize: 16,
  },

  pipelineSelectLarge: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.9)",
    background: "#020617",
    color: "#fff",
    fontSize: 16,
  },
};
