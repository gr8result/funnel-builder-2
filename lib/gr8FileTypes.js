export const GR8_FILE_TYPES = Object.freeze({
  aiPlanTakeoff: {
    moduleType: "ai-plan-takeoff",
    gr8FileType: "ai-plan-takeoff",
    extension: ".gr8takeoff",
    description: "Gr8 Result AI Plan Takeoff",
  },
  estimate: {
    moduleType: "estimate",
    gr8FileType: "estimate",
    extension: ".gr8estimate",
    description: "Gr8 Result Estimate",
  },
  quotation: {
    moduleType: "quotation",
    gr8FileType: "quotation",
    extension: ".gr8quote",
    description: "Gr8 Result Quotation",
  },
  clientSelections: {
    moduleType: "client-selections",
    gr8FileType: "client-selections",
    extension: ".gr8selections",
    description: "Gr8 Result Client Selections",
  },
  completeProject: {
    moduleType: "complete-project",
    gr8FileType: "complete-project",
    extension: ".gr8job",
    description: "Gr8 Result Complete Project",
  },
});

export const AI_PLAN_TAKEOFF_FILE_TYPE = GR8_FILE_TYPES.aiPlanTakeoff;
export const AI_PLAN_TAKEOFF_EXTENSION = AI_PLAN_TAKEOFF_FILE_TYPE.extension;

export function filenameWithoutKnownGr8Extension(fileName = "") {
  const text = String(fileName || "").trim();
  return Object.values(GR8_FILE_TYPES).reduce((name, type) => (
    name.toLowerCase().endsWith(type.extension) ? name.slice(0, -type.extension.length) : name
  ), text).replace(/\.json$/i, "");
}
