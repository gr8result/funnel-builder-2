import { CURRENT_BUILDER_WORKSPACE_ID } from './currentBuilderSeed.js';
import { adoptLegacyWorkbook, tenantStorageKey, workbookWorkspaceId } from './tenantScope.js';

// The workspace provider validates membership. This namespace prevents accidental browser
// crossover; server authorization is always enforced independently by withWorkspace/RLS.
export function browserWorkspaceId() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem('active_workspace_id') || '';
}

export function browserTenantKey(base, workspaceId = browserWorkspaceId()) {
  // Existing records stay in place for their verified original owner. No destructive rewrite.
  if (workspaceId === CURRENT_BUILDER_WORKSPACE_ID) return base;
  return tenantStorageKey(base, workspaceId || 'anonymous-local');
}

function scopedStorage(name) {
  return {
    getItem: key => window[name].getItem(browserTenantKey(key)),
    setItem: (key, value) => window[name].setItem(browserTenantKey(key), value),
    removeItem: key => window[name].removeItem(browserTenantKey(key)),
  };
}
export const builderLocalStorage = scopedStorage('localStorage');
export const builderSessionStorage = scopedStorage('sessionStorage');

export function scopeBrowserWorkbook(workbook) {
  if (typeof window === 'undefined') return workbook;
  const workspaceId = browserWorkspaceId();
  const owner = workbookWorkspaceId(workbook);
  if (owner && owner !== workspaceId) throw new Error('This job belongs to another builder workspace.');
  return workspaceId ? adoptLegacyWorkbook(workbook, workspaceId) : workbook;
}
