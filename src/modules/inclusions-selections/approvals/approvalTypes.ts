import type { ApprovalId, ProjectScopedEntity, SelectionId } from "../shared/ids";

export type ApprovalRole = "builder" | "client" | "admin";
export type ApprovalDecision = "pending" | "approved" | "rejected" | "withdrawn";

export type SelectionApproval = ProjectScopedEntity & {
  id: ApprovalId;
  selectionId: SelectionId;
  role: ApprovalRole;
  decision: ApprovalDecision;
  decidedBy?: string;
  decidedAt?: string;
  notes?: string;
};
