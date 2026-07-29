import type { ReviewLine } from "../services/selectionReviewService";

export function ProductAvailabilityReview({ lines, onEdit }: { lines: ReviewLine[]; onEdit: (areaId: string, requirementId: string) => void }) {
  return (
    <section className="reviewCard">
      <header><h2>Product Availability</h2><span>Selections are preserved until explicitly changed</span></header>
      <div className="reviewRows">{lines.filter((line) => line.product || line.pricingStatus === "unavailable_product").map((line) => <button key={line.requirement.id} type="button" className="reviewRow" onClick={() => onEdit(line.area.id, line.requirement.id)}><strong>{line.area.name} - {line.selectedItem}</strong><span>{line.product?.active ? "Active" : "Inactive or missing"}</span><span>{line.product?.discontinued ? "Discontinued" : "Current catalogue reference"}</span><span>{line.pricingStatus.replace(/_/g, " ")}</span><span>Review in workspace</span></button>)}</div>
    </section>
  );
}
