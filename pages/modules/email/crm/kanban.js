// /pages/modules/email/crm/kanban.js
// World-class AI-powered Kanban board for the CRM pipeline.
//
// Architecture:
//   - Columns  = pipeline stages (from crm_pipelines or DEFAULT_STAGES)
//   - Cards    = leads (from the `leads` Supabase table)
//   - Drag     = moves a card between columns → updates leads.stage in Supabase
//   - AI       = per-card or whole-board analysis via /api/crm/ai-analyze-lead
//                returns priority score (1-10), temperature (hot/warm/cold),
//                next-action text, and a stage recommendation
//
// AI scores are cached in component state (keyed by lead.id) and survive
// re-renders but reset on page refresh (intentional — scores should stay fresh).
//
// Every interaction is optimistic: the UI updates instantly and Supabase
// is written to in the background.

import Head from "next/head";
import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  rectIntersection,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "../../../../utils/supabase-client";
import LeadDetailsModal from "../../../../components/crm/LeadDetailsModal";

/* ─────────────────────────────────────────────────────────────────
   CONSTANTS & DEFAULTS
───────────────────────────────────────────────────────────────── */

const DEFAULT_STAGES = [
  { id: "new_lead",      title: "New Lead",      color: "#22c55e" },
  { id: "first_contact", title: "First Contact", color: "#0ea5e9" },
  { id: "follow_up",     title: "Follow Up",     color: "#f59e0b" },
  { id: "proposal",      title: "Proposal",      color: "#a855f7" },
  { id: "won",           title: "Won ✓",         color: "#10b981" },
  { id: "lost",          title: "Lost",          color: "#ef4444" },
];

const LAST_PIPELINE_KEY = "crm:kanban:lastPipelineId";
const TEMP_COLORS = { hot: "#ef4444", warm: "#f59e0b", cold: "#64748b" };
const TEMP_LABELS = { hot: "🔥 Hot", warm: "🌡 Warm", cold: "❄️ Cold" };

/* ─────────────────────────────────────────────────────────────────
   PURE HELPERS
───────────────────────────────────────────────────────────────── */

function initials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => (w[0] || "").toUpperCase())
    .join("") || "?";
}

function formatAUD(v) {
  const n = Number(v || 0);
  if (!n) return null;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function staleWarning(days) {
  if (!days || days < 7) return null;
  if (days >= 30) return { label: `${days}d — stale`, color: "#ef4444" };
  if (days >= 14) return { label: `${days}d`, color: "#f59e0b" };
  return null;
}

/* ─────────────────────────────────────────────────────────────────
   SMALL UI ATOMS
───────────────────────────────────────────────────────────────── */

function Avatar({ name, size = 34, color = "#0ea5e9" }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `${color}20`,
        border: `2px solid ${color}50`,
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 600,
        fontSize: size * 0.36,
        flexShrink: 0,
        userSelect: "none",
        letterSpacing: -0.5,
      }}
    >
      {initials(name)}
    </div>
  );
}

