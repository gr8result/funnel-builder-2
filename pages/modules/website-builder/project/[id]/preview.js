import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { renderWebsiteBlock } from "../../../../../components/website-builder/WebsiteBlockRenderer";
import {
  getWebsiteBuilderAssets,
  getWebsiteProject,
} from "../../../../../lib/website-builder/projectStore";
import { syncWebsiteBuilderSharedAssetCache } from "../../../../../lib/website-builder/mediaAssets";
import { supabase } from "../../../../../lib/supabaseClient";

function slugify(v) {
  return String(v || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function pickLayoutWidth(blocks, fallback = 1120) {
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

export default function ProjectPreviewPage() {
  const router = useRouter();
  const { id, page, viewport } = router.query;

  const [session, setSession] = useState(null);
  const [project, setProject] = useState(null);
  const [assets, setAssets] = useState({ logo: null, images: [] });

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
    setAssets(getWebsiteBuilderAssets());
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

      if (!cancelled) {
        setAssets(mergedAssets);
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
    if (!id) return;
    let nextProject = getWebsiteProject(id);
    setProject(nextProject);
  }, [id, page]);

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

  const globalNavBlock = project?.globalNavBlock || null;
  const globalFooterBlock = project?.globalFooterBlock || null;

  // Only inject global nav if this page doesn't already contain that exact block (by id)
  const injectNav = globalNavBlock && !pageBlocks.some((b) => b.id && b.id === globalNavBlock.id);

  // Only strip existing nav-bar blocks when we ARE replacing them with the global one
  const blocksWithoutNav = injectNav
    ? pageBlocks.filter((b) => b.type !== "nav-bar")
    : pageBlocks;

  const injectFooter = globalFooterBlock && !pageBlocks.some((b) => b.id && b.id === globalFooterBlock.id);
  const shellBlocks = [
    globalNavBlock,
    ...blocksWithoutNav,
    globalFooterBlock,
  ].filter(Boolean);
  const layoutWidth = pickLayoutWidth(shellBlocks, 1120);
  const pageBackground = pickPageBackground(shellBlocks, "#ffffff");
  const compactPreview = previewViewport === "mobile";
  const previewShellWidth = previewViewport === "mobile"
    ? 430
    : previewViewport === "tablet"
      ? Math.min(920, layoutWidth)
      : layoutWidth;

  if (!project) {
    return (
      <main style={styles.page("#ffffff")}><div style={styles.wrap}><h1 style={styles.h1}>Project not found</h1></div></main>
    );
  }

  return (
    <>
      <Head>
        <title>{project.name} | Preview</title>
        <style>{`html, body { background: ${pageBackground} !important; margin: 0; padding: 0; overflow-x: hidden; }`}</style>
      </Head>
      <main style={styles.page(pageBackground)}>
        <div style={styles.utilityBar}>
          <div style={styles.utilityStatus}>{(project.status || "draft").toUpperCase()}</div>
          <Link href={`/modules/website-builder/visual-builder?projectId=${encodeURIComponent(project.id)}&page=${encodeURIComponent(active?.name || project?.pages?.[0]?.name || "Home")}&name=${encodeURIComponent(project.name || "GR8 Website")}`} style={styles.backBtn}>Back to Builder</Link>
        </div>

        <div style={styles.previewViewport(previewViewport, previewShellWidth)}>
          {/* Global nav — injected above all page content */}
          {injectNav ? (
            <Fragment key="__global-nav">
              {renderWebsiteBlock(globalNavBlock, { compact: compactPreview, assets, editor: false, navigationContext })}
            </Fragment>
          ) : null}

          {/* Page-specific content */}
          {Array.isArray(pageBlocks) && pageBlocks.length ? (
            <>
              {blocksWithoutNav.map((block, index) => (
                <Fragment key={block.id || `${block.type}-${index}`}>
                  {renderWebsiteBlock(block, { compact: compactPreview, assets, editor: false, navigationContext })}
                </Fragment>
              ))}
            </>
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
                        {project.pages.map((p) => (
                          <Link
                            key={p.name}
                            href={`/modules/website-builder/project/${project.id}/preview?page=${slugify(p.name)}&viewport=${encodeURIComponent(previewViewport)}`}
                            style={{
                              ...styles.navLink,
                              ...(active?.name === p.name ? styles.navLinkActive : {}),
                            }}
                          >
                            {p.name}
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

          {/* Global footer — injected below all page content */}
          {injectFooter ? (
            <Fragment key="__global-footer">
              {renderWebsiteBlock(globalFooterBlock, { compact: compactPreview, assets, editor: false, navigationContext })}
            </Fragment>
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
    gap: 0,
  },
  previewViewport: (viewport, previewShellWidth) => ({
    ...styles.previewStack,
    width: viewport === "desktop" ? "100vw" : `min(100%, ${previewShellWidth}px)`,
    maxWidth: viewport === "desktop" ? "100vw" : `min(100%, ${previewShellWidth}px)`,
    margin: viewport === "desktop" ? 0 : "0 auto",
    marginLeft: viewport === "desktop" ? "calc(50% - 50vw)" : undefined,
    marginRight: viewport === "desktop" ? "calc(50% - 50vw)" : undefined,
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
