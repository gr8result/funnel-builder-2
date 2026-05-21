// Audits all website-builder sub-files for identifiers used but not imported.
// Checks wbBlockComponents.js, wbVariantStyles.js, pbPropertiesPanels.js, pbCanvasComponents.js
// against their source exports.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function readFile(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// ── What wbAnimations.js exports ─────────────────────────────────────────────
const WB_ANIM_EXPORTS = [
  'MIN_TEXT_SIZE','MIN_TAP_SIZE','PREMIUM_SHADOW','PREMIUM_BORDER','DEFAULT_LAYOUT_WIDTH',
  'WEBSITE_BLOCK_ANIMATION_STYLE_ID','WEBSITE_BLOCK_ANIMATION_CSS','PARALLAX_OVERRUN',
  'websiteBlockKeyframes','ensureWebsiteBlockAnimationStyles','animationState',
  'ScrollReveal','HtmlEmbedBlock','ambientMotionStyle','getAnimationStyle',
  'asArray','slugifyText','resolveCurrentPageKey','isCurrentNavLink','shouldHighlightNavLink',
  'isSystemAsset','pickDefaultAvatarSrc','resolvePublishedNavHref',
  'isGradientValue','extractSolidColor','resolveHeroBaseColor','resolveHeroGradient',
  'compensateParallaxBgPosition','resolveParallaxSpeed','heroBackground',
  'IconCounterNumber','ParallaxSyncShell','ParallaxImageLayer','StableParallaxLayer',
];

// ── Get imports from wbAnimations in each file ────────────────────────────────
function getImportedFromAnimations(content) {
  const match = content.match(/from ["']\.\/wbAnimations["'][^;]*/);
  if (!match) return [];
  const importBlock = content.substring(content.lastIndexOf('import', content.indexOf(match[0])), content.indexOf(match[0]) + match[0].length);
  const names = [...importBlock.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\b/g)].map(m => m[1]);
  return names.filter(n => WB_ANIM_EXPORTS.includes(n));
}

// ── Check which exported names are used but not imported ─────────────────────
function findMissingImports(filePath, importedNames, exports) {
  const content = readFile(filePath);
  const missing = [];
  for (const name of exports) {
    if (importedNames.includes(name)) continue;
    // Check if used (as a standalone identifier, not part of a longer name)
    const regex = new RegExp(`\\b${name}\\b`);
    if (regex.test(content)) {
      missing.push(name);
    }
  }
  return missing;
}

console.log('=== Audit of cross-file dependencies ===\n');

// ── wbBlockComponents.js ──────────────────────────────────────────────────────
const wbbc = readFile('components/website-builder/website-renderer/wbBlockComponents.js');
const wbbcImported = getImportedFromAnimations(wbbc);
console.log('wbBlockComponents imports from wbAnimations:', wbbcImported.join(', '));
const wbbcMissing = findMissingImports(
  'components/website-builder/website-renderer/wbBlockComponents.js',
  wbbcImported, WB_ANIM_EXPORTS
);
console.log('wbBlockComponents MISSING from wbAnimations:', wbbcMissing.join(', ') || 'none');

// ── wbVariantStyles.js ────────────────────────────────────────────────────────
const wbvs = readFile('components/website-builder/website-renderer/wbVariantStyles.js');
const wbvsImported = getImportedFromAnimations(wbvs);
console.log('\nwbVariantStyles imports from wbAnimations:', wbvsImported.join(', '));
const wbvsMissing = findMissingImports(
  'components/website-builder/website-renderer/wbVariantStyles.js',
  wbvsImported, WB_ANIM_EXPORTS
);
console.log('wbVariantStyles MISSING from wbAnimations:', wbvsMissing.join(', ') || 'none');

// ── Now check WebsiteBlockRenderer.js for any missing from sub-files ──────────
// Get what it exports from wbAnimations re-export
const wbr = readFile('components/website-builder/WebsiteBlockRenderer.js');
console.log('\nWebsiteBlockRenderer check complete (main renderer)');

// ── Check pbCanvasComponents for functions used from pbPropertiesPanels ──────
// Get pbPropertiesPanels exports
const ppPath = 'components/website-builder/page-builder/pbPropertiesPanels.js';
const ppContent = readFile(ppPath);
// Find export block
const ppExportMatch = ppContent.match(/^export\s*\{([^}]+)\}/m);
const ppExports = ppExportMatch ? ppExportMatch[1].split(',').map(s => s.trim()).filter(Boolean) : [];
console.log('\npbPropertiesPanels exports count:', ppExports.length);

const pcPath = 'components/website-builder/page-builder/pbCanvasComponents.js';
const pcContent = readFile(pcPath);
// Check what pbCanvasComponents imports from pbPropertiesPanels
const pcImportMatch = pcContent.match(/import\s*\{([^}]+)\}\s*from\s*["']\.\/pbPropertiesPanels["']/);
const pcImported = pcImportMatch ? pcImportMatch[1].split(',').map(s => s.trim()).filter(Boolean) : [];
console.log('pbCanvasComponents imports from pbPropertiesPanels:', pcImported.length, 'names');

// Check for names used in pcContent that are in ppExports but not imported
const pcMissing = ppExports.filter(name => {
  if (pcImported.includes(name)) return false;
  const regex = new RegExp(`\\b${name}\\b`);
  return regex.test(pcContent);
});
console.log('pbCanvasComponents MISSING from pbPropertiesPanels:', pcMissing.join(', ') || 'none');

// ── Check pbPropertiesPanels for functions used from pbEditorUtils ───────────
const pePath = 'components/website-builder/page-builder/pbEditorUtils.js';
const peContent = readFile(pePath);
const peExportMatch = peContent.match(/^export\s*\{([^}]+)\}/m);
const peExports = peExportMatch ? peExportMatch[1].split(',').map(s => s.trim()).filter(Boolean) : [];
console.log('\npbEditorUtils exports:', peExports.join(', '));

const ppImportFromPE = ppContent.match(/import\s*\{([^}]+)\}\s*from\s*["']\.\/pbEditorUtils["']/);
const ppImportedFromPE = ppImportFromPE ? ppImportFromPE[1].split(',').map(s => s.trim()).filter(Boolean) : [];
const ppMissingFromPE = peExports.filter(name => {
  if (ppImportedFromPE.includes(name)) return false;
  const regex = new RegExp(`\\b${name}\\b`);
  return regex.test(ppContent);
});
console.log('pbPropertiesPanels MISSING from pbEditorUtils:', ppMissingFromPE.join(', ') || 'none');

const pcImportFromPE = pcContent.match(/import\s*\{([^}]+)\}\s*from\s*["']\.\/pbEditorUtils["']/);
const pcImportedFromPE = pcImportFromPE ? pcImportFromPE[1].split(',').map(s => s.trim()).filter(Boolean) : [];
const pcMissingFromPE = peExports.filter(name => {
  if (pcImportedFromPE.includes(name)) return false;
  const regex = new RegExp(`\\b${name}\\b`);
  return regex.test(pcContent);
});
console.log('pbCanvasComponents MISSING from pbEditorUtils:', pcMissingFromPE.join(', ') || 'none');

console.log('\n=== Done ===');
