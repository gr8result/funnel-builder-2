import type { LockedSelectionSnapshot, LockedSelectionSnapshotLine, ApprovalStageRepository } from "../repositories/approvalStageRepository";
import { approvalStageRepository } from "../repositories/approvalStageRepository";
import type { ProjectSelectionContext } from "../repositories/projectAreaRegisterRepository";
import type { DocumentLine, DocumentProjection, DocumentProjectionType, DocumentSection, DocumentsExportAuditEvent, DocumentsExportRepository, EstimateExportAggregationResult, EstimateExportBatch, EstimateExportLine, EstimateMappingOverride, EstimateMappingStatus, EstimateMappingSummary, ExportReconciliation, GeneratedDocumentRecord } from "../repositories/documentsExportRepository";
import { documentsExportRepository } from "../repositories/documentsExportRepository";
import { makeScopedId } from "../shared/ids";
import { addMoney, money, roundCurrency } from "../shared/money";
import type { Money } from "../shared/money";
import type { DomainResult } from "../validation/errors";
import { issue, ok } from "../validation/errors";

export type DocumentsExportStage = {
  context: ProjectSelectionContext;
  snapshots: LockedSelectionSnapshot[];
  selectedSnapshot?: LockedSelectionSnapshot;
  generatedDocuments: GeneratedDocumentRecord[];
  mappingOverrides: EstimateMappingOverride[];
  mappingSummary: EstimateMappingSummary;
  exportPreview: EstimateExportLine[];
  aggregation: EstimateExportAggregationResult;
  exportBatches: EstimateExportBatch[];
  exportLines: EstimateExportLine[];
  reconciliations: ExportReconciliation[];
  auditEvents: DocumentsExportAuditEvent[];
  exportStatus: string;
  lastExportDate?: string;
};

export type SelectionDocumentRenderer = {
  render(projection: DocumentProjection): Promise<{ contentHash: string; storageReference?: string; mimeType: string; fileName: string; bytes?: Uint8Array; html?: string }>;
};

export type EstimateExportAdapterResult = {
  lineId: string;
  status: "completed" | "failed";
  failureReason?: string;
};

export type EstimateExportAdapter = {
  adapterVersion: string;
  validate(lines: EstimateExportLine[]): Promise<DomainResult<EstimateExportLine[]>>;
  exportBatch(batch: EstimateExportBatch, lines: EstimateExportLine[]): Promise<EstimateExportAdapterResult[]>;
  lookupExistingByIdempotencyKey(key: string): Promise<EstimateExportLine | null>;
};

export class HtmlSelectionDocumentRenderer implements SelectionDocumentRenderer {
  async render(projection: DocumentProjection): Promise<{ contentHash: string; mimeType: string; fileName: string; html: string }> {
    const html = `<article><h1>${projection.title}</h1>${projection.sections.map((section) => `<section><h2>${section.heading}</h2>${section.lines.map((line) => `<p>${line.areaName}: ${line.requirementName} - ${line.productName ?? "Not Applicable"}</p>`).join("")}</section>`).join("")}</article>`;
    return { contentHash: digest(html), mimeType: "text/html", fileName: fileNameFor(projection), html };
  }
}

export class InMemoryEstimateExportAdapter implements EstimateExportAdapter {
  adapterVersion = "in-memory-estimate-export-adapter-v1";
  private completedByKey = new Map<string, EstimateExportLine>();
  failNextLineIds = new Set<string>();

  async validate(lines: EstimateExportLine[]): Promise<DomainResult<EstimateExportLine[]>> {
    const issues = lines.flatMap((line) => line.quantity <= 0 ? [issue("invalid_quantity", "Export quantity must be greater than zero.", line.id)] : []);
    return issues.length ? { ok: false, issues } : ok(lines);
  }

  async exportBatch(_batch: EstimateExportBatch, lines: EstimateExportLine[]): Promise<EstimateExportAdapterResult[]> {
    return lines.map((line) => {
      if (this.failNextLineIds.has(line.id)) {
        this.failNextLineIds.delete(line.id);
        return { lineId: line.id, status: "failed", failureReason: "Adapter Rejected" };
      }
      this.completedByKey.set(line.idempotencyKey, line);
      return { lineId: line.id, status: "completed" };
    });
  }

  async lookupExistingByIdempotencyKey(key: string): Promise<EstimateExportLine | null> {
    return structuredClone(this.completedByKey.get(key) ?? null);
  }
}

export const htmlSelectionDocumentRenderer = new HtmlSelectionDocumentRenderer();
export const inMemoryEstimateExportAdapter = new InMemoryEstimateExportAdapter();

function digest(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `doc_${(hash >>> 0).toString(16)}_${text.length}`;
}

function fileNameFor(projection: DocumentProjection): string {
  const project = (projection.projectName ?? projection.projectId).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return `${project}-snapshot-v${projection.snapshotVersion}-${projection.type}.html`;
}

