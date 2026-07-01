import { ESTIMATION_TRADE_CATEGORIES } from "../data/tradeCategories.js";

export const SLAB_ASSEMBLIES = [
  {
    id: "waffle_pod_slab",
    name: "Waffle Pod Slab",
    category: "Slab",
    trade: ESTIMATION_TRADE_CATEGORIES.CONCRETE,
    appliesWhen: (input) => input.slabType === "Waffle Pod",
    quantityBasis: "slabM2",
    scheduleDay: 14,
    materials: [
      { materialId: "waffle_pods", factor: 1 },
      { materialId: "concrete_25mpa", factor: 0.12 },
      { materialId: "reinforcement_mesh", factor: 1.05 },
      { materialId: "vapour_barrier", factor: 1.1 },
    ],
  },
  {
    id: "raft_slab",
    name: "Raft Slab",
    category: "Slab",
    trade: ESTIMATION_TRADE_CATEGORIES.CONCRETE,
    appliesWhen: (input) => input.slabType === "Raft Slab" || input.slabType === "Conventional Slab",
    quantityBasis: "slabM2",
    scheduleDay: 14,
    materials: [
      { materialId: "concrete_25mpa", factor: 0.16 },
      { materialId: "reinforcement_mesh", factor: 1.15 },
      { materialId: "vapour_barrier", factor: 1.1 },
    ],
  },
  {
    id: "suspended_slab",
    name: "Suspended / Split Level Slab",
    category: "Slab",
    trade: ESTIMATION_TRADE_CATEGORIES.CONCRETE,
    appliesWhen: (input) => input.slabType === "Suspended Slab" || input.slabType === "Split Level Slab",
    quantityBasis: "slabM2",
    scheduleDay: 18,
    materials: [
      { materialId: "concrete_25mpa", factor: 0.18 },
      { materialId: "reinforcement_mesh", factor: 1.25 },
    ],
  },
];
