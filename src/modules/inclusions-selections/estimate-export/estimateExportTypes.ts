import type { Money } from "../shared/money";

export type EstimateSelectionExportLine = {
  snapshotId: string;
  costCode?: string;
  description: string;
  productReferenceId?: string;
  variantId?: string;
  supplierId?: string;
  quantity: number;
  unit: string;
  cost: Money;
  sell: Money;
  tax: Money;
};

export type EstimateSelectionExport = {
  projectId: string;
  snapshotId: string;
  lines: EstimateSelectionExportLine[];
};