function audit(context: ProjectSelectionContext, entityType: string, entityId: string, action: string, actorId = "builder", reason?: string): DocumentsExportAuditEvent {
  return { id: makeScopedId("documents_export_audit", [context.organisationId, context.projectId, action, Date.now()]), actorId, actorType: actorId === "system" ? "system" : "builder", organisationId: context.organisationId, projectId: context.projectId, entityType, entityId, action, timestamp: new Date().toISOString(), reason, correlationId: makeScopedId("correlation", [context.projectId, action, Date.now()]) };
}

function latestSnapshot(snapshots: LockedSelectionSnapshot[]): LockedSelectionSnapshot | undefined {
  return [...snapshots].filter((snapshot) => snapshot.status === "locked").sort((a, b) => b.version - a.version)[0];
}

function selectSnapshot(snapshots: LockedSelectionSnapshot[], options: { snapshotId?: string; snapshotVersion?: number } = {}): LockedSelectionSnapshot | undefined {
  if (options.snapshotId) return snapshots.find((snapshot) => snapshot.id === options.snapshotId);
  if (options.snapshotVersion) return snapshots.find((snapshot) => snapshot.version === options.snapshotVersion);
  return latestSnapshot(snapshots);
}

function groupBy<T>(items: T[], getKey: (item: T) => string): Array<{ key: string; items: T[] }> {
  const groups = new Map<string, T[]>();
  items.forEach((item) => groups.set(getKey(item), [...(groups.get(getKey(item)) ?? []), item]));
  return [...groups.entries()].map(([key, groupItems]) => ({ key, items: groupItems }));
}

function clientLine(line: LockedSelectionSnapshotLine, sectionId: string, includePrice = true): DocumentLine {
  return {
    id: makeScopedId("document_line", [sectionId, line.id]),
    sourceSnapshotLineId: line.id,
    sectionId,
    areaName: line.areaName,
    requirementName: line.requirementName,
    category: line.category,
    productName: line.productName,
    brand: line.brand,
    model: line.model,
    colour: line.colour,
    description: line.description,
    imageReference: line.imageReference,
    quantity: line.quantity,
    unit: line.unit,
    allowance: includePrice ? line.allowance : undefined,
    selectedValue: includePrice ? line.clientPrice : undefined,
    variation: includePrice ? line.variation : undefined,
    gst: includePrice ? line.gstAmount : undefined,
    notes: line.clientVisibleNotes,
    notApplicableReason: line.notApplicableReason,
  };
}

function internalLine(line: LockedSelectionSnapshotLine, sectionId: string): DocumentLine {
  return { ...clientLine(line, sectionId, true), builderCost: line.builderCost, markup: line.markup, supplierName: line.supplierName, supplierSku: line.supplierSku, estimateStage: line.estimateStageMapping, estimateRowMapping: line.estimateRowMapping, costCode: line.costCode, tradeMapping: inferTradeMapping(line), internalNotes: line.internalNotes };
}

function projection(snapshot: LockedSelectionSnapshot, type: DocumentProjectionType, title: string, audience: DocumentProjection["audience"], sections: DocumentSection[], warnings: string[] = []): DocumentProjection {
  return { id: makeScopedId("document_projection", [snapshot.organisationId, snapshot.projectId, snapshot.id, type]), organisationId: snapshot.organisationId, projectId: snapshot.projectId, snapshotId: snapshot.id, snapshotVersion: snapshot.version, type, audience, title, finalStatusLabel: type === "variation_summary" ? "Approved Selection Variation Summary" : type === "builder_internal_schedule" ? "Internal Builder Schedule" : "Approved Selection Schedule", generatedAt: new Date().toISOString(), brandingName: "Builder Branding", projectName: snapshot.projectSummary.projectName, clientName: snapshot.projectSummary.clientName, siteAddress: snapshot.projectSummary.siteAddress, approvalSummary: { clientApprovalId: snapshot.clientApprovalId, builderApprovalId: snapshot.builderApprovalId, lockedAt: snapshot.lockedAt, lockedBy: snapshot.lockedBy, fingerprint: snapshot.sourceFingerprint }, totals: { totalAllowance: snapshot.totalAllowance, totalSelectedValue: snapshot.totalSelectedValue, totalUpgrades: snapshot.totalUpgrades, totalCredits: snapshot.totalCredits, netVariationExcludingGst: snapshot.netVariationExcludingGst, gst: snapshot.gst, netVariationIncludingGst: snapshot.netVariationIncludingGst }, sections, warnings };
}

export function buildClientSelectionSchedule(snapshot: LockedSelectionSnapshot): DocumentProjection {
  return projection(snapshot, "client_selection_schedule", "Client Selection Schedule", "client", groupBy(snapshot.lines, (line) => line.areaName).map(({ key, items }) => ({ id: makeScopedId("document_section", [snapshot.id, "client", key]), heading: key, groupKey: key, lines: items.map((line) => clientLine(line, makeScopedId("document_section", [snapshot.id, "client", key]))) })));
}

export function buildBuilderInternalSchedule(snapshot: LockedSelectionSnapshot): DocumentProjection {
  return projection(snapshot, "builder_internal_schedule", "Builder Internal Schedule", "builder", groupBy(snapshot.lines, (line) => line.areaName).map(({ key, items }) => ({ id: makeScopedId("document_section", [snapshot.id, "builder", key]), heading: key, groupKey: key, lines: items.map((line) => internalLine(line, makeScopedId("document_section", [snapshot.id, "builder", key]))) })));
}

