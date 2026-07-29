import { STANDARD_AREA_GROUPS } from "../area-groups/standardAreaGroups";
import { STANDARD_AREA_TYPES } from "../area-types/standardAreaTypes";
import type { ApprovalMethod, ApprovalRecord, ApprovalStageRepository, ApprovalStatus, DraftRevision, LockedSelectionSnapshot, LockedSelectionSnapshotLine, SnapshotComparisonChange } from "../repositories/approvalStageRepository";
import { approvalStageRepository } from "../repositories/approvalStageRepository";
import type { ProjectSelectionContext } from "../repositories/projectAreaRegisterRepository";
import type { SelectionReviewRepository } from "../repositories/selectionReviewRepository";
import { selectionReviewRepository } from "../repositories/selectionReviewRepository";
import type { SelectionWorkspaceRepository } from "../repositories/selectionWorkspaceRepository";
import { selectionWorkspaceRepository } from "../repositories/selectionWorkspaceRepository";
import { makeScopedId } from "../shared/ids";
import { money, roundCurrency } from "../shared/money";
import type { Money } from "../shared/money";
import { buildBuilderInternalProjection, buildClientVariationProjection, calculateVariationSummary, loadSelectionReview, revokeReadyForApproval, validateReviewReadiness, type BuilderInternalProjection, type ClientVariationProjection, type SelectionReview } from "./selectionReviewService";
import type { DomainResult } from "../validation/errors";
import { issue, ok } from "../validation/errors";

export type ApprovalStage = {
  context: ProjectSelectionContext;
  review: SelectionReview;
  currentFingerprint: string;
  currentDraftRevision: number;
  approvals: ApprovalRecord[];
  history: import("../repositories/approvalStageRepository").ApprovalHistoryEvent[];
  snapshots: LockedSelectionSnapshot[];
  draftRevisions: DraftRevision[];
  clientProjection: ClientApprovalProjection;
  builderProjection: BuilderApprovalProjection;
  status: ApprovalStatus;
  staleWarnings: string[];
  readiness: SnapshotReadiness;
};

export type ClientApprovalProjection = ClientVariationProjection & {
  declaration: "Approval confirms the selections and pricing shown in this version.";
  draftWarning: "Draft until both client and builder approval are complete and the selection version is locked.";
  groupedByRoom: Array<{ areaName: string; lines: ClientVariationProjection["lines"] }>;
};

export type BuilderApprovalProjection = BuilderInternalProjection & {
  heading: "Internal Builder Approval";
  outstandingWarnings: string[];
  estimateMappingComplete: boolean;
};

export type SnapshotReadiness = {
  ready: boolean;
  reasons: string[];
  checklist: Array<{ label: string; ok: boolean; reason?: string }>;
};

export type ApprovalInput = {
  approverName: string;
  approverRole: string;
  method: ApprovalMethod;
  approvedAt?: string;
  declaration: string;
  comments?: string;
  recordedBy: string;
  recordedByRepresentative?: boolean;
};

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

