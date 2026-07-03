import Head from "next/head";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { buildDefaultSiteDomain, buildHostedWebsiteUrl, buildWebsitePath, buildWebsiteUrl, collectVideoHeroMedia, getSiteRootDomain, normalizeDomain } from "../../../lib/website-builder/publishConfig";
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
import { BlockTypes } from "../../../lib/website-builder/pageBlockComponents";
import { fetchWebsiteProjectFromServer, saveWebsiteProjectToServer } from "../../../lib/website-builder/remoteProjects";

const DEVELOPER_USER_IDS = new Set(["35ab846e-0764-498b-b1f8-7d2cf27d85a5"]);
const WEBSITE_BUILDER_SAVE_DEBUG = process.env.NODE_ENV !== "production";
const WEBSITE_BUILDER_MAX_VIDEO_BYTES = 250 * 1024 * 1024;

function waitForPublicVideoUrlToLoad(src, timeoutMs = 15000) {
  if (typeof document === "undefined") return Promise.resolve();
  const url = String(src || "").trim();
  if (!url || /^blob:/i.test(url)) {
    return Promise.reject(new Error("Video upload did not return a permanent public URL."));
  }
  if (!/^https?:\/\//i.test(url)) {
    return Promise.reject(new Error("Video upload returned a non-public URL. Please try again."));
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    let settled = false;

    const cleanup = () => {
      video.oncanplay = null;
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute("src");
      try {
        video.load();
      } catch {}
    };

    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      if (error) reject(error);
      else resolve();
    };

    const timer = setTimeout(() => {
      finish(new Error("Video uploaded, but the public video URL did not load in time. Please try again or check storage access."));
    }, timeoutMs);

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => finish();
    video.oncanplay = () => finish();
    video.onerror = () => {
      finish(new Error("Video uploaded, but the public video URL could not be loaded. Please check the file format or storage permissions."));
    };
    video.src = url;
    video.load();
  });
}

function stripHtmlForSaveDebug(value = "") {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeBuilderBlocksForSave(blocks = []) {
  const safeBlocks = Array.isArray(blocks) ? blocks : [];
  return {
    count: safeBlocks.length,
    missingIds: safeBlocks
      .map((block, index) => (!block?.id ? { index, type: block?.type || "" } : null))
      .filter(Boolean),
    textBlocks: safeBlocks
      .map((block, index) => {
        if (block?.type !== BlockTypes.TEXT) return null;
        const text = stripHtmlForSaveDebug(block?.props?.text || "");
        return {
          index,
          id: block?.id || "",
          hidden: !!(block?.props?.hidden || block?.props?.textHidden || block?.props?.draftOnly || block?.props?.temporary),
          textLength: text.length,
          textPreview: text.slice(0, 120),
        };
      })
      .filter(Boolean),
    marqueeTextBlocks: safeBlocks
      .map((block, index) => {
        if (!["marquee-strip", "wave-marquee"].includes(String(block?.type || ""))) return null;
        const items = Array.isArray(block?.props?.items) ? block.props.items : [];
        return {
          index,
          id: block?.id || "",
          type: block?.type || "",
          itemCount: items.length,
          textPreview: items.map((item) => stripHtmlForSaveDebug(item?.text || item?.label || item)).filter(Boolean).slice(0, 6),
        };
      })
      .filter(Boolean),
  };
}

function logWebsiteBuilderSaveDebug(label, details = {}) {
  if (!WEBSITE_BUILDER_SAVE_DEBUG) return;
  console.info(`[WebsiteBuilderSave] ${label}`, details);
}

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
          <div style={{ fontSize: 16, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,.28)", fontWeight: 600 }}>
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
              display: "block", fontSize: 16, fontWeight: 600,
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

const PageBuilderCanvas = dynamic(() => import("../../../components/website-builder/PageBuilderCanvas"), {
  ssr: false,
  loading: () => <StudioLoader label="Preparing canvas..." />,
});

class CanvasErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (typeof console !== "undefined") {
      console.error("Website builder canvas failed", { error, info });
    }
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={styles.canvasErrorPanel}>
          <strong style={styles.canvasErrorTitle}>Canvas preview could not render.</strong>
          <span style={styles.canvasErrorText}>
            {this.state.error?.message || "An editor preview error stopped this page from drawing."}
          </span>
          <button type="button" style={styles.canvasErrorButton} onClick={() => this.setState({ error: null })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function pageNameFromValue(value) {
  if (typeof value === "string") {
    const text = value.trim();
    return text && text !== "[object Object]" ? text : "";
  }
  if (value && typeof value === "object") {
    return pageNameFromValue(value.name || value.title || value.slug || "");
  }
  return "";
}

async function readApiJson(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    const rawMessage = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return { ok: false, error: rawMessage || `Request returned non-JSON response (HTTP ${response.status})` };
  }
}

function shouldUseEmergencyDraft(project, pageName, draft) {
  if (!draft || !Array.isArray(draft.blocks)) return false;
  const currentBlocks = Array.isArray(project?.pageBlocks?.[pageName]) ? project.pageBlocks[pageName] : [];
  const draftSavedAt = Date.parse(draft.savedAt || 0) || 0;
  const projectUpdatedAt = Date.parse(project?.updatedAt || project?.createdAt || 0) || 0;
  const scoreBlocks = (blocks = []) => {
    const safeBlocks = Array.isArray(blocks) ? blocks : [];
    const textValues = [];
    const visit = (value) => {
      if (typeof value === "string") {
        const text = stripHtmlForSaveDebug(value);
        if (text) textValues.push(text);
        return;
      }
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (value && typeof value === "object") {
        Object.entries(value).forEach(([key, child]) => {
          if (/^(text|title|headline|subheadline|content|label|description)$/i.test(key)) visit(child);
        });
      }
    };
    safeBlocks.forEach((block) => visit(block?.props || {}));
    return {
      blockCount: safeBlocks.length,
      textCount: textValues.length,
      textChars: textValues.join(" ").length,
      typeSignature: safeBlocks.map((block) => String(block?.type || "")).join("|"),
    };
  };
  const currentScore = scoreBlocks(currentBlocks);
  const draftScore = scoreBlocks(draft.blocks);
  const source = String(draft.source || "").toLowerCase();
  const draftIsNewer = draftSavedAt > projectUpdatedAt;
  const draftHasMoreBlocks = draftScore.blockCount > currentScore.blockCount;
  const draftHasMoreText = draftScore.textChars > currentScore.textChars;
  const currentIsEmpty = currentScore.blockCount === 0;
  const shouldRecover = currentIsEmpty
    || (draftHasMoreBlocks && draftScore.textChars >= currentScore.textChars)
    || (draftIsNewer && draftHasMoreText)
    || (draftIsNewer && !source.includes("autosave") && draftScore.blockCount >= currentScore.blockCount && draftScore.typeSignature !== currentScore.typeSignature);

  logWebsiteBuilderSaveDebug("emergency draft recovery decision", {
    pageName,
    source: draft.source || "",
    draftSavedAt: draft.savedAt || "",
    projectUpdatedAt: project?.updatedAt || project?.createdAt || "",
    shouldRecover,
    current: currentScore,
    emergencyDraft: draftScore,
  });

  return shouldRecover;
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
    console.warn("Could not load emergency website page draft", error);
    return null;
  }
}

async function saveEmergencyPageDraft(projectId, pageName, { blocks, html = "", chaiData = null, source = "builder-save" } = {}) {
  if (!projectId || !pageName) return false;
  try {
    const response = await fetch("/api/website-builder/emergency-page-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        pageName,
        blocks: Array.isArray(blocks) ? blocks : [],
        html,
        chaiData,
        source,
      }),
    });
    const payload = await readApiJson(response);
    return response.ok && payload?.ok;
  } catch (error) {
    console.warn("Could not write emergency website page draft", error);
    return false;
  }
}

async function fetchLocalProjectRepair(projectId) {
  if (!projectId) return null;
  try {
    const response = await fetch(`/api/website-builder/local-project-repair?projectId=${encodeURIComponent(projectId)}`, {
      cache: "no-store",
    });
    const payload = await readApiJson(response);
    if (!response.ok || !payload?.ok || !payload?.project) return null;
    return payload.project;
  } catch (error) {
    console.warn("Could not repair local website project", error);
    return null;
  }
}

function shouldRepairCollapsedProject(project) {
  const pages = Array.isArray(project?.pages) ? project.pages : [];
  return !!project?.id && pages.length <= 1;
}

