// The builder-facing review of a takeoff. Decisions are derived from the takeoff as it stands NOW
// (so fixing a wall on the canvas clears its item) plus the few analysis findings only a person can
// settle. Everything else the AI reported is kept, unedited, as advanced diagnostics.

const LEVELS = ['Ground Floor', 'Second Level', 'Third Level'];
const LEVEL_PREFIX = { 'Ground Floor': 'lower', 'Second Level': 'upper', 'Third Level': 'third' };
// Analysis findings that need a person. Anything not listed is a diagnostic.
const DECISION_CODES = new Set(['possible-missing-openings', 'possible-missing-walls', 'open-edge', 'sheet-failed', 'inspection-failed', 'duplicate-level', 'unassigned-level', 'benchmark-discrepancy', 'dimension-conflict', 'evidence-conflict', 'scale-conflict', 'unreadable']);
const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const metres = (items) => items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0).toFixed(1);
const cellValue = (row) => (row && typeof row === 'object' ? row.value : row);

export function reviewAudience(entry) {
  if (!entry || typeof entry === 'string') return 'diagnostic';
  if (entry.audience === 'decision' || entry.audience === 'diagnostic') return entry.audience;
  return DECISION_CODES.has(entry.code) ? 'decision' : 'diagnostic';
}

export function reviewText(entry) {
  if (typeof entry === 'string') return entry;
  const message = entry?.message || entry?.reason || entry?.evidence || '';
  return entry?.page ? `Sheet ${entry.page}: ${message}` : message;
}

const ANALYSIS_TITLES = {
  'open-edge': 'Open sides of outdoor areas were not counted as walls',
  'possible-missing-openings': 'Possible openings not in your takeoff',
  'possible-missing-walls': 'The plan may have more wall than is traced',
  'sheet-failed': 'A sheet could not be analysed', 'inspection-failed': 'A sheet could not be read',
  'duplicate-level': 'Two sheets show the same level', 'unassigned-level': 'A floor plan has no level',
  'benchmark-discrepancy': 'Measured quantity differs from the figure printed on the plan',
  'dimension-conflict': 'The plan gives two different sizes for an opening', 'evidence-conflict': 'The sheets disagree',
  'scale-conflict': 'The sheets are drawn at different scales', unreadable: 'Part of the plan could not be read',
};

/**
 * @param records  measurement records with their resolved building level (schedule/payload records)
 * @param analysis the saved AI analysis report, if any
 * @param jobSetupRows Job Setup rows, for the ceiling-height and eave-width defaults
 * @returns {{ checklist, decisions, diagnostics }}
 */
