import { ESTIMATION_TRADE_CATEGORIES } from "../data/tradeCategories.js";

export const ROOFING_ASSEMBLIES = [
  {
    id: "colorbond_roof",
    name: "Colorbond Roof",
    category: "Roofing",
    trade: ESTIMATION_TRADE_CATEGORIES.ROOFING,
    appliesWhen: (input) => input.roofType === "Colorbond" || input.roofType === "Skillion Roof" || input.roofType === "Flat Roof",
    quantityBasis: "roofM2",
    scheduleDay: 55,
    materials: [
      { materialId: "roof_sheeting", factor: 1 },
      { materialId: "roof_sarking", factor: 1 },
      { materialId: "gutters", quantityBasis: "roofPerimeterLm", factor: 1 },
    ],
  },
  {
    id: "tile_roof",
    name: "Tile Roof",
    category: "Roofing",
    trade: ESTIMATION_TRADE_CATEGORIES.ROOFING,
    appliesWhen: (input) => input.roofType === "Concrete Tile" || input.roofType === "Terracotta Tile",
    quantityBasis: "roofM2",
    scheduleDay: 58,
    materials: [
      { materialId: "roof_tiles", factor: 1 },
      { materialId: "roof_sarking", factor: 1 },
      { materialId: "gutters", quantityBasis: "roofPerimeterLm", factor: 1 },
    ],
  },
];
