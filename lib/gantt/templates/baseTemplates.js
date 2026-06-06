import { TRADE_CATEGORIES } from "./tradeCategories";

export const MULTI_STOREY_TYPES = ["Double Storey Home", "Triple Storey Home"];

export const FLOOR_LEVELS = [
  { key: "ground", label: "Ground Floor", storeyTypes: ["Double Storey Home", "Triple Storey Home"] },
  { key: "first", label: "First Floor", storeyTypes: ["Double Storey Home", "Triple Storey Home"] },
  { key: "second", label: "Second Floor", storeyTypes: ["Triple Storey Home"] },
];

const floorStructureOptions = ["Concrete slab", "Suspended concrete", "Timber floor system", "Steel floor system"];
const externalWallOptions = ["Brick veneer", "Blockwork", "Hebel", "Lightweight cladding", "Rendered cladding", "Mixed"];
const internalFrameOptions = ["Timber frame", "Steel frame", "Masonry"];
const floorSpecialOptions = ["Structural steel", "Scaffold required", "Balcony", "Upper floor services", "Feature cladding"];

export const QUESTIONNAIRE_CONFIG = [
  {
    key: "projectType",
    label: "Project Type",
    multiple: false,
    options: [
      "Single Storey Home",
      "Double Storey Home",
      "Triple Storey Home",
      "Duplex",
      "Townhouses",
      "Renovation",
      "Extension",
      "Commercial",
    ],
  },
  {
    key: "siteConditions",
    label: "Site Conditions",
    multiple: false,
    options: ["Flat Site", "Mild Slope", "Moderate Slope", "Steep Slope", "Heavy Cut & Fill"],
  },
  {
    key: "slabType",
    label: "Slab Type",
    multiple: false,
    simpleOnly: true,
    options: ["Waffle Pod", "Raft Slab", "Conventional Slab", "Suspended Slab", "Split Level Slab"],
  },
  {
    key: "wallConstruction",
    label: "Wall Construction",
    multiple: false,
    simpleOnly: true,
    options: ["Brick Veneer", "Double Brick", "Hebel", "Lightweight Cladding", "Rendered Cladding", "Mixed Construction"],
  },
  {
    key: "roofType",
    label: "Roof Type",
    multiple: false,
    options: ["Colorbond", "Concrete Tile", "Terracotta Tile", "Flat Roof", "Skillion Roof"],
  },
  {
    key: "retainingWalls",
    label: "Retaining Walls",
    multiple: false,
    options: ["None", "Timber", "Concrete Sleepers", "Block Retaining", "Engineered Retaining"],
  },
  {
    key: "siteAccess",
    label: "Site Access",
    multiple: false,
    options: ["Easy", "Moderate", "Restricted", "Difficult"],
  },
  {
    key: "additionalFeatures",
    label: "Additional Features",
    multiple: true,
    options: [
      "Pool",
      "Basement",
      "Lift",
      "Solar",
      "Battery",
      "Scaffolding",
      "Structural Steel",
      "Suspended Deck",
      "Balconies",
      "Extensive Landscaping",
    ],
  },
  ...FLOOR_LEVELS.flatMap((level) => [
    {
      key: `${level.key}FloorStructure`,
      label: `${level.label} - Floor Structure`,
      multiple: false,
      storeyTypes: level.storeyTypes,
      options: floorStructureOptions,
    },
    {
      key: `${level.key}ExternalWall`,
      label: `${level.label} - External Wall`,
      multiple: false,
      storeyTypes: level.storeyTypes,
      options: externalWallOptions,
    },
    {
      key: `${level.key}InternalFrame`,
      label: `${level.label} - Internal Frame`,
      multiple: false,
      storeyTypes: level.storeyTypes,
      options: internalFrameOptions,
    },
    {
      key: `${level.key}SpecialRequirements`,
      label: `${level.label} - Special Requirements`,
      multiple: true,
      storeyTypes: level.storeyTypes,
      options: floorSpecialOptions,
    },
  ]),
];

