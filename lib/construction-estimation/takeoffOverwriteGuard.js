import { getTakeoffCounts } from '../../components/construction-estimation/ai-plan-takeoff/jobPersistence.js';

// A takeoff is hours of tracing that exists nowhere else. Saving is allowed to change
// it, but never to empty it: an incoming job that has lost every plan page, or every
// traced item, is refused before the workbook is touched or anything is persisted.

export function takeoffCountTotals(job) {
  const counts = getTakeoffCounts(job && typeof job === 'object' ? job : {});
  return {
    ...counts,
    overlays: counts.floorCoverings + counts.floorplans + counts.walls
      + counts.openings + counts.eaves + counts.measurements,
  };
}

// The workbook keeps the takeoff in two places; read whichever still holds the most so
// the guard can never under-read what is about to be replaced.
export function bestTakeoffCounts(workbook = {}) {
  const candidates = [workbook?.aiPlanTakeoffJob, workbook?.takeoffEngine?.aiPlanTakeoffJob]
    .filter((job) => job && typeof job === 'object')
    .map(takeoffCountTotals);
  if (!candidates.length) return takeoffCountTotals({});
  return candidates.reduce((best, next) => ({
    ...next,
    renderablePlanPages: Math.max(best.renderablePlanPages, next.renderablePlanPages),
    overlays: Math.max(best.overlays, next.overlays),
  }));
}

export function evaluateTakeoffOverwrite(previousWorkbook = {}, incomingJob = {}) {
  const previousCounts = bestTakeoffCounts(previousWorkbook);
  const incomingCounts = takeoffCountTotals(incomingJob);
  const losesPlan = previousCounts.renderablePlanPages > 0 && incomingCounts.renderablePlanPages === 0;
  const losesOverlays = previousCounts.overlays > 0 && incomingCounts.overlays === 0;

  if (!losesPlan && !losesOverlays) return { refuse: false, previousCounts, incomingCounts };

  return {
    refuse: true,
    reason: losesPlan ? 'plan-pages-lost' : 'overlays-lost',
    message: losesPlan
      ? `Save refused: the incoming takeoff has no plan pages but the open takeoff has ${previousCounts.renderablePlanPages}. Nothing was changed.`
      : `Save refused: the incoming takeoff has no traced items but the open takeoff has ${previousCounts.overlays}. Nothing was changed.`,
    previousCounts,
    incomingCounts,
  };
}
