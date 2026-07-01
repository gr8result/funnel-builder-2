// /pages/sites/[...slug].js
// FULL REPLACEMENT — Render /sites/<slug> from Supabase ONLY (no external builders)
// ✅ Reads: website_pages.content_json.sections (version 2)
// ✅ Full-bleed sections with constrained 1440px content
// ✅ Responsive by default (stacks columns on small screens)

import Head from "next/head";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { renderWebsiteBlock, websiteBlockKeyframes } from "../../components/website-builder/WebsiteBlockRenderer";
import { normalizeWebsiteBuilderAssets } from "../../lib/website-builder/mediaAssets";
import { getPublishedWebsiteByDomain, getPublishedWebsiteBySlug } from "../../lib/website-builder/publicationStore";
import { buildWebsitePath, normalizeVideoHeroBlocks } from "../../lib/website-builder/publishConfig";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL || "", SUPABASE_ANON_KEY || "", {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CONTENT_WIDTH = 1440;
const seamlessPublishedBlockFrame = (background) => ({
  margin: 0,
  marginTop: 0,
  marginBottom: 0,
  padding: 0,
  border: "none",
  outline: "none",
  boxShadow: "none",
  background: background || undefined,
  display: "block",
  overflowX: "clip",
  minWidth: 0,
});
const resolvePublishedBlockBackground = (block) => String(block?.props?.backgroundColor || block?.props?.seamlessBackgroundColor || "").trim();
const resolvePublishedStackBackground = (blocks, index, fallback = "") => (
  resolvePublishedBlockBackground(blocks?.[index])
  || resolvePublishedBlockBackground(blocks?.[index - 1])
  || resolvePublishedBlockBackground(blocks?.[index + 1])
  || fallback
);

function slugifyPage(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function resolvePublishedPageName(page) {
  return slugifyPage(page?.slug || page?.name || page?.title || "");
}

function FullBleed({ bg, children }) {
  return (
    <div style={{ width: "100%", background: bg || "transparent" }}>
      <div style={{ maxWidth: CONTENT_WIDTH, margin: "0 auto", padding: "56px 18px" }}>{children}</div>
    </div>
  );
}

function Section({ s }) {
  if (!s) return null;
  const d = s.data || {};

  if (s.type === "header") {
    const links = Array.isArray(d.links) ? d.links : [];
    return (
      <div style={{ width: "100%", background: "#0b1220" }}>
        <div style={{ maxWidth: CONTENT_WIDTH, margin: "0 auto", padding: "18px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#fff" }}>{d.brand || "Your Brand"}</div>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              {links.map((t, i) => (
                <a key={i} href="#" onClick={(e) => e.preventDefault()} style={{ color: "rgba(255,255,255,0.85)", textDecoration: "none", fontWeight: 600, fontSize: 16 }}>
                  {t}
                </a>
              ))}
              <a href="#" onClick={(e) => e.preventDefault()} style={{ padding: "10px 14px", borderRadius: 12, background: "#2297c5", color: "#06121d", fontWeight: 600, textDecoration: "none" }}>
                {d.cta || "Get Started"}
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (s.type === "hero") {
    return (
      <FullBleed bg="linear-gradient(135deg, rgba(34,151,197,0.18), rgba(2,6,23,0.0))">
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18 }}>
          <div style={{ fontSize: 56, fontWeight: 600, color: "#0b1220", letterSpacing: -0.6 }}>{d.headline || "Headline"}</div>
          <div style={{ fontSize: 18, lineHeight: 1.6, color: "rgba(11,18,32,0.82)", fontWeight: 650 }}>{d.sub || ""}</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href={d.primaryHref || "#"} style={{ padding: "14px 18px", borderRadius: 14, background: "#2297c5", color: "#06121d", textDecoration: "none", fontWeight: 600 }}>
              {d.primaryLabel || "Get Started"}
            </a>
            <a href={d.secondaryHref || "#"} style={{ padding: "14px 18px", borderRadius: 14, background: "rgba(2,6,23,0.06)", border: "1px solid rgba(2,6,23,0.12)", color: "#0b1220", textDecoration: "none", fontWeight: 600 }}>
              {d.secondaryLabel || "Learn More"}
            </a>
          </div>
        </div>
      </FullBleed>
    );
  }

  if (s.type === "heroSplit") {
    return (
      <FullBleed bg="#fff">
        <div className="gr8-row">
          <div>
            <div style={{ fontSize: 54, fontWeight: 600, color: "#0b1220", letterSpacing: -0.6 }}>{d.headline || "Headline"}</div>
            <div style={{ height: 12 }} />
            <div style={{ fontSize: 18, lineHeight: 1.6, color: "rgba(11,18,32,0.82)", fontWeight: 650 }}>{d.sub || ""}</div>
            <div style={{ height: 16 }} />
            <a href={d.primaryHref || "#"} style={{ display: "inline-flex", padding: "14px 18px", borderRadius: 14, background: "#2297c5", color: "#06121d", textDecoration: "none", fontWeight: 600 }}>
              {d.primaryLabel || "Start"}
            </a>
          </div>

          <div style={{ borderRadius: 22, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(2,6,23,0.03)", overflow: "hidden", minHeight: 380 }}>
            {d.imageUrl ? (
              <img src={d.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, color: "rgba(11,18,32,0.55)" }}>
                Image
              </div>
            )}
          </div>
        </div>
      </FullBleed>
    );
  }

  if (s.type === "features3") {
    const items = Array.isArray(d.items) ? d.items : [];
    return (
      <FullBleed bg="#fff">
        <div style={{ fontSize: 34, fontWeight: 600, color: "#0b1220", letterSpacing: -0.4 }}>{d.title || "Title"}</div>
        <div style={{ height: 18 }} />
        <div className="gr8-grid3">
          {items.slice(0, 3).map((it, idx) => (
            <div key={idx} style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(2,6,23,0.02)", padding: 18 }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#0b1220" }}>{it.title || "Feature"}</div>
              <div style={{ height: 8 }} />
              <div style={{ fontSize: 16, lineHeight: 1.6, color: "rgba(11,18,32,0.78)", fontWeight: 650 }}>{it.text || ""}</div>
            </div>
          ))}
        </div>
      </FullBleed>
    );
  }

  if (s.type === "content2") {
    return (
      <FullBleed bg="#fff">
        <div className="gr8-row">
          <div style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,0.18)", padding: 18, background: "rgba(2,6,23,0.02)" }}>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#0b1220" }}>{d.leftTitle || "Left"}</div>
            <div style={{ height: 10 }} />
            <div style={{ fontSize: 16, lineHeight: 1.7, color: "rgba(11,18,32,0.78)", fontWeight: 650 }}>{d.leftText || ""}</div>
          </div>
          <div style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,0.18)", padding: 18, background: "rgba(2,6,23,0.02)" }}>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#0b1220" }}>{d.rightTitle || "Right"}</div>
            <div style={{ height: 10 }} />
            <div style={{ fontSize: 16, lineHeight: 1.7, color: "rgba(11,18,32,0.78)", fontWeight: 650 }}>{d.rightText || ""}</div>
          </div>
        </div>
      </FullBleed>
    );
  }

  if (s.type === "ctaBand") {
    return (
      <FullBleed bg="#0b1220">
        <div className="gr8-row">
          <div>
            <div style={{ fontSize: 38, fontWeight: 600, color: "#fff", letterSpacing: -0.4 }}>{d.headline || "CTA"}</div>
            <div style={{ height: 10 }} />
            <div style={{ fontSize: 16, lineHeight: 1.6, color: "rgba(255,255,255,0.80)", fontWeight: 600 }}>{d.sub || ""}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
            <a href={d.href || "#"} style={{ padding: "14px 18px", borderRadius: 14, background: "#2297c5", color: "#06121d", textDecoration: "none", fontWeight: 600 }}>
              {d.button || "Action"}
            </a>
          </div>
        </div>
      </FullBleed>
    );
  }

  if (s.type === "optinForm") {
    return (
      <FullBleed bg="#fff">
        <div className="gr8-row">
          <div>
            <div style={{ fontSize: 32, fontWeight: 600, color: "#0b1220", letterSpacing: -0.4 }}>{d.title || "Opt-in"}</div>
            <div style={{ height: 10 }} />
            <div style={{ fontSize: 16, lineHeight: 1.7, color: "rgba(11,18,32,0.75)", fontWeight: 650 }}>{d.sub || ""}</div>
          </div>
          <div style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,0.18)", padding: 18, background: "rgba(2,6,23,0.02)" }}>
            <input placeholder="you@company.com" style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,0.30)" }} />
            <div style={{ height: 10 }} />
            <button type="button" style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: "#2297c5", color: "#06121d", fontWeight: 600 }}>
              {d.button || "Submit"}
            </button>
          </div>
        </div>
      </FullBleed>
    );
  }

  if (s.type === "contactForm") {
    return (
      <FullBleed bg="#fff">
        <div style={{ fontSize: 32, fontWeight: 600, color: "#0b1220", letterSpacing: -0.4 }}>{d.title || "Contact"}</div>
        <div style={{ height: 10 }} />
        <div style={{ fontSize: 16, lineHeight: 1.7, color: "rgba(11,18,32,0.75)", fontWeight: 650 }}>{d.sub || ""}</div>
        <div style={{ height: 16 }} />
        <div style={{ borderRadius: 18, border: "1px solid rgba(148,163,184,0.18)", padding: 18, background: "rgba(2,6,23,0.02)" }}>
          <div className="gr8-row">
            <input placeholder="Name" style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,0.30)" }} />
            <input placeholder="Email" style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,0.30)" }} />
          </div>
          <div style={{ height: 12 }} />
          <textarea placeholder="Message" style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,0.30)", minHeight: 110 }} />
          <div style={{ height: 12 }} />
          <button type="button" style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: "#2297c5", color: "#06121d", fontWeight: 600 }}>
            {d.button || "Send"}
          </button>
        </div>
      </FullBleed>
    );
  }

  if (s.type === "testimonials") {
    const items = Array.isArray(d.items) ? d.items : [];
    return (
      <FullBleed bg="rgba(2,6,23,0.02)">
        <div style={{ fontSize: 32, fontWeight: 600, color: "#0b1220", letterSpacing: -0.4 }}>{d.title || "Testimonials"}</div>
        <div style={{ height: 18 }} />
        <div className="gr8-grid3">
          {items.slice(0, 3).map((it, idx) => (
            <div key={idx} style={{ borderRadius: 18, background: "#fff", border: "1px solid rgba(148,163,184,0.18)", padding: 18 }}>
              <div style={{ fontSize: 16, lineHeight: 1.7, color: "rgba(11,18,32,0.80)", fontWeight: 650 }}>{it.quote || ""}</div>
              <div style={{ height: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: "#0b1220" }}>{it.name || ""}</div>
            </div>
          ))}
        </div>
      </FullBleed>
    );
  }

  if (s.type === "faq") {
    const items = Array.isArray(d.items) ? d.items : [];
    return (
      <FullBleed bg="#fff">
        <div style={{ fontSize: 32, fontWeight: 600, color: "#0b1220", letterSpacing: -0.4 }}>{d.title || "FAQ"}</div>
        <div style={{ height: 14 }} />
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((it, idx) => (
            <details key={idx} style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.18)", background: "rgba(2,6,23,0.02)", padding: "10px 12px" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600, color: "#0b1220" }}>{it.q || "Question"}</summary>
              <div style={{ padding: "10px 2px 4px", color: "rgba(11,18,32,0.78)", fontWeight: 650, lineHeight: 1.7 }}>{it.a || ""}</div>
            </details>
          ))}
        </div>
      </FullBleed>
    );
  }

  if (s.type === "footer") {
    const links = Array.isArray(d.links) ? d.links : [];
    return (
      <div style={{ width: "100%", background: "#0b1220" }}>
        <div style={{ maxWidth: CONTENT_WIDTH, margin: "0 auto", padding: "28px 18px" }}>
          <div style={{ display: "flex", gap: 18, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#fff" }}>{d.brand || "Your Brand"}</div>
              <div style={{ height: 10 }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.70)" }}>{d.note || ""}</div>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {links.map((t, i) => (
                <a key={i} href="#" onClick={(e) => e.preventDefault()} style={{ color: "rgba(255,255,255,0.82)", textDecoration: "none", fontWeight: 600, fontSize: 16 }}>
                  {t}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export async function getServerSideProps(ctx) {
  const slugArr = ctx.params?.slug || [];
  const isHostLookup = slugArr[0] === "__host__";
  const siteHost = isHostLookup ? String(ctx.req.headers["x-site-host"] || "") : "";
  const publication = isHostLookup
    ? await getPublishedWebsiteByDomain(siteHost)
    : await getPublishedWebsiteBySlug(slugArr[0] || "");

  if (publication) {
    return {
      props: {
        mode: "published-website",
        publication,
        requestedPath: slugArr.slice(1),
        isDomainRequest: isHostLookup,
      },
    };
  }

  const slug = slugArr.join("/").replace(/^\/+/, "");

  const { data, error } = await supabase
    .from("website_pages")
    .select("title, slug, content_json")
    .eq("slug", slug)
    .limit(1);

  if (error) return { notFound: true };
  const row = data?.[0] || null;
  if (!row) return { notFound: true };

  const sections = row?.content_json?.sections || [];
  return {
    props: {
      mode: "legacy-site-page",
      title: row.title || slug,
      sections: Array.isArray(sections) ? sections : [],
    },
  };
}

function PublishedWebsiteRenderer({ publication, requestedPath, isDomainRequest }) {
  // Visit tracking is handled by IconCounterNumber itself (POST on first load, sessionStorage dedup).
  // No page-level POST needed here.

  const project = publication?.site_data || {};
  const normalizedPageBlocks = normalizeVideoHeroBlocks(project?.pageBlocks || {});
  const normalizedGlobalNavBlock = project?.globalNavBlock?.type === "video-hero"
    ? normalizeVideoHeroBlocks([project.globalNavBlock])[0]
    : project?.globalNavBlock;
  const normalizedGlobalFooterBlock = project?.globalFooterBlock?.type === "video-hero"
    ? normalizeVideoHeroBlocks([project.globalFooterBlock])[0]
    : project?.globalFooterBlock;
  const publishedAssets = normalizeWebsiteBuilderAssets(project?.brandAssets);
  const pages = Array.isArray(project.pages) ? project.pages : [];
  const requested = Array.isArray(requestedPath) ? requestedPath.join("/") : "";
  const activePage = pages.find((page) => resolvePublishedPageName(page) === slugifyPage(requested)) || pages[0] || null;
  const pageBlocks = activePage?.name ? (normalizedPageBlocks || {})[activePage.name] || [] : [];
  const pageContent = activePage?.name ? (project?.pagesContent || {})[activePage.name] || "" : "";
  const globalNavBlock = normalizedGlobalNavBlock?.type === "nav-bar" ? normalizedGlobalNavBlock : null;
  const globalFooterBlock = normalizedGlobalFooterBlock?.type === "footer" ? normalizedGlobalFooterBlock : null;
  const injectNav = globalNavBlock && !pageBlocks.some((block) => block.id && block.id === globalNavBlock.id);
  const injectFooter = !!globalFooterBlock;
  const blocksWithoutNav = injectNav ? pageBlocks.filter((block) => block.type !== "nav-bar") : pageBlocks;
  // Strip any per-page footer blocks when a global footer exists — prevents duplicates and
  // ensures the home page (which may still have the original footer in its pageBlocks) also
  // gets the global footer injected consistently with every other page.
  const blocksToRender = injectFooter ? blocksWithoutNav.filter((block) => block.type !== "footer") : blocksWithoutNav;
  const basePath = isDomainRequest ? "" : buildWebsitePath(publication?.slug || project?.name || "site");
  const navigationContext = {
    basePath,
    currentPageKey: resolvePublishedPageName(activePage) || "home",
    pageMap: Object.fromEntries(
      pages.map((page) => {
        const pageSlug = resolvePublishedPageName(page);
        const href = pageSlug && pageSlug !== "home"
          ? `${basePath}/${pageSlug}` || `/${pageSlug}`
          : (basePath || "/");
        return [slugifyPage(page.name || page.title || pageSlug), href];
      })
    ),
  };

  return (
    <>
      <Head>
        <title>{publication?.name || project?.name || "Website"}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          [data-published-block] {
            border: none !important;
            border-top: none !important;
            border-bottom: none !important;
            outline: none !important;
            box-shadow: none !important;
          }
          [data-published-block-type="trust-badges"] > section,
          [data-published-block-type="marquee-strip"] > section,
          [data-published-block-type="wave-marquee"] > section,
          [data-published-block-type="cta-button"] > section,
          [data-published-block-type="space"] > div:first-child {
            border-top: none;
            border-bottom: none;
            outline: none;
            box-shadow: none;
          }
          [data-published-block-type="trust-badges"] > section::before,
          [data-published-block-type="trust-badges"] > section::after,
          [data-published-block-type="marquee-strip"] > section::before,
          [data-published-block-type="marquee-strip"] > section::after,
          [data-published-block-type="wave-marquee"] > section::before,
          [data-published-block-type="wave-marquee"] > section::after,
          [data-published-block-type="cta-button"] > section::before,
          [data-published-block-type="cta-button"] > section::after,
          [data-published-block-type="space"] > div:first-child::before,
          [data-published-block-type="space"] > div:first-child::after {
            border-top: none !important;
            border-bottom: none !important;
            outline: none !important;
            box-shadow: none !important;
          }
          [data-published-block] > hr,
          [data-published-block] hr[data-wb-default-divider="true"] {
            display: none !important;
          }
          ${process.env.NODE_ENV !== "production" ? `
          [data-published-block] { position: relative; }
          [data-published-block]:hover::after {
            content: attr(data-published-block-type) " #" attr(data-published-block-id);
            position: absolute;
            left: 8px;
            top: 0;
            z-index: 9999;
            padding: 3px 7px;
            border-radius: 5px;
            background: rgba(14, 165, 233, 0.92);
            color: #fff;
            font: 600 11px/1.2 system-ui, sans-serif;
            pointer-events: none;
          }
          ` : ""}
          ${websiteBlockKeyframes()}
        `}</style>
      </Head>
      <main style={{ minHeight: "100vh", background: "#ffffff", color: "#0f172a", fontFamily: "'Manrope','Segoe UI',system-ui,-apple-system,sans-serif", margin: 0, padding: 0 }}>
        {injectNav ? (
          <div key="global-nav" data-published-block="true" data-published-block-id={globalNavBlock?.id || ""} data-published-block-type={globalNavBlock?.type || ""} style={seamlessPublishedBlockFrame(resolvePublishedBlockBackground(globalNavBlock))}>
            {renderWebsiteBlock(globalNavBlock, { compact: false, assets: publishedAssets, editor: false, navigationContext, siteId: publication?.id || "" })}
          </div>
        ) : null}

        {Array.isArray(blocksToRender) && blocksToRender.length ? (
          <>
            {blocksToRender.map((block, index) => {
              const blockBg = resolvePublishedStackBackground(blocksToRender, index, "");
              return (
                <div key={block.id || `${block.type}-${index}`} data-published-block="true" data-published-block-id={block.id || ""} data-published-block-type={block.type || ""} style={seamlessPublishedBlockFrame(blockBg)}>
                  {renderWebsiteBlock(block, { compact: false, assets: publishedAssets, editor: false, navigationContext, siteId: publication?.id || "" })}
                </div>
              );
            })}
          </>
        ) : pageContent ? (
          <section dangerouslySetInnerHTML={{ __html: pageContent }} />
        ) : (
          <section style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: 24 }}>
            <div style={{ width: "min(640px, 100%)", borderRadius: 18, border: "1px solid rgba(148,163,184,0.35)", padding: 24, background: "#ffffff", boxShadow: "0 20px 40px rgba(15,23,42,0.08)" }}>
              <strong style={{ display: "block", marginBottom: 8, fontSize: 18 }}>This site is published, but this page has no content yet.</strong>
              <p style={{ margin: 0, color: "#475569" }}>Open Website Studio, edit the page, and publish again.</p>
            </div>
          </section>
        )}

        {injectFooter ? (
          <div key="global-footer" data-published-block="true" data-published-block-id={globalFooterBlock?.id || ""} data-published-block-type={globalFooterBlock?.type || ""} style={seamlessPublishedBlockFrame(resolvePublishedBlockBackground(globalFooterBlock))}>
            {renderWebsiteBlock(globalFooterBlock, { compact: false, assets: publishedAssets, editor: false, navigationContext, siteId: publication?.id || "" })}
          </div>
        ) : null}

        {!globalNavBlock && pages.length > 1 ? (
          <nav style={{ position: "fixed", right: 14, bottom: 14, display: "flex", gap: 8, flexWrap: "wrap", maxWidth: "min(92vw, 640px)", padding: 10, borderRadius: 14, background: "rgba(255,255,255,0.92)", boxShadow: "0 12px 30px rgba(15,23,42,0.14)", backdropFilter: "blur(10px)" }}>
            {pages.map((page) => {
              const pageSlug = resolvePublishedPageName(page);
              const href = pageSlug ? `${basePath}/${pageSlug}` || `/${pageSlug}` : (basePath || "/");
              return (
                <Link key={page.name || pageSlug} href={href} style={{ textDecoration: "none", color: "#0f172a", padding: "8px 12px", borderRadius: 999, border: "1px solid rgba(148,163,184,0.35)", fontWeight: 600, background: "#ffffff" }}>
                  {page.name || page.title || "Page"}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </main>
    </>
  );
}

export default function SitePage({ mode, title, sections, publication, requestedPath, isDomainRequest }) {
  if (mode === "published-website") {
    return <PublishedWebsiteRenderer publication={publication} requestedPath={requestedPath} isDomainRequest={isDomainRequest} />;
  }

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Responsive helpers */}
      <style>{`
        .gr8-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
          align-items: stretch;
        }
        .gr8-grid3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        @media (max-width: 980px) {
          .gr8-row { grid-template-columns: 1fr; }
          .gr8-grid3 { grid-template-columns: 1fr; }
        }
      `}</style>

      <div style={{ fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,Arial", background: "#fff" }}>
        {(sections || []).map((s) => (
          <Section key={s.id || Math.random()} s={s} />
        ))}
      </div>
    </>
  );
}
