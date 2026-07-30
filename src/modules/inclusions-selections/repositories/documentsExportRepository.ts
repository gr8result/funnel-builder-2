import type { Money } from "../shared/money";
import type { ProjectSelectionContext } from "./projectAreaRegisterRepository";
import { loadPersistedValue, projectStorageKey, savePersistedValue } from "../shared/persistentScopedStore";

export type DocumentProjectionType = "client_selection_schedule" | "builder_internal_schedule" | "site_supervisor_schedule" | "room_by_room_schedule" | "category_schedule" | "trade_schedule" | "supplier_schedule" | "variation_summary" | "estimate_export_preview";
export type DocumentAudience = "client" | "builder" | "site_supervisor" | "trade" | "supplier" | "internal";
export type DocumentGenerationStatus = "not_generated" | "generating" | "generated" | "failed" | "superseded";
export type EstimateMappingStatus = "ready" | "mapping_missing" | "cost_missing" | "quantity_invalid" | "unit_invalid" | "supplier_missing" | "cost_code_missing" | "estimate_stage_missing" | "estimate_row_missing" | "aggregation_conflict" | "already_exported" | "export_failed" | "excluded";
export type EstimateExportBatchStatus = "draft" | "validating" | "ready" | "exporting" | "partially_completed" | "completed" | "failed" | "cancelled";
export type EstimateExportLineStatus = "ready" | "completed" | "failed" | "skipped" | "duplicate_blocked";
export type ExportReconciliationStatus = "reconciled" | "reconciliation_failed";

export type DocumentLine = {
  id: string;
  sourceSnapshotLineId: string;
  sectionId: string;
  areaName: string;
  requirementName: string;
  category: string;
  productName?: string;
  brand?: string;
  model?: string;
  colour?: string;
  description?: string;
  imageReference?: string;
  quantity: number;
  unit: string;
  allowance?: Money;
  selectedValue?: Money;
  builderCost?: Money;
  markup?: Money;
  variation?: Money;
  gst?: Money;
  supplierName?: string;
  supplierSku?: string;
  estimateStage?: string;
  estimateRowMapping?: string;
  costCode?: string;
  tradeMapping?: string;
  notes: string[];
  internalNotes?: string[];
  notApplicableReason?: string;
};

export type DocumentSection = {
  id: string;
  heading: string;
  groupKey: string;
  lines: DocumentLine[];
};

export type DocumentProjection = {
  id: string;
  organisationId: string;
  projectId: string;
  snapshotId: string;
  snapshotVersion: number;
  type: DocumentProjectionType;
  audience: DocumentAudience;
  title: string;
  finalStatusLabel: string;
  generatedAt: string;
  brandingName?: string;
  projectName?: string;
  clientName?: string;
  siteAddress?: string;
  approvalSummary: { clientApprovalId: string; builderApprovalId: string; lockedAt: string; lockedBy: string; fingerprint: string };
  totals: { totalAllowance: Money; totalSelectedValue: Money; totalUpgrades: Money; totalCredits: Money; netVariationExcludingGst: Money; gst: Money; netVariationIncludingGst: Money };
  sections: DocumentSection[];
  warnings: string[];
};

export type GeneratedDocumentRecord = {
  id: string;
  organisationId: string;
  projectId: string;
  snapshotId: string;
  snapshotVersion: number;
  documentType: DocumentProjectionType;
  audience: DocumentAudience;
  generatedAt: string;
  generatedBy: string;
  documentVersion: number;
  status: DocumentGenerationStatus;
  contentHash: string;
  storageReference?: string;
  fileName: string;
  mimeType: string;
  failureReason?: string;
  supersedesDocumentId?: string;
};

export type EstimateMappingOverride = {
  id: string;
  organisationId: string;
  projectId: string;
  snapshotId: string;
  sourceSnapshotLineId: string;
  estimateStage?: string;
  estimateRowMapping?: string;
  costCode?: string;
  tradeMapping?: string;
  unit?: string;
  aggregationEligible?: boolean;
  actorId: string;
  createdAt: string;
  reason: string;
  previousValueSummary?: string;
  newValueSummary?: string;
};

export type EstimateMappingValidationLine = {
  sourceSnapshotLineId: string;
  status: EstimateMappingStatus;
  issues: string[];
  blocking: boolean;
};

export type EstimateMappingSummary = {
  totalSnapshotLines: number;
  readyLines: number;
  unmappedLines: number;
  excludedLines: number;
  alreadyExportedLines: number;
  failedLines: number;
  issues: EstimateMappingValidationLine[];
};

