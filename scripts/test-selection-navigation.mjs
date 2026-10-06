import assert from 'node:assert/strict';
import { canonicalNavigationUrl, normalizeSelectionDestination, safeSelectionNavigate } from '../lib/navigation/selectionNavigation.js';

assert.equal(canonicalNavigationUrl('/x/?z=2&a=a%20b'), canonicalNavigationUrl('/x?a=a+b&z=2'));
const failing = 'http://localhost:3000/modules/estimate-builder?page=clientSelections&room=kitchen&roomCategory=kitchen-ovens';
assert.equal(normalizeSelectionDestination(failing).search, '?page=clientSelections');
const guided = failing + '&guided=appliances&applianceFamily=ovens';
assert.equal(normalizeSelectionDestination(guided).searchParams.get('guided'), 'appliances');
assert.equal(normalizeSelectionDestination(guided, undefined, { landing: true }).search, '?page=clientSelections');
assert(!normalizeSelectionDestination(failing + '&guided=unknown').searchParams.has('guided'));
const calls = [];
globalThis.window = { location: { href: failing } };
let finish;
const router = { push: (url) => { calls.push(url); return new Promise(resolve => { finish = resolve; }); }, replace: async url => { calls.push(url); return true; } };
const first = safeSelectionNavigate(router, failing);
assert.equal(await safeSelectionNavigate(router, failing), false, 'Suppress the same in-flight destination.');
finish(true); await first;
assert.deepEqual(calls, ['/modules/estimate-builder?page=clientSelections']);
window.location.href = 'http://localhost:3000/modules/estimate-builder?page=clientSelections';
assert.equal(await safeSelectionNavigate(router, '/modules/estimate-builder/?page=clientSelections'), false);
assert.equal(calls.length, 1);
const internal = 'http://localhost:3000/modules/estimate-builder?page=clientSelections&selectionArea=interior&selectionRequirement=skirting';
assert.equal(normalizeSelectionDestination(internal).searchParams.get('selectionRequirement'), 'skirting');
window.location.href = internal;
assert.equal(await safeSelectionNavigate(router, '/modules/estimate-builder?selectionRequirement=skirting&selectionArea=interior&page=clientSelections'), false);
assert.equal(calls.length, 1, 'Internal selection routing uses the same sorted-query guard.');

// Next can display a route before its push promise settles. Going to another
// tab and back in that interval must not discard the return click as a duplicate.
const tabCalls = [];
const completions = [];
const tabsRouter = { push: url => {
  tabCalls.push(url);
  window.location.href = `http://localhost:3000${url}`;
  return new Promise(resolve => completions.push(resolve));
} };
window.location.href = 'http://localhost:3000/modules/estimate-builder?page=formulaSheet';
const enterData = safeSelectionNavigate(tabsRouter, '/modules/estimate-builder?page=dataInput');
const enterQuote = safeSelectionNavigate(tabsRouter, '/modules/estimate-builder?page=quotation');
const returnToData = safeSelectionNavigate(tabsRouter, '/modules/estimate-builder?page=dataInput');
assert.deepEqual(tabCalls, [
  '/modules/estimate-builder?page=dataInput',
  '/modules/estimate-builder?page=quotation',
  '/modules/estimate-builder?page=dataInput',
], 'Returning to Data Input must supersede an unfinished earlier navigation');
completions.forEach(resolve => resolve(true));
await Promise.all([enterData, enterQuote, returnToData]);
delete globalThis.window;
console.log('Selection navigation guards passed.');
