import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";

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
import { syncWebsiteBuilderSharedAssetCache } from "../../../../../lib/website-builder/mediaAssets";
import { fetchWebsiteProjectFromServer } from "../../../../../lib/website-builder/remoteProjects";
import { supabase } from "../../../../../lib/supabaseClient";

const WebsitePreviewSurface = dynamic(() => import("../../../../../components/website-builder/WebsitePreviewSurface"), {
  ssr: false,
  loading: () => <SiteLoader />,
});

const PREVIEW_SNAPSHOT_STORAGE_PREFIX = "gr8:website-preview-snapshot:";

function slugify(v) {
  return String(v || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function resolveProjectPageName(project, pageKey = "") {
  const requested = slugify(pageKey || project?.pages?.[0]?.name || "Home");
  return (Array.isArray(project?.pages) ? project.pages : []).find((entry) => (
    slugify(entry?.name) === requested || slugify(entry?.slug) === requested
  ))?.name || "";
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

export default function ProjectPreviewPage() {
  const router = useRouter();
  const { id, page, viewport, previewToken, emergencyDraft } = router.query;

  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [project, setProject] = useState(null);
  const [loadingDone, setLoadingDone] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [assets, setAssets] = useState({ logo: null, images: [] });
  const projectSnapshotRef = useRef("");
  const assetSnapshotRef = useRef("");

  function syncStateIfChanged(nextProject, nextAssets, options = {}) {
    const nextProjectSnapshot = nextProject ? JSON.stringify(nextProject) : "";
    const nextAssetSnapshot = nextAssets ? JSON.stringify(nextAssets) : "";

    if (nextAssetSnapshot !== assetSnapshotRef.current) {
      assetSnapshotRef.current = nextAssetSnapshot;
      setAssets(nextAssets || { logo: null, images: [] });
    }

    if (nextProjectSnapshot !== projectSnapshotRef.current && (nextProject || options.allowProjectClear)) {
      projectSnapshotRef.current = nextProjectSnapshot;
      setProject(nextProject || null);
    }
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
      const snapshotProject = readPreviewSnapshot(id, previewToken);
      let nextProject = snapshotProject || null;
      if (snapshotProject && !cancelled) {
        nextProject = snapshotProject;
        syncStateIfChanged(snapshotProject, getWebsiteBuilderAssets());
        setLoadingDone(true);
      }

      // Token previews are one-off snapshots opened directly from the builder.
      // Normal/reloaded previews must render the saved split file from the server,
      // not stale browser storage.
      if (!nextProject && previewToken) {
        nextProject = refreshPreviewState(id);
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
          nextProject = applyEmergencyDraftToProject(baseProject, emergency.pageName || draftPageName, emergency);
          syncStateIfChanged(nextProject, getWebsiteBuilderAssets());
          setLoadingDone(true);
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
        try {
          const remoteProject = await fetchWebsiteProjectFromServer(session, id, { pageName: page || "" });
          if (remoteProject && !cancelled) {
            if (!previewToken && String(emergencyDraft || "") !== "1") {
              nextProject = remoteProject;
              syncStateIfChanged(remoteProject, getWebsiteBuilderAssets());
              setLoadingDone(true);
              return;
            }
            // Re-read local now that the async fetch has returned — another tab
            // or a queued sync may have updated localStorage since Step 1.
            const localNow = nextProject || getWebsiteProject(id);
            const localUpdatedAt = Date.parse(localNow?.updatedAt || localNow?.createdAt || 0) || 0;
            const remoteUpdatedAt = Date.parse(remoteProject?.updatedAt || remoteProject?.createdAt || 0) || 0;
            const remotePageName = resolveProjectPageName(remoteProject, page || "");
            const localPageName = resolveProjectPageName(localNow, page || "") || remotePageName;
            const remotePageBlocks = remotePageName ? remoteProject?.pageBlocks?.[remotePageName] : null;
            const hasLocalBlocks = localNow && Object.keys(localNow.pageBlocks || {}).length > 0;
            const shouldPreferRemoteRequestedPage = Array.isArray(remotePageBlocks)
              && (!previewToken || remoteUpdatedAt > localUpdatedAt);
            // Merge: keep server-side metadata (publish status, custom domain,
            // pinned blocks, etc.) while preserving genuinely newer local page content.
            const mergedForCache = hasLocalBlocks ? {
              ...remoteProject,
              pageBlocks: {
                ...(localNow.pageBlocks || {}),
                ...(shouldPreferRemoteRequestedPage && localPageName ? { [localPageName]: remotePageBlocks } : {}),
              },
              pagesContent: {
                ...(localNow.pagesContent || {}),
                ...(shouldPreferRemoteRequestedPage && localPageName
                  ? { [localPageName]: remoteProject?.pagesContent?.[remotePageName] || "" }
                  : {}),
              },
              chaiData: {
                ...(localNow.chaiData || {}),
                ...(shouldPreferRemoteRequestedPage && localPageName && remoteProject?.chaiData?.[remotePageName]
                  ? { [localPageName]: remoteProject.chaiData[remotePageName] }
                  : {}),
              },
              ...("globalNavBlock" in Object(localNow) ? { globalNavBlock: localNow.globalNavBlock } : {}),
              ...("globalFooterBlock" in Object(localNow) ? { globalFooterBlock: localNow.globalFooterBlock } : {}),
            } : remoteProject;
            const cached = cachePreviewProjectSafely(mergedForCache, { onlyIfNewer: false });
            // Only update nextProject if cacheWebsiteProject returned something —
            // never overwrite a good local project with a null result.
            if (cached) {
              nextProject = cached;
              syncStateIfChanged(nextProject, getWebsiteBuilderAssets());
            }
          }
        } catch (error) {
          console.warn("Could not load preview draft from the server", error);
        }
      }

      // Step 3: Finish loading.
      // IMPORTANT: if there's still no project AND no session token (auth hasn't
      // restored yet), do NOT mark loading as done — the effect will re-run once
      // session?.access_token arrives and will load the project from the server then.
      if (!cancelled) {
        if (!nextProject) {
          if (!session?.access_token) return; // wait for auth to restore, then re-run

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
              const retryRemote = await fetchWebsiteProjectFromServer(session, id, { pageName: page || "" });
              if (retryRemote && !cancelled) {
                const cached = cachePreviewProjectSafely(retryRemote, { onlyIfNewer: false });
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
            syncStateIfChanged(null, getWebsiteBuilderAssets(), { allowProjectClear: true });
          }
        }
        if (!cancelled) setLoadingDone(true);
      }
    };

    loadPreviewProject();

    return () => {
      cancelled = true;
    };
  }, [id, authReady, session?.access_token, retryCount, previewToken, page, emergencyDraft]);

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
    return project.pages.find((p) => slugify(p.name) === requested) || project.pages[0];
  }, [project, page]);
  const previewViewport = ["mobile", "tablet", "desktop"].includes(String(viewport || "").toLowerCase())
    ? String(viewport).toLowerCase()
    : "desktop";

  const navigationContext = useMemo(() => {
    if (!project?.id || !project?.pages?.length) return null;

    const pageMap = project.pages.reduce((acc, entry) => {
      const key = slugify(entry?.name || "");
      if (!key) return acc;
      acc[key] = `/modules/website-builder/project/${project.id}/preview?page=${encodeURIComponent(key)}&viewport=${encodeURIComponent(previewViewport)}`;
      return acc;
    }, {});

    return {
      basePath: `/modules/website-builder/project/${project.id}/preview?viewport=${encodeURIComponent(previewViewport)}`,
      currentPageKey: slugify(active?.name || page || "home"),
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

  if (!project) {
    if (!loadingDone) return <SiteLoader />;
    const builderUrl = id
      ? `/modules/website-builder/visual-builder?projectId=${encodeURIComponent(String(id))}`
      : "/modules/website-builder";
    return (
      <main style={styles.page("#0f172a")}>
        <div style={{ ...styles.wrap, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 20, textAlign: "center" }}>
          <div style={{ fontSize: 48, lineHeight: 1 }}>??</div>
          <h1 style={{ ...styles.h1, color: "#f8fafc", fontSize: 24, paddingTop: 0 }}>Project not found</h1>
          <p style={{ color: "#94a3b8", fontSize: 16, margin: 0, maxWidth: 380, lineHeight: 1.6 }}>
            This project could not be loaded. It may have been deleted, or there may be a temporary connection issue.
          </p>
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

  return <WebsitePreviewSurface project={project} page={page} viewport={viewport} assets={assets} />;
}

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