export type EstimateExportLine = {
  id: string;
  organisationId: string;
  projectId: string;
  snapshotId: string;
  snapshotVersion: number;
  sourceSnapshotLineIds: string[];
  primarySourceSnapshotLineId: string;
  projectAreaId: string;
  areaName: string;
  areaType: string;
  areaGroup: string;
  projectLevel: string;
  requirement: string;
  category: string;
  productId?: string;
  productVariantId?: string;
  productCode?: string;
  productDescription?: string;
  supplierId?: string;
  supplierName?: string;
  supplierSku?: string;
  quantity: number;
  unit: string;
  builderCost: Money;
  allowance: Money;
  markup: Money;
  clientPrice: Money;
  variation: Money;
  gst: Money;
  estimateStage?: string;
  estimateRowMapping?: string;
  costCode?: string;
  tradeMapping?: string;
  aggregationKey: string;
  idempotencyKey: string;
  status: EstimateExportLineStatus;
  failureReason?: string;
};

export type EstimateExportAggregationResult = {
  aggregatedLines: EstimateExportLine[];
  unaggregatedLines: EstimateExportLine[];
  conflicts: Array<{ sourceSnapshotLineIds: string[]; reason: string }>;
};

export type EstimateExportBatch = {
  id: string;
  organisationId: string;
  projectId: string;
  snapshotId: string;
  snapshotVersion: number;
  exportTarget: "estimate_builder";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  actorId: string;
  status: EstimateExportBatchStatus;
  totalLines: number;
  completedLines: number;
  failedLines: number;
  skippedLines: number;
  totalBuilderCost: Money;
  totalClientValue: Money;
  totalVariation: Money;
  failureSummary?: string;
  adapterVersion: string;
  mappingVersion: string;
};

export type ExportReconciliation = {
  id: string;
  organisationId: string;
  projectId: string;
  batchId: string;
  snapshotId: string;
  snapshotVersion: number;
  status: ExportReconciliationStatus;
  checkedAt: string;
  quantityDifference: number;
  builderCostDifference: Money;
  allowanceDifference: Money;
  clientValueDifference: Money;
  variationDifference: Money;
  gstDifference: Money;
  sourceLineCountDifference: number;
  exportedGroupCount: number;
  failureReason?: string;
};

export type DocumentsExportAuditEvent = {
  id: string;
  actorId: string;
  actorType: "builder" | "system" | "adapter";
  organisationId: string;
  projectId: string;
  entityType: string;
  entityId: string;
  action: string;
  timestamp: string;
  previousValueSummary?: string;
  newValueSummary?: string;
  reason?: string;
  correlationId: string;
};

export type DocumentsExportRepository = {
  listGeneratedDocuments(context: ProjectSelectionContext): Promise<GeneratedDocumentRecord[]>;
  saveGeneratedDocuments(context: ProjectSelectionContext, documents: GeneratedDocumentRecord[]): Promise<GeneratedDocumentRecord[]>;
  listMappingOverrides(context: ProjectSelectionContext): Promise<EstimateMappingOverride[]>;
  saveMappingOverrides(context: ProjectSelectionContext, overrides: EstimateMappingOverride[]): Promise<EstimateMappingOverride[]>;
  listExportBatches(context: ProjectSelectionContext): Promise<EstimateExportBatch[]>;
  saveExportBatches(context: ProjectSelectionContext, batches: EstimateExportBatch[]): Promise<EstimateExportBatch[]>;
  listExportLines(context: ProjectSelectionContext): Promise<EstimateExportLine[]>;
  saveExportLines(context: ProjectSelectionContext, lines: EstimateExportLine[]): Promise<EstimateExportLine[]>;
  listReconciliations(context: ProjectSelectionContext): Promise<ExportReconciliation[]>;
  saveReconciliations(context: ProjectSelectionContext, reconciliations: ExportReconciliation[]): Promise<ExportReconciliation[]>;
  listAuditEvents(context: ProjectSelectionContext): Promise<DocumentsExportAuditEvent[]>;
  saveAuditEvents(context: ProjectSelectionContext, events: DocumentsExportAuditEvent[]): Promise<DocumentsExportAuditEvent[]>;
};

function key(context: ProjectSelectionContext): string {
  return `${context.organisationId}:${context.projectId}`;
}

function storageKey(bucket: string, context: Pick<ProjectSelectionContext, "organisationId" | "projectId">): string {
  return projectStorageKey(bucket, context.organisationId, context.projectId);
}

export class InMemoryDocumentsExportRepository implements DocumentsExportRepository {
  private documents = new Map<string, GeneratedDocumentRecord[]>();
  private overrides = new Map<string, EstimateMappingOverride[]>();
  private batches = new Map<string, EstimateExportBatch[]>();
  private lines = new Map<string, EstimateExportLine[]>();
  private reconciliations = new Map<string, ExportReconciliation[]>();
  private auditEvents = new Map<string, DocumentsExportAuditEvent[]>();

