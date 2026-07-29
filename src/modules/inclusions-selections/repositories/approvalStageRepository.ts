import type { Money } from "../shared/money";
import type { ProjectSelectionContext } from "./projectAreaRegisterRepository";

export type ApprovalParty = "client" | "builder";
export type ApprovalMethod = "in_app" | "email_confirmation" | "signed_document" | "in_person" | "phone_confirmation" | "other";
export type ApprovalStatus = "not_started" | "prepared" | "sent_for_review" | "client_reviewing" | "changes_requested" | "client_approved" | "builder_approved" | "fully_approved" | "approval_stale" | "locked" | "superseded";

export type ApprovalRecord = {
  id: string;
  organisationId: string;
  projectId: string;
  party: ApprovalParty;
  status: "approved" | "revoked" | "stale";
  approverName: string;
  approverRole: string;
  method: ApprovalMethod;
  approvedAt: string;
  approvedFingerprint: string;
  declaration: string;
  comments?: string;
  recordedBy: string;
  recordedByRepresentative?: boolean;
  staleReason?: string;
};

export type ApprovalHistoryEvent = {
  id: string;
  organisationId: string;
  projectId: string;
  eventType: string;
  actor: string;
  actorRole: string;
  timestamp: string;
  fingerprint: string;
  reason?: string;
  comments?: string;
  areaId?: string;
  requirementId?: string;
};

export type SelectionSnapshotLocation = {
  id: string;
  sourceLocationId: string;
  areaId: string;
  requirementId: string;
  label: string;
  quantity: number;
  pricingQuantity: number;
  unit: string;
};

export type LockedSelectionSnapshotLine = {
  id: string;
  organisationId: string;
  projectId: string;
  snapshotId: string;
  sourceAreaId: string;
  areaName: string;
  areaTypeId: string;
  areaTypeName: string;
  areaGroupId: string;
  areaGroupName: string;
  projectLevelId: string;
  projectLevelName: string;
  sourceRequirementId: string;
  requirementName: string;
  category: string;
  requirementStatus: string;
  sourceSelectionId?: string;
  selectionType: "product" | "custom" | "not_applicable" | "missing";
  productId?: string;
  productVariantId?: string;
  productCode?: string;
  productName?: string;
  brand?: string;
  model?: string;
  colour?: string;
  description?: string;
  imageReference?: string;
  supplierId?: string;
  supplierName?: string;
  supplierSku?: string;
  locations: SelectionSnapshotLocation[];
  quantity: number;
  unit: string;
  pricingQuantity: number;
  builderCost: Money;
  allowance: Money;
  markup: Money;
  clientPrice: Money;
  variation: Money;
  gstTreatment: "gst_inclusive" | "gst_exclusive";
  gstAmount: Money;
  priceSource?: string;
  priceEffectiveDate?: string;
  estimateStageMapping?: string;
  estimateRowMapping?: string;
  costCode?: string;
  clientVisibleNotes: string[];
  internalNotes: string[];
  notApplicableReason?: string;
  customSelectionDetails?: Record<string, string | undefined>;
  approvalFingerprint: string;
  createdAt: string;
};

export type LockedSelectionSnapshot = {
  id: string;
  organisationId: string;
  projectId: string;
  version: number;
  status: "locked" | "superseded";
  sourceReviewRevision: number;
  sourceFingerprint: string;
  clientApprovalId: string;
  builderApprovalId: string;
  lockedAt: string;
  lockedBy: string;
  supersedesSnapshotId?: string;
  supersededBySnapshotId?: string;
  totalAllowance: Money;
  totalSelectedValue: Money;
  totalCredits: Money;
  totalUpgrades: Money;
  netVariationExcludingGst: Money;
  gst: Money;
  netVariationIncludingGst: Money;
  currency: string;
  projectSummary: { projectName?: string; clientName?: string; siteAddress?: string; tierId?: string };
  metadataVersion: number;
  lines: LockedSelectionSnapshotLine[];
};

export type DraftRevision = {
  id: string;
  organisationId: string;
  projectId: string;
  sourceSnapshotId?: string;
  revisionNumber: number;
  status: "editable";
  createdAt: string;
  createdBy: string;
};

export type SnapshotComparisonChange = {
  id: string;
  changeType: "added" | "removed" | "product_changed" | "variant_changed" | "quantity_changed" | "price_changed" | "allowance_changed" | "credit_changed" | "upgrade_changed" | "note_changed" | "not_applicable_changed" | "estimate_mapping_changed";
  areaName: string;
  requirementName: string;
  previousValue?: string;
  newValue?: string;
  financialDifference: Money;
};

