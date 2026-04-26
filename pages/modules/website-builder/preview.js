import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo } from "react";
import { getTemplate } from "../../../lib/website-builder/templates";

function humanizeThemeName(value = "") {
  const raw = String(value || "")
    .replace(/^theme[_-]?/i, "")
    .replace(/[_-]+/g, " ")
    .trim();

  return raw.replace(/\b\w/g, (m) => m.toUpperCase()) || "Visual Theme";
}

function getThemeAccent(slug = "") {
  const raw = String(slug || "").toLowerCase();
  if (raw.includes("coach")) return { bg: "linear-gradient(160deg, #24170a 0%, #6b3f12 45%, #0f172a 100%)", chip: "#f59e0b" };
  if (raw.includes("local")) return { bg: "linear-gradient(160deg, #062a24 0%, #0f766e 45%, #0f172a 100%)", chip: "#14b8a6" };
  if (raw.includes("portfolio")) return { bg: "linear-gradient(160deg, #1e1b4b 0%, #4f46e5 45%, #0f172a 100%)", chip: "#818cf8" };
  return { bg: "linear-gradient(160deg, #07111f 0%, #0b4aa2 45%, #0b1628 100%)", chip: "#38bdf8" };
}

function buildPreviewModel(templateSlug) {
  const template = getTemplate(templateSlug || "website-business-agency");
  const built = template?.build?.("modern-blue") || { pages: [{ sections: [] }] };
  const sections = built?.pages?.[0]?.sections || [];
  const hero = sections.find((section) => ["hero", "optin_hero", "sales_hero"].includes(section?.type))?.props || {};
  const info = sections.find((section) => ["services", "features", "pricing"].includes(section?.type))?.props || {};
  const testimonial = sections.find((section) => section?.type === "testimonials")?.props || {};

  let cards = [];
  if (Array.isArray(info?.items) && info.items.length) {
    cards = info.items.slice(0, 3).map((item) => ({
      title: item?.title || item?.name || "Feature",
      text: item?.text || item?.description || "Customize this section in the builder.",
    }));
  } else if (Array.isArray(info?.plans) && info.plans.length) {
    cards = info.plans.slice(0, 3).map((plan) => ({
      title: plan?.name || "Plan",
      text: Array.isArray(plan?.bullets) ? plan.bullets.slice(0, 2).join(" • ") : "Flexible package",
    }));
  }

  if (!cards.length) {
    cards = [
      { title: "Multi-page", text: "Build a real website, not just a landing page." },
      { title: "Open source", text: "Self-hosted and fully improvable by you." },
      { title: "Visual editing", text: "Edit content, sections, and layout directly." },
    ];
  }

  return {
    template,
    heroTitle: hero?.title || humanizeThemeName(template?.name || templateSlug),
    heroText: hero?.subtitle || template?.blurb || "Editable website template preview.",
    primaryCta: hero?.primaryLabel || hero?.buttonLabel || "Use This Template",
    cards,
    quotes: Array.isArray(testimonial?.items) ? testimonial.items.slice(0, 2) : [],
  };
}

export default function ThemePreviewPage() {
  const router = useRouter();
  const templateSlug = String(router.query.theme || router.query.template || "").trim();
  const title = humanizeThemeName(templateSlug || "Template Preview");
  const accent = getThemeAccent(templateSlug);
  const preview = useMemo(() => buildPreviewModel(templateSlug), [templateSlug]);

  return (
    <>
      <Head>
        <title>{title} Preview | GR8</title>
      </Head>

      <main style={styles.page(accent.bg)}>
        <section style={styles.shell}>
          <div style={styles.topBar}>
            <div>
              <p style={{ ...styles.kicker, color: accent.chip }}>GR8 TEMPLATE PREVIEW</p>
              <h1 style={styles.title}>{preview.template?.name || title}</h1>
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

          <div style={styles.previewFrame}>
            <header style={styles.siteNav}>
              <strong style={styles.siteBrand}>{preview.template?.name || title}</strong>
              <nav style={styles.siteLinks}>
                <span>Home</span>
                <span>About</span>
                <span>Services</span>
                <span>Contact</span>
              </nav>
            </header>

            <section style={styles.hero}>
              <div style={styles.heroBadge}>{preview.template?.type || "website"}</div>
              <h2 style={styles.heroTitle}>{preview.heroTitle}</h2>
              <p style={styles.heroText}>{preview.heroText}</p>
              <div style={styles.heroButtons}>
                <span style={{ ...styles.primaryBtn, background: accent.chip }}>{preview.primaryCta}</span>
                <span style={styles.secondaryBtn}>Preview Sections</span>
              </div>
            </section>

            <section style={styles.cardGrid}>
              {preview.cards.map((card) => (
                <article key={card.title} style={styles.card}>
                  <h3 style={styles.cardTitle}>{card.title}</h3>
                  <p style={styles.cardText}>{card.text}</p>
                </article>
              ))}
            </section>

            {preview.quotes.length ? (
              <section style={styles.quoteWrap}>
                {preview.quotes.map((item, index) => (
                  <blockquote key={`${item?.name || "quote"}-${index}`} style={styles.quoteCard}>
                    <p style={styles.quoteText}>“{item?.quote || "Real customer proof lives here."}”</p>
                    <footer style={styles.quoteAuthor}>{item?.name || "Client"}</footer>
                  </blockquote>
                ))}
              </section>
            ) : null}
          </div>
        </section>
      </main>
    </>
  );
}

