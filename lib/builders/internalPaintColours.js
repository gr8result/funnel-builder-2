// Client Selections > Internal Paint Colours. The client chooses COLOURS for the house: one main
// wall colour, one trim / internal door colour and one ceiling colour apply throughout, and single
// rooms or feature walls can differ. A colour is a specification. It never creates a quotation row,
// never changes a painting quantity or rate, and is never a variation by itself.
//
// Stored on the job in the existing place - the "interior-paint" selection's `paintScheme` - so
// jobs saved by the earlier paint screen still open. Schema 2 keeps the same `defaults`,
// `overrides` and `featureWalls` lists; a choice is a colour reference plus the finish.

export const INTERNAL_PAINT_REQUIREMENT_KEY = 'interior-paint';

export const PAINT_COLOUR_SURFACES = Object.freeze([
  { key: 'walls', label: 'Main Wall Colour', scheduleLabel: 'Main Walls', shortLabel: 'Walls', defaultFinish: 'Low Sheen', inclusionPattern: /wall/i },
  { key: 'trims', label: 'Trims & Internal Doors', scheduleLabel: 'Trims & Internal Doors', shortLabel: 'Trims & doors', defaultFinish: 'Semi Gloss', inclusionPattern: /trim|door|skirting|architrave|woodwork/i },
  { key: 'ceilings', label: 'Ceilings', scheduleLabel: 'Ceilings', shortLabel: 'Ceilings', defaultFinish: 'Flat', inclusionPattern: /ceiling/i },
]);
const SURFACE = Object.fromEntries(PAINT_COLOUR_SURFACES.map(surface => [surface.key, surface]));
// Longest first so "Low Sheen" is not read as "Sheen" and "Semi Gloss" not as "Gloss".
const FINISHES = ['Low Gloss Enamel', 'Gloss Enamel', 'Semi Gloss', 'Semi-Gloss', 'Low Gloss', 'Low Sheen', 'Low-Sheen', 'Ceiling Flat', 'Satin', 'Matt', 'Matte', 'Flat', 'Gloss'];

const text = value => String(value ?? '').trim();
const same = (left, right) => text(left).toLowerCase() === text(right).toLowerCase();

// What the builder's Standard Inclusions say about internal painting: the lines themselves (shown
// to the client as "Included"), the paint manufacturer when one is named, and the finish for each
// surface when the inclusions state one. Anything the inclusions do not state uses the builder default.
export function paintInclusionBaseline(inclusions = {}) {
  const packageId = inclusions?.selectedPackageId || '';
  const sections = (inclusions?.sections || []).filter(section => section?.active !== false && (!section.package_id || section.package_id === packageId) && /paint/i.test(section.title || ''));
  const lines = sections.flatMap(section => (section.bullets || []).map(bullet => (typeof bullet === 'string' ? bullet : bullet?.text || bullet?.label || '')).map(text).filter(Boolean));
  const internal = lines.filter(line => !/\b(external|exterior|render|eaves?|fascia|gutter|cladding)\b/i.test(line));
  const finishes = {};
  for (const surface of PAINT_COLOUR_SURFACES) {
    // One line can cover several surfaces ("Walls: low sheen. Ceilings: flat"); read each part alone.
    const line = internal.flatMap(candidate => candidate.split(/[.;]\s+/)).find(candidate => surface.inclusionPattern.test(candidate) && FINISHES.some(finish => candidate.toLowerCase().includes(finish.toLowerCase())));
    const stated = line && FINISHES.find(finish => line.toLowerCase().includes(finish.toLowerCase()));
    finishes[surface.key] = stated ? stated.replace('-', ' ') : surface.defaultFinish;
  }
  return { lines: internal, text: internal.join('\n'), manufacturer: /dulux/i.test(lines.join(' ')) ? 'Dulux' : '', finishes, fromInclusions: internal.length > 0 };
}

// The project's rooms that can be painted. The project location list also carries the Selections
// Book's exterior and trade containers ("External Walls", "Roof", "Electrical", "Paint"); those are
// not rooms and are never offered for a room override or a feature wall.
const NOT_A_ROOM = /^(external|exterior|external walls?|roof|roofing|windows?|doors?|facade|alfresco|patio|balcony|porch|deck|bricks?|cladding|driveway|landscaping|fencing|electrical|lighting|plumbing|paint|painting|flooring|tiles?|tiling|cabinetry|appliances?|general|site|whole house)$/i;
export function paintableRoomNames(names = []) {
  return [...new Set((names || []).map(text).filter(name => name && !NOT_A_ROOM.test(name)))];
}

