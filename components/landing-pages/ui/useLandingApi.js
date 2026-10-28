// Authenticated calls to /api/landing-pages, scoped to the active workspace.

import { useCallback } from 'react';
import { useApiFetch, useWorkspace } from '../../../hooks/useWorkspace';

// AI generation makes several provider calls (strategy, copy, quality revision, optional image) and routinely
// exceeds the default request timeout; aborting it early strands a campaign without its page.
export const GENERATION_TIMEOUT_MS = 240000;

export function useLandingApi() {
  const apiFetch = useApiFetch();
  const { workspaceId, loading } = useWorkspace();
  const call = useCallback(async (url, { method = 'GET', body, timeoutMs = 20000 } = {}) => {
    if (!workspaceId) throw new Error('Your workspace is still loading. Please try again in a moment.');
    const controller = new AbortController();
    let timer;
    try {
      const request = (async () => {
        const r = await apiFetch(url, {
          method,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
        let j = {};
        try { j = await r.json(); } catch { j = {}; }
        if (!r.ok || j.ok === false) {
          let message = j.error || "We couldn't complete that request. Please try again.";
          if (r.status === 401) message = 'Your session has expired. Please sign in again.';
          else if (r.status === 403) message = "You don't have access to this business workspace.";
          else if (r.status >= 500 && j.code !== 'SERVICE_UNAVAILABLE') message = "We couldn't load your campaigns right now. Please try again.";
          const err = new Error(message);
          Object.assign(err, { status: r.status, body: j });
          throw err;
        }
        return j;
      })();
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          const error = new Error("This request timed out. Check your connection and retry.");
          Object.assign(error, { status: 408 });
          reject(error);
        }, timeoutMs);
      });
      return await Promise.race([request, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }, [apiFetch, workspaceId]);
  return { call, workspaceId, ready: !loading && !!workspaceId };
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
