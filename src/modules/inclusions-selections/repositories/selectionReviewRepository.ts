import type { Money } from "../shared/money";
import type { ProjectSelectionContext } from "./projectAreaRegisterRepository";
import { loadPersistedValue, projectStorageKey, removePersistedValue, savePersistedValue } from "../shared/persistentScopedStore";

export type ReviewView = "summary" | "room" | "category" | "variations" | "issues" | "custom";
export type ReviewStatus = "draft" | "review_required" | "pricing_incomplete" | "selection_incomplete" | "conflicts_present" | "ready_for_approval";
export type ReviewIssueSeverity = "information" | "warning" | "blocking";

export type SelectionReviewState = {
  organisationId: string;
  projectId: string;
  selectedView: ReviewView;
  status: ReviewStatus;
  readyForApproval: boolean;
  selectionFingerprint: string;
  savedStatus: "saved" | "saving" | "unsaved" | "save_failed";
  updatedAt: string;
};

export type ReviewIssue = {
  id: string;
  code: string;
  severity: ReviewIssueSeverity;
  organisationId: string;
  projectId: string;
  areaId?: string;
  requirementId?: string;
  selectionId?: string;
  title: string;
  description: string;
  resolutionAction: string;
  createdAt: string;
  resolvedAt?: string;
  acknowledgedAt?: string;
  acknowledgementReason?: string;
  blocking: boolean;
};

export type AllowanceOverride = {
  id: string;
  organisationId: string;
  projectId: string;
  requirementId: string;
  selectionId: string;
  previousAllowance: Money;
  newAllowance: Money;
  actorId: string;
  reason: string;
  createdAt: string;
};

export type ReviewAuditEvent = {
  id: string;
  actorId: string;
  actorType: "builder" | "system";
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

export type SelectionReviewRepository = {
  loadReviewState(context: ProjectSelectionContext): Promise<SelectionReviewState | null>;
  saveReviewState(state: SelectionReviewState): Promise<SelectionReviewState>;
  listIssues(context: ProjectSelectionContext): Promise<ReviewIssue[]>;
  saveIssues(context: ProjectSelectionContext, issues: ReviewIssue[]): Promise<ReviewIssue[]>;
  listAllowanceOverrides(context: ProjectSelectionContext): Promise<AllowanceOverride[]>;
  saveAllowanceOverrides(context: ProjectSelectionContext, overrides: AllowanceOverride[]): Promise<AllowanceOverride[]>;
  listAuditEvents(context: ProjectSelectionContext): Promise<ReviewAuditEvent[]>;
  saveAuditEvents(context: ProjectSelectionContext, events: ReviewAuditEvent[]): Promise<ReviewAuditEvent[]>;
};

function key(organisationId: string, projectId: string): string {
  return `${organisationId}:${projectId}`;
}

function storageKey(bucket: string, context: Pick<ProjectSelectionContext, "organisationId" | "projectId">): string {
  return projectStorageKey(bucket, context.organisationId, context.projectId);
}

export class InMemorySelectionReviewRepository implements SelectionReviewRepository {
  private states = new Map<string, SelectionReviewState>();
  private issues = new Map<string, ReviewIssue[]>();
  private overrides = new Map<string, AllowanceOverride[]>();
  private auditEvents = new Map<string, ReviewAuditEvent[]>();

  async loadReviewState(context: ProjectSelectionContext): Promise<SelectionReviewState | null> {
    const state = this.states.get(key(context.organisationId, context.projectId)) ?? loadPersistedValue<SelectionReviewState>(storageKey("review-state", context));
    if (state) this.states.set(key(context.organisationId, context.projectId), structuredClone(state));
    return structuredClone(state ?? null);
  }

  async saveReviewState(state: SelectionReviewState): Promise<SelectionReviewState> {
    const saved = { ...structuredClone(state), savedStatus: "saved" as const, updatedAt: new Date().toISOString() };
    this.states.set(key(saved.organisationId, saved.projectId), saved);
    savePersistedValue(storageKey("review-state", saved), saved);
    return structuredClone(saved);
  }

  async listIssues(context: ProjectSelectionContext): Promise<ReviewIssue[]> {
    const issues = this.issues.get(key(context.organisationId, context.projectId)) ?? loadPersistedValue<ReviewIssue[]>(storageKey("review-issues", context)) ?? [];
    this.issues.set(key(context.organisationId, context.projectId), structuredClone(issues));
    return structuredClone(issues);
  }

  async saveIssues(context: ProjectSelectionContext, issues: ReviewIssue[]): Promise<ReviewIssue[]> {
    const scoped = issues.filter((item) => item.organisationId === context.organisationId && item.projectId === context.projectId);
    this.issues.set(key(context.organisationId, context.projectId), structuredClone(scoped));
    savePersistedValue(storageKey("review-issues", context), scoped);
    return structuredClone(scoped);
  }

  async listAllowanceOverrides(context: ProjectSelectionContext): Promise<AllowanceOverride[]> {
    const overrides = this.overrides.get(key(context.organisationId, context.projectId)) ?? loadPersistedValue<AllowanceOverride[]>(storageKey("review-overrides", context)) ?? [];
    this.overrides.set(key(context.organisationId, context.projectId), structuredClone(overrides));
    return structuredClone(overrides);
  }

  async saveAllowanceOverrides(context: ProjectSelectionContext, overrides: AllowanceOverride[]): Promise<AllowanceOverride[]> {
    const scoped = overrides.filter((item) => item.organisationId === context.organisationId && item.projectId === context.projectId);
    this.overrides.set(key(context.organisationId, context.projectId), structuredClone(scoped));
    savePersistedValue(storageKey("review-overrides", context), scoped);
    return structuredClone(scoped);
  }

  async listAuditEvents(context: ProjectSelectionContext): Promise<ReviewAuditEvent[]> {
    const events = this.auditEvents.get(key(context.organisationId, context.projectId)) ?? loadPersistedValue<ReviewAuditEvent[]>(storageKey("review-audit-events", context)) ?? [];
    this.auditEvents.set(key(context.organisationId, context.projectId), structuredClone(events));
    return structuredClone(events);
  }

  async saveAuditEvents(context: ProjectSelectionContext, events: ReviewAuditEvent[]): Promise<ReviewAuditEvent[]> {
    const scoped = events.filter((item) => item.organisationId === context.organisationId && item.projectId === context.projectId);
    this.auditEvents.set(key(context.organisationId, context.projectId), structuredClone(scoped));
    savePersistedValue(storageKey("review-audit-events", context), scoped);
    return structuredClone(scoped);
  }

  resetProject(context: Pick<ProjectSelectionContext, "organisationId" | "projectId">): void {
    const scopedKey = key(context.organisationId, context.projectId);
    this.states.delete(scopedKey);
    this.issues.delete(scopedKey);
    this.overrides.delete(scopedKey);
    this.auditEvents.delete(scopedKey);
    ["review-state", "review-issues", "review-overrides", "review-audit-events"].forEach((bucket) => {
      removePersistedValue(storageKey(bucket, context));
    });
  }
}

export const selectionReviewRepository = new InMemorySelectionReviewRepository();
