import type { EstimateMappingSummary as MappingSummary } from "../repositories/documentsExportRepository";

export function EstimateMappingSummary({ summary }: { summary: MappingSummary }) {
  const items = [["Total", summary.totalSnapshotLines], ["Ready", summary.readyLines], ["Unmapped", summary.unmappedLines], ["Excluded", summary.excludedLines], ["Already Exported", summary.alreadyExportedLines], ["Failed", summary.failedLines]];
  return <section className="documentsCard"><h2>Estimate Mapping Summary</h2><div className="metricGrid">{items.map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}</div></section>;
}
