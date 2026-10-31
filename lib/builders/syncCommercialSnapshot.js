import { supabase } from "../../utils/supabase-client";
import { commercialSnapshotPayload } from "./commercialSnapshotPayload.js";

export async function syncCommercialSnapshot({
  workspace_id,
  workspaceId,
  project,
  projectMetadata,
  job,
  jobMetadata,
  workbook,
  calculated,
  calculatedWorkbookResult,
  commercial_project_id,
  commercialProjectId,
} = {}) {
  const resolvedWorkspaceId = workspace_id || workspaceId;
  if (!resolvedWorkspaceId) throw new Error("workspace_id is required");
  if (!workbook || typeof workbook !== "object") throw new Error("workbook is required");

  const resolvedCalculated = calculated || calculatedWorkbookResult;
  if (!resolvedCalculated || typeof resolvedCalculated !== "object") {
    throw new Error("calculated workbook result is required");
  }

  const snapshotPayload = commercialSnapshotPayload({
    workspaceId: resolvedWorkspaceId,
    projectId: commercial_project_id || commercialProjectId || null,
    project: project || projectMetadata || job || jobMetadata || {},
    workbook,
    calculated: resolvedCalculated,
  });

  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("You must be signed in to sync the commercial snapshot.");

  const response = await fetch("/api/builders/sync-commercial-snapshot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-workspace-id": resolvedWorkspaceId,
    },
    body: JSON.stringify({ ...snapshotPayload.body, workbook_snapshot_complete: snapshotPayload.completeWorkbookSnapshot }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || "Could not sync commercial snapshot.");
  }

  return payload;
}

export default syncCommercialSnapshot;
