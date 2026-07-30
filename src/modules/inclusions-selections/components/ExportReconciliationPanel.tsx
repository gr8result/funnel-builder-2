import type { ExportReconciliation } from "../repositories/documentsExportRepository";

export function ExportReconciliationPanel({ reconciliations }: { reconciliations: ExportReconciliation[] }) {
  return <section className="documentsCard"><h2>Export Reconciliation</h2><div className="documentsRows">{reconciliations.map((item) => <div key={item.id} className={`documentsRow ${item.status === "reconciled" ? "ok" : "blocked"}`}><strong>{item.status === "reconciled" ? "Reconciled" : "Reconciliation Failed"}</strong><span>{item.batchId}</span><span>Client diff {item.clientValueDifference.amount}</span><span>Allowance diff {item.allowanceDifference.amount}</span><span>Variation diff {item.variationDifference.amount}</span><span>Source line diff {item.sourceLineCountDifference}</span><span>{item.failureReason ?? ""}</span></div>)}</div></section>;
}
