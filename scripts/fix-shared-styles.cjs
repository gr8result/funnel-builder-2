// Moves sharedStyles from WebsiteBlockRenderer.js to wbVariantStyles.js,
// exports it, and updates all consumers.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function write(rel, c) { fs.writeFileSync(path.join(ROOT, rel), c, 'utf8'); }

// ── 1. Extract sharedStyles from WebsiteBlockRenderer.js ─────────────────────
const wbrPath = 'components/website-builder/WebsiteBlockRenderer.js';
const wbrContent = read(wbrPath);
const wbrLines = wbrContent.split('\n');

// sharedStyles starts at line 2883 (1-based) = index 2882
const sharedStylesStartIdx = 2882;
// ends at line 3001 = index 3000 (the `};` line before the file ends)
const sharedStylesEndIdx = 3000;

const sharedBlock = wbrLines.slice(sharedStylesStartIdx, sharedStylesEndIdx + 1).join('\n');
console.log('sharedStyles block:', sharedStylesStartIdx + 1, '-', sharedStylesEndIdx + 1);
console.log('First line:', wbrLines[sharedStylesStartIdx]);
console.log('Last line:', wbrLines[sharedStylesEndIdx]);

// Remove sharedStyles from WebsiteBlockRenderer.js
const wbrNewLines = [
  ...wbrLines.slice(0, sharedStylesStartIdx),
  ...wbrLines.slice(sharedStylesEndIdx + 1),
];
write(wbrPath, wbrNewLines.join('\n'));
console.log('Removed sharedStyles from WebsiteBlockRenderer.js. Lines now:', wbrNewLines.length);

// ── 2. Add sharedStyles import to WebsiteBlockRenderer.js ────────────────────
let wbrNew = read(wbrPath);
// Add sharedStyles to the existing import from wbVariantStyles
wbrNew = wbrNew.replace(
  '  buildNavLinkStyle, applyNavHoverEffect, resetNavHoverEffect,\n  findScrollParent, getBrandInitials, BrandMark,\n} from "./website-renderer/wbVariantStyles";',
  '  buildNavLinkStyle, applyNavHoverEffect, resetNavHoverEffect,\n  findScrollParent, getBrandInitials, BrandMark, sharedStyles,\n} from "./website-renderer/wbVariantStyles";'
);
write(wbrPath, wbrNew);
console.log('Added sharedStyles to WebsiteBlockRenderer.js import from wbVariantStyles');

// ── 3. Append sharedStyles to wbVariantStyles.js (before export block) ───────
const wbvsPath = 'components/website-builder/website-renderer/wbVariantStyles.js';
let wbvsContent = read(wbvsPath);

// Insert before the export block
const exportBlockMarker = '\nexport {\n';
const insertionPoint = wbvsContent.indexOf(exportBlockMarker);
if (insertionPoint === -1) {
  console.error('ERROR: Could not find export block in wbVariantStyles.js');
  process.exit(1);
}

const beforeExport = wbvsContent.slice(0, insertionPoint);
const afterExport = wbvsContent.slice(insertionPoint);

const newWbvsContent = beforeExport
  + '\n\n' + sharedBlock + '\n'
  + afterExport;

write(wbvsPath, newWbvsContent);
console.log('Appended sharedStyles to wbVariantStyles.js');

// ── 4. Add sharedStyles to wbVariantStyles.js export block ───────────────────
let wbvsFinal = read(wbvsPath);
wbvsFinal = wbvsFinal.replace(
  '  findScrollParent, getBrandInitials, BrandMark,\n};',
  '  findScrollParent, getBrandInitials, BrandMark, sharedStyles,\n};'
);
write(wbvsPath, wbvsFinal);
console.log('Added sharedStyles to wbVariantStyles.js exports');

// ── 5. Add sharedStyles import to wbBlockComponents.js ───────────────────────
const wbbcPath = 'components/website-builder/website-renderer/wbBlockComponents.js';
let wbbcContent = read(wbbcPath);

// Add sharedStyles to the existing import from wbVariantStyles
wbbcContent = wbbcContent.replace(
  '  navVariantTheme, contactFormVariantStyles, DEFAULT_ENQUIRY_BOOKING_URL, resolveContactBookingUrl,',
  '  navVariantTheme, contactFormVariantStyles, DEFAULT_ENQUIRY_BOOKING_URL, resolveContactBookingUrl, sharedStyles,'
);

// Verify it was replaced
if (!wbbcContent.includes('sharedStyles,')) {
  console.error('ERROR: Could not add sharedStyles to wbBlockComponents.js import');
  process.exit(1);
}
write(wbbcPath, wbbcContent);
console.log('Added sharedStyles to wbBlockComponents.js import from wbVariantStyles');

// ── 6. Remove the local sharedStyles stub from wbVariantStyles (if the clampValue stub we added references it) ─
// The earlier fix added clampValue/htmlToPlainText but did not add sharedStyles there.
// Nothing to do.

console.log('\nDone! sharedStyles moved to wbVariantStyles.js and imported everywhere.');
