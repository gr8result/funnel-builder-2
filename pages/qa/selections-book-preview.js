// TEMPORARY QA page: renders the real Selections Book page component (local job, so its own draft
// save/reload path runs) so the tiling workflow can be exercised without signing in. Delete after verification.
import { useMemo } from "react";
import BuilderSelectionsBookPage from "../modules/builders/selections-book";
import { createEstimateBuilderWorkbookDefaults } from "../../lib/construction-estimation/estimateBuilderWorkbookDefaults";
export default function SelectionsBookPreview() {
  const workbook = useMemo(() => createEstimateBuilderWorkbookDefaults(), []);
  return <BuilderSelectionsBookPage embedded workspaceId="qa-workspace" projectId="qa-preview" workbook={workbook} />;
}
