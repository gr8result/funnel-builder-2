// /hooks/useWorkspace.js
// React hook providing the active workspace context and feature gate helpers.
//
// Wrap your app (or layout) with <WorkspaceProvider> and then call
// useWorkspace() in any component.
//
// Stores the active workspace_id in localStorage so it persists across reloads.

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "../utils/supabase-client";
import { canUseFeature, getLimit } from "../lib/featureGates";

const WorkspaceContext = createContext(null);

const LS_KEY = "active_workspace_id";

// Keep the current object when a reload returns identical data, so consumers do not re-render.
function sameJson(current, next) {
  if (current === next) return true;
  try {
    return JSON.stringify(current) === JSON.stringify(next);
  } catch {
    return false;
  }
}
const keepIfUnchanged = (next) => (current) => (sameJson(current, next) ? current : next);

export function WorkspaceProvider({ children }) {
  const [workspaces, setWorkspaces]       = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [loading, setLoading]             = useState(true);
  // The user whose workspaces are loaded, and the user whose sign-in already ran invite
  // activation. Supabase re-emits SIGNED_IN/TOKEN_REFRESHED for the same user whenever a tab
  // becomes visible; only a different user (or sign-out) is a real session change.
  const loadedUserIdRef = useRef(null);
  const activatedUserIdRef = useRef(null);

  // Load workspaces from API
  const loadWorkspaces = useCallback(async (session) => {
    if (!session?.access_token) {
      loadedUserIdRef.current = null;
      activatedUserIdRef.current = null;
      setWorkspaces(keepIfUnchanged([]));
      setActiveWorkspace(null);
      if (typeof window !== 'undefined') localStorage.removeItem(LS_KEY);
      setLoading(false);
      return;
    }
    loadedUserIdRef.current = session.user?.id || null;

    try {
      const res = await fetch("/api/workspaces", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        throw new Error(`Workspace request failed with status ${res.status}`);
      }
      const json = await res.json().catch(() => ({}));
      const list = json.workspaces || [];
      setWorkspaces(keepIfUnchanged(list));

      // Restore previously selected workspace or fall back to first
      const stored = typeof window !== "undefined"
        ? localStorage.getItem(LS_KEY)
        : null;
      const match = list.find((w) => w.id === stored) || list[0] || null;
      if (typeof window !== 'undefined') {
        if (match) localStorage.setItem(LS_KEY, match.id);
        else localStorage.removeItem(LS_KEY);
      }
      setActiveWorkspace(keepIfUnchanged(match));
    } catch (err) {
      if (process.env.NODE_ENV !== "development") {
        console.warn("[useWorkspace] failed to load workspaces", err);
      }
      // Not loaded: let the next auth event for this user try again.
      loadedUserIdRef.current = null;
      setWorkspaces([]);
      setActiveWorkspace(null);
      if (typeof window !== 'undefined') localStorage.removeItem(LS_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  // Activate any pending workspace invites, then reload workspaces
  const activateAndLoad = useCallback(async (session) => {
    if (!session?.access_token) {
      loadWorkspaces(session);
      return;
    }
    try {
      const res = await fetch("/api/workspaces/activate-invite", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        throw new Error(`Workspace invite activation failed with status ${res.status}`);
      }
    } catch {
      // Non-fatal — just proceed to load workspaces
    }
    loadWorkspaces(session);
  }, [loadWorkspaces]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      loadWorkspaces(data?.session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const userId = session?.user?.id || null;
        if (!session?.access_token) {
          loadWorkspaces(session);
        } else if (event === "SIGNED_IN") {
          if (activatedUserIdRef.current === userId) return;
          activatedUserIdRef.current = userId;
          activateAndLoad(session);
        } else if (loadedUserIdRef.current !== userId) {
          loadWorkspaces(session);
        }
      }
    );
    return () => subscription?.unsubscribe();
  }, [loadWorkspaces, activateAndLoad]);

  const switchWorkspace = useCallback((workspaceId) => {
    const found = workspaces.find((w) => w.id === workspaceId);
    if (found) {
      setActiveWorkspace(found);
      if (typeof window !== "undefined") {
        localStorage.setItem(LS_KEY, workspaceId);
      }
    }
  }, [workspaces]);

  const value = useMemo(() => ({
    workspaces,
    activeWorkspace,
    workspaceId: activeWorkspace?.id || null,
    plan: activeWorkspace?.plan || "starter",
    role: activeWorkspace?.role || null,
    isDemoWorkspace: activeWorkspace?.is_demo === true,
    loading,
    switchWorkspace,
    /** Check if the active workspace can use a feature */
    can: (feature) => canUseFeature(activeWorkspace?.plan || "starter", feature),
    /** Get usage limit for a resource */
    limit: (resource) => getLimit(activeWorkspace?.plan || "starter", resource),
  }), [workspaces, activeWorkspace, loading, switchWorkspace]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}

/**
 * Returns a fetch wrapper that automatically adds Authorization and
 * x-workspace-id headers from the active workspace context.
 *
 * Usage:
 *   const { apiFetch } = useWorkspace();
 *   const data = await apiFetch("/api/crm/leads");
 */
export function useApiFetch() {
  const { workspaceId } = useWorkspace();

  return useCallback(
    async (url, options = {}) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
      };

      return fetch(url, { ...options, headers });
    },
    [workspaceId]
  );
}
