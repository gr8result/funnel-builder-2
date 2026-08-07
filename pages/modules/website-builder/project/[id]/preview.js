import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import WebsitePreviewSurface from "../../../../../components/website-builder/WebsitePreviewSurface";

function SiteLoader() {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const arcLen = circ * 0.72;
  return (
    <>
      <style>{`
        @keyframes sl-spin{to{transform:rotate(360deg)}}
        @keyframes sl-pulse{0%,100%{opacity:.15;transform:scale(.78);}50%{opacity:.55;transform:scale(1.08);}}
        @keyframes sl-dot{0%,100%{opacity:.2;}50%{opacity:1;}}
      `}</style>
      <main style={{ minHeight:"100vh", display:"grid", placeItems:"center", background:"#05070f", fontFamily:"system-ui,sans-serif" }}>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:24 }}>
          <div style={{ fontSize:16, letterSpacing:"0.18em", textTransform:"uppercase", color:"rgba(255,255,255,.28)", fontWeight:600 }}>
            ??&nbsp; GR8 Website Studio
          </div>
          <div style={{ position:"relative", width:108, height:108, display:"grid", placeItems:"center" }}>
            <div style={{ position:"absolute", width:76, height:76, borderRadius:"50%", background:"radial-gradient(circle,rgba(14,165,233,.26) 0%,transparent 72%)", animation:"sl-pulse 2.6s ease-in-out infinite" }} />
            <svg width="108" height="108" viewBox="0 0 108 108" style={{ position:"absolute", animation:"sl-spin 1.8s linear infinite" }}>
              <defs>
                <linearGradient id="sl-arc" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0ea5e9" />
                  <stop offset="60%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <circle cx="54" cy="54" r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="4.5" />
              <circle cx="54" cy="54" r={r} fill="none" stroke="url(#sl-arc)" strokeWidth="4.5" strokeLinecap="round"
                strokeDasharray={`${arcLen.toFixed(1)} ${(circ - arcLen).toFixed(1)}`}
                transform="rotate(-90 54 54)" />
              <circle cx={54 + r} cy="54" r="4" fill="#0ea5e9" style={{ filter:"drop-shadow(0 0 6px #0ea5e9)" }} />
            </svg>
            <div style={{ position:"relative", width:14, height:14, borderRadius:"50%", background:"linear-gradient(135deg,#0ea5e9,#8b5cf6)", boxShadow:"0 0 20px rgba(14,165,233,.8),0 0 6px rgba(14,165,233,.5)" }} />
          </div>
          <div style={{ fontSize:16, fontWeight:600, color:"rgba(255,255,255,.6)", letterSpacing:"0.04em" }}>Loading preview…</div>
          <div style={{ display:"flex", gap:7 }}>
            {[0,1,2].map(i => (
              <span key={i} style={{ display:"block", width:6, height:6, borderRadius:"50%", background: i===1?"rgba(99,102,241,.75)":"rgba(14,165,233,.6)", animation:`sl-dot 1.5s ease-in-out ${i*0.3}s infinite` }} />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
import {
  getWebsiteBuilderAssets,
  getWebsiteProject,
  restoreWebsiteProjectFromBackup,
} from "../../../../../lib/website-builder/projectStore";
import {
  buildWebsitePreviewUrl,
  canonicalPreviewPageSlug,
  resolveCanonicalPreviewPageSlug,
} from "../../../../../lib/website-builder/previewRoutes";
import { syncWebsiteBuilderSharedAssetCache } from "../../../../../lib/website-builder/mediaAssets";
import { fetchWebsiteProjectFromServer } from "../../../../../lib/website-builder/remoteProjects";
import { supabase } from "../../../../../lib/supabaseClient";

const PREVIEW_SNAPSHOT_STORAGE_PREFIX = "gr8:website-preview-snapshot:";
const PREVIEW_LOAD_TIMEOUT_MS = 12000;
const PREVIEW_RENDER_COMMIT_TIMEOUT_MS = 8000;

function createPreviewFailure(stage, overrides = {}) {
  return {
    title: "Preview failed to load",
    stage,
    status: overrides.status || "ERROR",
    message: overrides.message || "Preview data could not be resolved.",
    requestUrl: overrides.requestUrl || "",
    details: overrides.details || {},
  };
}

function normalizePreviewProjectPayload(inputProject, pageKey = "") {
  if (!inputProject || typeof inputProject !== "object") return null;

  const project = { ...inputProject };
  if ((!Array.isArray(project.pages) || !project.pages.length) && project.page && typeof project.page === "object") {
    const pageName = String(project.page.name || project.page.title || "Home").trim() || "Home";
    project.pages = [{
      id: project.page.id || canonicalPreviewPageSlug(project.page.slug || pageName) || "home",
      name: pageName,
      slug: canonicalPreviewPageSlug(project.page.slug || pageName) || "home",
    }];
  }

  if ((!Array.isArray(project.pages) || !project.pages.length) && pageKey) {
    const fallbackName = String(pageKey || "Home").trim() || "Home";
    project.pages = [{
      id: canonicalPreviewPageSlug(fallbackName) || "home",
      name: fallbackName,
      slug: canonicalPreviewPageSlug(fallbackName) || "home",
    }];
  }

  const primaryPageName = String(project?.pages?.[0]?.name || "Home").trim() || "Home";
  if (!project.pageBlocks || typeof project.pageBlocks !== "object") project.pageBlocks = {};
  if (Array.isArray(project.blocks) && !Array.isArray(project.pageBlocks[primaryPageName])) {
    project.pageBlocks[primaryPageName] = project.blocks;
  }
  if (!project.pagesContent || typeof project.pagesContent !== "object") project.pagesContent = {};
  if (!project.chaiData || typeof project.chaiData !== "object") project.chaiData = {};

  return project;
}

function resolveProjectPageName(project, pageKey = "") {
  const requested = canonicalPreviewPageSlug(pageKey || project?.pages?.[0]?.name || "Home");
  return (Array.isArray(project?.pages) ? project.pages : []).find((entry) => (
    canonicalPreviewPageSlug(entry?.id) === requested
      || canonicalPreviewPageSlug(entry?.pageId) === requested
      || resolveCanonicalPreviewPageSlug(entry, { project }) === requested
      || canonicalPreviewPageSlug(entry?.name) === requested
  ))?.name || "";
}

function resolveProjectPageEntry(project, pageKey = "") {
  const pages = Array.isArray(project?.pages) ? project.pages : [];
  const requested = canonicalPreviewPageSlug(pageKey || pages[0]?.slug || pages[0]?.name || "home");
  return pages.find((entry) => (
    canonicalPreviewPageSlug(entry?.id) === requested
      || canonicalPreviewPageSlug(entry?.pageId) === requested
      || savedProjectPageSlug(project, entry) === requested
      || canonicalPreviewPageSlug(entry?.name) === requested
  )) || pages[0] || null;
}

function resolveRequestedProjectPage(project, pageKey = "") {
  const pages = Array.isArray(project?.pages) ? project.pages : [];
  const requested = canonicalPreviewPageSlug(pageKey || "");
  if (!requested) return null;
  return pages.find((entry) => (
    canonicalPreviewPageSlug(entry?.id) === requested
      || canonicalPreviewPageSlug(entry?.pageId) === requested
      || savedProjectPageSlug(project, entry) === requested
      || canonicalPreviewPageSlug(entry?.name) === requested
  )) || null;
}

function savedProjectPageSlug(project = {}, page = {}) {
  return resolveCanonicalPreviewPageSlug(page, { project });
}

function pickLayoutWidth(blocks, fallback = 1500) {
  for (const block of Array.isArray(blocks) ? blocks : []) {
    const value = Number(block?.props?.baseLayoutWidth || 0);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return fallback;
}

function pickPageBackground(blocks, fallback = "#ffffff") {
  for (const block of Array.isArray(blocks) ? blocks : []) {
    const value = String(block?.props?.pageBackground || "").trim();
    if (value) return value;
  }
  return fallback;
}

function readPreviewSnapshot(projectId, token) {
  if (typeof window === "undefined" || !projectId || !token) return null;
  try {
    const raw = window.localStorage.getItem(`${PREVIEW_SNAPSHOT_STORAGE_PREFIX}${projectId}:${token}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.project && typeof parsed.project === "object" ? parsed.project : null;
  } catch (error) {
    console.warn("Could not read website preview snapshot", error);
    return null;
  }
}

async function readApiJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: `Preview request returned non-JSON response (HTTP ${response.status})` };
  }
}

async function fetchEmergencyPageDraft(projectId, pageName) {
  if (!projectId || !pageName) return null;
  try {
    const response = await fetch(`/api/website-builder/emergency-page-draft?projectId=${encodeURIComponent(projectId)}&pageName=${encodeURIComponent(pageName)}`, {
      cache: "no-store",
    });
    const payload = await readApiJson(response);
    if (!response.ok || !payload?.ok) return null;
    return payload.draft || null;
  } catch (error) {
    console.warn("Could not load emergency preview draft", error);
    return null;
  }
}

function applyEmergencyDraftToProject(project, pageName, draft) {
  if (!project?.id || !pageName || !Array.isArray(draft?.blocks)) return project;
  return {
    ...project,
    pages: Array.isArray(project.pages) && project.pages.length ? project.pages : [{ name: pageName }],
    updatedAt: draft.savedAt || project.updatedAt || new Date().toISOString(),
    pageBlocks: {
      ...(project.pageBlocks || {}),
      [pageName]: draft.blocks,
    },
    pagesContent: {
      ...(project.pagesContent || {}),
      [pageName]: draft.html || project?.pagesContent?.[pageName] || "",
    },
    chaiData: {
      ...(project.chaiData || {}),
      [pageName]: draft.chaiData && typeof draft.chaiData === "object"
        ? draft.chaiData
        : { ...(project?.chaiData?.[pageName] || {}), blocks: draft.blocks },
    },
  };
}

function cachePreviewProjectSafely(project, options = {}) {
  void options;
  return project || null;
}

function isLegacyAiStarterProject(project) {
  if (!project || String(project?.mode || "").toLowerCase() !== "ai") return false;
  if (project?.brief?.aiStarterVersion) return false;
  if (project?.status === "saved") return false;
  if (project?.globalNavBlock || project?.globalFooterBlock) return false;

  const homePageName = Array.isArray(project?.pages) && project.pages.length
    ? project.pages[0]?.name || "Home"
    : "Home";
  const homeBlocks = Array.isArray(project?.pageBlocks?.[homePageName]) ? project.pageBlocks[homePageName] : [];
  if (!homeBlocks.length) return false;

  return String(homeBlocks[0]?.type || "") === "nav-bar";
}

export function ProjectPreviewPage() {
  const router = useRouter();
  const {
    id: routeProjectId,
    projectId: queryProjectId,
    page,
    viewport,
    previewToken,
    emergencyDraft,
  } = router.query;
  const id = String(routeProjectId || queryProjectId || "").trim();

  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [project, setProject] = useState(null);
  const [loadingDone, setLoadingDone] = useState(false);
  const [loadingIssue, setLoadingIssue] = useState(null);
  const [surfaceReady, setSurfaceReady] = useState(false);
  const loadStartedAtRef = useRef(0);
  const renderCommitStartedAtRef = useRef(0);
  const [retryCount, setRetryCount] = useState(0);
  const [assets, setAssets] = useState({ logo: null, images: [] });
  const projectSnapshotRef = useRef("");
  const assetSnapshotRef = useRef("");

  function syncStateIfChanged(nextProject, nextAssets, options = {}) {
    let nextProjectSnapshot = "";
    try {
      nextProjectSnapshot = nextProject ? JSON.stringify(nextProject) : "";
    } catch (error) {
      console.warn("[preview-ui] could not stringify project snapshot; applying state directly", error);
      projectSnapshotRef.current = "";
      setProject(nextProject || null);
      setSurfaceReady(false);
      if (nextProject) {
        console.log("[preview-ui] set preview data", {
          source: "fallback-no-snapshot-stringify",
          pageCount: Array.isArray(nextProject?.pages) ? nextProject.pages.length : 0,
          pageBlocksKeys: Object.keys(nextProject?.pageBlocks || {}),
        });
      }
    }
    const nextAssetSnapshot = nextAssets ? JSON.stringify(nextAssets) : "";

    if (nextAssetSnapshot !== assetSnapshotRef.current) {
      assetSnapshotRef.current = nextAssetSnapshot;
      setAssets(nextAssets || { logo: null, images: [] });
    }

    if (nextProjectSnapshot !== projectSnapshotRef.current && (nextProject || options.allowProjectClear)) {
      projectSnapshotRef.current = nextProjectSnapshot;
      setProject(nextProject || null);
      setSurfaceReady(false);
      if (nextProject) {
        const requestedPageName = resolveProjectPageName(nextProject, String(page || ""));
        const requestedBlocks = Array.isArray(nextProject?.pageBlocks?.[requestedPageName]) ? nextProject.pageBlocks[requestedPageName] : [];
        console.log("[preview-ui] set preview data", {
          requestedPageName,
          blockCount: requestedBlocks.length,
          blockTypes: requestedBlocks.slice(0, 30).map((block) => String(block?.type || "")),
        });
      }
    }
  }

  function logPreviewStage(stage, details = {}) {
    const startedAt = loadStartedAtRef.current || Date.now();
    const elapsedMs = Date.now() - startedAt;
    console.info(`[preview] ${stage}`, { elapsedMs, projectId: id, page: String(page || ""), ...details });
  }

  function syncAssetsIfChanged(nextAssets) {
    const nextAssetSnapshot = nextAssets ? JSON.stringify(nextAssets) : "";

    if (nextAssetSnapshot !== assetSnapshotRef.current) {
      assetSnapshotRef.current = nextAssetSnapshot;
      setAssets(nextAssets || { logo: null, images: [] });
    }
  }

  function refreshPreviewState(projectId = id) {
    const latestAssets = getWebsiteBuilderAssets();

    if (!projectId) {
      // id is not ready yet (router hasn't hydrated) — bail quietly without
      // wiping any project state that may already be loaded.
      return null;
    }

    const latestProject = getWebsiteProject(projectId);
    syncStateIfChanged(latestProject, latestAssets);
    return latestProject;
  }

  useEffect(() => {
    let subscription;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session || null);
      setAuthReady(true);
      ({
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_e, s) => {
        setSession(s || null);
        setAuthReady(true);
      }));
    })();

    return () => subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!id || !authReady) return;

    let cancelled = false;

    const loadPreviewProject = async () => {
      loadStartedAtRef.current = Date.now();
      setLoadingIssue(null);
      setSurfaceReady(false);
      logPreviewStage("load start", {
        previewTokenPresent: Boolean(previewToken),
        emergencyDraft: String(emergencyDraft || "") === "1",
        hasSessionToken: Boolean(session?.access_token),
      });
      logPreviewStage("token lookup start");
      const snapshotProject = readPreviewSnapshot(id, previewToken);
      const normalizedSnapshotProject = normalizePreviewProjectPayload(snapshotProject, String(page || ""));
      logPreviewStage("token lookup complete", { snapshotFound: Boolean(snapshotProject) });
      if (normalizedSnapshotProject) {
        console.log("[preview-ui] response received", {
          source: "preview-token-snapshot",
          keys: Object.keys(normalizedSnapshotProject || {}),
          pages: (normalizedSnapshotProject.pages || []).map((entry) => ({ name: entry?.name || "", slug: entry?.slug || "" })),
        });
      }
      let nextProject = normalizedSnapshotProject || null;
      if (normalizedSnapshotProject && !cancelled) {
        nextProject = normalizedSnapshotProject;
        syncStateIfChanged(normalizedSnapshotProject, getWebsiteBuilderAssets());
        setLoadingDone(true);
        console.log("[preview-ui] set loading false", { source: "preview-token-snapshot" });
        logPreviewStage("response complete", { source: "preview-token-snapshot" });
      }

      // Token previews are one-off snapshots opened directly from the builder.
      // Normal/reloaded previews must render the saved split file from the server,
      // not stale browser storage.
      if (!nextProject && previewToken) {
        logPreviewStage("local project lookup start", { reason: "token snapshot missing" });
        nextProject = refreshPreviewState(id);
        logPreviewStage("local project lookup complete", { found: Boolean(nextProject) });
      }

      if (String(emergencyDraft || "") === "1") {
        const baseProject = nextProject || getWebsiteProject(id) || {
          id,
          name: "Website Preview",
          pages: [{ name: String(page || "Home") }],
          pageBlocks: {},
          pagesContent: {},
          chaiData: {},
        };
        const draftPageName = resolveProjectPageName(baseProject, page || "") || String(page || "Home");
        const emergency = await fetchEmergencyPageDraft(id, draftPageName);
        if (emergency && !cancelled) {
          nextProject = normalizePreviewProjectPayload(
            applyEmergencyDraftToProject(baseProject, emergency.pageName || draftPageName, emergency),
            String(page || "")
          );
          syncStateIfChanged(nextProject, getWebsiteBuilderAssets());
          setLoadingDone(true);
          console.log("[preview-ui] set loading false", { source: "emergency-draft" });
          logPreviewStage("response complete", { source: "emergency-draft", pageName: draftPageName });
        }
      }

      if (nextProject && !cancelled) {
        // Project is in localStorage — show it immediately. The server fetch below
        // will run in the background and silently refresh if it finds a newer copy.
        setLoadingDone(true);
      }

      if (previewToken && nextProject) {
        return;
      }

      // Step 2: Fetch from server to pick up any published/server-only state.
      // Use the same merge strategy as syncProjectToServer in the builder tab:
      // always trust local pageBlocks/globalNav/globalFooter over the server copy.
      // The builder calls forceSaveBlockPage (localStorage write) before opening
      // this tab, so local blocks are guaranteed to be the freshest.  A queued
      // autosave can race the force-save and put a slightly older snapshot on the
      // server with an equal or newer timestamp; onlyIfNewer:true alone is not
      // sufficient in that case — prefer local blocks explicitly.
      if (session?.access_token) {
        logPreviewStage("project lookup start", { source: "server", requestUrl: "/api/website-builder/projects" });
        try {
          const remoteProject = await fetchWebsiteProjectFromServer(session, id, {
            pageName: page || "",
            timeoutMs: 10000,
          });
          const normalizedRemoteProject = normalizePreviewProjectPayload(remoteProject, String(page || ""));
          logPreviewStage("project lookup complete", {
            source: "server",
            found: Boolean(normalizedRemoteProject),
            pageCount: Array.isArray(normalizedRemoteProject?.pages) ? normalizedRemoteProject.pages.length : 0,
          });
          if (normalizedRemoteProject && !cancelled) {
            if (!previewToken && String(emergencyDraft || "") !== "1") {
              nextProject = normalizedRemoteProject;
              syncStateIfChanged(normalizedRemoteProject, getWebsiteBuilderAssets());
              setLoadingDone(true);
              console.log("[preview-ui] set loading false", { source: "server-project" });
              logPreviewStage("response complete", { source: "server-project" });
              return;
            }
            // Re-read local now that the async fetch has returned — another tab
            // or a queued sync may have updated localStorage since Step 1.
            const localNow = nextProject || getWebsiteProject(id);
            const localUpdatedAt = Date.parse(localNow?.updatedAt || localNow?.createdAt || 0) || 0;
            const remoteUpdatedAt = Date.parse(remoteProject?.updatedAt || remoteProject?.createdAt || 0) || 0;
            const remotePageName = resolveProjectPageName(normalizedRemoteProject, page || "");
            const localPageName = resolveProjectPageName(localNow, page || "") || remotePageName;
            const remotePageBlocks = remotePageName ? normalizedRemoteProject?.pageBlocks?.[remotePageName] : null;
            const hasLocalBlocks = localNow && Object.keys(localNow.pageBlocks || {}).length > 0;
            const shouldPreferRemoteRequestedPage = Array.isArray(remotePageBlocks)
              && (!previewToken || remoteUpdatedAt > localUpdatedAt);
            // Merge: keep server-side metadata (publish status, custom domain,
            // pinned blocks, etc.) while preserving genuinely newer local page content.
            const mergedForCache = hasLocalBlocks ? {
              ...normalizedRemoteProject,
              pageBlocks: {
                ...(localNow.pageBlocks || {}),
                ...(shouldPreferRemoteRequestedPage && localPageName ? { [localPageName]: remotePageBlocks } : {}),
              },
              pagesContent: {
                ...(localNow.pagesContent || {}),
                ...(shouldPreferRemoteRequestedPage && localPageName
                  ? { [localPageName]: normalizedRemoteProject?.pagesContent?.[remotePageName] || "" }
                  : {}),
              },
              chaiData: {
                ...(localNow.chaiData || {}),
                ...(shouldPreferRemoteRequestedPage && localPageName && normalizedRemoteProject?.chaiData?.[remotePageName]
                  ? { [localPageName]: normalizedRemoteProject.chaiData[remotePageName] }
                  : {}),
              },
              ...("globalNavBlock" in Object(localNow) ? { globalNavBlock: localNow.globalNavBlock } : {}),
              ...("globalFooterBlock" in Object(localNow) ? { globalFooterBlock: localNow.globalFooterBlock } : {}),
            } : normalizedRemoteProject;
            const cached = cachePreviewProjectSafely(mergedForCache, { onlyIfNewer: false });
            // Only update nextProject if cacheWebsiteProject returned something —
            // never overwrite a good local project with a null result.
            if (cached) {
              nextProject = cached;
              syncStateIfChanged(nextProject, getWebsiteBuilderAssets());
            }
          }
        } catch (error) {
          logPreviewStage("project lookup failed", {
            source: "server",
            message: error?.message || "Unknown server lookup error",
          });
          console.warn("Could not load preview draft from the server", error);
        }
      }

      // Step 3: Finish loading.
      // IMPORTANT: if there's still no project AND no session token (auth hasn't
      // restored yet), do NOT mark loading as done — the effect will re-run once
      // session?.access_token arrives and will load the project from the server then.
      if (!cancelled) {
        if (!nextProject) {
          if (!session?.access_token) {
            logPreviewStage("project lookup skipped", { reason: "no-session-token" });
          }

          // Retry up to 3 times (800 ms apart) before giving up. This covers
          // transient server errors, token refresh races, and the edge case where
          // the builder tab is still flushing to localStorage when the preview tab
          // first runs its effect.
          for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 800));
            if (cancelled) return;

            // Re-check localStorage
            const retryLocal = refreshPreviewState(id);
            if (retryLocal) { nextProject = retryLocal; break; }

            // Fallback: backup storage (written before server overwrites)
            const backup = restoreWebsiteProjectFromBackup(id);
            if (backup) {
              const cached = cachePreviewProjectSafely(backup, { onlyIfNewer: false });
              if (cached) {
                nextProject = cached;
                syncStateIfChanged(nextProject, getWebsiteBuilderAssets());
                break;
              }
            }

            // Re-try server fetch
            try {
              if (!session?.access_token) continue;
              const retryRemote = await fetchWebsiteProjectFromServer(session, id, {
                pageName: page || "",
                timeoutMs: 10000,
              });
                const normalizedRetryRemote = normalizePreviewProjectPayload(retryRemote, String(page || ""));
                if (normalizedRetryRemote && !cancelled) {
                  const cached = cachePreviewProjectSafely(normalizedRetryRemote, { onlyIfNewer: false });
                if (cached) {
                  nextProject = cached;
                  syncStateIfChanged(nextProject, getWebsiteBuilderAssets());
                  break;
                }
              }
            } catch {
              // continue to next retry
            }
          }

          if (!nextProject && !cancelled) {
            const failedRequestUrl = `/api/website-builder/projects?projectId=${encodeURIComponent(String(id || ""))}&page=${encodeURIComponent(String(page || ""))}`;
            if (!session?.access_token) {
              setLoadingIssue(createPreviewFailure("auth", {
                status: "NO_SESSION",
                requestUrl: failedRequestUrl,
                message: "Preview token snapshot was not found and no authenticated session is available to load the saved project.",
                details: {
                  previewTokenPresent: Boolean(previewToken),
                  snapshotExpectedKey: `${PREVIEW_SNAPSHOT_STORAGE_PREFIX}${id}:${String(previewToken || "")}`,
                },
              }));
            } else {
              setLoadingIssue(createPreviewFailure("project-lookup", {
                status: "NOT_FOUND",
                requestUrl: failedRequestUrl,
                message: "The preview project could not be loaded from storage or server after retries.",
              }));
            }
            syncStateIfChanged(null, getWebsiteBuilderAssets(), { allowProjectClear: true });
          }
        }
        if (nextProject) {
          const resolvedPageName = resolveProjectPageName(nextProject, page || "");
          const resolvedBlocks = Array.isArray(nextProject?.pageBlocks?.[resolvedPageName]) ? nextProject.pageBlocks[resolvedPageName] : [];
          logPreviewStage("page lookup complete", {
            pageName: resolvedPageName,
            blocks: resolvedBlocks.length,
          });
          logPreviewStage("blocks parsed", { count: resolvedBlocks.length });
          logPreviewStage("asset resolution complete", {
            imageCount: Array.isArray(getWebsiteBuilderAssets()?.images) ? getWebsiteBuilderAssets().images.length : 0,
          });
        }
        if (!cancelled) setLoadingDone(true);
        if (!cancelled) console.log("[preview-ui] set loading false", { source: "finalize" });
      }
    };

    loadPreviewProject();

    return () => {
      cancelled = true;
    };
  }, [id, authReady, session?.access_token, retryCount, previewToken, page, emergencyDraft]);

  useEffect(() => {
    if (!project || loadingIssue || surfaceReady) return undefined;
    renderCommitStartedAtRef.current = Date.now();
    const timer = window.setTimeout(() => {
      setLoadingIssue((current) => current || createPreviewFailure("render-commit", {
        status: "RENDER_NOT_COMMITTED",
        message: "Preview data loaded but the preview UI did not commit in time.",
        requestUrl: String(router.asPath || ""),
        details: {
          elapsedMs: Date.now() - (renderCommitStartedAtRef.current || Date.now()),
          pageSlug: String(page || ""),
          blockCount: (() => {
            const activePageName = resolveProjectPageName(project, String(page || ""));
            return Array.isArray(project?.pageBlocks?.[activePageName]) ? project.pageBlocks[activePageName].length : 0;
          })(),
        },
      }));
      console.error("[preview-ui] render commit timeout", {
        elapsedMs: Date.now() - (renderCommitStartedAtRef.current || Date.now()),
      });
    }, PREVIEW_RENDER_COMMIT_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [project, loadingIssue, surfaceReady, router.asPath, page]);

  useEffect(() => {
    console.log("[preview-ui] render state", {
      loadingDone,
      hasProject: Boolean(project),
      hasLoadingIssue: Boolean(loadingIssue),
      surfaceReady,
      authReady,
      hasSessionToken: Boolean(session?.access_token),
      previewTokenPresent: Boolean(previewToken),
      page: String(page || ""),
      viewport: String(viewport || "desktop"),
    });
  }, [loadingDone, project, loadingIssue, surfaceReady, authReady, session?.access_token, previewToken, page, viewport]);

  useEffect(() => {
    if (loadingDone || project) return undefined;
    const timer = window.setTimeout(() => {
      setLoadingIssue((current) => current || createPreviewFailure("timeout", {
        status: "TIMEOUT",
        requestUrl: `/api/website-builder/projects?projectId=${encodeURIComponent(String(id || ""))}&page=${encodeURIComponent(String(page || ""))}`,
        message: `Preview data did not resolve within ${PREVIEW_LOAD_TIMEOUT_MS / 1000}s.`,
      }));
      setLoadingDone(true);
      logPreviewStage("load timeout", { timeoutMs: PREVIEW_LOAD_TIMEOUT_MS });
    }, PREVIEW_LOAD_TIMEOUT_MS);

    return () => window.clearTimeout(timer);
  }, [loadingDone, project, id, page]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const hasPreviewSnapshot = !!previewToken;

    const syncFromStorage = () => {
      if (hasPreviewSnapshot) return;
      refreshPreviewState(id);
    };

    const handleStorage = (event) => {
      if (event.key && !["gr8:website-projects:v1", "gr8:website-builder-assets:v1"].includes(event.key)) return;
      syncFromStorage();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") syncFromStorage();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", syncFromStorage);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", syncFromStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [id, previewToken]);

  useEffect(() => {
    if (!session?.user?.id) return undefined;

    let cancelled = false;

    const syncSharedAssets = async () => {
      const mergedAssets = await syncWebsiteBuilderSharedAssetCache({
        supabase,
        userId: session.user.id,
        currentAssets: getWebsiteBuilderAssets(),
      });

      if (!cancelled) {
        syncAssetsIfChanged(mergedAssets);
      }
    };

    syncSharedAssets().catch((error) => {
      console.warn("Could not sync preview assets from shared media library", error);
    });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!project?.id || !isLegacyAiStarterProject(project)) return undefined;
    console.warn("Preview is read-only; skipped legacy AI project upgrade.");
    return undefined;
  }, [project?.id]);

  const active = useMemo(() => {
    if (!project?.pages?.length) return null;
    const requested = String(page || "");
    return resolveProjectPageEntry(project, requested);
  }, [project, page]);
  const requestedPageEntry = useMemo(() => {
    if (!project?.pages?.length || !String(page || "").trim()) return null;
    return resolveRequestedProjectPage(project, String(page || ""));
  }, [project, page]);
  const previewViewport = ["mobile", "tablet", "desktop"].includes(String(viewport || "").toLowerCase())
    ? String(viewport).toLowerCase()
    : "desktop";

  const navigationContext = useMemo(() => {
    if (!project?.id || !project?.pages?.length) return null;

    const pageMap = project.pages.reduce((acc, entry) => {
      const key = savedProjectPageSlug(project, entry);
      if (!key) return acc;
      acc[key] = buildWebsitePreviewUrl({
        projectId: project.id,
        pageSlug: key,
        viewport: previewViewport,
      });
      return acc;
    }, {});

    return {
      basePath: buildWebsitePreviewUrl({ projectId: project.id, viewport: previewViewport }),
      currentPageKey: savedProjectPageSlug(project, active) || canonicalPreviewPageSlug(active?.id || active?.name || page || "home"),
      pageMap,
    };
  }, [project, active, page, previewViewport]);

  const pageBlocks = active?.name ? (project?.pageBlocks || {})[active.name] || [] : [];
  const pageContent = active?.name ? (project?.pagesContent || {})[active.name] || "" : "";

  const globalNavBlock = project?.globalNavBlock?.type === "nav-bar" ? project.globalNavBlock : null;
  const globalFooterBlock = project?.globalFooterBlock?.type === "footer" ? project.globalFooterBlock : null;

  // Only inject global nav if this page doesn't already contain that exact block (by id)
  const injectNav = globalNavBlock && !pageBlocks.some((b) => b.id && b.id === globalNavBlock.id);

  // Only strip existing nav-bar blocks when we ARE replacing them with the global one
  const blocksWithoutNav = injectNav
    ? pageBlocks.filter((b) => b.type !== "nav-bar")
    : pageBlocks;

  const injectFooter = !!globalFooterBlock;
  const blocksWithoutShellDuplicates = injectFooter
    ? blocksWithoutNav.filter((b) => b.type !== "footer")
    : blocksWithoutNav;
  const shellBlocks = [
    globalNavBlock,
    ...blocksWithoutShellDuplicates,
    globalFooterBlock,
  ].filter(Boolean);
  const layoutWidth = pickLayoutWidth(shellBlocks, 1500);
  const pageBackground = pickPageBackground(shellBlocks, "#ffffff");
  const compactPreview = previewViewport === "mobile";
  const previewShellWidth = previewViewport === "mobile"
    ? 430
    : previewViewport === "tablet"
      ? Math.min(920, layoutWidth)
      : layoutWidth;

  if (project && String(page || "").trim() && !requestedPageEntry) {
    const requestedPageSlug = canonicalPreviewPageSlug(String(page || ""));
    return (
      <main style={styles.page("#0f172a")}>
        <div style={{ ...styles.wrap, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 20, textAlign: "center" }}>
          <h1 style={{ ...styles.h1, color: "#f8fafc", fontSize: 24, paddingTop: 0 }}>Preview page not found</h1>
          <p style={{ color: "#94a3b8", fontSize: 16, margin: 0, maxWidth: 520, lineHeight: 1.6 }}>
            The requested page slug could not be resolved in this project.
          </p>
          {process.env.NODE_ENV !== "production" ? (
            <pre style={{
              width: "min(860px, 100%)",
              margin: 0,
              padding: 12,
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.35)",
              background: "rgba(2,6,23,0.7)",
              color: "#cbd5e1",
              textAlign: "left",
              fontSize: 13,
              lineHeight: 1.45,
              whiteSpace: "pre-wrap",
            }}>{JSON.stringify({
              diagnostic: "website-preview-page-not-found",
              route: String(router.asPath || ""),
              projectId: id,
              requestedPage: String(page || ""),
              requestedPageSlug,
              availablePages: (Array.isArray(project?.pages) ? project.pages : []).map((entry) => ({
                id: entry?.id || "",
                name: entry?.name || "",
                slug: savedProjectPageSlug(project, entry) || "",
              })),
            }, null, 2)}</pre>
          ) : null}
        </div>
      </main>
    );
  }

  if (!project) {
    if (!loadingDone && !loadingIssue) return <SiteLoader />;
    const builderUrl = id
      ? `/modules/website-builder/visual-builder?projectId=${encodeURIComponent(String(id))}`
      : "/modules/website-builder";
    const localProject = id ? getWebsiteProject(id) : null;
    const hasSnapshot = id && previewToken ? Boolean(readPreviewSnapshot(id, previewToken)) : false;
    return (
      <main style={styles.page("#0f172a")}>
        <div style={{ ...styles.wrap, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 20, textAlign: "center" }}>
          <div style={{ fontSize: 48, lineHeight: 1 }}>??</div>
          <h1 style={{ ...styles.h1, color: "#f8fafc", fontSize: 24, paddingTop: 0 }}>{loadingIssue?.title || "Project not found"}</h1>
          <p style={{ color: "#94a3b8", fontSize: 16, margin: 0, maxWidth: 380, lineHeight: 1.6 }}>
            {loadingIssue?.message || "This project could not be loaded. It may have been deleted, or there may be a temporary connection issue."}
          </p>
          {process.env.NODE_ENV !== "production" ? (
            <pre style={{
              width: "min(860px, 100%)",
              margin: 0,
              padding: 12,
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.35)",
              background: "rgba(2,6,23,0.7)",
              color: "#cbd5e1",
              textAlign: "left",
              fontSize: 13,
              lineHeight: 1.45,
              whiteSpace: "pre-wrap",
            }}>{JSON.stringify({
              diagnostic: "website-preview-project-not-found",
              route: String(router.asPath || ""),
              projectId: id,
              requestedPage: String(page || ""),
              requestedPageSlug: canonicalPreviewPageSlug(page || ""),
              previewTokenPresent: Boolean(previewToken),
              previewSnapshotFound: hasSnapshot,
              loadingIssue,
              localProjectFound: Boolean(localProject),
              emergencyDraft: String(emergencyDraft || "") === "1",
            }, null, 2)}</pre>
          ) : null}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
            <button
              type="button"
              onClick={() => { setLoadingDone(false); setRetryCount((n) => n + 1); }}
              style={{ padding: "10px 20px", borderRadius: 8, background: "#6366f1", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer", fontSize: 16 }}
            >
              Try Again
            </button>
            <a
              href={builderUrl}
              style={{ padding: "10px 20px", borderRadius: 8, background: "transparent", color: "#94a3b8", border: "1px solid rgba(148,163,184,0.3)", fontWeight: 600, textDecoration: "none", fontSize: 16 }}
            >
              Back to Builder
            </a>
          </div>
        </div>
      </main>
    );
  }

  if (loadingIssue?.stage === "render-commit") {
    return (
      <main style={styles.page("#0f172a")}>
        <div style={{ ...styles.wrap, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 20, textAlign: "center" }}>
          <div style={{ fontSize: 48, lineHeight: 1 }}>??</div>
          <h1 style={{ ...styles.h1, color: "#f8fafc", fontSize: 24, paddingTop: 0 }}>{loadingIssue?.title || "Preview failed to load"}</h1>
          <p style={{ color: "#94a3b8", fontSize: 16, margin: 0, maxWidth: 520, lineHeight: 1.6 }}>{loadingIssue?.message}</p>
          {process.env.NODE_ENV !== "production" ? (
            <pre style={{
              width: "min(860px, 100%)",
              margin: 0,
              padding: 12,
              borderRadius: 10,
              border: "1px solid rgba(148,163,184,0.35)",
              background: "rgba(2,6,23,0.7)",
              color: "#cbd5e1",
              textAlign: "left",
              fontSize: 13,
              lineHeight: 1.45,
              whiteSpace: "pre-wrap",
            }}>{JSON.stringify({
              diagnostic: "website-preview-render-not-committed",
              loadingIssue,
              route: String(router.asPath || ""),
            }, null, 2)}</pre>
          ) : null}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
            <button
              type="button"
              onClick={() => { setLoadingIssue(null); setSurfaceReady(false); setRetryCount((n) => n + 1); }}
              style={{ padding: "10px 20px", borderRadius: 8, background: "#6366f1", color: "#fff", border: "none", fontWeight: 600, cursor: "pointer", fontSize: 16 }}
            >
              Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }

  console.log("[preview-ui] blocks", {
    pageSlug: canonicalPreviewPageSlug(String(page || "")),
    pageName: active?.name || "",
    blockCount: Array.isArray(pageBlocks) ? pageBlocks.length : 0,
    blockTypes: Array.isArray(pageBlocks) ? pageBlocks.slice(0, 30).map((block) => String(block?.type || "")) : [],
  });

  return (
    <WebsitePreviewSurface
      project={project}
      page={page}
      viewport={viewport}
      assets={assets}
      onSurfaceReady={(details = {}) => {
        setSurfaceReady(true);
        console.log("[preview-ui] render complete", details);
      }}
    />
  );
}

export default ProjectPreviewPage;

const styles = {
  page: (background) => ({
    minHeight: "100vh",
    background,
    color: "#0f172a",
    fontFamily: "'Manrope','Segoe UI',system-ui,-apple-system,sans-serif",
    paddingBottom: 56,
  }),
  wrap: { maxWidth: 1220, margin: "0 auto", padding: "0 24px" },
  wrapWide: { maxWidth: 1320, margin: "0 auto", padding: "0 24px" },
  h1: { margin: 0, paddingTop: 32, fontSize: 28 },
  utilityBar: {
    position: "fixed",
    top: 14,
    right: 14,
    display: "flex",
    gap: 8,
    zIndex: 240,
    background: "rgba(15,23,42,0.82)",
    border: "1px solid rgba(148,163,184,0.4)",
    borderRadius: 12,
    padding: 8,
    backdropFilter: "blur(8px)",
  },
  utilityStatus: {
    borderRadius: 8,
    background: "rgba(30,41,59,0.9)",
    color: "#e2e8f0",
    padding: "7px 10px",
    fontSize: 16,
    letterSpacing: "0.08em",
    fontWeight: 600,
    alignSelf: "center",
  },
  backBtn: {
    border: "1px solid rgba(203,213,225,0.55)",
    borderRadius: 8,
    background: "#fff",
    color: "#1e293b",
    padding: "8px 12px",
    textDecoration: "none",
    fontWeight: 600,
  },
  siteHeader: {
    paddingTop: 70,
    paddingBottom: 14,
  },
  previewStack: {
    width: "100%",
    maxWidth: "100%",
    margin: 0,
    padding: 0,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 0,
  },
  previewViewport: (viewport, previewShellWidth) => ({
    ...styles.previewStack,
    width: viewport === "desktop" ? "100vw" : `min(100%, ${previewShellWidth}px)`,
    maxWidth: viewport === "desktop" ? "100vw" : `min(100%, ${previewShellWidth}px)`,
    margin: viewport === "desktop" ? 0 : "0 auto",
    marginLeft: viewport === "desktop" ? "calc(50% - 50vw)" : undefined,
    marginRight: viewport === "desktop" ? "calc(50% - 50vw)" : undefined,
    overflowX: "clip",
  }),
  brandRow: {
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "linear-gradient(135deg,#0f172a,#111827)",
    padding: "14px 18px",
    display: "flex",
    gap: 14,
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    boxShadow: "0 18px 40px rgba(2,6,23,0.22)",
  },
  brandMark: {
    margin: 0,
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: 600,
    letterSpacing: "-0.02em",
  },
  nav: { display: "flex", gap: 8, flexWrap: "wrap" },
  navLink: {
    color: "#cbd5e1",
    textDecoration: "none",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.28)",
    fontWeight: 600,
    fontSize: 16,
  },
  navLinkActive: {
    background: "#ffffff",
    color: "#0f172a",
  },
  content: { width: "100%", padding: "0 0 40px" },
  blockStack: { display: "grid", gap: 24 },
  emptyNotice: {
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#475569",
    padding: "16px 18px",
    fontSize: 16,
    fontWeight: 600,
  },
};