export function buildTakeoffReview({ records = [], analysis = null, jobSetupRows = {} } = {}) {
  const usable = records.filter((item) => item.quantity !== null && item.quantity !== undefined);
  const walls = usable.filter((item) => item.kind === 'wall');
  const openings = usable.filter((item) => item.kind === 'opening');
  const count = (items) => items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const ofClass = (name) => openings.filter((item) => item.openingClass === name);
  const described = (item) => `${item.subType || ''} ${item.doorType || ''}`.toLowerCase();
  const internalDoors = ofClass('Internal Door');
  const sliding = internalDoors.filter((item) => /cavity|robe|wardrobe|barn|sliding/.test(described(item)));
  const windows = ofClass('Window');
  const fixed = windows.filter((item) => /^fg$|fixed/.test(String(item.subType || '').toLowerCase()));
  const floorAreas = usable.filter((item) => item.kind === 'floorArea');
  const exterior = walls.filter((item) => item.category === 'exterior');
  const interior = walls.filter((item) => item.category === 'interior');
  const resolved = analysis?.resolvedDecisions || {};

  const checklist = [];
  const tick = (items, label) => { if (items.length) checklist.push({ ok: true, label }); };
  tick(windows, `${plural(count(windows), 'window')} identified${fixed.length ? ` (${count(fixed)} fixed glazing)` : ''}`);
  tick(internalDoors, `${plural(count(internalDoors), 'internal door')} identified${sliding.length ? ` (${count(sliding)} cavity/sliding)` : ''}`);
  tick(ofClass('External Door'), `${plural(count(ofClass('External Door')), 'external door')} identified`);
  tick(ofClass('Large Glazed/Stacker/Sliding Door'), `${plural(count(ofClass('Large Glazed/Stacker/Sliding Door')), 'glazed sliding/stacker door')} identified`);
  tick(ofClass('Garage Door'), `${plural(count(ofClass('Garage Door')), 'garage door')} identified`);
  if (floorAreas.length || analysis?.documentedAreas?.length) checklist.push({ ok: true, label: 'Floor areas calculated' });
  tick(exterior, `External walls measured — ${metres(exterior)} lm`);
  tick(interior, `Internal walls measured — ${metres(interior)} lm`);

  const decisions = [];
  const add = (decision) => { if (!resolved[decision.id]) decisions.push(decision); };
  const ids = (items) => items.map((item) => String(item.id));

  const unassigned = usable.filter((item) => (!item.level || item.level === 'Unassigned') && ['floorArea', 'wall', 'roofArea', 'eave', 'pillar'].includes(item.kind));
  if (unassigned.length) {
    const pages = [...new Set(unassigned.map((item) => item.page))].sort((a, b) => a - b);
    add({ id: 'sheet-level', topic: 'sheet-level', title: `Which level is plan sheet ${pages.join(', ')}?`, detail: `${plural(unassigned.length, 'measurement')} on ${pages.length === 1 ? 'this sheet' : 'these sheets'} cannot be imported until the sheet is given a building level.`, pages, action: { type: 'assign-level', pages } });
  }
  for (const level of LEVELS) {
    const unclassified = exterior.filter((item) => item.level === level && item.classificationStatus === 'unclassified');
    if (unclassified.length) add({
      id: `external-wall-type:${level}`, topic: 'external-wall-type', level, pages: [...new Set(unclassified.map((item) => item.page))],
      title: `${level}: what are the external walls built from?`,
      detail: `${plural(unclassified.length, 'external wall')} (${metres(unclassified)} lm) — the wall type is not stated on the plans or in Job Setup.`,
      action: { type: 'choose', field: 'constructionSystem', targets: ids(unclassified), options: [
        { value: 'brick_veneer:rendered_brick', label: 'Rendered brick veneer' }, { value: 'brick_veneer:face_brick', label: 'Face brick veneer' },
        { value: 'lightweight_cladding', label: 'Lightweight cladding' }, { value: 'core_filled_blockwork', label: 'Core-filled blockwork' }, { value: 'double_brick', label: 'Double brick' }] },
    });
    const knownHeight = Number(String(cellValue(jobSetupRows?.[`${LEVEL_PREFIX[level]}CeilingHeight`]) ?? '').replace(/[^0-9.]/g, '')) > 0;
    const noHeight = walls.filter((item) => item.level === level && !(Number(item.wallHeightM) > 0));
    if (noHeight.length && !knownHeight) add({
      id: `ceiling-height:${level}`, topic: 'wall-height', level, pages: [...new Set(noHeight.map((item) => item.page))],
      title: `${level}: what is the ceiling height?`,
      detail: `No ceiling height was found on the plans or in Job Setup for ${plural(noHeight.length, 'wall')}. Wall and plasterboard areas need it.`,
      action: { type: 'number', field: 'wallHeightMm', unit: 'mm', suggested: 2400, targets: ids(noHeight) },
    });
  }
  const unclassifiedInternal = interior.filter((item) => item.classificationStatus === 'unclassified');
  if (unclassifiedInternal.length) add({
    id: 'internal-wall-type', topic: 'internal-wall-type', pages: [...new Set(unclassifiedInternal.map((item) => item.page))],
    title: 'Are the internal walls timber framed?',
    detail: `${plural(unclassifiedInternal.length, 'internal wall')} (${metres(unclassifiedInternal)} lm) — the framing is not stated on the plans or in Job Setup. Walls you have already set to 70 mm or 90 mm keep their size.`,
    action: { type: 'choose', field: 'internalFrame', targets: ids(unclassifiedInternal), options: [{ value: '70', label: 'Yes — 70 mm frame' }, { value: '90', label: 'Yes — 90 mm frame' }] },
  });
  for (const [category, items, field] of [['internal', interior, 'internalFrame'], ['external', exterior, 'externalFrame']]) {
    const assumedFrame = items.filter((item) => item.frameAssumed === true);
    if (assumedFrame.length) add({
      id: `${category}-frame-size`, topic: `${category}-frame-size`, pages: [...new Set(assumedFrame.map((item) => item.page))],
      title: `Confirm the ${category} wall frame size`,
      detail: `${plural(assumedFrame.length, `${category} wall`)} (${metres(assumedFrame)} lm) — no frame size is shown on the plans or in Job Setup, so 70 mm was used. Confirm 70 mm, or change them to 90 mm.`,
      action: { type: 'choose', field, targets: ids(assumedFrame), options: [{ value: '70', label: 'Confirm 70 mm' }, { value: '90', label: 'They are 90 mm' }] },
    });
  }
  const doorsNoHeight = openings.filter((item) => /Door/.test(item.openingClass) && Number(item.widthMm) > 0 && !(Number(item.heightMm) > 0));
  if (doorsNoHeight.length) add({
    id: 'door-height', topic: 'opening-size', pages: [...new Set(doorsNoHeight.map((item) => item.page))],
    title: `What height are these ${plural(doorsNoHeight.length, 'door')}?`,
    detail: 'The plans give their width but not their height.',
    action: { type: 'number', field: 'heightMm', unit: 'mm', suggested: 2040, targets: ids(doorsNoHeight) },
  });
  const noSize = openings.filter((item) => !(Number(item.widthMm) > 0) && item.openingClass !== 'Other Opening');
  if (noSize.length) add({
    id: 'opening-size', topic: 'opening-size', pages: [...new Set(noSize.map((item) => item.page))],
    title: `${plural(noSize.length, 'opening')} with no readable size`,
    detail: `Counted, but the size could not be read from the plans or a schedule: ${noSize.slice(0, 8).map((item) => `${item.roomLabel || item.location || item.itemTag || item.openingClass} (sheet ${item.page})`).join(', ')}${noSize.length > 8 ? '…' : ''}. Enter the sizes on the plan.`,
    action: { type: 'open-takeoff', targets: ids(noSize) },
  });
  const unlinked = openings.filter((item) => !item.linkedWallId);
  if (unlinked.length) add({
    id: 'opening-wall', topic: 'opening-host', pages: [...new Set(unlinked.map((item) => item.page))],
    title: `${plural(unlinked.length, 'opening')} not attached to a wall`,
    detail: 'Counted, but the wall each one sits in could not be matched, so its wall deductions are not included. Attach them on the plan.',
    action: { type: 'open-takeoff', targets: ids(unlinked) },
  });
  const otherOpenings = ofClass('Other Opening');
  if (otherOpenings.length) add({
    id: 'opening-class', topic: 'opening-class', pages: [...new Set(otherOpenings.map((item) => item.page))],
    title: `${plural(otherOpenings.length, 'opening')} could be a window or a door`, detail: 'Set each one as a window or a door on the plan.', action: { type: 'open-takeoff', targets: ids(otherOpenings) },
  });
  const eaves = usable.filter((item) => item.kind === 'eave');
  const eaveDefault = Number(cellValue(jobSetupRows?.eavesWidthM)) > 0;
  if (eaves.some((item) => !(Number(item.widthMm) > 0)) && !eaveDefault) add({
    id: 'eave-width', topic: 'eave-width', pages: [...new Set(eaves.map((item) => item.page))],
    title: 'What is the eave width?', detail: 'Eave lengths are measured, but no width is shown on the plans or in Job Setup.',
    action: { type: 'number', field: 'eaveWidthMm', unit: 'mm', suggested: 600, targets: ids(eaves.filter((item) => !(Number(item.widthMm) > 0))) },
  });
  const pillars = usable.filter((item) => item.kind === 'pillar' && item.classificationStatus === 'unclassified');
  if (pillars.length) add({
    id: 'post-type', topic: 'post-type', pages: [...new Set(pillars.map((item) => item.page))],
    title: `${plural(pillars.length, 'post/column')} — brick, timber or steel?`, detail: 'The plans do not say what these posts or columns are made from.',
    action: { type: 'choose', field: 'coreType', targets: ids(pillars), options: [{ value: 'brick', label: 'Brick' }, { value: 'timber', label: 'Timber' }, { value: 'steel', label: 'Steel' }] },
  });
  const uncalibrated = records.filter((item) => item.quantity === null);
  if (uncalibrated.length) add({ id: 'calibration', topic: 'calibration', title: `${plural(uncalibrated.length, 'measurement')} need a calibrated scale`, detail: 'Calibrate the plan sheet these were drawn on.', action: { type: 'open-takeoff', targets: ids(uncalibrated) } });

  const diagnostics = [];
  const grouped = new Map();
  for (const entry of analysis?.review || []) {
    if (reviewAudience(entry) !== 'decision') { diagnostics.push(reviewText(entry)); continue; }
    const key = entry.code || 'review';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(entry);
  }
  for (const [code, entries] of grouped) {
    add({
      id: `analysis:${code}`, topic: code, pages: [...new Set(entries.map((item) => item.page).filter(Boolean))],
      title: entries.length > 1 ? `${ANALYSIS_TITLES[code] || 'Check the plan'} (${entries.length})` : (ANALYSIS_TITLES[code] || 'Check the plan'),
      detail: [...new Set(entries.map(reviewText))].join(' '),
      action: { type: code === 'sheet-failed' || code === 'inspection-failed' ? 'rerun' : 'acknowledge' },
    });
  }
  return { checklist, decisions, diagnostics: [...new Set(diagnostics)] };
}

