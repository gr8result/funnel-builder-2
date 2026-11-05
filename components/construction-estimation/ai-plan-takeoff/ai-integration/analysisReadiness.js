// Geometry admission and finishing a review are separate decisions, for both
// vector PDFs and scanned sheets. A saved correction must refresh this state.
export function refreshAnalysisReadiness(report) {
  if (!report) return report;
  const rooms = (report.rooms || []).filter(room => !room.excluded);
  const pending = rooms.filter(room => room.reviewRequired || !room.confirmed);
  const review = (report.review || []).filter(item => !['vector-room-review', 'room-boundary-review'].includes(item.code));
  if (pending.length) review.push({ code: 'room-boundary-review', audience: 'builder', count: pending.length,
    message: `${pending.length} room boundaries or labels require confirmation.` });
  const needsReview = pending.length > 0 || (report.unresolved || []).length > 0
    || (report.wallReviewCandidates || []).length > 0 || (report.openingReviewCandidates || []).length > 0
    || review.some(item => ['builder', 'decision'].includes(item.audience));
  return { ...report, review,
    ...(needsReview && report.status !== 'rooms' ? { status: 'review', completedAt: null } : {}),
    counts: { ...report.counts, review: review.length, rooms: rooms.length, roomsForReview: pending.length,
      roomBoundaries: rooms.filter(room => room.polygon?.length >= 3).length } };
}
