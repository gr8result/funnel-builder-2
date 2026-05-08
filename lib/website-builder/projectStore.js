import { normalizeWebsiteBuilderAssets, resolveAssetField } from "./mediaAssets";
import { BlockDefinitions, BlockTypes } from "./pageBlockComponents";
import { getTemplate, TEMPLATES, getTemplatePageDefinitions } from "./templates";

const STORAGE_KEY = "gr8:website-projects:v1";
const ASSET_STORAGE_KEY = "gr8:website-builder-assets:v1";
const TEMPLATE_OVERRIDE_STORAGE_KEY = "gr8:website-template-overrides:v1";
const MAX_STORED_PROJECTS = 12;
const MAX_STORED_ASSETS = 72;

function toSvgDataUrl(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const BUILTIN_DECORATION_ASSETS = [
  {
    id: "builtin-deco-dot-grid",
    name: "Dot Grid",
    type: "image/svg+xml",
    src: toSvgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#f8fafc"/><g fill="#94a3b8" opacity="0.7"><circle cx="120" cy="120" r="6"/><circle cx="200" cy="120" r="6"/><circle cx="280" cy="120" r="6"/><circle cx="360" cy="120" r="6"/><circle cx="120" cy="200" r="6"/><circle cx="200" cy="200" r="6"/><circle cx="280" cy="200" r="6"/><circle cx="360" cy="200" r="6"/><circle cx="120" cy="280" r="6"/><circle cx="200" cy="280" r="6"/><circle cx="280" cy="280" r="6"/><circle cx="360" cy="280" r="6"/></g><g fill="#38bdf8" opacity="0.25"><circle cx="920" cy="180" r="120"/><circle cx="1010" cy="280" r="72"/></g></svg>'),
  },
  {
    id: "builtin-deco-rings",
    name: "Soft Rings",
    type: "image/svg+xml",
    src: toSvgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#eff6ff"/><circle cx="250" cy="420" r="180" fill="none" stroke="#38bdf8" stroke-width="34" opacity="0.22"/><circle cx="250" cy="420" r="102" fill="none" stroke="#0ea5e9" stroke-width="18" opacity="0.3"/><circle cx="880" cy="230" r="160" fill="none" stroke="#94a3b8" stroke-width="26" opacity="0.22"/><circle cx="980" cy="520" r="130" fill="none" stroke="#2563eb" stroke-width="20" opacity="0.2"/></svg>'),
  },
  {
    id: "builtin-deco-wave-lines",
    name: "Wave Lines",
    type: "image/svg+xml",
    src: toSvgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#ffffff"/><path d="M0 260 C140 200 240 340 380 280 S620 200 760 260 S1020 340 1200 240" fill="none" stroke="#38bdf8" stroke-width="18" stroke-linecap="round" opacity="0.34"/><path d="M0 360 C160 290 250 450 410 390 S650 310 830 372 S1030 450 1200 350" fill="none" stroke="#0ea5e9" stroke-width="12" stroke-linecap="round" opacity="0.3"/><path d="M0 470 C160 410 290 560 450 500 S720 410 900 500 S1050 560 1200 470" fill="none" stroke="#94a3b8" stroke-width="8" stroke-linecap="round" opacity="0.34"/></svg>'),
  },
  {
    id: "builtin-deco-crosshatch",
    name: "Crosshatch",
    type: "image/svg+xml",
    src: toSvgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#f8fafc"/><g stroke="#cbd5e1" stroke-width="2" opacity="0.55"><path d="M0 120 H1200"/><path d="M0 220 H1200"/><path d="M0 320 H1200"/><path d="M0 420 H1200"/><path d="M0 520 H1200"/><path d="M160 0 V800"/><path d="M320 0 V800"/><path d="M480 0 V800"/><path d="M640 0 V800"/><path d="M800 0 V800"/><path d="M960 0 V800"/></g><rect x="760" y="140" width="260" height="180" rx="28" fill="#dbeafe" opacity="0.55"/><rect x="170" y="470" width="240" height="150" rx="24" fill="#e0f2fe" opacity="0.72"/></svg>'),
  },
  {
    id: "builtin-deco-gradient-orb",
    name: "Gradient Orb",
    type: "image/svg+xml",
    src: toSvgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><defs><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#7dd3fc" stop-opacity="0.95"/><stop offset="58%" stop-color="#38bdf8" stop-opacity="0.42"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="800" fill="#0f172a"/><circle cx="820" cy="340" r="310" fill="url(#g)"/><circle cx="310" cy="540" r="180" fill="#38bdf8" opacity="0.12"/></svg>'),
  },
  {
    id: "builtin-deco-angled-stripes",
    name: "Angled Stripes",
    type: "image/svg+xml",
    src: toSvgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#ffffff"/><g stroke="#cbd5e1" stroke-width="18" opacity="0.32"><path d="M-40 760 L360 -40"/><path d="M120 840 L520 40"/><path d="M280 840 L680 40"/><path d="M440 840 L840 40"/><path d="M600 840 L1000 40"/><path d="M760 840 L1160 40"/></g></svg>'),
  },
  {
    id: "builtin-deco-blueprint-bg",
    name: "Blueprint Background",
    type: "image/svg+xml",
    src: toSvgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#07111f"/><g stroke="#1d4ed8" stroke-width="1" opacity="0.45"><path d="M0 80 H1200"/><path d="M0 160 H1200"/><path d="M0 240 H1200"/><path d="M0 320 H1200"/><path d="M0 400 H1200"/><path d="M0 480 H1200"/><path d="M0 560 H1200"/><path d="M0 640 H1200"/><path d="M100 0 V800"/><path d="M200 0 V800"/><path d="M300 0 V800"/><path d="M400 0 V800"/><path d="M500 0 V800"/><path d="M600 0 V800"/><path d="M700 0 V800"/><path d="M800 0 V800"/><path d="M900 0 V800"/><path d="M1000 0 V800"/><path d="M1100 0 V800"/></g><g stroke="#7dd3fc" stroke-width="4" opacity="0.65"><path d="M120 610 L360 610 L360 280 L740 280" fill="none"/><circle cx="740" cy="280" r="20" fill="none"/><path d="M840 170 L1040 170 L1040 450 L820 450" fill="none"/></g></svg>'),
  },
  {
    id: "builtin-deco-spotlight-bg",
    name: "Spotlight Background",
    type: "image/svg+xml",
    src: toSvgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><defs><radialGradient id="spot" cx="50%" cy="35%" r="55%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="26%" stop-color="#e0f2fe" stop-opacity="0.72"/><stop offset="62%" stop-color="#38bdf8" stop-opacity="0.2"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="800" fill="#ecfeff"/><ellipse cx="620" cy="290" rx="390" ry="250" fill="url(#spot)"/><ellipse cx="620" cy="740" rx="620" ry="160" fill="#bae6fd" opacity="0.34"/></svg>'),
  },
  {
    id: "builtin-deco-corner-swoosh",
    name: "Corner Swoosh",
    type: "image/svg+xml",
    src: toSvgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#ffffff"/><path d="M860 -40 C1080 90 1140 250 1210 470 L1210 840 L670 840 C860 710 950 610 990 500 C1040 360 1030 170 860 -40 Z" fill="#dbeafe" opacity="0.88"/><path d="M970 -40 C1120 110 1160 250 1220 430" fill="none" stroke="#38bdf8" stroke-width="16" stroke-linecap="round" opacity="0.44"/></svg>'),
  },
];

function mergeWebsiteBuilderAssets(userAssets) {
  return pruneWebsiteBuilderAssets({
    logo: userAssets?.logo || null,
    images: [...BUILTIN_DECORATION_ASSETS, ...(Array.isArray(userAssets?.images) ? userAssets.images : [])],
  });
}

function pruneWebsiteBuilderAssets(assets, maxImages = MAX_STORED_ASSETS) {
  const normalized = normalizeWebsiteBuilderAssets(assets);
  const seen = new Set();
  const images = [];

  for (const image of Array.isArray(normalized.images) ? normalized.images : []) {
    const fingerprint = `${String(image?.name || "")}|${String(image?.type || "")}|${String(image?.src || "")}`;
    if (!image?.src || seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    images.push(image);
    if (images.length >= maxImages) break;
  }

  return {
    logo: normalized.logo || null,
    images,
  };
}

const STYLE_PACKS = {
  executive: {
    navBg: "#0b1220",
    navText: "#e2e8f0",
    navVariant: "boxed-brand",
    navStickyMode: "sticky-transparent",
    navButtonBg: "#0ea5e9",
    navButtonText: "#ffffff",
    heroBg: "#1d4ed8",
    heroVariant: "split",
    heroMinHeight: "620px",
    textBg: "#ffffff",
    textColor: "#0f172a",
    featureVariant: "cards",
    testimonialVariant: "spotlight",
    pricingVariant: "premium",
    headingFont: "'Sora','Avenir Next','Segoe UI',sans-serif",
    bodyFont: "'Manrope','Avenir Next','Segoe UI',sans-serif",
    footerBg: "#0f172a",
    footerText: "#e2e8f0",
  },
  vibrant: {
    navBg: "#111827",
    navText: "#ecfeff",
    navVariant: "split-dark",
    navStickyMode: "sticky",
    navButtonBg: "#22d3ee",
    navButtonText: "#083344",
    heroBg: "#0891b2",
    heroVariant: "spotlight",
    heroMinHeight: "600px",
    textBg: "#ecfeff",
    textColor: "#083344",
    featureVariant: "glass-cards",
    testimonialVariant: "bubble",
    pricingVariant: "premium",
    headingFont: "'Space Grotesk','Sora','Segoe UI',sans-serif",
    bodyFont: "'Plus Jakarta Sans','Manrope','Segoe UI',sans-serif",
    footerBg: "#0f172a",
    footerText: "#e0f2fe",
  },
  editorial: {
    navBg: "#1f2937",
    navText: "#f9fafb",
    navVariant: "minimal-line",
    navStickyMode: "sticky-transparent",
    navButtonBg: "#ffffff",
    navButtonText: "#0f172a",
    heroBg: "#4b5563",
    heroVariant: "editorial",
    heroMinHeight: "660px",
    textBg: "#ffffff",
    textColor: "#111827",
    featureVariant: "minimal-list",
    testimonialVariant: "spotlight",
    pricingVariant: "clean",
    headingFont: "'Fraunces','Georgia','Times New Roman',serif",
    bodyFont: "'Source Serif 4','Georgia','Times New Roman',serif",
    footerBg: "#111827",
    footerText: "#f3f4f6",
  },
  minimal: {
    navBg: "#0f172a",
    navText: "#f8fafc",
    navVariant: "centered-light",
    navStickyMode: "sticky",
    navButtonBg: "#0f172a",
    navButtonText: "#f8fafc",
    heroBg: "#334155",
    heroVariant: "spotlight",
    heroMinHeight: "580px",
    textBg: "#ffffff",
    textColor: "#0f172a",
    featureVariant: "minimal-list",
    testimonialVariant: "bubble",
    pricingVariant: "clean",
    headingFont: "'IBM Plex Sans','Segoe UI',sans-serif",
    bodyFont: "'Inter','Segoe UI',sans-serif",
    footerBg: "#1e293b",
    footerText: "#f1f5f9",
  },
};

function hasWindow() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function isQuotaExceededError(error) {
  return error?.name === "QuotaExceededError" || String(error?.message || "").toLowerCase().includes("quota");
}

function getStoredWebsiteBuilderAssets() {
  if (!hasWindow()) return { logo: null, images: [] };
  const raw = window.localStorage.getItem(ASSET_STORAGE_KEY);
  const parsed = safeParse(raw || "{}");
  return normalizeWebsiteBuilderAssets(parsed);
}

function isLikelyImageSource(key, value) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  if (/^data:image\//i.test(raw)) return true;

  const keyHint = String(key || "").toLowerCase();
  if (!/(image|logo|src|background)/i.test(keyHint)) return false;

  return /^(https?:)?\/\//i.test(raw) || /^\//.test(raw);
}

function collectImageSources(value, results, path = []) {
  if (!value) return;

  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectImageSources(entry, results, [...path, index]));
    return;
  }

  if (typeof value !== "object") return;

  Object.entries(value).forEach(([key, entry]) => {
    if (typeof entry === "string" && isLikelyImageSource(key, entry)) {
      results.push({ src: entry.trim(), keyPath: [...path, key] });
      return;
    }

    if (entry && typeof entry === "object") {
      collectImageSources(entry, results, [...path, key]);
    }
  });
}

