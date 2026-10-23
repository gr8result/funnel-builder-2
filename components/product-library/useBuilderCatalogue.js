import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase-client';
import { configureBuilderCataloguePersistence, flushBuilderCatalogueWrites, hydrateBuilderCatalogue, retryBuilderCatalogueWrites, subscribeBuilderCatalogue } from '../../lib/product-library/catalogueService.js';

export function useBuilderCatalogue(workspaceId) {
  const [state, setState] = useState({ workspaceId: '', revision: 0, loading: Boolean(workspaceId), error: '' });
  useEffect(() => {
    if (!workspaceId) return;
    let active = true;
    async function request(body) {
      const { data } = await supabase.auth.getSession();
      if (!data?.session?.access_token) throw new Error('Sign in to load and save builder products.');
      const response = await fetch(`/api/builders/product-catalogue?workspace_id=${encodeURIComponent(workspaceId)}`, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
        ...(body ? { body: JSON.stringify({ ...body, workspace_id: workspaceId }) } : {}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not synchronize builder products.');
      return result;
    }
    const unsubscribe = subscribeBuilderCatalogue((owner, error) => {
      if (active && owner === workspaceId) setState(previous => ({ ...previous, workspaceId, revision: previous.revision + 1, error: error?.message || '' }));
    });
    configureBuilderCataloguePersistence(workspaceId, async (action, record) => {
      await request({ action, record });
    });
    async function reload() {
      try {
        await retryBuilderCatalogueWrites(workspaceId);
        await flushBuilderCatalogueWrites(workspaceId);
        const result = await request();
        if (!active) return;
        if (result.workspace_id !== workspaceId) throw new Error('Catalogue workspace mismatch.');
        hydrateBuilderCatalogue(workspaceId, result);
        setState(previous => ({ ...previous, workspaceId, loading: false, error: '' }));
      } catch (error) {
        if (active) setState(previous => ({ ...previous, workspaceId, loading: false, error: error.message }));
      }
    }
    setState(previous => ({ ...previous, workspaceId, loading: true, error: '' }));
    reload();
    window.addEventListener('focus', reload);
    window.addEventListener('online', reload);
    return () => { active = false; unsubscribe(); window.removeEventListener('focus', reload); window.removeEventListener('online', reload); };
  }, [workspaceId]);
  return state.workspaceId === workspaceId ? state : { revision: 0, loading: Boolean(workspaceId), error: '' };
}