function shouldUseLocalRepairProject(project, repairedProject) {
  if (!project?.id || !repairedProject?.id) return false;
  const localPages = Array.isArray(project?.pages) ? project.pages : [];
  const repairedPages = Array.isArray(repairedProject?.pages) ? repairedProject.pages : [];
  if (repairedPages.length <= 1) return false;
  if (localPages.length <= 1) return true;
  if (repairedPages.length > localPages.length) return true;

  const localPageSlugs = new Set(localPages.map((page) => slugify(page?.slug || page?.name || "")));
  const repairedPageSlugs = new Set(repairedPages.map((page) => slugify(page?.slug || page?.name || "")));
  const corePages = ["about-us", "modules", "contact-us"];
  if (corePages.some((pageSlug) => repairedPageSlugs.has(pageSlug) && !localPageSlugs.has(pageSlug))) return true;

  const localBlocks = project?.pageBlocks || {};
  const repairedBlocks = repairedProject?.pageBlocks || {};
  const countBlocks = (pageMap) => Object.values(pageMap || {}).reduce((total, blocks) => (
    total + (Array.isArray(blocks) ? blocks.length : 0)
  ), 0);
  if (countBlocks(repairedBlocks) > countBlocks(localBlocks)) return true;

  return repairedPages.some((page) => {
    const pageName = page?.name || "";
    const localPageName = localPages.find((entry) => slugify(entry?.name) === slugify(pageName) || slugify(entry?.slug) === slugify(pageName))?.name || pageName;
    const localCount = Array.isArray(localBlocks[localPageName]) ? localBlocks[localPageName].length : 0;
    const repairedCount = Array.isArray(repairedBlocks[pageName]) ? repairedBlocks[pageName].length : 0;
    return repairedCount > localCount;
  });
}

function applyEmergencyDraftToProject(project, pageName, draft) {
  if (!project?.id || !pageName || !Array.isArray(draft?.blocks)) return project;
  const nextChaiData = draft.chaiData && typeof draft.chaiData === "object"
    ? draft.chaiData
    : {
        ...(project?.chaiData?.[pageName] || {}),
        blocks: draft.blocks,
      };
  return {
    ...project,
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
      [pageName]: nextChaiData,
    },
  };
}

