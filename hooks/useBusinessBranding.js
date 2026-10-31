import { useEffect, useState } from 'react';
import { useWorkspace } from './useWorkspace';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase-client';

const cache = new Map();
const pending = new Map();

export function useBusinessBranding() {
  const { workspaceId } = useWorkspace();
  const { user, session } = useAuth();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: '', branding: null, error: '', loading: false });
  const key = user?.id && workspaceId ? `${user.id}:${workspaceId}` : '';

  useEffect(() => {
    const refresh = () => { cache.delete(key); setRevision((value) => value + 1); };
    window.addEventListener('gr8:branding-updated', refresh);
    return () => window.removeEventListener('gr8:branding-updated', refresh);
  }, [key]);

  useEffect(() => {
    let current = true;
    if (!key) { setState({ key: '', branding: null, error: '', loading: false }); return undefined; }
    const saved = cache.get(key);
    if (saved && Date.now() - saved.at < 300_000) {
      setState({ key, branding: saved.branding, error: '', loading: false });
      return undefined;
    }
    setState({ key, branding: null, error: '', loading: true });
    let request = pending.get(key);
    if (!request) {
      request = (async () => {
        const send = (token) => fetch('/api/account/branding', { headers: { Authorization: `Bearer ${token}`, 'x-workspace-id': workspaceId } });
        let response = await send(session?.access_token || '');
        if (response.status === 401) {
          const { data, error } = await supabase.auth.refreshSession(session || undefined);
          if (error || !data.session?.access_token) throw new Error('Your session expired. Please sign in again.');
          response = await send(data.session.access_token);
        }
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.ok) throw new Error("We couldn't load your saved company branding. Please try again.");
        cache.set(key, { at: Date.now(), branding: result.branding });
        return result.branding;
      })().finally(() => pending.delete(key));
      pending.set(key, request);
    }
    request.then((branding) => { if (current) setState({ key, branding, error: '', loading: false }); })
      .catch((error) => { if (current) setState({ key, branding: null, error: error.message, loading: false }); });
    return () => { current = false; };
  }, [key, session, workspaceId, revision]);

  return state.key === key ? state : { branding: null, error: '', loading: !!key };
}