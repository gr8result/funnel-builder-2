import type { EstimateExportBatch } from "../repositories/documentsExportRepository";

const currency = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function ExportHistoryPanel({ batches }: { batches: EstimateExportBatch[] }) {
  return <section className="documentsCard"><h2>Export History</h2><div className="documentsRows">{batches.map((batch) => <div key={batch.id} className="documentsRow"><strong>{batch.status}</strong><span>{batch.id}</span><span>Snapshot v{batch.snapshotVersion}</span><span>{batch.createdAt}</span><span>{batch.completedAt ?? "Not completed"}</span><span>{batch.completedLines}/{batch.totalLines}</span><span>{batch.failedLines} failed</span><span>{currency.format(batch.totalClientValue.amount)}</span><span>{batch.failureSummary ?? ""}</span></div>)}</div></section>;
}
