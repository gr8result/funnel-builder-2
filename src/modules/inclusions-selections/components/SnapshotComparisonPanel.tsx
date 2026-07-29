import type { SnapshotComparisonChange } from "../repositories/approvalStageRepository";

const currency = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function SnapshotComparisonPanel({ changes }: { changes: SnapshotComparisonChange[] }) {
  return <section className="approvalCard"><h2>Snapshot Comparison</h2><div className="approvalRows">{changes.map((change) => <div key={change.id} className="approvalRow"><strong>{change.changeType.replace(/_/g, " ")}</strong><span>{change.areaName}</span><span>{change.requirementName}</span><span>{change.previousValue ?? "None"}</span><span>{change.newValue ?? "None"}</span><span>{currency.format(change.financialDifference.amount)}</span></div>)}</div></section>;
}
