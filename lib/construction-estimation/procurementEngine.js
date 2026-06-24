import { PROCUREMENT_LEAD_TIMES } from "./data/procurementLeadTimes.js";

export function generateProcurementPlan(takeoffGroups = [], assemblies = []) {
  const assemblyMap = new Map(assemblies.map((assembly) => [assembly.id, assembly]));
  const items = [];

  takeoffGroups.forEach((group) => {
    const assembly = assemblyMap.get(group.assemblyId);
    group.items.forEach((item) => {
      const lead = PROCUREMENT_LEAD_TIMES[item.materialId];
      if (!lead) return;
      const requiredByDay = assembly?.scheduleDay ?? 0;
      items.push({
        materialId: item.materialId,
        name: item.description,
        trade: group.trade,
        supplierCategory: lead.supplierCategory,
        requiredByDay,
        leadTimeDays: lead.leadTimeDays,
        orderByDay: requiredByDay - lead.leadTimeDays,
        critical: !!lead.critical,
        linkedAssemblies: [group.category],
      });
    });
  });

  return mergeProcurementItems(items).sort((a, b) => a.orderByDay - b.orderByDay || b.leadTimeDays - a.leadTimeDays);
}

function mergeProcurementItems(items) {
  const byId = new Map();
  items.forEach((item) => {
    const existing = byId.get(item.materialId);
    if (!existing) {
      byId.set(item.materialId, { ...item });
      return;
    }
    existing.requiredByDay = Math.min(existing.requiredByDay, item.requiredByDay);
    existing.orderByDay = Math.min(existing.orderByDay, item.orderByDay);
    existing.critical = existing.critical || item.critical;
    existing.linkedAssemblies = Array.from(new Set([...existing.linkedAssemblies, ...item.linkedAssemblies]));
  });
  return Array.from(byId.values());
}
