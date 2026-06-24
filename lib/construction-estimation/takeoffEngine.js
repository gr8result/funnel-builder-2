import { AUSTRALIAN_DEFAULTS } from "./data/australianDefaults.js";
import { MATERIAL_CATALOG } from "./data/materialCatalog.js";

export function generateMaterialTakeoff(assemblies = [], quantities = {}) {
  return assemblies.map((assembly) => ({
    assemblyId: assembly.id,
    category: assembly.category,
    trade: assembly.trade,
    items: (assembly.materials || []).map((material) => {
      const catalogItem = MATERIAL_CATALOG[material.materialId] || { name: material.materialId, unit: "item", wasteCategory: "general" };
      const basis = material.quantityBasis || assembly.quantityBasis;
      const quantity = round((quantities[basis] || 0) * (Number(material.factor) || 1));
      const wasteFactor = AUSTRALIAN_DEFAULTS.wasteFactors[catalogItem.wasteCategory] ?? AUSTRALIAN_DEFAULTS.wasteFactors.general;
      return {
        materialId: material.materialId,
        description: catalogItem.name,
        quantity,
        unit: catalogItem.unit,
        wasteFactor,
        finalQuantity: round(quantity * (1 + wasteFactor)),
        placeholderRate: null,
      };
    }).filter((item) => item.quantity > 0),
  })).filter((group) => group.items.length > 0);
}

function round(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}
