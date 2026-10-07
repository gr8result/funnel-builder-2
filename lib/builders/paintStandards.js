// The builder's standard internal paint choices - what a house gets when the client does not choose
// otherwise. Today that is the ceiling: ceilings are painted the standard ceiling white on almost
// every job, so the client is never asked to pick it.
//
// Where the standard comes from, first match wins:
//   1. the builder's Standard Inclusions - a ceiling line that names a Dulux colour or Ceiling White;
//   2. the builder's paint defaults - the inclusions package's (or builder's) paint scheme ceiling;
//   3. Dulux Ceiling White (ready-mixed, Flat).
// Kept apart from internalPaintColours.js so that file, which the job save path also loads, does
// not pull in the colour library.
import { DULUX_CEILING_WHITE, colourNamedIn, findColour } from './duluxColourLibrary.js';
import { paintInclusionBaseline } from './internalPaintColours.js';

export const STANDARD_SOURCE_LABELS = Object.freeze({ inclusions: 'Standard Inclusion', builder: 'Builder standard', default: 'Standard' });

function ceilingFromInclusionLines(lines = []) {
  for (const line of lines) {
    if (!/ceiling/i.test(line)) continue;
    // Only the part of the line about ceilings: "Walls: Lexicon Quarter. Ceilings: Ceiling White."
    const part = line.split(/[.;\n]/).find(piece => /ceiling/i.test(piece)) || line;
    // "Ceiling paint system" names no colour; "Ceilings: Dulux Ceiling White" and "Ceilings in Vivid White" do.
    const colour = colourNamedIn(part.replace(/ceilings?\s*(paint|colour|color)?\s*(system)?\s*[:\-]?/i, ' ')) || (/ceiling\s+white/i.test(part) ? DULUX_CEILING_WHITE : null);
    if (colour) return colour;
  }
  return null;
}

function ceilingFromBuilderDefaults(inclusions = {}) {
  const selectedPackage = (inclusions?.packages || []).find(item => item.id === inclusions.selectedPackageId);
  const configured = selectedPackage?.paintScheme?.defaults?.ceilings || inclusions?.paintScheme?.defaults?.ceilings || inclusions?.paintDefaults?.ceilings || null;
  if (!configured) return null;
  return findColour(configured.colourId) || (configured.colourName ? colourNamedIn(configured.colourName) : null);
}

// paintInclusionBaseline(inclusions) plus `standards.ceilings`: { colour, finish, source, label }.
export function paintBaselineWithStandards(inclusions = {}) {
  const baseline = paintInclusionBaseline(inclusions);
  const fromInclusions = ceilingFromInclusionLines(baseline.lines);
  const fromBuilder = fromInclusions ? null : ceilingFromBuilderDefaults(inclusions);
  const colour = fromInclusions || fromBuilder || DULUX_CEILING_WHITE;
  const source = fromInclusions ? 'inclusions' : fromBuilder ? 'builder' : 'default';
  return { ...baseline, standards: { ceilings: { colour, finish: baseline.finishes.ceilings, source, label: STANDARD_SOURCE_LABELS[source] } } };
}
