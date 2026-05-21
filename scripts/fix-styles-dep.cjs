// Moves the `styles` CSS-in-JS object from PageBuilderCanvas.js
// into a shared pbStyles.js file, then updates imports in all sub-files.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function write(rel, content) { fs.writeFileSync(path.join(ROOT, rel), content, 'utf8'); }

// ── 1. Extract styles from PageBuilderCanvas.js ──────────────────────────────
const pbcPath = 'components/website-builder/PageBuilderCanvas.js';
const pbcContent = read(pbcPath);
const pbcLines = pbcContent.split('\n');

// styles runs from line 2208 to 3685 (1-based) => indices 2207..3684
const stylesLines = pbcLines.slice(2207, 3685);
console.log('Styles block size:', stylesLines.length, 'lines');
console.log('First line:', stylesLines[0]);
console.log('Last line:', stylesLines[stylesLines.length - 1]);

// ── 2. Create pbStyles.js ─────────────────────────────────────────────────────
const pbStylesContent =
  '// Shared styles object used by PageBuilderCanvas and its sub-modules.\n' +
  '// Extracted here to avoid circular imports.\n\n' +
  stylesLines.join('\n') +
  '\n\nexport { styles };\n';

write('components/website-builder/page-builder/pbStyles.js', pbStylesContent);
console.log('Created pbStyles.js');

// ── 3. Remove styles block from PageBuilderCanvas.js ─────────────────────────
// Keep lines 1..2207 (indices 0..2206) — everything before `const styles = {`
const newPbcLines = pbcLines.slice(0, 2207);
// Ensure file ends with a newline
const newPbcContent = newPbcLines.join('\n') + '\n';
write(pbcPath, newPbcContent);
console.log('PageBuilderCanvas.js trimmed to', newPbcLines.length, 'lines');

// ── 4. Add import to PageBuilderCanvas.js ────────────────────────────────────
// Find the last import line
let pbcNew = read(pbcPath);
const pbcNewLines = pbcNew.split('\n');
let lastImportLine = 0;
for (let i = 0; i < pbcNewLines.length; i++) {
  if (pbcNewLines[i].startsWith('import ')) lastImportLine = i;
}
console.log('Last import in PageBuilderCanvas.js at line:', lastImportLine + 1);
pbcNewLines.splice(lastImportLine + 1, 0, 'import { styles } from "./page-builder/pbStyles";');
write(pbcPath, pbcNewLines.join('\n'));
console.log('Added styles import to PageBuilderCanvas.js');

// ── 5. Add import to pbPropertiesPanels.js ───────────────────────────────────
const ppPath = 'components/website-builder/page-builder/pbPropertiesPanels.js';
let ppContent = read(ppPath);
const ppLines = ppContent.split('\n');
let ppLastImport = 0;
for (let i = 0; i < ppLines.length; i++) {
  if (ppLines[i].startsWith('import ')) ppLastImport = i;
}
console.log('Last import in pbPropertiesPanels.js at line:', ppLastImport + 1);
ppLines.splice(ppLastImport + 1, 0, 'import { styles } from "./pbStyles";');
write(ppPath, ppLines.join('\n'));
console.log('Added styles import to pbPropertiesPanels.js');

// ── 6. Add import to pbCanvasComponents.js ───────────────────────────────────
const pcPath = 'components/website-builder/page-builder/pbCanvasComponents.js';
let pcContent = read(pcPath);
const pcLines = pcContent.split('\n');
let pcLastImport = 0;
for (let i = 0; i < pcLines.length; i++) {
  if (pcLines[i].startsWith('import ')) pcLastImport = i;
}
console.log('Last import in pbCanvasComponents.js at line:', pcLastImport + 1);
pcLines.splice(pcLastImport + 1, 0, 'import { styles } from "./pbStyles";');
write(pcPath, pcLines.join('\n'));
console.log('Added styles import to pbCanvasComponents.js');

console.log('\nDone! styles moved to pbStyles.js and imported in all 3 consumers.');