export function buildSiteSupervisorSchedule(snapshot: LockedSelectionSnapshot): DocumentProjection {
  return projection(snapshot, "site_supervisor_schedule", "Site Supervisor Schedule", "site_supervisor", groupBy(snapshot.lines, (line) => `${line.projectLevelName} / ${line.areaName} / ${line.category}`).map(({ key, items }) => ({ id: makeScopedId("document_section", [snapshot.id, "site", key]), heading: key, groupKey: key, lines: items.map((line) => clientLine(line, makeScopedId("document_section", [snapshot.id, "site", key]), false)) })));
}

export function buildRoomSchedule(snapshot: LockedSelectionSnapshot, internal = false): DocumentProjection {
  return projection(snapshot, "room_by_room_schedule", internal ? "Internal Room-by-Room Schedule" : "Room-by-Room Schedule", internal ? "internal" : "client", groupBy(snapshot.lines, (line) => `${line.projectLevelName} / ${line.areaGroupName} / ${line.areaName}`).map(({ key, items }) => ({ id: makeScopedId("document_section", [snapshot.id, "room", key]), heading: key, groupKey: key, lines: items.map((line) => internal ? internalLine(line, makeScopedId("document_section", [snapshot.id, "room", key])) : clientLine(line, makeScopedId("document_section", [snapshot.id, "room", key]), false)) })));
}

export function buildCategorySchedule(snapshot: LockedSelectionSnapshot, internal = true): DocumentProjection {
  return projection(snapshot, "category_schedule", "Category Schedule", internal ? "internal" : "client", groupBy(snapshot.lines, (line) => line.category).map(({ key, items }) => ({ id: makeScopedId("document_section", [snapshot.id, "category", key]), heading: key, groupKey: key, lines: items.map((line) => internal ? internalLine(line, makeScopedId("document_section", [snapshot.id, "category", key])) : clientLine(line, makeScopedId("document_section", [snapshot.id, "category", key]))) })));
}

export function inferTradeMapping(line: LockedSelectionSnapshotLine): string {
  const key = `${line.category} ${line.requirementName}`.toLowerCase();
  if (/tap|mixer|basin|shower|toilet|laundry|sink/.test(key)) return "Plumber";
  if (/light|power|fan|electrical/.test(key)) return "Electrician";
  if (/tile|floor|splashback/.test(key)) return "Tiler";
  if (/cabinet|joinery|benchtop/.test(key)) return "Cabinetmaker";
  if (/paint/.test(key)) return "Painter";
  if (/door|hardware|carpenter|timber/.test(key)) return "Carpenter";
  if (/roof/.test(key)) return "Roofer";
  if (/window|glass|glazier/.test(key)) return "Glazier";
  if (/landscape|garden|fence/.test(key)) return "Landscaper";
  return "General Builder";
}

export function buildTradeSchedule(snapshot: LockedSelectionSnapshot): DocumentProjection {
  return projection(snapshot, "trade_schedule", "Trade Schedule", "trade", groupBy(snapshot.lines, inferTradeMapping).map(({ key, items }) => ({ id: makeScopedId("document_section", [snapshot.id, "trade", key]), heading: key, groupKey: key, lines: items.map((line) => ({ ...clientLine(line, makeScopedId("document_section", [snapshot.id, "trade", key]), false), tradeMapping: key, supplierName: line.supplierName, supplierSku: line.supplierSku, costCode: line.costCode, estimateStage: line.estimateStageMapping })) })));
}

export function buildSupplierSchedule(snapshot: LockedSelectionSnapshot): DocumentProjection {
  return projection(snapshot, "supplier_schedule", "Supplier Schedule", "supplier", groupBy(snapshot.lines, (line) => line.supplierName ?? "Supplier Missing").map(({ key, items }) => ({ id: makeScopedId("document_section", [snapshot.id, "supplier", key]), heading: key, groupKey: key, lines: items.map((line) => ({ ...clientLine(line, makeScopedId("document_section", [snapshot.id, "supplier", key]), false), supplierName: line.supplierName, supplierSku: line.supplierSku })) })));
}

export function buildApprovedVariationSummary(snapshot: LockedSelectionSnapshot): DocumentProjection {
  const variationLines = snapshot.lines.filter((line) => line.variation.amount !== 0);
  return projection(snapshot, "variation_summary", "Approved Selection Variation Summary", "client", [{ id: makeScopedId("document_section", [snapshot.id, "variation"]), heading: "Approved Variations", groupKey: "variation", lines: variationLines.map((line) => clientLine(line, makeScopedId("document_section", [snapshot.id, "variation"]))) }]);
}

