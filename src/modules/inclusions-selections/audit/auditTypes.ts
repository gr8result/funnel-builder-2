import type { AuditEntryId, ProjectId } from "../shared/ids";

export type AuditAction =
  | "area_created"
  | "requirement_generated"
  | "selection_changed"
  | "approval_recorded"
  | "snapshot_locked"
  | "estimate_exported";

export type AuditEntry = {
  id: AuditEntryId;
  organisationId: string;
  projectId: ProjectId;
  action: AuditAction;
  actorId: string;
  occurredAt: string;
  subjectId: string;
  metadata?: Record<string, unknown>;
};
