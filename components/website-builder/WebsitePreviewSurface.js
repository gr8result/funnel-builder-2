import Head from "next/head";
import Link from "next/link";
import { useMemo } from "react";
import { renderWebsiteBlock, websiteBlockKeyframes } from "./WebsiteBlockRenderer";

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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

export default function WebsitePreviewSurface({ project, page, viewport, assets }) {
  const active = useMemo(() => {
    if (!project?.pages?.length) return null;
    const requested = String(page || "");
    return project.pages.find((entry) => slugify(entry.name) === requested) || project.pages[0];
  }, [project, page]);

  const previewViewport = ["mobile", "tablet", "desktop"].includes(String(viewport || "").toLowerCase())
    ? String(viewport).toLowerCase()
    : "desktop";

  const pageBlocks = active?.name ? (project?.pageBlocks || {})[active.name] || [] : [];
  const pageContent = active?.name ? (project?.pagesContent || {})[active.name] || "" : "";
  const globalNavBlock = project?.globalNavBlock?.type === "nav-bar" ? project.globalNavBlock : null;
  const globalFooterBlock = project?.globalFooterBlock?.type === "footer" ? project.globalFooterBlock : null;
  const injectNav = globalNavBlock && !pageBlocks.some((block) => block.id && block.id === globalNavBlock.id);
  const blocksWithoutNav = injectNav ? pageBlocks.filter((block) => block.type !== "nav-bar") : pageBlocks;
  const injectFooter = !!globalFooterBlock;
  const blocksWithoutShellDuplicates = injectFooter
    ? blocksWithoutNav.filter((block) => block.type !== "footer")
    : blocksWithoutNav;
  const shellBlocks = [globalNavBlock, ...blocksWithoutShellDuplicates, globalFooterBlock].filter(Boolean);
  const layoutWidth = pickLayoutWidth(shellBlocks, 1500);
  const pageBackground = pickPageBackground(shellBlocks, "#ffffff");
  const compactPreview = previewViewport === "mobile";
  const previewShellWidth = previewViewport === "mobile"
    ? 430
    : previewViewport === "tablet"
      ? Math.min(920, layoutWidth)
      : layoutWidth;

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

  return (
    <>
      <Head>
        <title>{project.name} | Preview</title>
        <style>{`
          html { background: ${pageBackground} !important; margin: 0; padding: 0; }
          body { background: ${pageBackground} !important; margin: 0; padding: 0; overflow-x: hidden; }
          [data-website-preview-block] {
            margin-top: 0 !important;
            margin-bottom: 0 !important;
            border-top: 0 !important;
            border-bottom: 0 !important;
            background-clip: padding-box;
          }
          [data-website-preview-block-type="image"] {
            margin-top: -1px !important;
            margin-bottom: -1px !important;
            line-height: 0 !important;
            font-size: 0 !important;
            overflow: hidden !important;
            position: relative;
            z-index: 1;
          }
          [data-website-preview-block] img,
          [data-website-preview-block] video,
          [data-website-preview-block] canvas,
          [data-website-preview-block] svg {
            display: block;
          }
          ${websiteBlockKeyframes()}
        `}</style>
      </Head>
      <main style={styles.page(pageBackground)}>
        <div style={styles.utilityBar}>
          <div style={styles.utilityStatus}>{(project.status || "draft").toUpperCase()}</div>
          <Link href={`/modules/website-builder/visual-builder?projectId=${encodeURIComponent(project.id)}&page=${encodeURIComponent(active?.name || project?.pages?.[0]?.name || "Home")}&name=${encodeURIComponent(project.name || "GR8 Website")}`} style={styles.backBtn}>Back to Builder</Link>
        </div>

        <div style={styles.previewViewport(previewViewport, previewShellWidth, pageBackground)}>
          {injectNav ? (
            <div key={`__global-nav-${globalNavBlock?.id || project?.id || "preview"}`} data-website-preview-block="true" data-website-preview-block-type={globalNavBlock?.type || ""} style={styles.blockFrame(pageBackground)}>
              {renderWebsiteBlock(globalNavBlock, { compact: compactPreview, assets, editor: false, frameConstrained: previewViewport !== "desktop", navigationContext, layoutWidth, siteId: project?.id || "" })}
            </div>
          ) : null}

          {Array.isArray(pageBlocks) && pageBlocks.length ? (
            blocksWithoutShellDuplicates.map((block, index) => (
              <div key={block.id || `${block.type}-${index}`} data-website-preview-block="true" data-website-preview-block-type={block.type || ""} style={styles.blockFrame(block.type === "image" ? (block.props?.backgroundColor || block.props?.seamlessBackgroundColor || pageBackground) : pageBackground)}>
                {renderWebsiteBlock(block, { compact: compactPreview, assets, editor: false, frameConstrained: previewViewport !== "desktop", navigationContext, layoutWidth, siteId: project?.id || "" })}
              </div>
            ))
          ) : pageContent ? (
            <section style={styles.content} dangerouslySetInnerHTML={{ __html: pageContent }} />
          ) : (
            <>
              {!globalNavBlock ? (
                <section style={styles.siteHeader}>
                  <div style={styles.wrapWide}>
                    <div style={styles.brandRow}>
                      <p style={styles.brandMark}>{project.name}</p>
                      <nav style={styles.nav}>
                        {project.pages.map((entry) => (
                          <Link
                            key={entry.name}
                            href={`/modules/website-builder/project/${project.id}/preview?page=${slugify(entry.name)}&viewport=${encodeURIComponent(previewViewport)}`}
                            style={{ ...styles.navLink, ...(active?.name === entry.name ? styles.navLinkActive : {}) }}
                          >
                            {entry.name}
                          </Link>
                        ))}
                      </nav>
                    </div>
                  </div>
                </section>
              ) : null}
              <section style={styles.content}>
                <div style={styles.wrap}>
                  <div style={styles.emptyNotice}>No content yet. Open Canvas to add content.</div>
                </div>
              </section>
            </>
          )}

          {injectFooter ? (
            <div key={`__global-footer-${globalFooterBlock?.id || project?.id || "preview"}`} data-website-preview-block="true" data-website-preview-block-type={globalFooterBlock?.type || ""} style={styles.blockFrame(pageBackground)}>
              {renderWebsiteBlock(globalFooterBlock, { compact: compactPreview, assets, editor: false, frameConstrained: previewViewport !== "desktop", navigationContext, layoutWidth, siteId: project?.id || "" })}
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
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
  previewStack: {
    width: "100%",
    maxWidth: "100%",
    margin: 0,
    padding: 0,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 0,
  },
  previewViewport: (viewport, previewShellWidth, background) => ({
    ...styles.previewStack,
    width: viewport === "desktop" ? "100vw" : `min(100%, ${previewShellWidth}px)`,
    maxWidth: viewport === "desktop" ? "100vw" : `min(100%, ${previewShellWidth}px)`,
    margin: viewport === "desktop" ? 0 : "0 auto",
    marginLeft: viewport === "desktop" ? "calc(50% - 50vw)" : undefined,
    marginRight: viewport === "desktop" ? "calc(50% - 50vw)" : undefined,
    overflowX: "clip",
    background,
  }),
  blockFrame: (background) => ({
    overflowX: "clip",
    minWidth: 0,
    margin: 0,
    padding: 0,
    border: 0,
    background,
    display: "block",
  }),
  siteHeader: { paddingTop: 70, paddingBottom: 14 },
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
  navLinkActive: { background: "#ffffff", color: "#0f172a" },
  content: { width: "100%", padding: "0 0 40px" },
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