function TempBadge({ temperature }) {
  if (!temperature) return null;
  const color = TEMP_COLORS[temperature] || "#64748b";
  return (
    <span
      style={{
        background: `${color}18`,
        border: `1px solid ${color}45`,
        color,
        borderRadius: 6,
        padding: "2px 7px",
        fontSize: 16,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {TEMP_LABELS[temperature] || temperature}
    </span>
  );
}

function ScoreDots({ score }) {
  if (!score) return null;
  const filled = Math.round(Math.max(1, Math.min(10, score)));
  const color = filled >= 8 ? "#ef4444" : filled >= 5 ? "#f59e0b" : "#64748b";
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: i < filled ? color : "rgba(255,255,255,0.1)",
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

function Spinner({ size = 16, color = "#64748b" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      style={{ animation: "kanban-spin 0.8s linear infinite", flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────
   AI INSIGHT PANEL — shown inline below a card when expanded
───────────────────────────────────────────────────────────────── */

function AiInsightPanel({ insight, loading, error, onClose }) {
  return (
    <div
      style={{
        marginTop: 6,
        background: "rgba(139,92,246,0.06)",
        border: "1px solid rgba(139,92,246,0.25)",
        borderRadius: 8,
        padding: "10px 12px",
        fontSize: 16,
        lineHeight: 1.55,
      }}
    >
      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#94a3b8" }}>
          <Spinner size={13} color="#a78bfa" />
          <span>Analysing…</span>
        </div>
      )}
      {error && <span style={{ color: "#f87171" }}>⚠ {error}</span>}
      {insight && !loading && (
        <>
          <p style={{ margin: "0 0 6px", color: "#c4b5fd", fontWeight: 600 }}>
            🤖 AI Insight
          </p>
          <p style={{ margin: "0 0 6px", color: "#e2e8f0" }}>{insight.insight}</p>
          {insight.nextAction && (
            <p style={{ margin: "0 0 4px", color: "#94a3b8" }}>
              <strong style={{ color: "#a78bfa" }}>Next: </strong>
              {insight.nextAction}
            </p>
          )}
          {insight.stageRecommendation && (
            <p style={{ margin: 0, color: "#64748b", fontSize: 16 }}>
              Suggested stage: <em style={{ color: "#7dd3fc" }}>{insight.stageRecommendation}</em>
            </p>
          )}
        </>
      )}
      <button
        onClick={onClose}
        style={{
          marginTop: 8,
          background: "none",
          border: "none",
          color: "#475569",
          fontSize: 16,
          cursor: "pointer",
          padding: 0,
        }}
      >
        Dismiss ✕
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   KANBAN CARD
───────────────────────────────────────────────────────────────── */

function KanbanCard({ lead, stageColor, aiScore, aiLoading, onOpen, onAnalyze, onDismissInsight }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: lead.id });

  const value = formatAUD(lead.deal_value);
  const days  = daysSince(lead.stage_entered_at || lead.created_at);
  const stale = staleWarning(days);
  const showInsight = aiScore && !aiLoading;
  const [insightOpen, setInsightOpen] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.25 : 1,
        marginBottom: 8,
        cursor: isDragging ? "grabbing" : "grab",
      }}
      {...attributes}
      {...listeners}
    >
      <div
        style={{
          background: "rgba(15,23,42,0.94)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderLeft: `3px solid ${stageColor}`,
          borderRadius: 10,
          padding: "11px 12px 10px",
          transition: "border-color 0.15s, background 0.15s, box-shadow 0.15s",
          position: "relative",
          overflow: "hidden",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(30,41,59,0.97)";
          e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.35)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(15,23,42,0.94)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {/* AI score accent line */}
        {aiScore?.score && (
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: `${aiScore.score * 10}%`,
              height: 2,
              background: TEMP_COLORS[aiScore.temperature] || stageColor,
              borderRadius: "0 10px 0 0",
              opacity: 0.7,
            }}
          />
        )}

        {/* Row 1: avatar + name + open-modal button */}
        <div
          style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 7 }}
        >
          <Avatar name={lead.name || lead.email} color={stageColor} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                color: "#f1f5f9",
                fontWeight: 600,
                fontSize: 16,
                lineHeight: 1.3,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {lead.name || "Unnamed Lead"}
            </div>
            {lead.email && (
              <div
                style={{
                  color: "#475569",
                  fontSize: 11.5,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  marginTop: 1,
                }}
              >
                {lead.email}
              </div>
            )}
          </div>

          {/* Open modal — stops drag propagation */}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onOpen(lead); }}
            style={{
              flexShrink: 0,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              color: "#64748b",
              cursor: "pointer",
              fontSize: 16,
              padding: "3px 7px",
              lineHeight: 1,
              transition: "color 0.1s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#e2e8f0")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#64748b")}
            title="Open full details"
          >
            ↗
          </button>
        </div>

        {/* Row 2: badges */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
          {value && (
            <span
              style={{
                background: "rgba(16,185,129,0.1)",
                border: "1px solid rgba(16,185,129,0.25)",
                color: "#34d399",
                borderRadius: 5,
                padding: "2px 7px",
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              {value}
            </span>
          )}
          {lead.source && (
            <span
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#94a3b8",
                borderRadius: 5,
                padding: "2px 7px",
                fontSize: 16,
              }}
            >
              {lead.source}
            </span>
          )}
          {stale && (
            <span
              style={{
                background: `${stale.color}15`,
                border: `1px solid ${stale.color}40`,
                color: stale.color,
                borderRadius: 5,
                padding: "2px 7px",
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              ⏱ {stale.label}
            </span>
          )}
          {aiScore?.temperature && <TempBadge temperature={aiScore.temperature} />}
        </div>

        {/* Row 3: AI score dots + AI button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 8,
          }}
        >
          {aiScore?.score ? (
            <ScoreDots score={aiScore.score} />
          ) : (
            <div />
          )}

          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (showInsight) {
                setInsightOpen((p) => !p);
              } else {
                onAnalyze(lead);
                setInsightOpen(true);
              }
            }}
            style={{
              background: insightOpen
                ? "rgba(139,92,246,0.2)"
                : "rgba(139,92,246,0.08)",
              border: "1px solid rgba(139,92,246,0.3)",
              borderRadius: 6,
              color: "#a78bfa",
              cursor: "pointer",
              fontSize: 16,
              fontWeight: 600,
              padding: "3px 8px",
              display: "flex",
              alignItems: "center",
              gap: 4,
              transition: "background 0.15s",
            }}
            title="AI analyse this lead"
          >
            {aiLoading ? <Spinner size={11} color="#a78bfa" /> : "✦"}
            {aiLoading ? " Analysing" : insightOpen && showInsight ? " Hide" : " AI"}
          </button>
        </div>

        {/* AI insight panel */}
        {insightOpen && (
          <AiInsightPanel
            insight={aiScore}
            loading={aiLoading}
            error={null}
            onClose={() => {
              setInsightOpen(false);
              onDismissInsight(lead.id);
            }}
          />
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   KANBAN COLUMN
───────────────────────────────────────────────────────────────── */

function KanbanColumn({ stage, leads, aiScores, aiLoadingIds, onOpen, onAnalyze, onDismissInsight }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  const totalValue = leads.reduce((sum, l) => sum + Number(l.deal_value || 0), 0);
  const formattedTotal = formatAUD(totalValue);

  return (
    <div
      ref={setNodeRef}
      style={{
        flexShrink: 0,
        width: 272,
        display: "flex",
        flexDirection: "column",
        borderRadius: 14,
        background: isOver
          ? "rgba(255,255,255,0.05)"
          : "rgba(255,255,255,0.025)",
        border: `1px solid ${isOver ? stage.color + "60" : "rgba(255,255,255,0.06)"}`,
        borderTop: `3px solid ${stage.color}`,
        transition: "border-color 0.15s, background 0.15s",
        overflow: "hidden",
        maxHeight: "calc(100vh - 130px)",
      }}
    >
      {/* Column header */}
      <div
        style={{
          padding: "12px 14px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: stage.color,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              color: "#e2e8f0",
              fontWeight: 600,
              fontSize: 16,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {stage.title}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {formattedTotal && (
            <span style={{ color: "#34d399", fontSize: 16, fontWeight: 600 }}>
              {formattedTotal}
            </span>
          )}
          <span
            style={{
              background: `${stage.color}22`,
              color: stage.color,
              borderRadius: 999,
              padding: "2px 8px",
              fontSize: 16,
              fontWeight: 600,
              minWidth: 22,
              textAlign: "center",
            }}
          >
            {leads.length}
          </span>
        </div>
      </div>

      {/* Card list — scrolls independently */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "10px 10px 14px",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.08) transparent",
        }}
      >
        <SortableContext
          items={leads.map((l) => l.id)}
          strategy={verticalListSortingStrategy}
        >
          {leads.map((lead) => (
            <KanbanCard
              key={lead.id}
              lead={lead}
              stageColor={stage.color}
              aiScore={aiScores[lead.id] || null}
              aiLoading={aiLoadingIds.has(lead.id)}
              onOpen={onOpen}
              onAnalyze={onAnalyze}
              onDismissInsight={onDismissInsight}
            />
          ))}
        </SortableContext>

        {leads.length === 0 && (
          <div
            style={{
              color: "rgba(100,116,139,0.45)",
              fontSize: 16,
              textAlign: "center",
              paddingTop: 20,
              fontStyle: "italic",
              userSelect: "none",
            }}
          >
            Drop leads here
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   PIPELINE HEALTH BANNER  (AI-generated summary of the board)
───────────────────────────────────────────────────────────────── */

function HealthBanner({ health, loading, onRefresh }) {
  if (!health && !loading) return null;

  return (
    <div
      style={{
        margin: "0 20px 14px",
        padding: "10px 16px",
        borderRadius: 10,
        background: "rgba(139,92,246,0.07)",
        border: "1px solid rgba(139,92,246,0.2)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 12.5,
        color: "#c4b5fd",
        lineHeight: 1.5,
      }}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>✦</span>
      {loading ? (
        <span style={{ color: "#7c3aed" }}>
          <Spinner size={13} color="#a78bfa" /> AI is analysing your pipeline…
        </span>
      ) : (
        <span style={{ flex: 1 }}>{health}</span>
      )}
      {health && !loading && (
        <button
          onClick={onRefresh}
          style={{
            background: "none",
            border: "none",
            color: "#6d28d9",
            cursor: "pointer",
            fontSize: 16,
            padding: "2px 6px",
            borderRadius: 4,
            flexShrink: 0,
          }}
          title="Refresh AI analysis"
        >
          ↺
        </button>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────────────── */

export default function KanbanBoard() {
  /* ── state ── */
  const [userId,          setUserId]          = useState(null);
  const [pipelines,       setPipelines]       = useState([]);
  const [currentPipeline, setCurrentPipeline] = useState(null);
  const [stages,          setStages]          = useState(DEFAULT_STAGES);
  const [leads,           setLeads]           = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [search,          setSearch]          = useState("");

  // drag
  const [activeLead, setActiveLead] = useState(null);

  // modal
  const [modalLead,    setModalLead]    = useState(null);
  const [isModalOpen,  setIsModalOpen]  = useState(false);

  // AI
  const [aiScores,       setAiScores]       = useState({});  // { leadId: { score, temperature, nextAction, insight, stageRecommendation } }
  const [aiLoadingIds,   setAiLoadingIds]   = useState(new Set());
  const [boardAnalyzing, setBoardAnalyzing] = useState(false);
  const [healthText,     setHealthText]     = useState("");
  const [healthLoading,  setHealthLoading]  = useState(false);

  /* ── dnd sensors ── */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  /* ── initial load ── */
  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) return;
      const uid = authData.user.id;
      setUserId(uid);

      const [pipeRes, leadRes] = await Promise.all([
        supabase
          .from("crm_pipelines")
          .select("id, name, stages")
          .eq("user_id", uid)
          .order("created_at", { ascending: true }),
        supabase
          .from("leads")
          .select("id, name, email, phone, stage, source, tags, deal_value, created_at, stage_entered_at")
          .eq("user_id", uid),
      ]);

      const pipelineRows = pipeRes.data || [];
      setPipelines(pipelineRows);

      let activePipe = pipelineRows[0] || null;
      if (typeof window !== "undefined") {
        const lastId = window.localStorage.getItem(LAST_PIPELINE_KEY);
        if (lastId) {
          const found = pipelineRows.find((p) => String(p.id) === lastId);
          if (found) activePipe = found;
        }
      }

      applyPipeline(activePipe);
      setLeads(leadRes.data || []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPipeline(p) {
    setCurrentPipeline(p);
    const stageList = p?.stages?.length ? p.stages : DEFAULT_STAGES;
    setStages(stageList);
    if (typeof window !== "undefined" && p?.id) {
      window.localStorage.setItem(LAST_PIPELINE_KEY, String(p.id));
    }
  }

  /* ── board helpers ── */
  const stageIdSet = new Set(stages.map((s) => s.id));
  const defaultStageId = stages[0]?.id || "";

  const filteredLeads = search.trim()
    ? leads.filter(
        (l) =>
          (l.name || "").toLowerCase().includes(search.toLowerCase()) ||
          (l.email || "").toLowerCase().includes(search.toLowerCase()) ||
          (l.source || "").toLowerCase().includes(search.toLowerCase())
      )
    : leads;

  function leadsForStage(stageId) {
    return filteredLeads.filter((l) => {
      const eff = l.stage && stageIdSet.has(l.stage) ? l.stage : defaultStageId;
      return eff === stageId;
    });
  }

  /* ── drag handlers ── */
  function handleDragStart({ active }) {
    setActiveLead(leads.find((l) => l.id === active.id) || null);
  }

  async function handleDragEnd({ active, over }) {
    setActiveLead(null);
    if (!over || active.id === over.id) return;

    // `over.id` is either a stageId (dropped on column droppable)
    // or a leadId (dropped on another card — find that card's stage)
    let targetStage = stageIdSet.has(over.id)
      ? over.id
      : leads.find((l) => l.id === over.id)?.stage || null;

    if (!targetStage || !stageIdSet.has(targetStage)) return;
    if (leads.find((l) => l.id === active.id)?.stage === targetStage) return;

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) =>
        l.id === active.id
          ? { ...l, stage: targetStage, stage_entered_at: new Date().toISOString() }
          : l
      )
    );

    // Persist
    await supabase
      .from("leads")
      .update({ stage: targetStage, stage_entered_at: new Date().toISOString() })
      .eq("id", active.id);
  }

  /* ── modal ── */
  function openModal(lead) {
    setModalLead(lead);
    setIsModalOpen(true);
  }

  /* ── AI: analyse a single lead ── */
  const analyzeCard = useCallback(async (lead) => {
    if (aiLoadingIds.has(lead.id)) return;

    setAiLoadingIds((prev) => new Set([...prev, lead.id]));

    try {
      const days = daysSince(lead.stage_entered_at || lead.created_at);
      const res = await fetch("/api/crm/ai-analyze-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leads: [{ ...lead, days_in_stage: days }],
          stages,
        }),
      });
      const json = await res.json();
      if (json.ok && Array.isArray(json.results) && json.results[0]) {
        setAiScores((prev) => ({ ...prev, [lead.id]: json.results[0] }));
      }
    } catch (err) {
      console.warn("AI card analysis failed:", err);
    } finally {
      setAiLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });
    }
  }, [aiLoadingIds, stages]);

  /* ── AI: analyse all visible leads ── */
  async function analyzeBoard() {
    if (boardAnalyzing) return;
    setBoardAnalyzing(true);
    setHealthLoading(true);

    const batch = filteredLeads.slice(0, 20).map((l) => ({
      ...l,
      days_in_stage: daysSince(l.stage_entered_at || l.created_at),
    }));

    // Mark all as loading
    setAiLoadingIds(new Set(batch.map((l) => l.id)));

    try {
      const res = await fetch("/api/crm/ai-analyze-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: batch, stages }),
      });
      const json = await res.json();

      if (json.ok && Array.isArray(json.results)) {
        const newScores = {};
        for (const r of json.results) {
          if (r.id) newScores[r.id] = r;
        }
        setAiScores((prev) => ({ ...prev, ...newScores }));

        // Derive a health summary from the scores
        const hot   = json.results.filter((r) => r.temperature === "hot").length;
        const warm  = json.results.filter((r) => r.temperature === "warm").length;
        const cold  = json.results.filter((r) => r.temperature === "cold").length;
        const total = json.results.length;
        const avgScore = total
          ? (json.results.reduce((s, r) => s + (r.score || 0), 0) / total).toFixed(1)
          : 0;

        setHealthText(
          `Pipeline score: ${avgScore}/10 · ${hot} hot, ${warm} warm, ${cold} cold across ${total} leads. ` +
          (hot > 0
            ? `Focus on your ${hot} hot lead${hot > 1 ? "s" : ""} — they're ready to close.`
            : warm > 0
            ? `Nurture your ${warm} warm lead${warm > 1 ? "s" : ""} to push them toward close.`
            : "Pipeline needs attention — most leads are cold.")
        );
      }
    } catch (err) {
      console.warn("Board analysis failed:", err);
    } finally {
      setAiLoadingIds(new Set());
      setBoardAnalyzing(false);
      setHealthLoading(false);
    }
  }

  function dismissInsight(leadId) {
    setAiScores((prev) => {
      const next = { ...prev };
      delete next[leadId];
      return next;
    });
  }

  /* ── summary stats ── */
  const totalValue = filteredLeads.reduce((s, l) => s + Number(l.deal_value || 0), 0);
  const hotCount   = Object.values(aiScores).filter((s) => s.temperature === "hot").length;

  /* ───────────────────────────────────────────────────────────────
     RENDER
  ─────────────────────────────────────────────────────────────── */
  return (
    <>
      <Head>
        <title>Kanban · CRM</title>
      </Head>

      <style>{`
        @keyframes kanban-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(160deg, #050b18 0%, #080f1e 100%)",
          display: "flex",
          flexDirection: "column",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          color: "#e2e8f0",
        }}
      >
        {/* ── Top bar ───────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(5,11,24,0.97)",
            backdropFilter: "blur(8px)",
            flexWrap: "wrap",
            flexShrink: 0,
          }}
        >
          <Link
            href="/modules/email/crm"
            style={{
              color: "#475569",
              fontSize: 16,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            ← CRM
          </Link>

          <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.08)" }} />

          <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: -0.3, whiteSpace: "nowrap" }}>
            📋 Kanban Board
          </span>

          {/* Pipeline picker */}
          {pipelines.length > 0 && (
            <select
              value={currentPipeline?.id || ""}
              onChange={(e) => {
                const p = pipelines.find((x) => String(x.id) === e.target.value);
                if (p) applyPipeline(p);
              }}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                color: "#e2e8f0",
                fontSize: 16,
                padding: "5px 10px",
                cursor: "pointer",
              }}
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id} style={{ background: "#0f172a" }}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          {/* Stats */}
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginLeft: 4 }}>
            <span style={{ color: "#475569", fontSize: 16 }}>
              {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""}
            </span>
            {totalValue > 0 && (
              <span style={{ color: "#34d399", fontSize: 16, fontWeight: 600 }}>
                {formatAUD(totalValue)}
              </span>
            )}
            {hotCount > 0 && (
              <span style={{ color: "#ef4444", fontSize: 16, fontWeight: 600 }}>
                🔥 {hotCount} hot
              </span>
            )}
          </div>

          {/* Search */}
          <input
            type="search"
            placeholder="Search leads…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              marginLeft: "auto",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 8,
              color: "#e2e8f0",
              fontSize: 16,
              padding: "5px 12px",
              outline: "none",
              width: 190,
            }}
          />

          {/* AI Analyse Board */}
          <button
            onClick={analyzeBoard}
            disabled={boardAnalyzing || loading}
            style={{
              background: boardAnalyzing
                ? "rgba(139,92,246,0.08)"
                : "rgba(139,92,246,0.14)",
              border: "1px solid rgba(139,92,246,0.35)",
              borderRadius: 8,
              color: "#a78bfa",
              cursor: boardAnalyzing ? "default" : "pointer",
              fontSize: 16,
              fontWeight: 600,
              padding: "5px 14px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
              transition: "background 0.15s",
            }}
          >
            {boardAnalyzing ? <Spinner size={13} color="#a78bfa" /> : "✦"}
            {boardAnalyzing ? "Analysing…" : "AI Analyse Board"}
          </button>
        </div>

        {/* ── AI health banner ──────────────────────────────────── */}
        <HealthBanner
          health={healthText}
          loading={healthLoading}
          onRefresh={analyzeBoard}
        />

        {/* ── Board ─────────────────────────────────────────────── */}
        {loading ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#475569",
              fontSize: 16,
              gap: 10,
            }}
          >
            <Spinner size={18} color="#334155" />
            Loading pipeline…
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              overflowX: "auto",
              overflowY: "hidden",
              padding: "16px 20px 24px",
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(255,255,255,0.08) transparent",
            }}
          >
            <DndContext
              sensors={sensors}
              collisionDetection={rectIntersection}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div
                style={{
                  display: "inline-flex",
                  gap: 14,
                  alignItems: "flex-start",
                  minHeight: "calc(100vh - 130px)",
                }}
              >
                {stages.map((stage) => (
                  <KanbanColumn
                    key={stage.id}
                    stage={stage}
                    leads={leadsForStage(stage.id)}
                    aiScores={aiScores}
                    aiLoadingIds={aiLoadingIds}
                    onOpen={openModal}
                    onAnalyze={analyzeCard}
                    onDismissInsight={dismissInsight}
                  />
                ))}
              </div>

              <DragOverlay dropAnimation={null}>
                {activeLead && (
                  <div
                    style={{
                      background: "rgba(15,23,42,0.97)",
                      border: "1px solid rgba(255,255,255,0.18)",
                      borderRadius: 10,
                      padding: "11px 13px",
                      width: 248,
                      boxShadow: "0 24px 48px rgba(0,0,0,0.7)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      transform: "rotate(1.5deg)",
                    }}
                  >
                    <Avatar
                      name={activeLead.name || activeLead.email}
                      color={
                        stages.find((s) => s.id === activeLead.stage)?.color || "#0ea5e9"
                      }
                    />
                    <div>
                      <div style={{ color: "#f1f5f9", fontWeight: 600, fontSize: 16 }}>
                        {activeLead.name || "Unnamed Lead"}
                      </div>
                      {activeLead.email && (
                        <div style={{ color: "#475569", fontSize: 11.5 }}>
                          {activeLead.email}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          </div>
        )}
      </div>

      {/* Lead detail modal */}
      {isModalOpen && modalLead && (
        <LeadDetailsModal
          lead={modalLead}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onLeadUpdate={(updated) => {
            setLeads((prev) =>
              prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l))
            );
            setModalLead((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
          }}
        />
      )}
    </>
  );
}

