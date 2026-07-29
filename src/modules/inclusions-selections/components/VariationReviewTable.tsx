import type { VariationSummary } from "../services/selectionReviewService";

const currency = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function VariationReviewTable({ summary }: { summary: VariationSummary }) {
  const lines = [...summary.upgrades, ...summary.credits, ...summary.missingPrices, ...summary.provisionalPrices, ...summary.excluded];
  return (
    <section className="reviewCard">
      <header><h2>Variation Summary</h2><span>Draft values only</span></header>
      <div className="reviewMetrics"><span>Allowance {currency.format(summary.totalAllowance.amount)}</span><span>Selected {currency.format(summary.totalSelectedValue.amount)}</span><span>Upgrades {currency.format(summary.totalUpgrades.amount)}</span><span>Credits {currency.format(summary.totalCredits.amount)}</span><span>Net ex GST {currency.format(summary.netExcludingGst.amount)}</span><span>GST {currency.format(summary.gst.amount)}</span><span>Net inc GST {currency.format(summary.netIncludingGst.amount)}</span></div>
      <div className="reviewRows">{lines.map((line) => <div key={line.requirement.id} className="reviewRow"><strong>{line.area.name} - {line.requirement.title}</strong><span>{line.selectedItem}</span><span>{line.quantity} {line.unit}</span><span>{currency.format(line.allowance.amount)}</span><span>{currency.format(line.selectedValue.amount)}</span><span>{currency.format(line.variation.amount)}</span><span>{line.pricingStatus.replace(/_/g, " ")}</span></div>)}</div>
    </section>
  );
}