function digest(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fp_${(hash >>> 0).toString(16).padStart(8, "0")}_${text.length}`;
}

export function calculateApprovalFingerprint(review: SelectionReview): string {
  return digest(stable({
    reviewReady: review.reviewState.readyForApproval,
    reviewStatus: review.reviewState.status,
    reviewRevision: review.reviewState.selectionFingerprint,
    issues: review.issues.map((item) => ({ id: item.id, code: item.code, severity: item.severity, blocking: item.blocking, resolvedAt: item.resolvedAt, acknowledgedAt: item.acknowledgedAt })).sort((a, b) => a.id.localeCompare(b.id)),
    areas: review.workspace.templateStage.areaRegister.areas.map((area) => ({ id: area.id, name: area.name, areaTypeId: area.areaTypeId, groupId: area.groupId, levelId: area.levelId })).sort((a, b) => a.id.localeCompare(b.id)),
    requirements: review.workspace.requirements.map((requirement) => ({ id: requirement.id, areaId: requirement.areaId, title: requirement.title, category: requirement.category, subtype: requirement.subtype, required: requirement.required, status: requirement.status })).sort((a, b) => a.id.localeCompare(b.id)),
    selections: review.workspace.selections.map((selection) => ({ id: selection.id, requirementId: selection.requirementId, status: selection.selectionStatus, product: selection.value.productReferenceId, variant: selection.value.variantId, custom: selection.value.customSelectionName, customDescription: selection.value.description, quantity: selection.quantity, unit: selection.unit, allowance: selection.allowance, selectedPrice: selection.selectedPrice, gst: selection.gst, variation: selection.variation, notApplicableReason: selection.notApplicableReason, clientNotes: review.workspace.notes.filter((note) => note.requirementId === selection.requirementId && note.kind === "client_visible").map((note) => note.text).sort() })).sort((a, b) => a.id.localeCompare(b.id)),
    locations: review.workspace.locations.map((location) => ({ id: location.id, selectionId: location.selectionId, areaId: location.areaId, requirementId: location.requirementId, quantity: location.quantity, pricingQuantity: location.pricingQuantity, unit: location.unit })).sort((a, b) => a.id.localeCompare(b.id)),
  }));
}

function latestCurrentApproval(approvals: ApprovalRecord[], party: "client" | "builder", fingerprint: string): ApprovalRecord | undefined {
  return [...approvals].reverse().find((approval) => approval.party === party && approval.status === "approved" && approval.approvedFingerprint === fingerprint);
}

function statusFor(stage: Pick<ApprovalStage, "approvals" | "snapshots" | "currentFingerprint" | "review">): ApprovalStatus {
  const latest = [...stage.snapshots].sort((a, b) => b.version - a.version)[0];
  if (latest?.sourceFingerprint === stage.currentFingerprint && latest.status === "locked") return "locked";
  if (stage.approvals.some((approval) => approval.status === "stale")) return "approval_stale";
  const client = latestCurrentApproval(stage.approvals, "client", stage.currentFingerprint);
  const builder = latestCurrentApproval(stage.approvals, "builder", stage.currentFingerprint);
  if (client && builder) return "fully_approved";
  if (client) return "client_approved";
  if (builder) return "builder_approved";
  const latestApproval = [...stage.approvals].reverse()[0];
  return latestApproval?.status === "revoked" ? "not_started" : "prepared";
}

function history(stage: ApprovalStage, eventType: string, actor: string, actorRole: string, comments?: string, reason?: string) {
  return { id: makeScopedId("approval_event", [stage.context.organisationId, stage.context.projectId, eventType, Date.now(), stage.history.length]), organisationId: stage.context.organisationId, projectId: stage.context.projectId, eventType, actor, actorRole, timestamp: new Date().toISOString(), fingerprint: stage.currentFingerprint, comments, reason };
}

export function buildClientApprovalProjection(review: SelectionReview): ClientApprovalProjection {
  const projection = buildClientVariationProjection(review);
  const areaNames = [...new Set(projection.lines.map((line) => line.areaName))];
  return { ...projection, declaration: "Approval confirms the selections and pricing shown in this version.", draftWarning: "Draft until both client and builder approval are complete and the selection version is locked.", groupedByRoom: areaNames.map((areaName) => ({ areaName, lines: projection.lines.filter((line) => line.areaName === areaName) })) };
}

export function buildBuilderApprovalProjection(review: SelectionReview): BuilderApprovalProjection {
  const projection = buildBuilderInternalProjection(review);
  return { ...projection, heading: "Internal Builder Approval", outstandingWarnings: review.issues.filter((item) => !item.blocking && !item.acknowledgedAt).map((item) => item.title), estimateMappingComplete: true };
}

export async function loadApprovalStage(context: ProjectSelectionContext, repositories: { workspace?: SelectionWorkspaceRepository; review?: SelectionReviewRepository; approval?: ApprovalStageRepository } = {}): Promise<ApprovalStage> {
  const review = await loadSelectionReview(context, { workspace: repositories.workspace ?? selectionWorkspaceRepository, review: repositories.review ?? selectionReviewRepository });
  const repository = repositories.approval ?? approvalStageRepository;
  const [approvals, historyItems, snapshots, draftRevisions] = await Promise.all([repository.listApprovals(context), repository.listHistory(context), repository.listSnapshots(context), repository.listDraftRevisions(context)]);
  const currentFingerprint = calculateApprovalFingerprint(review);
  const currentDraftRevision = review.workspace.selections.reduce((max, selection) => Math.max(max, selection.revision), 0);
  const stage = { context, review, currentFingerprint, currentDraftRevision, approvals, history: historyItems, snapshots, draftRevisions, clientProjection: buildClientApprovalProjection(review), builderProjection: buildBuilderApprovalProjection(review), status: "not_started" as ApprovalStatus, staleWarnings: [] as string[], readiness: { ready: false, reasons: [], checklist: [] } };
  const stale = detectStaleApprovals(stage);
  const nextStage = { ...stage, approvals: stale.approvals, staleWarnings: stale.warnings };
  nextStage.status = statusFor(nextStage);
  nextStage.readiness = validateSnapshotReadiness(nextStage);
  return nextStage;
}

export function detectStaleApprovals(stage: ApprovalStage): { approvals: ApprovalRecord[]; warnings: string[] } {
  const warnings: string[] = [];
  const approvals = stage.approvals.map((approval) => {
    if (approval.status === "approved" && approval.approvedFingerprint !== stage.currentFingerprint) {
      warnings.push(`${approval.party} approval fingerprint ${approval.approvedFingerprint} is stale against ${stage.currentFingerprint}.`);
      return { ...approval, status: "stale" as const, staleReason: "Current approval fingerprint changed after approval." };
    }
    return approval;
  });
  return { approvals, warnings };
}

function validateApprovalInput(input: ApprovalInput, party: "client" | "builder"): DomainResult<ApprovalInput> {
  const issues = [];
  if (!input.approverName.trim()) issues.push(issue(`missing_${party}_approver`, "Approver name is required."));
  if (!input.approverRole.trim()) issues.push(issue(`missing_${party}_approver_role`, "Approver role is required."));
  if (!input.method) issues.push(issue("missing_approval_method", "Approval method is required."));
  if (!input.declaration.trim()) issues.push(issue("missing_approval_declaration", "Approval declaration is required."));
  if (input.approvedAt && Number.isNaN(new Date(input.approvedAt).getTime())) issues.push(issue("invalid_approval_timestamp", "Approval timestamp is invalid."));
  return issues.length ? { ok: false, issues } : ok(input);
}

export async function prepareClientReview(stage: ApprovalStage, repository: ApprovalStageRepository = approvalStageRepository): Promise<ApprovalStage> {
  const nextHistory = [...stage.history, history(stage, "client_review_prepared", "builder", "builder")];
  await repository.saveHistory(stage.context, nextHistory);
  return { ...stage, history: nextHistory, status: "prepared" };
}

export async function recordApprovalStageStatus(stage: ApprovalStage, status: Extract<ApprovalStatus, "sent_for_review" | "client_reviewing">, actor = "builder", actorRole = "builder", repository: ApprovalStageRepository = approvalStageRepository): Promise<ApprovalStage> {
  const eventType = status === "sent_for_review" ? "sent_for_client_review" : "client_reviewing";
  const nextHistory = await repository.saveHistory(stage.context, [...stage.history, history(stage, eventType, actor, actorRole)]);
  const next = { ...stage, history: nextHistory, status };
  next.readiness = validateSnapshotReadiness(next);
  return next;
}

export async function recordClientApproval(stage: ApprovalStage, input: ApprovalInput, repository: ApprovalStageRepository = approvalStageRepository): Promise<DomainResult<ApprovalStage>> {
  if (!stage.review.reviewState.readyForApproval) return { ok: false, issues: [issue("stage_4_not_ready_for_approval", "Stage 4 must be Ready for Approval before client approval.")] };
  const validation = validateApprovalInput(input, "client");
  if (!validation.ok) return { ok: false, issues: validation.issues };
  const approval: ApprovalRecord = { id: makeScopedId("client_approval", [stage.context.organisationId, stage.context.projectId, stage.currentFingerprint, Date.now()]), organisationId: stage.context.organisationId, projectId: stage.context.projectId, party: "client", status: "approved", approverName: input.approverName, approverRole: input.approverRole, method: input.method, approvedAt: input.approvedAt ?? new Date().toISOString(), approvedFingerprint: stage.currentFingerprint, declaration: input.declaration, comments: input.comments, recordedBy: input.recordedBy, recordedByRepresentative: input.recordedByRepresentative };
  const approvals = await repository.saveApprovals(stage.context, [...stage.approvals, approval]);
  const nextHistory = await repository.saveHistory(stage.context, [...stage.history, history(stage, "client_approved", input.recordedBy, input.approverRole, input.comments)]);
  const next = { ...stage, approvals, history: nextHistory };
  next.status = statusFor(next);
  next.readiness = validateSnapshotReadiness(next);
  return ok(next);
}

export async function recordBuilderApproval(stage: ApprovalStage, input: ApprovalInput, repository: ApprovalStageRepository = approvalStageRepository): Promise<DomainResult<ApprovalStage>> {
  if (!stage.review.reviewState.readyForApproval) return { ok: false, issues: [issue("stage_4_not_ready_for_approval", "Stage 4 must be Ready for Approval before builder approval.")] };
  if (!validateReviewReadiness(stage.review).ok) return { ok: false, issues: [issue("blocking_review_issues", "Resolve blocking review issues before builder approval.")] };
  const client = latestCurrentApproval(stage.approvals, "client", stage.currentFingerprint);
  if (stage.approvals.some((approval) => approval.party === "client" && approval.status === "approved" && approval.approvedFingerprint !== stage.currentFingerprint)) return { ok: false, issues: [issue("stale_client_approval", "Client approval is stale.")] };
  const validation = validateApprovalInput(input, "builder");
  if (!validation.ok) return { ok: false, issues: validation.issues };
  const approval: ApprovalRecord = { id: makeScopedId("builder_approval", [stage.context.organisationId, stage.context.projectId, stage.currentFingerprint, Date.now()]), organisationId: stage.context.organisationId, projectId: stage.context.projectId, party: "builder", status: "approved", approverName: input.approverName, approverRole: input.approverRole, method: input.method, approvedAt: input.approvedAt ?? new Date().toISOString(), approvedFingerprint: stage.currentFingerprint, declaration: input.declaration, comments: input.comments, recordedBy: input.recordedBy };
  const approvals = await repository.saveApprovals(stage.context, [...stage.approvals, approval]);
  const nextHistory = await repository.saveHistory(stage.context, [...stage.history, history(stage, "builder_approved", input.recordedBy, input.approverRole, input.comments, client ? undefined : "Builder approval recorded before client approval; snapshot still requires both approvals.")]);
  const next = { ...stage, approvals, history: nextHistory };
  next.status = statusFor(next);
  next.readiness = validateSnapshotReadiness(next);
  return ok(next);
}

export async function recordClientChangesRequested(stage: ApprovalStage, comments: string, requirementId?: string, repositories: { approval?: ApprovalStageRepository; review?: SelectionReviewRepository } = {}): Promise<ApprovalStage> {
  const repository = repositories.approval ?? approvalStageRepository;
  const approvals = await repository.saveApprovals(stage.context, stage.approvals.map((approval) => approval.status === "approved" ? { ...approval, status: "stale" as const, staleReason: "Client requested changes." } : approval));
  const nextHistory = await repository.saveHistory(stage.context, [...stage.history, { ...history(stage, "changes_requested", "client", "client", comments, "Client requested changes."), requirementId }]);
  const review = stage.review.reviewState.readyForApproval ? await revokeReadyForApproval(stage.review, "Client requested changes.", repositories.review ?? selectionReviewRepository) : stage.review;
  const next = { ...stage, review, approvals, history: nextHistory, status: "changes_requested" as ApprovalStatus, staleWarnings: ["Client requested changes; return to the Selection Workspace and restart approval."] };
  next.readiness = validateSnapshotReadiness(next);
  return next;
}

export async function revokeClientApproval(stage: ApprovalStage, reason: string, repository: ApprovalStageRepository = approvalStageRepository): Promise<ApprovalStage> {
  const approvals = await repository.saveApprovals(stage.context, stage.approvals.map((approval) => approval.party === "client" && approval.status === "approved" ? { ...approval, status: "revoked" as const, staleReason: reason } : approval));
  const nextHistory = await repository.saveHistory(stage.context, [...stage.history, history(stage, "client_approval_revoked", "builder", "builder", undefined, reason)]);
  return { ...stage, approvals, history: nextHistory, status: "not_started" };
}

export async function revokeBuilderApproval(stage: ApprovalStage, reason: string, repository: ApprovalStageRepository = approvalStageRepository): Promise<ApprovalStage> {
  const approvals = await repository.saveApprovals(stage.context, stage.approvals.map((approval) => approval.party === "builder" && approval.status === "approved" ? { ...approval, status: "revoked" as const, staleReason: reason } : approval));
  const nextHistory = await repository.saveHistory(stage.context, [...stage.history, history(stage, "builder_approval_revoked", "builder", "builder", undefined, reason)]);
  return { ...stage, approvals, history: nextHistory, status: "not_started" };
}

export function validateSnapshotReadiness(stage: ApprovalStage): SnapshotReadiness {
  const client = latestCurrentApproval(stage.approvals, "client", stage.currentFingerprint);
  const builder = latestCurrentApproval(stage.approvals, "builder", stage.currentFingerprint);
  const reviewValidation = validateReviewReadiness(stage.review);
  const nextVersion = (stage.snapshots.reduce((max, snapshot) => Math.max(max, snapshot.version), 0) || 0) + 1;
  const checklist = [
    { label: "Stage 4 Ready for Approval", ok: stage.review.reviewState.readyForApproval, reason: "Mark the review Ready for Approval." },
    { label: "No blocking review issues", ok: reviewValidation.ok, reason: "Resolve blocking review issues." },
    { label: "Client approval current", ok: Boolean(client), reason: "Record current client approval." },
    { label: "Builder approval current", ok: Boolean(builder), reason: "Record current builder approval." },
    { label: "Fingerprints match", ok: Boolean(client && builder && client.approvedFingerprint === builder.approvedFingerprint && builder.approvedFingerprint === stage.currentFingerprint), reason: "Approvals must match the current fingerprint." },
    { label: "Required selections complete", ok: stage.review.workspace.requirements.filter((requirement) => requirement.required).every((requirement) => stage.review.workspace.selections.some((selection) => selection.requirementId === requirement.id && selection.selectionStatus === "complete")), reason: "Complete all required selections." },
    { label: "Snapshot version available", ok: !stage.snapshots.some((snapshot) => snapshot.version === nextVersion), reason: "Duplicate snapshot version." },
  ];
  const reasons = checklist.filter((item) => !item.ok).map((item) => item.reason ?? item.label);
  return { ready: reasons.length === 0, reasons, checklist };
}

function sumMoney(values: Money[], currency = "AUD"): Money {
  return money(roundCurrency(values.reduce((total, item) => total + item.amount, 0)), currency);
}

function snapshotLines(stage: ApprovalStage, snapshotId: string): LockedSelectionSnapshotLine[] {
  return stage.review.lines.map((line) => {
    const areaType = STANDARD_AREA_TYPES.find((item) => item.id === line.area.areaTypeId);
    const areaGroup = STANDARD_AREA_GROUPS.find((item) => item.id === line.area.groupId);
    const level = stage.review.workspace.templateStage.areaRegister.levels.find((item) => item.id === line.area.levelId);
    const notes = stage.review.workspace.notes.filter((note) => note.requirementId === line.requirement.id);
    return {
      id: makeScopedId("snapshot_line", [snapshotId, line.requirement.id]),
      organisationId: stage.context.organisationId,
      projectId: stage.context.projectId,
      snapshotId,
      sourceAreaId: line.area.id,
      areaName: line.area.name,
      areaTypeId: line.area.areaTypeId,
      areaTypeName: areaType?.name ?? line.area.areaTypeId,
      areaGroupId: line.area.groupId,
      areaGroupName: areaGroup?.name ?? line.area.groupId,
      projectLevelId: line.area.levelId,
      projectLevelName: level?.name ?? line.area.levelId,
      sourceRequirementId: line.requirement.id,
      requirementName: line.requirement.title,
      category: line.requirement.category,
      requirementStatus: line.requirement.required ? "required" : line.requirement.applicability ?? "optional",
      sourceSelectionId: line.selection?.id,
      selectionType: line.selection?.selectionStatus === "not_applicable" ? "not_applicable" : line.selection?.value.customSelectionId ? "custom" : line.selection?.value.productReferenceId ? "product" : "missing",
      productId: line.selection?.value.productReferenceId,
      productVariantId: line.selection?.value.variantId,
      productCode: line.product?.productCode,
      productName: line.product?.name ?? line.selection?.value.customSelectionName,
      brand: line.selection?.value.brand,
      model: line.selection?.value.model,
      colour: line.selection?.value.colour,
      description: line.selection?.value.description,
      imageReference: line.product?.imageUrl,
      supplierId: line.selection?.value.supplierId,
      supplierName: line.supplierName,
      supplierSku: line.selection?.value.supplierSku,
      locations: stage.review.workspace.locations.filter((location) => location.requirementId === line.requirement.id).map((location) => ({ id: makeScopedId("snapshot_location", [snapshotId, location.id]), sourceLocationId: location.id, areaId: location.areaId, requirementId: location.requirementId, label: location.label, quantity: location.quantity, pricingQuantity: location.pricingQuantity, unit: location.unit })),
      quantity: line.quantity,
      unit: line.unit,
      pricingQuantity: line.quantity,
      builderCost: line.builderCost,
      allowance: line.allowance,
      markup: money(roundCurrency(line.selectedValue.amount - line.builderCost.amount), line.selectedValue.currency),
      clientPrice: line.selectedValue,
      variation: line.variation,
      gstTreatment: "gst_exclusive",
      gstAmount: line.gst,
      priceSource: line.selection?.value.priceSource,
      priceEffectiveDate: line.selection?.value.priceEffectiveDate,
      clientVisibleNotes: notes.filter((note) => note.kind === "client_visible").map((note) => note.text),
      internalNotes: notes.filter((note) => note.kind === "internal").map((note) => note.text),
      notApplicableReason: line.selection?.notApplicableReason,
      customSelectionDetails: line.selection?.value.customSelectionId ? { name: line.selection.value.customSelectionName, description: line.selection.value.description, brand: line.selection.value.brand, model: line.selection.value.model, colour: line.selection.value.colour } : undefined,
      approvalFingerprint: stage.currentFingerprint,
      createdAt: new Date().toISOString(),
    };
  });
}

export async function createLockedSelectionSnapshot(stage: ApprovalStage, lockedBy = "builder", repository: ApprovalStageRepository = approvalStageRepository): Promise<DomainResult<ApprovalStage>> {
  const readiness = validateSnapshotReadiness(stage);
  if (!readiness.ready) return { ok: false, issues: readiness.reasons.map((reason) => issue("snapshot_not_ready", reason)) };
  const client = latestCurrentApproval(stage.approvals, "client", stage.currentFingerprint);
  const builder = latestCurrentApproval(stage.approvals, "builder", stage.currentFingerprint);
  if (!client || !builder) return { ok: false, issues: [issue("missing_approval", "Current client and builder approvals are required.")] };
  const version = stage.snapshots.reduce((max, snapshot) => Math.max(max, snapshot.version), 0) + 1;
  const snapshotId = makeScopedId("selection_snapshot", [stage.context.organisationId, stage.context.projectId, version]);
  const variation = calculateVariationSummary(stage.review);
  const lines = snapshotLines(stage, snapshotId);
  const previous = [...stage.snapshots].sort((a, b) => b.version - a.version)[0];
  const snapshot: LockedSelectionSnapshot = {
    id: snapshotId,
    organisationId: stage.context.organisationId,
    projectId: stage.context.projectId,
    version,
    status: "locked",
    sourceReviewRevision: stage.currentDraftRevision,
    sourceFingerprint: stage.currentFingerprint,
    clientApprovalId: client.id,
    builderApprovalId: builder.id,
    lockedAt: new Date().toISOString(),
    lockedBy,
    supersedesSnapshotId: previous?.id,
    totalAllowance: variation.totalAllowance,
    totalSelectedValue: variation.totalSelectedValue,
    totalCredits: variation.totalCredits,
    totalUpgrades: variation.totalUpgrades,
    netVariationExcludingGst: variation.netExcludingGst,
    gst: variation.gst,
    netVariationIncludingGst: variation.netIncludingGst,
    currency: variation.netIncludingGst.currency,
    projectSummary: { projectName: stage.context.projectName, clientName: stage.context.clientName, siteAddress: stage.context.siteAddress, tierId: stage.review.summary.projectTierId },
    metadataVersion: 1,
    lines,
  };
  const savedSnapshot = await repository.createSnapshot(stage.context, snapshot);
  const historyItems = await repository.saveHistory(stage.context, [...stage.history, history(stage, "snapshot_locked", lockedBy, "builder", `Version ${version}`)]);
  const snapshots = [...stage.snapshots.map((item) => previous && item.id === previous.id ? { ...item, status: "superseded" as const, supersededBySnapshotId: savedSnapshot.id } : item), savedSnapshot];
  const next = { ...stage, snapshots, history: historyItems, status: "locked" as ApprovalStatus };
  next.readiness = validateSnapshotReadiness(next);
  return ok(next);
}

export async function startNewDraftRevision(stage: ApprovalStage, createdBy = "builder", repository: ApprovalStageRepository = approvalStageRepository): Promise<DraftRevision> {
  const latest = [...stage.snapshots].sort((a, b) => b.version - a.version)[0];
  const revision: DraftRevision = { id: makeScopedId("draft_revision", [stage.context.organisationId, stage.context.projectId, Date.now()]), organisationId: stage.context.organisationId, projectId: stage.context.projectId, sourceSnapshotId: latest?.id, revisionNumber: stage.draftRevisions.length + 1, status: "editable", createdAt: new Date().toISOString(), createdBy };
  await repository.saveDraftRevisions(stage.context, [...stage.draftRevisions, revision]);
  await repository.saveHistory(stage.context, [...stage.history, history(stage, "new_revision_started", createdBy, "builder", undefined, latest ? `Based on snapshot version ${latest.version}` : undefined)]);
  return revision;
}

export function compareSelectionSnapshots(previous: LockedSelectionSnapshot, next: LockedSelectionSnapshot): SnapshotComparisonChange[] {
  const changes: SnapshotComparisonChange[] = [];
  const previousByRequirement = new Map(previous.lines.map((line) => [line.sourceRequirementId, line]));
  const nextByRequirement = new Map(next.lines.map((line) => [line.sourceRequirementId, line]));
  const currency = next.netVariationIncludingGst.currency;
  next.lines.forEach((line) => {
    const before = previousByRequirement.get(line.sourceRequirementId);
    if (!before) changes.push({ id: `${line.id}:added`, changeType: "added", areaName: line.areaName, requirementName: line.requirementName, newValue: line.productName, financialDifference: line.variation });
    else {
      if (before.productId !== line.productId) changes.push({ id: `${line.id}:product`, changeType: "product_changed", areaName: line.areaName, requirementName: line.requirementName, previousValue: before.productName, newValue: line.productName, financialDifference: money(roundCurrency(line.variation.amount - before.variation.amount), currency) });
      if (before.productVariantId !== line.productVariantId) changes.push({ id: `${line.id}:variant`, changeType: "variant_changed", areaName: line.areaName, requirementName: line.requirementName, previousValue: before.productVariantId, newValue: line.productVariantId, financialDifference: money(0, currency) });
      if (before.quantity !== line.quantity) changes.push({ id: `${line.id}:quantity`, changeType: "quantity_changed", areaName: line.areaName, requirementName: line.requirementName, previousValue: String(before.quantity), newValue: String(line.quantity), financialDifference: money(roundCurrency(line.variation.amount - before.variation.amount), currency) });
      if (before.clientPrice.amount !== line.clientPrice.amount) changes.push({ id: `${line.id}:price`, changeType: "price_changed", areaName: line.areaName, requirementName: line.requirementName, previousValue: String(before.clientPrice.amount), newValue: String(line.clientPrice.amount), financialDifference: money(roundCurrency(line.clientPrice.amount - before.clientPrice.amount), currency) });
      if (before.allowance.amount !== line.allowance.amount) changes.push({ id: `${line.id}:allowance`, changeType: "allowance_changed", areaName: line.areaName, requirementName: line.requirementName, previousValue: String(before.allowance.amount), newValue: String(line.allowance.amount), financialDifference: money(roundCurrency(line.variation.amount - before.variation.amount), currency) });
      if (before.notApplicableReason !== line.notApplicableReason) changes.push({ id: `${line.id}:na`, changeType: "not_applicable_changed", areaName: line.areaName, requirementName: line.requirementName, previousValue: before.notApplicableReason, newValue: line.notApplicableReason, financialDifference: money(0, currency) });
    }
  });
  previous.lines.forEach((line) => {
    if (!nextByRequirement.has(line.sourceRequirementId)) changes.push({ id: `${line.id}:removed`, changeType: "removed", areaName: line.areaName, requirementName: line.requirementName, previousValue: line.productName, financialDifference: money(-line.variation.amount, currency) });
  });
  return changes;
}

export async function saveApprovalStage(stage: ApprovalStage, repository: ApprovalStageRepository = approvalStageRepository): Promise<ApprovalStage> {
  const [approvals, historyItems, draftRevisions] = await Promise.all([repository.saveApprovals(stage.context, stage.approvals), repository.saveHistory(stage.context, stage.history), repository.saveDraftRevisions(stage.context, stage.draftRevisions)]);
  return { ...stage, approvals, history: historyItems, draftRevisions };
}