export function buildDocumentProjection(snapshot: LockedSelectionSnapshot, type: DocumentProjectionType): DocumentProjection {
  if (type === "client_selection_schedule") return buildClientSelectionSchedule(snapshot);
  if (type === "builder_internal_schedule") return buildBuilderInternalSchedule(snapshot);
  if (type === "site_supervisor_schedule") return buildSiteSupervisorSchedule(snapshot);
  if (type === "room_by_room_schedule") return buildRoomSchedule(snapshot);
  if (type === "category_schedule") return buildCategorySchedule(snapshot);
  if (type === "trade_schedule") return buildTradeSchedule(snapshot);
  if (type === "supplier_schedule") return buildSupplierSchedule(snapshot);
  if (type === "variation_summary") return buildApprovedVariationSummary(snapshot);
  return buildEstimateExportPreviewProjection(snapshot);
}

function buildEstimateExportPreviewProjection(snapshot: LockedSelectionSnapshot): DocumentProjection {
  return projection(snapshot, "estimate_export_preview", "Estimate Export Preview", "internal", [{ id: makeScopedId("document_section", [snapshot.id, "estimate-preview"]), heading: "Estimate Export Preview", groupKey: "estimate-preview", lines: snapshot.lines.map((line) => internalLine(line, makeScopedId("document_section", [snapshot.id, "estimate-preview"]))) }]);
}

function overrideFor(overrides: EstimateMappingOverride[], lineId: string): EstimateMappingOverride | undefined {
  return [...overrides].reverse().find((override) => override.sourceSnapshotLineId === lineId);
}

function mapped(line: LockedSelectionSnapshotLine, overrides: EstimateMappingOverride[]) {
  const override = overrideFor(overrides, line.id);
  return {
    estimateStage: override?.estimateStage ?? line.estimateStageMapping,
    estimateRowMapping: override?.estimateRowMapping ?? line.estimateRowMapping,
    costCode: override?.costCode ?? line.costCode,
    tradeMapping: override?.tradeMapping ?? inferTradeMapping(line),
    unit: override?.unit ?? line.unit,
    aggregationEligible: override?.aggregationEligible ?? true,
  };
}

export function validateEstimateMappings(snapshot: LockedSelectionSnapshot | undefined, overrides: EstimateMappingOverride[] = [], existingLines: EstimateExportLine[] = []): EstimateMappingSummary {
  if (!snapshot || snapshot.status !== "locked") return { totalSnapshotLines: 0, readyLines: 0, unmappedLines: 0, excludedLines: 0, alreadyExportedLines: 0, failedLines: 0, issues: [{ sourceSnapshotLineId: "snapshot", status: "mapping_missing", issues: ["A locked snapshot is required."], blocking: true }] };
  const issues = snapshot.lines.map((line) => {
    const mapping = mapped(line, overrides);
    const lineIssues: string[] = [];
    let status: EstimateMappingStatus = "ready";
    if (!mapping.costCode) { lineIssues.push("Cost code missing."); status = "cost_code_missing"; }
    if (!mapping.estimateStage) { lineIssues.push("Estimate stage missing."); status = status === "ready" ? "estimate_stage_missing" : status; }
    if (!mapping.estimateRowMapping) { lineIssues.push("Estimate row mapping missing."); status = status === "ready" ? "estimate_row_missing" : status; }
    if (line.quantity <= 0) { lineIssues.push("Quantity invalid."); status = "quantity_invalid"; }
    if (!mapping.unit) { lineIssues.push("Unit invalid."); status = status === "ready" ? "unit_invalid" : status; }
    if (!line.builderCost || line.builderCost.amount < 0) { lineIssues.push("Builder cost missing."); status = "cost_missing"; }
    if (!line.clientPrice) { lineIssues.push("Client price missing."); status = "cost_missing"; }
    if (!line.supplierId) lineIssues.push("Supplier missing.");
    if (existingLines.some((exportLine) => exportLine.status === "completed" && exportLine.sourceSnapshotLineIds.includes(line.id))) status = "already_exported";
    if (existingLines.some((exportLine) => exportLine.status === "failed" && exportLine.sourceSnapshotLineIds.includes(line.id))) status = "export_failed";
    return { sourceSnapshotLineId: line.id, status, issues: lineIssues, blocking: !["ready", "already_exported", "export_failed"].includes(status) };
  });
  return { totalSnapshotLines: snapshot.lines.length, readyLines: issues.filter((item) => item.status === "ready").length, unmappedLines: issues.filter((item) => item.blocking).length, excludedLines: issues.filter((item) => (item.status as EstimateMappingStatus) === "excluded").length, alreadyExportedLines: issues.filter((item) => item.status === "already_exported").length, failedLines: issues.filter((item) => item.status === "export_failed").length, issues };
}

function idempotencyKey(line: LockedSelectionSnapshotLine, mapping: ReturnType<typeof mapped>, sourceIds = [line.id]): string {
  return makeScopedId("estimate_export_key", [line.organisationId, line.projectId, line.snapshotId, line.approvalFingerprint, sourceIds.slice().sort().join("-"), "estimate_builder", mapping.estimateStage, mapping.estimateRowMapping, mapping.costCode, "mapping-v1"]);
}

function aggregationKey(line: LockedSelectionSnapshotLine, mapping: ReturnType<typeof mapped>): string {
  return [line.snapshotId, line.productVariantId ?? line.productId ?? line.productName, line.supplierId, line.supplierSku, mapping.costCode, mapping.estimateStage, mapping.estimateRowMapping, mapping.unit, line.builderCost.amount, line.allowance.amount, line.clientPrice.amount, line.gstTreatment, mapping.tradeMapping, line.organisationId, line.projectId].join("|");
}

