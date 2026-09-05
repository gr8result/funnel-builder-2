const BASE = 'http://localhost';
const PRODUCT_KEYS = ['room', 'roomCategory', 'roomProduct', 'area', 'category', 'family', 'catalogue', 'catalogueSection', 'catalogueSubcategory', 'cabinetrySubcategory', 'cabinetryBrand', 'cabinetryRange', 'browse'];
const APPLIANCE_KEYS = ['applianceFamily', 'applianceBrand', 'applianceProduct', 'applianceMode', 'appliancePackage'];
const pending = new Map();

export function navigationUrl(destination, current = BASE) {
  if (typeof destination === 'string' || destination instanceof URL) return new URL(destination, current);
  const url = new URL(destination.pathname || '/', current);
  for (const [key, value] of Object.entries(destination.query || {})) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined && item !== null) url.searchParams.append(key, String(item));
    }
  }
  if (destination.hash) url.hash = destination.hash;
  return url;
}
export function canonicalNavigationUrl(destination, current = BASE) {
  const url = navigationUrl(destination, current);
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  const entries = [...url.searchParams].sort(([ak, av], [bk, bv]) => ak.localeCompare(bk) || av.localeCompare(bv));
  url.search = new URLSearchParams(entries).toString();
  // These routes use query state, not fragment navigation.
  return `${url.origin}${url.pathname}${url.search}`;
}
export function normalizeSelectionDestination(destination, current = BASE, { guidedWorkflow, landing = false } = {}) {
  const url = navigationUrl(destination, current);
  const client = url.searchParams.get('page') === 'clientSelections' || /\/builders\/(client-selections|selections-book)\/?$/.test(url.pathname);
  const product = url.searchParams.get('page') === 'productLibrary' || /\/builders\/product-library\/?$/.test(url.pathname);
  const entryDoorWorkflow = client && !landing && url.searchParams.get('room') === 'exterior' && ['entry-doors', 'door-furniture'].includes(url.searchParams.get('roomCategory'));
  if (client || landing) for (const key of PRODUCT_KEYS) {
    if (entryDoorWorkflow && (['room', 'roomCategory'].includes(key) || (key === 'roomProduct' && url.searchParams.get('mode') === 'client-selection'))) continue;
    url.searchParams.delete(key);
  }
  const furniturePicker = (product || client) && !landing && url.searchParams.get('mode') === 'client-selection' && url.searchParams.get('returnPage') === 'clientSelections' && url.searchParams.get('room') === 'exterior' && url.searchParams.get('roomCategory') === 'door-furniture';
  if (!furniturePicker) for (const key of ['mode', 'returnPage']) url.searchParams.delete(key);
  if (!entryDoorWorkflow && !furniturePicker) for (const key of ['door', 'doorStep']) url.searchParams.delete(key);
  const activeGuided = !landing && client && (guidedWorkflow === undefined ? url.searchParams.get('guided') : guidedWorkflow) === 'appliances';
  if (!activeGuided) {
    url.searchParams.delete('guided');
    url.searchParams.delete('requirement');
    if (!product || landing) for (const key of APPLIANCE_KEYS) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url;
}
export async function safeSelectionNavigate(router, destination, { replace = false, guidedWorkflow, landing = false, ...options } = {}) {
  const current = typeof window !== 'undefined' ? window.location.href : new URL(router?.asPath || '/', BASE).href;
  const next = normalizeSelectionDestination(destination, current, { guidedWorkflow, landing });
  const key = canonicalNavigationUrl(next);
  if (key === canonicalNavigationUrl(current) || pending.has(key)) return false;
  const operation = {};
  pending.set(key, operation);
  try {
    if (router) {
      const href = next.origin === new URL(current).origin ? `${next.pathname}${next.search}${next.hash}` : next.href;
      return await router[replace ? 'replace' : 'push'](href, undefined, options);
    }
    if (typeof window !== 'undefined') window.location[replace ? 'replace' : 'assign'](next.href);
    return true;
  } catch (error) {
    if (error?.cancelled) return false;
    throw error;
  } finally {
    if (pending.get(key) === operation) pending.delete(key);
  }
}
