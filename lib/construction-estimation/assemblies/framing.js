import { ESTIMATION_TRADE_CATEGORIES } from "../data/tradeCategories.js";

export const FRAMING_ASSEMBLIES = [
  {
    id: "timber_frame",
    name: "Timber Wall Frame",
    category: "Framing",
    trade: ESTIMATION_TRADE_CATEGORIES.CARPENTRY,
    quantityBasis: "frameLm",
    scheduleDay: 35,
    materials: [{ materialId: "timber_frame", factor: 1 }],
  },
  {
    id: "structural_steel",
    name: "Structural Steel",
    category: "Framing",
    trade: ESTIMATION_TRADE_CATEGORIES.STEEL,
    appliesWhen: (input) => input.additionalFeatures.includes("Structural Steel"),
    quantityBasis: "structuralSteelT",
    scheduleDay: 30,
    materials: [{ materialId: "structural_steel", factor: 1 }],
  },
];
