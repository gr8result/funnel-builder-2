// Admission only means objects were inserted. It does not certify a finished takeoff.
export function localVectorReadiness({ analysis = {}, vector = {}, detected = {}, rooms = [], admission = {} }) {
  const issues = [];
  const add = (code, count, message) => {
    if (count > 0) issues.push({ code, count, audience: 'builder', message });
  };
  const unclassified = Number(vector.report?.unclassifiedWalls) || 0;
  const unclassifiedBridges = Number(vector.report?.unclassifiedBridges) || 0;
  add('vector-unclassified-bridges', unclassifiedBridges, 'Confirmed opening spans still require host-wall classification.');
  add('vector-unmatched-opening-annotations', Number(vector.report?.unmatchedOpeningAnnotations) || 0, 'AI opening annotations could not be matched to measured geometry; resolve their positions before accepting quantities.');
  add('vector-opening-types', Number(vector.report?.openingsNeedingClassification) || 0, 'Located frames require a confirmed window or door type before they can be included in quantities.');
  add('vector-unmatched-opening-annotations', Number(vector.report?.unmatchedOpeningAnnotations) || 0, 'AI opening annotations could not be matched to measured geometry; resolve their positions before accepting quantities.');
  add('vector-opening-types', Number(vector.report?.openingsNeedingClassification) || 0, 'Located frames require a confirmed window or door type before they can be included in quantities.');
  const unhosted = Number(vector.report?.openingsWithoutWall) || 0;
  const uncertainHostOpenings = Number(vector.report?.openingsOnUnclassifiedWalls) || 0;
  const unknown = (detected.openings || []).filter(o => !o.bridgeOnly && o.confirmed === false).length;
  const roomReview = rooms.filter(r => r.reviewRequired || !r.confirmed).length;
  add('vector-unclassified-walls', unclassified, `${unclassified} measured wall segments remain visible as review-only candidates; classify them before including them in quantities.`);
  add('vector-unclassified-bridges', unclassifiedBridges, `${unclassifiedBridges} confirmed-opening bridge spans have no established wall class and remain excluded from wall quantities.`);
  add('vector-unhosted-openings', unhosted, `${unhosted} detected openings could not be attached to their measured host walls.`);
  add('vector-openings-on-review-walls', uncertainHostOpenings, `${uncertainHostOpenings} measured openings remain review-only because their host wall classification is unresolved.`);
  add('vector-unknown-openings', unknown, `${unknown} wall gaps have no confirmed door or window evidence.`);
  add('vector-room-review', roomReview, `${roomReview} room boundaries or labels require confirmation.`);
  if (!rooms.length) add('vector-no-rooms', 1, 'No closed room boundaries were accepted. Check missing walls and junctions.');
  const needsReview = admission.status === 'review' || issues.length > 0 || (analysis.review || []).length > 0 || (analysis.unresolved || []).length > 0;
  return { needsReview, issues };
}
