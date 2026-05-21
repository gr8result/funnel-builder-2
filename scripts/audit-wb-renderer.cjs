// Finds all identifiers used in wbVariantStyles and wbBlockComponents that are
// defined in one file but not available in the other via imports.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const wbvs = read('components/website-builder/website-renderer/wbVariantStyles.js');
const wbbc = read('components/website-builder/website-renderer/wbBlockComponents.js');
const wbanim = read('components/website-builder/website-renderer/wbAnimations.js');

// Top-level names defined in each file
function getTopLevelDefs(content) {
  return new Set(
    [...content.matchAll(/^(?:(?:export\s+)?(?:async\s+)?function|const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)/gm)]
      .map(m => m[1])
  );
}

const animDefs = getTopLevelDefs(wbanim);
const vsDefs = getTopLevelDefs(wbvs);
const bcDefs = getTopLevelDefs(wbbc);

// What wbVariantStyles imports from wbAnimations
const vsImportAnim = new Set(
  (wbvs.match(/import\s*\{([^}]+)\}\s*from\s*["']\.\/wbAnimations["']/) || ['',''])[1]
    .split(',').map(s => s.trim()).filter(Boolean)
);

// What wbBlockComponents imports from wbVariantStyles
const bcImportVS = new Set(
  (wbbc.match(/import\s*\{([^}]+)\}\s*from\s*["']\.\/wbVariantStyles["']/) || ['',''])[1]
    .split(',').map(s => s.trim()).filter(Boolean)
);

// What wbBlockComponents imports from wbAnimations
const bcImportAnim = new Set(
  (wbbc.match(/import\s*\{([^}]+)\}\s*from\s*["']\.\/wbAnimations["']/) || ['',''])[1]
    .split(',').map(s => s.trim()).filter(Boolean)
);

console.log('=== Names defined in wbBlockComponents that wbVariantStyles uses but cannot import ===');
// wbVariantStyles can only import from wbAnimations (circular if it imported from wbBlockComponents)
const vsNeedsFromBC = [];
for (const name of bcDefs) {
  if (vsDefs.has(name) || animDefs.has(name) || vsImportAnim.has(name)) continue;
  if (new RegExp('\\b' + name + '\\b').test(wbvs)) {
    vsNeedsFromBC.push(name);
  }
}
console.log(vsNeedsFromBC.length ? vsNeedsFromBC.join(', ') : 'none');

console.log('\n=== Names defined in wbVariantStyles that wbBlockComponents uses but hasnt imported ===');
const bcNeedsFromVS = [];
for (const name of vsDefs) {
  if (bcDefs.has(name) || animDefs.has(name) || bcImportVS.has(name) || bcImportAnim.has(name)) continue;
  if (new RegExp('\\b' + name + '\\b').test(wbbc)) {
    bcNeedsFromVS.push(name);
  }
}
console.log(bcNeedsFromVS.length ? bcNeedsFromVS.join(', ') : 'none');

console.log('\n=== wbAnimations export list (for reference) ===');
const animExports = (wbanim.match(/export\s*\{([^}]+)\}/) || ['',''])[1]
  .split(',').map(s => s.trim()).filter(Boolean);
console.log(animExports.join(', '));
