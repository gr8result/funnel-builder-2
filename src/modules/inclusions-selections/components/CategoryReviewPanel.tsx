import type { CategoryReviewGroup } from "../services/selectionReviewService";

const currency = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function CategoryReviewPanel({ categories, onEdit }: { categories: CategoryReviewGroup[]; onEdit: (areaId: string, requirementId?: string) => void }) {
  return (
    <section className="reviewPanel">
      {categories.map((category) => <article key={category.category} className="reviewCard">
        <header><h2>{category.label}</h2><span>{category.completeRequirements}/{category.totalRequirements} complete</span></header>
        <div className="reviewMetrics"><span>Allowance {currency.format(category.allowanceTotal.amount)}</span><span>Selected {currency.format(category.selectedValueTotal.amount)}</span><span>Upgrades {currency.format(category.upgrades.amount)}</span><span>Credits {currency.format(category.credits.amount)}</span><span>Net {currency.format(category.netVariation.amount)}</span><span>{category.issueCount} issues</span></div>
        <div className="reviewRows">{category.lines.map((line) => <button key={line.requirement.id} type="button" className="reviewRow" onClick={() => onEdit(line.area.id, line.requirement.id)}><strong>{line.area.name} - {line.requirement.title}</strong><span>{line.selectedItem}</span><span>{line.quantity} {line.unit}</span><span>{currency.format(line.selectedValue.amount)}</span><span>{currency.format(line.variation.amount)}</span></button>)}</div>
      </article>)}
    </section>
  );
}
