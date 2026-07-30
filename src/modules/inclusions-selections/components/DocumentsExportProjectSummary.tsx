import type { DocumentsExportStage } from "../services/documentsExportService";

const currency = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function DocumentsExportProjectSummary({ stage }: { stage: DocumentsExportStage }) {
  const snapshot = stage.selectedSnapshot;
  const exportedLineCount = stage.exportLines.filter((line) => line.snapshotId === snapshot?.id && line.status === "completed").length;
  const failedLineCount = stage.exportLines.filter((line) => line.snapshotId === snapshot?.id && line.status === "failed").length;
  const items = [
    ["Project", snapshot?.projectSummary.projectName ?? stage.context.projectName ?? stage.context.projectId],
    ["Project ID", stage.context.projectId],
    ["Client", snapshot?.projectSummary.clientName ?? stage.context.clientName ?? "Not recorded"],
    ["Site", snapshot?.projectSummary.siteAddress ?? stage.context.siteAddress ?? "Not recorded"],
    ["Snapshot Version", snapshot ? `Version ${snapshot.version}` : "None"],
    ["Snapshot Status", snapshot?.status ?? "Missing"],
    ["Locked Date", snapshot?.lockedAt ?? "None"],
    ["Locked By", snapshot?.lockedBy ?? "None"],
    ["Client Approval", snapshot?.clientApprovalId ?? "None"],
    ["Builder Approval", snapshot?.builderApprovalId ?? "None"],
    ["Source Review Revision", snapshot?.sourceReviewRevision ?? "None"],
    ["Approval Fingerprint", snapshot?.sourceFingerprint ?? "None"],
    ["Snapshot Lines", snapshot?.lines.length ?? 0],
    ["Total Allowance", currency.format(snapshot?.totalAllowance.amount ?? 0)],
    ["Total Selected", currency.format(snapshot?.totalSelectedValue.amount ?? 0)],
    ["Total Upgrades", currency.format(snapshot?.totalUpgrades.amount ?? 0)],
    ["Total Credits", currency.format(snapshot?.totalCredits.amount ?? 0)],
    ["Net Ex GST", currency.format(snapshot?.netVariationExcludingGst.amount ?? 0)],
    ["GST", currency.format(snapshot?.gst.amount ?? 0)],
    ["Net Inc GST", currency.format(snapshot?.netVariationIncludingGst.amount ?? 0)],
    ["Currency", snapshot?.currency ?? "AUD"],
    ["Export Status", stage.exportStatus],
    ["Last Export", stage.lastExportDate ?? "None"],
    ["Exported Lines", exportedLineCount],
    ["Failed Lines", failedLineCount],
    ["Unmapped Lines", stage.mappingSummary.unmappedLines],
  ];
  return <section className="documentsSummary">{items.map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}</section>;
}
