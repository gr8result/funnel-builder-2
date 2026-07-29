import type { ReviewLine } from "../services/selectionReviewService";

export function NotApplicableReview({ lines, onEdit }: { lines: ReviewLine[]; onEdit: (areaId: string, requirementId: string) => void }) {
  return (
    <section className="reviewCard">
      <header><h2>Not Applicable Review</h2><span>Required items remain blocking without a future authorised override</span></header>
      <div className="reviewRows">{lines.filter((line) => line.selection?.selectionStatus === "not_applicable").map((line) => <button key={line.requirement.id} type="button" className="reviewRow" onClick={() => onEdit(line.area.id, line.requirement.id)}><strong>{line.area.name} - {line.requirement.title}</strong><span>{line.requirement.required ? "Required" : "Optional or Conditional"}</span><span>{line.selection?.notApplicableReason ?? "Reason missing"}</span><span>{line.issues.length} issues</span></button>)}</div>
    </section>
  );
}
