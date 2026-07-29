import type { ProjectRequirement } from "../requirements/requirementTypes";
import { makeScopedId } from "../shared/ids";
import type { SelectionSnapshot, SelectionSnapshotLine } from "./snapshotTypes";

export function createSelectionSnapshot(input: {
  organisationId: string;
  projectId: string;
  version: number;
  lockedBy: string;
  requirements: ProjectRequirement[];
  lines: SelectionSnapshotLine[];
  lockedAt?: string;
}): SelectionSnapshot {
  const requirementIds = new Set(input.requirements.map((requirement) => requirement.id));
  const validLines = input.lines.filter((line) => requirementIds.has(line.requirementId));
  return {
    id: makeScopedId("selection_snapshot", [input.projectId, input.version]),
    organisationId: input.organisationId,
    projectId: input.projectId,
    version: input.version,
    status: "locked",
    lockedAt: input.lockedAt ?? new Date().toISOString(),
    lockedBy: input.lockedBy,
    lines: validLines.map((line) => ({ ...line })),
  };
}

export function supersedeSnapshot(snapshot: SelectionSnapshot): SelectionSnapshot {
  return { ...snapshot, status: "superseded", lines: snapshot.lines.map((line) => ({ ...line })) };
}