export function buildEstimateExportPreview(snapshot: LockedSelectionSnapshot | undefined, overrides: EstimateMappingOverride[] = [], existingLines: EstimateExportLine[] = []): EstimateExportLine[] {
  if (!snapshot || snapshot.status !== "locked") return [];
  return snapshot.lines.map((line) => {
    const mapping = mapped(line, overrides);
    const existing = existingLines.find((exportLine) => exportLine.status === "completed" && exportLine.sourceSnapshotLineIds.includes(line.id));
    return { id: makeScopedId("estimate_export_line", [snapshot.id, line.id, mapping.costCode, mapping.estimateStage, mapping.estimateRowMapping]), organisationId: snapshot.organisationId, projectId: snapshot.projectId, snapshotId: snapshot.id, snapshotVersion: snapshot.version, sourceSnapshotLineIds: [line.id], primarySourceSnapshotLineId: line.id, projectAreaId: line.sourceAreaId, areaName: line.areaName, areaType: line.areaTypeName, areaGroup: line.areaGroupName, projectLevel: line.projectLevelName, requirement: line.requirementName, category: line.category, productId: line.productId, productVariantId: line.productVariantId, productCode: line.productCode, productDescription: line.productName ?? line.description, supplierId: line.supplierId, supplierName: line.supplierName, supplierSku: line.supplierSku, quantity: line.quantity, unit: mapping.unit ?? line.unit, builderCost: line.builderCost, allowance: line.allowance, markup: line.markup, clientPrice: line.clientPrice, variation: line.variation, gst: line.gstAmount, estimateStage: mapping.estimateStage, estimateRowMapping: mapping.estimateRowMapping, costCode: mapping.costCode, tradeMapping: mapping.tradeMapping, aggregationKey: aggregationKey(line, mapping), idempotencyKey: idempotencyKey(line, mapping), status: existing ? "completed" : "ready" };
  });
}

export function aggregateEstimateExportLines(lines: EstimateExportLine[]): EstimateExportAggregationResult {
  const conflicts: EstimateExportAggregationResult["conflicts"] = [];
  const groups = groupBy(lines, (line) => line.aggregationKey);
  const aggregatedLines = groups.map(({ key, items }) => {
    if (items.length === 1) return items[0];
    const sourceIds = items.flatMap((line) => line.sourceSnapshotLineIds).sort();
    const first = items[0];
    return { ...first, id: makeScopedId("estimate_export_aggregate", [first.snapshotId, key]), sourceSnapshotLineIds: sourceIds, primarySourceSnapshotLineId: sourceIds[0], quantity: roundCurrency(items.reduce((total, line) => total + line.quantity, 0)), builderCost: addMoney(items.map((line) => line.builderCost), first.builderCost.currency), allowance: addMoney(items.map((line) => line.allowance), first.allowance.currency), markup: addMoney(items.map((line) => line.markup), first.markup.currency), clientPrice: addMoney(items.map((line) => line.clientPrice), first.clientPrice.currency), variation: addMoney(items.map((line) => line.variation), first.variation.currency), gst: addMoney(items.map((line) => line.gst), first.gst.currency), idempotencyKey: makeScopedId("estimate_export_key", [first.organisationId, first.projectId, first.snapshotId, first.snapshotVersion, sourceIds.join("-"), "estimate_builder", first.estimateStage, first.estimateRowMapping, first.costCode, "mapping-v1"]) };
  });
  return { aggregatedLines, unaggregatedLines: lines.filter((line) => groups.find((group) => group.key === line.aggregationKey)?.items.length === 1), conflicts };
}

export async function loadDocumentsExportStage(context: ProjectSelectionContext, options: { snapshotId?: string; snapshotVersion?: number; approval?: ApprovalStageRepository; documents?: DocumentsExportRepository } = {}): Promise<DocumentsExportStage> {
  const approvalRepo = options.approval ?? approvalStageRepository;
  const docsRepo = options.documents ?? documentsExportRepository;
  const [snapshots, generatedDocuments, mappingOverrides, exportBatches, exportLines, reconciliations, auditEvents] = await Promise.all([approvalRepo.listSnapshots(context), docsRepo.listGeneratedDocuments(context), docsRepo.listMappingOverrides(context), docsRepo.listExportBatches(context), docsRepo.listExportLines(context), docsRepo.listReconciliations(context), docsRepo.listAuditEvents(context)]);
  const selectedSnapshot = selectSnapshot(snapshots, options);
  const snapshotOverrides = selectedSnapshot ? mappingOverrides.filter((override) => override.snapshotId === selectedSnapshot.id) : [];
  const snapshotExportLines = selectedSnapshot ? exportLines.filter((line) => line.snapshotId === selectedSnapshot.id) : [];
  const mappingSummary = validateEstimateMappings(selectedSnapshot, snapshotOverrides, snapshotExportLines);
  const exportPreview = buildEstimateExportPreview(selectedSnapshot, snapshotOverrides, snapshotExportLines);
  const aggregation = aggregateEstimateExportLines(exportPreview.filter((line) => line.status !== "completed"));
  const completedBatches = selectedSnapshot ? exportBatches.filter((batch) => batch.snapshotId === selectedSnapshot.id) : [];
  return { context, snapshots, selectedSnapshot, generatedDocuments, mappingOverrides, mappingSummary, exportPreview, aggregation, exportBatches, exportLines, reconciliations, auditEvents, exportStatus: completedBatches[0]?.status ?? "not_exported", lastExportDate: [...completedBatches].sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0]?.completedAt };
}

