import type { ProjectScopedEntity, SnapshotId } from "../shared/ids";
import type { Money } from "../shared/money";

export type SelectionSnapshotLine = {
  requirementId: string;
  areaId: string;
  category: string;
  subtype: string;
  title: string;
  productReferenceId?: string;
  variantId?: string;
  productName?: string;
  supplierId?: string;
  quantity: number;
  unit: string;
  cost: Money;
  sell: Money;
  variation: Money;
};

export type SelectionSnapshot = ProjectScopedEntity & {
  id: SnapshotId;
  version: number;
  status: "locked" | "superseded";
  lockedAt: string;
  lockedBy: string;
  lines: SelectionSnapshotLine[];
};