export function colourChoice(colour, finish) {
  if (!colour?.id) return null;
  return { manufacturer: colour.manufacturer || 'Dulux', colourId: colour.id, colourName: colour.name, colourCode: colour.code || '',
    hex: colour.hex || '', finish: text(finish), sourceUrl: colour.sourceUrl || '',
    // Ready-mixed whites (Dulux Ceiling White) have no published swatch; white is shown on screen.
    ...(colour.displaySwatch ? { displaySwatch: colour.displaySwatch } : {}) };
}

// The colour to paint on screen for a choice: the Dulux swatch value, or the screen-only swatch of
// a ready-mixed white.
export const choiceSwatch = choice => choice?.hex || choice?.displaySwatch || '';

// ---- Standard ceiling ----------------------------------------------------------------------------
// Ceilings are normally painted the builder's standard ceiling white; a client only chooses a
// ceiling colour when they want something different. `standard` is the builder's standard ceiling
// choice ({ colour, finish, source, label }), worked out in lib/builders/paintStandards.js from the
// Standard Inclusions, the builder's paint defaults, or Dulux Ceiling White.
export function standardCeilingChoice(baseline = {}) {
  const standard = baseline?.standards?.ceilings;
  const choice = standard?.colour ? colourChoice(standard.colour, standard.finish || baseline.finishes?.ceilings || SURFACE.ceilings.defaultFinish) : null;
  return choice ? { ...choice, standard: true, standardSource: standard.source || 'default' } : null;
}

export function isStandardCeiling(scheme, baseline = {}) {
  const choice = scheme?.defaults?.ceilings;
  if (!choice) return false;
  return choice.standard === true || choice.colourId === standardCeilingChoice(baseline)?.colourId;
}

export function resetCeilingToStandard(scheme, baseline = {}) {
  const standard = standardCeilingChoice(baseline);
  if (!standard) return scheme;
  const changed = scheme.defaults.ceilings?.colourId !== standard.colourId;
  return { ...scheme, defaults: { ...scheme.defaults, ceilings: standard }, confirmed: changed ? false : scheme.confirmed, confirmedAt: changed ? '' : scheme.confirmedAt };
}

// Reads a choice saved by any version of the paint screen. Earlier jobs stored a paint product with
// the colour; the colour and finish are kept and the product is left where it was saved.
function readChoice(value, finish) {
  if (!value || typeof value !== 'object') return null;
  const snapshot = value.colourSnapshot || {};
  const colourName = text(value.colourName || snapshot.name || value.colour);
  const colourId = text(value.colourId || snapshot.id);
  if (!colourName && !colourId) return null;
  return { manufacturer: text(value.manufacturer || snapshot.manufacturer) || 'Dulux', colourId, colourName, colourCode: text(value.colourCode || snapshot.code),
    hex: text(value.hex || snapshot.hex), finish: text(value.finish) || finish, sourceUrl: text(value.colourSourceUrl || snapshot.sourceUrl || value.sourceUrl),
    ...(text(value.displaySwatch) ? { displaySwatch: text(value.displaySwatch) } : {}),
    ...(value.standard === true ? { standard: true, standardSource: text(value.standardSource) || 'default' } : {}) };
}

export function normaliseInternalPaintScheme(saved, baseline = paintInclusionBaseline()) {
  const source = saved && typeof saved === 'object' ? saved : {};
  const defaults = source.defaults || {};
  const finish = key => baseline.finishes?.[key] || SURFACE[key].defaultFinish;
  const surfaceKey = key => (['doors', 'skirting', 'architraves', 'frames', 'reveals'].includes(key) ? 'trims' : key);
  return {
    schemaVersion: 2,
    defaults: {
      walls: readChoice(defaults.walls, finish('walls')),
      trims: readChoice(defaults.trims || defaults.doors || defaults.skirting, finish('trims')),
      ceilings: readChoice(defaults.ceilings, finish('ceilings')) || standardCeilingChoice(baseline),
    },
    overrides: (source.overrides || []).map(override => ({ location: text(override.location), surface: surfaceKey(override.surface), choice: readChoice(override.choice, finish(surfaceKey(override.surface) in SURFACE ? surfaceKey(override.surface) : 'walls')) }))
      .filter(override => override.location && SURFACE[override.surface] && override.choice)
      .filter((override, index, list) => list.findIndex(other => same(other.location, override.location) && other.surface === override.surface) === index),
    featureWalls: (source.featureWalls || []).map((wall, index) => ({ id: text(wall.id) || `feature-${index + 1}`, location: text(wall.location), wall: text(wall.wall || wall.description),
      notes: text(wall.notes), choice: readChoice(wall.choice, finish('walls')) })).filter(wall => wall.choice),
    confirmed: source.confirmed === true,
    confirmedAt: text(source.confirmedAt),
    updatedAt: text(source.updatedAt),
  };
}

// ---- edits. Each returns a new scheme; none touches anything but what it names. ----------------

