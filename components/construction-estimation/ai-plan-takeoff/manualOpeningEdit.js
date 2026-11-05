const classes = new Map([
  ['Window', ['window', 'Window']], ['Internal Door', ['door', 'Internal']],
  ['External Door', ['door', 'External']], ['Garage Door', ['door', 'Garage']],
  ['Large Glazed/Stacker/Sliding Door', ['door', 'Sliding']], ['Other Opening', ['door', 'Other']],
]);

// An explicit estimator decision changes semantics only, never measured geometry.
export function confirmOpeningClass(opening, openingClass, confirmedAt = new Date().toISOString()) {
  const classification = classes.get(openingClass);
  if (!classification) return opening;
  const [type, defaultSubtype] = classification;
  return { ...opening, openingClass, type, openingType: type,
    subType: opening.openingClass === openingClass && opening.type === type ? opening.subType : defaultSubtype,
    needsClassification: false, typeConfirmedAt: confirmedAt };
}
