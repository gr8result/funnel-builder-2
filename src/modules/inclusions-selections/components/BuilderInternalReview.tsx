import type { BuilderInternalProjection } from "../services/selectionReviewService";

const currency = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function BuilderInternalReview({ projection }: { projection: BuilderInternalProjection }) {
  return (
    <section className="reviewCard internalProjection">
      <header><h2>{projection.label}</h2><span>Separated from client projection</span></header>
      <div className="reviewRows">{projection.lines.map((line) => <div key={`${line.areaName}:${line.requirementName}`} className="reviewRow"><strong>{line.areaName} - {line.requirementName}</strong><span>{line.selectedItem}</span><span>{line.supplierName ?? "Supplier missing"}</span><span>{line.supplierSku ?? "SKU missing"}</span><span>Builder {currency.format(line.builderCost.amount)}</span><span>Client {currency.format(line.clientPrice.amount)}</span><span>Markup {currency.format(line.markup.amount)}</span></div>)}</div>
    </section>
  );
}
