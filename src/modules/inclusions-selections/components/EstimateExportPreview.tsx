import type { EstimateExportLine } from "../repositories/documentsExportRepository";

const currency = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function EstimateExportPreview({ lines }: { lines: EstimateExportLine[] }) {
  return <section className="documentsCard"><h2>Estimate Export Preview</h2><div className="documentsRows">{lines.map((line) => <div key={line.id} className="documentsRow"><strong>{line.requirement}</strong><span>{line.areaName}</span><span>{line.productDescription}</span><span>{line.quantity} {line.unit}</span><span>{line.costCode ?? "No cost code"}</span><span>{line.estimateStage ?? "No stage"}</span><span>{line.estimateRowMapping ?? "No row"}</span><span>{currency.format(line.clientPrice.amount)}</span><span>{line.status}</span><span>{line.sourceSnapshotLineIds.join(", ")}</span></div>)}</div></section>;
}