export function selectSnapshotVersion(stage: DocumentsExportStage, snapshotVersion: number): DomainResult<LockedSelectionSnapshot> {
  const snapshot = stage.snapshots.find((item) => item.version === snapshotVersion);
  if (!snapshot) return { ok: false, issues: [issue("invalid_snapshot_version", "Choose an existing locked snapshot version.")] };
  if (snapshot.organisationId !== stage.context.organisationId) return { ok: false, issues: [issue("cross_organisation_snapshot", "Snapshot belongs to another organisation.")] };
  if (snapshot.projectId !== stage.context.projectId) return { ok: false, issues: [issue("cross_project_snapshot", "Snapshot belongs to another project.")] };
  if (snapshot.status !== "locked" && snapshot.status !== "superseded") return { ok: false, issues: [issue("snapshot_not_locked", "A locked snapshot is required.")] };
  return ok(snapshot);
}

export async function generateSelectionDocument(stage: DocumentsExportStage, type: DocumentProjectionType, generatedBy = "builder", renderer: SelectionDocumentRenderer = htmlSelectionDocumentRenderer, repository: DocumentsExportRepository = documentsExportRepository): Promise<DomainResult<{ projection: DocumentProjection; record: GeneratedDocumentRecord }>> {
  if (!stage.selectedSnapshot || stage.selectedSnapshot.status !== "locked") return { ok: false, issues: [issue("missing_locked_snapshot", "A locked snapshot is required before generating approved documents.")] };
  const projection = buildDocumentProjection(stage.selectedSnapshot, type);
  if (projection.audience === "client" && JSON.stringify(projection).includes("builderCost")) return { ok: false, issues: [issue("client_document_contains_internal_field", "Client document cannot include internal builder values.")] };
  try {
    const rendered = await renderer.render(projection);
    const previous = stage.generatedDocuments.filter((document) => document.snapshotId === stage.selectedSnapshot?.id && document.documentType === type && document.status === "generated").sort((a, b) => b.documentVersion - a.documentVersion)[0];
    const record: GeneratedDocumentRecord = { id: makeScopedId("generated_document", [stage.context.organisationId, stage.context.projectId, stage.selectedSnapshot.id, type, Date.now()]), organisationId: stage.context.organisationId, projectId: stage.context.projectId, snapshotId: stage.selectedSnapshot.id, snapshotVersion: stage.selectedSnapshot.version, documentType: type, audience: projection.audience, generatedAt: new Date().toISOString(), generatedBy, documentVersion: (previous?.documentVersion ?? 0) + 1, status: "generated", contentHash: rendered.contentHash, storageReference: rendered.storageReference ?? `memory://${rendered.fileName}`, fileName: rendered.fileName, mimeType: rendered.mimeType, supersedesDocumentId: previous?.id };
    const documents = [...stage.generatedDocuments.map((document) => previous && document.id === previous.id ? { ...document, status: "superseded" as const } : document), record];
    await repository.saveGeneratedDocuments(stage.context, documents);
    await repository.saveAuditEvents(stage.context, [...stage.auditEvents, audit(stage.context, "GeneratedDocument", record.id, previous ? "document_regenerated" : "document_generated", generatedBy)]);
    return ok({ projection, record });
  } catch (error) {
    const record: GeneratedDocumentRecord = { id: makeScopedId("generated_document_failed", [stage.context.organisationId, stage.context.projectId, stage.selectedSnapshot.id, type, Date.now()]), organisationId: stage.context.organisationId, projectId: stage.context.projectId, snapshotId: stage.selectedSnapshot.id, snapshotVersion: stage.selectedSnapshot.version, documentType: type, audience: projection.audience, generatedAt: new Date().toISOString(), generatedBy, documentVersion: 1, status: "failed", contentHash: "", fileName: fileNameFor(projection), mimeType: "text/html", failureReason: error instanceof Error ? error.message : "Document generation failed." };
    await repository.saveGeneratedDocuments(stage.context, [...stage.generatedDocuments, record]);
    return { ok: false, issues: [issue("document_generation_failure", record.failureReason ?? "Document generation failed.")] };
  }
}

