import type { ReviewStatus } from "../repositories/selectionReviewRepository";

export function ReviewStatusBanner({ status, reasons }: { status: ReviewStatus; reasons: string[] }) {
  return (
    <section className={`reviewStatus status-${status}`}>
      <div><span>Review Status</span><strong>{status.replace(/_/g, " ")}</strong></div>
      {reasons.length ? <ul>{reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul> : <p>No blocking review reasons remain.</p>}
    </section>
  );
}