  async listGeneratedDocuments(context: ProjectSelectionContext): Promise<GeneratedDocumentRecord[]> {
    const documents = this.documents.get(key(context)) ?? loadPersistedValue<GeneratedDocumentRecord[]>(storageKey("generated-documents", context)) ?? [];
    this.documents.set(key(context), structuredClone(documents));
    return structuredClone(documents);
  }

  async saveGeneratedDocuments(context: ProjectSelectionContext, documents: GeneratedDocumentRecord[]): Promise<GeneratedDocumentRecord[]> {
    const scoped = documents.filter((item) => item.organisationId === context.organisationId && item.projectId === context.projectId);
    this.documents.set(key(context), structuredClone(scoped));
    savePersistedValue(storageKey("generated-documents", context), scoped);
    return structuredClone(scoped);
  }

  async listMappingOverrides(context: ProjectSelectionContext): Promise<EstimateMappingOverride[]> {
    const overrides = this.overrides.get(key(context)) ?? loadPersistedValue<EstimateMappingOverride[]>(storageKey("export-mapping-overrides", context)) ?? [];
    this.overrides.set(key(context), structuredClone(overrides));
    return structuredClone(overrides);
  }

  async saveMappingOverrides(context: ProjectSelectionContext, overrides: EstimateMappingOverride[]): Promise<EstimateMappingOverride[]> {
    const scoped = overrides.filter((item) => item.organisationId === context.organisationId && item.projectId === context.projectId);
    this.overrides.set(key(context), structuredClone(scoped));
    savePersistedValue(storageKey("export-mapping-overrides", context), scoped);
    return structuredClone(scoped);
  }

  async listExportBatches(context: ProjectSelectionContext): Promise<EstimateExportBatch[]> {
    const batches = this.batches.get(key(context)) ?? loadPersistedValue<EstimateExportBatch[]>(storageKey("export-batches", context)) ?? [];
    this.batches.set(key(context), structuredClone(batches));
    return structuredClone(batches);
  }

  async saveExportBatches(context: ProjectSelectionContext, batches: EstimateExportBatch[]): Promise<EstimateExportBatch[]> {
    const scoped = batches.filter((item) => item.organisationId === context.organisationId && item.projectId === context.projectId);
    this.batches.set(key(context), structuredClone(scoped));
    savePersistedValue(storageKey("export-batches", context), scoped);
    return structuredClone(scoped);
  }

  async listExportLines(context: ProjectSelectionContext): Promise<EstimateExportLine[]> {
    const lines = this.lines.get(key(context)) ?? loadPersistedValue<EstimateExportLine[]>(storageKey("export-lines", context)) ?? [];
    this.lines.set(key(context), structuredClone(lines));
    return structuredClone(lines);
  }

  async saveExportLines(context: ProjectSelectionContext, lines: EstimateExportLine[]): Promise<EstimateExportLine[]> {
    const scoped = lines.filter((item) => item.organisationId === context.organisationId && item.projectId === context.projectId);
    this.lines.set(key(context), structuredClone(scoped));
    savePersistedValue(storageKey("export-lines", context), scoped);
    return structuredClone(scoped);
  }

  async listReconciliations(context: ProjectSelectionContext): Promise<ExportReconciliation[]> {
    const reconciliations = this.reconciliations.get(key(context)) ?? loadPersistedValue<ExportReconciliation[]>(storageKey("export-reconciliations", context)) ?? [];
    this.reconciliations.set(key(context), structuredClone(reconciliations));
    return structuredClone(reconciliations);
  }

  async saveReconciliations(context: ProjectSelectionContext, reconciliations: ExportReconciliation[]): Promise<ExportReconciliation[]> {
    const scoped = reconciliations.filter((item) => item.organisationId === context.organisationId && item.projectId === context.projectId);
    this.reconciliations.set(key(context), structuredClone(scoped));
    savePersistedValue(storageKey("export-reconciliations", context), scoped);
    return structuredClone(scoped);
  }

  async listAuditEvents(context: ProjectSelectionContext): Promise<DocumentsExportAuditEvent[]> {
    const events = this.auditEvents.get(key(context)) ?? loadPersistedValue<DocumentsExportAuditEvent[]>(storageKey("export-audit-events", context)) ?? [];
    this.auditEvents.set(key(context), structuredClone(events));
    return structuredClone(events);
  }

  async saveAuditEvents(context: ProjectSelectionContext, events: DocumentsExportAuditEvent[]): Promise<DocumentsExportAuditEvent[]> {
    const scoped = events.filter((item) => item.organisationId === context.organisationId && item.projectId === context.projectId);
    this.auditEvents.set(key(context), structuredClone(scoped));
    savePersistedValue(storageKey("export-audit-events", context), scoped);
    return structuredClone(scoped);
  }
}

export const documentsExportRepository = new InMemoryDocumentsExportRepository();
