import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import PageBuilderCanvas from "../../../components/website-builder/PageBuilderCanvas";
import {
  applyAssetToProps,
  createStoredAsset,
  mergeWebsiteBuilderAssetSources,
  normalizeSelectedAsset,
  syncWebsiteBuilderSharedAssetCache,
  uploadSharedMediaLibraryAsset,
} from "../../../lib/website-builder/mediaAssets";
import { applyChaiThemePreset, buildStarterChaiData, renderChaiHtml } from "../../../lib/website-builder/chaiStudio";
import { supabase } from "../../../lib/supabaseClient";
import { buildDefaultSiteDomain, buildHostedWebsiteUrl, buildWebsitePath, buildWebsiteUrl, getSiteRootDomain, normalizeDomain } from "../../../lib/website-builder/publishConfig";
import {
  cacheWebsiteProject,
  createWebsiteProject,
  deleteWebsiteTemplateOverride,
  getWebsiteBuilderAssets,
  getWebsiteProject,
  saveWebsiteBuilderAssets,
  updateWebsiteTemplateOverride,
  updateWebsiteProject,
} from "../../../lib/website-builder/projectStore";
import { fetchWebsiteProjectFromServer, saveWebsiteProjectToServer } from "../../../lib/website-builder/remoteProjects";

// ─── Studio Loader ────────────────────────────────────────────────────────────
const STUDIO_MESSAGES = [
  "Loading workspace…",
  "Assembling blocks…",
  "Fetching project…",
  "Preparing canvas…",
  "Almost ready…",
];

function StudioLoader({ label }) {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    if (label) return undefined;
    const t = setInterval(() => setMsgIdx(i => (i + 1) % STUDIO_MESSAGES.length), 2200);
    return () => clearInterval(t);
  }, [label]);

  const r = 38;
  const circ = 2 * Math.PI * r;
  const arcLen = circ * 0.72;

  return (
    <>
      <style>{`
        @keyframes wb-spin{to{transform:rotate(360deg)}}
        @keyframes wb-pulse{0%,100%{opacity:.18;transform:scale(.8);}50%{opacity:.6;transform:scale(1.1);}}
        @keyframes wb-msg{0%,100%{opacity:0;transform:translateY(9px);}18%,82%{opacity:1;transform:translateY(0);}}
        @keyframes wb-dot{0%,100%{opacity:.2;}50%{opacity:1;}}
        @keyframes wb-comet{0%{opacity:0;transform:rotate(-90deg) translateX(${r}px) scale(0);}30%{opacity:1;}100%{opacity:0;transform:rotate(160deg) translateX(${r}px) scale(1);}}
      `}</style>
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#05070f", padding: 24, fontFamily: "system-ui,sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
          {/* Wordmark */}
          <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,.28)", fontWeight: 700 }}>
            🌐&nbsp; GR8 Website Studio
          </div>

          {/* Ring + glow orb */}
          <div style={{ position: "relative", width: 108, height: 108, display: "grid", placeItems: "center" }}>
            {/* Pulsing glow */}
            <div style={{
              position: "absolute", width: 76, height: 76, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(14,165,233,.28) 0%, transparent 72%)",
              animation: "wb-pulse 2.6s ease-in-out infinite",
            }} />
            {/* Spinning arc SVG */}
            <svg width="108" height="108" viewBox="0 0 108 108"
              style={{ position: "absolute", animation: "wb-spin 1.8s linear infinite" }}>
              <defs>
                <linearGradient id="wb-arc-g" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0ea5e9" />
                  <stop offset="60%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Track */}
              <circle cx="54" cy="54" r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="4.5" />
              {/* Arc */}
              <circle cx="54" cy="54" r={r} fill="none" stroke="url(#wb-arc-g)" strokeWidth="4.5"
                strokeLinecap="round"
                strokeDasharray={`${arcLen.toFixed(1)} ${(circ - arcLen).toFixed(1)}`}
                transform="rotate(-90 54 54)"
              />
              {/* Leading dot */}
              <circle cx={54 + r} cy="54" r="4" fill="#0ea5e9"
                style={{ filter: "drop-shadow(0 0 6px #0ea5e9)" }} />
            </svg>
            {/* Centre jewel */}
            <div style={{
              position: "relative", width: 14, height: 14, borderRadius: "50%",
              background: "linear-gradient(135deg,#0ea5e9,#8b5cf6)",
              boxShadow: "0 0 20px rgba(14,165,233,.8), 0 0 6px rgba(14,165,233,.5)",
            }} />
          </div>

          {/* Cycling message */}
          <div style={{ height: 26, overflow: "hidden", position: "relative", minWidth: 220, textAlign: "center" }}>
            <span key={msgIdx} style={{
              display: "block", fontSize: 15, fontWeight: 600,
              color: "rgba(255,255,255,.75)",
              animation: "wb-msg 2.2s ease both",
            }}>
              {label || STUDIO_MESSAGES[msgIdx]}
            </span>
          </div>

          {/* Breathing dots */}
          <div style={{ display: "flex", gap: 7 }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                display: "block", width: 6, height: 6, borderRadius: "50%",
                background: i === 1 ? "rgba(99,102,241,.75)" : "rgba(14,165,233,.6)",
                animation: `wb-dot 1.5s ease-in-out ${i * 0.3}s infinite`,
              }} />
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function sanitizeSlugInput(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-{2,}/g, "-");
}

function sanitizeDomainInput(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/^https?:\/\//, "");
}

function isLegacyAiStarterProject(project) {
  if (!project || String(project?.mode || "").toLowerCase() !== "ai") return false;
  if (project?.globalNavBlock || project?.globalFooterBlock) return false;

  const homePageName = Array.isArray(project?.pages) && project.pages.length
    ? project.pages[0]?.name || "Home"
    : "Home";
  const homeBlocks = Array.isArray(project?.pageBlocks?.[homePageName]) ? project.pageBlocks[homePageName] : [];
  if (!homeBlocks.length) return false;

  return String(homeBlocks[0]?.type || "") === "nav-bar";
}

