import { ESTIMATION_TRADE_CATEGORIES } from "../data/tradeCategories.js";

export const LININGS_ASSEMBLIES = [
  {
    id: "insulation",
    name: "Insulation",
    category: "Linings",
    trade: ESTIMATION_TRADE_CATEGORIES.PLASTERING,
    quantityBasis: "insulationM2",
    scheduleDay: 98,
    materials: [{ materialId: "insulation", factor: 1 }],
  },
  {
    id: "plasterboard",
    name: "Plasterboard Linings",
    category: "Linings",
    trade: ESTIMATION_TRADE_CATEGORIES.PLASTERING,
    quantityBasis: "plasterboardM2",
    scheduleDay: 104,
    materials: [{ materialId: "plasterboard", factor: 1 }],
  },
];
