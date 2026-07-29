import type { ApprovalStage } from "../services/approvalStageService";

const currency = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function SnapshotVersionHistory({ stage }: { stage: ApprovalStage }) {
  return <section className="approvalCard"><h2>Snapshot Version History</h2><div className="approvalRows">{stage.snapshots.map((snapshot) => <div key={snapshot.id} className="approvalRow"><strong>Version {snapshot.version}</strong><span>{snapshot.status}</span><span>{snapshot.lockedAt}</span><span>{snapshot.sourceFingerprint}</span><span>{currency.format(snapshot.netVariationIncludingGst.amount)}</span></div>)}</div></section>;
}
