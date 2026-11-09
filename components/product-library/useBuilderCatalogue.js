import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase-client';
import { configureBuilderCataloguePersistence, flushBuilderCatalogueWrites, hydrateBuilderCatalogue, retryBuilderCatalogueWrites, subscribeBuilderCatalogue } from '../../lib/product-library/catalogueService.js';

// A window focus re-reads the builder catalogue only when the last read is older than this.
// Reloading on every focus re-sent the whole catalogue each time the user clicked back into
// the browser, and the Workbook and the Selections Book each did it.
export const FOCUS_RELOAD_MIN_MS = 60_000;

// One read per workspace at a time, shared by every mounted hook.
const inFlightLoads = new Map();
const lastLoadedAt = new Map();

async function request(workspaceId, body) {
  const { data } = await supabase.auth.getSession();
  if (!data?.session?.access_token) throw new Error('Sign in to load and save builder products.');
  // source=stored: only the builder's own rows. The master catalogue is already in the bundle.
  const query = body ? '' : '&source=stored';
  const response = await fetch(`/api/builders/product-catalogue?workspace_id=${encodeURIComponent(workspaceId)}${query}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
    ...(body ? { body: JSON.stringify({ ...body, workspace_id: workspaceId }) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not synchronize builder products.');
  return result;
}

function loadBuilderCatalogue(workspaceId) {
  if (inFlightLoads.has(workspaceId)) return inFlightLoads.get(workspaceId);
  const load = (async () => {
    await retryBuilderCatalogueWrites(workspaceId);
    await flushBuilderCatalogueWrites(workspaceId);
    const result = await request(workspaceId);
    if (result.workspace_id !== workspaceId) throw new Error('Catalogue workspace mismatch.');
    hydrateBuilderCatalogue(workspaceId, result);
    lastLoadedAt.set(workspaceId, Date.now());
  })().finally(() => inFlightLoads.delete(workspaceId));
  inFlightLoads.set(workspaceId, load);
  return load;
}

export function useBuilderCatalogue(workspaceId) {
  const [state, setState] = useState({ workspaceId: '', revision: 0, loading: Boolean(workspaceId), error: '' });
  useEffect(() => {
    if (!workspaceId) return;
    let active = true;
    const unsubscribe = subscribeBuilderCatalogue((owner, error) => {
      if (active && owner === workspaceId) setState(previous => ({ ...previous, workspaceId, revision: previous.revision + 1, error: error?.message || '' }));
    });
    configureBuilderCataloguePersistence(workspaceId, async (action, record) => {
      await request(workspaceId, { action, record });
    });
    async function reload() {
      try {
        await loadBuilderCatalogue(workspaceId);
        if (active) setState(previous => ({ ...previous, workspaceId, loading: false, error: '' }));
      } catch (error) {
        if (active) setState(previous => ({ ...previous, workspaceId, loading: false, error: error.message }));
      }
    }
    function reloadOnFocus() {
      if (Date.now() - (lastLoadedAt.get(workspaceId) || 0) < FOCUS_RELOAD_MIN_MS) {
        // Still retry builder edits that failed to save; that is cheap when nothing is pending.
        retryBuilderCatalogueWrites(workspaceId).catch(() => {});
        return;
      }
      reload();
    }
    setState(previous => ({ ...previous, workspaceId, loading: true, error: '' }));
    reload();
    window.addEventListener('focus', reloadOnFocus);
    window.addEventListener('online', reload);
    return () => { active = false; unsubscribe(); window.removeEventListener('focus', reloadOnFocus); window.removeEventListener('online', reload); };
  }, [workspaceId]);
  return state.workspaceId === workspaceId ? state : { revision: 0, loading: Boolean(workspaceId), error: '' };
}