export const BASE_TEMPLATES = [
  {
    id: "single-storey-home",
    label: "Single Storey Home",
    matches: ["Single Storey Home"],
    mode: "single",
    tasks: [
      { key: "site-preparation", name: "Site Preparation", group: "Ground Floor tasks", phase: "Site Preparation", duration: 5, trade: TRADE_CATEGORIES.SITE_WORKS, dependencies: [], critical: true },
      { key: "set-out", name: "Set Out", group: "Ground Floor tasks", phase: "Site Preparation", duration: 1, trade: TRADE_CATEGORIES.SURVEY, dependencies: ["site-preparation"], critical: true },
      { key: "slab", name: "Waffle Pod Slab", group: "Ground Floor tasks", phase: "Foundations", duration: 10, trade: TRADE_CATEGORIES.CONCRETE, dependencies: ["set-out"], critical: true },
      { key: "frame", name: "Ground Floor Frame", group: "Ground Floor tasks", phase: "Frame Stage", duration: 15, trade: TRADE_CATEGORIES.CARPENTRY, dependencies: ["slab"], critical: true },
      { key: "roof", name: "Colorbond Roof", group: "Roof / external envelope", phase: "Lock-Up Stage", duration: 7, trade: TRADE_CATEGORIES.ROOFING, dependencies: ["frame"], critical: true },
      { key: "brickwork", name: "Brick Veneer", group: "Roof / external envelope", phase: "Lock-Up Stage", duration: 14, trade: TRADE_CATEGORIES.MASONRY, dependencies: ["frame"], critical: true },
      { key: "lock-up", name: "Lock Up", group: "Roof / external envelope", phase: "Lock-Up Stage", duration: 5, trade: TRADE_CATEGORIES.CARPENTRY, dependencies: ["roof", "brickwork"], critical: true },
      { key: "rough-in", name: "Services Rough-In", group: "Internal works", phase: "Rough-In Stage", duration: 8, trade: TRADE_CATEGORIES.SERVICES, dependencies: ["lock-up"], critical: true },
      { key: "fix-out", name: "Fix Out", group: "Internal works", phase: "Fix-Out Stage", duration: 20, trade: TRADE_CATEGORIES.FINISHES, dependencies: ["rough-in"], critical: true },
      { key: "practical-completion", name: "Practical Completion", group: "Completion", phase: "Completion", duration: 5, trade: TRADE_CATEGORIES.SUPERVISION, dependencies: ["fix-out"], critical: true },
    ],
  },
  {
    id: "double-storey-home",
    label: "Double Storey Home",
    matches: ["Double Storey Home"],
    mode: "multi",
  },
  {
    id: "triple-storey-home",
    label: "Triple Storey Home",
    matches: ["Triple Storey Home"],
    mode: "multi",
  },
  {
    id: "duplex",
    label: "Duplex",
    matches: ["Duplex", "Townhouses"],
    mode: "single",
    durationMultiplier: 1.45,
    tasks: [],
  },
  {
    id: "renovation-extension",
    label: "Renovation / Extension",
    matches: ["Renovation", "Extension"],
    mode: "single",
    tasks: [
      { key: "site-protection", name: "Site Protection & Demolition Prep", group: "Ground Floor tasks", phase: "Site Preparation", duration: 4, trade: TRADE_CATEGORIES.SITE_WORKS, dependencies: [], critical: true },
      { key: "demolition", name: "Demolition / Strip Out", group: "Ground Floor tasks", phase: "Site Preparation", duration: 7, trade: TRADE_CATEGORIES.SITE_WORKS, dependencies: ["site-protection"], critical: true },
      { key: "set-out", name: "Set Out", group: "Ground Floor tasks", phase: "Site Preparation", duration: 1, trade: TRADE_CATEGORIES.SURVEY, dependencies: ["demolition"], critical: true },
      { key: "slab", name: "Footings / Slab Works", group: "Ground Floor tasks", phase: "Foundations", duration: 8, trade: TRADE_CATEGORIES.CONCRETE, dependencies: ["set-out"], critical: true },
      { key: "frame", name: "Alteration Frame", group: "Ground Floor tasks", phase: "Frame Stage", duration: 12, trade: TRADE_CATEGORIES.CARPENTRY, dependencies: ["slab"], critical: true },
      { key: "roof", name: "Roof Tie-In", group: "Roof / external envelope", phase: "Lock-Up Stage", duration: 6, trade: TRADE_CATEGORIES.ROOFING, dependencies: ["frame"], critical: true },
      { key: "lock-up", name: "Lock Up", group: "Roof / external envelope", phase: "Lock-Up Stage", duration: 5, trade: TRADE_CATEGORIES.CARPENTRY, dependencies: ["roof"], critical: true },
      { key: "rough-in", name: "Services Rough-In", group: "Internal works", phase: "Rough-In Stage", duration: 7, trade: TRADE_CATEGORIES.SERVICES, dependencies: ["lock-up"], critical: true },
      { key: "fix-out", name: "Fix Out", group: "Internal works", phase: "Fix-Out Stage", duration: 18, trade: TRADE_CATEGORIES.FINISHES, dependencies: ["rough-in"], critical: true },
      { key: "practical-completion", name: "Practical Completion", group: "Completion", phase: "Completion", duration: 5, trade: TRADE_CATEGORIES.SUPERVISION, dependencies: ["fix-out"], critical: true },
    ],
  },
];