export function setHouseColour(scheme, surfaceKey, colour, baseline = paintInclusionBaseline()) {
  if (!SURFACE[surfaceKey]) return scheme;
  const finish = scheme.defaults[surfaceKey]?.finish || baseline.finishes?.[surfaceKey] || SURFACE[surfaceKey].defaultFinish;
  const standard = surfaceKey === 'ceilings' ? standardCeilingChoice(baseline) : null;
  const choice = standard && colour?.id === standard.colourId ? standard : colourChoice(colour, finish);
  if (!choice) return scheme;
  // A different house colour has to be confirmed again; rooms and feature walls are unaffected.
  const changed = scheme.defaults[surfaceKey]?.colourId !== choice.colourId;
  return { ...scheme, defaults: { ...scheme.defaults, [surfaceKey]: choice }, confirmed: changed ? false : scheme.confirmed, confirmedAt: changed ? '' : scheme.confirmedAt };
}

// colour = null puts the room back on the house default for that surface.
export function setRoomOverride(scheme, location, surfaceKey, colour, baseline = paintInclusionBaseline()) {
  const room = text(location);
  if (!room || !SURFACE[surfaceKey]) return scheme;
  const others = scheme.overrides.filter(override => !(same(override.location, room) && override.surface === surfaceKey));
  const choice = colourChoice(colour, scheme.defaults[surfaceKey]?.finish || baseline.finishes?.[surfaceKey] || SURFACE[surfaceKey].defaultFinish);
  return { ...scheme, overrides: choice ? [...others, { location: room, surface: surfaceKey, choice }] : others };
}

export function saveFeatureWall(scheme, { id = '', location = '', wall = '', notes = '', colour } = {}, baseline = paintInclusionBaseline()) {
  const choice = colourChoice(colour, scheme.defaults.walls?.finish || baseline.finishes?.walls || SURFACE.walls.defaultFinish);
  if (!text(location) || !text(wall) || !choice) return scheme;
  const record = { id: text(id) || `feature-${Date.now().toString(36)}-${scheme.featureWalls.length + 1}`, location: text(location), wall: text(wall), notes: text(notes), choice };
  const exists = scheme.featureWalls.some(item => item.id === record.id);
  return { ...scheme, featureWalls: exists ? scheme.featureWalls.map(item => (item.id === record.id ? record : item)) : [...scheme.featureWalls, record] };
}

export function removeFeatureWall(scheme, id) {
  return { ...scheme, featureWalls: scheme.featureWalls.filter(item => item.id !== id) };
}

export function confirmHouseScheme(scheme, at = new Date().toISOString()) {
  return internalPaintSchemeStatus(scheme).ready ? { ...scheme, confirmed: true, confirmedAt: at } : scheme;
}

// ---- reads ------------------------------------------------------------------------------------

// The colours a room actually gets: its own override where it has one, otherwise the house default.
export function resolveRoomColours(scheme, location) {
  return Object.fromEntries(PAINT_COLOUR_SURFACES.map(surface => {
    const override = scheme.overrides.find(item => same(item.location, location) && item.surface === surface.key);
    return [surface.key, { choice: override?.choice || scheme.defaults[surface.key] || null, overridden: Boolean(override) }];
  }));
}

// Complete = the three house colours are chosen and the scheme is confirmed. Feature walls and room
// overrides are optional and never hold the selection open.
export function internalPaintSchemeStatus(scheme) {
  const required = PAINT_COLOUR_SURFACES.map(surface => ({ key: surface.key, label: surface.label, done: Boolean(scheme?.defaults?.[surface.key]?.colourName) }));
  const ready = required.every(item => item.done);
  return { required, ready, complete: ready && scheme?.confirmed === true, chosen: required.filter(item => item.done).length };
}

export function colourLabel(choice, { withFinish = false } = {}) {
  if (!choice?.colourName) return '';
  return [`${choice.manufacturer || 'Dulux'} ${choice.colourName}`, choice.colourCode ? `(${choice.colourCode})` : '', withFinish && choice.finish ? `- ${choice.finish}` : ''].filter(Boolean).join(' ');
}

// One line per thing a painter has to know, in the order a schedule reads.
export function internalPaintScheduleLines(scheme) {
  const lines = PAINT_COLOUR_SURFACES.map(surface => ({ id: `house-${surface.key}`, kind: 'house', surface: surface.key, label: surface.scheduleLabel, location: 'Throughout', choice: scheme.defaults[surface.key] || null }));
  for (const override of scheme.overrides) lines.push({ id: `room-${override.location}-${override.surface}`, kind: 'override', surface: override.surface,
    label: `${override.location} - ${SURFACE[override.surface].shortLabel}`, location: override.location, choice: override.choice });
  for (const wall of scheme.featureWalls) lines.push({ id: `feature-${wall.id}`, kind: 'feature', surface: 'walls', label: `Feature wall - ${[wall.location, wall.wall].filter(Boolean).join(' - ')}`,
    location: wall.location, wall: wall.wall, notes: wall.notes, choice: wall.choice });
  return lines;
}

