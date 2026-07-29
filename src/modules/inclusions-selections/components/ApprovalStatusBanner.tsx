import type { ApprovalStage } from "../services/approvalStageService";

export function ApprovalStatusBanner({ stage }: { stage: ApprovalStage }) {
  return <section className={`approvalStatus status-${stage.status}`}><div><span>Approval Status</span><strong>{stage.status.replace(/_/g, " ")}</strong></div>{stage.staleWarnings.length ? <ul>{stage.staleWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : <p>Client and builder approvals are tracked separately from locked snapshots.</p>}</section>;
}
