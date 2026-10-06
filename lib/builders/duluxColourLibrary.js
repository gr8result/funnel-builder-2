// The Dulux COLOUR LIBRARY used by Client Selections. Colours are specifications, not priced
// products: nothing here is a Product Library product and nothing here carries a price.
//
// Every colour, code and swatch value comes from the imported Dulux Australia catalogue
// (data/product-library/catalogues/residential/AU-DULUX-COLOURS.json, built by
// scripts/product-library/import-residential-services.mjs and import-dulux-colour-atlas.mjs).
// Only the BROWSE GROUPS below are worked out here, and only to help someone find a colour:
//   - Dulux publishes "Whites & Neutrals" as one family; it is split by Dulux's own light
//     reflectance value into Whites and Neutrals.
//   - Colours Dulux lists only by atlas page have no published family; they are placed by the
//     hue of their published swatch value.
//   - Dark / Charcoal collects the darkest colours of every family.
// A colour's name, code and swatch are never altered by grouping.
import index from '../../data/product-library/catalogues/residential/AU-DULUX-COLOUR-INDEX.json';

export const COLOUR_DISCLAIMER = 'Colours shown on screen are indicative only. Confirm final colours using an approved physical colour sample before ordering or application.';

export const COLOUR_GROUPS = Object.freeze([
  { key: 'popular', label: 'Popular / Builder Colours' },
  { key: 'whites', label: 'Whites' },
  { key: 'neutrals', label: 'Neutrals' },
  { key: 'greys', label: 'Greys' },
  { key: 'browns', label: 'Beiges / Browns' },
  { key: 'blues', label: 'Blues' },
  { key: 'greens', label: 'Greens' },
  { key: 'yellows', label: 'Yellows' },
  { key: 'oranges', label: 'Oranges' },
  { key: 'reds', label: 'Reds / Pinks' },
  { key: 'purples', label: 'Purples' },
  { key: 'dark', label: 'Dark / Charcoal' },
]);

const WHITE_LRV = 75;   // Dulux LRV at or above which a white/neutral is browsed as a white
const DARK_LRV = 12;    // Dulux LRV at or below which any colour is also browsed as dark

