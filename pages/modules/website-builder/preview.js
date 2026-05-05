import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { renderWebsiteBlock } from "../../../components/website-builder/WebsiteBlockRenderer";
import { getWebsiteTemplatePreview } from "../../../lib/website-builder/projectStore";
import { seedWebsiteBuilderSharedLibrary } from "../../../lib/website-builder/mediaAssets";
import { supabase } from "../../../lib/supabaseClient";

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

function getThemeAccent(slug = "") {
  const raw = String(slug || "").toLowerCase();
  if (raw.includes("coach")) return { bg: "linear-gradient(160deg, #24170a 0%, #6b3f12 45%, #0f172a 100%)", chip: "#f59e0b" };
  if (raw.includes("local")) return { bg: "linear-gradient(160deg, #062a24 0%, #0f766e 45%, #0f172a 100%)", chip: "#14b8a6" };
  if (raw.includes("portfolio")) return { bg: "linear-gradient(160deg, #1e1b4b 0%, #4f46e5 45%, #0f172a 100%)", chip: "#818cf8" };
  if (raw.includes("restaurant") || raw.includes("cafe")) return { bg: "linear-gradient(160deg, #2f1707 0%, #8a3f14 45%, #0f172a 100%)", chip: "#fb923c" };
  return { bg: "linear-gradient(160deg, #07111f 0%, #0b4aa2 45%, #0b1628 100%)", chip: "#38bdf8" };
}