export async function createMappingOverride(stage: DocumentsExportStage, sourceSnapshotLineId: string, input: Omit<EstimateMappingOverride, "id" | "organisationId" | "projectId" | "snapshotId" | "sourceSnapshotLineId" | "createdAt" | "previousValueSummary" | "newValueSummary">, repository: DocumentsExportRepository = documentsExportRepository): Promise<DomainResult<EstimateMappingOverride>> {
  if (!stage.selectedSnapshot) return { ok: false, issues: [issue("missing_locked_snapshot", "A locked snapshot is required.")] };
  const line = stage.selectedSnapshot.lines.find((item) => item.id === sourceSnapshotLineId);
  if (!line) return { ok: false, issues: [issue("missing_snapshot_line_traceability", "Choose a valid snapshot line.")] };
  if (!input.reason.trim()) return { ok: false, issues: [issue("missing_mapping_override_reason", "Mapping overrides require a reason.")] };
  const currentOverrides = await repository.listMappingOverrides(stage.context);
  const previous = overrideFor(currentOverrides, sourceSnapshotLineId);
  const override: EstimateMappingOverride = { ...input, id: makeScopedId("estimate_mapping_override", [stage.context.organisationId, stage.context.projectId, stage.selectedSnapshot.id, sourceSnapshotLineId, Date.now()]), organisationId: stage.context.organisationId, projectId: stage.context.projectId, snapshotId: stage.selectedSnapshot.id, sourceSnapshotLineId, createdAt: new Date().toISOString(), previousValueSummary: previous ? JSON.stringify(previous) : undefined, newValueSummary: JSON.stringify(input) };
  await repository.saveMappingOverrides(stage.context, [...currentOverrides, override]);
  await repository.saveAuditEvents(stage.context, [...stage.auditEvents, audit(stage.context, "EstimateMappingOverride", override.id, previous ? "mapping_override_changed" : "mapping_override_created", input.actorId, input.reason)]);
  return ok(override);
}

export function validateEstimateExport(stage: DocumentsExportStage): DomainResult<EstimateExportLine[]> {
  if (!stage.selectedSnapshot || stage.selectedSnapshot.status !== "locked") return { ok: false, issues: [issue("snapshot_not_locked", "A locked snapshot is required.")] };
  if (!stage.selectedSnapshot.clientApprovalId || !stage.selectedSnapshot.builderApprovalId) return { ok: false, issues: [issue("approval_invalid", "Current approval references are required.")] };
  if (stage.mappingSummary.issues.some((item) => item.blocking)) return { ok: false, issues: stage.mappingSummary.issues.filter((item) => item.blocking).map((item) => issue(item.status, item.issues.join(" "), item.sourceSnapshotLineId)) };
  if (stage.exportPreview.some((line) => line.status === "completed")) return { ok: false, issues: [issue("duplicate_export", "Completed export lines already exist for this snapshot. Retry failed lines only.")] };
  return ok(stage.aggregation.aggregatedLines);
}

function batchTotals(lines: EstimateExportLine[], currency = "AUD") {
  return { totalBuilderCost: addMoney(lines.map((line) => line.builderCost), currency), totalClientValue: addMoney(lines.map((line) => line.clientPrice), currency), totalVariation: addMoney(lines.map((line) => line.variation), currency) };
}

export async function executeEstimateExport(stage: DocumentsExportStage, actorId = "builder", adapter: EstimateExportAdapter = inMemoryEstimateExportAdapter, repository: DocumentsExportRepository = documentsExportRepository): Promise<DomainResult<{ batch: EstimateExportBatch; lines: EstimateExportLine[]; reconciliation: ExportReconciliation }>> {
  const validation = validateEstimateExport(stage);
  if (!validation.ok || !validation.value || !stage.selectedSnapshot) return { ok: false, issues: validation.issues };
  const adapterValidation = await adapter.validate(validation.value);
  if (!adapterValidation.ok) return { ok: false, issues: adapterValidation.issues };
  const totals = batchTotals(validation.value, stage.selectedSnapshot.currency);
  let batch: EstimateExportBatch = { id: makeScopedId("estimate_export_batch", [stage.context.organisationId, stage.context.projectId, stage.selectedSnapshot.id, Date.now()]), organisationId: stage.context.organisationId, projectId: stage.context.projectId, snapshotId: stage.selectedSnapshot.id, snapshotVersion: stage.selectedSnapshot.version, exportTarget: "estimate_builder", createdAt: new Date().toISOString(), startedAt: new Date().toISOString(), actorId, status: "exporting", totalLines: validation.value.length, completedLines: 0, failedLines: 0, skippedLines: 0, ...totals, adapterVersion: adapter.adapterVersion, mappingVersion: "mapping-v1" };
  await repository.saveExportBatches(stage.context, [...stage.exportBatches, batch]);
  const results = await adapter.exportBatch(batch, structuredClone(validation.value));
  const lines = validation.value.map((line) => {
    const result = results.find((item) => item.lineId === line.id);
    return { ...line, status: result?.status === "completed" ? "completed" as const : "failed" as const, failureReason: result?.failureReason };
  });
  batch = { ...batch, completedAt: new Date().toISOString(), completedLines: lines.filter((line) => line.status === "completed").length, failedLines: lines.filter((line) => line.status === "failed").length, status: lines.some((line) => line.status === "failed") ? "partially_completed" : "completed", failureSummary: lines.filter((line) => line.status === "failed").map((line) => line.failureReason).filter(Boolean).join("; ") || undefined };
  const reconciliation = reconcileEstimateExport(stage.selectedSnapshot, batch, lines);
  if (reconciliation.status !== "reconciled") batch = { ...batch, status: "failed", failureSummary: reconciliation.failureReason };
  await repository.saveExportLines(stage.context, [...stage.exportLines.filter((line) => !lines.some((next) => next.idempotencyKey === line.idempotencyKey)), ...lines]);
  await repository.saveExportBatches(stage.context, [...stage.exportBatches, batch]);
  await repository.saveReconciliations(stage.context, [...stage.reconciliations, reconciliation]);
  await repository.saveAuditEvents(stage.context, [...stage.auditEvents, audit(stage.context, "EstimateExportBatch", batch.id, batch.status === "completed" ? "export_completed" : "export_partially_completed", actorId, batch.failureSummary)]);
  return ok({ batch, lines, reconciliation });
}