function buildProjectTemplateAssets(project, pageBlocks, globalBlocks = {}) {
  const collected = [];
  collectImageSources(pageBlocks, collected, ["pages"]);
  collectImageSources(globalBlocks, collected, ["globals"]);

  const seen = new Set();
  const projectSlug = slugify(project?.templateSlug || project?.name || "website");
  const projectName = project?.name || project?.brief?.businessName || "Template";

  return collected.reduce((assets, entry, index) => {
    const src = String(entry?.src || "").trim();
    if (!src || seen.has(src)) return assets;
    seen.add(src);

    assets.push({
      id: `template-${projectSlug}-${index + 1}`,
      name: `${projectName} image ${assets.length + 1}`,
      type: /\.svg(\?|$)/i.test(src) || /^data:image\/svg\+xml/i.test(src) ? "image/svg+xml" : "image/jpeg",
      src,
    });
    return assets;
  }, []);
}

function seedProjectAssets(project, pageBlocks, globalBlocks = {}) {
  if (!hasWindow()) return;

  const stored = getStoredWebsiteBuilderAssets();
  const existingBySrc = new Set((stored.images || []).map((image) => String(image?.src || "").trim()).filter(Boolean));
  const templateAssets = buildProjectTemplateAssets(project, pageBlocks, globalBlocks).filter((image) => !existingBySrc.has(String(image?.src || "").trim()));

  if (!templateAssets.length) return;

  saveWebsiteBuilderAssets({
    logo: stored.logo,
    images: [...templateAssets, ...(stored.images || [])],
  });
}

function sanitizeValueForStorage(value, options = {}) {
  const compact = !!options.compact;
  const assets = options.assets || (hasWindow() ? getWebsiteBuilderAssets() : null);
  const nextOptions = options.assets ? options : { ...options, assets };

  if (Array.isArray(value)) {
    return value
      .slice(0, compact ? 12 : 24)
      .map((entry) => sanitizeValueForStorage(entry, nextOptions));
  }

  if (!value || typeof value !== "object") {
    if (typeof value === "string" && compact && value.length > 120000) {
      return value.slice(0, 120000);
    }
    return value;
  }

  const next = {};
  const resolvedBackgroundImage = !compact && Object.prototype.hasOwnProperty.call(value, "backgroundImage")
    ? resolveAssetField(value, "backgroundImage", assets)
    : "";
  for (const [key, entry] of Object.entries(value)) {
    if (key === "backgroundImage" && !entry && resolvedBackgroundImage) {
      next[key] = resolvedBackgroundImage;
      continue;
    }

    if (typeof entry === "string" && /^data:image\//i.test(entry)) {
      const hasAssetRef = !!value[`${key}AssetId`];
      const keepInlineImage = !compact && /backgroundimage/i.test(String(key || ""));
      next[key] = keepInlineImage || !hasAssetRef
        ? entry
        : "";
      continue;
    }

    next[key] = sanitizeValueForStorage(entry, nextOptions);
  }

  return next;
}

function sanitizeProjectForStorage(project, options = {}) {
  if (!project || typeof project !== "object") return project;

  const safeProject = {
    ...project,
    pageBlocks: sanitizeValueForStorage(project?.pageBlocks || {}, options),
    pagesContent: {},
  };

  if (project.globalNavBlock) {
    safeProject.globalNavBlock = sanitizeValueForStorage(project.globalNavBlock, options);
  }
  if (project.globalFooterBlock) {
    safeProject.globalFooterBlock = sanitizeValueForStorage(project.globalFooterBlock, options);
  }

  delete safeProject.brandAssets;
  delete safeProject.chaiData;

  return safeProject;
}

function normalizeProjectsForStorage(projects, options = {}) {
  const list = Array.isArray(projects) ? projects : [];
  const limit = options.compact ? Math.min(MAX_STORED_PROJECTS, 6) : MAX_STORED_PROJECTS;
  return list.slice(0, limit).map((project) => sanitizeProjectForStorage(project, options));
}

function createId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `wb_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function deepClone(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function createBlock(type, props = {}) {
  return {
    id: createId(),
    type,
    props: {
      ...deepClone(BlockDefinitions[type]?.defaultProps || {}),
      ...props,
    },
  };
}

function inferProjectBaseLayoutWidth(project, fallback = 1500) {
  const candidates = [];

  const collect = (block) => {
    const value = Number(block?.props?.baseLayoutWidth || 0);
    if (Number.isFinite(value) && value >= 720) {
      candidates.push(value);
    }
  };

  Object.values(project?.pageBlocks || {}).forEach((blocks) => {
    (Array.isArray(blocks) ? blocks : []).forEach(collect);
  });

  collect(project?.globalNavBlock);
  collect(project?.globalFooterBlock);

  return candidates[0] || fallback;
}

function normalizeStoredBlock(block, options = {}) {
  if (!block || typeof block !== "object") return block;

  const type = String(block.type || "").trim();
  const currentProps = block.props && typeof block.props === "object" ? deepClone(block.props) : {};
  const nextProps = {
    ...currentProps,
  };

  if (
    [BlockTypes.NAV_BAR, BlockTypes.HERO, BlockTypes.PARALLAX, BlockTypes.IMAGE, BlockTypes.IMAGE_STACK].includes(type)
    && currentProps.fullWidthBackground === undefined
  ) {
    nextProps.fullWidthBackground = true;
  }

  if (type === BlockTypes.IMAGE_STACK && currentProps.baseLayoutWidth === undefined) {
    nextProps.baseLayoutWidth = inferProjectBaseLayoutWidth(options.project, 1500);
  }

  if (
    [BlockTypes.HERO, BlockTypes.PARALLAX].includes(type)
    && String(currentProps.backgroundImage || "").trim()
    && (!currentProps.backgroundStyle || currentProps.backgroundStyle === "solid")
  ) {
    nextProps.backgroundStyle = "image";
  }

  return {
    ...block,
    id: block.id || createId(),
    type,
    props: nextProps,
  };
}

function normalizeStoredBlockList(blocks) {
  const project = arguments[1]?.project;
  return Array.isArray(blocks) ? blocks.map((block) => normalizeStoredBlock(block, { project })) : [];
}

function lines(parts) {
  return parts.filter(Boolean).join("\n\n");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function isLinkForPage(link, pageName) {
  const pageSlug = slugify(pageName);
  if (!pageSlug) return false;

  const labelSlug = slugify(link?.label || "");
  if (labelSlug === pageSlug) return true;

  const href = String(link?.href || "").trim().toLowerCase();
  if (!href) return false;

  return href.includes(`page=${pageSlug}`) || href === `#${pageSlug}` || href.endsWith(`/${pageSlug}`);
}

function appendMissingPageLinks(links, pages) {
  const safeLinks = Array.isArray(links) ? links.map((link) => ({ ...(link || {}) })) : [];
  const safePages = Array.isArray(pages) ? pages.filter((page) => String(page?.name || "").trim()) : [];

  safePages.forEach((page) => {
    if (safeLinks.some((link) => isLinkForPage(link, page.name))) return;
    safeLinks.push({ label: page.name, href: `#${slugify(page.name)}` });
  });

  return safeLinks;
}

function normalizeGlobalBlocks(project) {
  if (!project || typeof project !== "object") return {};

  const pages = Array.isArray(project.pages) ? project.pages : [];
  const patch = {};

  if (project.globalNavBlock?.type === BlockTypes.NAV_BAR) {
    const currentLinks = Array.isArray(project.globalNavBlock?.props?.links)
      ? project.globalNavBlock.props.links
      : [];
    const nextLinks = appendMissingPageLinks(currentLinks, pages);
    if (JSON.stringify(currentLinks) !== JSON.stringify(nextLinks)) {
      patch.globalNavBlock = {
        ...project.globalNavBlock,
        props: {
          ...(project.globalNavBlock.props || {}),
          links: nextLinks,
        },
      };
    }
  }

  if (project.globalFooterBlock?.type === BlockTypes.FOOTER) {
    const currentNavLinks = Array.isArray(project.globalFooterBlock?.props?.navLinks)
      ? project.globalFooterBlock.props.navLinks
      : [];
    const nextNavLinks = appendMissingPageLinks(currentNavLinks, pages);
    if (JSON.stringify(currentNavLinks) !== JSON.stringify(nextNavLinks)) {
      patch.globalFooterBlock = {
        ...project.globalFooterBlock,
        props: {
          ...(project.globalFooterBlock.props || {}),
          navLinks: nextNavLinks,
        },
      };
    }
  }

  return patch;
}

function autoBalanceComposition(blocks) {
  const list = Array.isArray(blocks) ? blocks : [];
  if (!list.length) return list;

  const balanced = [];
  const repetitiveTypes = new Set([
    BlockTypes.TEXT,
    BlockTypes.TESTIMONIAL,
    BlockTypes.CTA_BUTTON,
    BlockTypes.FEATURE_LIST,
  ]);

  let runType = "";
  let runCount = 0;

  list.forEach((block) => {
    const type = block?.type || "";
    if (type === runType) {
      runCount += 1;
    } else {
      runType = type;
      runCount = 1;
    }

    if (repetitiveTypes.has(type) && runCount > 1) {
      balanced.push(
        createBlock(BlockTypes.SPACE, {
          height: "42px",
        })
      );
      runCount = 1;
    }

    balanced.push(block);
  });

  return balanced;
}

function getStyleTokens(project) {
  const requested = String(
    project?.stylePack || project?.brief?.stylePack || project?.brief?.importStylePack || "executive"
  ).toLowerCase();
  return STYLE_PACKS[requested] || STYLE_PACKS.executive;
}

function inferTemplateSlug(project) {
  if (project?.templateSlug) return project.templateSlug;

  const goal = String(project?.brief?.goal || "").toLowerCase();
  const buildType = String(project?.buildType || "website").toLowerCase();
  const preferredType = buildType === "landing" ? "funnel" : "website";
  const matching = TEMPLATES.filter((template) => template.type === preferredType);

  if (goal.includes("book") || goal.includes("call") || goal.includes("apply")) {
    return matching.find((template) => template.slug.includes("booking"))?.slug || matching[0]?.slug || "";
  }

  if (goal.includes("sell") || goal.includes("checkout") || goal.includes("product")) {
    return matching.find((template) => template.slug.includes("sales"))?.slug || matching[0]?.slug || "";
  }

  if (goal.includes("lead") || goal.includes("subscribe") || goal.includes("webinar")) {
    return matching.find((template) => template.slug.includes("optin"))?.slug || matching[0]?.slug || "";
  }

  return matching.find((template) => template.slug === "website-generic-premium")?.slug || matching[0]?.slug || TEMPLATES[0]?.slug || "";
}

function normalizeTemplatePageKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function listWebsiteTemplateOverrides() {
  if (!hasWindow()) return {};
  const raw = window.localStorage.getItem(TEMPLATE_OVERRIDE_STORAGE_KEY);
  const parsed = safeParse(raw || "{}");
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

function saveWebsiteTemplateOverrides(overrides) {
  if (!hasWindow()) return false;

  try {
    window.localStorage.setItem(TEMPLATE_OVERRIDE_STORAGE_KEY, JSON.stringify(overrides || {}));
    return true;
  } catch (error) {
    console.warn("Could not save website template overrides.", error);
    return false;
  }
}

function sanitizeTemplateOverrideForStorage(templateSlug, override) {
  if (!templateSlug) return null;

  const safeOverride = {
    templateSlug,
    updatedAt: override?.updatedAt || new Date().toISOString(),
    pageBlocks: sanitizeValueForStorage(override?.pageBlocks || {}),
  };

  if (override?.globalNavBlock) {
    safeOverride.globalNavBlock = sanitizeValueForStorage(override.globalNavBlock);
  }
  if (override?.globalFooterBlock) {
    safeOverride.globalFooterBlock = sanitizeValueForStorage(override.globalFooterBlock);
  }

  return safeOverride;
}

function resolveTemplateOverridePageBlocks(templateOverride, ...keys) {
  const pageBlocks = templateOverride?.pageBlocks;
  if (!pageBlocks || typeof pageBlocks !== "object") return null;

  const normalizedKeys = keys.map(normalizeTemplatePageKey).filter(Boolean);
  const entry = Object.entries(pageBlocks).find(([pageKey]) => normalizedKeys.includes(normalizeTemplatePageKey(pageKey)));
  return Array.isArray(entry?.[1]) ? deepClone(entry[1]) : null;
}

export function getWebsiteTemplateOverride(templateSlug) {
  const key = String(templateSlug || "").trim();
  if (!key) return null;
  const overrides = listWebsiteTemplateOverrides();
  const match = overrides[key];
  if (!match || typeof match !== "object") return null;
  return sanitizeTemplateOverrideForStorage(key, match);
}

export function deleteWebsiteTemplateOverride(templateSlug) {
  const key = String(templateSlug || "").trim();
  if (!key) return false;

  const overrides = listWebsiteTemplateOverrides();
  if (!Object.prototype.hasOwnProperty.call(overrides, key)) return true;
  delete overrides[key];
  return saveWebsiteTemplateOverrides(overrides);
}

export function updateWebsiteTemplateOverride(templateSlug, patch = {}) {
  const key = String(templateSlug || "").trim();
  if (!key) return null;

  const overrides = listWebsiteTemplateOverrides();
  const current = getWebsiteTemplateOverride(key) || { templateSlug: key, pageBlocks: {} };
  const next = sanitizeTemplateOverrideForStorage(key, {
    ...current,
    ...patch,
    pageBlocks: {
      ...(current.pageBlocks || {}),
      ...(patch.pageBlocks || {}),
    },
    globalNavBlock: Object.prototype.hasOwnProperty.call(patch, "globalNavBlock") ? patch.globalNavBlock : current.globalNavBlock,
    globalFooterBlock: Object.prototype.hasOwnProperty.call(patch, "globalFooterBlock") ? patch.globalFooterBlock : current.globalFooterBlock,
    updatedAt: new Date().toISOString(),
  });

  overrides[key] = next;
  return saveWebsiteTemplateOverrides(overrides) ? next : null;
}

export function saveWebsiteTemplateOverrideFromProject(project, options = {}) {
  const templateSlug = String(project?.templateSlug || "").trim();
  if (!templateSlug) return null;

  const pageName = String(options?.pageName || "").trim();
  const projectBlocks = project?.pageBlocks && typeof project.pageBlocks === "object" ? project.pageBlocks : {};
  const pageBlocks = pageName
    ? { [pageName]: deepClone(projectBlocks?.[pageName] || []) }
    : deepClone(projectBlocks);

  return updateWebsiteTemplateOverride(templateSlug, {
    pageBlocks,
    globalNavBlock: project?.globalNavBlock || null,
    globalFooterBlock: project?.globalFooterBlock || null,
  });
}

function mapTemplateSectionToBlocks(section, project, page) {
  const props = section?.props || {};
  const businessName = project?.brief?.businessName || project?.name || "Your Business";
  const objective = page?.objective || "Move visitors toward action.";
  const style = getStyleTokens(project);

  if (section?.direct && Object.values(BlockTypes).includes(section.type)) {
    return [createBlock(section.type, { ...props })];
  }

  switch (section?.type) {
    case "header":
      return [
        createBlock(BlockTypes.NAV_BAR, {
          variant: style.navVariant || "boxed-brand",
          stickyMode: style.navStickyMode || "sticky-transparent",
          fullWidthBackground: true,
          mobileMenuStyle: "hamburger",
          showLogo: true,
          brandFontSize: 20,
          linkFontSize: 16,
          ctaFontSize: 16,
          brand: props.brand || project?.brief?.businessName || project?.name || "Your Brand",
          links: asArray(props.links).length
            ? asArray(props.links).map((link) => ({
                label: link?.label || "Link",
                href: link?.href || "#",
              }))
            : [
                { label: "Home", href: "#home" },
                { label: "About", href: "#about" },
                { label: "Services", href: "#services" },
                { label: "Contact", href: "#contact" },
              ],
          ctaText: props.ctaLabel || "Get Started",
          ctaLink: props.ctaHref || "#contact",
          backgroundColor: style.navBg,
          textColor: style.navText,
          buttonColor: style.navButtonBg || "#0ea5e9",
          buttonTextColor: style.navButtonText || "#ffffff",
          headingFontFamily: style.headingFont,
          bodyFontFamily: style.bodyFont,
        }),
      ];

    case "hero":
    case "optin_hero":
    case "sales_hero":
      return [
        createBlock(BlockTypes.HERO, {
          headline: props.title || `${businessName} helps visitors take the next step`,
          subheadline: lines([
            props.subtitle,
            asArray(props.bullets).length ? asArray(props.bullets).join(" • ") : "",
            objective,
          ]),
          ctaText: props.primaryLabel || props.buttonLabel || "Get Started",
          ctaLink: props.primaryHref || props.buttonHref || "#contact",
          backgroundStyle: props.imageUrl || props.mediaUrl ? "image" : "gradient",
          backgroundImage: props.imageUrl || props.mediaUrl || "",
          backgroundColor: style.heroBg,
          minHeight: style.heroMinHeight || "560px",
          textAnimation: "fade-up",
          subheadlineAnimation: "fade-in",
          heroVariant: style.heroVariant || "spotlight",
          headingFontFamily: style.headingFont,
          bodyFontFamily: style.bodyFont,
        }),
      ];

    case "services":
    case "features":
      return [
        createBlock(BlockTypes.FEATURE_LIST, {
          title: props.title || page?.name || "What You Get",
          items: asArray(props.items).map((item) => lines([item?.title, item?.text]).replace(/\n\n/g, ": ")),
          layout: asArray(props.items).length > 3 ? "columns" : "vertical",
          featureVariant: style.featureVariant || "cards",
        }),
      ];

    case "about": {
      const blocks = [
        createBlock(BlockTypes.TEXT, {
          text: lines([
            props.title || `About ${businessName}`,
            props.text,
            asArray(props.bullets).length ? `Highlights: ${asArray(props.bullets).join(", ")}` : "",
          ]),
          backgroundColor: style.textBg,
          textColor: style.textColor,
        }),
      ];

      if (props.imageUrl) {
        blocks.push(
          createBlock(BlockTypes.IMAGE, {
            src: props.imageUrl,
            alt: props.title || `About ${businessName}`,
            caption: props.title || "About",
          })
        );
      }

      return blocks;
    }

    case "testimonials": {
      const titleBlock = props.title
        ? [
            createBlock(BlockTypes.TEXT, {
              text: props.title,
              alignment: "center",
              backgroundColor: style.textBg,
              textColor: style.textColor,
            }),
          ]
        : [];

      const quoteBlocks = asArray(props.items).slice(0, 3).map((item) =>
        createBlock(BlockTypes.TESTIMONIAL, {
          text: item?.quote || "Add customer proof here.",
          author: item?.name || "Client Name",
          role: item?.role || "Happy customer",
        })
      );

      return [...titleBlock, ...quoteBlocks];
    }

    case "pricing":
      return [
        createBlock(BlockTypes.PRICING_TABLE, {
          title: props.title || "Pricing",
          plans: asArray(props.plans).map((plan) => ({
            name: plan?.name || "Plan",
            price: `${plan?.price || ""}${plan?.period || ""}`,
            description: plan?.description || "",
            features: asArray(plan?.bullets),
            highlighted: !!plan?.primary,
          })),
        }),
      ];

    case "faq":
      return [
        createBlock(BlockTypes.FAQ, {
          title: props.title || "Frequently Asked Questions",
          items: asArray(props.items).map((item) => ({
            question: item?.q || item?.question || "Question",
            answer: item?.a || item?.answer || "Answer",
          })),
        }),
      ];

    case "stats":
      return [
        createBlock(BlockTypes.STATS, {
          title: props.title || "Highlights",
          stats: asArray(props.items).map((item) => ({
            number: item?.value || item?.number || "0",
            label: item?.label || item?.text || "Metric",
          })),
        }),
      ];

    case "gallery":
      return [
        createBlock(BlockTypes.IMAGE_GALLERY, {
          title: props.title || "Gallery",
          images: asArray(props.images).map((image) => ({
            src: image?.src || image?.image || "",
            alt: image?.alt || "Gallery image",
          })),
          columns: Math.min(3, Math.max(2, asArray(props.images).length || 3)),
        }),
      ];

    case "team":
      return [
        createBlock(BlockTypes.TEAM, {
          title: props.title || "Team",
          teamVariant: props.teamVariant || "studio-cards",
          teamRows: asArray(props.teamRows)
            .map((size) => parseInt(String(size || "").trim(), 10))
            .filter((size) => Number.isFinite(size) && size > 0)
            .slice(0, 8),
          backgroundColor: props.backgroundColor || "#ffffff",
          textColor: props.textColor || "#0f172a",
          borderColor: props.borderColor || "#e2e8f0",
          members: asArray(props.members).map((member) => ({
            name: member?.name || "Team Member",
            role: member?.role || "Role",
            image: member?.image || "",
            imageAssetId: member?.imageAssetId || "",
            bio: member?.bio || "Add a short team bio here.",
            imageX: Number.isFinite(Number(member?.imageX)) ? Number(member.imageX) : 50,
            imageY: Number.isFinite(Number(member?.imageY)) ? Number(member.imageY) : 50,
            hierarchyRow: Number.isFinite(Number(member?.hierarchyRow)) ? Math.max(0, Number(member.hierarchyRow)) : 0,
          })),
        }),
      ];

    case "newsletter":
      return [
        createBlock(BlockTypes.NEWSLETTER, {
          title: props.title || "Newsletter",
          subtitle: props.subtitle || "Invite visitors to stay connected.",
          buttonText: props.buttonText || "Subscribe",
        }),
      ];

    case "contact":
      return [
        createBlock(BlockTypes.CONTACT_FORM, {
          title: props.title || "Contact",
          subtitle: props.subtitle || "Share your details and we will get back to you.",
        }),
      ];

    case "cta":
      return [
        createBlock(BlockTypes.TEXT, {
          text: lines([props.title, props.subtitle]),
          alignment: "center",
          backgroundColor: style.textBg,
          textColor: style.textColor,
        }),
        createBlock(BlockTypes.CTA_BUTTON, {
          text: props.buttonLabel || "Get Started",
          link: props.buttonHref || "#contact",
          alignment: "center",
        }),
      ];

    case "checkout":
      return [
        createBlock(BlockTypes.PRICING_TABLE, {
          title: props.title || "Checkout",
          plans: [
            {
              name: props.productName || "Offer",
              price: props.price || "$0",
              description: props.note || props.guarantee || "",
              features: asArray(props.bullets),
              highlighted: true,
            },
          ],
        }),
        createBlock(BlockTypes.CTA_BUTTON, {
          text: props.buttonLabel || "Complete Purchase",
          link: "#checkout",
        }),
      ];

    case "thankyou":
      return [
        createBlock(BlockTypes.HERO, {
          headline: props.title || "You are in",
          subheadline: props.subtitle || "Let visitors know what happens next.",
          ctaText: props.primaryLabel || "Continue",
          ctaLink: props.primaryHref || "#",
          backgroundStyle: "gradient",
          backgroundColor: style.heroBg,
        }),
      ];

    case "footer":
      return [
        createBlock(BlockTypes.TEXT, {
          text: props.text || `© ${new Date().getFullYear()} ${businessName}. All rights reserved.`,
          alignment: "center",
          backgroundColor: style.footerBg,
          textColor: style.footerText,
        }),
      ];

    default:
      return [];
  }
}

function buildHomeBlocks(project, page, templateBlocks = []) {
  if (templateBlocks.length) return autoBalanceComposition(templateBlocks);

  const brief = project?.brief || {};
  const businessName = brief.businessName || project?.name || "Your Business";
  const offer = brief.offer || "your core offer";
  const audience = brief.targetAudience || "your ideal customer";
  const goal = brief.goal || "get more conversions";
  const style = getStyleTokens(project);

  return autoBalanceComposition([
    createBlock(BlockTypes.NAV_BAR, {
      variant: style.navVariant || "boxed-brand",
      stickyMode: style.navStickyMode || "sticky-transparent",
      mobileMenuStyle: "hamburger",
      showLogo: true,
      brandFontSize: 20,
      linkFontSize: 16,
      ctaFontSize: 16,
      brand: businessName,
      links: [
        { label: "Home", href: "#home" },
        { label: "About", href: "#about" },
        { label: "Services", href: "#services" },
        { label: "Contact", href: "#contact" },
      ],
      ctaText: goal.toLowerCase().includes("book") ? "Book Now" : "Get Started",
      ctaLink: "#contact",
      backgroundColor: style.navBg,
      textColor: style.navText,
      buttonColor: style.navButtonBg || "#0ea5e9",
      buttonTextColor: style.navButtonText || "#ffffff",
    }),
    createBlock(BlockTypes.HERO, {
      headline: `${businessName} helps ${audience} achieve better results`,
      subheadline: lines([
        `Promote ${offer} with a clear outcome-driven homepage.`,
        `Goal: ${goal}.`,
        page?.objective || "Establish trust and present the core offer.",
      ]),
      ctaText: goal.toLowerCase().includes("book") ? "Book Now" : "Get Started",
      ctaLink: "#contact",
      backgroundStyle: "image",
      backgroundImage: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80",
      enableParallax: true,
      backgroundColor: style.heroBg,
      heroVariant: style.heroVariant || "split",
      minHeight: style.heroMinHeight || "620px",
    }),
    createBlock(BlockTypes.STATS, {
      title: "Why this site converts better",
      stats: [
        { number: "Fast", label: "Clear first impression" },
        { number: "Strong", label: "Offer positioning" },
        { number: "Easy", label: "Lead capture" },
      ],
    }),
    createBlock(BlockTypes.FEATURE_LIST, {
      title: "Why clients choose this business",
      items: [
        `Offer: ${offer}`,
        `Audience: ${audience}`,
        `Outcome: ${goal}`,
      ],
      layout: "columns",
      featureVariant: style.featureVariant || "glass-cards",
      headingFontFamily: style.headingFont,
      bodyFontFamily: style.bodyFont,
    }),
    createBlock(BlockTypes.TESTIMONIAL, {
      text: `"${businessName} made the next step obvious and easy."`,
      author: "Example Client",
      role: "Customer",
      testimonialVariant: style.testimonialVariant || "spotlight",
      headingFontFamily: style.headingFont,
      bodyFontFamily: style.bodyFont,
    }),
    createBlock(BlockTypes.PRICING_TABLE, {
      title: "Simple packages",
      pricingVariant: style.pricingVariant || "premium",
      plans: [
        { name: "Starter", price: "$49", description: "For a simple offer page", features: ["Fast launch", "Clear message"] },
        { name: "Growth", price: "$149", description: "For a fuller website", features: ["Multi-page", "Lead capture", "Stronger positioning"], highlighted: true },
      ],
    }),
    createBlock(BlockTypes.FAQ, {
      title: "Questions before you take action",
      items: [
        {
          question: "What do you offer?",
          answer: offer,
        },
        {
          question: "Who is this for?",
          answer: audience,
        },
        {
          question: "What happens next?",
          answer: goal,
        },
      ],
    }),
    createBlock(BlockTypes.NEWSLETTER, {
      title: "Stay updated",
      subtitle: "Capture interest before visitors leave the page.",
      buttonText: "Subscribe",
    }),
    createBlock(BlockTypes.CONTACT_FORM, {
      title: "Start the conversation",
      subtitle: page?.objective || "Capture qualified enquiries and move visitors toward action.",
    }),
    createBlock(BlockTypes.TEXT, {
      text: `© ${new Date().getFullYear()} ${businessName}. All rights reserved.`,
      alignment: "center",
      backgroundColor: style.footerBg,
      textColor: style.footerText,
    }),
  ]);
}

function buildGenericPageBlocks(project, page) {
  const pageName = String(page?.name || "Page");
  const nameKey = pageName.toLowerCase();
  const brief = project?.brief || {};
  const businessName = brief.businessName || project?.name || "Your Business";
  const offer = brief.offer || "your offer";
  const audience = brief.targetAudience || "your audience";
  const objective = page?.objective || "Move visitors toward action.";
  const style = getStyleTokens(project);
  const navBlock = createBlock(BlockTypes.NAV_BAR, {
    variant: style.navVariant || "boxed-brand",
    stickyMode: style.navStickyMode || "sticky-transparent",
    mobileMenuStyle: "hamburger",
    showLogo: true,
    brandFontSize: 20,
    linkFontSize: 16,
    ctaFontSize: 16,
    brand: businessName,
    links: [
      { label: "Home", href: "#home" },
      { label: "About", href: "#about" },
      { label: "Services", href: "#services" },
      { label: "Contact", href: "#contact" },
    ],
    ctaText: "Contact",
    ctaLink: "#contact",
    backgroundColor: style.navBg,
    textColor: style.navText,
    buttonColor: style.navButtonBg || "#0ea5e9",
    buttonTextColor: style.navButtonText || "#ffffff",
      headingFontFamily: style.headingFont,
      bodyFontFamily: style.bodyFont,
  });
  const footerBlock = createBlock(BlockTypes.TEXT, {
    text: `© ${new Date().getFullYear()} ${businessName}. All rights reserved.`,
    alignment: "center",
    backgroundColor: style.footerBg,
    textColor: style.footerText,
  });

  if (nameKey.includes("about") || nameKey.includes("story") || nameKey.includes("team")) {
    return autoBalanceComposition([
      navBlock,
      createBlock(BlockTypes.TEXT, {
        text: lines([
          `About ${businessName}`,
          brief.notes || `${businessName} exists to help ${audience} through ${offer}.`,
          objective,
        ]),
        backgroundColor: style.textBg,
        textColor: style.textColor,
        headingFontFamily: style.headingFont,
        bodyFontFamily: style.bodyFont,
      }),
      createBlock(BlockTypes.STATS, {
        title: `${businessName} at a glance`,
        stats: [
          { number: "10+", label: "Years of experience" },
          { number: "500+", label: "Clients helped" },
          { number: "98%", label: "Client satisfaction" },
        ],
      }),
      createBlock(BlockTypes.TESTIMONIAL, {
        text: `"Working with ${businessName} felt clear, fast and professional."`,
        author: "Example Client",
        role: "Customer",
        testimonialVariant: style.testimonialVariant || "spotlight",
        headingFontFamily: style.headingFont,
        bodyFontFamily: style.bodyFont,
      }),
      footerBlock,
    ]);
  }

  if (nameKey.includes("service") || nameKey.includes("product") || nameKey.includes("pricing")) {
    return autoBalanceComposition([
      navBlock,
      createBlock(BlockTypes.HERO, {
        headline: `${pageName} built around ${offer}`,
        subheadline: `${objective} This page is ready for you to refine into a focused offer page.`,
        ctaText: nameKey.includes("pricing") ? "Choose a Plan" : "Request Details",
        ctaLink: "#contact",
        backgroundColor: style.heroBg,
        heroVariant: style.heroVariant || "spotlight",
        minHeight: style.heroMinHeight || "560px",
        headingFontFamily: style.headingFont,
        bodyFontFamily: style.bodyFont,
      }),
      createBlock(BlockTypes.FEATURE_LIST, {
        title: `${pageName} highlights`,
        items: [
          `${offer} tailored for ${audience}`,
          "Clear deliverables and expected outcomes",
          "Simple next step for interested buyers",
        ],
        layout: "columns",
        featureVariant: style.featureVariant || "cards",
        headingFontFamily: style.headingFont,
        bodyFontFamily: style.bodyFont,
      }),
      createBlock(BlockTypes.PRICING_TABLE, {
        title: nameKey.includes("pricing") ? "Plans" : "Packages",
        pricingVariant: style.pricingVariant || "premium",
        headingFontFamily: style.headingFont,
        bodyFontFamily: style.bodyFont,
        plans: [
          {
            name: "Starter",
            price: "$99",
            description: "Entry package",
            features: ["Core feature", "Fast onboarding", "Email support"],
          },
          {
            name: "Growth",
            price: "$299",
            description: "Most popular option",
            features: ["Everything in Starter", "Priority support", "Strategy guidance"],
            highlighted: true,
          },
        ],
      }),
      createBlock(BlockTypes.CTA_BUTTON, {
        text: "Book a Consultation",
        link: "#contact",
      }),
      footerBlock,
    ]);
  }

  if (nameKey.includes("contact") || nameKey.includes("book") || nameKey.includes("apply")) {
    return autoBalanceComposition([
      navBlock,
      createBlock(BlockTypes.HERO, {
        headline: `${pageName} with ${businessName}`,
        subheadline: objective,
        ctaText: "Send Enquiry",
        ctaLink: "#contact",
        backgroundColor: style.heroBg,
        heroVariant: style.heroVariant || "spotlight",
        minHeight: style.heroMinHeight || "560px",
        headingFontFamily: style.headingFont,
        bodyFontFamily: style.bodyFont,
      }),
      createBlock(BlockTypes.CONTACT_FORM, {
        title: pageName,
        subtitle: `Use this page to collect qualified leads from ${audience}.`,
      }),
      createBlock(BlockTypes.FAQ, {
        title: "Before you reach out",
        items: [
          { question: "Who is this for?", answer: audience },
          { question: "What can I expect?", answer: objective },
        ],
      }),
      footerBlock,
    ]);
  }

  if (nameKey.includes("testimonial") || nameKey.includes("result") || nameKey.includes("case")) {
    return autoBalanceComposition([
      navBlock,
      createBlock(BlockTypes.TEXT, {
        text: `${pageName} for ${businessName}`,
        alignment: "center",
        backgroundColor: style.textBg,
        textColor: style.textColor,
      }),
      createBlock(BlockTypes.TESTIMONIAL, {
        text: `"${businessName} delivered a result we can clearly measure."`,
        author: "Client Example",
        role: "Case study",
        testimonialVariant: style.testimonialVariant || "spotlight",
        headingFontFamily: style.headingFont,
        bodyFontFamily: style.bodyFont,
      }),
      createBlock(BlockTypes.STATS, {
        title: "Example outcomes",
        stats: [
          { number: "3x", label: "More leads" },
          { number: "42%", label: "Higher conversion" },
          { number: "14d", label: "Faster launch" },
        ],
      }),
      footerBlock,
    ]);
  }

  if (nameKey.includes("portfolio") || nameKey.includes("gallery")) {
    return autoBalanceComposition([
      navBlock,
      createBlock(BlockTypes.TEXT, {
        text: lines([pageName, objective]),
        alignment: "center",
        backgroundColor: style.textBg,
        textColor: style.textColor,
      }),
      createBlock(BlockTypes.IMAGE_GALLERY, {
        title: pageName,
        columns: 3,
      }),
      createBlock(BlockTypes.CTA_BUTTON, {
        text: "Ask About a Similar Project",
        link: "#contact",
      }),
      footerBlock,
    ]);
  }

  return autoBalanceComposition([
    navBlock,
    createBlock(BlockTypes.HERO, {
      headline: `${pageName} for ${businessName}`,
      subheadline: objective,
      ctaText: "Continue",
      ctaLink: "#contact",
      backgroundColor: style.heroBg,
      heroVariant: style.heroVariant || "spotlight",
      minHeight: style.heroMinHeight || "560px",
      headingFontFamily: style.headingFont,
      bodyFontFamily: style.bodyFont,
    }),
    createBlock(BlockTypes.TEXT, {
      text: lines([
        `${offer} for ${audience}.`,
        objective,
      ]),
      backgroundColor: style.textBg,
      textColor: style.textColor,
    }),
    createBlock(BlockTypes.CTA_BUTTON, {
      text: "Take the Next Step",
      link: "#contact",
    }),
    footerBlock,
  ]);
}

function withScaffolding(blocks, project) {
  const list = Array.isArray(blocks) ? blocks : [];
  if (!list.length) return list;

  const businessName = project?.brief?.businessName || project?.name || "Your Business";
  const style = getStyleTokens(project);
  const withNav = list[0]?.type === BlockTypes.NAV_BAR
    ? list
    : [
        createBlock(BlockTypes.NAV_BAR, {
          variant: style.navVariant || "boxed-brand",
          stickyMode: style.navStickyMode || "sticky-transparent",
          mobileMenuStyle: "hamburger",
          showLogo: true,
          brandFontSize: 20,
          linkFontSize: 16,
          ctaFontSize: 16,
          brand: businessName,
          links: [
            { label: "Home", href: "#home" },
            { label: "About", href: "#about" },
            { label: "Services", href: "#services" },
            { label: "Contact", href: "#contact" },
          ],
          ctaText: "Contact",
          ctaLink: "#contact",
          backgroundColor: style.navBg,
          textColor: style.navText,
          buttonColor: style.navButtonBg || "#0ea5e9",
          buttonTextColor: style.navButtonText || "#ffffff",
          headingFontFamily: style.headingFont,
          bodyFontFamily: style.bodyFont,
        }),
        ...list,
      ];

  const last = withNav[withNav.length - 1];
  if (last?.type === BlockTypes.TEXT && String(last?.props?.text || "").includes("©")) {
    return autoBalanceComposition(withNav);
  }

  // Do not automatically re-inject a footer text block — the user may have intentionally removed it.
  // The FOOTER block type is available for users to add explicitly.
  return autoBalanceComposition(withNav);
}

export function ensureWebsiteProjectPageBlocks(project) {
  if (!project || project.mode === "blank") return null;

  const pages = Array.isArray(project.pages) && project.pages.length
    ? project.pages
    : [{ name: "Home", objective: "Establish trust and present the core offer." }];
  const current = project.pageBlocks && typeof project.pageBlocks === "object" ? project.pageBlocks : {};
  const nextPageBlocks = { ...current };
  const templateSlug = inferTemplateSlug(project);
  const templateOverride = templateSlug ? getWebsiteTemplateOverride(templateSlug) : null;

  let templatePages = [];
  if (templateSlug) {
    try {
      templatePages = asArray(getTemplate(templateSlug)?.build?.("modern-blue")?.pages);
    } catch {
      templatePages = [];
    }
  }

  const templatePageLookup = new Map();
  templatePages.forEach((templatePage, index) => {
    const keys = [templatePage?.title, templatePage?.slug, pages[index]?.name]
      .map(normalizeTemplatePageKey)
      .filter(Boolean);
    keys.forEach((key) => {
      if (!templatePageLookup.has(key)) {
        templatePageLookup.set(key, templatePage);
      }
    });
  });

  const homeTemplatePage = templatePageLookup.get(normalizeTemplatePageKey(pages[0]?.name || "home")) || templatePages[0] || null;
  const homeTemplateBlocks = asArray(homeTemplatePage?.sections).flatMap((section) =>
    mapTemplateSectionToBlocks(section, { ...project, templateSlug }, pages[0])
  );

  let changed = !project.pageBlocks;

  pages.forEach((page, index) => {
    const matchedTemplatePage = templatePageLookup.get(normalizeTemplatePageKey(page.name)) || templatePages[index] || null;
    const overrideBlocks = resolveTemplateOverridePageBlocks(templateOverride, page?.name, matchedTemplatePage?.slug, matchedTemplatePage?.title);
    if (Array.isArray(nextPageBlocks[page.name]) && nextPageBlocks[page.name].length) {
      // If the page has been manually edited in the visual builder, trust the saved blocks as-is
      const hasManualEdits = Array.isArray(project?.chaiData?.[page.name]?.blocks) && project.chaiData[page.name].blocks.length > 0;
      if (hasManualEdits) return;
      if (overrideBlocks && JSON.stringify(nextPageBlocks[page.name]) !== JSON.stringify(overrideBlocks)) {
        nextPageBlocks[page.name] = overrideBlocks;
        changed = true;
        return;
      }
      const upgraded = withScaffolding(nextPageBlocks[page.name], project);
      if (JSON.stringify(upgraded) !== JSON.stringify(nextPageBlocks[page.name])) {
        nextPageBlocks[page.name] = upgraded;
        changed = true;
      }
      return;
    }

    const templateBlocks = asArray(matchedTemplatePage?.sections).flatMap((section) =>
      mapTemplateSectionToBlocks(section, { ...project, templateSlug }, page)
    );

    nextPageBlocks[page.name] = overrideBlocks?.length
      ? overrideBlocks
      : templateBlocks.length
      ? withScaffolding(templateBlocks, project)
      : index === 0
        ? buildHomeBlocks({ ...project, templateSlug }, page, homeTemplateBlocks)
        : buildGenericPageBlocks({ ...project, templateSlug }, page);
    changed = true;
  });

  return changed ? nextPageBlocks : null;
}

export function getWebsiteTemplatePreview(templateSlug, pageKey = "") {
  const template = getTemplate(templateSlug);
  const built = template?.build?.("modern-blue");
  const templatePages = asArray(built?.pages);
  const templateOverride = getWebsiteTemplateOverride(templateSlug);

  if (!template || !templatePages.length) {
    return null;
  }

  const requestedKey = normalizeTemplatePageKey(pageKey);
  const activeTemplatePage = templatePages.find((page) => {
    const keys = [page?.slug, page?.title, page?.name]
      .map(normalizeTemplatePageKey)
      .filter(Boolean);
    return requestedKey && keys.includes(requestedKey);
  }) || templatePages[0];

  const previewProject = {
    name: template?.name || "Website Template",
    stylePack: "executive",
    templateSlug: template?.slug || templateSlug,
    brief: {
      businessName: built?.site?.logoText || template?.name || "Website Template",
    },
  };

  const previewPage = {
    name: activeTemplatePage?.title || activeTemplatePage?.name || activeTemplatePage?.slug || "Home",
    objective: activeTemplatePage?.objective || "Preview this starter page.",
  };

  const overriddenBlocks = resolveTemplateOverridePageBlocks(
    templateOverride,
    activeTemplatePage?.slug,
    activeTemplatePage?.title,
    activeTemplatePage?.name,
    previewPage.name
  );
  const blocks = overriddenBlocks?.length
    ? overriddenBlocks
    : asArray(activeTemplatePage?.sections).flatMap((section) =>
        mapTemplateSectionToBlocks(section, previewProject, previewPage)
      );

  return {
    template,
    site: built?.site || {},
    pages: templatePages.map((page, index) => ({
      slug: page?.slug || `page-${index + 1}`,
      title: page?.title || page?.name || page?.slug || `Page ${index + 1}`,
      objective: page?.objective || "Preview this starter page.",
    })),
    activePage: {
      slug: activeTemplatePage?.slug || "home",
      title: previewPage.name,
      objective: previewPage.objective,
    },
    blocks: withScaffolding(blocks, previewProject),
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function textToParagraphs(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw
    .split(/\n\s*\n/)
    .map((chunk) => `<p style="margin:0 0 16px;">${escapeHtml(chunk).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

function richTextToHtml(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/<\/?[a-z][\s\S]*>/i.test(raw)) return raw;
  return textToParagraphs(raw);
}

function htmlToPlainText(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

const DEFAULT_ENQUIRY_BOOKING_URL = "https://nonfat-ungored-buford.ngrok-free.dev/u/gr8result?service=f775fc69-f59e-4fd8-ae4a-1e9bb7ecfe4f";

function resolveContactBookingUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "/u/your-username") return DEFAULT_ENQUIRY_BOOKING_URL;
  return raw;
}

function colorWithAlpha(color, alpha = 0.5) {
  const text = String(color || "").trim();
  if (/^#([0-9a-fA-F]{6})$/.test(text)) {
    const hex = text.slice(1);
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (/^rgb\(/i.test(text)) {
    const parts = text.replace(/^rgb\((.*)\)$/i, "$1");
    return `rgba(${parts}, ${alpha})`;
  }
  if (/^rgba\(/i.test(text)) return text;
  return `rgba(15,23,42,${alpha})`;
}

function buildStarterPageHtml(project, page) {
  const style = getStyleTokens(project);
  const businessName = project?.brief?.businessName || project?.name || "Your Business";
  const pageName = page?.name || "Page";
  const objective = page?.objective || "Customize this page and publish it.";

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(pageName)}</title>
  </head>
  <body style="margin:0;font-family:${style.bodyFont || "system-ui,-apple-system,sans-serif"};background:${style.textBg || "#ffffff"};color:${style.textColor || "#0f172a"};">
    <section style="padding:72px 20px;background:${style.heroBg || "#1d4ed8"};color:#ffffff;text-align:center;">
      <div style="max-width:900px;margin:0 auto;">
        <p style="margin:0 0 12px;letter-spacing:.12em;text-transform:uppercase;opacity:.8;">${escapeHtml(businessName)}</p>
        <h1 style="margin:0 0 16px;font-size:48px;line-height:1.1;">${escapeHtml(pageName)}</h1>
        <p style="margin:0 auto;max-width:720px;font-size:20px;line-height:1.6;">${escapeHtml(objective)}</p>
      </div>
    </section>
  </body>
</html>`;
}

function buildHtmlFromBlock(block, project) {
  const rawProps = block?.props || {};
  const assets = getWebsiteBuilderAssets();
  const props = {
    ...rawProps,
    src: resolveAssetField(rawProps, "src", assets),
    backgroundImage: resolveAssetField(rawProps, "backgroundImage", assets),
    avatar: resolveAssetField(rawProps, "avatar", assets),
    logo: resolveAssetField(rawProps, "logo", assets),
  };
  const style = getStyleTokens(project);
  const sectionBase = "max-width:1120px;margin:0 auto;padding:56px 20px;";

  switch (block?.type) {
    case BlockTypes.NAV_BAR: {
      const links = asArray(props.links)
        .map((link) => `<a href="${escapeHtml(link?.href || "#")}" style="color:${props.textColor || style.navText || "#e2e8f0"};text-decoration:none;font-weight:600;">${escapeHtml(link?.label || "Link")}</a>`)
        .join("<span style='width:14px;display:inline-block;'></span>");
      return `<header style="background:${props.backgroundColor || style.navBg || "#0b1220"};color:${props.textColor || style.navText || "#e2e8f0"};border-bottom:1px solid rgba(148,163,184,0.2);">
        <div style="${sectionBase}padding-top:18px;padding-bottom:18px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;">
          <strong style="font-size:20px;">${escapeHtml(props.brand || project?.name || "Your Brand")}</strong>
          <nav style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">${links}</nav>
          <a href="${escapeHtml(props.ctaLink || "#contact")}" style="background:${props.buttonColor || style.navButtonBg || "#0ea5e9"};color:${props.buttonTextColor || style.navButtonText || "#ffffff"};padding:10px 16px;border-radius:999px;text-decoration:none;font-weight:700;">${escapeHtml(props.ctaText || "Contact")}</a>
        </div>
      </header>`;
    }
    case BlockTypes.HERO:
    case BlockTypes.PARALLAX:
      return `<section style="position:relative;overflow:hidden;padding:88px 20px;min-height:${escapeHtml(props.minHeight || "480px")};background:${props.backgroundImage ? `linear-gradient(rgba(15,23,42,0.45), rgba(15,23,42,0.22)), url('${escapeHtml(props.backgroundImage)}') center/cover no-repeat` : (props.backgroundColor || style.heroBg || "#1d4ed8")};color:${props.headlineColor || "#ffffff"};text-align:${escapeHtml(props.headlineAlignment || "center")};">
        ${props.floatingImage ? `<img src="${escapeHtml(props.floatingImage)}" alt="${escapeHtml(props.floatingAlt || "Overlay image")}" style="position:absolute;left:${escapeHtml(String(props.floatingX ?? 76))}%;top:${escapeHtml(String(props.floatingY ?? 58))}%;transform:translate(-50%,-50%);width:${escapeHtml(String(props.floatingWidth ?? 260))}px;height:${escapeHtml(String(props.floatingHeight ?? 260))}px;object-fit:cover;border-radius:18px;box-shadow:0 24px 48px rgba(15,23,42,0.28);" />` : ""}
        <div style="position:relative;z-index:1;max-width:${escapeHtml(String(props.contentWidth || 940))}px;margin:0 auto;overflow:hidden;">
          <h1 style="margin:0 0 16px;font-size:${escapeHtml(String(props.headlineFontSize || 52))}px;line-height:1.08;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(props.headline || "Your headline")}</h1>
          <div style="font-size:${escapeHtml(String(props.subheadlineFontSize || 20))}px;line-height:1.7;color:${props.textColor || "#dbeafe"};word-break:break-word;overflow-wrap:anywhere;">${textToParagraphs(props.subheadline || "Describe what this page offers.")}</div>
          <a href="${escapeHtml(props.ctaLink || "#")}" style="display:inline-block;margin-top:18px;background:${props.buttonColor || "#ffffff"};color:${props.buttonTextColor || style.heroBg || "#1d4ed8"};padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:700;">${escapeHtml(props.ctaText || "Get Started")}</a>
        </div>
      </section>`;
    case BlockTypes.TEXT:
      return `<section style="background:${props.backgroundColor || style.textBg || "#ffffff"};color:${props.textColor || style.textColor || "#0f172a"};">
        <div style="${sectionBase}">${textToParagraphs(props.text || "Add your content here.")}</div>
      </section>`;
    case BlockTypes.IMAGE: {
      const stretch = props?.fullWidthBackground !== false;
      const imageSectionBase = stretch
        ? "width:100vw;max-width:100vw;margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw);padding:0;"
        : sectionBase;
      return `<section style="background:${style.textBg || "#ffffff"};"><div style="${imageSectionBase}"><img src="${escapeHtml(props.src || "https://placehold.co/1200x700/e2e8f0/0f172a?text=Image")}" alt="${escapeHtml(props.alt || "Image")}" style="width:100%;max-width:100%;height:${escapeHtml(props.height || "400px")};object-fit:cover;border-radius:${stretch ? "0" : "16px"};display:block;" />${props.caption ? `<p style="margin:12px 0 0;color:#64748b;padding:${stretch ? "0 24px" : "0"};">${escapeHtml(props.caption)}</p>` : ""}</div></section>`;
    }
    case BlockTypes.FEATURE_LIST: {
      const marker = props.bulletStyle === "number" ? "#" : props.bulletStyle === "disc" ? "•" : "✓";
      const items = asArray(props.items).map((item, idx) => `<div style="display:flex;gap:10px;align-items:flex-start;margin:0 0 10px;padding:14px;border-radius:14px;background:${escapeHtml(props.itemBackgroundColor || "#eff6ff")};border:1px solid ${escapeHtml(props.borderColor || "#dbeafe")};"><span style="font-weight:800;">${marker === "#" ? `${idx + 1}.` : marker}</span><span>${escapeHtml(item)}</span></div>`).join("");
      return `<section style="background:${escapeHtml(props.backgroundColor || style.textBg || "#ffffff")};color:${escapeHtml(props.textColor || style.textColor || "#0f172a")};"><div style="${sectionBase}"><h2 style="margin:0 0 18px;font-size:34px;">${escapeHtml(props.title || "Features")}</h2><div style="display:grid;gap:12px;">${items}</div></div></section>`;
    }
    case BlockTypes.TESTIMONIAL:
      return `<section style="background:${style.textBg || "#ffffff"};"><div style="${sectionBase}"><blockquote style="margin:0;padding:24px;border-radius:18px;background:#f8fafc;color:#0f172a;"><p style="margin:0 0 12px;font-size:22px;line-height:1.6;">“${escapeHtml(props.text || "Customer quote goes here.") }”</p><footer style="color:#475569;font-weight:700;">${escapeHtml(props.author || "Customer")}${props.role ? ` — ${escapeHtml(props.role)}` : ""}</footer></blockquote></div></section>`;
    case BlockTypes.PRICING_TABLE: {
      const iconMap = { tick: "✓", arrow: "➜", spark: "✦", diamond: "◆" };
      const variant = String(props.pricingVariant || "premium");
      const variantTheme = (() => {
        if (variant === "clean") {
          return {
            sectionBg: props.backgroundColor || "#ffffff",
            card: (plan) => ({
              border: plan?.highlighted ? "2px solid #2563eb" : "1px solid #dbe3ef",
              background: "#ffffff",
              shadow: "none",
              badgeBg: "#2563eb",
              featureBg: "#ffffff",
              featureBorder: "1px solid rgba(226,232,240,0.95)",
              iconBg: "#eff6ff",
              iconColor: "#2563eb",
              extrasBg: "#f8fafc",
              extrasBorder: "1px solid rgba(226,232,240,0.95)",
              ctaBg: plan?.highlighted ? "#2563eb" : "#ffffff",
              ctaColor: plan?.highlighted ? "#ffffff" : "#2563eb",
              text: "#0f172a",
              subtle: "#64748b",
            }),
          };
        }
        if (variant === "contrast") {
          const palette = [
            { card: "linear-gradient(180deg,#ffffff,#f8fafc)", text: "#0f172a", subtle: "#64748b", accent: "#2563eb", featureBg: "rgba(37,99,235,0.06)" },
            { card: "linear-gradient(180deg,#3730a3,#312e81)", text: "#ffffff", subtle: "#c7d2fe", accent: "#f472b6", featureBg: "rgba(255,255,255,0.12)" },
            { card: "linear-gradient(180deg,#020617,#111827)", text: "#ffffff", subtle: "#cbd5e1", accent: "#22d3ee", featureBg: "rgba(255,255,255,0.08)" },
          ];
          return {
            sectionBg: props.backgroundColor || "linear-gradient(180deg,#ffffff,#f3f4f6)",
            card: (plan, index) => {
              const tone = palette[index % palette.length];
              return {
                border: plan?.highlighted ? `2px solid ${tone.accent}` : "1px solid rgba(148,163,184,0.16)",
                background: tone.card,
                shadow: plan?.highlighted ? `0 28px 56px ${colorWithAlpha(tone.accent, 0.26)}` : "0 14px 28px rgba(15,23,42,0.12)",
                badgeBg: `linear-gradient(135deg,${tone.accent},#ffffff22)`,
                featureBg: tone.featureBg,
                featureBorder: `1px solid ${colorWithAlpha(tone.accent, 0.26)}`,
                iconBg: `linear-gradient(135deg,${tone.accent},${colorWithAlpha(tone.accent, 0.72)})`,
                iconColor: "#ffffff",
                extrasBg: colorWithAlpha(tone.accent, 0.12),
                extrasBorder: `1px solid ${colorWithAlpha(tone.accent, 0.2)}`,
                ctaBg: `linear-gradient(135deg,${tone.accent},${colorWithAlpha(tone.accent, 0.72)})`,
                ctaColor: "#ffffff",
                text: tone.text,
                subtle: tone.subtle,
              };
            },
          };
        }
        if (variant === "spotlight") {
          return {
            sectionBg: props.backgroundColor || "linear-gradient(180deg,#fdfbff,#f4f3ff)",
            card: (plan, index) => ({
              border: plan?.highlighted ? "2px solid rgba(244,114,182,0.5)" : "1px solid rgba(196,181,253,0.45)",
              background: plan?.highlighted ? "linear-gradient(180deg,#ffffff,#fff7fb 42%,#f5f3ff)" : (index % 2 === 0 ? "linear-gradient(180deg,#ffffff,#faf5ff)" : "linear-gradient(180deg,#ffffff,#eff6ff)"),
              shadow: plan?.highlighted ? "0 30px 60px rgba(236,72,153,0.18)" : "0 16px 30px rgba(168,85,247,0.08)",
              badgeBg: "linear-gradient(135deg,#fb7185,#8b5cf6)",
              featureBg: plan?.highlighted ? "rgba(251,113,133,0.08)" : (index % 2 === 0 ? "rgba(139,92,246,0.06)" : "rgba(59,130,246,0.06)"),
              featureBorder: "1px solid rgba(196,181,253,0.34)",
              iconBg: plan?.highlighted ? "linear-gradient(135deg,#fb7185,#8b5cf6)" : "linear-gradient(135deg,#c4b5fd,#93c5fd)",
              iconColor: "#ffffff",
              extrasBg: "linear-gradient(180deg,rgba(255,255,255,0.92),rgba(244,243,255,0.9))",
              extrasBorder: "1px solid rgba(196,181,253,0.4)",
              ctaBg: plan?.highlighted ? "linear-gradient(135deg,#fb7185,#8b5cf6)" : "linear-gradient(135deg,#8b5cf6,#3b82f6)",
              ctaColor: "#ffffff",
              text: "#0f172a",
              subtle: "#6d28d9",
            }),
          };
        }
        if (variant === "matrix") {
          return {
            sectionBg: props.backgroundColor || "linear-gradient(180deg,#f8fafc,#eef2f7)",
            card: (plan) => ({
              border: plan?.highlighted ? "2px solid #10b981" : "1px solid rgba(203,213,225,0.9)",
              background: plan?.highlighted ? "linear-gradient(180deg,#ecfdf5,#ffffff)" : "#ffffff",
              shadow: "none",
              badgeBg: "linear-gradient(135deg,#10b981,#059669)",
              featureBg: plan?.highlighted ? "#f0fdf4" : "#f8fafc",
              featureBorder: "1px solid rgba(226,232,240,0.95)",
              iconBg: plan?.highlighted ? "#10b981" : "#e2e8f0",
              iconColor: plan?.highlighted ? "#ffffff" : "#334155",
              extrasBg: "#f8fafc",
              extrasBorder: "1px solid rgba(226,232,240,0.95)",
              ctaBg: plan?.highlighted ? "#10b981" : "#f8fafc",
              ctaColor: plan?.highlighted ? "#ffffff" : "#0f172a",
              text: "#0f172a",
              subtle: "#64748b",
            }),
          };
        }
        return {
          sectionBg: props.backgroundColor || "linear-gradient(135deg,#081120,#10213a 55%,#132c47)",
          card: (plan) => ({
            border: plan?.highlighted ? "2px solid rgba(250,204,21,0.7)" : "1px solid rgba(148,163,184,0.18)",
            background: plan?.highlighted ? "linear-gradient(180deg,#fff7d6,#ffffff 48%,#fef3c7)" : "linear-gradient(180deg,rgba(15,23,42,0.82),rgba(17,24,39,0.94))",
            shadow: plan?.highlighted ? "0 34px 70px rgba(250,204,21,0.18)" : "0 24px 44px rgba(2,6,23,0.42)",
            badgeBg: plan?.highlighted ? "linear-gradient(135deg,#f59e0b,#facc15)" : "linear-gradient(135deg,#0ea5e9,#2563eb)",
            featureBg: plan?.highlighted ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.06)",
            featureBorder: plan?.highlighted ? "1px solid rgba(245,158,11,0.2)" : "1px solid rgba(255,255,255,0.08)",
            iconBg: plan?.highlighted ? "linear-gradient(135deg,#f59e0b,#facc15)" : "linear-gradient(135deg,#0ea5e9,#38bdf8)",
            iconColor: "#ffffff",
            extrasBg: plan?.highlighted ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.04)",
            extrasBorder: plan?.highlighted ? "1px solid rgba(245,158,11,0.22)" : "1px solid rgba(255,255,255,0.08)",
            ctaBg: plan?.highlighted ? "linear-gradient(135deg,#f59e0b,#facc15)" : "linear-gradient(135deg,#0ea5e9,#2563eb)",
            ctaColor: plan?.highlighted ? "#1f2937" : "#ffffff",
            text: plan?.highlighted ? "#111827" : "#f8fafc",
            subtle: plan?.highlighted ? "#6b7280" : "#cbd5e1",
          }),
        };
      })();
      const plans = asArray(props.plans).map((plan) => {
        const includedFeatures = asArray(plan?.includedFeatures || plan?.features || plan?.bullets);
        const extras = asArray(plan?.extras);
        const icon = iconMap[String(plan?.featureIcon || "tick")] || iconMap.tick;
        const theme = variantTheme.card(plan, asArray(props.plans).indexOf(plan));
        const accentTone = props.accentColor || theme.accent || "#0ea5e9";
        const resolvedTheme = {
          ...theme,
          background: plan?.cardBackgroundColor || (plan?.highlighted ? (props.highlightedCardBackgroundColor || theme.background) : (props.cardBackgroundColor || theme.background)),
          border: plan?.highlighted && props.accentColor ? `2px solid ${props.accentColor}` : theme.border,
          featureBg: props.featureBackgroundColor || theme.featureBg,
          featureBorder: props.accentColor && plan?.highlighted ? `1px solid ${colorWithAlpha(accentTone, 0.22)}` : theme.featureBorder,
          iconBg: props.accentColor ? `linear-gradient(135deg,${accentTone},${colorWithAlpha(accentTone, 0.72)})` : theme.iconBg,
          iconColor: props.accentColor ? (props.ctaTextColor || "#ffffff") : theme.iconColor,
          extrasBg: props.extrasBackgroundColor || theme.extrasBg,
          ctaBg: props.ctaBackgroundColor || theme.ctaBg,
          ctaColor: plan?.ctaTextColor || props.ctaTextColor || theme.ctaColor,
          text: plan?.textColor || props.textColor || theme.text,
          subtle: plan?.subtleTextColor || props.subtleTextColor || theme.subtle,
        };
        return `<div style="flex:1 1 260px;border:${resolvedTheme.border};border-radius:28px;padding:24px;background:${resolvedTheme.background};box-shadow:${resolvedTheme.shadow};transform:${plan?.highlighted ? "scale(1.04)" : "none"};position:relative;display:grid;gap:16px;">
          <div style="padding-right:84px;">
            <h3 style="margin:0;font-size:24px;line-height:1.2;color:${resolvedTheme.text};">${richTextToHtml(plan?.name || "Plan")}</h3>
            <div style="margin:4px 0 0;font-size:38px;font-weight:900;letter-spacing:-0.03em;color:${resolvedTheme.text};">${richTextToHtml(plan?.price || "$0")}</div>
            <div style="margin:4px 0 0;color:${resolvedTheme.subtle};line-height:1.6;">${richTextToHtml(plan?.description || "")}</div>
          </div>
          <div style="font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:${resolvedTheme.subtle};">Included</div>
          <div style="display:grid;gap:10px;">
            ${includedFeatures.map((item) => `<div style="display:grid;grid-template-columns:34px minmax(0,1fr);gap:10px;align-items:start;padding:${plan?.highlighted ? "10px 12px" : "9px 10px"};border-radius:16px;background:${resolvedTheme.featureBg};border:${resolvedTheme.featureBorder};"><span style="display:inline-grid;place-items:center;width:30px;height:30px;border-radius:999px;background:${resolvedTheme.iconBg};color:${resolvedTheme.iconColor};font-weight:900;">${icon}</span><div style="line-height:1.55;color:${resolvedTheme.text};">${richTextToHtml(item)}</div></div>`).join("")}
          </div>
          <div style="display:grid;gap:10px;padding:${plan?.highlighted ? "16px 18px" : "14px 16px"};border-radius:20px;background:${resolvedTheme.extrasBg};border:${resolvedTheme.extrasBorder};">
            <div style="font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:${resolvedTheme.subtle};">Extras</div>
            <div style="display:grid;gap:8px;">${extras.length ? extras.map((item) => `<div style="color:${resolvedTheme.text};line-height:1.55;">${richTextToHtml(item)}</div>`).join("") : `<div style="color:${resolvedTheme.subtle};font-style:italic;">No extras listed yet.</div>`}</div>
          </div>
          <div style="margin-top:auto;text-align:center;border-radius:18px;padding:14px 18px;font-weight:800;color:${resolvedTheme.ctaColor};background:${resolvedTheme.ctaBg};">${richTextToHtml(plan?.cta || "Get Started")}</div>
        </div>`;
      }).join("");
      const pricingCardWidth = Math.max(180, Number(props.pricingCardWidth || 260) || 260);
      const pricingCardGap = Math.max(8, Number(props.pricingCardGap || 24) || 24);
      return `<section style="background:${variantTheme.sectionBg};"><div style="${sectionBase}"><h2 style="margin:0 0 18px;font-size:34px;">${escapeHtml(htmlToPlainText(props.title || "Pricing"))}</h2><div style="display:grid;grid-template-columns:repeat(${Math.max(1, asArray(props.plans).length)} ,minmax(0,${pricingCardWidth}px));gap:${pricingCardGap}px;align-items:center;justify-content:center;">${plans}</div></div></section>`;
    }
    case BlockTypes.CONTACT_FORM:
      {
        const mediaImage = props.mediaImage || "";
        const mediaPosition = String(props.mediaPosition || (mediaImage ? "right" : "none"));
        const formMaxWidth = Math.max(360, Number(props.formMaxWidth || 760) || 760);
        const submitAction = String(props.submitAction || "none");
        const bookingUrl = resolveContactBookingUrl(props.bookingUrl || "");
        const wrapperColumns = mediaPosition === "left"
          ? "minmax(220px,0.88fr) minmax(0,1fr)"
          : mediaPosition === "right"
            ? "minmax(0,1fr) minmax(220px,0.88fr)"
            : "1fr";
        const submitMarkup = submitAction === "calendar-booking" && bookingUrl
          ? `<a href="${escapeHtml(bookingUrl)}" style="margin-top:16px;display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:12px 18px;background:${escapeHtml(props.buttonBackgroundColor || "#0f172a")};color:${escapeHtml(props.buttonTextColor || "#ffffff")};border:none;border-radius:12px;font-weight:800;box-shadow:0 14px 28px rgba(15,23,42,0.18);text-decoration:none;">${richTextToHtml(props.submitText || "Send Details")}</a>`
          : `<div style="margin-top:16px;display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:12px 18px;background:${escapeHtml(props.buttonBackgroundColor || "#0f172a")};color:${escapeHtml(props.buttonTextColor || "#ffffff")};border:none;border-radius:12px;font-weight:800;box-shadow:0 14px 28px rgba(15,23,42,0.18);">${richTextToHtml(props.submitText || "Send Details")}</div>`;
        const formCard = `<div style="background:${escapeHtml(props.cardBackgroundColor || "#ffffff")};border-radius:28px;padding:24px;box-shadow:0 18px 36px rgba(15,23,42,0.08);border:1px solid rgba(203,213,225,0.8);width:100%;box-sizing:border-box;${props.formVariant === "dark-glass" ? "backdrop-filter:blur(14px);border-color:rgba(148,163,184,0.2);box-shadow:0 28px 70px rgba(2,6,23,0.42);" : ""}${props.formVariant === "stacked-glow" ? "border-color:rgba(103,232,249,0.5);box-shadow:0 24px 60px rgba(8,145,178,0.18);backdrop-filter:blur(10px);" : ""}${props.formVariant === "editorial-split" ? "box-shadow:0 22px 48px rgba(120,98,67,0.16);border-color:rgba(120,98,67,0.12);" : ""}"><div style="margin:0 0 10px;font-size:34px;color:${escapeHtml(props.textColor || "#0f172a")};">${richTextToHtml(props.title || "Contact")}</div><div style="font-size:18px;color:${escapeHtml(props.subtleTextColor || "#475569")};">${richTextToHtml(props.subtitle || "Add your contact form details here.")}</div><div style="display:grid;gap:12px;margin-top:18px;">${asArray(props.fields).map((field) => field?.type === "textarea" ? `<div style="display:grid;gap:6px;"><label style="color:${escapeHtml(props.textColor || "#0f172a")};font-size:16px;font-weight:700;">${escapeHtml(field?.label || field?.name || "Message")}</label><textarea placeholder="${escapeHtml(field?.placeholder || field?.label || field?.name || "Message")}" style="padding:12px 14px;border:1px solid ${escapeHtml(props.inputBorderColor || "#cbd5e1")};background:${escapeHtml(props.inputBackgroundColor || "#ffffff")};color:${escapeHtml(props.inputTextColor || props.subtleTextColor || "#64748b")};border-radius:14px;min-height:120px;"></textarea></div>` : `<div style="display:grid;gap:6px;"><label style="color:${escapeHtml(props.textColor || "#0f172a")};font-size:16px;font-weight:700;">${escapeHtml(field?.label || field?.name || "Field")}</label><input placeholder="${escapeHtml(field?.placeholder || field?.label || field?.name || "Field")}" style="padding:12px 14px;border:1px solid ${escapeHtml(props.inputBorderColor || "#cbd5e1")};background:${escapeHtml(props.inputBackgroundColor || "#ffffff")};color:${escapeHtml(props.inputTextColor || props.subtleTextColor || "#64748b")};border-radius:14px;" /></div>`).join("")}${submitMarkup}</div></div>`;
        const mediaMarkup = mediaImage ? `<img src="${escapeHtml(mediaImage)}" alt="${escapeHtml(props.mediaAlt || props.title || "Contact form")}" style="width:100%;height:100%;min-height:${mediaPosition === "top" ? "260px" : "520px"};object-fit:cover;border-radius:28px;display:block;" />` : "";
        return `<section style="background:${props.sectionGradient || style.textBg || props.backgroundColor || "#ffffff"};"><div style="${sectionBase}"><div style="max-width:${formMaxWidth}px;margin:0 auto;display:grid;grid-template-columns:${wrapperColumns};gap:22px;align-items:stretch;">${mediaPosition === "top" && mediaMarkup ? mediaMarkup : ""}${mediaPosition === "left" && mediaMarkup ? mediaMarkup : ""}${formCard}${mediaPosition === "right" && mediaMarkup ? mediaMarkup : ""}</div></div></section>`;
      }
    case BlockTypes.IMAGE_GALLERY: {
      const images = asArray(props.images).slice(0, 6).map((img, idx) => `<img src="${escapeHtml(img?.src || `https://placehold.co/800x520/e2e8f0/0f172a?text=Gallery+${idx + 1}`)}" alt="${escapeHtml(img?.alt || `Gallery ${idx + 1}`)}" style="width:100%;height:220px;object-fit:cover;border-radius:14px;" />`).join("");
      return `<section style="background:${style.textBg || "#ffffff"};"><div style="${sectionBase}"><h2 style="margin:0 0 18px;font-size:34px;">${escapeHtml(props.title || "Gallery")}</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;">${images}</div></div></section>`;
    }
    case BlockTypes.IMAGE_STACK: {
      const images = asArray(props.images)
        .sort((a, b) => Number(a?.zIndex || 0) - Number(b?.zIndex || 0))
        .map((img, idx) => {
          const kind = img?.kind || (img?.content ? "text" : "image");
          if (kind === "text") {
            const align = String(img?.textAlign || "center");
            const vertical = String(img?.verticalAlign || "center");
            const justify = vertical === "top" ? "flex-start" : vertical === "bottom" ? "flex-end" : "center";
            return `<div style="position:absolute;left:${Number(img?.x || 0)}px;top:${Number(img?.y || 0)}px;width:${Number(img?.width || 360)}px;height:${Number(img?.height || 140)}px;display:flex;flex-direction:column;align-items:stretch;justify-content:${justify};text-align:${align};padding:12px;overflow:hidden;transform:rotate(${Number(img?.rotation || 0)}deg);z-index:${Number(img?.zIndex || idx + 1)};color:${escapeHtml(img?.textColor || "#ffffff")};font-size:${Number(img?.fontSize || 40)}px;font-weight:${escapeHtml(String(img?.fontWeight || "700"))};background:${escapeHtml(img?.background || "transparent")};">${textToParagraphs(img?.content || "Headline Text")}</div>`;
          }
          const asset = assets?.images?.find?.((item) => item?.id === img?.assetId) || (assets?.logo?.id === img?.assetId ? assets.logo : null);
          const src = asset?.src || img?.src || `https://placehold.co/800x520/e2e8f0/0f172a?text=Layer+${idx + 1}`;
          return `<div style="position:absolute;left:${Number(img?.x || 0)}px;top:${Number(img?.y || 0)}px;width:${Number(img?.width || 260)}px;height:${Number(img?.height || 180)}px;overflow:hidden;border-radius:${Number(img?.radius || 18)}px;transform:rotate(${Number(img?.rotation || 0)}deg);box-shadow:0 18px 32px rgba(15,23,42,0.2);border:2px solid rgba(255,255,255,0.75);z-index:${Number(img?.zIndex || idx + 1)};"><img src="${escapeHtml(src)}" alt="${escapeHtml(`Layer ${idx + 1}`)}" style="width:100%;height:100%;object-fit:cover;display:block;" /></div>`;
        }).join("");
      return `<section style="background:${style.textBg || "#ffffff"};"><div style="${sectionBase}"><h2 style="margin:0 0 18px;font-size:34px;">${escapeHtml(props.title || "Layered Visual Canvas")}</h2><div style="position:relative;min-height:${escapeHtml(props.minHeight || "560px")};border-radius:20px;overflow:hidden;background:${escapeHtml(props.backgroundColor || "#f8fafc")};background-image:${props.showGrid === false ? "none" : "linear-gradient(rgba(148,163,184,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.16) 1px, transparent 1px)"};background-size:24px 24px;border:1px solid rgba(148,163,184,0.32);">${images}</div></div></section>`;
    }
    case BlockTypes.COLUMNS_2: {
      const leftImage = props.leftImage ? `<img src="${escapeHtml(props.leftImage)}" alt="Left" style="width:100%;border-radius:14px;object-fit:cover;margin:0 0 12px;" />` : "";
      const rightImage = props.rightImage ? `<img src="${escapeHtml(props.rightImage)}" alt="Right" style="width:100%;border-radius:14px;object-fit:cover;margin:0 0 12px;" />` : "";
      const grid = props.ratio === "60-40" ? "1.2fr 0.8fr" : props.ratio === "40-60" ? "0.8fr 1.2fr" : "1fr 1fr";
      return `<section style="background:${escapeHtml(props.backgroundColor || style.textBg || "#ffffff")};color:${escapeHtml(props.textColor || style.textColor || "#0f172a")};"><div style="${sectionBase}">${props.title ? `<h2 style="margin:0 0 18px;font-size:34px;">${escapeHtml(props.title)}</h2>` : ""}<div style="display:grid;grid-template-columns:${grid};gap:16px;"><div style="padding:18px;border-radius:18px;background:${escapeHtml(props.cardBackgroundColor || "#f8fafc")};border:1px solid ${escapeHtml(props.borderColor || "#dbeafe")};">${leftImage}<h3 style="margin:0 0 8px;">${escapeHtml(props.leftTitle || "Left Column")}</h3><div>${textToParagraphs(props.leftContent || "")}</div></div><div style="padding:18px;border-radius:18px;background:${escapeHtml(props.cardBackgroundColor || "#f8fafc")};border:1px solid ${escapeHtml(props.borderColor || "#dbeafe")};">${rightImage}<h3 style="margin:0 0 8px;">${escapeHtml(props.rightTitle || "Right Column")}</h3><div>${textToParagraphs(props.rightContent || "")}</div></div></div></div></section>`;
    }
    case BlockTypes.COLUMNS_3: {
      const renderCol = (title, image, content) => `<div style="padding:18px;border-radius:18px;background:${escapeHtml(props.cardBackgroundColor || "#f8fafc")};border:1px solid ${escapeHtml(props.borderColor || "#dbeafe")};">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(title || "Column")}" style="width:100%;border-radius:14px;object-fit:cover;margin:0 0 12px;" />` : ""}<h3 style="margin:0 0 8px;">${escapeHtml(title || "Column")}</h3><div>${textToParagraphs(content || "")}</div></div>`;
      return `<section style="background:${escapeHtml(props.backgroundColor || style.textBg || "#ffffff")};color:${escapeHtml(props.textColor || style.textColor || "#0f172a")};"><div style="${sectionBase}">${props.title ? `<h2 style="margin:0 0 18px;font-size:34px;">${escapeHtml(props.title)}</h2>` : ""}<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;">${renderCol(props.column1Title, props.column1Image, props.column1)}${renderCol(props.column2Title, props.column2Image, props.column2)}${renderCol(props.column3Title, props.column3Image, props.column3)}</div></div></section>`;
    }
    case BlockTypes.FAQ: {
      const items = asArray(props.items).map((item) => `<details style="padding:14px 0;border-bottom:1px solid #e2e8f0;"><summary style="cursor:pointer;font-weight:${escapeHtml(String(props.questionFontWeight || "inherit"))};">${richTextToHtml(item?.q || item?.question || "Question")}</summary><div style="margin:10px 0 0;color:#475569;">${richTextToHtml(item?.a || item?.answer || "Answer")}</div></details>`).join("");
      return `<section style="background:${style.textBg || "#ffffff"};"><div style="${sectionBase};max-width:820px;"><h2 style="margin:0 0 18px;font-size:34px;">${richTextToHtml(props.title || "FAQ")}</h2>${items}</div></section>`;
    }
    case BlockTypes.CTA_BUTTON:
      return `<section style="background:${style.textBg || "#ffffff"};"><div style="${sectionBase};text-align:center;"><a href="${escapeHtml(props.link || "#")}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 18px;font-weight:700;">${escapeHtml(props.text || "Get Started")}</a></div></section>`;
    case BlockTypes.STATS: {
      const items = asArray(props.items).map((item) => `<div style="flex:1 1 180px;padding:18px;border-radius:16px;background:#f8fafc;"><div style="font-size:32px;font-weight:800;color:#0f172a;">${escapeHtml(item?.value || "0")}</div><div style="color:#475569;">${escapeHtml(item?.label || "Metric")}</div></div>`).join("");
      return `<section style="background:${style.textBg || "#ffffff"};"><div style="${sectionBase}"><div style="display:flex;gap:14px;flex-wrap:wrap;">${items}</div></div></section>`;
    }
    case BlockTypes.SPACE:
      return `<div style="height:${escapeHtml(props.height || "40px")};"></div>`;
    case BlockTypes.DIVIDER:
      return `<div style="max-width:1120px;margin:0 auto;border-top:1px solid #e2e8f0;"></div>`;
    default:
      return "";
  }
}

function buildInitialPageHtml(project, page, pageBlocks) {
  const blocks = Array.isArray(pageBlocks) ? pageBlocks : [];
  if (!blocks.length) return buildStarterPageHtml(project, page);

  const html = blocks.map((block) => buildHtmlFromBlock(block, project)).filter(Boolean).join("\n");
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(page?.name || project?.name || "Website Page")}</title>
  </head>
  <body style="margin:0;background:${getStyleTokens(project).textBg || "#ffffff"};font-family:${getStyleTokens(project).bodyFont || "system-ui,-apple-system,sans-serif"};">
    ${html || buildStarterPageHtml(project, page)}
  </body>
</html>`;
}

export function generateWebsitePageHtml(project, page, pageBlocks) {
  return buildInitialPageHtml(project, page, pageBlocks);
}

function prepareProjectContent(project) {
  const pagesContent = project?.pagesContent && typeof project.pagesContent === "object" ? { ...project.pagesContent } : {};
  const ensuredBlocks = ensureWebsiteProjectPageBlocks(project);
  const pageBlocksSource = ensuredBlocks || (project?.pageBlocks && typeof project.pageBlocks === "object" ? project.pageBlocks : {});
  const normalizationProject = {
    ...project,
    pageBlocks: pageBlocksSource,
  };
  const pageBlocks = Object.fromEntries(
    Object.entries(pageBlocksSource).map(([pageName, blocks]) => [pageName, normalizeStoredBlockList(blocks, { project: normalizationProject })])
  );
  const templateOverride = project?.templateSlug ? getWebsiteTemplateOverride(project.templateSlug) : null;
  const baseProject = {
    ...project,
    globalNavBlock: normalizeStoredBlock(project?.globalNavBlock || templateOverride?.globalNavBlock || null, { project: normalizationProject }),
    globalFooterBlock: normalizeStoredBlock(project?.globalFooterBlock || templateOverride?.globalFooterBlock || null, { project: normalizationProject }),
  };
  const globalBlockPatch = normalizeGlobalBlocks(baseProject);
  const globalNavBlock = globalBlockPatch.globalNavBlock || baseProject.globalNavBlock || null;
  const globalFooterBlock = globalBlockPatch.globalFooterBlock || baseProject.globalFooterBlock || null;

  seedProjectAssets(project, pageBlocks, { globalNavBlock, globalFooterBlock });

  (Array.isArray(project?.pages) ? project.pages : []).forEach((page) => {
    if (!page?.name) return;

    const current = String(pagesContent[page.name] || "").trim();
    if (current) return;

    const blocksForPage = Array.isArray(pageBlocks?.[page.name]) ? pageBlocks[page.name] : [];

    if (project?.mode === "blank" && !blocksForPage.length) {
      if (!(page.name in pagesContent)) pagesContent[page.name] = "";
      return;
    }

    pagesContent[page.name] = buildInitialPageHtml(project, page, blocksForPage);
  });

  return { pagesContent, pageBlocks, ...globalBlockPatch };
}

export function listWebsiteProjects(options = {}) {
  if (!hasWindow()) return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = safeParse(raw || "[]");
  const projects = Array.isArray(parsed) ? parsed : [];
  const migrated = projects.map((project) => {
    if (!project || typeof project !== "object") return project;
    if (!("brandAssets" in project)) return project;
    const { brandAssets, ...rest } = project;
    return rest;
  });

  if (JSON.stringify(projects) !== JSON.stringify(migrated)) {
    saveWebsiteProjects(migrated);
  }

  if (options?.includeUnsaved) {
    return migrated;
  }

  return migrated.filter((project) => project?.status !== "unsaved");
}

export function saveWebsiteProjects(projects) {
  if (!hasWindow()) return false;

  const primary = normalizeProjectsForStorage(projects);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(primary));
    return true;
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      console.warn("Could not save website projects.", error);
      return false;
    }

    try {
      const compact = normalizeProjectsForStorage(projects, { compact: true });
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(compact));
      return true;
    } catch {
      try {
        const emergency = normalizeProjectsForStorage(projects, { compact: true }).slice(0, 3);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(emergency));
        return true;
      } catch (finalError) {
        console.warn("Website project storage is full; latest changes could not be fully persisted.", finalError);
        return false;
      }
    }
  }
}

export function getWebsiteBuilderAssets() {
  if (!hasWindow()) return { logo: null, images: [] };
  const raw = window.localStorage.getItem(ASSET_STORAGE_KEY);
  const parsed = safeParse(raw || "{}");
  const normalized = pruneWebsiteBuilderAssets(parsed);
  if (JSON.stringify(parsed || {}) !== JSON.stringify(normalized)) {
    saveWebsiteBuilderAssets(normalized);
  }
  return mergeWebsiteBuilderAssets(normalized);
}

export function saveWebsiteBuilderAssets(assets) {
  if (!hasWindow()) return false;

  for (const limit of [MAX_STORED_ASSETS, 56, 40, 28, 20, 12, 8, 4, 2, 1, 0]) {
    const next = pruneWebsiteBuilderAssets(assets, limit);
    try {
      window.localStorage.setItem(ASSET_STORAGE_KEY, JSON.stringify(next));
      return true;
    } catch (error) {
      if (!isQuotaExceededError(error)) {
        console.warn("Could not save website assets.", error);
        return false;
      }
    }
  }

  console.warn("Website asset storage is full; newest images could not be kept.");
  return false;
}

export function createWebsiteProject(input) {
  const now = new Date().toISOString();
  const id = createId();

  const baseProject = {
    id,
    name: input?.name || "New Website Project",
    mode: input?.mode || "ai",
    buildType: input?.buildType || "website",
    stylePack: input?.stylePack || input?.brief?.stylePack || input?.brief?.importStylePack || "executive",
    templateSlug: input?.templateSlug || "",
    status: input?.status || "draft",
    brief: input?.brief || {},
    pages: Array.isArray(input?.pages) && input.pages.length
      ? input.pages
      : getTemplatePageDefinitions(input?.templateSlug || ""),
    copyAngles: Array.isArray(input?.copyAngles) ? input.copyAngles : [],
    createdAt: now,
    updatedAt: now,
    pagesContent: input?.pagesContent || {},
    pageBlocks: input?.pageBlocks || {},
  };

  const prepared = prepareProjectContent(baseProject);
  const project = {
    ...baseProject,
    pagesContent: prepared.pagesContent,
    pageBlocks: prepared.pageBlocks,
    ...(prepared.globalNavBlock ? { globalNavBlock: prepared.globalNavBlock } : {}),
    ...(prepared.globalFooterBlock ? { globalFooterBlock: prepared.globalFooterBlock } : {}),
  };

  const projects = listWebsiteProjects({ includeUnsaved: true });
  projects.unshift(project);
  saveWebsiteProjects(projects);
  return project;
}

export function getWebsiteProject(id) {
  const projects = listWebsiteProjects({ includeUnsaved: true });
  const idx = projects.findIndex((p) => String(p.id) === String(id));
  if (idx === -1) return null;

  const project = projects[idx];
  const prepared = prepareProjectContent(project);
  const migrated = {
    ...project,
    pagesContent: prepared.pagesContent,
    pageBlocks: prepared.pageBlocks,
    ...(prepared.globalNavBlock ? { globalNavBlock: prepared.globalNavBlock } : {}),
    ...(prepared.globalFooterBlock ? { globalFooterBlock: prepared.globalFooterBlock } : {}),
  };

  if (
    JSON.stringify(project.pagesContent || {}) !== JSON.stringify(migrated.pagesContent || {})
    || JSON.stringify(project.pageBlocks || {}) !== JSON.stringify(migrated.pageBlocks || {})
    || JSON.stringify(project.globalNavBlock || null) !== JSON.stringify(migrated.globalNavBlock || null)
    || JSON.stringify(project.globalFooterBlock || null) !== JSON.stringify(migrated.globalFooterBlock || null)
  ) {
    projects[idx] = migrated;
    saveWebsiteProjects(projects);
  }

  return migrated;
}

export function updateWebsiteProject(id, patch) {
  const projects = listWebsiteProjects({ includeUnsaved: true });
  const idx = projects.findIndex((p) => String(p.id) === String(id));
  if (idx === -1) return null;

  const next = {
    ...projects[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  const prepared = prepareProjectContent(next);
  const normalizedNext = {
    ...next,
    pagesContent: prepared.pagesContent,
    pageBlocks: prepared.pageBlocks,
    ...(prepared.globalNavBlock ? { globalNavBlock: prepared.globalNavBlock } : {}),
    ...(prepared.globalFooterBlock ? { globalFooterBlock: prepared.globalFooterBlock } : {}),
  };

  projects[idx] = normalizedNext;
  const didSave = saveWebsiteProjects(projects);
  return didSave ? normalizedNext : null;
}

export function deleteWebsiteProject(id) {
  const projects = listWebsiteProjects({ includeUnsaved: true });
  const next = projects.filter((p) => String(p.id) !== String(id));
  saveWebsiteProjects(next);
}
