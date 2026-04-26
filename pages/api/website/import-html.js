// pages/api/website/import-html.js
// POST {
//   url?: string,
//   html?: string,
//   projectName?: string,
//   stylePack?: "executive"|"vibrant"|"editorial"|"minimal",
//   crawl?: boolean,
//   maxPages?: number
// }

const STYLE_PACKS = {
  executive: {
    navBg: "#0b1220",
    navText: "#e2e8f0",
    heroBg: "#1d4ed8",
    textBg: "#ffffff",
    textColor: "#0f172a",
    footerBg: "#0f172a",
    footerText: "#e2e8f0",
  },
  vibrant: {
    navBg: "#111827",
    navText: "#ecfeff",
    heroBg: "#0891b2",
    textBg: "#ecfeff",
    textColor: "#083344",
    footerBg: "#0f172a",
    footerText: "#e0f2fe",
  },
  editorial: {
    navBg: "#1f2937",
    navText: "#f9fafb",
    heroBg: "#4b5563",
    textBg: "#ffffff",
    textColor: "#111827",
    footerBg: "#111827",
    footerText: "#f3f4f6",
  },
  minimal: {
    navBg: "#0f172a",
    navText: "#f8fafc",
    heroBg: "#334155",
    textBg: "#ffffff",
    textColor: "#0f172a",
    footerBg: "#1e293b",
    footerText: "#f1f5f9",
  },
};

