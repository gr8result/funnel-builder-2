// Catches "X is not defined" runtime crashes before they reach the browser.
//
// The takeoff page was crashing on `hasRecoverablePlanPages is not defined` - a helper
// that was used but never imported. ESLint never saw it: .jsx files are not matched by
// the flat config, so no-undef never ran on them.
//
//   node scripts/check-undefined-identifiers.mjs [file-or-glob ...]
//
// Defaults to the estimate builder / takeoff surface.

import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

const traverse = _traverse.default || _traverse;

const DEFAULT_TARGETS = [
  'components/construction-estimation/ai-plan-takeoff',
  'components/estimate-builder',
  'hooks/estimate-builder',
  'lib/construction-estimation',
];

const BROWSER_AND_NODE_GLOBALS = new Set([
  'window', 'document', 'navigator', 'console', 'location', 'history', 'screen',
  'fetch', 'Headers', 'Request', 'Response', 'FormData', 'URL', 'URLSearchParams',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame',
  'cancelAnimationFrame', 'queueMicrotask', 'structuredClone', 'reportError',
  'localStorage', 'sessionStorage', 'indexedDB', 'IDBKeyRange', 'crypto', 'caches',
  'Blob', 'File', 'FileReader', 'FileList', 'Image', 'ImageData', 'Audio', 'Worker',
  'Event', 'CustomEvent', 'EventTarget', 'AbortController', 'AbortSignal', 'MutationObserver',
  'ResizeObserver', 'IntersectionObserver', 'DOMParser', 'XMLSerializer', 'XMLHttpRequest',
  'WebSocket', 'MessageChannel', 'BroadcastChannel', 'Notification', 'performance',
  'TextEncoder', 'TextDecoder', 'btoa', 'atob', 'alert', 'confirm', 'prompt', 'print',
  'HTMLElement', 'HTMLCanvasElement', 'HTMLImageElement', 'HTMLInputElement', 'Node', 'Element',
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Symbol', 'BigInt', 'Function',
  'Math', 'JSON', 'Date', 'RegExp', 'Error', 'TypeError', 'RangeError', 'SyntaxError',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Proxy', 'Reflect', 'Intl',
  'ArrayBuffer', 'SharedArrayBuffer', 'DataView', 'Uint8Array', 'Uint16Array', 'Uint32Array',
  'Int8Array', 'Int16Array', 'Int32Array', 'Float32Array', 'Float64Array', 'BigInt64Array',
  'isNaN', 'isFinite', 'parseInt', 'parseFloat', 'encodeURIComponent', 'decodeURIComponent',
  'encodeURI', 'decodeURI', 'escape', 'unescape', 'globalThis', 'undefined', 'NaN', 'Infinity',
  'process', 'Buffer', '__dirname', '__filename', 'module', 'require', 'exports', 'global',
  'React', 'JSX',
  'CSS', 'ImageBitmap', 'createImageBitmap', 'Uint8ClampedArray', 'arguments',
  'OffscreenCanvas', 'Path2D', 'DOMMatrix', 'ClipboardItem', 'IntlSegmenter',
]);

function collectFiles(target) {
  const abs = path.resolve(target);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return [abs];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const next = path.join(abs, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(next));
    // .ts/.tsx are covered by tsc; .js/.jsx are the gap - the flat ESLint config does
    // not match them, so no-undef never runs and these crash only in the browser.
    else if (/\.(js|jsx|mjs)$/.test(entry.name)) out.push(next);
  }
  return out;
}

function checkFile(file) {
  const code = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parse(code, {
      sourceType: 'module',
      allowReturnOutsideFunction: true,
      plugins: ['jsx', 'typescript', 'classProperties', 'decorators-legacy', 'optionalChaining', 'nullishCoalescingOperator', 'topLevelAwait'],
    });
  } catch (error) {
    return [{ line: error.loc?.line ?? 0, name: `parse error: ${error.message}` }];
  }

  const findings = [];
  traverse(ast, {
    ReferencedIdentifier(nodePath) {
      const { node, scope } = nodePath;
      const name = node.name;
      if (BROWSER_AND_NODE_GLOBALS.has(name)) return;
      if (scope.hasBinding(name, { noGlobals: true })) return;
      // JSX element names resolve like identifiers only when capitalised components.
      if (nodePath.parent?.type === 'JSXAttribute') return;
      findings.push({ line: node.loc?.start.line ?? 0, name });
    },
  });

  const seen = new Set();
  return findings.filter((f) => {
    const key = `${f.name}:${f.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const targets = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_TARGETS;
const files = [...new Set(targets.flatMap(collectFiles))];
let total = 0;

for (const file of files) {
  const findings = checkFile(file);
  if (!findings.length) continue;
  total += findings.length;
  console.log(`\n${path.relative(process.cwd(), file)}`);
  for (const f of findings) console.log(`  line ${String(f.line).padStart(5)}  ${f.name} is not defined`);
}

console.log(total
  ? `\nFAIL: ${total} undefined identifier${total === 1 ? '' : 's'} across ${files.length} files.`
  : `PASS: no undefined identifiers across ${files.length} files.`);
process.exitCode = total ? 1 : 0;