export default function VisualBuilderPage() {
  const router = useRouter();
  const { id: _idParam, projectId: _projectIdParam, page, name, mode, type, template, forceReload } = router.query;
  const projectId = _idParam || _projectIdParam;
  const [project, setProject] = useState(null);
  const [missingProjectId, setMissingProjectId] = useState("");
  const [activePage, setActivePage] = useState("Home");
  const [newPageName, setNewPageName] = useState("");
  const [renamingPage, setRenamingPage] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState("info");
  const [noticeDuration, setNoticeDuration] = useState(2400);
  const [brandAssets, setBrandAssets] = useState({ logo: null, images: [] });
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const authTimeoutRef = useRef(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [showSetupPanel, setShowSetupPanel] = useState(false);
  const [siteSlug, setSiteSlug] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [blockDefaults, setBlockDefaults] = useState({});
  const previewActionsRef = useRef(null);
  const syncInFlightRef = useRef(false);
  const syncQueuedRef = useRef(null); // holds latest project pending sync
  const syncTimerRef = useRef(null);  // timer for queued sync
  const lastSyncAtRef = useRef(0);    // timestamp of last completed sync

  useEffect(() => {
    setBrandAssets(getWebsiteBuilderAssets());
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return undefined;

    let cancelled = false;

    const syncSharedAssets = async () => {
      const mergedAssets = await syncWebsiteBuilderSharedAssetCache({
        supabase,
        userId: session.user.id,
        currentAssets: getWebsiteBuilderAssets(),
      });

      if (cancelled) return;
      saveWebsiteBuilderAssets(mergedAssets);
      setBrandAssets(mergedAssets);
    };

    syncSharedAssets().catch((error) => {
      console.warn("Could not sync shared website builder assets", error);
    });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    let subscription;
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data?.session || null);
      setAuthReady(true);

      // If there's no session after the initial check, start a short grace period
      // for Supabase to refresh the token. If no token arrives, redirect to login.
      if (!data?.session) {
        authTimeoutRef.current = setTimeout(() => {
          authTimeoutRef.current = null;
          // Still no session — redirect to login
          router.replace(`/login?next=${encodeURIComponent(router.asPath)}`);
        }, 8000);
      }

      const sub = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (nextSession?.access_token && authTimeoutRef.current) {
          clearTimeout(authTimeoutRef.current);
          authTimeoutRef.current = null;
        }
        setSession(nextSession || null);
        setAuthReady(true);
      });
      subscription = sub.data.subscription;
    })();

    return () => {
      subscription?.unsubscribe?.();
      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current);
        authTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => {
      setNotice("");
      setNoticeTone("info");
    }, noticeDuration);
    return () => window.clearTimeout(timer);
  }, [notice, noticeDuration]);

  useEffect(() => {
    if (!router.isReady || !authReady) return;

    let cancelled = false;

    const loadProject = async () => {
      const requestedPage = String(page || "Home");
      const shouldForceReload = forceReload === "1" || forceReload === "true";
      let nextProject = (!shouldForceReload && projectId) ? getWebsiteProject(projectId) : null;

      setMissingProjectId("");

      if ((!nextProject || shouldForceReload) && projectId && session?.access_token) {
        try {
          const remoteProject = await fetchWebsiteProjectFromServer(session, projectId);
          if (remoteProject) {
            nextProject = cacheWebsiteProject(remoteProject, { onlyIfNewer: false });
          }
        } catch (error) {
          console.warn("Could not load website draft from the server", error);
        }
      }

      // Remove the forceReload param from the URL after loading so refreshes don't re-trigger
      if (shouldForceReload && router.isReady) {
        const { forceReload: _fr, ...restQuery } = router.query;
        router.replace({ pathname: router.pathname, query: restQuery }, undefined, { shallow: true });
      }

      if (!nextProject && projectId) {
        // If we never had a session token, we couldn't try the server.
        // The effect will re-run when session?.access_token becomes available,
        // so just wait silently instead of showing a false "not found" error.
        if (!session?.access_token) return;
        if (cancelled) return;
        setProject(null);
        setMissingProjectId(String(projectId));
        setNotice("Requested website project was not found locally or in your synced drafts.");
        setNoticeTone("error");
        setNoticeDuration(4000);
        return;
      }

      if (!nextProject) {
        nextProject = createWebsiteProject({
          name: String(name || "GR8 Website"),
          mode: String(mode || "blank"),
          buildType: String(type || "website"),
          templateSlug: String(template || ""),
          pages: [{
            name: requestedPage,
            objective: String(mode || "blank") === "blank"
              ? "Start with a completely blank page and build from scratch."
              : `Build the ${requestedPage} page.`,
          }],
          status: "unsaved",
        });
      }

      if (cancelled) return;
      setProject(nextProject);

      const resolvedPage = nextProject?.pages?.find((entry) => slugify(entry.name) === slugify(requestedPage))?.name
        || nextProject?.pages?.[0]?.name
        || requestedPage;

      setActivePage(resolvedPage);
    };

    loadProject();

    return () => {
      cancelled = true;
    };
  }, [router.isReady, authReady, session?.access_token, projectId, page, name, mode, type, template, forceReload]);

  useEffect(() => {
    if (!project?.id || !isLegacyAiStarterProject(project)) return undefined;

    let cancelled = false;

    const upgradeLegacyAiProject = async () => {
      try {
        setIsUpgrading(true);
        flashNotice("Rebuilding AI layout — this takes about 30 seconds…", "info", 60000);
        const response = await fetch("/api/website/generate-site-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brief: project?.brief || {},
            pages: Array.isArray(project?.pages) ? project.pages : [],
            buildType: project?.buildType || "website",
            templateSlug: project?.templateSlug || "",
          }),
        });

        const payload = await response.json();
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || "Could not refresh AI website content");
        }

        const updated = updateWebsiteProject(project.id, {
          name: payload.name || project.name,
          brief: {
            ...(project?.brief || {}),
            aiStarterVersion: "production-v2",
          },
          pageBlocks: payload.pageBlocks || {},
          pagesContent: payload.pagesContent || {},
          globalNavBlock: payload.globalNavBlock || null,
          globalFooterBlock: payload.globalFooterBlock || null,
          status: "saved",
        });

        if (!cancelled && updated) {
          const latestProject = getWebsiteProject(project.id) || updated;
          setProject(latestProject);
          await syncProjectToServer(latestProject, { silent: true });
          setIsUpgrading(false);
          flashNotice("AI website layout ready ✓", "success");
        }
      } catch (error) {
        console.error("Could not upgrade legacy AI project", error);
        if (!cancelled) {
          setIsUpgrading(false);
          flashNotice(error?.message || "Could not refresh AI website layout", "error", 5000);
        }
      }
    };

    upgradeLegacyAiProject();

    return () => {
      cancelled = true;
    };
  }, [project]);

  useEffect(() => {
    const fallbackSlug = slugify(project?.publication?.slug || project?.slug || project?.name || "site");
    if (fallbackSlug && fallbackSlug !== siteSlug) {
      setSiteSlug(fallbackSlug);
    }
    const savedCustomDomain = normalizeDomain(project?.publication?.customDomain || project?.publication?.custom_domain || "");
    if (savedCustomDomain !== customDomain) {
      setCustomDomain(savedCustomDomain);
    }
  }, [project?.id, project?.publication?.customDomain, project?.publication?.custom_domain]);

  const currentObjective = useMemo(() => {
    const pageEntry = project?.pages?.find((entry) => entry.name === activePage || slugify(entry.name) === slugify(activePage));
    return pageEntry?.objective || "Build this page in the visual editor.";
  }, [project, activePage]);

  function flashNotice(message, tone = "info", duration = null) {
    setNotice(String(message || ""));
    setNoticeTone(tone);
    setNoticeDuration(duration ?? (tone === "error" ? 6500 : 2400));
  }

  async function syncProjectToServer(nextProject, options = {}) {
    if (!session?.access_token || !nextProject?.id) return nextProject;

    // Throttle: if a sync is already in-flight, or fired too recently,
    // queue this project and bail. The queued sync fires automatically.
    // forceSaveBlockPage passes options.force to bypass throttling.
    if (!options?.force) {
      const MIN_INTERVAL_MS = 5000;
      const now = Date.now();
      if (syncInFlightRef.current || now - lastSyncAtRef.current < MIN_INTERVAL_MS) {
        syncQueuedRef.current = nextProject;
        if (!syncTimerRef.current) {
          const delay = syncInFlightRef.current
            ? MIN_INTERVAL_MS
            : MIN_INTERVAL_MS - (now - lastSyncAtRef.current);
          syncTimerRef.current = setTimeout(() => {
            syncTimerRef.current = null;
            const queued = syncQueuedRef.current;
            syncQueuedRef.current = null;
            if (queued) syncProjectToServer(queued, { ...options, force: true });
          }, Math.max(delay, 100));
        }
        return nextProject;
      }
    }

    syncInFlightRef.current = true;

    try {
      const syncedProject = await saveWebsiteProjectToServer(session, nextProject);
      if (!syncedProject) return nextProject;

      // After the async server round-trip the user may have made more edits.
      // Get the freshest local copy and merge it with the server response so that
      // server-side metadata (publication, domain status, etc.) is preserved while
      // any newer local page content (blocks, chaiData) is NOT overwritten.
      // NOTE: use !== undefined (not ??) so that an explicit null (e.g. a deleted
      // global block) is kept rather than being replaced by the stale server value.
      const currentLocal = getWebsiteProject(nextProject.id);
      const localHas = (key) => currentLocal !== null && key in Object(currentLocal);

      // When the local cache has pageBlocks, always trust local as source of truth.
      // Merging server extras caused deleted blocks to be resurrected on every sync.
      const mergePageBlocks = (serverPB, localPB) => localPB || serverPB;

      const mergedProject = {
        ...syncedProject,
        pages: localHas("pages") ? currentLocal.pages : syncedProject.pages,
        pageBlocks: localHas("pageBlocks") ? mergePageBlocks(syncedProject.pageBlocks, currentLocal.pageBlocks) : syncedProject.pageBlocks,
        chaiData: localHas("chaiData") ? currentLocal.chaiData : syncedProject.chaiData,
        pagesContent: localHas("pagesContent") ? currentLocal.pagesContent : syncedProject.pagesContent,
        globalNavBlock: localHas("globalNavBlock") ? currentLocal.globalNavBlock : syncedProject.globalNavBlock,
        globalFooterBlock: localHas("globalFooterBlock") ? currentLocal.globalFooterBlock : syncedProject.globalFooterBlock,
      };

      const cachedProject = cacheWebsiteProject(mergedProject, { onlyIfNewer: false });
      if (cachedProject?.id === project?.id) {
        setProject(cachedProject);
      }
      return cachedProject || nextProject;
    } catch (error) {
      console.warn("Could not sync website draft to the server", error);
      if (!options?.silent) {
        flashNotice(error?.message || "Saved locally, but cloud sync failed.", "error", 5000);
      }
      return nextProject;
    } finally {
      lastSyncAtRef.current = Date.now();
      syncInFlightRef.current = false;
      // Fire any queued sync that accumulated while we were in-flight
      if (syncQueuedRef.current && !syncTimerRef.current) {
        const queued = syncQueuedRef.current;
        syncQueuedRef.current = null;
        syncTimerRef.current = setTimeout(() => {
          syncTimerRef.current = null;
          syncProjectToServer(queued, { ...options, force: true });
        }, 500);
      }
    }
  }

  async function handleCopyPublishedUrl(url) {
    const value = String(url || "").trim();
    if (!value) {
      flashNotice("No published URL is available yet.", "error");
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const input = document.createElement("textarea");
        input.value = value;
        input.setAttribute("readonly", "readonly");
        input.style.position = "absolute";
        input.style.left = "-9999px";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }

      flashNotice("Published URL copied", "success");
    } catch (_error) {
      flashNotice("Could not copy the published URL.", "error");
    }
  }

  async function handlePublishWebsite() {
    if (!project?.id) {
      flashNotice("Save the project before publishing.", "error");
      return;
    }

    if (!session?.access_token) {
      flashNotice("Please log in again before publishing.", "error");
      return;
    }

    const normalizedSlug = slugify(siteSlug || project.name || "site");
    if (!normalizedSlug) {
      flashNotice("Add a valid site slug before publishing.", "error");
      return;
    }

    setPublishBusy(true);

    try {
      const response = await fetch("/api/websites/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          slug: normalizedSlug,
          customDomain: normalizeDomain(customDomain),
          project: {
            ...project,
            brandAssets,
            name: displayName,
            publication: undefined,
          },
        }),
      });

      const responseText = await response.text();
      let payload = {};
      try {
        payload = responseText ? JSON.parse(responseText) : {};
      } catch {
        payload = {};
      }

      if (!response.ok || !payload?.ok) {
        const detailedMessage = payload?.error
          || (responseText && !responseText.trim().startsWith("<") ? responseText.trim() : "")
          || `Could not publish website (HTTP ${response.status})`;
        throw new Error(detailedMessage);
      }

      const nextPublication = {
        id: payload.publication?.id || "",
        slug: payload.publication?.slug || normalizedSlug,
        primaryDomain: payload.publication?.primary_domain || buildDefaultSiteDomain(normalizedSlug),
        customDomain: payload.publication?.custom_domain || normalizeDomain(customDomain),
        domainStatus: payload.publication?.domain_status || "generated",
        publishedAt: payload.publication?.published_at || new Date().toISOString(),
        sitePath: payload.sitePath || buildWebsitePath(normalizedSlug),
        liveUrl: payload.liveUrl || (payload.publication?.custom_domain
          ? buildWebsiteUrl({ slug: normalizedSlug, domain: payload.publication?.custom_domain })
          : buildHostedWebsiteUrl({ slug: normalizedSlug })),
        defaultUrl: payload.defaultUrl || buildHostedWebsiteUrl({ slug: normalizedSlug }),
        customDomainInstructions: payload.customDomainInstructions || null,
      };

      const updated = saveProjectPatch({ publication: nextPublication }, "Website published");
      if (!updated) {
        setProject((current) => current ? { ...current, publication: nextPublication } : current);
        flashNotice("Website published", "success");
      }
    } catch (error) {
      flashNotice(error?.message || "Could not publish website", "error");
    } finally {
      setPublishBusy(false);
    }
  }

  function saveProjectPatch(patch, successMessage = "Saved changes") {
    if (!project?.id) return null;

    const currentProject = getWebsiteProject(project.id) || project;

    const savedProject = updateWebsiteProject(project.id, {
      ...currentProject,
      ...patch,
      status: "saved",
    });

    let latest = null;
    try {
      latest = getWebsiteProject(project.id);
    } catch (_error) {
      latest = null;
    }

    if (savedProject && latest) {
      setProject(latest);
      flashNotice(successMessage);
      void syncProjectToServer(latest, { silent: true });
      return latest;
    }

    if (!savedProject) {
      flashNotice("Could not save changes. Local storage may be full or unavailable.");
    } else {
      setProject(savedProject);
      flashNotice(successMessage);
      void syncProjectToServer(savedProject, { silent: true });
      return savedProject;
    }

    return null;
  }

  function handleAddPage(nameOverride) {
    const pageName = String(nameOverride || newPageName || "").trim();
    if (!pageName || !project?.id) return;

    if (project.pages?.some((entry) => slugify(entry.name) === slugify(pageName))) {
      flashNotice("That page already exists.");
      return;
    }

    const nextPages = [...(project.pages || []), { name: pageName, objective: `Build the ${pageName} page.` }];
    const starterData = project?.mode === "blank"
      ? { blocks: [], theme: { preset: project?.stylePack || "executive" }, designTokens: {} }
      : buildStarterChaiData(project, pageName);

    saveProjectPatch(
      {
        pages: nextPages,
        pageBlocks: {
          ...(project.pageBlocks || {}),
          [pageName]: starterData.blocks || [],
        },
        chaiData: {
          ...(project?.chaiData || {}),
          [pageName]: starterData,
        },
        pagesContent: {
          ...(project?.pagesContent || {}),
          [pageName]: renderChaiHtml(starterData),
        },
      },
      `Added ${pageName}`
    );

    setActivePage(pageName);
    setNewPageName("");
    return pageName;
  }

  function handleDeletePage(name) {
    if (!project?.pages || project.pages.length <= 1) {
      flashNotice("Cannot delete the only page.");
      return;
    }
    const nextPages = project.pages.filter((p) => p.name !== name);
    const nextPageBlocks = { ...(project.pageBlocks || {}) };
    delete nextPageBlocks[name];
    const nextChaiData = { ...(project.chaiData || {}) };
    delete nextChaiData[name];
    const nextPagesContent = { ...(project.pagesContent || {}) };
    delete nextPagesContent[name];
    saveProjectPatch({ pages: nextPages, pageBlocks: nextPageBlocks, chaiData: nextChaiData, pagesContent: nextPagesContent }, `Deleted ${name}`);
    if (activePage === name) setActivePage(nextPages[0]?.name || "Home");
  }

  function handleRenamePage(oldName, newName) {
    const trimmed = String(newName || "").trim();
    if (!trimmed || trimmed === oldName || !project?.pages) return;
    if (project.pages.some((p) => p.name !== oldName && slugify(p.name) === slugify(trimmed))) {
      flashNotice("A page with that name already exists.");
      return;
    }
    const nextPages = project.pages.map((p) => p.name === oldName ? { ...p, name: trimmed } : p);
    const renameKey = (obj) => {
      if (!obj || typeof obj !== "object" || !(oldName in obj)) return obj;
      const next = { ...obj };
      next[trimmed] = next[oldName];
      delete next[oldName];
      return next;
    };
    saveProjectPatch({
      pages: nextPages,
      pageBlocks: renameKey(project.pageBlocks),
      chaiData: renameKey(project.chaiData),
      pagesContent: renameKey(project.pagesContent),
    }, `Renamed to ${trimmed}`);
    if (activePage === oldName) setActivePage(trimmed);
  }

  // Expose page-add helper for testing / automation
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    window.__addBuilderPage = (name) => handleAddPage(name);
    return () => { delete window.__addBuilderPage; };
  });

  function saveChaiPage(data, successMessage = `Saved ${activePage}`) {
    const currentProject = project?.id ? (getWebsiteProject(project.id) || project) : project;
    const safeData = data || buildStarterChaiData(currentProject, activePage);
    const html = renderChaiHtml(safeData, brandAssets);

    return saveProjectPatch(
      {
        chaiData: {
          ...(currentProject?.chaiData || {}),
          [activePage]: safeData,
        },
        pageBlocks: {
          ...(currentProject?.pageBlocks || {}),
          [activePage]: Array.isArray(safeData?.blocks) ? safeData.blocks : [],
        },
        pagesContent: {
          ...(currentProject?.pagesContent || {}),
          [activePage]: html,
        },
      },
      successMessage
    );
  }

  function saveBlockPage(blocks, successMessage = `Saved ${activePage}`) {
    const currentProject = project?.id ? (getWebsiteProject(project.id) || project) : project;
    const safeBlocks = Array.isArray(blocks) ? blocks : [];
    return saveChaiPage({
      ...(currentProject?.chaiData?.[activePage] || {}),
      blocks: safeBlocks,
      theme: currentProject?.chaiData?.[activePage]?.theme || { preset: currentProject?.stylePack || "premium" },
      designTokens: currentProject?.chaiData?.[activePage]?.designTokens || {},
    }, successMessage);
  }

  // forceSaveBlockPage: used by the manual Save button / Ctrl+S.
  // Awaits the cloud sync and surfaces errors so the user knows if data didn't reach the server.
  async function forceSaveBlockPage(blocks) {
    const currentProject = project?.id ? (getWebsiteProject(project.id) || project) : project;
    if (!currentProject?.id) return null;
    const safeBlocks = Array.isArray(blocks) ? blocks : [];

    // Build the chai data payload (same as saveBlockPage)
    const chaiData = {
      ...(currentProject?.chaiData?.[activePage] || {}),
      blocks: safeBlocks,
      theme: currentProject?.chaiData?.[activePage]?.theme || { preset: currentProject?.stylePack || "premium" },
      designTokens: currentProject?.chaiData?.[activePage]?.designTokens || {},
    };
    const html = renderChaiHtml(chaiData, brandAssets);
    const patch = {
      chaiData: { ...(currentProject?.chaiData || {}), [activePage]: chaiData },
      pageBlocks: { ...(currentProject?.pageBlocks || {}), [activePage]: safeBlocks },
      pagesContent: { ...(currentProject?.pagesContent || {}), [activePage]: html },
      status: "saved",
    };

    // 1. Save to localStorage immediately
    const savedProject = updateWebsiteProject(currentProject.id, { ...currentProject, ...patch });
    const latest = savedProject ? getWebsiteProject(currentProject.id) : null;
    if (!savedProject && !latest) {
      flashNotice("Could not save. Local storage may be full.", "error");
      return null;
    }
    if (latest) setProject(latest);

    // 2. Await cloud sync — show explicit success or error (force bypasses throttle)
    try {
      const synced = await syncProjectToServer(latest || savedProject, { silent: false, force: true });
      flashNotice(`Saved ✓ ${activePage}`, "success");
      return synced || latest || savedProject;
    } catch {
      // syncProjectToServer already showed the error toast via flashNotice
      return latest || savedProject; // still return the local save so handleSave shows success
    }
  }

  useEffect(() => {
    let cancelled = false;

    const syncServerDefaults = async () => {
      try {
        const response = await fetch("/api/website-builder/defaults");
        const payload = await response.json();
        if (!response.ok || !payload?.ok || cancelled) return;

        setBlockDefaults(payload.blockDefaults && typeof payload.blockDefaults === "object" ? payload.blockDefaults : {});

        const templateSlug = String(project?.templateSlug || "").trim();
        if (!templateSlug) return;

        const serverOverride = payload.templateOverrides?.[templateSlug] || null;
        if (serverOverride) {
          updateWebsiteTemplateOverride(templateSlug, serverOverride);
        } else {
          deleteWebsiteTemplateOverride(templateSlug);
        }

        if (!project?.id) return;
        const refreshed = getWebsiteProject(project.id);
        if (!cancelled && refreshed) setProject(refreshed);
      } catch (error) {
        console.warn("Could not load website builder defaults", error);
      }
    };

    syncServerDefaults();

    return () => {
      cancelled = true;
    };
  }, [project?.id, project?.templateSlug]);

  async function saveTemplatePageToServer({ pageName, blocks, globalNavBlock, globalFooterBlock }) {
    if (!project?.templateSlug) return false;

    try {
      const response = await fetch("/api/website-builder/defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-template-page",
          templateSlug: project.templateSlug,
          pageName,
          blocks,
          globalNavBlock,
          globalFooterBlock,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) return false;

      updateWebsiteTemplateOverride(project.templateSlug, payload.templateOverride || {});
      setBlockDefaults(payload.blockDefaults && typeof payload.blockDefaults === "object" ? payload.blockDefaults : {});
      flashNotice(`Saved ${pageName} to ${project.templateSlug}`, "success", 3600);
      return true;
    } catch (error) {
      flashNotice(error?.message || "Could not save template page", "error");
      return false;
    }
  }

  async function saveTemplateSiteToServer({ pageBlocks, globalNavBlock, globalFooterBlock }) {
    if (!project?.templateSlug) return false;

    try {
      const response = await fetch("/api/website-builder/defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-template-site",
          templateSlug: project.templateSlug,
          pageBlocks,
          globalNavBlock,
          globalFooterBlock,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) return false;

      updateWebsiteTemplateOverride(project.templateSlug, payload.templateOverride || {});
      setBlockDefaults(payload.blockDefaults && typeof payload.blockDefaults === "object" ? payload.blockDefaults : {});
      flashNotice(`Saved ${project.templateSlug} globally`, "success", 3600);
      return true;
    } catch (error) {
      flashNotice(error?.message || "Could not save template", "error");
      return false;
    }
  }

  async function saveBlockDefaultToServer(block) {
    const blockType = String(block?.type || "").trim();
    if (!blockType) return false;

    try {
      const response = await fetch("/api/website-builder/defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-block-default",
          blockType,
          props: block?.props || {},
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok) return false;

      setBlockDefaults(payload.blockDefaults && typeof payload.blockDefaults === "object" ? payload.blockDefaults : {});
      flashNotice(`Saved ${blockType} block defaults`, "success", 3200);
      return true;
    } catch (error) {
      flashNotice(error?.message || "Could not save block defaults", "error");
      return false;
    }
  }

  function saveGlobalBlock(block, role) {
    if (!project?.id || !block) return;
    const field = role === "nav" ? "globalNavBlock" : "globalFooterBlock";
    saveProjectPatch({ [field]: block }, `Saved as global ${role === "nav" ? "navigation" : "footer"} — shows on every page`);
  }

  function updateGlobalBlock(role, block) {
    if (!project?.id) return;
    const field = role === "nav" ? "globalNavBlock" : "globalFooterBlock";
    // block === null means "delete this global block"
    saveProjectPatch({ [field]: block ?? null }, `Updated global ${role === "nav" ? "navigation" : "footer"}`);
  }

  function applyDesignPreset(presetName) {
    const currentData = project?.chaiData?.[activePage] || buildStarterChaiData(project, activePage);
    const nextData = applyChaiThemePreset(currentData, presetName);
    const themeLabel = String(presetName || "premium").replace(/^./, (char) => char.toUpperCase());
    saveChaiPage(nextData, `${themeLabel} theme applied`);
  }

  function persistAssets(nextAssets) {
    const didSave = saveWebsiteBuilderAssets(nextAssets);
    setBrandAssets(nextAssets);
    if (!didSave) {
      flashNotice("Image library is nearly full. Large images may not persist until reduced.");
    }
    return didSave;
  }

  function handleSelectAsset(blockIndex, fieldKey, asset, blocksOverride) {
    const normalizedAsset = normalizeSelectedAsset(asset);
    if (!normalizedAsset?.src) return;

    const currentBlocks = Array.isArray(blocksOverride)
      ? [...blocksOverride]
      : Array.isArray(project?.pageBlocks?.[activePage])
        ? [...project.pageBlocks[activePage]]
        : [...(project?.chaiData?.[activePage]?.blocks || [])];

    if (!currentBlocks[blockIndex]) return;

    const existingProps = currentBlocks[blockIndex]?.props || {};
    const nextProps = applyAssetToProps(existingProps, fieldKey, normalizedAsset);
    nextProps[fieldKey] = String(normalizedAsset.src || "").startsWith("data:") ? "" : normalizedAsset.src;

    currentBlocks[blockIndex] = {
      ...currentBlocks[blockIndex],
      props: nextProps,
    };

    saveBlockPage(currentBlocks, `${fieldKey} updated`);
  }

  async function handleUploadImage(blockIndex, fieldKey, file) {
    if (!file) return;

    try {
      const asset = session?.user?.id
        ? await uploadSharedMediaLibraryAsset(supabase, session.user.id, file, { tag: fieldKey === "logo" ? "logo" : "web" })
        : await createStoredAsset(file, { maxWidth: 960, maxHeight: 960, quality: 0.68 });
      const existingImages = Array.isArray(brandAssets?.images) ? brandAssets.images : [];
      const dedupedImages = existingImages.filter((image) => image?.src && image.src !== asset.src && image.name !== asset.name);
      const nextAssets = fieldKey === "logo"
        ? { ...brandAssets, logo: asset }
        : {
            ...brandAssets,
            images: [asset, ...dedupedImages],
          };

      persistAssets(mergeWebsiteBuilderAssetSources(nextAssets));
      flashNotice(`${file.name} added`);
      return asset;
    } catch (error) {
      flashNotice(error?.message || "Image upload failed.");
    }
  }

  function openMediaLibrary() {
    if (typeof window === "undefined") return;
    window.open("/assets", "_blank", "noopener,noreferrer");
  }

  async function refreshSharedLibrary() {
    if (!session?.user?.id) {
      const currentAssets = getWebsiteBuilderAssets();
      setBrandAssets(currentAssets);
      flashNotice("Media library refreshed", "success");
      return true;
    }

    try {
      const mergedAssets = await syncWebsiteBuilderSharedAssetCache({
        supabase,
        userId: session.user.id,
        currentAssets: getWebsiteBuilderAssets(),
      });

      persistAssets(mergedAssets);
      flashNotice("Shared media library refreshed", "success");
      return true;
    } catch (error) {
      flashNotice(error?.message || "Could not refresh shared media library", "error");
      return false;
    }
  }

  const displayName = String(name || project?.name || "GR8 Website");
  const predictedDefaultDomain = buildDefaultSiteDomain(siteSlug || displayName || "site");
  const predictedHostedUrl = buildHostedWebsiteUrl({ slug: siteSlug || displayName || "site" });
  const hasDedicatedRootDomain = !!getSiteRootDomain();
  const predictedSitePath = buildWebsitePath(siteSlug || displayName || "site");
  const publication = project?.publication || null;
  const resolvedPublicationLiveUrl = publication
    ? (publication.customDomain
      ? buildWebsiteUrl({ slug: publication.slug || siteSlug || displayName || "site", domain: publication.customDomain })
      : buildHostedWebsiteUrl({ slug: publication.slug || siteSlug || displayName || "site" }))
    : "";
  const liveUrl = publication?.liveUrl || publication?.defaultUrl || buildHostedWebsiteUrl({ slug: siteSlug || displayName || "site" });

  if (!router.isReady) {
    return (
      <>
        <Head><title>{displayName} | GR8 Website Studio</title></Head>
        <StudioLoader />
      </>
    );
  }

  if (missingProjectId) {
    return (
      <>
        <Head><title>{displayName} | GR8 Website Studio</title></Head>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#05070f", padding: 24, fontFamily: "system-ui,sans-serif" }}>
          <div style={{ display: "grid", gap: 14, width: "min(580px, 100%)", borderRadius: 18, padding: 28, background: "#0d1117", border: "1px solid rgba(99,102,241,.25)", boxShadow: "0 0 40px rgba(99,102,241,.1)" }}>
            <div style={{ fontSize: 32 }}>🌐</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Project not found</div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(255,255,255,.5)", maxWidth: 520 }}>
              Project <code style={{ background: "rgba(255,255,255,.08)", padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>{missingProjectId}</code> is not available in this session.
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(255,255,255,.35)" }}>
              Reopen the site from the website builder dashboard, or sign in to the account that saved it.
            </div>
          </div>
        </main>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <Head><title>{displayName} | GR8 Website Studio</title></Head>
        <StudioLoader label={projectId ? "Loading project…" : undefined} />
      </>
    );
  }

  const studioProject = project;

  return (
    <>
      <Head>
        <title>{displayName} | GR8 Website Studio</title>
      </Head>
      <main style={styles.page}>
          <section style={styles.bannerOuter}>
            <div style={styles.bannerInner}>
              <div style={styles.bannerLeft}>
                <div style={styles.bannerIcon} aria-hidden>🌐</div>
                <div>
                  <strong style={styles.bannerTitle}>Website Studio</strong>
                  <span style={styles.bannerSubtitle}>{displayName} · {activePage} page builder</span>
                </div>
              </div>
              <div style={styles.bannerActions}>
                {project?.id ? (
                  <>
                    <button
                      type="button"
                      style={styles.secondaryLinkButton}
                      onClick={() => window.open(`/modules/website-builder/visit-report?projectId=${project.id}`, "_blank")}
                    >
                      📊 Visitor Report
                    </button>
                    <button
                      type="button"
                      style={styles.secondaryLinkButton}
                      onClick={() => previewActionsRef.current?.previewPage?.()}
                    >
                      Preview Page
                    </button>
                    <button
                      type="button"
                      style={styles.secondaryLinkButton}
                      onClick={() => previewActionsRef.current?.previewSite?.()}
                    >
                      Preview Site
                    </button>
                    <button
                      type="button"
                      style={showSetupPanel ? styles.settingsBtnActive : styles.settingsBtn}
                      onClick={() => setShowSetupPanel(v => !v)}
                    >
                      ⚙ Site Settings
                    </button>
                  </>
                ) : null}
                {resolvedPublicationLiveUrl ? (
                  <a href={resolvedPublicationLiveUrl} style={styles.secondaryLink} target="_blank" rel="noopener noreferrer">
                    Live Site
                  </a>
                ) : null}
                <Link href="/modules/website-builder/domains" style={styles.secondaryLink}>
                  Domains
                </Link>
                <Link href="/modules/website-builder" style={styles.primaryBackLink}>
                  Back
                </Link>
              </div>
            </div>
          </section>

          {showSetupPanel && (
            <div style={styles.setupDrawer}>
              <div style={styles.setupDrawerHeader}>
                <strong style={styles.sectionTitle}>Site Settings</strong>
                <button type="button" onClick={() => setShowSetupPanel(false)} style={styles.setupDrawerClose}>✕ Close</button>
              </div>
            <section style={styles.navPanel}>
            <div style={styles.navPanelHead}>
              <div>
                <strong style={styles.sectionTitle}>Website Setup</strong>
                <span style={styles.mutedText}>{currentObjective}</span>
              </div>
              {notice ? <span style={noticeTone === "error" ? styles.noticeError : noticeTone === "success" ? styles.noticeSuccess : styles.notice}>{notice}</span> : null}
            </div>

            <div style={styles.publishPanel}>
              <div style={styles.publishHead}>
                <strong style={styles.sectionTitle}>Publish Website</strong>
                <span style={styles.publishStatus}>{publication?.publishedAt ? "Published" : "Draft only"}</span>
              </div>

              <label style={styles.fieldLabel}>
                Site slug
                <input
                  value={siteSlug}
                  onChange={(event) => setSiteSlug(sanitizeSlugInput(event.target.value))}
                  placeholder="my-business"
                  style={styles.publishInput}
                />
                <span style={styles.fieldHelp}>
                  This is the short name used in your hosted website URL. For example, if you enter <span style={styles.inlineHighlightBlue}>"my-business"</span>, the live URL becomes <span style={styles.inlineHighlightMint}>{buildHostedWebsiteUrl({ slug: "my-business" })}</span>.
                </span>
                <span style={styles.fieldHelpMuted}>
                  This is your website's live address. You can add your own custom domain later if you want a branded URL.
                </span>
              </label>

              <label style={styles.fieldLabel}>
                Custom domain (optional)
                <input
                  value={customDomain}
                  onChange={(event) => setCustomDomain(sanitizeDomainInput(event.target.value))}
                  placeholder="www.example.com"
                  style={styles.publishInput}
                />
              </label>

              <div style={styles.publishHintWrap}>
                <span style={styles.publishHint}>Hosted website URL: <span style={styles.inlineHighlightMint}>{predictedHostedUrl}</span></span>
                {hasDedicatedRootDomain ? <span style={styles.publishHint}>Branded subdomain: <span style={styles.inlineHighlightBlue}>{predictedDefaultDomain || "Add a site slug to generate one"}</span></span> : null}
                <span style={styles.publishHint}>Published route path: <span style={styles.inlineHighlightGold}>{predictedSitePath}</span></span>
              </div>

              <div style={styles.publishActionRow}>
                <button type="button" onClick={handlePublishWebsite} style={styles.publishBtn} disabled={publishBusy || !session}>
                  {publishBusy ? "Publishing..." : publication?.publishedAt ? "Update Published Site" : "Publish Site"}
                </button>

                {resolvedPublicationLiveUrl ? (
                  <div style={styles.publishUrlCard}>
                    <span style={styles.publishUrlLabel}>Published URL</span>
                    <div style={styles.publishUrlRow}>
                      <input value={resolvedPublicationLiveUrl} readOnly style={styles.publishUrlInput} aria-label="Published website URL" />
                      <button type="button" onClick={() => handleCopyPublishedUrl(resolvedPublicationLiveUrl)} style={styles.publishUrlButton}>
                        Copy URL
                      </button>
                      <a href={resolvedPublicationLiveUrl} style={styles.publishUrlOpenLink} target="_blank" rel="noopener noreferrer">
                        Open
                      </a>
                    </div>
                    <a href={resolvedPublicationLiveUrl} style={styles.publishLiveLink} target="_blank" rel="noopener noreferrer">
                        {publication.customDomain ? `Live on ${publication.customDomain}` : `Open live website`}
                    </a>
                  </div>
                ) : null}
              </div>

              {publication?.customDomainInstructions ? (
                <div style={styles.publishDnsCard}>
                  <strong style={styles.sectionLabel}>DNS setup</strong>
                  <p style={styles.publishDnsText}>Point your custom domain to {publication.customDomainInstructions.value}.</p>
                  <p style={styles.publishDnsText}>Preferred: CNAME the host to {publication.customDomainInstructions.value}.</p>
                  <p style={styles.publishDnsText}>Apex/root domains usually need ALIAS or ANAME support at your DNS provider.</p>
                </div>
              ) : null}

              {!session ? <span style={styles.publishAuthHint}>Log in to publish this website.</span> : null}
            </div>

            <div style={styles.controlsPanel}>
              <div style={styles.controlGroup}>
                <strong style={styles.sectionLabel}>Site Pages</strong>
                <div style={styles.pagePills}>
                  {(project?.pages || [{ name: activePage }]).map((entry) => (
                    renamingPage === entry.name ? (
                      <div key={entry.name} style={styles.pagePillRenameWrap}>
                        <input
                          // eslint-disable-next-line jsx-a11y/no-autofocus
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { handleRenamePage(entry.name, renameValue); setRenamingPage(null); }
                            if (e.key === "Escape") setRenamingPage(null);
                          }}
                          onBlur={() => { handleRenamePage(entry.name, renameValue); setRenamingPage(null); }}
                          style={styles.pagePillRenameInput}
                        />
                      </div>
                    ) : (
                      <div
                        key={entry.name}
                        style={{
                          ...styles.pagePillWrap,
                          ...(activePage === entry.name ? styles.pagePillWrapActive : {}),
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setActivePage(entry.name)}
                          onDoubleClick={() => { setRenamingPage(entry.name); setRenameValue(entry.name); }}
                          style={styles.pagePillName}
                          title="Double-click to rename"
                        >
                          {entry.name}
                        </button>
                        {(project?.pages?.length > 1) && (
                          <button
                            type="button"
                            title={`Delete ${entry.name}`}
                            onClick={() => handleDeletePage(entry.name)}
                            style={styles.pagePillDelete}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )
                  ))}
                </div>
              </div>

              <div style={styles.themePanel}>
                <strong style={styles.sectionLabel}>Site Theme</strong>
                <div style={styles.themeRow}>
                  <button type="button" onClick={() => applyDesignPreset("premium")} style={styles.themeBtn}>Premium</button>
                  <button type="button" onClick={() => applyDesignPreset("minimal")} style={styles.themeBtn}>Minimal</button>
                  <button type="button" onClick={() => applyDesignPreset("bold")} style={styles.themeBtn}>Bold</button>
                </div>
              </div>

            </div>

            <div style={styles.addRow}>
              <input
                value={newPageName}
                onChange={(event) => setNewPageName(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") handleAddPage(); }}
                placeholder="Add page name, e.g. About"
                style={styles.pageInput}
              />
              <button type="button" onClick={() => handleAddPage()} style={styles.addBtn}>
                Add Page
              </button>
            </div>
          </section>
            </div>
          )}

            <div style={styles.mainColumn}>
              {isUpgrading ? (
                <StudioLoader label="Rebuilding AI layout…" />
              ) : <PageBuilderCanvas
                project={studioProject}
                brandAssets={brandAssets}
                pageBlocks={studioProject?.pageBlocks?.[activePage] || studioProject?.chaiData?.[activePage]?.blocks || []}
                activePage={activePage}
                currentObjective={currentObjective}
                onSave={(blocks) => saveBlockPage(blocks, `Saved ${activePage}`)}
                onForceSave={forceSaveBlockPage}
                onUploadImage={handleUploadImage}
                onSelectAsset={handleSelectAsset}
                onSaveAsGlobal={saveGlobalBlock}
                onSaveBlockDefault={saveBlockDefaultToServer}
                onSaveTemplatePage={saveTemplatePageToServer}
                onSaveTemplateSite={saveTemplateSiteToServer}
                onUpdateGlobalBlock={updateGlobalBlock}
                onOpenMediaLibrary={openMediaLibrary}
                onRefreshAssetLibrary={refreshSharedLibrary}
                onRegisterPreviewActions={(actions) => {
                  previewActionsRef.current = actions;
                }}
                blockDefaults={blockDefaults}
                showHeader={true}
              />}
            </div>
      </main>
    </>
  );
}

const styles = {
  page: {
    height: "100dvh",
    maxHeight: "100dvh",
    overflow: "hidden",
    background: "linear-gradient(180deg, #0b1016 0%, #0d1420 100%)",
    color: "#e6eef5",
    fontFamily: "system-ui, sans-serif",
    fontSize: 16,
    fontWeight: 600,
    display: "grid",
    gridTemplateRows: "auto 1fr",
    alignContent: "stretch",
    minWidth: 0,
  },
  loadingPage: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#0b1016",
    padding: 24,
  },
  loadingCard: {
    borderRadius: 16,
    padding: "18px 22px",
    background: "#111827",
    color: "#fff",
    fontSize: 16,
    fontWeight: 600,
  },
  emptyCard: {
    display: "grid",
    gap: 14,
    width: "min(620px, 100%)",
    borderRadius: 18,
    padding: 24,
    background: "#111827",
    border: "1px solid rgba(255,255,255,.08)",
  },
  mainColumn: {
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    display: "grid",
  },
  bannerOuter: {
    padding: "8px 16px 6px",
  },
  bannerInner: {
    width: "min(1320px, 100%)",
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 18px",
    borderRadius: 20,
    background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 32%, #1d4ed8 58%, #7c3aed 100%)",
    border: "1px solid rgba(125,211,252,0.26)",
    boxShadow: "0 22px 48px rgba(15,23,42,0.30)",
    flexWrap: "wrap",
    position: "relative",
    overflow: "hidden",
  },
  bannerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    minWidth: 0,
  },
  bannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.16)",
    border: "1px solid rgba(255,255,255,0.24)",
    fontSize: 16,
    flexShrink: 0,
  },
  bannerTitle: {
    display: "block",
    fontSize: 48,
    lineHeight: 1,
    fontWeight: 600,
    color: "#ffffff",
    letterSpacing: "-.02em",
  },
  bannerSubtitle: {
    display: "block",
    marginTop: 3,
    fontSize: 18,
    lineHeight: 1.3,
    color: "rgba(239,246,255,0.80)",
  },
  bannerActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    marginLeft: "auto",
  },
  secondaryLink: {
    color: "#ffffff",
    textDecoration: "none",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.20)",
    background: "rgba(2,6,23,.16)",
    backdropFilter: "blur(8px)",
    fontSize: 18,
    fontWeight: 600,
  },
  secondaryLinkButton: {
    color: "#ffffff",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.20)",
    background: "rgba(2,6,23,.16)",
    backdropFilter: "blur(8px)",
    fontSize: 18,
    fontWeight: 600,
    cursor: "pointer",
  },
  primaryBackLink: {
    color: "#082032",
    textDecoration: "none",
    padding: "10px 18px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.34)",
    background: "#f8fafc",
    fontSize: 18,
    fontWeight: 600,
    boxShadow: "0 10px 24px rgba(8,32,50,0.16)",
  },
  backBtn: {
    textDecoration: "none",
    borderRadius: "12px",
    padding: "12px 16px",
    background: "rgba(255,255,255,.1)",
    border: "1px solid rgba(255,255,255,.22)",
    color: "#fff",
    fontSize: 18,
    fontWeight: 600,
    justifySelf: "start",
  },
  contentWrap: {
    display: "none",
  },
  navPanel: {
    display: "grid",
    gap: 12,
    padding: 14,
    minWidth: 0,
  },
  setupDrawer: {
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    width: 380,
    background: "#0c1525",
    borderLeft: "1px solid rgba(255,255,255,.12)",
    zIndex: 1200,
    overflowY: "auto",
    boxShadow: "-12px 0 32px rgba(0,0,0,.6)",
    display: "grid",
    gridTemplateRows: "auto 1fr",
    alignContent: "start",
  },
  setupDrawerHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 18px",
    borderBottom: "1px solid rgba(255,255,255,.1)",
    position: "sticky",
    top: 0,
    background: "#0c1525",
    zIndex: 1,
  },
  setupDrawerClose: {
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.14)",
    color: "#fff",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  settingsBtn: {
    color: "#ffffff",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.20)",
    background: "rgba(2,6,23,.16)",
    backdropFilter: "blur(8px)",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
  settingsBtnActive: {
    color: "#082032",
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.34)",
    background: "#f8fafc",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
  navPanelHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  mutedText: {
    fontSize: 16,
    fontWeight: 600,
    opacity: 0.75,
  },
  sectionTitle: {
    display: "block",
    fontSize: 16,
    color: "#f8fafc",
    fontWeight: 600,
  },
  sectionLabel: {
    fontSize: 16,
    color: "#f8fafc",
    fontWeight: 600,
  },
  notice: {
    fontSize: 16,
    color: "#bae6fd",
    fontWeight: 600,
  },
  noticeSuccess: {
    fontSize: 16,
    color: "#86efac",
    fontWeight: 600,
  },
  noticeError: {
    fontSize: 16,
    color: "#fca5a5",
    fontWeight: 600,
  },
  publishPanel: {
    display: "grid",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    background: "rgba(15,23,42,0.72)",
    border: "1px solid rgba(56,189,248,0.18)",
  },
  publishHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  publishStatus: {
    fontSize: 16,
    fontWeight: 600,
    color: "#bae6fd",
  },
  fieldLabel: {
    display: "grid",
    gap: 6,
    fontSize: 16,
    color: "#e2e8f0",
    fontWeight: 600,
  },
  publishInput: {
    width: "100%",
    background: "#020617",
    color: "#e6eef5",
    border: "1px solid rgba(255,255,255,.15)",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 16,
    fontWeight: 600,
  },
  fieldHelp: {
    fontSize: 16,
    color: "#dbeafe",
    lineHeight: 1.5,
    fontWeight: 600,
  },
  fieldHelpMuted: {
    fontSize: 16,
    color: "#c4b5fd",
    lineHeight: 1.5,
    fontWeight: 600,
  },
  publishHintWrap: {
    display: "grid",
    gap: 4,
  },
  publishHint: {
    fontSize: 16,
    fontWeight: 600,
    color: "#cbd5e1",
  },
  publishActionRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "stretch",
  },
  inlineHighlightBlue: {
    color: "#7dd3fc",
  },
  inlineHighlightMint: {
    color: "#86efac",
  },
  inlineHighlightLavender: {
    color: "#c4b5fd",
  },
  inlineHighlightGold: {
    color: "#fcd34d",
  },
  publishBtn: {
    flex: "1 1 320px",
    maxWidth: "50%",
    minHeight: 72,
    padding: "18px 20px",
    borderRadius: 10,
    border: 0,
    background: "linear-gradient(135deg, #38bdf8 0%, #22c55e 100%)",
    color: "#04111d",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
  publishLiveLink: {
    color: "#7dd3fc",
    textDecoration: "none",
    fontSize: 16,
    fontWeight: 600,
  },
  publishUrlCard: {
    flex: "1 1 420px",
    display: "grid",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    background: "rgba(2,6,23,0.55)",
    border: "1px solid rgba(148,163,184,0.16)",
  },
  publishUrlLabel: {
    fontSize: 16,
    fontWeight: 600,
    color: "#f8fafc",
  },
  publishUrlRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  publishUrlInput: {
    flex: "1 1 320px",
    minWidth: 0,
    background: "#020617",
    color: "#e6eef5",
    border: "1px solid rgba(255,255,255,.15)",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 16,
    fontWeight: 600,
  },
  publishUrlButton: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid rgba(56,189,248,0.28)",
    background: "rgba(14,165,233,0.16)",
    color: "#e0f2fe",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
  publishUrlOpenLink: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid rgba(34,197,94,0.24)",
    background: "rgba(34,197,94,0.14)",
    color: "#dcfce7",
    fontSize: 16,
    fontWeight: 600,
    textDecoration: "none",
  },
  publishDnsCard: {
    display: "grid",
    gap: 4,
    padding: 10,
    borderRadius: 12,
    background: "rgba(2,6,23,0.55)",
    border: "1px solid rgba(148,163,184,0.16)",
  },
  publishDnsText: {
    margin: 0,
    fontSize: 16,
    color: "#cbd5e1",
    lineHeight: 1.5,
    fontWeight: 600,
  },
  publishAuthHint: {
    fontSize: 16,
    color: "#fca5a5",
    fontWeight: 600,
  },
  controlsPanel: {
    display: "grid",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    background: "rgba(15,23,42,0.55)",
    border: "1px solid rgba(148,163,184,0.16)",
  },
  controlGroup: {
    display: "grid",
    gap: 10,
  },
  pagePills: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  pagePillWrap: {
    display: "flex",
    alignItems: "stretch",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.15)",
    background: "#111827",
    overflow: "hidden",
  },
  pagePillWrapActive: {
    border: "1px solid #38bdf8",
    background: "rgba(14,165,233,.16)",
  },
  pagePillName: {
    padding: "10px 14px",
    background: "transparent",
    border: 0,
    color: "#fff",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    userSelect: "none",
  },
  pagePillDelete: {
    padding: "0 10px",
    background: "transparent",
    border: 0,
    borderLeft: "1px solid rgba(255,255,255,.1)",
    color: "rgba(255,255,255,.5)",
    fontSize: 18,
    lineHeight: 1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },
  pagePillRenameWrap: {
    display: "flex",
    alignItems: "center",
  },
  pagePillRenameInput: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1.5px solid #38bdf8",
    background: "#020617",
    color: "#e6eef5",
    fontSize: 16,
    fontWeight: 600,
    minWidth: 100,
    outline: "none",
  },
  themePanel: {
    display: "grid",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    background: "rgba(15,23,42,0.55)",
    border: "1px solid rgba(148,163,184,0.16)",
  },
  themeRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  themeBtn: {
    padding: "10px 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.15)",
    background: "#111827",
    color: "#fff",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
  addRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  pageInput: {
    minWidth: 240,
    flex: "1 1 240px",
    background: "#020617",
    color: "#e6eef5",
    border: "1px solid rgba(255,255,255,.15)",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 16,
    fontWeight: 600,
  },
  addBtn: {
    padding: "10px 14px",
    borderRadius: 8,
    border: 0,
    background: "#0ea5e9",
    color: "#04111d",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
};