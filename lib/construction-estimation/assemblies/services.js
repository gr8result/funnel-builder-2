import { ESTIMATION_TRADE_CATEGORIES } from "../data/tradeCategories.js";

export const SERVICES_ASSEMBLIES = [
  {
    id: "plumbing_roughin",
    name: "Plumbing Rough-In",
    category: "Services",
    trade: ESTIMATION_TRADE_CATEGORIES.PLUMBING,
    quantityBasis: "plumbingPoints",
    scheduleDay: 85,
    materials: [{ materialId: "plumbing_roughin", factor: 1 }],
  },
  {
    id: "electrical_roughin",
    name: "Electrical Rough-In",
    category: "Services",
    trade: ESTIMATION_TRADE_CATEGORIES.ELECTRICAL,
    quantityBasis: "electricalPoints",
    scheduleDay: 85,
    materials: [{ materialId: "electrical_roughin", factor: 1 }],
  },
];
