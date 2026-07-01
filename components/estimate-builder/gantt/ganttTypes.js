// ganttTypes.js — shared constants and factory functions for the AI Gantt Builder.

// ── Stage definitions (standard residential construction sequence) ────────────

export const DEFAULT_STAGES = [
  "Preliminaries & Admin",
  "Site Setup",
  "Approvals & Engineering",
  "Earthworks & Site Prep",
  "Slab / Base Stage",
  "Frame Stage",
  "Roof Stage",
  "Lock-Up Stage",
  "Fit-Out / Rough-Ins",
  "Waterproofing & Tiling",
  "Linings & Plaster",
  "Joinery & Cabinetry",
  "Fit-Off Trades",
  "Painting",
  "Flooring",
  "Appliances & Fixtures",
  "External Works",
  "Final Clean & Inspections",
  "Practical Completion",
  "Handover",
];

// ── Procurement types ─────────────────────────────────────────────────────────

export const PROCUREMENT_TYPES = [
  { value: "",           label: "— none —"              },
  { value: "quote",      label: "Obtain Quote"          },
  { value: "approve",    label: "Approve Quote"         },
  { value: "order",      label: "Raise Purchase Order"  },
  { value: "delivery",   label: "Delivery / Delivery ETA" },
  { value: "inspection", label: "Inspection / Hold Point" },
  { value: "milestone",  label: "Milestone"             },
];

// ── Confidence ────────────────────────────────────────────────────────────────

export const CONFIDENCE = { HIGH: "high", MEDIUM: "medium", LOW: "low" };

// ── ID generator ──────────────────────────────────────────────────────────────

let _seq = 0;
export function newTaskId() { return `t-${Date.now()}-${++_seq}`; }

// ── Task factory ──────────────────────────────────────────────────────────────

export function createTask(overrides = {}) {
  return {
    id:              newTaskId(),
    stage:           "",
    task:            "",
    trade:           "",
    durationDays:    5,
    dependsOn:       [],       // array of task ids
    startOffsetDays: 0,        // calculated by resolver, user-editable override
    requiredOrderDate: null,   // ISO date string or null
    notes:           "",
    included:        true,
    isProcurement:   false,
    procurementType: "",       // "" | "quote" | "approve" | "order" | "delivery" | "inspection" | "milestone"
    confidence:      CONFIDENCE.MEDIUM,
    source:          "ai",     // "ai" | "manual"
    ...overrides,
  };
}

// ── Project storage shape ─────────────────────────────────────────────────────
//
// {
//   id:               string,
//   jobId:            string,
//   projectName:      string,
//   projectStartDate: ISO date string,
//   createdAt:        ISO date string,
//   updatedAt:        ISO date string,
//   draftSchedule:    Task[] | null,
//   approvedSchedule: Task[] | null,
//   status:           "idle" | "draft" | "approved",
// }
