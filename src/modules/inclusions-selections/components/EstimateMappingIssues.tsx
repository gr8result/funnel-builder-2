import type { EstimateMappingValidationLine } from "../repositories/documentsExportRepository";

export function EstimateMappingIssues({ issues }: { issues: EstimateMappingValidationLine[] }) {
  return <section className="documentsCard"><h2>Estimate Mapping Issues</h2><div className="documentsRows">{issues.map((item) => <div key={item.sourceSnapshotLineId} className={`documentsRow ${item.blocking ? "blocked" : "ok"}`}><strong>{item.status.replace(/_/g, " ")}</strong><span>{item.sourceSnapshotLineId}</span><span>{item.issues.join("; ") || "No blocking issue"}</span></div>)}</div></section>;
}
