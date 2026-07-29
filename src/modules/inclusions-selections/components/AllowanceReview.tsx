import type { ReviewLine } from "../services/selectionReviewService";

const currency = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function AllowanceReview({ lines, onOverride }: { lines: ReviewLine[]; onOverride: (requirementId: string) => void }) {
  return (
    <section className="reviewCard">
      <header><h2>Allowance Review</h2><span>Overrides require a reason and audit event</span></header>
      <div className="reviewRows">{lines.map((line) => <div key={line.requirement.id} className="reviewRow"><strong>{line.area.name} - {line.requirement.title}</strong><span>{line.requirement.category}</span><span>{line.inheritanceSource}</span><span>Allowance {currency.format(line.allowance.amount)}</span><span>Selected {currency.format(line.selectedValue.amount)}</span><span>Variance {currency.format(line.variation.amount)}</span><button type="button" onClick={() => onOverride(line.requirement.id)}>Override Allowance</button></div>)}</div>
    </section>
  );
}