export function internalPaintSummary(scheme) {
  return internalPaintScheduleLines(scheme).filter(line => line.choice).map(line => `${line.label}: ${colourLabel(line.choice, { withFinish: true })}`).join('; ');
}

// What is written to the job. `doors` and `skirting` repeat the trim colour because earlier readers
// of this record look for those two surfaces.
export function storedInternalPaintScheme(scheme, at = new Date().toISOString()) {
  return { ...scheme, schemaVersion: 2, defaults: { ...scheme.defaults, doors: scheme.defaults.trims || null, skirting: scheme.defaults.trims || null }, updatedAt: at };
}

export function internalPaintSchemeFromBook(book = {}) {
  for (const room of book?.rooms || []) for (const row of room.rows || []) {
    const guided = row.guidedSelection || {};
    if ((row.guidedRequirementKey || guided.requirementKey) === INTERNAL_PAINT_REQUIREMENT_KEY && guided.paintScheme) return normaliseInternalPaintScheme(guided.paintScheme);
  }
  return null;
}

// ---- Quotation Builder ------------------------------------------------------------------------

// Which house colours a painting line of the estimate covers. The estimate's own interior line
// ("GENERAL PAINTING - INTERIOR LOWER") covers walls, trims and ceilings together; a line that names
// one surface covers that surface. External, patio and deck lines are not internal colours.
function quotationSurfaces(row = {}) {
  const label = [row.item, row.description].filter(Boolean).join(' ');
  if (!label.trim() || /\b(external|exterior|render|eaves?|soffits?|fascia|gutter|cladding|weatherboards?|roof|fence|deck|decking|patio|alfresco|garage door)\b/i.test(label)) return [];
  const named = [];
  if (/wall/i.test(label)) named.push('walls');
  if (/skirting|architrave|trim|door|jamb|frame|woodwork|reveal/i.test(label)) named.push('trims');
  if (/ceiling/i.test(label)) named.push('ceilings');
  if (named.length) return named;
  return /\b(interior|internal)\b/i.test(label) ? ['walls', 'trims', 'ceilings'] : [];
}

// Attaches the chosen colours to the painting lines the estimate already has. A matching row gains
// `paintColourSpecification`, and its specification text (`selectionSpec`, the column the Quotation
// Builder already shows) is filled unless someone has typed their own. Nothing else changes: no row
// is added, removed or re-rated, and quantities stay with the estimate. Returns the same workbook
// when nothing changed.
export function linkInternalPaintColoursToQuotation(workbook = {}, book = {}) {
  const scheme = internalPaintSchemeFromBook(book);
  let changed = false;
  const quotation = {};
  for (const [name, section] of Object.entries(workbook.quotation || {})) {
    quotation[name] = section;
    if (!/paint/i.test(name) || !Array.isArray(section?.rows)) continue;
    const rows = section.rows.map(row => {
      const surfaces = scheme ? quotationSurfaces(row).filter(key => scheme.defaults[key]) : [];
      const next = surfaces.length ? {
        confirmed: scheme.confirmed === true,
        surfaces: surfaces.map(key => ({ surface: key, label: SURFACE[key].shortLabel, ...scheme.defaults[key] })),
        text: surfaces.map(key => `${SURFACE[key].shortLabel}: ${colourLabel(scheme.defaults[key], { withFinish: true })}`).join('; '),
        roomOverrides: scheme.overrides.filter(override => surfaces.includes(override.surface)).map(override => ({ location: override.location, surface: override.surface, text: colourLabel(override.choice) })),
        featureWalls: surfaces.includes('walls') ? scheme.featureWalls.map(wall => ({ location: wall.location, wall: wall.wall, text: colourLabel(wall.choice) })) : [],
      } : null;
      const previous = row.paintColourSpecification ?? null;
      if (JSON.stringify(previous) === JSON.stringify(next)) return row;
      changed = true;
      const { paintColourSpecification, ...rest } = row;
      // The text column is only ever written where it is empty or still holds the text written here.
      const ownsText = !text(row.selectionSpec) || (previous && row.selectionSpec === previous.text);
      if (ownsText) { if (next) rest.selectionSpec = next.text; else delete rest.selectionSpec; }
      return next ? { ...rest, paintColourSpecification: next } : rest;
    });
    if (rows.some((row, index) => row !== section.rows[index])) quotation[name] = { ...section, rows };
  }
  return changed ? { ...workbook, quotation } : workbook;
}
