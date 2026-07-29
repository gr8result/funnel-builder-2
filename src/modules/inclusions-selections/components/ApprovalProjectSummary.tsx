import type { ApprovalStage } from "../services/approvalStageService";

export function ApprovalProjectSummary({ stage }: { stage: ApprovalStage }) {
  const latestSnapshot = [...stage.snapshots].sort((a, b) => b.version - a.version)[0];
  const latestApproval = [...stage.approvals].sort((a, b) => b.approvedAt.localeCompare(a.approvedAt))[0];
  const items = [
    ["Project", stage.context.projectName ?? stage.context.projectId],
    ["Project ID", stage.context.projectId],
    ["Client", stage.context.clientName ?? "Not recorded"],
    ["Site", stage.context.siteAddress ?? "Not recorded"],
    ["Tier", stage.review.summary.projectTierId ?? "Not set"],
    ["Review", stage.review.status],
    ["Fingerprint", stage.currentFingerprint],
    ["Draft Revision", stage.currentDraftRevision],
    ["Client Approval", stage.approvals.find((item) => item.party === "client")?.status ?? "not_started"],
    ["Builder Approval", stage.approvals.find((item) => item.party === "builder")?.status ?? "not_started"],
    ["Snapshot", latestSnapshot?.status ?? "not_started"],
    ["Latest Version", latestSnapshot ? `Version ${latestSnapshot.version}` : "None"],
    ["Latest Approval", latestApproval?.approvedAt ?? "None"],
    ["Latest Snapshot", latestSnapshot?.lockedAt ?? "None"],
    ["Warnings", stage.staleWarnings.length],
    ["Blocking Issues", stage.review.issues.filter((item) => item.blocking).length],
  ];
  return <section className="approvalSummary">{items.map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}</section>;
}
