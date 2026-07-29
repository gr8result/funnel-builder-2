import { money, roundCurrency } from "../shared/money";
import type { SelectionSnapshot } from "../snapshots/snapshotTypes";
import type { EstimateSelectionExport, EstimateSelectionExportLine } from "./estimateExportTypes";

export type EstimateExportOptions = {
  gstRate?: number;
};

export function createEstimateSelectionExport(snapshot: SelectionSnapshot, options: EstimateExportOptions = {}): EstimateSelectionExport {
  const linesByKey = new Map<string, EstimateSelectionExportLine>();

  for (const line of snapshot.lines) {
    const key = [line.productReferenceId, line.variantId, line.supplierId, line.unit, line.category, line.subtype].join("|");
    const existing = linesByKey.get(key);
    const tax = money(roundCurrency(line.sell.amount * (options.gstRate ?? 0)), line.sell.currency);
    if (existing) {
      existing.quantity += line.quantity;
      existing.cost = money(existing.cost.amount + line.cost.amount, existing.cost.currency);
      existing.sell = money(existing.sell.amount + line.sell.amount, existing.sell.currency);
      existing.tax = money(existing.tax.amount + tax.amount, existing.tax.currency);
    } else {
      linesByKey.set(key, {
        snapshotId: snapshot.id,
        description: line.productName ?? line.title,
        productReferenceId: line.productReferenceId,
        variantId: line.variantId,
        supplierId: line.supplierId,
        quantity: line.quantity,
        unit: line.unit,
        cost: line.cost,
        sell: line.sell,
        tax,
      });
    }
  }

  return { projectId: snapshot.projectId, snapshotId: snapshot.id, lines: [...linesByKey.values()] };
}
