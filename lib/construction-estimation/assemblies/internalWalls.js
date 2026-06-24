import { ESTIMATION_TRADE_CATEGORIES } from "../data/tradeCategories.js";

export const INTERNAL_WALL_ASSEMBLIES = [
  {
    id: "internal_framing",
    name: "Internal Wall Framing",
    category: "Internal Walls",
    trade: ESTIMATION_TRADE_CATEGORIES.CARPENTRY,
    quantityBasis: "internalWallLm",
    scheduleDay: 42,
    materials: [{ materialId: "timber_frame", factor: 1 }],
  },
];
