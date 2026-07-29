import type { ApprovalStage } from "../services/approvalStageService";

export function StaleApprovalWarning({ stage }: { stage: ApprovalStage }) {
  if (!stage.staleWarnings.length) return null;
  return <section className="issuePanel"><strong>Stale approval warning</strong><ul>{stage.staleWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section>;
}
