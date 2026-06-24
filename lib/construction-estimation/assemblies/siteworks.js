import { ESTIMATION_TRADE_CATEGORIES } from "../data/tradeCategories.js";

export const SITEWORKS_ASSEMBLIES = [
  {
    id: "site_establishment",
    name: "Site Establishment",
    category: "Siteworks",
    trade: ESTIMATION_TRADE_CATEGORIES.SITEWORKS,
    quantityBasis: "siteItem",
    scheduleDay: 0,
    materials: [{ materialId: "site_setup", factor: 1 }],
  },
  {
    id: "earthworks_cut_fill",
    name: "Earthworks / Cut and Fill",
    category: "Siteworks",
    trade: ESTIMATION_TRADE_CATEGORIES.SITEWORKS,
    appliesWhen: (input) => ["Moderate Slope", "Steep Slope", "Heavy Cut & Fill"].includes(input.siteConditions),
    quantityBasis: "earthworksM3",
    scheduleDay: 3,
    materials: [
      { materialId: "excavation", factor: 1 },
      { materialId: "fill", factor: 0.35 },
    ],
  },
];