export async function retryFailedExportLines(stage: DocumentsExportStage, actorId = "builder", adapter: EstimateExportAdapter = inMemoryEstimateExportAdapter, repository: DocumentsExportRepository = documentsExportRepository): Promise<DomainResult<{ batch: EstimateExportBatch; lines: EstimateExportLine[]; reconciliation: ExportReconciliation }>> {
  if (!stage.selectedSnapshot) return { ok: false, issues: [issue("missing_locked_snapshot", "A locked snapshot is required.")] };
  const failedSourceIds = new Set(stage.exportLines.filter((line) => line.snapshotId === stage.selectedSnapshot?.id && line.status === "failed").flatMap((line) => line.sourceSnapshotLineIds));
  if (!failedSourceIds.size) return { ok: false, issues: [issue("invalid_retry", "Only failed export lines can be retried.")] };
  const retryStage = { ...stage, exportPreview: stage.exportPreview.filter((line) => line.sourceSnapshotLineIds.some((id) => failedSourceIds.has(id))), aggregation: aggregateEstimateExportLines(stage.exportPreview.filter((line) => line.sourceSnapshotLineIds.some((id) => failedSourceIds.has(id)))) };
  return executeEstimateExport(retryStage, actorId, adapter, repository);
}

export function reconcileEstimateExport(snapshot: LockedSelectionSnapshot, batch: EstimateExportBatch, lines: EstimateExportLine[]): ExportReconciliation {
  const completed = lines.filter((line) => line.status === "completed");
  const exportedSourceLineCount = new Set(completed.flatMap((line) => line.sourceSnapshotLineIds)).size;
  const builderCost = addMoney(completed.map((line) => line.builderCost), snapshot.currency);
  const allowance = addMoney(completed.map((line) => line.allowance), snapshot.currency);
  const clientValue = addMoney(completed.map((line) => line.clientPrice), snapshot.currency);
  const variation = addMoney(completed.map((line) => line.variation), snapshot.currency);
  const gst = addMoney(completed.map((line) => line.gst), snapshot.currency);
  const failures: string[] = [];
  if (batch.failedLines) failures.push("Partial Export");
  if (exportedSourceLineCount !== snapshot.lines.length) failures.push("source-line count mismatch");
  if (roundCurrency(clientValue.amount - snapshot.totalSelectedValue.amount) !== 0) failures.push("client value mismatch");
  if (roundCurrency(allowance.amount - snapshot.totalAllowance.amount) !== 0) failures.push("allowance mismatch");
  if (roundCurrency(variation.amount - snapshot.netVariationExcludingGst.amount) !== 0) failures.push("variation mismatch");
  if (roundCurrency(gst.amount - snapshot.gst.amount) !== 0) failures.push("GST mismatch");
  return { id: makeScopedId("export_reconciliation", [snapshot.organisationId, snapshot.projectId, batch.id]), organisationId: snapshot.organisationId, projectId: snapshot.projectId, batchId: batch.id, snapshotId: snapshot.id, snapshotVersion: snapshot.version, status: failures.length ? "reconciliation_failed" : "reconciled", checkedAt: new Date().toISOString(), quantityDifference: roundCurrency(completed.reduce((total, line) => total + line.quantity, 0) - snapshot.lines.reduce((total, line) => total + line.quantity, 0)), builderCostDifference: money(roundCurrency(builderCost.amount - snapshot.lines.reduce((total, line) => total + line.builderCost.amount, 0)), snapshot.currency), allowanceDifference: money(roundCurrency(allowance.amount - snapshot.totalAllowance.amount), snapshot.currency), clientValueDifference: money(roundCurrency(clientValue.amount - snapshot.totalSelectedValue.amount), snapshot.currency), variationDifference: money(roundCurrency(variation.amount - snapshot.netVariationExcludingGst.amount), snapshot.currency), gstDifference: money(roundCurrency(gst.amount - snapshot.gst.amount), snapshot.currency), sourceLineCountDifference: exportedSourceLineCount - snapshot.lines.length, exportedGroupCount: completed.length, failureReason: failures.join("; ") || undefined };
}

export function loadExportHistory(stage: DocumentsExportStage): EstimateExportBatch[] {
  return [...stage.exportBatches].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function loadGeneratedDocuments(stage: DocumentsExportStage): GeneratedDocumentRecord[] {
  return [...stage.generatedDocuments].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}
