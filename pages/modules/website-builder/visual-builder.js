import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import PageBuilderCanvas from "../../../components/website-builder/PageBuilderCanvas";
import { applyAssetToProps, createStoredAsset } from "../../../lib/website-builder/mediaAssets";
import { applyChaiThemePreset, buildStarterChaiData, renderChaiHtml } from "../../../lib/website-builder/chaiStudio";
import {
  createWebsiteProject,
  getWebsiteBuilderAssets,
  getWebsiteProject,
  saveWebsiteBuilderAssets,
  updateWebsiteProject,
} from "../../../lib/website-builder/projectStore";

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function VisualBuilderPage() {
  const router = useRouter();
  const { projectId, page, name, mode, type, template } = router.query;
  const [project, setProject] = useState(null);
  const [activePage, setActivePage] = useState("Home");
  const [newPageName, setNewPageName] = useState("");
  const [notice, setNotice] = useState("");
  const [brandAssets, setBrandAssets] = useState({ logo: null, images: [] });

  useEffect(() => {
    setBrandAssets(getWebsiteBuilderAssets());
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 2400);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!router.isReady) return;

    const requestedPage = String(page || "Home");
    let nextProject = projectId ? getWebsiteProject(projectId) : null;

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

    setProject(nextProject);

    const resolvedPage = nextProject?.pages?.find((entry) => slugify(entry.name) === slugify(requestedPage))?.name
      || nextProject?.pages?.[0]?.name
      || requestedPage;

    setActivePage(resolvedPage);
  }, [router.isReady, projectId, page, name, mode, type, template]);

  const currentObjective = useMemo(() => {
    const pageEntry = project?.pages?.find((entry) => entry.name === activePage || slugify(entry.name) === slugify(activePage));
    return pageEntry?.objective || "Build this page in the visual editor.";
  }, [project, activePage]);

  function flashNotice(message) {
    setNotice(String(message || ""));
  }

  function saveProjectPatch(patch, successMessage = "Saved changes") {
    if (!project?.id) return null;

    const didSave = updateWebsiteProject(project.id, {
      ...patch,
      status: "saved",
    });

    let latest = null;
    try {
      latest = getWebsiteProject(project.id);
    } catch (_error) {
      latest = null;
    }

    if (didSave && latest) {
      setProject(latest);
      flashNotice(successMessage);
      return latest;
    }

    if (!didSave) {
      flashNotice("Could not save changes. Local storage may be full or unavailable.");
    } else {
      flashNotice("Saved, but could not reload latest changes. Try refreshing the page.");
    }

    return null;
  }

  function handleAddPage() {
    const pageName = String(newPageName || "").trim();
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
  }

  function saveChaiPage(data, successMessage = `Saved ${activePage}`) {
    const safeData = data || buildStarterChaiData(project, activePage);
    const html = renderChaiHtml(safeData, brandAssets);

    return saveProjectPatch(
      {
        chaiData: {
          ...(project?.chaiData || {}),
          [activePage]: safeData,
        },
        pageBlocks: {
          ...(project?.pageBlocks || {}),
          [activePage]: Array.isArray(safeData?.blocks) ? safeData.blocks : [],
        },
        pagesContent: {
          ...(project?.pagesContent || {}),
          [activePage]: html,
        },
      },
      successMessage
    );
  }

  function saveBlockPage(blocks, successMessage = `Saved ${activePage}`) {
    const safeBlocks = Array.isArray(blocks) ? blocks : [];
    return saveChaiPage({
      ...(project?.chaiData?.[activePage] || {}),
      blocks: safeBlocks,
      theme: project?.chaiData?.[activePage]?.theme || { preset: project?.stylePack || "premium" },
      designTokens: project?.chaiData?.[activePage]?.designTokens || {},
    }, successMessage);
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
    if (!asset?.src) return;

    const currentBlocks = Array.isArray(blocksOverride)
      ? [...blocksOverride]
      : Array.isArray(project?.pageBlocks?.[activePage])
        ? [...project.pageBlocks[activePage]]
        : [...(project?.chaiData?.[activePage]?.blocks || [])];

    if (!currentBlocks[blockIndex]) return;

    const existingProps = currentBlocks[blockIndex]?.props || {};
    const nextProps = applyAssetToProps(existingProps, fieldKey, asset);
    nextProps[fieldKey] = String(asset.src || "").startsWith("data:") ? "" : asset.src;

    currentBlocks[blockIndex] = {
      ...currentBlocks[blockIndex],
      props: nextProps,
    };

    saveBlockPage(currentBlocks, `${fieldKey} updated`);
  }

  async function handleUploadImage(blockIndex, fieldKey, file) {
    if (!file) return;

    try {
      const asset = await createStoredAsset(file, { maxWidth: 960, maxHeight: 960, quality: 0.68 });
      const existingImages = Array.isArray(brandAssets?.images) ? brandAssets.images : [];
      const dedupedImages = existingImages.filter((image) => image?.src && image.src !== asset.src && image.name !== asset.name);
      const nextAssets = fieldKey === "logo"
        ? { ...brandAssets, logo: asset }
        : {
            ...brandAssets,
            images: [asset, ...dedupedImages].slice(0, 12),
          };

      persistAssets(nextAssets);
      flashNotice(`${file.name} added`);
      return asset;
    } catch (error) {
      flashNotice(error?.message || "Image upload failed.");
    }
  }

  const displayName = String(name || project?.name || "GR8 Website");

  if (!router.isReady || !project) {
    return (
      <>
        <Head>
          <title>{displayName} | GR8 Website Studio</title>
        </Head>
        <main style={styles.loadingPage}>
          <div style={styles.loadingCard}>Opening blank studio…</div>
        </main>
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
                    <Link href={`/modules/website-builder/project/${project.id}/preview?page=${slugify(activePage)}`} style={styles.secondaryLink}>
                      Preview Page
                    </Link>
                    <Link href={`/modules/website-builder/project/${project.id}/preview`} style={styles.secondaryLink}>
                      Preview Site
                    </Link>
                  </>
                ) : null}
                <Link href="/modules/website-builder" style={styles.primaryBackLink}>
                  Back
                </Link>
              </div>
            </div>
          </section>

          <div style={styles.contentWrap}>
            <section style={styles.navPanel}>
            <div style={styles.navPanelHead}>
              <div>
                <strong style={{ display: "block", fontSize: 15 }}>Site Pages</strong>
                <span style={styles.mutedText}>{currentObjective}</span>
              </div>
              {notice ? <span style={styles.notice}>{notice}</span> : null}
            </div>

            <div style={styles.pagePills}>
              {(project?.pages || [{ name: activePage }]).map((entry) => (
                <button
                  key={entry.name}
                  type="button"
                  onClick={() => setActivePage(entry.name)}
                  style={{
                    ...styles.pagePill,
                    ...(activePage === entry.name ? styles.pagePillActive : {}),
                  }}
                >
                  {entry.name}
                </button>
              ))}
            </div>

            <div style={styles.themePanel}>
              <strong style={{ fontSize: 13, color: "#f8fafc" }}>Site Theme</strong>
              <div style={styles.themeRow}>
                <button type="button" onClick={() => applyDesignPreset("premium")} style={styles.themeBtn}>Premium</button>
                <button type="button" onClick={() => applyDesignPreset("minimal")} style={styles.themeBtn}>Minimal</button>
                <button type="button" onClick={() => applyDesignPreset("bold")} style={styles.themeBtn}>Bold</button>
              </div>
            </div>

            <div style={styles.addRow}>
              <input
                value={newPageName}
                onChange={(event) => setNewPageName(event.target.value)}
                placeholder="Add page name, e.g. About"
                style={styles.pageInput}
              />
              <button type="button" onClick={handleAddPage} style={styles.addBtn}>
                Add Page
              </button>
            </div>
          </section>

            <div style={styles.mainColumn}>
              <PageBuilderCanvas
                project={studioProject}
                brandAssets={brandAssets}
                pageBlocks={studioProject?.pageBlocks?.[activePage] || studioProject?.chaiData?.[activePage]?.blocks || []}
                activePage={activePage}
                currentObjective={currentObjective}
                onSave={(blocks) => saveBlockPage(blocks, `Saved ${activePage}`)}
                onUploadImage={handleUploadImage}
                onSelectAsset={handleSelectAsset}
                showHeader={true}
              />
            </div>
          </div>
      </main>
    </>
  );
}

