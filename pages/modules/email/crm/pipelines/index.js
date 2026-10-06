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
} from "@dnd-kit/core";

import LeadDetailsModal from "../../../../../components/crm/LeadDetailsModal";
import styles from "../../../../../components/crm/pipelines/pipelineStyles";
import { parseList, formatMoney, buildDefaultTeams } from "../../../../../components/crm/pipelines/pipelineSharedHelpers";
import StageColumn from "../../../../../components/crm/pipelines/StageColumn";
import LeadCard from "../../../../../components/crm/pipelines/LeadCard";
import TeamManagerModal from "../../../../../components/crm/pipelines/TeamManagerModal";
import StageEditor from "../../../../../components/crm/pipelines/StageEditor";

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
const TEAM_STORAGE_KEY_PREFIX = "crm:pipeline:teams:";
const PIPELINE_TEAM_KEY_PREFIX = "crm:pipeline:teamAssignments:";
const LEAD_META_KEY_PREFIX = "crm:pipeline:leadMeta:";

function readStoredJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredJson(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}


function getInitials(value) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (!parts.length) return "•";
  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
}

function getLeadCrmMeta(lead, metaMap = {}) {
  return {
    source: lead?.source || "",
    tags: lead?.tags || "",
    product: lead?.product || "",
    ...(metaMap?.[lead?.id] || {}),
    ...(lead?.crmMeta || {}),
  };
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
  const [crmTasks, setCrmTasks] = useState([]);
  const [leadMetaMap, setLeadMetaMap] = useState({});
  const [teamRows, setTeamRows] = useState([]);
  const [currentPipelineTeamId, setCurrentPipelineTeamId] = useState("");
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);

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

    await Promise.all([
      loadLists(uid),
      loadPipelines(uid),
      loadLeads(uid),
      loadCrmTasks(uid),
    ]);
    setLoading(false);
  }

  async function loadCrmTasks(uid) {
    try {
      const { data, error } = await supabase
        .from("crm_tasks")
        .select("id, due_date, completed, contact_id")
        .eq("user_id", uid);

      if (error) {
        console.warn("loadCrmTasks error:", error);
        setCrmTasks([]);
      } else {
        setCrmTasks(data || []);
      }
    } catch (err) {
      console.warn("loadCrmTasks exception:", err);
      setCrmTasks([]);
    }
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

  useEffect(() => {
    if (!userId) return;

    const teamsKey = `${TEAM_STORAGE_KEY_PREFIX}${userId}`;
    const leadMetaKey = `${LEAD_META_KEY_PREFIX}${userId}`;

    const storedTeams = readStoredJson(teamsKey, []);
    if (storedTeams.length) {
      setTeamRows(storedTeams);
    } else {
      const defaults = buildDefaultTeams();
      setTeamRows(defaults);
      writeStoredJson(teamsKey, defaults);
    }

    setLeadMetaMap(readStoredJson(leadMetaKey, {}));
  }, [userId]);

  useEffect(() => {
    if (!userId || !currentPipeline?.id) {
      setCurrentPipelineTeamId("");
      return;
    }

    const map = readStoredJson(`${PIPELINE_TEAM_KEY_PREFIX}${userId}`, {});
    setCurrentPipelineTeamId(map[currentPipeline.id] || "");
  }, [userId, currentPipeline?.id]);

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

  function handleFileNewPipeline() {
    openCreatePipelineModal();
    setIsFileMenuOpen(false);
  }

  function handleFileRenamePipeline() {
    openEditPipelineModal();
    setIsFileMenuOpen(false);
  }

  function handleFileDuplicatePipeline() {
    handleFileSaveAs();
  }

  async function handleFileDeleteCurrentPipeline() {
    setIsFileMenuOpen(false);
    await handleDeletePipeline();
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

  function handleSaveTeams(nextTeams) {
    setTeamRows(nextTeams);
    if (userId) {
      writeStoredJson(`${TEAM_STORAGE_KEY_PREFIX}${userId}`, nextTeams);
    }
  }

  function handleAssignPipelineTeam(teamId) {
    setCurrentPipelineTeamId(teamId || "");
    if (!userId || !currentPipeline?.id) return;
    const key = `${PIPELINE_TEAM_KEY_PREFIX}${userId}`;
    const map = readStoredJson(key, {});
    map[currentPipeline.id] = teamId || "";
    writeStoredJson(key, map);
  }

  async function handleLeadMetaSave(leadId, meta) {
    if (!userId || !leadId) return;
    const key = `${LEAD_META_KEY_PREFIX}${userId}`;
    const next = { ...readStoredJson(key, {}), [leadId]: meta };
    const currentLead = leads.find((item) => item.id === leadId);
    const lostStage = stages.find(
      (stage) =>
        String(stage?.id) === "not_qualified" ||
        String(stage?.title || "").toLowerCase().includes("not qualified")
    );
    const shouldMoveToNotQualified =
      String(meta?.status || "").toLowerCase() === "lost" &&
      lostStage?.id &&
      currentLead?.stage !== lostStage.id;

    writeStoredJson(key, next);
    setLeadMetaMap(next);
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId
          ? { ...lead, crmMeta: meta, ...(shouldMoveToNotQualified ? { stage: lostStage.id } : {}) }
          : lead
      )
    );
    setSelectedLead((prev) =>
      prev && prev.id === leadId
        ? { ...prev, crmMeta: meta, ...(shouldMoveToNotQualified ? { stage: lostStage.id } : {}) }
        : prev
    );

    if (shouldMoveToNotQualified) {
      try {
        const { error } = await supabase
          .from("leads")
          .update({ stage: lostStage.id, updated_at: new Date() })
          .eq("id", leadId);

        if (error) {
          console.error("Move lost lead error:", error);
        }
      } catch (err) {
        console.error("Move lost lead error:", err);
      }
    }
  }

  // ---------- MODAL HANDLERS ----------

  function handleOpenLeadModal(lead) {
    const meta = getLeadCrmMeta(lead, leadMetaMap);
    setSelectedLead({ ...lead, crmMeta: meta });
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
  const leadsForBoardRaw =
    listFilter === "all"
      ? leads
      : leads.filter((l) => String(l.list_id) === String(listFilter));

  const leadsForBoard = leadsForBoardRaw.map((lead) => ({
    ...lead,
    crmMeta: getLeadCrmMeta(lead, leadMetaMap),
  }));

  const currentTeam =
    teamRows.find((team) => String(team.id) === String(currentPipelineTeamId)) ||
    null;

  const currentTeamMembers = currentTeam
    ? Array.from(new Set([currentTeam.manager, ...parseList(currentTeam.members)].filter(Boolean)))
    : [];

  const pipelineSummary = (() => {
    const today = new Date();
    let pipelineValue = 0;
    let weightedForecast = 0;
    let closingSoon = 0;
    let highPriority = 0;
    let unassigned = 0;

    for (const lead of leadsForBoard) {
      const meta = lead.crmMeta || {};
      const dealValue = Number(meta.dealValue || 0);
      const probability = Math.max(0, Math.min(100, Number(meta.probability || 0)));
      pipelineValue += dealValue;
      weightedForecast += dealValue * (probability / 100);
      if ((meta.priority || "").toLowerCase() === "high") highPriority++;
      if (!String(meta.owner || "").trim()) unassigned++;

      if (meta.closeDate) {
        const close = new Date(meta.closeDate);
        const diff = Math.ceil((close.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (Number.isFinite(diff) && diff >= 0 && diff <= 14) closingSoon++;
      }
    }

    const overdueActivities = crmTasks.filter((task) => {
      if (!task?.due_date || task?.completed) return false;
      const due = new Date(task.due_date);
      due.setHours(0, 0, 0, 0);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      return due < now;
    }).length;

    return {
      pipelineValue,
      weightedForecast,
      closingSoon,
      highPriority,
      unassigned,
      overdueActivities,
      teamCount: teamRows.length,
    };
  })();

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
                    fontWeight: 600,
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

              {/* Team selector pill */}
              <div style={styles.pipelineSelector}>
                <span style={styles.pipelineLabel}>Team:</span>
                <select
                  style={{ ...styles.pipelineSelect, minWidth: 170 }}
                  value={currentPipelineTeamId || ""}
                  onChange={(e) => handleAssignPipelineTeam(e.target.value)}
                >
                  <option value="">No team</option>
                  {teamRows.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
                <button
                  style={styles.pipelineSmallBtn}
                  onClick={() => setIsTeamModalOpen(true)}
                  title="Manage sales teams"
                >
                  👥
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
                    <button style={styles.fileMenuItem} onClick={handleFileNewPipeline}>
                      ➕ New Pipeline…
                    </button>
                    <button
                      style={styles.fileMenuItem}
                      onClick={handleFileRenamePipeline}
                      disabled={!currentPipeline}
                    >
                      ✏ Rename / Settings…
                    </button>
                    <button
                      style={styles.fileMenuItem}
                      onClick={handleFileDuplicatePipeline}
                      disabled={!currentPipeline}
                    >
                      📑 Duplicate Pipeline…
                    </button>
                    <div style={styles.fileMenuDivider} />
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
                      📥 {isImporting ? "Importing…" : "Import (Reload Leads)"}
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
                      onClick={() => {
                        setIsTeamModalOpen(true);
                        setIsFileMenuOpen(false);
                      }}
                    >
                      👥 Manage Sales Teams
                    </button>
                    <button
                      style={styles.fileMenuItem}
                      onClick={handleFileEditPipeline}
                      disabled={!currentPipeline}
                    >
                      🧱 Edit Pipeline Stages
                    </button>
                    <button
                      style={{ ...styles.fileMenuItem, color: "#fca5a5" }}
                      onClick={handleFileDeleteCurrentPipeline}
                      disabled={!currentPipeline}
                    >
                      🗑 Delete Current Pipeline
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            width: "1320px",
            margin: "0 auto 14px",
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 10,
          }}
        >
          {[
            {
              label: currentTeam ? `Team • ${currentTeam.name}` : "Teams",
              value: `${pipelineSummary.teamCount}`,
              sub: currentTeam
                ? `Manager: ${currentTeam.manager || "Not set"}`
                : "Assign this pipeline to a team",
              tone: currentTeam?.color || "#22c55e",
              members: currentTeamMembers,
            },
            {
              label: "Pipeline Value",
              value: formatMoney(pipelineSummary.pipelineValue),
              sub: `${pipelineSummary.highPriority} high-priority opportunities`,
              tone: "#0ea5e9",
            },
            {
              label: "Anticipated Revenue",
              value: formatMoney(pipelineSummary.weightedForecast),
              sub: `${pipelineSummary.closingSoon} deals closing in 14 days`,
              tone: "#a855f7",
            },
            {
              label: "Activity Focus",
              value: `${pipelineSummary.overdueActivities}`,
              sub: `${pipelineSummary.unassigned} deals missing an owner`,
              tone: "#f59e0b",
            },
          ].map((card) => (
            <div
              key={card.label}
              style={{
                background: "#0f172a",
                border: `1px solid ${card.tone}55`,
                borderRadius: 14,
                padding: "14px 16px",
                boxShadow: "0 10px 22px rgba(0,0,0,0.35)",
              }}
            >
              <div style={{ color: "#94a3b8", fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
                {card.label}
              </div>
              <div style={{ color: "#fff", fontSize: 26, fontWeight: 600, lineHeight: 1.1 }}>
                {card.value}
              </div>
              <div style={{ color: card.tone, fontSize: 16, marginTop: 6, fontWeight: 600 }}>
                {card.sub}
              </div>

              {!!card.members?.length && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                  {card.members.slice(0, 6).map((member) => (
                    <span
                      key={`${card.label}-${member}`}
                      title={member}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 8px",
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "#e5e7eb",
                        fontSize: 16,
                        fontWeight: 600,
                      }}
                    >
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 999,
                          display: "grid",
                          placeItems: "center",
                          background: `${card.tone}22`,
                          color: card.tone,
                          fontSize: 16,
                          fontWeight: 600,
                        }}
                      >
                        👤
                      </span>
                      {member}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
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

        {isTeamModalOpen && (
          <TeamManagerModal
            teams={teamRows}
            onClose={() => setIsTeamModalOpen(false)}
            onSave={(nextTeams) => {
              handleSaveTeams(nextTeams);
              setIsTeamModalOpen(false);
            }}
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
          crmMeta={selectedLead?.crmMeta || {}}
          teamOptions={teamRows}
          onCrmMetaSave={handleLeadMetaSave}
        />
      </main>
    </>
  );
}
