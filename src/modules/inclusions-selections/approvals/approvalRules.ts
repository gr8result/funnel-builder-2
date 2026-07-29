import type { ProjectRequirement } from "../requirements/requirementTypes";
import type { ProjectSelection } from "../selections/selectionTypes";
import type { SelectionApproval } from "./approvalTypes";

export function canLockSelectionSet(requirements: ProjectRequirement[], selections: ProjectSelection[], approvals: SelectionApproval[]): boolean {
  const selectionByRequirement = new Map(selections.map((selection) => [selection.requirementId, selection]));
  return requirements
    .filter((requirement) => requirement.required && requirement.status !== "obsolete" && requirement.status !== "blocked_obsolete")
    .every((requirement) => {
      const selection = selectionByRequirement.get(requirement.id);
      if (!selection) return false;
      const selectionApprovals = approvals.filter((approval) => approval.selectionId === selection.id);
      return ["builder", "client"].every((role) =>
        selectionApprovals.some((approval) => approval.role === role && approval.decision === "approved"),
      );
    });
}