export type ApprovalStageRepository = {
  listApprovals(context: ProjectSelectionContext): Promise<ApprovalRecord[]>;
  saveApprovals(context: ProjectSelectionContext, approvals: ApprovalRecord[]): Promise<ApprovalRecord[]>;
  listHistory(context: ProjectSelectionContext): Promise<ApprovalHistoryEvent[]>;
  saveHistory(context: ProjectSelectionContext, history: ApprovalHistoryEvent[]): Promise<ApprovalHistoryEvent[]>;
  listSnapshots(context: ProjectSelectionContext): Promise<LockedSelectionSnapshot[]>;
  createSnapshot(context: ProjectSelectionContext, snapshot: LockedSelectionSnapshot): Promise<LockedSelectionSnapshot>;
  updateSnapshot(context: ProjectSelectionContext, snapshot: LockedSelectionSnapshot): Promise<never>;
  deleteSnapshot(context: ProjectSelectionContext, snapshotId: string): Promise<never>;
  updateSnapshotLine(context: ProjectSelectionContext, snapshotId: string, line: LockedSelectionSnapshotLine): Promise<never>;
  listDraftRevisions(context: ProjectSelectionContext): Promise<DraftRevision[]>;
  saveDraftRevisions(context: ProjectSelectionContext, revisions: DraftRevision[]): Promise<DraftRevision[]>;
};

function key(organisationId: string, projectId: string): string {
  return `${organisationId}:${projectId}`;
}

export class InMemoryApprovalStageRepository implements ApprovalStageRepository {
  private approvals = new Map<string, ApprovalRecord[]>();
  private history = new Map<string, ApprovalHistoryEvent[]>();
  private snapshots = new Map<string, LockedSelectionSnapshot[]>();
  private revisions = new Map<string, DraftRevision[]>();

  async listApprovals(context: ProjectSelectionContext): Promise<ApprovalRecord[]> {
    return structuredClone(this.approvals.get(key(context.organisationId, context.projectId)) ?? []);
  }

  async saveApprovals(context: ProjectSelectionContext, approvals: ApprovalRecord[]): Promise<ApprovalRecord[]> {
    const scoped = approvals.filter((item) => item.organisationId === context.organisationId && item.projectId === context.projectId);
    this.approvals.set(key(context.organisationId, context.projectId), structuredClone(scoped));
    return structuredClone(scoped);
  }

  async listHistory(context: ProjectSelectionContext): Promise<ApprovalHistoryEvent[]> {
    return structuredClone(this.history.get(key(context.organisationId, context.projectId)) ?? []);
  }

  async saveHistory(context: ProjectSelectionContext, history: ApprovalHistoryEvent[]): Promise<ApprovalHistoryEvent[]> {
    const scoped = history.filter((item) => item.organisationId === context.organisationId && item.projectId === context.projectId);
    this.history.set(key(context.organisationId, context.projectId), structuredClone(scoped));
    return structuredClone(scoped);
  }

  async listSnapshots(context: ProjectSelectionContext): Promise<LockedSelectionSnapshot[]> {
    return structuredClone(this.snapshots.get(key(context.organisationId, context.projectId)) ?? []);
  }

  async createSnapshot(context: ProjectSelectionContext, snapshot: LockedSelectionSnapshot): Promise<LockedSelectionSnapshot> {
    if (snapshot.organisationId !== context.organisationId || snapshot.projectId !== context.projectId) throw new Error("cross_scope_snapshot");
    const existing = this.snapshots.get(key(context.organisationId, context.projectId)) ?? [];
    if (existing.some((item) => item.version === snapshot.version)) throw new Error("duplicate_snapshot_version");
    if (snapshot.lines.some((line) => line.organisationId !== context.organisationId || line.projectId !== context.projectId)) throw new Error("cross_scope_snapshot_line");
    this.snapshots.set(key(context.organisationId, context.projectId), structuredClone([...existing, snapshot]));
    return structuredClone(snapshot);
  }

  async updateSnapshot(): Promise<never> {
    throw new Error("attempted_snapshot_mutation");
  }

  async deleteSnapshot(): Promise<never> {
    throw new Error("attempted_snapshot_deletion");
  }

  async updateSnapshotLine(): Promise<never> {
    throw new Error("attempted_snapshot_line_mutation");
  }

  async listDraftRevisions(context: ProjectSelectionContext): Promise<DraftRevision[]> {
    return structuredClone(this.revisions.get(key(context.organisationId, context.projectId)) ?? []);
  }

  async saveDraftRevisions(context: ProjectSelectionContext, revisions: DraftRevision[]): Promise<DraftRevision[]> {
    const scoped = revisions.filter((item) => item.organisationId === context.organisationId && item.projectId === context.projectId);
    this.revisions.set(key(context.organisationId, context.projectId), structuredClone(scoped));
    return structuredClone(scoped);
  }
}

export const approvalStageRepository = new InMemoryApprovalStageRepository();
