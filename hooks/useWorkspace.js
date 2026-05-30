// /hooks/useWorkspace.js
// React hook providing the active workspace context and feature gate helpers.
//
// Wrap your app (or layout) with <WorkspaceProvider> and then call
// useWorkspace() in any component.
//
// Stores the active workspace_id in localStorage so it persists across reloads.

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../utils/supabase-client";
import { canUseFeature, getLimit } from "../lib/featureGates";

const WorkspaceContext = createContext(null);

const LS_KEY = "active_workspace_id";

export function WorkspaceProvider({ children }) {
  const [workspaces, setWorkspaces]       = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [loading, setLoading]             = useState(true);

  // Load workspaces from API
  const loadWorkspaces = useCallback(async (session) => {
    if (!session?.access_token) {
      setWorkspaces([]);
      setActiveWorkspace(null);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/workspaces", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      const list = json.workspaces || [];
      setWorkspaces(list);

      // Restore previously selected workspace or fall back to first
      const stored = typeof window !== "undefined"
        ? localStorage.getItem(LS_KEY)
        : null;
      const match = list.find((w) => w.id === stored) || list[0] || null;
      setActiveWorkspace(match);
    } catch (err) {
      console.error("[useWorkspace] failed to load workspaces", err);
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
      await fetch("/api/workspaces/activate-invite", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
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
        if (event === "SIGNED_IN") {
          activateAndLoad(session);
        } else {
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

  const value = {
    workspaces,
    activeWorkspace,
    workspaceId: activeWorkspace?.id || null,
    plan: activeWorkspace?.plan || "starter",
    role: activeWorkspace?.role || null,
    loading,
    switchWorkspace,
    /** Check if the active workspace can use a feature */
    can: (feature) => canUseFeature(activeWorkspace?.plan || "starter", feature),
    /** Get usage limit for a resource */
    limit: (resource) => getLimit(activeWorkspace?.plan || "starter", resource),
  };

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