/**
 * Apply the builder's answer to the objects a decision names. Returns the collections that changed;
 * nothing else is touched. An 'acknowledge' decision changes no geometry.
 */
export function applyReviewDecision(decision, value, collections = {}) {
  const targets = new Set(decision?.action?.targets || []);
  const field = decision?.action?.field;
  const patch = (key, change) => {
    const items = collections[key] || [];
    if (!items.some((item) => targets.has(String(item.id)))) return {};
    return { [key]: items.map((item) => (targets.has(String(item.id)) ? { ...item, ...change(item) } : item)) };
  };
  const number = Number(value);
  if (field === 'constructionSystem') {
    const [system, finish] = String(value).split(':');
    const legacy = system === 'brick_veneer' ? (finish === 'rendered_brick' ? 'Rendered Brick Veneer' : 'Face Brick Veneer')
      : system === 'lightweight_cladding' ? 'Lightweight Cladding' : system === 'core_filled_blockwork' ? 'Rendered Masonry' : 'Other';
    const framed = ['brick_veneer', 'lightweight_cladding'].includes(system);
    return patch('completedWallRuns', (wall) => ({
      constructionSystem: system, exteriorType: legacy,
      exteriorFinish: finish || (system === 'lightweight_cladding' ? 'Unspecified' : system === 'core_filled_blockwork' ? 'rendered' : undefined),
      frameThicknessMm: framed ? (wall.frameThicknessMm === 90 ? 90 : 70) : null,
    }));
  }
  if (field === 'internalFrame' && [70, 90].includes(number)) return patch('completedWallRuns', () => ({ constructionSystem: 'internal_timber_frame', thicknessMm: number, frameThicknessMm: number, frameAssumed: false }));
  if (field === 'externalFrame' && [70, 90].includes(number)) return patch('completedWallRuns', (wall) => ({ frameThicknessMm: number, frameAssumed: false, ...(wall.constructionSystem === 'lightweight_cladding' ? { thicknessMm: number } : {}) }));
  if (field === 'wallHeightMm' && number >= 1800 && number <= 6000) return patch('completedWallRuns', () => ({ wallHeightM: number / 1000 }));
  if (field === 'heightMm' && number >= 300 && number <= 6000) return patch('placedOpenings', () => ({ heightMm: number }));
  if (field === 'eaveWidthMm' && number >= 100 && number <= 3000) return patch('completedEaves', () => ({ widthMm: number, widthOption: [450, 600, 900, 1200].includes(number) ? String(number) : 'Special' }));
  if (field === 'coreType' && ['brick', 'timber', 'steel'].includes(value)) return patch('completedPillars', () => ({ coreType: value }));
  return {};
}