function normalizeBuilderNotice(message) {
  const text = String(message || "");
  if (/Unexpected token|not valid JSON|Unexpected end of JSON input|JSON\.parse/i.test(text)) {
    return "";
  }
  return text;
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
  // Already upgraded — the field is set by the upgrade itself on completion
  if (project?.brief?.aiStarterVersion) return false;
  // User has manually saved content — never silently replace their work
  if (project?.status === "saved") return false;
  if (project?.globalNavBlock || project?.globalFooterBlock) return false;
  const pageBlockEntries = Object.entries(project?.pageBlocks || {});
  if (pageBlockEntries.some(([pageName, blocks]) => (
    String(pageName || "").toLowerCase() !== "home"
    && Array.isArray(blocks)
    && blocks.length > 0
  ))) return false;

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
  const [primaryWebsite, setPrimaryWebsite] = useState(false);
  const [blockDefaults, setBlockDefaults] = useState({});
  const canSaveTemplates = DEVELOPER_USER_IDS.has(String(session?.user?.id || ""));
  const previewActionsRef = useRef(null);
  const syncInFlightRef = useRef(false);
  const syncQueuedRef = useRef(null); // holds latest project + page/options pending sync
  const syncTimerRef = useRef(null);  // timer for queued sync
  const lastSyncAtRef = useRef(0);    // timestamp of last completed sync
  // Tracks which projectId we've already resolved activePage for.
  // Prevents session token refreshes from snapping the user back to the URL's ?page= param.
  const activePageInitializedForRef = useRef(null);

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

      if (projectId && session?.access_token) {
        try {
          const remoteProject = await fetchWebsiteProjectFromServer(session, projectId, { pageName: requestedPage });
          if (remoteProject) {
            const localProject = !shouldForceReload ? nextProject : null;
            const localPages = Array.isArray(localProject?.pages) ? localProject.pages : [];
            const remotePages = Array.isArray(remoteProject.pages) ? remoteProject.pages : [];
            const localPageName = localPages.find((p) => slugify(p.name) === slugify(requestedPage))?.name || requestedPage;
            const remotePageName = remotePages.find((p) => slugify(p.name) === slugify(requestedPage))?.name || localPageName;
            const localBlocksForPage = Array.isArray(localProject?.pageBlocks?.[localPageName]) ? localProject.pageBlocks[localPageName] : [];
            const remoteBlocksForPage = Array.isArray(remoteProject?.pageBlocks?.[remotePageName]) ? remoteProject.pageBlocks[remotePageName] : [];
            const localTypes = new Set(localBlocksForPage.map((block) => String(block?.type || "")));
            const remoteHasMissingStructure = remoteBlocksForPage.some((block) => !localTypes.has(String(block?.type || "")));
            const remoteCleansInlineImages = containsInlineDataImage(localBlocksForPage) && !containsInlineDataImage(remoteBlocksForPage);
            const shouldRecoverRequestedPage = remoteBlocksForPage.length > 0 && (
              localBlocksForPage.length === 0
              || remoteCleansInlineImages
              || (remoteBlocksForPage.length > localBlocksForPage.length && remoteHasMissingStructure)
            );

            const shouldUseRemoteNow = shouldForceReload || !localProject || shouldRecoverRequestedPage;
            logWebsiteBuilderSaveDebug("builder reload compared local vs server", {
              projectId,
              requestedPage,
              localPageName,
              remotePageName,
              localUpdatedAt: localProject?.updatedAt || "",
              remoteUpdatedAt: remoteProject?.updatedAt || "",
              shouldForceReload,
              shouldRecoverRequestedPage,
              shouldUseRemoteNow,
              local: summarizeBuilderBlocksForSave(localBlocksForPage),
              remote: summarizeBuilderBlocksForSave(remoteBlocksForPage),
            });
            if (localProject?.id && !shouldForceReload) {
              const mergedProject = mergeRemotePageIntoProject(localProject, remoteProject, requestedPage);
              nextProject = updateWebsiteProject(localProject.id, mergedProject) || mergedProject;
            } else {
              nextProject = cacheWebsiteProject(remoteProject, { onlyIfNewer: !shouldUseRemoteNow });
            }
          }
        } catch (error) {
          console.warn("Could not load website draft from the server", error);
        }
      } else if (nextProject && projectId && session?.access_token) {
        // Local cache exists — still fetch server in background to pick up newer
        // server-side edits and any new pages added externally. Don't block the
        // initial render.
        fetchWebsiteProjectFromServer(session, projectId, { pageName: requestedPage }).then((remoteProject) => {
          if (!remoteProject || cancelled) return;
          const localProject = getWebsiteProject(projectId);
          const localUpdatedAt = Date.parse(localProject?.updatedAt || localProject?.createdAt || 0) || 0;
          const remoteUpdatedAt = Date.parse(remoteProject?.updatedAt || remoteProject?.createdAt || 0) || 0;

          const localPages = Array.isArray(localProject?.pages) ? localProject.pages : [];
          const remotePages = Array.isArray(remoteProject.pages) ? remoteProject.pages : [];
          const localNames = new Set(localPages.map((p) => p.name));
          const newPages = remotePages.filter((p) => !localNames.has(p.name));
          const remotePageBlocks = remoteProject.pageBlocks || {};
          const localPageBlocks = localProject?.pageBlocks || {};
          const localPageName = localPages.find((p) => slugify(p.name) === slugify(requestedPage))?.name || requestedPage;
          const remotePageName = remotePages.find((p) => slugify(p.name) === slugify(requestedPage))?.name || localPageName;
          const localBlocksForPage = Array.isArray(localPageBlocks[localPageName]) ? localPageBlocks[localPageName] : [];
          const remoteBlocksForPage = Array.isArray(remotePageBlocks[remotePageName]) ? remotePageBlocks[remotePageName] : [];
          const localTypes = new Set(localBlocksForPage.map((block) => String(block?.type || "")));
          const remoteHasMissingStructure = remoteBlocksForPage.some((block) => !localTypes.has(String(block?.type || "")));
          const remoteCleansInlineImages = containsInlineDataImage(localBlocksForPage) && !containsInlineDataImage(remoteBlocksForPage);
          const shouldRecoverRequestedPage = remoteBlocksForPage.length > 0 && (
            localBlocksForPage.length === 0
            || remoteCleansInlineImages
            || (remoteBlocksForPage.length > localBlocksForPage.length && remoteHasMissingStructure)
          );

          if (newPages.length === 0 && !shouldRecoverRequestedPage) {
            if (remoteUpdatedAt > localUpdatedAt) {
              console.warn("Skipped background website refresh because local project content is already loaded. Use force reload only when you intentionally want the server copy.");
            }
            return;
          }
          // Merge new pages + their blocks into the local project. Also recover
          // the requested page when a stale local cache has lost real page blocks.
          const mergedBlocks = { ...(localProject?.pageBlocks || {}) };
          for (const np of newPages) {
            if (remotePageBlocks[np.name]) mergedBlocks[np.name] = remotePageBlocks[np.name];
          }
          if (shouldRecoverRequestedPage) {
            mergedBlocks[localPageName] = remoteBlocksForPage;
          }
          updateWebsiteProject(projectId, {
            pages: [...localPages, ...newPages],
            pageBlocks: mergedBlocks,
            pagesContent: shouldRecoverRequestedPage
              ? { ...(localProject?.pagesContent || {}), [localPageName]: remoteProject?.pagesContent?.[remotePageName] || "" }
              : localProject?.pagesContent,
            chaiData: shouldRecoverRequestedPage && remoteProject?.chaiData?.[remotePageName]
              ? { ...(localProject?.chaiData || {}), [localPageName]: remoteProject.chaiData[remotePageName] }
              : localProject?.chaiData,
          });
          // Only update React state with the new pages — no existing blocks change,
          // so this won't disrupt any active editing.
          const refreshed = getWebsiteProject(projectId);
          if (refreshed && !cancelled) setProject(refreshed);
        }).catch(() => {});
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

      const resolvedDraftPage = resolveProjectPageName(requestedPage, nextProject) || requestedPage;
      const emergencyDraft = await fetchEmergencyPageDraft(nextProject.id || projectId, resolvedDraftPage);
      if (!cancelled && shouldUseEmergencyDraft(nextProject, resolvedDraftPage, emergencyDraft)) {
        nextProject = applyEmergencyDraftToProject(nextProject, resolvedDraftPage, emergencyDraft);
        cacheWebsiteProject(nextProject, { onlyIfNewer: false });
        flashNotice(`Recovered unsynced ${resolvedDraftPage} edits from disk`, "success", 6000);
      }

      if (!cancelled && nextProject?.id) {
        const repairedProject = await fetchLocalProjectRepair(nextProject.id || projectId);
        if (shouldRepairCollapsedProject(nextProject) || shouldUseLocalRepairProject(nextProject, repairedProject)) {
          const repairedPageCount = Array.isArray(repairedProject?.pages) ? repairedProject.pages.length : 0;
          const repairedPageName = resolveProjectPageName(requestedPage, repairedProject) || resolvedDraftPage;
          nextProject = emergencyDraft && shouldUseEmergencyDraft(repairedProject, repairedPageName, emergencyDraft)
            ? applyEmergencyDraftToProject(repairedProject, repairedPageName, emergencyDraft)
            : repairedProject;
          cacheWebsiteProject(nextProject, { onlyIfNewer: false });
          flashNotice(`Recovered ${repairedPageCount} website pages from disk`, "success", 8000);
        }
      }

      if (cancelled) return;
      setProject(nextProject);

      // Only reset activePage when the project itself changes (first load or different projectId).
      // Session token refreshes re-run this effect but must NOT snap the user back to the URL's
      // ?page= param — that's what causes the "jumps to Home" bug.
      const resolvedProjectId = nextProject?.id || projectId || "";
      if (activePageInitializedForRef.current !== resolvedProjectId) {
        activePageInitializedForRef.current = resolvedProjectId;
        const resolvedPage = nextProject?.pages?.find((entry) => slugify(entry.name) === slugify(requestedPage))?.name
          || nextProject?.pages?.[0]?.name
          || requestedPage;
        setActivePage(resolvedPage);
      }
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

        const payload = await readApiJson(response);
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || "Could not refresh AI website content");
        }

        // If the user saved manual edits while the API call was in-flight, bail out
        // to avoid overwriting their work.
        const currentBeforeWrite = getWebsiteProject(project.id);
        if (cancelled || currentBeforeWrite?.status === "saved") {
          setIsUpgrading(false);
          return;
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
    const savedPrimaryWebsite = project?.publication?.isPrimaryWebsite === true || project?.publication?.primaryWebsite === true;
    if (savedPrimaryWebsite !== primaryWebsite) {
      setPrimaryWebsite(savedPrimaryWebsite);
    }
  }, [project?.id, project?.publication?.customDomain, project?.publication?.custom_domain, project?.publication?.isPrimaryWebsite, project?.publication?.primaryWebsite]);

  const currentObjective = useMemo(() => {
    const pageEntry = project?.pages?.find((entry) => entry.name === activePage || slugify(entry.name) === slugify(activePage));
    return pageEntry?.objective || "Build this page in the visual editor.";
  }, [project, activePage]);

  function resolveProjectPageName(pageName = activePage, sourceProject = project) {
    const requested = pageNameFromValue(pageName);
    if (!requested) return "";
    return sourceProject?.pages?.find((entry) => entry.name === requested || slugify(entry.name) === slugify(requested))?.name || requested;
  }

  function mergeRemotePageIntoProject(localProject, remoteProject, requestedPage) {
    if (!remoteProject) return localProject || null;
    if (!localProject?.id) return remoteProject;

    const localPages = Array.isArray(localProject.pages) ? localProject.pages : [];
    const remotePages = Array.isArray(remoteProject.pages) ? remoteProject.pages : [];
    const localPageName = localPages.find((p) => slugify(p.name) === slugify(requestedPage))?.name
      || remotePages.find((p) => slugify(p.name) === slugify(requestedPage))?.name
      || requestedPage;
    const remotePageName = remotePages.find((p) => slugify(p.name) === slugify(requestedPage))?.name || localPageName;
    const localBlocks = Array.isArray(localProject?.pageBlocks?.[localPageName]) ? localProject.pageBlocks[localPageName] : [];
    const remoteBlocks = Array.isArray(remoteProject?.pageBlocks?.[remotePageName]) ? remoteProject.pageBlocks[remotePageName] : null;
    const remoteHtml = remoteProject?.pagesContent?.[remotePageName];
    const remoteChai = remoteProject?.chaiData?.[remotePageName];
    const localUpdatedAt = Date.parse(localProject?.updatedAt || localProject?.createdAt || 0) || 0;
    const remoteUpdatedAt = Date.parse(remoteProject?.updatedAt || remoteProject?.createdAt || 0) || 0;
    const localTypes = new Set(localBlocks.map((block) => String(block?.type || "")));
    const remoteHasMissingStructure = Array.isArray(remoteBlocks)
      && remoteBlocks.some((block) => !localTypes.has(String(block?.type || "")));
    const remoteCleansInlineImages = containsInlineDataImage(localBlocks) && !containsInlineDataImage(remoteBlocks);
    const shouldUseRemoteBlocks = Array.isArray(remoteBlocks) && (
      remoteUpdatedAt > localUpdatedAt
      || (remoteUpdatedAt >= localUpdatedAt && !blocksMatchForSave(localBlocks, remoteBlocks))
      || localBlocks.length === 0
      || remoteCleansInlineImages
      || (remoteBlocks.length > localBlocks.length && remoteHasMissingStructure)
    );

    const localNames = new Set(localPages.map((p) => p.name));
    const mergedPages = [
      ...localPages,
      ...remotePages.filter((p) => p?.name && !localNames.has(p.name)),
    ];

    return {
      ...localProject,
      ...remoteProject,
      pages: mergedPages.length ? mergedPages : remotePages,
      pageBlocks: {
        ...(localProject?.pageBlocks || {}),
        ...(shouldUseRemoteBlocks ? { [localPageName]: remoteBlocks } : {}),
      },
      pagesContent: {
        ...(localProject?.pagesContent || {}),
        ...(shouldUseRemoteBlocks && remoteHtml !== undefined ? { [localPageName]: remoteHtml || "" } : {}),
      },
      chaiData: {
        ...(localProject?.chaiData || {}),
        ...(shouldUseRemoteBlocks && remoteChai ? { [localPageName]: remoteChai } : {}),
      },
      globalNavBlock: "globalNavBlock" in remoteProject ? remoteProject.globalNavBlock : localProject.globalNavBlock,
      globalFooterBlock: "globalFooterBlock" in remoteProject ? remoteProject.globalFooterBlock : localProject.globalFooterBlock,
      updatedAt: remoteProject?.updatedAt || localProject?.updatedAt,
    };
  }

  function stableJson(value) {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function jsonRoundTrip(value) {
    return JSON.parse(JSON.stringify(value ?? null));
  }

  function isImageLikeField(key = "") {
    return /(^|[._-])(image|src|logo|avatar|poster|backgroundImage|mediaImage)$/i.test(String(key || ""));
  }

  function isExternalizedBuilderAsset(value = "") {
    return /^\/assets\/website-builder\//i.test(String(value || ""));
  }

  function containsInlineDataImage(value) {
    if (typeof value === "string") return /^data:image\//i.test(value);
    if (Array.isArray(value)) return value.some((entry) => containsInlineDataImage(entry));
    if (value && typeof value === "object") {
      return Object.values(value).some((entry) => containsInlineDataImage(entry));
    }
    return false;
  }

  function normalizeForSaveCompare(value, key = "") {
    if (typeof value === "string") {
      if (/^data:image\//i.test(value)) return "__WB_DATA_IMAGE__";
      if (value === "__WB_PRESERVE_DATA_URL__") return "__WB_DATA_IMAGE__";
      if (isImageLikeField(key) && isExternalizedBuilderAsset(value)) return "__WB_DATA_IMAGE__";
      return value;
    }
    if (Array.isArray(value)) return value.map((entry) => normalizeForSaveCompare(entry, key));
    if (value && typeof value === "object") {
      const next = {};
      for (const [key, child] of Object.entries(value)) {
        next[key] = normalizeForSaveCompare(child, key);
      }
      return next;
    }
    return value;
  }

  function blocksMatchForSave(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    return stableJson(jsonRoundTrip(normalizeForSaveCompare(left))) === stableJson(jsonRoundTrip(normalizeForSaveCompare(right)));
  }

  function getSavedPageBlocks(projectLike, pageName) {
    if (Array.isArray(projectLike?.pageBlocks?.[pageName])) return projectLike.pageBlocks[pageName];
    if (Array.isArray(projectLike?.chaiData?.[pageName]?.blocks)) return projectLike.chaiData[pageName].blocks;
    return null;
  }

  function waitForSaveVerification(ms = 750) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function flashNotice(message, tone = "info", duration = null) {
    const normalized = normalizeBuilderNotice(message);
    if (!normalized) {
      clearNotice();
      return;
    }
    setNotice(normalized);
    setNoticeTone(tone);
    setNoticeDuration(duration ?? (tone === "error" ? 6500 : 2400));
  }

  function clearNotice() {
    setNotice("");
    setNoticeTone("info");
    setNoticeDuration(2400);
  }

  async function syncProjectToServer(nextProject, options = {}) {
    if (!session?.access_token || !nextProject?.id) return nextProject;
    const syncPageName = resolveProjectPageName(options?.pageName || activePage, nextProject);

    // Throttle: if a sync is already in-flight, or fired too recently,
    // queue this project and bail. The queued sync fires automatically.
    // forceSaveBlockPage passes options.force to bypass throttling.
    if (!options?.force) {
      const MIN_INTERVAL_MS = 5000;
      const now = Date.now();
      if (syncInFlightRef.current || now - lastSyncAtRef.current < MIN_INTERVAL_MS) {
        syncQueuedRef.current = {
          project: nextProject,
          options: {
            ...options,
            pageName: syncPageName,
          },
        };
        if (!syncTimerRef.current) {
          const delay = syncInFlightRef.current
            ? MIN_INTERVAL_MS
            : MIN_INTERVAL_MS - (now - lastSyncAtRef.current);
          syncTimerRef.current = setTimeout(() => {
            syncTimerRef.current = null;
            const queued = syncQueuedRef.current;
            syncQueuedRef.current = null;
            if (queued?.project) {
              syncProjectToServer(queued.project, { ...(queued.options || {}), force: true });
            }
          }, Math.max(delay, 100));
        }
        return nextProject;
      }
    }

    // When forcing a sync, cancel any pending deferred autosave timer.
    // Deferred syncs hold an older snapshot of the project and must not
    // overwrite the force save that is about to start.
    if (options?.force && syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
      syncQueuedRef.current = null;
    }

    syncInFlightRef.current = true;

    try {
      let syncedProject;
      try {
        syncedProject = await saveWebsiteProjectToServer(session, nextProject, {
          pageName: options?.siteOnly ? "" : syncPageName,
          siteOnly: options?.siteOnly === true,
          saveSource: options?.saveSource || (options?.force ? "manual-save" : "autosave"),
        });
      } catch (firstError) {
        // If the token is stale (401), refresh and retry once
        if (String(firstError?.message || "").includes("401")) {
          try {
            const { data: refreshed } = await supabase.auth.refreshSession();
            if (refreshed?.session?.access_token) {
              syncedProject = await saveWebsiteProjectToServer(refreshed.session, nextProject, {
                pageName: options?.siteOnly ? "" : syncPageName,
                siteOnly: options?.siteOnly === true,
                saveSource: options?.saveSource || (options?.force ? "manual-save" : "autosave"),
              });
            } else {
              throw firstError;
            }
          } catch {
            throw firstError;
          }
        } else {
          throw firstError;
        }
      }
      if (!syncedProject) return nextProject;

      // After the async server round-trip the user may have made more edits.
      // Get the freshest local copy and merge it with the server response so that
      // server-side metadata (publication, domain status, etc.) is preserved while
      // any newer local page content (blocks, chaiData) is NOT overwritten.
      // NOTE: use !== undefined (not ??) so that an explicit null (e.g. a deleted
      // global block) is kept rather than being replaced by the stale server value.
      const currentLocal = getWebsiteProject(nextProject.id);
      const outboundUpdatedAt = Date.parse(nextProject?.updatedAt || nextProject?.createdAt || 0) || 0;
      const localUpdatedAt = Date.parse(currentLocal?.updatedAt || currentLocal?.createdAt || 0) || 0;
      const mergeBase = localUpdatedAt > outboundUpdatedAt ? currentLocal : nextProject;
      const baseHas = (key) => mergeBase !== null && key in Object(mergeBase);

      // When the local cache has pageBlocks, always trust local as source of truth.
      // Merging server extras caused deleted blocks to be resurrected on every sync.
      // EXCEPTION: if the server has pages that local doesn't know about, keep those too.
      const mergePageBlocks = (serverPB, localPB) => {
        if (!localPB) return serverPB;
        if (!serverPB) return localPB;
        // Add any page blocks from server that local doesn't have (e.g. added via script)
        const merged = { ...localPB };
        for (const key of Object.keys(serverPB)) {
          if (!(key in merged)) merged[key] = serverPB[key];
        }
        return merged;
      };
      const mergePages = (serverPages, localPages) => {
        if (!localPages || localPages.length === 0) return serverPages;
        if (!serverPages || serverPages.length === 0) return localPages;
        // Keep all local pages; append any server pages not already present locally
        const localNames = new Set(localPages.map((p) => p.name));
        const extras = serverPages.filter((p) => !localNames.has(p.name));
        return extras.length ? [...localPages, ...extras] : localPages;
      };

      const mergedProject = {
        ...syncedProject,
        pages: mergePages(syncedProject.pages, baseHas("pages") ? mergeBase.pages : null),
        pageBlocks: baseHas("pageBlocks") ? mergePageBlocks(syncedProject.pageBlocks, mergeBase.pageBlocks) : syncedProject.pageBlocks,
        chaiData: baseHas("chaiData") ? mergeBase.chaiData : syncedProject.chaiData,
        pagesContent: baseHas("pagesContent") ? mergeBase.pagesContent : syncedProject.pagesContent,
        globalNavBlock: baseHas("globalNavBlock") ? mergeBase.globalNavBlock : syncedProject.globalNavBlock,
        globalFooterBlock: baseHas("globalFooterBlock") ? mergeBase.globalFooterBlock : syncedProject.globalFooterBlock,
      };

      const cachedProject = cacheWebsiteProject(mergedProject, { onlyIfNewer: false });
      if (cachedProject?.id === project?.id) {
        setProject(cachedProject);
      }
      return cachedProject || nextProject;
    } catch (error) {
      console.warn("Could not sync website draft to the server", error);
      if (options?.force) {
        flashNotice(error?.message || "Cloud sync failed. Work is local only and no server backup was created yet.", "error", 15000);
        return { ...(nextProject || {}), _saveError: true, _saveErrorMessage: error?.message || "Cloud sync failed" };
      }
      if (!options?.silent) {
        flashNotice(error?.message || "Saved locally only. Cloud sync failed, so this edit is not protected by a server backup yet.", "error", 10000);
      }
      return nextProject;
    } finally {
      lastSyncAtRef.current = Date.now();
      syncInFlightRef.current = false;
      // After a forced sync the queue may hold an older autosave snapshot.
      // Sending it would overwrite the server's freshly-committed blocks with
      // stale data, which then races the preview tab's server fetch and can
      // cause the preview to show an older version of the page.
      // Simply discard the queue here — the next real autosave will re-sync.
      if (options?.force) {
        syncQueuedRef.current = null;
      } else if (syncQueuedRef.current && !syncTimerRef.current) {
        // Fire any queued sync that accumulated while a normal autosave was in-flight
        const queued = syncQueuedRef.current;
        syncQueuedRef.current = null;
        syncTimerRef.current = setTimeout(() => {
          syncTimerRef.current = null;
          if (queued?.project) {
            syncProjectToServer(queued.project, { ...(queued.options || {}), force: true });
          }
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
      let projectForPublish = getWebsiteProject(project.id) || project;
      const savedBeforePublish = await Promise.resolve(previewActionsRef.current?.saveCurrent?.({ saveSource: "publish-preflight" }));
      if (savedBeforePublish?._saveError) {
        throw new Error(savedBeforePublish._saveErrorMessage || "Could not save the latest page before publishing.");
      }
      projectForPublish = savedBeforePublish || getWebsiteProject(project.id) || projectForPublish;
      const videoHeroMedia = collectVideoHeroMedia(projectForPublish?.pageBlocks || {});
      console.log("[website-builder publish] Video Hero media being published", {
        projectId: projectForPublish?.id || project.id,
        activePage: activeProjectPageName,
        videoHeroMedia,
      });

      const response = await fetch("/api/websites/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          slug: normalizedSlug,
          customDomain: normalizeDomain(customDomain),
          primaryWebsite,
          project: {
            ...projectForPublish,
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
        primaryWebsiteUrl: payload.primaryWebsiteUrl || payload.liveUrl || "",
        internalPreviewUrl: payload.internalPreviewUrl || payload.defaultUrl || buildHostedWebsiteUrl({ slug: normalizedSlug }),
        customDomainInstructions: payload.customDomainInstructions || null,
        isPrimaryWebsite: payload.primaryWebsite === true,
        primaryWebsite: payload.primaryWebsite === true,
        rootUrl: payload.rootUrl || "",
      };

      const updated = saveProjectPatch({ publication: nextPublication }, "Website published", { siteOnly: true, saveSource: "publish" });
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

  function saveProjectPatch(patch, successMessage = "Saved changes", syncOptions = {}) {
    if (!project?.id) return null;

    // If the project isn't in localStorage yet (e.g. freshly loaded from server),
    // cache it first so updateWebsiteProject can find it by id.
    let currentProject = getWebsiteProject(project.id);
    if (!currentProject) {
      cacheWebsiteProject(project, { onlyIfNewer: false });
      currentProject = getWebsiteProject(project.id) || project;
    }

    const savedProject = updateWebsiteProject(project.id, {
      ...currentProject,
      ...patch,
      status: "saved",
    });

    // Storage quota exceeded — force immediate cloud sync so nothing is lost
    if (savedProject?._localSaveFailed) {
      const projectToSync = { ...currentProject, ...patch, status: "saved", _localSaveFailed: undefined };
      flashNotice("⚠️ Storage full — saving to cloud only. Do not close this tab.", "error", 10000);
      void syncProjectToServer(projectToSync, { silent: false, force: true, pageName: activePage, saveSource: "manual-save", ...syncOptions }).then((synced) => {
        if (synced) flashNotice("✓ Auto-saved to cloud (local storage full)", "success", 6000);
      }).catch(() => {});
      return projectToSync;
    }

    let latest = null;
    try {
      latest = getWebsiteProject(project.id);
    } catch (_error) {
      latest = null;
    }

    if (savedProject && latest) {
      setProject(latest);
      if (successMessage) flashNotice(successMessage);
      else clearNotice();
      void syncProjectToServer(latest, { silent: true, pageName: activePage, saveSource: "autosave", ...syncOptions });
      return latest;
    }

    if (!savedProject) {
      flashNotice("⚠️ Could not save — storage full. Please click Save to force cloud sync.", "error", 8000);
    } else {
      setProject(savedProject);
      if (successMessage) flashNotice(successMessage);
      else clearNotice();
      void syncProjectToServer(savedProject, { silent: true, pageName: activePage, saveSource: "autosave", ...syncOptions });
      return savedProject;
    }

    return null;
  }

  function navigateToPage(pageName) {
    const nextPage = pageNameFromValue(pageName);
    if (!nextPage) return;
    setActivePage(nextPage);

    if (!router.isReady) return;
    router.replace(
      {
        pathname: router.pathname,
        query: {
          ...router.query,
          page: nextPage,
        },
      },
      undefined,
      { shallow: true }
    );
  }

  function handleAddPage(nameOverride) {
    const pageName = pageNameFromValue(nameOverride || newPageName);
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
      `Added ${pageName}`,
      { pageName, saveSource: "manual-save" }
    );

    navigateToPage(pageName);
    setNewPageName("");
    return pageName;
  }

  function handleDeletePage(name) {
    if (!project?.pages || project.pages.length <= 1) {
      flashNotice("Cannot delete the only page.");
      return;
    }
    const pageName = pageNameFromValue(name);
    if (!pageName) return;
    const nextPages = project.pages.filter((p) => p.name !== pageName);
    const nextPageBlocks = { ...(project.pageBlocks || {}) };
    delete nextPageBlocks[pageName];
    const nextChaiData = { ...(project.chaiData || {}) };
    delete nextChaiData[pageName];
    const nextPagesContent = { ...(project.pagesContent || {}) };
    delete nextPagesContent[pageName];
    saveProjectPatch({ pages: nextPages, pageBlocks: nextPageBlocks, chaiData: nextChaiData, pagesContent: nextPagesContent }, `Deleted ${pageName}`, { siteOnly: true, saveSource: "manual-save" });
    if (activePage === pageName) navigateToPage(nextPages[0]?.name || "Home");
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
    }, `Renamed to ${trimmed}`, { pageName: trimmed, saveSource: "manual-save" });
    if (activePage === oldName) navigateToPage(trimmed);
  }

  function beginRenamePage(event, pageName) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (event?.nativeEvent?.stopImmediatePropagation) {
      event.nativeEvent.stopImmediatePropagation();
    }
    setRenamingPage(pageName);
    setRenameValue(pageName);
  }

  // Expose page-add helper for testing / automation
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    window.__addBuilderPage = (name) => handleAddPage(name);
    return () => { delete window.__addBuilderPage; };
  });

  async function saveChaiPage(data, successMessage = `Saved ${activePage}`, options = {}) {
    const currentProject = project?.id ? (getWebsiteProject(project.id) || project) : project;
    const pageName = resolveProjectPageName(options?.pageName || activePage, currentProject);
    const safeData = data || buildStarterChaiData(currentProject, pageName);
    const safeBlocks = Array.isArray(safeData?.blocks) ? safeData.blocks : [];
    const html = "";

    await saveEmergencyPageDraft(currentProject?.id, pageName, {
      blocks: safeBlocks,
      html,
      chaiData: safeData,
      source: options?.saveSource || "autosave",
    });

    return saveProjectPatch(
      {
        chaiData: {
          ...(currentProject?.chaiData || {}),
          [pageName]: safeData,
        },
        pageBlocks: {
          ...(currentProject?.pageBlocks || {}),
          [pageName]: safeBlocks,
        },
        pagesContent: {
          ...(currentProject?.pagesContent || {}),
          [pageName]: "",
        },
      },
      successMessage,
      { pageName, saveSource: options?.saveSource || "autosave" }
    );
  }

  // Strip blob: URLs from block props before persisting — blobs are in-memory
  // only and die on page refresh, so they must never reach the server or localStorage.
  function stripBlobUrls(blocks) {
    if (!Array.isArray(blocks)) return blocks;
    return blocks.map((block) => {
      if (!block?.props) return block;
      const cleanProps = { ...block.props };
      for (const key of Object.keys(cleanProps)) {
        if (typeof cleanProps[key] === "string" && cleanProps[key].startsWith("blob:")) {
          cleanProps[key] = "";
        }
      }
      return { ...block, props: cleanProps };
    });
  }

  function validateImageReferences(blocks) {
    const issues = [];
    const visit = (value, path = []) => {
      if (typeof value === "string") {
        const key = String(path[path.length - 1] || "");
        if (/^blob:/i.test(value)) {
          issues.push({ path: path.join("."), reason: "temporary browser image URL" });
        }
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((entry, index) => visit(entry, [...path, index]));
        return;
      }
      if (value && typeof value === "object") {
        Object.entries(value).forEach(([key, entry]) => visit(entry, [...path, key]));
      }
    };
    visit(Array.isArray(blocks) ? blocks : []);
    return issues;
  }

  function saveBlockPage(blocks, successMessage = `Saved ${activePage}`, options = {}) {
    const currentProject = project?.id ? (getWebsiteProject(project.id) || project) : project;
    const pageName = resolveProjectPageName(options?.pageName || activePage, currentProject);
    const imageIssues = validateImageReferences(Array.isArray(blocks) ? blocks : []);
    if (imageIssues.length) {
      const message = `Cannot save ${pageName}: ${imageIssues.length} image reference must finish uploading first.`;
      flashNotice(message, "error", 15000);
      return { _saveError: true, _saveErrorMessage: message, imageIssues };
    }
    const safeBlocks = stripBlobUrls(Array.isArray(blocks) ? blocks : []);
    return saveChaiPage({
      ...(currentProject?.chaiData?.[pageName] || {}),
      blocks: safeBlocks,
      theme: currentProject?.chaiData?.[pageName]?.theme || { preset: currentProject?.stylePack || "premium" },
      designTokens: currentProject?.chaiData?.[pageName]?.designTokens || {},
    }, successMessage, { pageName, saveSource: options?.saveSource || "autosave" });
  }

  // forceSaveBlockPage: used by the manual Save button / Ctrl+S.
  // Awaits the cloud sync and surfaces errors so the user knows if data didn't reach the server.
  async function forceSaveBlockPage(blocks, options = {}) {
    try {
      const currentProject = project?.id ? (getWebsiteProject(project.id) || project) : project;
      const pageName = resolveProjectPageName(options?.pageName || activePage, currentProject);
      const isPreviewSave = options?.saveSource === "preview-autosave";
      if (!currentProject?.id) {
        console.error("[forceSaveBlockPage] project has no id — project state:", project);
        flashNotice("Could not save — project not loaded yet. Please wait and try again.", "error");
        return null;
      }

      const imageIssues = validateImageReferences(Array.isArray(blocks) ? blocks : []);
      if (imageIssues.length) {
        const message = `Cannot save ${pageName}: ${imageIssues.length} image reference must finish uploading first.`;
        flashNotice(message, "error", 15000);
        return { ...(currentProject || {}), _saveError: true, _saveErrorMessage: message, imageIssues };
      }

      const safeBlocks = stripBlobUrls(Array.isArray(blocks) ? blocks : []);

      // Build the chai data payload
      const chaiData = {
        ...(currentProject?.chaiData?.[pageName] || {}),
        blocks: safeBlocks,
        theme: currentProject?.chaiData?.[pageName]?.theme || { preset: currentProject?.stylePack || "premium" },
        designTokens: currentProject?.chaiData?.[pageName]?.designTokens || {},
      };

      const html = "";

      const patch = {
        chaiData: { ...(currentProject?.chaiData || {}), [pageName]: chaiData },
        pageBlocks: { ...(currentProject?.pageBlocks || {}), [pageName]: safeBlocks },
        pagesContent: { ...(currentProject?.pagesContent || {}), [pageName]: html },
        status: "saved",
      };

      const projectWithPatch = { ...currentProject, ...patch, updatedAt: new Date().toISOString() };

      if (!isPreviewSave) {
        await saveEmergencyPageDraft(currentProject.id, pageName, {
          blocks: safeBlocks,
          html,
          chaiData,
          source: options?.saveSource || "manual-save",
        });
      }

      if (!isPreviewSave && !getWebsiteProject(currentProject.id)) {
        cacheWebsiteProject(currentProject, { onlyIfNewer: false });
      }
      const stagedProject = isPreviewSave
        ? projectWithPatch
        : (updateWebsiteProject(currentProject.id, projectWithPatch) || projectWithPatch);
      const projectToSync = {
        ...stagedProject,
        _localSaveFailed: undefined,
      };
      const normalizedBlocks = Array.isArray(projectToSync?.pageBlocks?.[pageName])
        ? projectToSync.pageBlocks[pageName]
        : safeBlocks;
      if (!isPreviewSave) setProject(projectToSync);

      logWebsiteBuilderSaveDebug("force save payload prepared", {
        projectId: currentProject.id,
        pageName,
        saveSource: options?.saveSource || "manual-save",
        isPreviewSave,
        activePage,
        resolvedPageName: pageName,
        payload: summarizeBuilderBlocksForSave(normalizedBlocks),
      });

      // Stage the current edit locally before cloud sync so the async merge below
      // cannot treat an older cache entry as the source of truth and roll blocks back.
      let serverSynced = null;
      try {
        serverSynced = await syncProjectToServer(projectToSync, { silent: true, force: true, pageName, saveSource: options?.saveSource || "manual-save" });
      } catch (serverErr) {
        console.warn("[forceSaveBlockPage] server sync failed:", serverErr);
        flashNotice("Could not save to cloud. Work is local only and no server backup was created yet.", "error", 15000);
        if (isPreviewSave) {
          return { ...(currentProject || {}), _saveError: true, _saveErrorMessage: serverErr?.message || "Cloud sync failed" };
        }
        // Still write to localStorage so the preview tab can load the latest local copy.
        if (!getWebsiteProject(currentProject.id)) {
          cacheWebsiteProject(currentProject, { onlyIfNewer: false });
        }
        updateWebsiteProject(currentProject.id, projectWithPatch);
        setProject(projectWithPatch);
        return { ...projectWithPatch, _saveError: true, _saveErrorMessage: serverErr?.message || "Cloud sync failed" };
      }

      if (serverSynced?._saveError) {
        if (isPreviewSave) return serverSynced;
        updateWebsiteProject(currentProject.id, projectWithPatch);
        setProject(projectWithPatch);
        return serverSynced;
      }

      logWebsiteBuilderSaveDebug("server sync response received", {
        projectId: currentProject.id,
        pageName,
        updatedAt: serverSynced?.updatedAt || "",
        stored: summarizeBuilderBlocksForSave(getSavedPageBlocks(serverSynced, pageName) || []),
      });

      let verifiedProject = null;
      let verifiedSaveMatches = false;
      try {
        verifiedProject = session?.access_token
          ? await fetchWebsiteProjectFromServer(session, currentProject.id, { pageName })
          : null;
        let verifiedBlocks = getSavedPageBlocks(verifiedProject, pageName);
        logWebsiteBuilderSaveDebug("post-save fetch verification", {
          projectId: currentProject.id,
          pageName,
          updatedAt: verifiedProject?.updatedAt || "",
          stored: summarizeBuilderBlocksForSave(verifiedBlocks || []),
          matchesPayload: blocksMatchForSave(normalizedBlocks, verifiedBlocks),
        });
        if (!blocksMatchForSave(normalizedBlocks, verifiedBlocks) && session?.access_token) {
          await waitForSaveVerification();
          verifiedProject = await fetchWebsiteProjectFromServer(session, currentProject.id, { pageName });
          verifiedBlocks = getSavedPageBlocks(verifiedProject, pageName);
          logWebsiteBuilderSaveDebug("post-save fetch verification retry", {
            projectId: currentProject.id,
            pageName,
            updatedAt: verifiedProject?.updatedAt || "",
            stored: summarizeBuilderBlocksForSave(verifiedBlocks || []),
            matchesPayload: blocksMatchForSave(normalizedBlocks, verifiedBlocks),
          });
        }
        if (!blocksMatchForSave(normalizedBlocks, verifiedBlocks)) {
          const syncedBlocks = getSavedPageBlocks(serverSynced, pageName);
          if (blocksMatchForSave(normalizedBlocks, syncedBlocks)) {
            verifiedProject = serverSynced;
            verifiedBlocks = syncedBlocks;
            verifiedSaveMatches = true;
          } else {
            console.error("[forceSaveBlockPage] save verification mismatch; keeping staged save as local source.", {
            pageName,
            editorBlockCount: normalizedBlocks.length,
            verifiedBlockCount: Array.isArray(verifiedBlocks) ? verifiedBlocks.length : null,
            syncedBlockCount: Array.isArray(syncedBlocks) ? syncedBlocks.length : null,
          });
            const message = `Save verification failed for ${pageName}. The cloud copy did not contain the text blocks that were just saved.`;
            flashNotice(message, "error", 15000);
            return {
              ...projectWithPatch,
              _saveError: true,
              _saveErrorMessage: message,
              _saveDebug: {
                payload: summarizeBuilderBlocksForSave(normalizedBlocks),
                verified: summarizeBuilderBlocksForSave(verifiedBlocks || []),
                synced: summarizeBuilderBlocksForSave(syncedBlocks || []),
              },
            };
          }
        } else {
          verifiedSaveMatches = true;
        }
      } catch (verifyErr) {
        console.error("[forceSaveBlockPage] save verification check failed after cloud save.", verifyErr);
        const syncedBlocks = getSavedPageBlocks(serverSynced, pageName);
        if (blocksMatchForSave(normalizedBlocks, syncedBlocks)) {
          verifiedProject = serverSynced;
          verifiedSaveMatches = true;
        } else {
          const message = `Save verification failed for ${pageName}. Could not confirm the saved text in cloud storage.`;
          flashNotice(message, "error", 15000);
          return {
            ...projectWithPatch,
            _saveError: true,
            _saveErrorMessage: message,
            _saveDebug: {
              payload: summarizeBuilderBlocksForSave(normalizedBlocks),
              synced: summarizeBuilderBlocksForSave(syncedBlocks || []),
            },
          };
        }
      }

      const verifiedPagePatch = verifiedProject && typeof verifiedProject === "object" ? {
        ...(Array.isArray(verifiedProject?.pageBlocks?.[pageName]) ? {
          pageBlocks: {
            ...(projectWithPatch.pageBlocks || {}),
            [pageName]: verifiedProject.pageBlocks[pageName],
          },
        } : {}),
        ...(Object.prototype.hasOwnProperty.call(verifiedProject?.pagesContent || {}, pageName) ? {
          pagesContent: {
            ...(projectWithPatch.pagesContent || {}),
            [pageName]: verifiedProject.pagesContent[pageName] || "",
          },
        } : {}),
        ...(Object.prototype.hasOwnProperty.call(verifiedProject?.chaiData || {}, pageName) ? {
          chaiData: {
            ...(projectWithPatch.chaiData || {}),
            [pageName]: verifiedProject.chaiData[pageName],
          },
        } : {}),
        updatedAt: verifiedProject.updatedAt || projectWithPatch.updatedAt,
        status: "saved",
      } : {};

      const projectToStore = {
        ...((verifiedSaveMatches && serverSynced) || projectWithPatch),
        ...verifiedPagePatch,
      };

      // ── THEN refresh localStorage with the server-normalized project ───────
      const savedProject = updateWebsiteProject(currentProject.id, projectToStore);
      const latest = savedProject && !savedProject._localSaveFailed
        ? getWebsiteProject(currentProject.id)
        : null;

      if (savedProject?._localSaveFailed || !savedProject) {
        // localStorage full — data is already safe on the server, just warn
        console.warn("[forceSaveBlockPage] localStorage full — data saved to server only");
        setProject(projectToStore);
        flashNotice(`✓ Saved to cloud — local storage full. Your work is safe.`, "success", 6000);
        return projectToStore;
      }

      if (latest) setProject(latest);
      clearNotice();
      flashNotice(`Saved ✓ ${pageName}`, "success");
      return latest || savedProject;
    } catch (unexpectedErr) {
      console.error("[forceSaveBlockPage] unexpected error:", unexpectedErr);
      flashNotice("Save encountered an error — please try again.", "error");
      return null;
    }
  }

  useEffect(() => {
    let cancelled = false;

    const syncServerDefaults = async () => {
      try {
        const response = await fetch("/api/website-builder/defaults", {
          cache: "no-store",
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        });
        const payload = await readApiJson(response);
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

      } catch (error) {
        console.warn("Could not load website builder defaults", error);
      }
    };

    syncServerDefaults();

    return () => {
      cancelled = true;
    };
  }, [project?.id, project?.templateSlug, session?.access_token]);

  async function saveTemplatePageToServer({ pageName, blocks, globalNavBlock, globalFooterBlock }) {
    if (!project?.templateSlug) return false;

    try {
      const response = await fetch("/api/website-builder/defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({
          action: "save-template-page",
          templateSlug: project.templateSlug,
          pageName,
          blocks,
          globalNavBlock,
          globalFooterBlock,
        }),
      });
      const payload = await readApiJson(response);
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
        headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({
          action: "save-template-site",
          templateSlug: project.templateSlug,
          pageBlocks,
          globalNavBlock,
          globalFooterBlock,
        }),
      });
      const payload = await readApiJson(response);
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
        headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({
          action: "save-block-default",
          blockType,
          props: block?.props || {},
        }),
      });
      const payload = await readApiJson(response);
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
    if (role === "nav" && block.type !== BlockTypes.NAV_BAR) {
      flashNotice("Only a Navigation Bar block can be saved as global navigation.", "error", 6000);
      return;
    }
    if (role === "footer" && block.type !== BlockTypes.FOOTER) {
      flashNotice("Only a Footer block can be saved as global footer.", "error", 6000);
      return;
    }
    const field = role === "nav" ? "globalNavBlock" : "globalFooterBlock";
    saveProjectPatch({ [field]: block }, `Saved as global ${role === "nav" ? "navigation" : "footer"} — shows on every page`, { siteOnly: true, saveSource: "manual-save" });
  }

  function updateGlobalBlock(role, block) {
    if (!project?.id) return;
    const field = role === "nav" ? "globalNavBlock" : "globalFooterBlock";
    // block === null means "delete this global block"
    saveProjectPatch({ [field]: block ?? null }, `Updated global ${role === "nav" ? "navigation" : "footer"}`, { siteOnly: true, saveSource: "manual-save" });
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
      // Video bytes go straight to Supabase Storage from the browser; the API
      // only issues a signed upload URL so Vercel never receives the MP4 body.
      const videoFieldKeys = ["backgroundVideoUrl", "__video_hero_src__"];
      const isVideo = file.type?.startsWith("video/") || videoFieldKeys.includes(String(fieldKey || ""));
      if (isVideo) {
        if (Number(file.size || 0) > WEBSITE_BUILDER_MAX_VIDEO_BYTES) {
          throw new Error("That video is too large. Please upload a video up to 250 MB.");
        }
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token || "";
        if (!token) throw new Error("You must be signed in to upload videos.");
        const signedRes = await fetch("/api/website-builder/upload-video", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "create-signed-upload",
            name: file.name || "upload.mp4",
            type: file.type || "video/mp4",
            size: file.size || 0,
          }),
        });
        const json = await signedRes.json().catch(() => ({}));
        if (signedRes.status === 413) {
          throw new Error(json?.error || "That video is too large. Please upload a video up to 250 MB.");
        }
        if (!signedRes.ok || !json?.token || !json?.storagePath || !json?.src) {
          throw new Error(json?.error || `Video upload could not start (HTTP ${signedRes.status})`);
        }

        const { error: uploadError } = await supabase.storage
          .from("assets")
          .uploadToSignedUrl(json.storagePath, json.token, file, {
            contentType: file.type || "video/mp4",
          });
        if (uploadError) throw new Error(uploadError.message || "Video upload failed. Please try again.");

        await waitForPublicVideoUrlToLoad(json.src);

        fetch("/api/website-builder/upload-video", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "complete-signed-upload",
            storagePath: json.storagePath,
            name: file.name || "upload.mp4",
            type: file.type || "video/mp4",
          }),
        }).catch(() => {});

        const asset = { id: json.id || `asset-${Date.now()}`, name: json.name || file.name, type: json.type || file.type, src: json.src };
        const existingVideos = Array.isArray(brandAssets?.videos) ? brandAssets.videos : [];
        const dedupedVideos = existingVideos.filter((video) => video?.src && video.src !== asset.src && video.name !== asset.name);
        persistAssets(mergeWebsiteBuilderAssetSources({
          ...brandAssets,
          videos: [asset, ...dedupedVideos],
        }));
        flashNotice(`${file.name} uploaded`);
        return asset;
      }

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
      flashNotice(error?.message || "Upload failed.");
      throw error;
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
  const predictedPrimaryWebsiteUrl = customDomain
    ? buildWebsiteUrl({ slug: siteSlug || displayName || "site", domain: customDomain })
    : predictedHostedUrl;
  const resolvedPublicationLiveUrl = publication
    ? (publication.primaryWebsiteUrl || publication.liveUrl || (publication.customDomain
      ? buildWebsiteUrl({ slug: publication.slug || siteSlug || displayName || "site", domain: publication.customDomain })
      : buildHostedWebsiteUrl({ slug: publication.slug || siteSlug || displayName || "site" })))
    : "";
  const internalPreviewUrl = publication?.internalPreviewUrl || publication?.defaultUrl || predictedHostedUrl;

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
            <div style={{ fontSize: 18, fontWeight: 600, color: "#f1f5f9" }}>Project not found</div>
            <div style={{ fontSize: 16, lineHeight: 1.7, color: "rgba(255,255,255,.5)", maxWidth: 520 }}>
              Project <code style={{ background: "rgba(255,255,255,.08)", padding: "2px 6px", borderRadius: 4, fontSize: 16 }}>{missingProjectId}</code> is not available in this session.
            </div>
            <div style={{ fontSize: 16, lineHeight: 1.7, color: "rgba(255,255,255,.35)" }}>
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
  const activeProjectPageName = resolveProjectPageName(activePage, studioProject);
  const activePageBlocks = Array.isArray(studioProject?.pageBlocks?.[activeProjectPageName]) && studioProject.pageBlocks[activeProjectPageName].length > 0
    ? studioProject.pageBlocks[activeProjectPageName]
    : Array.isArray(studioProject?.chaiData?.[activeProjectPageName]?.blocks)
      ? studioProject.chaiData[activeProjectPageName].blocks
      : Array.isArray(studioProject?.pageBlocks?.[activeProjectPageName])
        ? studioProject.pageBlocks[activeProjectPageName]
        : [];
  const canvasInstanceKey = [
    studioProject?.id || "",
    activeProjectPageName,
    activePageBlocks.length,
    activePageBlocks.map((block) => block?.id || block?.type || "").join(":"),
  ].join("|");

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

          {/* ── Sticky area: tabs + canvas locks to top as banner scrolls away ── */}
          <div style={styles.stickyArea}>

          {/* ── Persistent pages bar ── */}
          {project?.pages?.length > 0 && (
            <div style={styles.pagesBar}>
              <label style={styles.pagesBarPickerLabel}>
                Page
                <select
                  value={activePage}
                  onChange={(event) => navigateToPage(event.target.value)}
                  style={styles.pagesBarSelect}
                  aria-label="Select website page"
                >
                  {project.pages.map((entry) => (
                    <option key={entry.name} value={entry.name}>{entry.name}</option>
                  ))}
                </select>
              </label>
              <div style={styles.pagesBarTabs}>
                {project.pages.map((entry) => (
                  renamingPage === entry.name ? (
                    <div key={entry.name} style={styles.pagePillRenameWrap}>
                      <input
                        // eslint-disable-next-line jsx-a11y/no-autofocus
                        autoFocus
                        value={renameValue}
                        onFocus={(e) => e.target.select()}
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
                        ...styles.pagesBarTab,
                        ...(activePage === entry.name ? styles.pagesBarTabActive : {}),
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => navigateToPage(entry.name)}
                        onMouseDown={(e) => {
                          if (e.detail > 1) e.preventDefault();
                        }}
                        onDoubleClick={(e) => beginRenamePage(e, entry.name)}
                        style={styles.pagesBarTabName}
                        title="Double-click to rename"
                      >
                        {entry.name}
                      </button>
                      {project.pages.length > 1 && (
                        <button
                          type="button"
                          title={`Delete ${entry.name}`}
                          onClick={() => handleDeletePage(entry.name)}
                          style={styles.pagesBarTabDelete}
                        >×</button>
                      )}
                    </div>
                  )
                ))}
              </div>
              <div style={styles.pagesBarAddRow}>
                <input
                  value={newPageName}
                  onChange={(e) => setNewPageName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddPage(); }}
                  placeholder="+ New page"
                  style={styles.pagesBarInput}
                />
                {newPageName.trim() ? (
                  <button type="button" onClick={handleAddPage} style={styles.pagesBarAddBtn}>Add</button>
                ) : null}
              </div>
            </div>
          )}

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
                  This is the short name used for the internal preview URL. For example, <span style={styles.inlineHighlightBlue}>"my-business"</span> creates <span style={styles.inlineHighlightMint}>{buildHostedWebsiteUrl({ slug: "my-business" })}</span>.
                </span>
                <span style={styles.fieldHelpMuted}>
                  Your custom domain becomes the primary live website address when it is connected.
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

              <label style={{ ...styles.fieldLabel, display: "flex", flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={primaryWebsite}
                  onChange={(event) => setPrimaryWebsite(event.target.checked)}
                  style={{ marginTop: 4, width: 16, height: 16, flex: "0 0 auto" }}
                />
                <span>
                  Use this site for the public root fallback
                  <span style={styles.fieldHelpMuted}>
                    Custom domains become the primary website automatically. This option is only for choosing which published site should render when a visitor reaches the platform root without a matching custom domain.
                  </span>
                </span>
              </label>

              <div style={styles.publishHintWrap}>
                <span style={styles.publishHint}>Primary Website: <span style={styles.inlineHighlightMint}>{publication?.primaryWebsiteUrl || resolvedPublicationLiveUrl || predictedPrimaryWebsiteUrl}</span></span>
                <span style={styles.publishHint}>Internal Preview URL: <span style={styles.inlineHighlightBlue}>{internalPreviewUrl}</span></span>
                {hasDedicatedRootDomain ? <span style={styles.publishHint}>Branded subdomain: <span style={styles.inlineHighlightBlue}>{predictedDefaultDomain || "Add a site slug to generate one"}</span></span> : null}
                <span style={styles.publishHint}>Published route path: <span style={styles.inlineHighlightGold}>{predictedSitePath}</span></span>
              </div>

              <div style={styles.publishActionRow}>
                <button type="button" onClick={handlePublishWebsite} style={styles.publishBtn} disabled={publishBusy || !session}>
                  {publishBusy ? "Publishing..." : publication?.publishedAt ? "Update Published Site" : "Publish Site"}
                </button>

                {resolvedPublicationLiveUrl ? (
                  <div style={styles.publishUrlCard}>
                    <span style={styles.publishUrlLabel}>Primary Website</span>
                    <div style={styles.publishUrlRow}>
                      <input value={resolvedPublicationLiveUrl} readOnly style={styles.publishUrlInput} aria-label="Primary website URL" />
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
                    <span style={styles.publishHint}>Internal Preview URL: <span style={styles.inlineHighlightBlue}>{internalPreviewUrl}</span></span>
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
                          onFocus={(e) => e.target.select()}
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
                          onClick={() => navigateToPage(entry.name)}
                          onMouseDown={(e) => {
                            if (e.detail > 1) e.preventDefault();
                          }}
                          onDoubleClick={(e) => beginRenamePage(e, entry.name)}
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
              <div style={styles.builderStatusStrip}>
                <span>Builder active</span>
                <strong>{activeProjectPageName}</strong>
                <span>{activePageBlocks.length} blocks loaded</span>
              </div>
              {isUpgrading ? (
                <StudioLoader label="Rebuilding AI layout…" />
              ) : (
                <CanvasErrorBoundary resetKey={`${studioProject?.id || ""}:${activeProjectPageName}`}>
                  <PageBuilderCanvas
                    key={canvasInstanceKey}
                    project={studioProject}
                    brandAssets={brandAssets}
                    pageBlocks={activePageBlocks}
                    activePage={activeProjectPageName}
                    currentObjective={currentObjective}
                    onSave={(blocks) => saveBlockPage(blocks, `Saved ${activeProjectPageName}`, { pageName: activeProjectPageName })}
                    onForceSave={(blocks, options = {}) => forceSaveBlockPage(blocks, { ...options, pageName: activeProjectPageName })}
                    onUploadImage={handleUploadImage}
                    onSelectAsset={handleSelectAsset}
                    onSaveAsGlobal={saveGlobalBlock}
                    onSaveBlockDefault={canSaveTemplates ? saveBlockDefaultToServer : null}
                    onSaveTemplatePage={canSaveTemplates ? saveTemplatePageToServer : null}
                    onSaveTemplateSite={canSaveTemplates ? saveTemplateSiteToServer : null}
                    canSaveTemplates={canSaveTemplates}
                    onUpdateGlobalBlock={updateGlobalBlock}
                    onOpenMediaLibrary={openMediaLibrary}
                    onRefreshAssetLibrary={refreshSharedLibrary}
                    onRegisterPreviewActions={(actions) => {
                      previewActionsRef.current = actions;
                    }}
                    blockDefaults={blockDefaults}
                    showHeader={true}
                  />
                </CanvasErrorBoundary>
              )}
            </div>
          </div>{/* end stickyArea */}
      </main>
    </>
  );
}

const styles = {
  page: {
    minHeight: "calc(100dvh - 140px)",
    height: "calc(100dvh - 140px)",
    overflowY: "auto",
    overflowX: "hidden",
    background: "linear-gradient(180deg, #0b1016 0%, #0d1420 100%)",
    color: "#e6eef5",
    fontFamily: "system-ui, sans-serif",
    fontSize: 16,
    fontWeight: 600,
    display: "flex",
    flexDirection: "column",
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
  stickyArea: {
    position: "sticky",
    top: 0,
    flex: "1 0 auto",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    height: "calc(100dvh - 140px)",
    zIndex: 1,
  },
  mainColumn: {
    minWidth: 0,
    flex: "1 1 0",
    minHeight: 0,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  builderStatusStrip: {
    position: "relative",
    zIndex: 50,
    display: "flex",
    alignItems: "center",
    gap: 10,
    minHeight: 34,
    padding: "7px 12px",
    background: "#052e16",
    color: "#dcfce7",
    borderTop: "1px solid rgba(134,239,172,0.35)",
    borderBottom: "1px solid rgba(134,239,172,0.35)",
    fontSize: 14,
    fontWeight: 700,
  },
  canvasErrorPanel: {
    display: "grid",
    gap: 12,
    alignContent: "center",
    justifyItems: "start",
    minHeight: "100%",
    padding: 28,
    background: "#fff7ed",
    color: "#7c2d12",
    border: "1px solid #fdba74",
  },
  canvasErrorTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  canvasErrorText: {
    maxWidth: 720,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.5,
    overflowWrap: "anywhere",
  },
  canvasErrorButton: {
    border: "1px solid #fb923c",
    borderRadius: 8,
    background: "#ffffff",
    color: "#9a3412",
    padding: "9px 14px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
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
    fontSize: 16,
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
  pagesBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "5px 16px 5px",
    background: "rgba(8,15,30,0.82)",
    borderBottom: "1px solid rgba(255,255,255,.09)",
    overflowX: "auto",
    overflowY: "hidden",
    scrollbarWidth: "thin",
    flexShrink: 0,
  },
  pagesBarPickerLabel: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    flexShrink: 0,
    paddingRight: 8,
    borderRight: "1px solid rgba(255,255,255,.10)",
    color: "#93c5fd",
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: "0.02em",
  },
  pagesBarSelect: {
    minWidth: 150,
    background: "#020617",
    color: "#f8fafc",
    border: "1px solid rgba(56,189,248,0.55)",
    borderRadius: 8,
    padding: "6px 32px 6px 10px",
    fontSize: 15,
    fontWeight: 800,
    outline: "none",
    cursor: "pointer",
  },
  pagesBarTabs: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    flex: "1 1 auto",
    flexWrap: "nowrap",
    minWidth: 0,
    overflowX: "auto",
    scrollbarWidth: "none",
  },
  pagesBarTab: {
    display: "flex",
    alignItems: "stretch",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(17,24,39,0.70)",
    overflow: "hidden",
    flexShrink: 0,
  },
  pagesBarTabActive: {
    border: "1px solid rgba(56,189,248,0.70)",
    background: "rgba(14,165,233,.22)",
  },
  pagesBarTabName: {
    padding: "6px 12px",
    background: "transparent",
    border: 0,
    color: "#e2e8f0",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
  },
  pagesBarTabDelete: {
    padding: "0 8px",
    background: "transparent",
    border: 0,
    borderLeft: "1px solid rgba(255,255,255,.08)",
    color: "rgba(255,255,255,.40)",
    fontSize: 16,
    lineHeight: 1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },
  pagesBarAddRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
    marginLeft: "auto",
    paddingLeft: 8,
    borderLeft: "1px solid rgba(255,255,255,.08)",
  },
  pagesBarInput: {
    width: 140,
    background: "rgba(2,6,23,0.60)",
    color: "#e6eef5",
    border: "1px solid rgba(255,255,255,.13)",
    borderRadius: 7,
    padding: "5px 10px",
    fontSize: 14,
    fontWeight: 600,
    outline: "none",
  },
  pagesBarAddBtn: {
    padding: "5px 12px",
    borderRadius: 7,
    border: 0,
    background: "#0ea5e9",
    color: "#04111d",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};