function hsl(hex) {
  const [r, g, b] = [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}
// Relative lightness on Dulux's 0-100 LRV scale, for the few colours published without an LRV.
function lightness(colour) {
  if (Number.isFinite(colour.lrv)) return colour.lrv;
  const [r, g, b] = [1, 3, 5].map(at => parseInt(colour.hex.slice(at, at + 2), 16) / 255).map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return Math.round((0.2126 * r + 0.7152 * g + 0.0722 * b) * 100);
}
function groupFromSwatch(colour) {
  const { h, s, l } = hsl(colour.hex);
  if (s < 0.1) return lightness(colour) >= WHITE_LRV ? 'whites' : 'greys';
  if (s < 0.22 && l > 0.8) return lightness(colour) >= WHITE_LRV ? 'whites' : 'neutrals';
  if (h < 15 || h >= 320) return 'reds';
  if (h < 50) return (s < 0.5 || l < 0.42) ? 'browns' : h < 38 ? 'oranges' : 'yellows';
  if (h < 70) return s < 0.3 ? 'browns' : 'yellows';
  if (h < 165) return 'greens';
  if (h < 255) return 'blues';
  return 'purples';
}
function groupsFor(colour) {
  const groups = new Set();
  for (const family of colour.families) {
    if (family === 'whites-and-neutrals') groups.add(lightness(colour) >= WHITE_LRV ? 'whites' : 'neutrals');
    else groups.add(family);
  }
  if (!groups.size) groups.add(groupFromSwatch(colour));
  if (lightness(colour) <= DARK_LRV) groups.add('dark');
  if (colour.popular) groups.add('popular');
  return [...groups];
}

const plain = value => String(value || '').toLowerCase().replace(/[™®]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const at = Object.fromEntries(index.fields.map((field, position) => [field, position]));

export const DULUX_COLOURS = Object.freeze(index.rows.map(row => {
  const colour = { id: row[at.id], manufacturer: index.manufacturer, name: row[at.name], code: row[at.code], hex: row[at.hex], lrv: row[at.lrv],
    families: row[at.families] ? row[at.families].split('|') : [], collection: row[at.collection], popular: row[at.popular] === 1,
    sourceUrl: `${index.origin}${row[at.path]}` };
  colour.groups = groupsFor(colour);
  colour.searchText = `${plain(colour.name)} ${plain(colour.code)}`;
  return Object.freeze(colour);
}).sort((a, b) => a.name.localeCompare(b.name)));

// Dulux Ceiling White: the ready-mixed flat ceiling paint. It is a genuine Dulux specification with
// a Dulux product page, but Dulux publishes no colour code and no swatch value for it, so `code` and
// `hex` are empty. `displaySwatch` is plain white for the screen only and is not a Dulux value.
const ceilingWhite = index.standardSpecifications.ceilingWhite;
export const DULUX_CEILING_WHITE = Object.freeze({ id: ceilingWhite.id, manufacturer: ceilingWhite.manufacturer, name: ceilingWhite.name, code: '', hex: '',
  displaySwatch: '#ffffff', finish: ceilingWhite.finish, readyMixed: true, sourceUrl: `${index.origin}${ceilingWhite.path}` });

const byId = new Map(DULUX_COLOURS.map(colour => [colour.id, colour]));
export const findColour = id => (id === DULUX_CEILING_WHITE.id ? DULUX_CEILING_WHITE : byId.get(id) || null);

// The Dulux colour (or Ceiling White) a line of text names, longest name first so "Lexicon Quarter"
// is not read as "Lexicon". Used to read a builder's Standard Inclusions.
export function colourNamedIn(text = '') {
  const padded = ` ${plain(text)} `;
  if (!padded.trim()) return null;
  const named = DULUX_COLOURS.filter(colour => padded.includes(` ${plain(colour.name)} `)).sort((a, b) => b.name.length - a.name.length)[0];
  if (named) return named;
  return padded.includes(` ${plain(DULUX_CEILING_WHITE.name)} `) ? DULUX_CEILING_WHITE : null;
}

// Colours a builder puts forward first: Dulux's own popular list plus any Dulux colour named in the
// builder's standard inclusions or configured as a builder colour.
export function builderColourIds(inclusionText = '', configuredIds = []) {
  const text = ` ${plain(inclusionText)} `;
  const named = text.trim() ? DULUX_COLOURS.filter(colour => text.includes(` ${plain(colour.name)} `)).map(colour => colour.id) : [];
  return new Set([...configuredIds, ...named]);
}

export function coloursInGroup(group, builderIds = new Set()) {
  if (!group || group === 'all') return DULUX_COLOURS;
  if (group === 'popular') return DULUX_COLOURS.filter(colour => colour.popular || builderIds.has(colour.id));
  return DULUX_COLOURS.filter(colour => colour.groups.includes(group));
}

// Name or Dulux colour code. Every word typed must appear; matches at the start of the name first.
export function searchColours(query = '', group = 'all', builderIds = new Set()) {
  const words = plain(query).split(' ').filter(Boolean);
  const pool = coloursInGroup(words.length ? 'all' : group, builderIds);
  if (!words.length) return group === 'all' || group === 'popular' ? pool : [...pool].sort((a, b) => lightness(b) - lightness(a));
  const phrase = words.join(' ');
  return pool.filter(colour => words.every(word => colour.searchText.includes(word)))
    .sort((a, b) => rank(a, phrase) - rank(b, phrase) || a.name.localeCompare(b.name));
}
function rank(colour, phrase) {
  const name = plain(colour.name);
  if (name === phrase || plain(colour.code) === phrase) return 0;
  if (name.startsWith(phrase)) return 1;
  return name.includes(phrase) ? 2 : 3;
}

export function groupCounts(builderIds = new Set()) {
  return Object.fromEntries(COLOUR_GROUPS.map(group => [group.key, coloursInGroup(group.key, builderIds).length]));
}

// Text that stays readable on top of a swatch.
export function readableOn(hex) {
  return lightness({ hex, lrv: null }) > 45 ? '#0f172a' : '#ffffff';
}