const styles = {
  page: {
    minHeight: "calc(100dvh - 140px)",
    background: "linear-gradient(180deg, #0b1016 0%, #0d1420 100%)",
    color: "#e6eef5",
    fontFamily: "system-ui, sans-serif",
    display: "grid",
    gridTemplateRows: "auto 1fr",
    alignContent: "stretch",
    gap: 12,
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
    fontWeight: 800,
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
    minHeight: 680,
    height: "calc(100dvh - 320px)",
    display: "grid",
  },
  bannerOuter: {
    padding: "18px 16px 12px",
  },
  bannerInner: {
    width: "min(1320px, 100%)",
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: "20px 24px",
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
    width: 48,
    height: 48,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.16)",
    border: "1px solid rgba(255,255,255,0.24)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14)",
    fontSize: 22,
    flexShrink: 0,
  },
  bannerTitle: {
    display: "block",
    fontSize: 48,
    lineHeight: 1,
    fontWeight: 600,
    color: "#ffffff",
    letterSpacing: "-.03em",
    textShadow: "0 2px 14px rgba(15,23,42,0.18)",
  },
  bannerSubtitle: {
    display: "block",
    marginTop: 8,
    fontSize: 18,
    lineHeight: 1.4,
    color: "rgba(239,246,255,0.92)",
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
    fontSize: 16,
    fontWeight: 700,
  },
  primaryBackLink: {
    color: "#082032",
    textDecoration: "none",
    padding: "10px 18px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,.34)",
    background: "#f8fafc",
    fontSize: 18,
    fontWeight: 800,
    boxShadow: "0 10px 24px rgba(8,32,50,0.16)",
  },
  backBtn: {
    textDecoration: "none",
    borderRadius: "12px",
    padding: "12px 16px",
    background: "rgba(255,255,255,.1)",
    border: "1px solid rgba(255,255,255,.22)",
    color: "#fff",
    fontWeight: 700,
    justifySelf: "start",
  },
  contentWrap: {
    width: "100%",
    maxWidth: "none",
    margin: 0,
    padding: "0 12px 12px",
    display: "grid",
    gridTemplateRows: "auto 1fr",
    gap: 12,
  },
  navPanel: {
    display: "grid",
    gap: 12,
    padding: 14,
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 14,
    background: "#0f172a",
    minWidth: 0,
  },
  navPanelHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  mutedText: {
    fontSize: 13,
    opacity: 0.75,
  },
  notice: {
    fontSize: 13,
    color: "#86efac",
    fontWeight: 700,
  },
  pagePills: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
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
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.15)",
    background: "#111827",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  pagePill: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.15)",
    background: "#111827",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  pagePillActive: {
    border: "1px solid #38bdf8",
    background: "rgba(14,165,233,.16)",
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
  },
  addBtn: {
    padding: "10px 14px",
    borderRadius: 8,
    border: 0,
    background: "#0ea5e9",
    color: "#04111d",
    fontWeight: 800,
    cursor: "pointer",
  },
};