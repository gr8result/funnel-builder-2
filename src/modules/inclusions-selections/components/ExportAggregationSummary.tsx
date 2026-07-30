import type { EstimateExportAggregationResult } from "../repositories/documentsExportRepository";

export function ExportAggregationSummary({ aggregation }: { aggregation: EstimateExportAggregationResult }) {
  return <section className="documentsCard"><h2>Export Aggregation Summary</h2><div className="metricGrid"><div><span>Aggregated Lines</span><strong>{aggregation.aggregatedLines.length}</strong></div><div><span>Unaggregated Lines</span><strong>{aggregation.unaggregatedLines.length}</strong></div><div><span>Conflicts</span><strong>{aggregation.conflicts.length}</strong></div></div></section>;
}
