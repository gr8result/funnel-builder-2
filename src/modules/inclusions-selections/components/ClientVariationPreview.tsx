import type { ClientVariationProjection } from "../services/selectionReviewService";

const currency = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function ClientVariationPreview({ projection }: { projection: ClientVariationProjection }) {
  return (
    <section className="reviewCard clientProjection">
      <header><h2>Client Variation Preview</h2><span>{projection.warning}</span></header>
      <p>{projection.projectName}{projection.clientName ? ` - ${projection.clientName}` : ""}{projection.siteAddress ? ` - ${projection.siteAddress}` : ""}</p>
      <div className="reviewRows">{projection.lines.map((line) => <div key={`${line.areaName}:${line.requirementName}`} className="reviewRow"><strong>{line.areaName} - {line.requirementName}</strong><span>{line.selectedItem}</span><span>{line.quantity} {line.unit}</span><span>Allowance {currency.format(line.allowance.amount)}</span><span>Selected {currency.format(line.selectedValue.amount)}</span><span>Variation {currency.format(line.netVariation.amount)}</span></div>)}</div>
      <strong>Overall draft variation {currency.format(projection.totalDraftVariation.amount)}</strong>
    </section>
  );
}
