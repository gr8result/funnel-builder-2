// Comprehensive audit: finds all top-level names used in each sub-file that aren't
// locally defined or explicitly imported. Reports likely ReferenceErrors.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

// Parse imports: returns Map<importedName, sourceFile>
function parseImports(content) {
  const imported = new Set();
  const re = /import\s+(?:\*\s+as\s+\w+|\{([^}]*)\}|(\w+))\s+from\s+["'][^"']+["']/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    if (m[1]) {
      m[1].split(',').forEach(s => {
        const name = s.trim().split(/\s+as\s+/)[0].trim();
        if (name) imported.add(name);
      });
    } else if (m[2]) {
      imported.add(m[2]);
    }
  }
  return imported;
}

// Get top-level definitions (function declarations + const/let/var at top level)
function getTopLevelDefs(content) {
  const defs = new Set();
  // function declarations (including async)
  for (const m of content.matchAll(/^(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)/gm)) defs.add(m[1]);
  // const/let/var at start of line (including destructuring — skip those)
  for (const m of content.matchAll(/^(?:const|let|var)\s+([A-Za-z_][A-Za-z0-9_]*)\s*[=:]/gm)) defs.add(m[1]);
  // class declarations
  for (const m of content.matchAll(/^class\s+([A-Za-z_][A-Za-z0-9_]*)/gm)) defs.add(m[1]);
  return defs;
}

// Known globals (React, browser APIs, etc.)
const KNOWN_GLOBALS = new Set([
  'React','console','process','Buffer','require','module','exports','__dirname','__filename',
  'setTimeout','clearTimeout','setInterval','clearInterval','Promise','Object','Array','Map',
  'Set','Math','Number','String','Boolean','Date','JSON','RegExp','Error','Function',
  'document','window','navigator','location','history','localStorage','sessionStorage','URL',
  'fetch','FormData','Blob','File','FileReader','Event','CustomEvent','MutationObserver',
  'IntersectionObserver','ResizeObserver','requestAnimationFrame','cancelAnimationFrame',
  'performance','crypto','parseInt','parseFloat','isNaN','isFinite','encodeURIComponent',
  'decodeURIComponent','encodeURI','decodeURI','undefined','null','true','false','NaN',
  'Infinity','typeof','instanceof','void','delete','in','of','new','this','super','class',
  'extends','return','throw','try','catch','finally','if','else','for','while','do','switch',
  'case','break','continue','import','export','default','const','let','var','function','async',
  'await','yield','get','set','static','constructor',
  // React hooks and APIs
  'useState','useEffect','useRef','useMemo','useCallback','useContext','useReducer',
  'useLayoutEffect','useImperativeHandle','useDebugValue','useId','useDeferredValue',
  'useTransition','createContext','forwardRef','memo','createPortal','Fragment',
  'createElement','Children','cloneElement','isValidElement','StrictMode','Suspense',
  'lazy','startTransition','flushSync',
  // Next.js
  'dynamic',
]);

function auditFile(rel, label) {
  const content = read(rel);
  const imported = parseImports(content);
  const defined = getTopLevelDefs(content);

  // Find bare identifiers that are:
  // 1. Capitalized (components/classes) or common camelCase patterns
  // 2. Not imported, not defined locally, not a known global
  // Strategy: look for identifier patterns used in JSX and function calls
  const used = new Set();
  // Match identifiers used as: function calls, JSX tags, variable references in JSX
  for (const m of content.matchAll(/\b([A-Z][A-Za-z0-9_]*)\s*[({<]/g)) used.add(m[1]);
  // Also catch camelCase functions being called
  for (const m of content.matchAll(/\b([a-z][A-Za-z0-9_]{3,})\s*\(/g)) used.add(m[1]);

  const missing = [...used].filter(name => {
    if (KNOWN_GLOBALS.has(name)) return false;
    if (defined.has(name)) return false;
    if (imported.has(name)) return false;
    return true;
  });

  if (missing.length) {
    console.log(`\n[${label}] Possibly undefined (${missing.length}):`);
    missing.sort().forEach(n => console.log('  -', n));
  } else {
    console.log(`\n[${label}] OK - no obvious missing references`);
  }
}

console.log('=== Full sub-file audit ===');
auditFile('components/website-builder/website-renderer/wbAnimations.js',        'wbAnimations');
auditFile('components/website-builder/website-renderer/wbVariantStyles.js',      'wbVariantStyles');
auditFile('components/website-builder/website-renderer/wbBlockComponents.js',    'wbBlockComponents');
auditFile('components/website-builder/WebsiteBlockRenderer.js',                  'WebsiteBlockRenderer');
auditFile('components/website-builder/page-builder/pbEditorUtils.js',            'pbEditorUtils');
auditFile('components/website-builder/page-builder/pbPropertiesPanels.js',       'pbPropertiesPanels');
auditFile('components/website-builder/page-builder/pbCanvasComponents.js',       'pbCanvasComponents');
auditFile('components/website-builder/PageBuilderCanvas.js',                     'PageBuilderCanvas');
console.log('\n=== Done ===');
