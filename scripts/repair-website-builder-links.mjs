import fs from "node:fs";
import path from "node:path";

const PROJECT_ID = "2208a52a-8175-477e-823c-fc6de7fe4afe";
const ACCOUNT_ID = "35ab846e-0764-498b-b1f8-7d2cf27d85a5";
const projectPath = path.join("website-builder-sites", ACCOUNT_ID, PROJECT_ID, "full-project.json");

const mainOrder = [
  ["home", "Home"],
  ["modules", "Modules"],
  ["about-us", "About Us"],
  ["pricing", "Pricing"],
  ["contact-us", "Contact Us"],
  ["email", "Email"],
  ["crm", "CRM"],
  ["sms", "SMS"],
  ["funnels", "Funnels"],
  ["website-builder", "Website Builder"],
  ["social-media", "Social Media"],
  ["project-hub", "Project Hub"],
];

const extraLinks = [
  { id: "footer-extra-blog", label: "Blog", linkType: "anchor", href: "#blog", slug: "blog" },
  { id: "footer-extra-privacy-policy", label: "Privacy Policy", linkType: "anchor", href: "#privacy", slug: "privacy" },
  { id: "footer-extra-terms", label: "Terms", linkType: "anchor", href: "#terms", slug: "terms" },
];

function slugify(value = "") {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function hrefForSlug(slug) {
  return slug === "home" ? "/" : `/${slug}`;
}

function pageRecord(slug, label, order, existing = {}) {
  return {
    ...existing,
    id: String(existing.id || slug),
    name: label,
    slug,
    objective: existing.objective || `Build the ${label} page.`,
    file: existing.file || `${slug}.json`,
    order,
  };
}

function findPage(project, slug, label) {
  const wanted = new Set([slug, slugify(label)]);
  return (Array.isArray(project.pages) ? project.pages : []).find((page) => (
    wanted.has(String(page?.id || "")) ||
    wanted.has(slugify(page?.slug || "")) ||
    wanted.has(slugify(page?.name || page?.title || ""))
  ));
}

function buildPageMap(project) {
  const map = new Map();
  (Array.isArray(project.pages) ? project.pages : []).forEach((page) => {
    const label = String(page?.name || page?.title || "").trim();
    const slug = slugify(page?.slug || label);
    if (!label || !slug) return;
    const ref = { id: String(page?.id || slug), label, slug, href: hrefForSlug(slug) };
    [ref.id, ref.slug, slugify(ref.label), ref.href.replace(/^\/+/, "")].forEach((key) => {
      if (key) map.set(slugify(key), ref);
    });
  });
  return map;
}

function resolvePageLink(item, pageMap) {
  const keys = [
    item?.pageId,
    item?.internalPageId,
    item?.targetPageId,
    item?.linkedPageId,
    item?.page?.id,
    item?.slug,
    item?.pageSlug,
    item?.href,
    item?.url,
    item?.path,
    item?.label,
  ];
  for (const value of keys) {
    const key = slugify(String(value || "").replace(/^\/+/, "").split(/[?#]/)[0]);
    if (key && pageMap.has(key)) return pageMap.get(key);
  }
  return null;
}

function normalizeNavLink(item, pageMap, fallbackSlug = "") {
  const page = resolvePageLink(item, pageMap) || (fallbackSlug ? pageMap.get(fallbackSlug) : null);
  if (page) {
    return {
      ...(item && typeof item === "object" ? item : {}),
      id: item?.id || `nav-page-${page.id}`,
      label: page.label,
      linkType: "page",
      pageId: page.id,
      slug: page.slug,
      href: page.href,
      children: Array.isArray(item?.children) ? item.children.map((child) => normalizeNavLink(child, pageMap)).filter(Boolean) : [],
    };
  }
  const label = String(item?.label || item?.title || item?.name || "").trim();
  const href = String(item?.href || item?.url || item?.path || "").trim();
  if (!label || label === "[object Object]" || /^page\s+\d+$/i.test(label)) return null;
  const linkType = href.startsWith("#") ? "anchor" : /^(https?:|mailto:|tel:)/i.test(href) ? "external" : href ? "custom" : "none";
  return {
    ...(item && typeof item === "object" ? item : {}),
    id: item?.id || `nav-custom-${slugify(label) || Date.now()}`,
    label,
    linkType,
    pageId: "",
    href: linkType === "none" ? "" : href,
    children: Array.isArray(item?.children) ? item.children.map((child) => normalizeNavLink(child, pageMap)).filter(Boolean) : [],
  };
}

function ensurePages(project) {
  const requested = mainOrder.map(([slug, label], order) => pageRecord(slug, label, order, findPage(project, slug, label) || {}));
  const requestedKeys = new Set(requested.map((page) => page.id));
  const preserved = (Array.isArray(project.pages) ? project.pages : [])
    .filter((page) => page && !requestedKeys.has(String(page.id || slugify(page.slug || page.name || ""))))
    .map((page, index) => ({ ...page, order: mainOrder.length + index }));
  project.pages = [...requested, ...preserved];
  project.pageOrder = project.pages.map((page) => page.id);
  project.pageSlugs = Object.fromEntries(project.pages.map((page) => [page.name, page.slug]));
}

function repairProject(project) {
  ensurePages(project);
  const pageMap = buildPageMap(project);

  const requestedNavLinks = mainOrder.map(([slug]) => {
    const page = pageMap.get(slug);
    return { id: `nav-page-${page.id}`, label: page.label, linkType: "page", pageId: page.id, slug: page.slug, href: page.href, children: [] };
  });

  if (project.globalNavBlock?.type === "nav-bar") {
    const existing = Array.isArray(project.globalNavBlock.props?.links) ? project.globalNavBlock.props.links : [];
    const existingByPageId = new Map(existing.map((item) => {
      const page = resolvePageLink(item, pageMap);
      return page ? [page.id, normalizeNavLink(item, pageMap)] : [null, null];
    }).filter(([key, value]) => key && value));
    project.globalNavBlock.props = {
      ...(project.globalNavBlock.props || {}),
      links: requestedNavLinks.map((link) => ({ ...link, ...(existingByPageId.get(link.pageId) || {}), label: link.label, pageId: link.pageId, slug: link.slug, href: link.href, linkType: "page" })),
      ctaText: project.globalNavBlock.props?.ctaText || "Contact Support",
      ctaLink: "/contact-us",
      cta: { text: project.globalNavBlock.props?.ctaText || "Contact Support", linkType: "page", pageId: "contact-us", href: "/contact-us" },
    };
  }

  if (project.globalFooterBlock?.type === "footer") {
    project.globalFooterBlock.props = {
      ...(project.globalFooterBlock.props || {}),
      navLinks: requestedNavLinks.map((link) => ({ id: `footer-page-${link.pageId}`, label: link.label, linkType: "page", pageId: link.pageId, slug: link.slug, href: link.href })),
      extraLinks,
      footerNavManual: true,
    };
  }

  for (const blocks of Object.values(project.pageBlocks || {})) {
    if (!Array.isArray(blocks)) continue;
    blocks.forEach((block) => {
      if (block?.type !== "parallax") return;
      const props = block.props || {};
      const text = String(props.cta?.text || props.buttonText || props.ctaText || "").trim();
      const href = String(props.cta?.href || props.ctaLink || props.buttonLink || props.link || props.href || "").trim();
      const matchedPage = resolvePageLink({ ...props.cta, href }, pageMap) || (href === "#" || !href ? pageMap.get("contact-us") : null);
      const linkType = matchedPage ? "page" : href.startsWith("#") ? "anchor" : /^(https?:|mailto:|tel:)/i.test(href) ? "external" : href ? "custom" : "none";
      block.props = {
        ...props,
        cta: {
          text,
          linkType,
          pageId: matchedPage?.id || null,
          href: matchedPage?.href || href,
        },
        ctaText: text,
        buttonText: text,
        ctaLink: matchedPage?.href || href,
        buttonLink: matchedPage?.href || href,
      };
    });
  }

  project.updatedAt = new Date().toISOString();
  return project;
}

const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));
repairProject(project);
fs.writeFileSync(projectPath, `${JSON.stringify(project, null, 2)}\n`);

console.log(`Repaired website builder links for ${PROJECT_ID}`);