export default function ThemePreviewPage() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const routeParams = useMemo(() => {
    const query = router.query || {};
    const search = String(router.asPath || "").split("?")[1] || "";
    const params = new URLSearchParams(search);

    return {
      templateSlug: String(query.theme || query.template || params.get("theme") || params.get("template") || "").trim(),
      pageKey: String(query.page || params.get("page") || "").trim(),
      viewport: String(query.viewport || params.get("viewport") || "").toLowerCase(),
    };
  }, [router.asPath, router.query]);

  const templateSlug = routeParams.templateSlug;
  const pageKey = routeParams.pageKey;
  const previewRouteReady = router.isReady;
  const previewViewport = ["mobile", "tablet", "desktop"].includes(routeParams.viewport)
    ? routeParams.viewport
    : "desktop";
  const compactPreview = previewViewport === "mobile";
  const accent = getThemeAccent(templateSlug);
  const preview = useMemo(() => getWebsiteTemplatePreview(templateSlug, pageKey), [templateSlug, pageKey]);
  const assets = useMemo(() => ({ logo: null, images: [] }), []);
  const layoutWidth = pickLayoutWidth(preview?.blocks || [], 1500);
  const previewShellWidth = previewViewport === "mobile" ? 430 : previewViewport === "tablet" ? 920 : layoutWidth;
  const pageBackground = pickPageBackground(preview?.blocks || [], accent.bg);
  const activePageSlug = preview?.activePage?.slug || "";
  const navigationContext = useMemo(() => {
    if (!preview || !templateSlug) return null;

    const pageMap = Object.fromEntries(
      preview.pages.map((page) => [
        String(page.slug || "").toLowerCase(),
        `/modules/website-builder/preview?template=${encodeURIComponent(templateSlug)}&page=${encodeURIComponent(page.slug)}&viewport=${encodeURIComponent(previewViewport)}`,
      ])
    );

    return {
      pageMap,
      currentPageKey: activePageSlug,
      basePath: `/modules/website-builder/preview?template=${encodeURIComponent(templateSlug)}&viewport=${encodeURIComponent(previewViewport)}`,
    };
  }, [preview, templateSlug, activePageSlug, previewViewport]);

  useEffect(() => {
    let subscription;
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data?.session || null);
      ({
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession || null)));
    })();

    return () => subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    seedWebsiteBuilderSharedLibrary(supabase, session.user.id).catch(() => {
      // Template previews should still load even if background library sync fails.
    });
  }, [session?.user?.id]);

  return (
    <>
      <Head>
        <title>{preview?.template?.name || "Template Preview"} Preview | GR8</title>
        <style>{`html, body { background: ${pageBackground} !important; margin: 0; padding: 0; overflow-x: hidden; }`}</style>
      </Head>

      <main style={styles.page(pageBackground)}>
        <section style={styles.shell}>
          {!previewRouteReady ? (
            <div style={styles.emptyState}>
              <h2 style={styles.emptyTitle}>Loading preview</h2>
              <p style={styles.emptyText}>Resolving the selected website template.</p>
            </div>
          ) : null}

          {previewRouteReady && preview ? (
            <>
              <div style={styles.floatingToolbarWrap}>
                <div style={styles.floatingToolbar}>
                  <div style={styles.floatingIntro}>
                    <p style={{ ...styles.kicker, color: accent.chip, marginBottom: 4 }}>GR8 TEMPLATE PREVIEW</p>
                    <div style={styles.floatingTitleRow}>
                      <h1 style={styles.floatingTitle}>{preview?.template?.name || "Template Preview"}</h1>
                      <span style={styles.floatingMeta}>{preview.activePage?.title || "Home"}</span>
                    </div>
                  </div>
                  <div style={styles.topActions}>
                    <Link href="/modules/website-builder" style={styles.backBtn}>
                      Back to Templates
                    </Link>
                    <Link href="/modules/website-builder" style={{ ...styles.backBtn, background: accent.chip, color: "#08101a", borderColor: accent.chip }}>
                      Use Theme in Builder
                    </Link>
                  </div>
                </div>
                <section style={styles.pageTabsFloating}>
                  {preview.pages.map((page) => (
                    <Link
                      key={page.slug}
                      href={`/modules/website-builder/preview?template=${encodeURIComponent(templateSlug)}&page=${encodeURIComponent(page.slug)}&viewport=${encodeURIComponent(previewViewport)}`}
                      style={{
                        ...styles.pageTab,
                        ...(page.slug === activePageSlug ? styles.siteLinkActive(accent.chip) : {}),
                      }}
                    >
                      {page.title}
                    </Link>
                  ))}
                </section>
              </div>

              <div style={styles.previewViewport(previewViewport, previewShellWidth)}>
                {preview.blocks.map((block, index) => (
                  <div key={block.id || `${block.type}-${index}`}>
                    {renderWebsiteBlock(block, { compact: compactPreview, assets, editor: false, navigationContext })}
                  </div>
                ))}
              </div>
            </>
          ) : previewRouteReady ? (
            <div style={styles.emptyState}>
              <h2 style={styles.emptyTitle}>Template preview unavailable</h2>
              <p style={styles.emptyText}>This template could not be rendered for preview.</p>
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
}

const styles = {
  page: (background) => ({
    minHeight: "100vh",
    padding: 0,
    background,
  }),
  shell: {
    width: "100%",
    display: "grid",
    gap: 0,
    margin: 0,
  },
  floatingToolbarWrap: {
    position: "fixed",
    top: 18,
    left: 18,
    right: 18,
    zIndex: 220,
    display: "grid",
    gap: 10,
    pointerEvents: "none",
  },
  floatingToolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
    padding: "14px 16px",
    borderRadius: 18,
    background: "rgba(8,15,29,.72)",
    border: "1px solid rgba(255,255,255,.14)",
    backdropFilter: "blur(16px)",
    boxShadow: "0 18px 50px rgba(2,6,23,.22)",
    pointerEvents: "auto",
  },
  floatingIntro: {
    display: "grid",
    gap: 2,
  },
  floatingTitleRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  floatingTitle: {
    margin: 0,
    color: "#fff",
    fontSize: "22px",
    lineHeight: 1.1,
  },
  floatingMeta: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.14)",
    color: "#dbeafe",
    fontSize: 13,
    fontWeight: 600,
  },
  topActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    pointerEvents: "auto",
  },
  kicker: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 600,
    letterSpacing: ".16em",
  },
  backBtn: {
    textDecoration: "none",
    borderRadius: "12px",
    padding: "10px 14px",
    background: "rgba(255,255,255,.1)",
    border: "1px solid rgba(255,255,255,.22)",
    color: "#fff",
    fontWeight: 600,
  },
  pageTabsFloating: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    pointerEvents: "auto",
  },
  pageTab: {
    textDecoration: "none",
    color: "#dbeafe",
    borderRadius: 999,
    padding: "8px 12px",
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(8,15,29,.72)",
    backdropFilter: "blur(14px)",
    fontSize: 14,
    fontWeight: 600,
  },
  siteLinkActive: (chip) => ({
    background: chip,
    color: "#08101a",
    borderColor: chip,
  }),
  previewViewport: (viewport, previewShellWidth) => ({
    width: viewport === "desktop" ? "100vw" : `min(100%, ${previewShellWidth}px)`,
    maxWidth: viewport === "desktop" ? "100vw" : `min(100%, ${previewShellWidth}px)`,
    margin: viewport === "desktop" ? "0" : "0 auto",
    marginLeft: viewport === "desktop" ? "calc(50% - 50vw)" : undefined,
    marginRight: viewport === "desktop" ? "calc(50% - 50vw)" : undefined,
    borderRadius: viewport === "desktop" ? 0 : 24,
    overflow: viewport === "desktop" ? "visible" : "hidden",
    boxShadow: viewport === "desktop" ? "none" : "0 24px 60px rgba(15,23,42,0.22)",
    background: viewport === "desktop" ? "transparent" : "#ffffff",
    paddingTop: viewport === "desktop" ? 112 : 126,
    minHeight: "100vh",
  }),
  emptyState: {
    borderRadius: 20,
    padding: "40px 28px",
    background: "rgba(8,15,29,.82)",
    border: "1px solid rgba(255,255,255,.08)",
    color: "#ffffff",
  },
  emptyTitle: {
    margin: 0,
    fontSize: 28,
  },
  emptyText: {
    margin: "12px 0 0",
    color: "#cbd5e1",
    fontSize: 17,
    lineHeight: 1.6,
  },
};