const styles = {
  page: (background) => ({
    minHeight: "100vh",
    padding: "24px",
    display: "grid",
    placeItems: "center",
    background,
  }),
  shell: {
    width: "min(1400px, 100%)",
    display: "grid",
    gap: "18px",
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
  },
  topActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  kicker: {
    margin: 0,
    fontSize: "12px",
    fontWeight: 800,
    letterSpacing: ".16em",
  },
  title: {
    margin: "6px 0 0",
    color: "#fff",
    fontSize: "36px",
    lineHeight: 1.1,
  },
  backBtn: {
    textDecoration: "none",
    borderRadius: "12px",
    padding: "12px 16px",
    background: "rgba(255,255,255,.1)",
    border: "1px solid rgba(255,255,255,.22)",
    color: "#fff",
    fontWeight: 700,
  },
  previewFrame: {
    minHeight: "78vh",
    borderRadius: "20px",
    padding: "22px",
    background: "rgba(8,15,29,.82)",
    border: "1px solid rgba(255,255,255,.08)",
    display: "grid",
    gap: 18,
  },
  siteNav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    padding: "14px 16px",
    borderRadius: 14,
    background: "rgba(255,255,255,.05)",
    border: "1px solid rgba(255,255,255,.08)",
    color: "#e2e8f0",
  },
  siteBrand: {
    fontSize: 18,
    fontWeight: 800,
    color: "#fff",
  },
  siteLinks: {
    display: "flex",
    gap: 14,
    flexWrap: "wrap",
    fontSize: 14,
  },
  hero: {
    borderRadius: 18,
    padding: "48px 24px",
    background: "linear-gradient(135deg, rgba(37,99,235,.30), rgba(15,23,42,.95))",
    border: "1px solid rgba(255,255,255,.12)",
    color: "#fff",
    textAlign: "center",
    display: "grid",
    gap: 12,
  },
  heroBadge: {
    justifySelf: "center",
    padding: "6px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,.12)",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: ".12em",
    textTransform: "uppercase",
  },
  heroTitle: {
    margin: 0,
    fontSize: "44px",
    lineHeight: 1.08,
  },
  heroText: {
    margin: "0 auto",
    maxWidth: 760,
    color: "#dbeafe",
    fontSize: "18px",
    lineHeight: 1.6,
  },
  heroButtons: {
    display: "flex",
    justifyContent: "center",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 8,
  },
  primaryBtn: {
    display: "inline-flex",
    padding: "12px 18px",
    borderRadius: 999,
    color: "#08101a",
    fontWeight: 800,
  },
  secondaryBtn: {
    display: "inline-flex",
    padding: "12px 18px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.25)",
    color: "#fff",
    fontWeight: 700,
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  },
  card: {
    borderRadius: 16,
    padding: "18px 16px",
    background: "#ffffff",
    border: "1px solid #dbe5f1",
  },
  cardTitle: {
    margin: "0 0 8px",
    color: "#0f172a",
    fontSize: 18,
  },
  cardText: {
    margin: 0,
    color: "#475569",
    lineHeight: 1.6,
  },
  quoteWrap: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 14,
  },
  quoteCard: {
    margin: 0,
    borderRadius: 16,
    padding: "18px 16px",
    background: "rgba(255,255,255,.08)",
    border: "1px solid rgba(255,255,255,.12)",
    color: "#fff",
  },
  quoteText: {
    margin: "0 0 10px",
    lineHeight: 1.7,
    color: "#e2e8f0",
  },
  quoteAuthor: {
    color: "#93c5fd",
    fontWeight: 800,
  },
};
