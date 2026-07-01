import { TRADE_CATEGORIES } from "./tradeCategories";

function hasFeature(answers, feature) {
  return (answers.additionalFeatures || []).includes(feature);
}

export const COMPLEXITY_RULES = [
  {
    id: "steep-heavy-earthworks",
    label: "Steep site / heavy cut and fill",
    applies: (answers) => ["Steep Slope", "Heavy Cut & Fill"].includes(answers.siteConditions),
    tasks: [
      { key: "earthworks", name: "Earthworks", group: "Ground Floor tasks", phase: "Site Preparation", duration: 5, trade: TRADE_CATEGORIES.SITE_WORKS, dependencies: ["set-out"], critical: true },
      { key: "cut-fill", name: "Cut & Fill", group: "Ground Floor tasks", phase: "Site Preparation", duration: 6, trade: TRADE_CATEGORIES.SITE_WORKS, dependencies: ["earthworks"], critical: true },
    ],
    dependencyRewrites: [{ task: "slab", addAfter: "cut-fill" }, { task: "ground-floor-structure", addAfter: "cut-fill" }],
  },
  {
    id: "retaining-walls",
    label: "Retaining walls",
    applies: (answers) => answers.retainingWalls && answers.retainingWalls !== "None",
    tasks: [
      { key: "retaining-wall-setout", name: "Retaining Wall Set Out", group: "Ground Floor tasks", phase: "Site Preparation", duration: 1, trade: TRADE_CATEGORIES.SURVEY, dependencies: ["set-out"], critical: false },
      { key: "retaining-walls", name: "Retaining Walls", group: "Ground Floor tasks", phase: "Site Preparation", duration: 8, trade: TRADE_CATEGORIES.SITE_WORKS, dependencies: ["retaining-wall-setout"], critical: true },
    ],
    dependencyRewrites: [{ task: "slab", addAfter: "retaining-walls" }, { task: "ground-floor-structure", addAfter: "retaining-walls" }],
  },
  {
    id: "global-scaffolding",
    label: "Scaffolding",
    applies: (answers) => hasFeature(answers, "Scaffolding"),
    tasks: [
      { key: "scaffold-install", name: "Scaffold Install", group: "Roof / external envelope", phase: "Frame Stage", duration: 2, trade: TRADE_CATEGORIES.SPECIALIST, dependencies: ["frame"], critical: true },
      { key: "scaffold-removal", name: "Scaffold Removal", group: "Roof / external envelope", phase: "External Works", duration: 2, trade: TRADE_CATEGORIES.SPECIALIST, dependencies: ["lock-up"], critical: false },
    ],
    dependencyRewrites: [{ task: "roof", addAfter: "scaffold-install" }],
  },
  {
    id: "lightweight-cladding",
    label: "Lightweight cladding",
    applies: (answers) => ["Lightweight Cladding", "Mixed Construction"].includes(answers.wallConstruction),
    tasks: [
      { key: "cladding-installation", name: "Lightweight Cladding Installation", group: "Roof / external envelope", phase: "Lock-Up Stage", duration: 10, trade: TRADE_CATEGORIES.CLADDING, dependencies: ["frame"], critical: true },
    ],
    dependencyRewrites: [{ task: "lock-up", addAfter: "cladding-installation" }],
  },
  {
    id: "structural-steel",
    label: "Structural steel",
    applies: (answers) => hasFeature(answers, "Structural Steel"),
    tasks: [
      { key: "structural-steel", name: "Structural Steel Install", group: "Ground Floor tasks", phase: "Frame Stage", duration: 5, trade: TRADE_CATEGORIES.SPECIALIST, dependencies: ["slab"], critical: true },
    ],
    dependencyRewrites: [{ task: "frame", addAfter: "structural-steel" }],
  },
  {
    id: "pool",
    label: "Pool",
    applies: (answers) => hasFeature(answers, "Pool"),
    tasks: [
      { key: "pool-excavation", name: "Pool Excavation", group: "Completion", phase: "External Works", duration: 4, trade: TRADE_CATEGORIES.EXTERNAL, dependencies: ["site-preparation"], critical: false },
      { key: "pool-shell", name: "Pool Shell", group: "Completion", phase: "External Works", duration: 10, trade: TRADE_CATEGORIES.EXTERNAL, dependencies: ["pool-excavation"], critical: false },
    ],
  },
  {
    id: "basement",
    label: "Basement",
    applies: (answers) => hasFeature(answers, "Basement"),
    tasks: [
      { key: "basement-excavation", name: "Basement Excavation", group: "Ground Floor tasks", phase: "Foundations", duration: 10, trade: TRADE_CATEGORIES.SITE_WORKS, dependencies: ["set-out"], critical: true },
      { key: "basement-structure", name: "Basement Structure", group: "Ground Floor tasks", phase: "Foundations", duration: 15, trade: TRADE_CATEGORIES.CONCRETE, dependencies: ["basement-excavation"], critical: true },
    ],
    dependencyRewrites: [{ task: "slab", addAfter: "basement-structure" }, { task: "ground-floor-structure", addAfter: "basement-structure" }],
  },
  {
    id: "balconies",
    label: "Balconies",
    applies: (answers) => hasFeature(answers, "Balconies") || hasFeature(answers, "Suspended Deck"),
    tasks: [
      { key: "balcony-frame", name: "Balcony / Deck Frame", group: "First Floor tasks", phase: "Frame Stage", duration: 5, trade: TRADE_CATEGORIES.CARPENTRY, dependencies: ["frame"], critical: false },
      { key: "balcony-waterproofing", name: "Balcony Waterproofing", group: "First Floor tasks", phase: "External Works", duration: 3, trade: TRADE_CATEGORIES.SPECIALIST, dependencies: ["balcony-frame"], critical: false },
    ],
  },
];
