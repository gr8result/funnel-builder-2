import { ESTIMATION_TRADE_CATEGORIES } from "../data/tradeCategories.js";

export const WINDOWS_DOORS_ASSEMBLIES = [
  {
    id: "windows_external_doors",
    name: "Windows and External Doors",
    category: "Windows & Doors",
    trade: ESTIMATION_TRADE_CATEGORIES.WINDOWS_DOORS,
    quantityBasis: "windowDoorItems",
    scheduleDay: 70,
    materials: [{ materialId: "windows_doors", factor: 1 }],
  },
];
