import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import {
  generateWebsitePageHtml,
  getWebsiteBuilderAssets,
  getWebsiteProject,
  saveWebsiteBuilderAssets,
  updateWebsiteProject,
} from "../../../../../lib/website-builder/projectStore";
import PageBuilderCanvas from "../../../../../components/website-builder/PageBuilderCanvas";
import {
  applyAssetToProps,
  createStoredAsset,
  mergeWebsiteBuilderAssetSources,
  syncWebsiteBuilderSharedAssetCache,
  uploadSharedMediaLibraryAsset,
} from "../../../../../lib/website-builder/mediaAssets";

import { supabase } from "../../../../../lib/supabaseClient";

function slugify(v) {
  return String(v || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export default function ProjectCanvasPage() {
  const router = useRouter();
  const { id, page, editor } = router.query;

  const [project, setProject] = useState(null);
  const [brandAssets, setBrandAssets] = useState({ logo: null, images: [] });
  const [session, setSession] = useState(null);
  const [activePage, setActivePage] = useState("");
  const [pageContent, setPageContent] = useState("");

  const [assistantMessages, setAssistantMessages] = useState([
    {
      role: "assistant",
      content: "Describe your page goals, style direction, or section ideas and I will help craft exact instructions.",
    },
  ]);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantError, setAssistantError] = useState("");

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    let subscription;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session || null);
      ({
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_e, s) => setSession(s || null)));
    })();

    return () => subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    setBrandAssets(getWebsiteBuilderAssets());
  }, [session?.user?.id]);

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
    if (!router.isReady) return;
    const params = new URLSearchParams();
    if (id) params.set("projectId", String(id));
    if (page) params.set("page", String(page));
    router.replace(`/modules/website-builder/visual-builder${params.toString() ? `?${params.toString()}` : ""}`);
  }, [router.isReady, id, page, router]);

  useEffect(() => {
    if (!id) return;
    let p = getWebsiteProject(id);

    if (p?.mode === "blank" && p?.id) {
      const reset = updateWebsiteProject(p.id, {
        mode: "blank",
        templateSlug: "",
        pages: [{ name: "Home", objective: "Start with a completely blank page and add your own sections." }],
        pageBlocks: { Home: [] },
        pagesContent: { Home: "" },
      });
      if (reset) p = reset;
    }

    setProject(p);
    if (!p?.pages?.length) return;

    const requested = String(page || "");
    const found = p.pages.find((x) => slugify(x.name) === requested);
    const selected = found?.name || p.pages[0].name;
    setActivePage(selected);
  }, [id, page]);

  useEffect(() => {
    if (!project || !activePage) return;
    const pagesContent = project.pagesContent || {};
    setPageContent(pagesContent[activePage] || "");
  }, [project, activePage]);

  useEffect(() => {
    if (!aiModalOpen) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setAiModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [aiModalOpen]);

  function flashSaved() {
    setShowSaved(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => setShowSaved(false), 1800);
  }

  function savePageContent(htmlContent) {
    if (!project || !activePage) return;
    const nextPagesContent = {
      ...(project.pagesContent || {}),
      [activePage]: htmlContent,
    };
    const updated = updateWebsiteProject(project.id, { pagesContent: nextPagesContent, status: "saved" });
    if (updated) setProject(updated);
    setPageContent(htmlContent);
    flashSaved();
  }

  function saveBlockPage(blocks) {
    if (!project || !activePage) return;

    const nextPageBlocks = {
      ...(project.pageBlocks || {}),
      [activePage]: Array.isArray(blocks) ? blocks : [],
    };

    const pageMeta = Array.isArray(project.pages)
      ? project.pages.find((p) => p.name === activePage) || { name: activePage, objective: currentObjective }
      : { name: activePage, objective: currentObjective };

    const nextHtml = generateWebsitePageHtml(
      { ...project, pageBlocks: nextPageBlocks },
      pageMeta,
      nextPageBlocks[activePage]
    );

    const nextPagesContent = {
      ...(project.pagesContent || {}),
      [activePage]: nextHtml,
    };

    const updated = updateWebsiteProject(project.id, {
      pageBlocks: nextPageBlocks,
      pagesContent: nextPagesContent,
      status: "saved",
    });
    if (updated) setProject(updated);
    setPageContent(nextHtml);
    flashSaved();
  }

  function persistAssets(nextAssets) {
    saveWebsiteBuilderAssets(nextAssets);
    setBrandAssets(nextAssets);
  }

  function handleSelectAsset(blockIndex, fieldKey, asset) {
    if (!asset?.src || !project || !activePage) return;

    const currentBlocks = Array.isArray(project?.pageBlocks?.[activePage])
      ? [...project.pageBlocks[activePage]]
      : [];

    if (!currentBlocks[blockIndex]) return;

    const existingProps = currentBlocks[blockIndex]?.props || {};
    const nextProps = applyAssetToProps(existingProps, fieldKey, asset);
    nextProps[fieldKey] = String(asset.src || "").startsWith("data:") ? "" : asset.src;

    currentBlocks[blockIndex] = {
      ...currentBlocks[blockIndex],
      props: nextProps,
    };

    saveBlockPage(currentBlocks);
  }

  async function handleUploadImage(_blockIndex, fieldKey, file) {
    if (!file) return null;

    const asset = session?.user?.id
      ? await uploadSharedMediaLibraryAsset(supabase, session.user.id, file, { tag: fieldKey === "logo" ? "logo" : "web" })
      : await createStoredAsset(file, { maxWidth: 960, maxHeight: 960, quality: 0.68 });
    const existingImages = Array.isArray(brandAssets?.images) ? brandAssets.images : [];
    const dedupedImages = existingImages.filter((image) => image?.src && image.src !== asset.src && image.name !== asset.name);
    const nextAssets = fieldKey === "logo"
      ? { ...brandAssets, logo: asset }
      : { ...brandAssets, images: [asset, ...dedupedImages] };

    persistAssets(mergeWebsiteBuilderAssetSources(nextAssets));
    return asset;
  }

  async function sendAssistantMessage() {
    const userText = String(assistantInput || "").trim();
    if (!userText || assistantBusy) return;

    const nextMessages = [...assistantMessages, { role: "user", content: userText }];
    setAssistantMessages(nextMessages);
    setAssistantInput("");
    setAssistantBusy(true);
    setAssistantError("");

    try {
      const res = await fetch("/api/website/assistant-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          context: {
            projectName: project?.name || "",
            activePage,
            currentObjective: project?.pages?.find((p) => p.name === activePage)?.objective || "",
            brief: project?.brief || {},
          },
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setAssistantError(json?.error || "Assistant failed to respond.");
        return;
      }

      setAssistantMessages((prev) => [...prev, { role: "assistant", content: String(json.reply || "") }]);
    } catch (e) {
      setAssistantError(e?.message || "Assistant failed to respond.");
    } finally {
      setAssistantBusy(false);
    }
  }

  const currentObjective = project?.pages?.find((p) => p.name === activePage)?.objective || "";
  const minimalShell = true;

  if (!router.isReady || !project) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <h1 style={styles.title}>Opening imported visual builder…</h1>
        </div>
      </main>
    );
  }

  if (!project) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <h1 style={styles.title}>Project not found</h1>
          <Link href="/modules/website-builder" style={styles.btn}>Back</Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>{project.name} | Canvas</title>
      </Head>
      <main style={styles.page} data-wb-canvas-page>
        {!minimalShell ? (
          <>
            <div style={styles.mainBanner}>
              <div style={styles.mainBannerTopRow}>
                <Link href="/modules/website-builder" style={styles.backBtn}>
                  ← Back
                </Link>
              </div>
              <div style={styles.mainBannerBody}>
                <div style={styles.mainBannerIconCol}>
                  <span className="wb-main-banner-icon" aria-hidden style={styles.mainBannerIcon}>🛠️</span>
                </div>
                <div style={styles.mainBannerTextCol}>
                  <h1 className="wb-main-banner-title" style={styles.mainBannerTitle}>Blank Visual Block Builder</h1>
                  <p style={styles.mainBannerSubtitle}>
                    Edit this page directly on a clean blank canvas with full block controls.
                  </p>
                </div>
              </div>
            </div>

            <div style={styles.topBar}>
              <div style={styles.topBarLeft}>
                <h2 style={styles.projectTitle}>{activePage || project.name}</h2>
                <div style={styles.pageTabs}>
                  {project.pages?.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setActivePage(p.name)}
                      style={{
                        ...styles.pageTab,
                        ...(activePage === p.name ? styles.pageTabActive : {}),
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
              <div style={styles.topBarRight}>
                <button
                  type="button"
                  style={styles.topBtn}
                  onClick={() => setAiModalOpen(true)}
                >
                  Help
                </button>
                <span style={styles.topBtnPrimary}>
                  Blank Visual Builder
                </span>
                <Link href={`/modules/website-builder`} style={styles.topBtn}>
                  Dashboard
                </Link>
                <Link href={`/modules/website-builder/project/${project.id}/preview`} style={styles.topBtnPrimary}>
                  Preview
                </Link>
              </div>
            </div>

            {currentObjective ? (
              <div style={styles.pageInfoBar}>
                <span style={styles.pageInfoLabel}>{activePage}</span>
                <span style={styles.pageInfoObjective}>{currentObjective}</span>
              </div>
            ) : null}
          </>
        ) : null}

        <div style={styles.builderWrapper}>
          <PageBuilderCanvas
            project={project || {}}
            brandAssets={brandAssets}
            pageBlocks={project?.pageBlocks?.[activePage] || []}
            activePage={activePage}
            currentObjective={currentObjective}
            onSave={saveBlockPage}
            onUploadImage={handleUploadImage}
            onSelectAsset={handleSelectAsset}
            showHeader={false}
          />
        </div>

        {aiModalOpen ? (
          <div style={styles.modalOverlay} onClick={() => setAiModalOpen(false)}>
            <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div>
                  <p style={styles.pageInfoTitle}>{activePage}</p>
                  <p style={styles.pageObjective}>{currentObjective}</p>
                </div>
                <button type="button" style={styles.modalCloseBtn} onClick={() => setAiModalOpen(false)}>
                  Close
                </button>
              </div>

              <div style={styles.modalBody}>
                <div style={styles.aiPanel}>
                  <p style={styles.aiPanelTitle}>Tips for Building</p>
                  <p style={styles.aiPanelSub}>Use the blank visual builder to:</p>
                  <ul style={{ fontSize: "16px", lineHeight: "1.6", color: "#cbd5e1" }}>
                    <li>Add sections onto a fully blank canvas</li>
                    <li>Drag, reorder, and edit blocks visually</li>
                    <li>Adjust copy, colors, spacing, and layout on each page</li>
                    <li>Preview changes instantly inside the same workspace</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
      <style jsx global>{`
        [data-wb-canvas-page] :is(p, a, button, label, input, select, textarea, li, span, div, option) {
          font-size: 16px !important;
          font-weight: 600 !important;
        }
        [data-wb-canvas-page] .wb-main-banner-icon {
          font-size: 48px !important;
          line-height: 1 !important;
        }
        [data-wb-canvas-page] .wb-main-banner-title {
          font-size: 48px !important;
          font-weight: 600 !important;
          line-height: 1.04 !important;
        }
      `}</style>
    </>
  );
}

const styles = {
  page: {
    background: "#0c121a",
    color: "#e6eef5",
    fontFamily: "system-ui,-apple-system,sans-serif",
    fontSize: 16,
    fontWeight: 600,
  },
  mainBanner: {
    background: "linear-gradient(135deg,#133f66,#0f7a72)",
    borderBottom: "1px solid rgba(255,255,255,0.25)",
    padding: "14px 18px 16px",
    display: "grid",
    gap: 10,
  },
  mainBannerTopRow: {
    display: "flex",
    justifyContent: "flex-end",
  },
  mainBannerBody: {
    display: "grid",
    gridTemplateColumns: "64px minmax(0, 1fr)",
    gap: 14,
    alignItems: "start",
  },
  mainBannerIconCol: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
  },
  mainBannerTextCol: {
    display: "grid",
    gap: 8,
    minWidth: 0,
  },
  backBtn: {
    display: "inline-flex",
    alignItems: "center",
    textDecoration: "none",
    background: "rgba(9,20,35,0.4)",
    border: "1px solid rgba(255,255,255,0.35)",
    color: "#f8fdff",
    borderRadius: 10,
    padding: "8px 14px",
    fontSize: 18,
    fontWeight: 600,
    lineHeight: 1,
  },
  mainBannerIcon: {
    fontSize: 48,
    lineHeight: 1,
  },
  mainBannerTitle: {
    margin: 0,
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 1.04,
    color: "#f8fdff",
    letterSpacing: "-0.01em",
  },
  mainBannerSubtitle: {
    margin: 0,
    fontSize: 16,
    color: "#dff7ff",
    lineHeight: 1.5,
    maxWidth: 980,
  },
  pageInfoBar: {
    background: "#0d1420",
    borderBottom: "1px solid #1a2640",
    padding: "6px 16px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  pageInfoLabel: {
    fontSize: 16,
    fontWeight: 600,
    color: "#7dd3fc",
    whiteSpace: "nowrap",
  },
  pageInfoObjective: {
    fontSize: 16,
    color: "#9fb0c5",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "linear-gradient(135deg,#153052,#10243e)",
    borderBottom: "1px solid #2c3f62",
    padding: "12px 16px",
    gap: 16,
    flexWrap: "wrap",
  },
  topBarLeft: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    flex: 1,
  },
  topBarRight: {
    display: "flex",
    gap: 8,
  },
  projectTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  pageTabs: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  pageTab: {
    background: "#16233a",
    border: "1px solid #2b3650",
    color: "#9fb0c5",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  pageTabActive: {
    background: "#2d6cdf",
    borderColor: "#2d6cdf",
    color: "#fff",
  },
  topBtn: {
    background: "#16233a",
    border: "1px solid #2b3650",
    color: "#dbeafe",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 16,
    fontWeight: 600,
    textDecoration: "none",
    cursor: "pointer",
  },
  topBtnPrimary: {
    background: "#7df9a1",
    border: "none",
    color: "#04202e",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 16,
    fontWeight: 600,
    textDecoration: "none",
    cursor: "pointer",
  },
  builderWrapper: {
    overflow: "auto",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(1,6,18,0.78)",
    zIndex: 2000,
    display: "grid",
    placeItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "min(1200px, 100%)",
    maxHeight: "90vh",
    overflow: "hidden",
    borderRadius: 14,
    border: "1px solid #2b3650",
    background: "#0a0f18",
    display: "grid",
    gridTemplateRows: "auto 1fr",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 14px",
    borderBottom: "1px solid #1e2d45",
    background: "#111827",
    gap: 12,
  },
  modalCloseBtn: {
    background: "#16233a",
    border: "1px solid #2b3650",
    color: "#dbeafe",
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
  },
  modalBody: {
    padding: 14,
    overflow: "auto",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  sidebar: {
    background: "#0a0f18",
    borderRight: "1px solid #1e2d45",
    padding: 12,
    overflowY: "auto",
  },
  pageInfo: {
    background: "#111827",
    border: "1px solid #1e2d45",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  pageInfoTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: "#dbeafe",
    marginBottom: 6,
  },
  pageObjective: {
    margin: 0,
    fontSize: 16,
    color: "#9fb0c5",
    lineHeight: 1.5,
  },
  aiPanel: {
    background: "#111827",
    border: "1px solid #1e2d45",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    display: "grid",
    gap: 8,
  },
  aiPanelTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: "#c4f1ff",
  },
  aiPanelSub: {
    margin: 0,
    fontSize: 16,
    color: "#9fb0c5",
    lineHeight: 1.4,
  },
  chatList: {
    display: "grid",
    gap: 8,
    maxHeight: 220,
    overflowY: "auto",
    paddingRight: 2,
  },
  chatBubble: {
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 16,
    lineHeight: 1.45,
    whiteSpace: "pre-wrap",
  },
  chatBubbleAssistant: {
    background: "#172337",
    color: "#dbeafe",
    border: "1px solid #2b3650",
  },
  chatBubbleUser: {
    background: "#0f2816",
    color: "#ccfbf1",
    border: "1px solid #1f5f3b",
  },
  aiTextarea: {
    width: "100%",
    minHeight: 86,
    resize: "vertical",
    background: "#0d1522",
    border: "1px solid #2b3650",
    color: "#e6eef5",
    borderRadius: 10,
    padding: 10,
    fontSize: 16,
    lineHeight: 1.45,
    fontFamily: "inherit",
  },
  aiBtn: {
    background: "linear-gradient(135deg,#7df9a1,#00d4ff)",
    border: "none",
    color: "#04202e",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    minHeight: 24,
  },
  aiError: {
    margin: 0,
    fontSize: 16,
    color: "#fca5a5",
  },
  aiSuccess: {
    margin: 0,
    fontSize: 16,
    color: "#86efac",
  },
  aiGrid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  aiSelect: {
    background: "#0d1522",
    border: "1px solid #2b3650",
    color: "#e6eef5",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 16,
    minHeight: 24,
  },
  aiPreviewWrap: {
    display: "grid",
    gap: 8,
    border: "1px solid #2b3650",
    borderRadius: 10,
    padding: 8,
    background: "#0d1522",
  },
  aiPreviewImg: {
    width: "100%",
    height: "auto",
    borderRadius: 8,
    border: "1px solid #2b3650",
    display: "block",
  },
  aiPromptNote: {
    margin: 0,
    fontSize: 16,
    color: "#94a3b8",
    lineHeight: 1.35,
  },
  container: {
    maxWidth: 920,
    margin: "0 auto",
    padding: 24,
  },
  title: {
    margin: "0 0 12px",
    fontSize: 28,
    fontWeight: 600,
  },
  btn: {
    display: "inline-flex",
    textDecoration: "none",
    background: "#16233a",
    border: "1px solid #2b3650",
    color: "#dbeafe",
    borderRadius: 8,
    padding: "10px 14px",
    fontWeight: 600,
  },
};
