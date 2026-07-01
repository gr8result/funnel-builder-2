import { ESTIMATION_TRADE_CATEGORIES } from "../data/tradeCategories.js";

export const WET_AREA_ASSEMBLIES = [
  {
    id: "waterproofing",
    name: "Wet Area Waterproofing",
    category: "Wet Areas",
    trade: ESTIMATION_TRADE_CATEGORIES.WATERPROOFING,
    quantityBasis: "wetAreaM2",
    scheduleDay: 120,
    materials: [{ materialId: "waterproofing", factor: 1 }],
  },
  {
    id: "tiling",
    name: "Wet Area Tiling",
    category: "Wet Areas",
    trade: ESTIMATION_TRADE_CATEGORIES.TILING,
    quantityBasis: "wetAreaM2",
    scheduleDay: 126,
    materials: [{ materialId: "tiles", factor: 1 }],
  },
];
