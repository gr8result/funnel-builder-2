import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { renderWebsiteBlock } from "../../../../../components/website-builder/WebsiteBlockRenderer";
import {
  getWebsiteBuilderAssets,
  getWebsiteProject,
} from "../../../../../lib/website-builder/projectStore";
import { supabase } from "../../../../../lib/supabaseClient";

function slugify(v) {
  return String(v || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function ProjectPreviewPage() {
  const router = useRouter();
  const { id, page } = router.query;

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
    if (!id) return;
    let nextProject = getWebsiteProject(id);
    setProject(nextProject);
  }, [id]);

  const active = useMemo(() => {
    if (!project?.pages?.length) return null;
    const requested = String(page || "");
    return project.pages.find((p) => slugify(p.name) === requested) || project.pages[0];
  }, [project, page]);

  const pageBlocks = active?.name ? (project?.pageBlocks || {})[active.name] || [] : [];
  const pageContent = active?.name ? (project?.pagesContent || {})[active.name] || "" : "";

  if (!project) {
    return (
      <main style={styles.page}><div style={styles.wrap}><h1 style={styles.h1}>Project not found</h1></div></main>
    );
  }

  return (
    <>
      <Head>
        <title>{project.name} | Preview</title>
      </Head>
      <main style={styles.page}>
        <div style={styles.utilityBar}>
          <div style={styles.utilityStatus}>{(project.status || "draft").toUpperCase()}</div>
          <Link href={`/modules/website-builder/visual-builder?projectId=${encodeURIComponent(project.id)}&page=${encodeURIComponent(active?.name || project?.pages?.[0]?.name || "Home")}&name=${encodeURIComponent(project.name || "GR8 Website")}`} style={styles.backBtn}>Back to Builder</Link>
        </div>

        {!pageBlocks.length ? (
          <section style={styles.siteHeader}>
            <div style={styles.wrapWide}>
              <div style={styles.brandRow}>
                <p style={styles.brandMark}>{project.name}</p>
                <nav style={styles.nav}>
                  {project.pages.map((p) => (
                    <Link
                      key={p.name}
                      href={`/modules/website-builder/project/${project.id}/preview?page=${slugify(p.name)}`}
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

        {Array.isArray(pageBlocks) && pageBlocks.length ? (
          <section style={styles.content}>
            <div style={styles.previewStack}>
              {pageBlocks.map((block, index) => (
                <Fragment key={block.id || `${block.type}-${index}`}>
                  {renderWebsiteBlock(block, { compact: false, assets, editor: false })}
                </Fragment>
              ))}
            </div>
          </section>
        ) : pageContent ? (
          <section style={styles.content} dangerouslySetInnerHTML={{ __html: pageContent }} />
        ) : (
          <section style={styles.content}>
            <div style={styles.wrap}>
              <div style={styles.emptyNotice}>No content yet. Open Canvas to add content.</div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#ffffff",
    color: "#0f172a",
    fontFamily: "'Manrope','Segoe UI',system-ui,-apple-system,sans-serif",
    paddingBottom: 56,
    overflowX: "hidden",
  },
  wrap: { maxWidth: 1220, margin: "0 auto", padding: "0 24px" },
  wrapWide: { maxWidth: 1320, margin: "0 auto", padding: "0 24px" },
  h1: { margin: 0, paddingTop: 32, fontSize: 28 },
  utilityBar: {
    position: "fixed",
    top: 14,
    right: 14,
    display: "flex",
    gap: 8,
    zIndex: 30,
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
    fontSize: 11,
    letterSpacing: "0.08em",
    fontWeight: 800,
    alignSelf: "center",
  },
  backBtn: {
    border: "1px solid rgba(203,213,225,0.55)",
    borderRadius: 8,
    background: "#fff",
    color: "#1e293b",
    padding: "8px 12px",
    textDecoration: "none",
    fontWeight: 700,
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
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },
  nav: { display: "flex", gap: 8, flexWrap: "wrap" },
  navLink: {
    color: "#cbd5e1",
    textDecoration: "none",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.28)",
    fontWeight: 700,
    fontSize: 13,
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
    fontSize: 15,
    fontWeight: 600,
  },
};
