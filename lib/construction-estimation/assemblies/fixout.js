import { ESTIMATION_TRADE_CATEGORIES } from "../data/tradeCategories.js";

export const FIXOUT_ASSEMBLIES = [
  {
    id: "cabinetry",
    name: "Cabinetry",
    category: "Fix-Out",
    trade: ESTIMATION_TRADE_CATEGORIES.CABINETRY,
    quantityBasis: "cabinetryLm",
    scheduleDay: 145,
    materials: [{ materialId: "cabinetry", factor: 1 }],
  },
  {
    id: "painting",
    name: "Painting",
    category: "Fix-Out",
    trade: ESTIMATION_TRADE_CATEGORIES.PAINTING,
    quantityBasis: "paintM2",
    scheduleDay: 150,
    materials: [{ materialId: "paint", factor: 1 }],
  },
  {
    id: "flooring",
    name: "Floor Finishes",
    category: "Fix-Out",
    trade: ESTIMATION_TRADE_CATEGORIES.FLOORING,
    quantityBasis: "flooringM2",
    scheduleDay: 160,
    materials: [{ materialId: "flooring", factor: 1 }],
  },
];
