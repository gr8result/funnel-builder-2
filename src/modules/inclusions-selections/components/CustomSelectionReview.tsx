import type { ReviewLine } from "../services/selectionReviewService";

const currency = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export function CustomSelectionReview({ lines, onEdit }: { lines: ReviewLine[]; onEdit: (areaId: string, requirementId: string) => void }) {
  return (
    <section className="reviewCard">
      <header><h2>Custom Selections</h2><span>Save to Product Library is deferred</span></header>
      <div className="reviewRows">{lines.filter((line) => line.selection?.value.customSelectionId).map((line) => <button key={line.requirement.id} type="button" className="reviewRow" onClick={() => onEdit(line.area.id, line.requirement.id)}><strong>{line.area.name} - {line.selection?.value.customSelectionName}</strong><span>{line.requirement.category}</span><span>{line.selection?.value.description ?? "Description missing"}</span><span>{line.selection?.value.supplierId ?? "Supplier missing"}</span><span>{line.quantity} {line.unit}</span><span>{currency.format(line.variation.amount)}</span><span>Save to Product Library</span></button>)}</div>
    </section>
  );
}