function rid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `imp_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function stripTags(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqByText(values) {
  const seen = new Set();
  return values.filter((v) => {
    const key = String(v || "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickTitleFromHtml(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return stripTags(h1[1]);

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) return stripTags(title[1]);

  return "Website";
}

function pickMetaDescription(html) {
  const m = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
  return m ? stripTags(m[1]) : "";
}

function collectParagraphs(html, max = 4) {
  const matches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((line) => line.length > 40)
    .slice(0, max);
  return uniqByText(matches);
}

function collectHeadings(html, max = 6) {
  const matches = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean)
    .slice(0, max);
  return uniqByText(matches);
}

function collectImages(html, max = 6) {
  const images = [...html.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi)]
    .map((m) => String(m[1] || "").trim())
    .filter((src) => /^https?:\/\//i.test(src))
    .slice(0, max);

  return uniqByText(images);
}

function collectButtons(html, max = 2) {
  const links = [...html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => ({
      href: String(m[1] || "#").trim(),
      label: stripTags(m[2] || "Learn More"),
    }))
    .filter((a) => a.label && a.label.length <= 40)
    .slice(0, max);

  return links;
}

function toSentence(text) {
  const v = String(text || "").trim();
  if (!v) return "";
  return /[.!?]$/.test(v) ? v : `${v}.`;
}

function polishHeadline(rawTitle, fallbackProjectName) {
  const base = String(rawTitle || fallbackProjectName || "Your Next Big Launch").trim();
  if (!base) return "Launch a premium digital experience";
  if (base.length > 18) return base;
  return `${base}: built for credibility and growth`;
}

function polishSubheadline(metaDescription, firstParagraph) {
  const source = String(metaDescription || firstParagraph || "").trim();
  if (!source) {
    return "A clear message, polished visuals, and conversion-ready structure designed to turn visitors into action.";
  }
  const trimmed = source.slice(0, 220);
  return toSentence(trimmed);
}

function titleFromPath(pathname) {
  const normalized = String(pathname || "").replace(/^\/+|\/+$/g, "");
  if (!normalized) return "Home";
  const last = normalized.split("/").filter(Boolean).pop() || "Home";
  return last
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function objectiveForPageName(name) {
  const key = String(name || "").toLowerCase();
  if (key.includes("home")) return "Establish trust and present the core offer";
  if (key.includes("about")) return "Build authority and brand credibility";
  if (key.includes("service") || key.includes("product") || key.includes("pricing")) return "Show value and move visitors toward decision";
  if (key.includes("contact") || key.includes("book")) return "Capture qualified inquiries";
  if (key.includes("blog") || key.includes("article")) return "Educate and build topical trust";
  return "Move visitors toward action";
}

function addCandidate(candidates, href, baseUrl) {
  if (!href) return;
  const raw = String(href || "").trim();
  if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:") || raw.startsWith("javascript:")) return;

  let parsed;
  try {
    parsed = new URL(raw, baseUrl);
  } catch {
    return;
  }

  const base = new URL(baseUrl);
  if (parsed.origin !== base.origin) return;
  if (/\.(pdf|jpg|jpeg|png|gif|webp|svg|zip|rar)$/i.test(parsed.pathname)) return;

  const clean = `${parsed.origin}${parsed.pathname.replace(/\/$/, "") || "/"}`;
  candidates.add(clean);
}

function scorePath(pathname) {
  const value = String(pathname || "").toLowerCase();
  if (value === "/" || value === "") return 100;
  if (value.includes("about")) return 90;
  if (value.includes("service")) return 88;
  if (value.includes("product")) return 86;
  if (value.includes("pricing")) return 84;
  if (value.includes("contact")) return 82;
  if (value.includes("book")) return 80;
  if (value.includes("blog")) return 70;
  return 40 - Math.min(value.split("/").length, 5);
}

function buildImportedBlocks({ html, sourceUrl, stylePack, projectName }) {
  const style = STYLE_PACKS[stylePack] || STYLE_PACKS.executive;
  const title = pickTitleFromHtml(html);
  const metaDescription = pickMetaDescription(html);
  const headings = collectHeadings(html);
  const paragraphs = collectParagraphs(html);
  const images = collectImages(html);
  const buttons = collectButtons(html);

  const polishedHeadline = polishHeadline(title, projectName);
  const polishedSub = polishSubheadline(metaDescription, paragraphs[0]);
  const featureItems = headings.slice(0, 4);
  const bodyText = [metaDescription, ...paragraphs.slice(0, 2)].filter(Boolean).map(toSentence).join("\n\n");
  const heroImage = images[0] || "";

  const blocks = [
    {
      id: rid(),
      type: "nav-bar",
      props: {
        brand: title || projectName || "Your Brand",
        links: [
          { label: "Home", href: "#home" },
          { label: "About", href: "#about" },
          { label: "Services", href: "#services" },
          { label: "Contact", href: "#contact" },
        ],
        ctaText: buttons[0]?.label || "Get Started",
        ctaLink: buttons[0]?.href || "#contact",
        backgroundColor: style.navBg,
        textColor: style.navText,
      },
    },
    {
      id: rid(),
      type: "hero",
      props: {
        headline: polishedHeadline,
        subheadline: polishedSub,
        ctaText: buttons[0]?.label || "Learn More",
        ctaLink: buttons[0]?.href || "#contact",
        backgroundStyle: heroImage ? "image" : "gradient",
        backgroundImage: heroImage,
        backgroundColor: style.heroBg,
      },
    },
  ];

  if (featureItems.length) {
    blocks.push({
      id: rid(),
      type: "feature-list",
      props: {
        title: "Highlights",
        items: featureItems,
        layout: "columns",
      },
    });
  }

  if (bodyText) {
    blocks.push({
      id: rid(),
      type: "text",
      props: {
        text: bodyText,
        alignment: "left",
        textColor: style.textColor,
        backgroundColor: style.textBg,
      },
    });
  }

  if (images.length > 1) {
    blocks.push({
      id: rid(),
      type: "image-gallery",
      props: {
        title: "Gallery",
        columns: 3,
        images: images.slice(1, 7).map((src, idx) => ({ src, alt: `Imported image ${idx + 1}` })),
      },
    });
  }

  blocks.push({
    id: rid(),
    type: "cta-button",
    props: {
      text: buttons[1]?.label || "Contact Us",
      link: buttons[1]?.href || "#contact",
      alignment: "center",
      style: "primary",
    },
  });

  blocks.push({
    id: rid(),
    type: "text",
    props: {
      text: `© ${new Date().getFullYear()} ${title || projectName || "Your Brand"}. All rights reserved.`,
      alignment: "center",
      textColor: style.footerText,
      backgroundColor: style.footerBg,
    },
  });

  return {
    title,
    pageName: titleFromPath(new URL(sourceUrl).pathname),
    objective: objectiveForPageName(titleFromPath(new URL(sourceUrl).pathname)),
    blocks,
  };
}

async function fetchHtml(url) {
  const fetched = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 WebsiteBuilderImporter",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!fetched.ok) {
    throw new Error(`Could not fetch URL (${fetched.status})`);
  }

  return String(await fetched.text()).slice(0, 1_500_000);
}

function discoverInternalUrls(html, baseUrl, maxPages) {
  const candidates = new Set();
  const matches = [...String(html || "").matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi)];

  matches.forEach((m) => addCandidate(candidates, m[1], baseUrl));

  const root = new URL(baseUrl);
  const sorted = [...candidates]
    .filter((href) => href !== `${root.origin}${root.pathname.replace(/\/$/, "") || "/"}`)
    .sort((a, b) => scorePath(new URL(b).pathname) - scorePath(new URL(a).pathname));

  return sorted.slice(0, Math.max(0, maxPages - 1));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    let {
      url,
      html,
      projectName,
      stylePack = "executive",
      crawl = false,
      maxPages = 4,
    } = req.body || {};

    if (!html && !url) {
      return res.status(400).json({ ok: false, error: "Provide url or html" });
    }

    const safeStylePack = STYLE_PACKS[String(stylePack || "").toLowerCase()] ? String(stylePack).toLowerCase() : "executive";
    const safeMaxPages = Math.min(8, Math.max(1, Number(maxPages) || 4));
    const doCrawl = !!crawl;

    if (url) {
      const target = String(url || "").trim();
      if (!/^https?:\/\//i.test(target)) {
        return res.status(400).json({ ok: false, error: "Use a full URL starting with http:// or https://" });
      }

      const rootHtml = await fetchHtml(target);
      const targets = [target];

      if (doCrawl && safeMaxPages > 1) {
        const discovered = discoverInternalUrls(rootHtml, target, safeMaxPages);
        discovered.forEach((link) => targets.push(link));
      }

      const pageResults = [];
      for (let i = 0; i < targets.length; i += 1) {
        const sourceUrl = targets[i];
        try {
          const sourceHtml = i === 0 ? rootHtml : await fetchHtml(sourceUrl);
          const result = buildImportedBlocks({
            html: sourceHtml,
            sourceUrl,
            stylePack: safeStylePack,
            projectName,
          });
          pageResults.push({ sourceUrl, ...result });
        } catch {
          // Ignore page-level fetch failures so import still works for the rest.
        }
      }

      if (!pageResults.length) {
        return res.status(400).json({ ok: false, error: "Could not import pages from this URL" });
      }

      const cleanProjectName = String(projectName || pageResults[0].title || "Imported Website").trim();
      const usedNames = new Set();
      const pages = [];
      const pageBlocks = {};

      pageResults.forEach((result, idx) => {
        let name = idx === 0 ? "Home" : result.pageName || `Page ${idx + 1}`;
        if (usedNames.has(name)) {
          let n = 2;
          while (usedNames.has(`${name} ${n}`)) n += 1;
          name = `${name} ${n}`;
        }

        usedNames.add(name);
        pages.push({ name, objective: result.objective || objectiveForPageName(name) });
        pageBlocks[name] = result.blocks;
      });

      return res.status(200).json({
        ok: true,
        projectName: cleanProjectName,
        pages,
        pageBlocks,
      });
    }

    const single = buildImportedBlocks({
      html: String(html || "").slice(0, 1_500_000),
      sourceUrl: "https://import.local/",
      stylePack: safeStylePack,
      projectName,
    });

    return res.status(200).json({
      ok: true,
      projectName: String(projectName || single.title || "Imported Website").trim(),
      pages: [{ name: "Home", objective: "Imported from HTML" }],
      pageBlocks: {
        Home: single.blocks,
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || "Import failed" });
  }
}
