import { ESTIMATION_TRADE_CATEGORIES } from "../data/tradeCategories.js";

export const EXTERNAL_WORKS_ASSEMBLIES = [
  {
    id: "driveway",
    name: "Driveway",
    category: "External Works",
    trade: ESTIMATION_TRADE_CATEGORIES.CONCRETE,
    quantityBasis: "drivewayM2",
    scheduleDay: 170,
    materials: [{ materialId: "driveway", factor: 1 }],
  },
  {
    id: "retaining_walls",
    name: "Retaining Walls",
    category: "External Works",
    trade: ESTIMATION_TRADE_CATEGORIES.LANDSCAPING,
    appliesWhen: (input) => input.retainingWalls && input.retainingWalls !== "None",
    quantityBasis: "retainingWallLm",
    scheduleDay: 8,
    materials: [{ materialId: "retaining_wall", factor: 1 }],
  },
  {
    id: "landscaping",
    name: "Basic Landscaping",
    category: "External Works",
    trade: ESTIMATION_TRADE_CATEGORIES.LANDSCAPING,
    quantityBasis: "landscapingM2",
    scheduleDay: 175,
    materials: [{ materialId: "landscaping", factor: 1 }],
  },
];
