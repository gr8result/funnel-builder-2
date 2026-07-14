import { mergeWebsiteBuilderAssetSources, normalizeWebsiteBuilderAssets, resolveAssetField } from "./mediaAssets";
import { BlockDefinitions, BlockTypes, COMPETITOR_COMPARISON_TEMPLATE_PROPS } from "./pageBlockComponents";
import { getTemplate, TEMPLATES, getTemplatePageDefinitions } from "./templates";
import { getPlatformPricingTablePlans } from "../../data/platformPricing";

const STORAGE_KEY = "gr8:website-projects:v1";
const LEGACY_STORAGE_KEY = "website_projects";
const LEGACY_IMPORT_MARKER_KEY = "gr8:website-projects:legacy-imported:v1";
const ASSET_STORAGE_KEY = "gr8:website-builder-assets:v1";
const TEMPLATE_OVERRIDE_STORAGE_KEY = "gr8:website-template-overrides:v1";
const BACKUP_STORAGE_KEY = "gr8:website-projects:backup:v1";
const MAX_STORED_PROJECTS = 12;
const MAX_STORED_ASSETS = 72;

let websiteProjectsCacheRaw = null;
let websiteProjectsCacheParsed = null;

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
    videos: Array.isArray(userAssets?.videos) ? userAssets.videos : [],
  });
}

function pruneWebsiteBuilderAssets(assets, maxImages = MAX_STORED_ASSETS) {
  const normalized = normalizeWebsiteBuilderAssets(assets);
  const seenImages = new Set();
  const seenVideos = new Set();
  const images = [];
  const videos = [];

  for (const image of Array.isArray(normalized.images) ? normalized.images : []) {
    const fingerprint = `${String(image?.name || "")}|${String(image?.type || "")}|${String(image?.src || "")}`;
    if (!image?.src || seenImages.has(fingerprint)) continue;
    seenImages.add(fingerprint);
    images.push(image);
    if (images.length >= maxImages) break;
  }

  for (const video of Array.isArray(normalized.videos) ? normalized.videos : []) {
    const fingerprint = `${String(video?.name || "")}|${String(video?.type || "")}|${String(video?.src || "")}`;
    if (!video?.src || seenVideos.has(fingerprint)) continue;
    seenVideos.add(fingerprint);
    videos.push(video);
    if (videos.length >= maxImages) break;
  }

  return {
    logo: normalized.logo || null,
    images,
    videos,
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

function readWebsiteProjectsFromStorage() {
  if (!hasWindow()) return [];

  const raw = window.localStorage.getItem(STORAGE_KEY) || "[]";
  if (raw === websiteProjectsCacheRaw && Array.isArray(websiteProjectsCacheParsed)) {
    return websiteProjectsCacheParsed.slice();
  }

  const parsed = safeParse(raw);
  const projects = Array.isArray(parsed) ? parsed : [];
  websiteProjectsCacheRaw = raw;
  websiteProjectsCacheParsed = projects;
  return projects.slice();
}

function writeWebsiteProjectsToStorage(projects) {
  const raw = JSON.stringify(projects);
  window.localStorage.setItem(STORAGE_KEY, raw);
  websiteProjectsCacheRaw = raw;
  websiteProjectsCacheParsed = Array.isArray(projects) ? projects : [];
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
    videos: stored.videos || [],
  });
}

function sanitizeValueForStorage(value, options = {}) {
  const compact = !!options.compact;
  const assets = options.assets || (hasWindow() ? getWebsiteBuilderAssets() : null);
  const nextOptions = options.assets ? options : { ...options, assets };

  if (Array.isArray(value)) {
    return value
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

function compareProjectUpdatedAtDesc(left, right) {
  const leftTime = Date.parse(left?.updatedAt || left?.createdAt || 0) || 0;
  const rightTime = Date.parse(right?.updatedAt || right?.createdAt || 0) || 0;
  return rightTime - leftTime;
}

function normalizeIncomingWebsiteProject(project) {
  if (!project || typeof project !== "object") return null;

  const now = new Date().toISOString();
  const baseProject = {
    ...project,
    id: String(project?.id || "").trim() || createId(),
    name: project?.name || "New Website Project",
    mode: project?.mode || "ai",
    buildType: project?.buildType || "website",
    stylePack: project?.stylePack || project?.brief?.stylePack || project?.brief?.importStylePack || "executive",
    templateSlug: project?.templateSlug || "",
    status: project?.status || "draft",
    brief: project?.brief || {},
    pages: normalizeProjectPages(project?.pages, project?.templateSlug || ""),
    copyAngles: Array.isArray(project?.copyAngles) ? project.copyAngles : [],
    createdAt: project?.createdAt || now,
    updatedAt: project?.updatedAt || now,
    pagesContent: cleanPageMap(project?.pagesContent || {}),
    pageBlocks: cleanPageMap(project?.pageBlocks || {}),
    chaiData: cleanPageMap(project?.chaiData || {}),
    globalNavBlock: project?.globalNavBlock || null,
    globalFooterBlock: project?.globalFooterBlock || null,
  };

  const prepared = prepareProjectContent(baseProject);
  return {
    ...baseProject,
    pagesContent: prepared.pagesContent,
    pageBlocks: prepared.pageBlocks,
    ...("globalNavBlock" in prepared ? { globalNavBlock: prepared.globalNavBlock } : {}),
    ...("globalFooterBlock" in prepared ? { globalFooterBlock: prepared.globalFooterBlock } : {}),
  };
}

function deepClone(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

const LEGACY_HERO_OVERLAY_PROPS = [
  "eyebrow",
  "headline",
  "subheadline",
  "ctaText",
  "ctaLink",
  "secondaryCtaText",
  "secondaryCtaLink",
  "headlineBlock",
  "bodyBlock",
  "contentX",
  "contentY",
  "contentWidth",
  "contentHeight",
  "contentBackground",
  "headlineAlignment",
  "verticalAlign",
  "headlineColor",
  "headlineFontFamily",
  "headlineFontWeight",
  "headlineFontSize",
  "headlineLineHeight",
  "subheadlineFontSize",
  "subheadlineLineHeight",
  "textFontSize",
  "textLineHeight",
  "textColor",
  "fontFamily",
  "fontWeight",
  "buttonColor",
  "buttonTextColor",
  "floatingImage",
  "floatingImageAssetId",
  "floatingImages",
  "floatingX",
  "floatingY",
  "floatingWidth",
  "floatingHeight",
  "floatingRotation",
  "extraTextOverlays",
  "hideTextOverlay",
  "contentOverlayAnimation",
  "contentOverlayAnimationDelay",
  "contentOverlayAnimationSpeed",
  "imageOverlayAnimation",
  "imageOverlayAnimationDelay",
  "imageOverlayAnimationSpeed",
  "ctaAnimation",
  "ctaAnimationDelay",
  "ctaAnimationSpeed",
];

function stripLegacyHeroOverlayProps(props) {
  const next = { ...(props || {}) };
  LEGACY_HERO_OVERLAY_PROPS.forEach((key) => {
    if (key in next) delete next[key];
  });
  return next;
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

  if (type === BlockTypes.COMPETITOR_COMPARISON) {
    const rowCount = Array.isArray(currentProps.rows) ? currentProps.rows.length : 0;
    const isLegacyCompetitorBlock = rowCount < 12
      || Number(currentProps.planPrice || 0) === 199
      || /business plan/i.test(String(currentProps.planName || ""))
      || /what you(?:'|\u2019)d pay elsewhere/i.test(String(currentProps.title || ""));

    if (isLegacyCompetitorBlock) {
      Object.assign(nextProps, deepClone(COMPETITOR_COMPARISON_TEMPLATE_PROPS), currentProps, {
        rows: deepClone(COMPETITOR_COMPARISON_TEMPLATE_PROPS.rows),
        title: currentProps.title && !/what you(?:'|\u2019)d pay elsewhere/i.test(String(currentProps.title || "")) ? currentProps.title : COMPETITOR_COMPARISON_TEMPLATE_PROPS.title,
        planName: /business plan/i.test(String(currentProps.planName || "")) ? COMPETITOR_COMPARISON_TEMPLATE_PROPS.planName : (currentProps.planName || COMPETITOR_COMPARISON_TEMPLATE_PROPS.planName),
        planPrice: Number(currentProps.planPrice || 0) === 199 ? COMPETITOR_COMPARISON_TEMPLATE_PROPS.planPrice : (Number(currentProps.planPrice) || COMPETITOR_COMPARISON_TEMPLATE_PROPS.planPrice),
        backgroundColor: currentProps.backgroundColor === "#070c18" || !currentProps.backgroundColor ? COMPETITOR_COMPARISON_TEMPLATE_PROPS.backgroundColor : currentProps.backgroundColor,
      });
    }
  }

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

  if (type === BlockTypes.NAV_BAR) {
    const currentLinks = Array.isArray(currentProps.links) ? currentProps.links : [];
    const normalizedLinks = normalizeNavigationLinks(currentLinks);
    // Only auto-populate page links when the nav has NO links (brand-new block).
    // Do NOT modify existing nav links — users must have full control over them.
    if (currentLinks.length === 0) {
      const nextLinks = appendMissingPageLinks(currentLinks, options?.project?.pages);
      if (JSON.stringify(currentLinks) !== JSON.stringify(nextLinks)) {
        nextProps.links = nextLinks;
      }
    } else if (JSON.stringify(currentLinks) !== JSON.stringify(normalizedLinks)) {
      nextProps.links = normalizedLinks;
    }
  }

  if (type === BlockTypes.FOOTER) {
    const currentNavLinks = Array.isArray(currentProps.navLinks) ? currentProps.navLinks : [];
    // Only auto-populate page links when the footer has NO nav links (brand-new block).
    if (currentNavLinks.length === 0) {
      const nextNavLinks = appendMissingPageLinks(currentNavLinks, options?.project?.pages);
      if (JSON.stringify(currentNavLinks) !== JSON.stringify(nextNavLinks)) {
        nextProps.navLinks = nextNavLinks;
      }
    }
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

const CANONICAL_NAV_URLS = {
  home: "/",
  "about-us": "/about",
  about: "/about",
  modules: "/modules",
  "contact-us": "/contact",
  contact: "/contact",
  email: "/email",
  pricing: "/pricing",
  crm: "/crm",
  sms: "/sms",
  funnels: "/funnels",
};

function normalizeNavHref(href, label = "", pageSlug = "") {
  const raw = String(href || "").trim();
  if (/^localhost/i.test(raw) || /^https?:\/\/localhost/i.test(raw)) {
    return normalizeNavHref(raw.replace(/^https?:\/\/localhost(?::\d+)?/i, "") || "/", label, pageSlug);
  }
  if (/^(https?:|mailto:|tel:)/i.test(raw)) return raw;
  if (raw.startsWith("#")) {
    const anchorSlug = slugify(raw.slice(1));
    return CANONICAL_NAV_URLS[anchorSlug] || raw;
  }

  const slug = slugify(pageSlug || label || raw.replace(/^\//, ""));
  if (CANONICAL_NAV_URLS[slug]) return CANONICAL_NAV_URLS[slug];
  if (!raw) return slug ? `/${slug}` : "";
  if (raw === "/") return "/";
  return raw.startsWith("/") ? raw : `/${slugify(raw) || raw}`;
}

function pageNameFromValue(value) {
  if (typeof value === "string") {
    const text = value.trim();
    return text && text !== "[object Object]" ? text : "";
  }
  if (value && typeof value === "object") {
    return pageNameFromValue(value.name || value.title || value.slug || "");
  }
  return "";
}

function isInvalidPageMapKey(key) {
  const text = String(key || "").trim();
  return !text || text === "[object Object]";
}

function cleanPageMap(map = {}) {
  if (!map || typeof map !== "object") return {};
  return Object.fromEntries(Object.entries(map).filter(([key]) => !isInvalidPageMapKey(key)));
}

function normalizeProjectPages(pages, templateSlug = "") {
  const sourcePages = Array.isArray(pages) && pages.length
    ? pages
    : getTemplatePageDefinitions(templateSlug || "");
  const seen = new Set();
  const normalized = [];
  sourcePages.forEach((page) => {
    const name = pageNameFromValue(page);
    if (!name) return;
    const key = slugify(name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    normalized.push({
      ...(page && typeof page === "object" ? page : {}),
      name,
      slug: page?.slug || key,
      order: Number.isFinite(Number(page?.order)) ? Number(page.order) : normalized.length,
    });
  });
  return normalized.length ? normalized : [{ name: "Home", slug: "home", order: 0 }];
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

function normalizeNavigationLinks(links, { removeDuplicates = true } = {}) {
  const seenIds = new Set();
  const seenKeys = new Set();

  const normalizeItem = (item, index, childIndex = null) => {
    const label = String(item?.label || "").trim();
    const pageId = String(item?.pageId || item?.page_id || "").trim();
    const pageSlug = slugify(item?.slug || item?.pageSlug || label || item?.href || "");
    const href = normalizeNavHref(item?.href, label, pageSlug);
    if (!label && !href) return null;

    const originalId = String(item?.id || "").trim();
    const id = originalId && !seenIds.has(originalId)
      ? originalId
      : `nav-${childIndex === null ? "item" : "child"}-${index}-${childIndex ?? 0}-${slugify(label || href) || "link"}`;
    seenIds.add(id);

    const duplicateKey = [pageId, pageSlug || slugify(href), slugify(label)].join("|");
    if (removeDuplicates && seenKeys.has(duplicateKey)) return null;
    seenKeys.add(duplicateKey);

    const children = asArray(item?.children)
      .map((child, idx) => normalizeItem(child, idx, idx))
      .filter(Boolean)
      .map((child) => ({ ...child, href: child.href || "/" }));

    return {
      ...item,
      id,
      label: label || "Link",
      href: href || "/",
      ...(pageId ? { pageId } : {}),
      ...(pageSlug ? { slug: pageSlug } : {}),
      children,
    };
  };

  return asArray(links).map((item, index) => normalizeItem(item, index)).filter(Boolean);
}

function appendMissingPageLinks(links, pages) {
  const safeLinks = Array.isArray(links) ? links.map((link) => ({ ...(link || {}) })) : [];
  const safePages = Array.isArray(pages) ? pages.filter((page) => String(page?.name || "").trim()) : [];

  safePages.forEach((page) => {
    // Check top-level links AND child dropdown links — if a page is nested in a dropdown,
    // don't re-add it as a duplicate top-level link.
    const foundInTopLevel = safeLinks.some((link) => isLinkForPage(link, page.name));
    const foundInChildren = safeLinks.some(
      (link) => Array.isArray(link.children) && link.children.some((child) => isLinkForPage(child, page.name))
    );
    if (foundInTopLevel || foundInChildren) return;
    const pageSlug = slugify(page?.slug || page.name);
    safeLinks.push({
      id: `nav-page-${pageSlug || safeLinks.length}`,
      pageId: String(page?.id || pageSlug || ""),
      slug: pageSlug,
      label: page.name,
      href: normalizeNavHref("", page.name, pageSlug),
      children: [],
    });
  });

  return safeLinks;
}

function buildProjectPageLinks(pages) {
  const sourcePages = Array.isArray(pages) && pages.length
    ? pages
    : [{ name: "Home" }];

  return sourcePages
    .filter((page) => String(page?.name || "").trim())
    .map((page) => {
      const pageName = String(page.name || "").trim();
      const key = slugify(pageName) || "home";
      return {
        id: `nav-page-${key}`,
        pageId: String(page?.id || key),
        slug: key,
        label: pageName,
        href: normalizeNavHref("", pageName, key),
        children: [],
      };
    });
}

function buildAnimationProps(overrides = {}) {
  return {
    sectionAnimation: overrides.sectionAnimation || "blur-in",
    sectionAnimationDelay: overrides.sectionAnimationDelay ?? 0,
    sectionAnimationSpeed: overrides.sectionAnimationSpeed || 1,
    textAnimation: overrides.textAnimation || "slide-up",
    textAnimationDelay: overrides.textAnimationDelay ?? 0.08,
    textAnimationSpeed: overrides.textAnimationSpeed || 0.95,
    subheadlineAnimation: overrides.subheadlineAnimation || "fade-up",
    subheadlineAnimationDelay: overrides.subheadlineAnimationDelay ?? 0.16,
    subheadlineAnimationSpeed: overrides.subheadlineAnimationSpeed || 1.05,
  };
}

function buildVisualImageSet(brief = {}, businessName = "Brand") {
  const descriptor = `${brief.offer || "premium service"} ${brief.targetAudience || "customers"} ${brief.goal || "results"}`.toLowerCase();
  const imageSets = {
    wellness: [
      "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1490818387583-1baba5e638af?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1400&q=80",
    ],
    realestate: [
      "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1460317442991-0ec209397118?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1501183638710-841dd1904471?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1400&q=80",
    ],
    finance: [
      "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1400&q=80",
    ],
    beauty: [
      "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1400&q=80",
    ],
    default: [
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1400&q=80",
    ],
  };

  let selected = imageSets.default;
  if (/(wellness|fitness|health|coach|yoga|nutrition|spa)/.test(descriptor)) selected = imageSets.wellness;
  else if (/(property|real estate|realtor|home|builder|interior)/.test(descriptor)) selected = imageSets.realestate;
  else if (/(finance|account|invest|mortgage|broker|loan|wealth)/.test(descriptor)) selected = imageSets.finance;
  else if (/(beauty|salon|skin|cosmetic|fashion|stylist)/.test(descriptor)) selected = imageSets.beauty;

  return {
    hero: selected[0],
    gallery: selected.slice(0, 3).map((src, index) => ({
      src,
      alt: `${businessName} visual ${index + 1}`,
      caption: index === 0 ? "Signature experience" : index === 1 ? "Client-ready presentation" : "Behind the scenes",
    })),
    stack: selected.slice(0, 2),
    team: [
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=900&q=80",
    ],
  };
}

function normalizeGlobalBlocks(project) {
  if (!project || typeof project !== "object") return {};

  const pages = Array.isArray(project.pages) ? project.pages : [];
  const patch = {};

  // Migration/repair: only a real navigation block belongs in globalNavBlock.
  // If a content block was accidentally pinned as global navigation, clear it so
  // it cannot cover every page in the builder or preview.
  if (project.globalNavBlock && project.globalNavBlock.type !== BlockTypes.NAV_BAR) {
    patch.globalNavBlock = null;
  } else if (project.globalNavBlock?.type === BlockTypes.NAV_BAR) {
    const currentLinks = Array.isArray(project.globalNavBlock?.props?.links)
      ? project.globalNavBlock.props.links
      : [];
    const nextLinks = normalizeNavigationLinks(currentLinks);
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

  // Migration: old AI generation code incorrectly stored a content block (e.g. columns-2)
  // as the globalFooterBlock. Only a proper "footer" type block belongs here — anything
  // else was a generation mistake and should be cleared so it stops appearing on every page.
  if (project.globalFooterBlock && project.globalFooterBlock.type !== BlockTypes.FOOTER) {
    patch.globalFooterBlock = null;
  } else if (project.globalFooterBlock?.type === BlockTypes.FOOTER) {
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

function shouldRefreshAiStarterBlocks(project, page, blocks) {
  if (String(project?.mode || "").toLowerCase() !== "ai") return false;
  const list = Array.isArray(blocks) ? blocks : [];
  if (!list.length) return false;

  const types = list.map((block) => String(block?.type || ""));
  const alreadyRich = types.some((type) => [
    BlockTypes.IMAGE_GALLERY,
    BlockTypes.IMAGE_STACK,
    BlockTypes.COLUMNS_2,
    BlockTypes.COLUMNS_3,
    BlockTypes.TEAM,
    BlockTypes.PARALLAX,
    BlockTypes.TRUST_BADGES,
  ].includes(type));
  if (alreadyRich) return false;

  const pageName = String(page?.name || "").toLowerCase();
  const simpleHomePattern = [BlockTypes.NAV_BAR, BlockTypes.HERO, BlockTypes.STATS, BlockTypes.FEATURE_LIST, BlockTypes.TESTIMONIAL];
  const simpleInnerPattern = [BlockTypes.NAV_BAR, BlockTypes.HERO, BlockTypes.TEXT];

  if (pageName === "home") {
    return simpleHomePattern.every((type) => types.includes(type));
  }

  return simpleInnerPattern.every((type) => types.includes(type));
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

  const pageName = pageNameFromValue(options?.pageName || "");
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
          title: props.title || "A website should be the start of the sales system",
          subtitle: props.subtitle || "Built to help you launch faster, capture more leads, and manage follow-up from one connected platform.",
          stats: asArray(props.items).map((item) => ({
            number: item?.value || item?.number || "0",
            label: item?.label || item?.text || "Metric",
            detail: item?.detail || item?.description || item?.body || item?.supportingText || item?.text || item?.label || "",
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
  const navLinks = buildProjectPageLinks(project?.pages);
  const visuals = buildVisualImageSet(brief, businessName);
  const spotlightGradient = `linear-gradient(135deg, ${style.heroBg || "#1d4ed8"} 0%, #7c3aed 48%, #ec4899 100%)`;

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
      links: navLinks,
      ctaText: goal.toLowerCase().includes("book") ? "Book Now" : "Get Started",
      ctaLink: "#contact",
      backgroundColor: style.navBg,
      textColor: style.navText,
      buttonColor: style.navButtonBg || "#0ea5e9",
      buttonTextColor: style.navButtonText || "#ffffff",
      linkHoverEffect: "glow",
      ...buildAnimationProps({ sectionAnimation: "fade-in" }),
    }),
    createBlock(BlockTypes.HERO, {
      headline: `${businessName} turns attention into action for ${audience}`,
      subheadline: lines([
        `A vivid, high-converting presentation for ${offer}.`,
        `Built to ${goal}.`,
        page?.objective || "Establish trust and present the core offer.",
      ]),
      ctaText: goal.toLowerCase().includes("book") ? "Book Now" : "Get Started",
      ctaLink: "#contact",
      backgroundStyle: "image",
      backgroundImage: visuals.hero,
      enableParallax: true,
      backgroundColor: spotlightGradient,
      heroVariant: "editorial",
      minHeight: "720px",
      buttonColor: "linear-gradient(135deg,#fde047,#fb7185)",
      buttonTextColor: "#0f172a",
      floatingImage: visuals.gallery[1]?.src || "",
      floatingWidth: 320,
      floatingHeight: 420,
      floatingX: 72,
      floatingY: 54,
      ...buildAnimationProps({ sectionAnimation: "zoom", textAnimation: "blur-in", subheadlineAnimation: "fade-up" }),
    }),
    createBlock(BlockTypes.IMAGE_STACK, {
      title: `${businessName} in motion`,
      backgroundColor: "linear-gradient(135deg,#fff1f2,#eef2ff 45%,#ecfeff)",
      minHeight: "760px",
      images: [
        { id: "hero-stack-1", kind: "image", src: visuals.stack[0] || visuals.hero, assetId: "", x: 40, y: 56, width: 420, height: 300, rotation: -8, radius: 28, zIndex: 1 },
        { id: "hero-stack-2", kind: "image", src: visuals.stack[1] || visuals.gallery[1]?.src || visuals.hero, assetId: "", x: 300, y: 240, width: 340, height: 250, rotation: 7, radius: 28, zIndex: 2 },
        { id: "hero-stack-text", kind: "text", content: `${offer}\nDesigned to ${goal}`, x: 660, y: 120, width: 320, height: 220, rotation: -2, radius: 24, zIndex: 3, fontSize: 38, fontWeight: "700", textAlign: "center", verticalAlign: "center", textColor: "#111827", background: "rgba(255,255,255,0.88)" },
      ],
      ...buildAnimationProps({ sectionAnimation: "fade-up", sectionAnimationDelay: 0.04 }),
    }),
    createBlock(BlockTypes.STATS, {
      title: "A website should be the start of the sales system",
      subtitle: "Built to help you launch faster, capture more leads, and manage follow-up from one connected platform.",
      stats: [
        { number: "1", label: "All-In-One Platform", detail: "Build websites, funnels, landing pages, CRM, bookings, email and automation inside one workspace." },
        { number: "24/7", label: "Lead Capture & Follow-Up", detail: "Capture enquiries around the clock and keep prospects moving with automated follow-up." },
        { number: "0", label: "Code Needed", detail: "Update pages, forms, content and campaigns without waiting on a developer." },
        { number: "100%", label: "Owned Inside Gr8 Result", detail: "Keep your website, marketing tools, leads and business systems together in Gr8 Result." },
      ],
      statsVariant: "spotlight-orbs",
      backgroundColor: "linear-gradient(180deg,#0f172a,#1e293b)",
      textColor: "#f8fafc",
      cardBackgroundColor: "rgba(15,23,42,0.55)",
      borderColor: "rgba(148,163,184,0.24)",
      accentColor: "#f472b6",
      ...buildAnimationProps({ sectionAnimation: "blur-in", sectionAnimationDelay: 0.08 }),
    }),
    createBlock(BlockTypes.COLUMNS_2, {
      title: "Built around your offer",
      leftTitle: `For ${audience}`,
      leftContent: `Everything on this page should make ${audience} feel that ${offer} is made for them.`,
      leftImage: visuals.gallery[0]?.src || visuals.hero,
      rightTitle: `Why it stands out`,
      rightContent: `The design system uses colour, imagery, motion, and clear CTA hierarchy to ${goal}.`,
      rightImage: visuals.gallery[1]?.src || visuals.hero,
      ratio: "60-40",
      backgroundColor: "linear-gradient(135deg,#111827,#312e81)",
      columnBackgroundColor: "rgba(255,255,255,0.08)",
      columnBorderColor: "rgba(255,255,255,0.16)",
      columnTitleColor: "#ffffff",
      columnBodyColor: "#dbeafe",
      columnShadow: "strong",
      columnRadius: 24,
      columnPadding: 22,
      minHeight: "540px",
      ...buildAnimationProps({ sectionAnimation: "slide-up", sectionAnimationDelay: 0.12 }),
    }),
    createBlock(BlockTypes.FEATURE_LIST, {
      title: "Why this version feels premium",
      items: [
        { title: "Visual depth", body: `Multiple image-led sections make ${offer} feel tangible and real.`, image: visuals.gallery[0]?.src || visuals.hero },
        { title: "Stronger colour system", body: `The palette does more than decorate: it pushes hierarchy, energy, and contrast.`, image: visuals.gallery[1]?.src || visuals.hero },
        { title: "More motion", body: `Animation is applied across headline, section reveals, and content transitions.`, image: visuals.gallery[2]?.src || visuals.hero },
      ],
      layout: "vertical",
      featureVariant: "glass-cards",
      backgroundColor: "linear-gradient(180deg,#ffffff,#fdf2f8)",
      itemBackgroundColor: "rgba(255,255,255,0.78)",
      borderColor: "rgba(244,114,182,0.18)",
      headingFontFamily: style.headingFont,
      bodyFontFamily: style.bodyFont,
      ...buildAnimationProps({ sectionAnimation: "fade-up", sectionAnimationDelay: 0.16 }),
    }),
    createBlock(BlockTypes.IMAGE_GALLERY, {
      title: `${businessName} visual proof`,
      galleryVariant: "editorial-mosaic",
      columns: 3,
      images: visuals.gallery,
      backgroundColor: "linear-gradient(180deg,#eef2ff,#ffffff)",
      borderColor: "rgba(99,102,241,0.16)",
      ...buildAnimationProps({ sectionAnimation: "zoom", sectionAnimationDelay: 0.2 }),
    }),
    createBlock(BlockTypes.TRUST_BADGES, {
      badges: [
        { icon: "⚡", label: `${goal}` },
        { icon: "🎯", label: `For ${audience}` },
        { icon: "🖼️", label: "Image-led layout" },
      ],
      backgroundColor: "linear-gradient(90deg,#111827,#1f2937,#312e81)",
      textColor: "#e5e7eb",
      ...buildAnimationProps({ sectionAnimation: "fade-in", sectionAnimationDelay: 0.24 }),
    }),
    createBlock(BlockTypes.TESTIMONIAL, {
      text: `"${businessName} made the next step obvious and easy."`,
      author: "Example Client",
      role: "Customer",
      testimonialVariant: "wall",
      backgroundColor: "linear-gradient(135deg,#1d4ed8,#7c3aed)",
      textColor: "#ffffff",
      accentColor: "#facc15",
      headingFontFamily: style.headingFont,
      bodyFontFamily: style.bodyFont,
      ...buildAnimationProps({ sectionAnimation: "blur-in", sectionAnimationDelay: 0.28 }),
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
      faqPanelBackgroundColor: "rgba(255,255,255,0.92)",
      borderColor: "rgba(148,163,184,0.28)",
      backgroundColor: "linear-gradient(180deg,#fff7ed,#ffffff)",
      ...buildAnimationProps({ sectionAnimation: "fade-up", sectionAnimationDelay: 0.32 }),
    }),
    createBlock(BlockTypes.CONTACT_FORM, {
      title: "Start the conversation",
      subtitle: page?.objective || "Capture qualified enquiries and move visitors toward action.",
      mediaPosition: "right",
      mediaImage: visuals.gallery[2]?.src || visuals.hero,
      mediaAlt: `${businessName} contact visual`,
      formVariant: "split-card",
      sectionGradient: "linear-gradient(135deg,#0f172a,#312e81)",
      cardBackgroundColor: "rgba(255,255,255,0.96)",
      buttonBackgroundColor: "linear-gradient(135deg,#f472b6,#fb7185)",
      buttonTextColor: "#ffffff",
      ...buildAnimationProps({ sectionAnimation: "slide-up", sectionAnimationDelay: 0.36 }),
    }),
    createBlock(BlockTypes.TEXT, {
      text: `© ${new Date().getFullYear()} ${businessName}. All rights reserved.`,
      alignment: "center",
      backgroundColor: style.footerBg,
      textColor: style.footerText,
      ...buildAnimationProps({ sectionAnimation: "fade-in", sectionAnimationDelay: 0.4 }),
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
  const goal = brief.goal || "generate more momentum";
  const objective = page?.objective || "Move visitors toward action.";
  const style = getStyleTokens(project);
  const navLinks = buildProjectPageLinks(project?.pages);
  const visuals = buildVisualImageSet(brief, businessName);
  const navBlock = createBlock(BlockTypes.NAV_BAR, {
    variant: style.navVariant || "boxed-brand",
    stickyMode: style.navStickyMode || "sticky-transparent",
    mobileMenuStyle: "hamburger",
    showLogo: true,
    brandFontSize: 20,
    linkFontSize: 16,
    ctaFontSize: 16,
    brand: businessName,
    links: navLinks,
    ctaText: "Contact",
    ctaLink: "#contact",
    backgroundColor: style.navBg,
    textColor: style.navText,
    buttonColor: style.navButtonBg || "#0ea5e9",
    buttonTextColor: style.navButtonText || "#ffffff",
      headingFontFamily: style.headingFont,
      bodyFontFamily: style.bodyFont,
    linkHoverEffect: "glow",
    ...buildAnimationProps({ sectionAnimation: "fade-in" }),
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
        backgroundColor: "linear-gradient(180deg,#fff7ed,#ffffff)",
        textColor: style.textColor,
        headingFontFamily: style.headingFont,
        bodyFontFamily: style.bodyFont,
        textFontSize: 20,
        ...buildAnimationProps({ sectionAnimation: "fade-up", sectionAnimationDelay: 0.04 }),
      }),
      createBlock(BlockTypes.IMAGE_GALLERY, {
        title: `${businessName} at work`,
        galleryVariant: "polaroid-wall",
        images: visuals.gallery,
        columns: 3,
        backgroundColor: "linear-gradient(180deg,#fdf2f8,#ffffff)",
        ...buildAnimationProps({ sectionAnimation: "zoom", sectionAnimationDelay: 0.08 }),
      }),
      createBlock(BlockTypes.STATS, {
        title: "A website should be the start of the sales system",
        subtitle: "Built to help you launch faster, capture more leads, and manage follow-up from one connected platform.",
        stats: [
          { number: "1", label: "All-In-One Platform", detail: "Build websites, funnels, landing pages, CRM, bookings, email and automation inside one workspace." },
          { number: "24/7", label: "Lead Capture & Follow-Up", detail: "Capture enquiries around the clock and keep prospects moving with automated follow-up." },
          { number: "0", label: "Code Needed", detail: "Update pages, forms, content and campaigns without waiting on a developer." },
          { number: "100%", label: "Owned Inside Gr8 Result", detail: "Keep your website, marketing tools, leads and business systems together in Gr8 Result." },
        ],
        statsVariant: "data-ribbon",
        backgroundColor: "linear-gradient(180deg,#111827,#1f2937)",
        textColor: "#f8fafc",
        cardBackgroundColor: "rgba(255,255,255,0.08)",
        accentColor: "#22d3ee",
        ...buildAnimationProps({ sectionAnimation: "blur-in", sectionAnimationDelay: 0.12 }),
      }),
      createBlock(BlockTypes.TEAM, {
        title: `Meet the ${businessName} team`,
        subtitle: `People who make ${offer} feel polished and trusted.`,
        teamVariant: "spotlight-strip",
        members: [
          { id: "team-1", name: "Ava Bennett", role: "Strategy Lead", image: visuals.team[0], bio: `Shapes how ${audience} sees the offer.` },
          { id: "team-2", name: "Marcus Reed", role: "Creative Director", image: visuals.team[1], bio: "Builds the look, layout, and visual hierarchy." },
          { id: "team-3", name: "Nina Patel", role: "Automation Specialist", image: visuals.team[2], bio: `Keeps the follow-up moving so you can ${goal}.` },
        ],
        backgroundColor: "linear-gradient(180deg,#eef2ff,#ffffff)",
        ...buildAnimationProps({ sectionAnimation: "fade-up", sectionAnimationDelay: 0.16 }),
      }),
      createBlock(BlockTypes.TESTIMONIAL, {
        text: `"Working with ${businessName} felt clear, fast and professional."`,
        author: "Example Client",
        role: "Customer",
        testimonialVariant: style.testimonialVariant || "spotlight",
        headingFontFamily: style.headingFont,
        bodyFontFamily: style.bodyFont,
        ...buildAnimationProps({ sectionAnimation: "fade-in", sectionAnimationDelay: 0.2 }),
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
        backgroundStyle: "image",
        backgroundImage: visuals.hero,
        backgroundColor: "linear-gradient(135deg,#0f172a,#1d4ed8)",
        heroVariant: "split",
        minHeight: "680px",
        headingFontFamily: style.headingFont,
        bodyFontFamily: style.bodyFont,
        ...buildAnimationProps({ sectionAnimation: "zoom", textAnimation: "blur-in" }),
      }),
      createBlock(BlockTypes.FEATURE_LIST, {
        title: `${pageName} highlights`,
        items: [
          { title: `${offer} tailored for ${audience}`, body: "Clear fit, stronger relevance, faster trust.", image: visuals.gallery[0]?.src || visuals.hero },
          { title: "Clear deliverables", body: "Use bold visual cards to make the scope easy to grasp.", image: visuals.gallery[1]?.src || visuals.hero },
          { title: "Action-oriented CTA", body: `The whole page is structured to ${goal}.`, image: visuals.gallery[2]?.src || visuals.hero },
        ],
        layout: "vertical",
        featureVariant: "glass-cards",
        headingFontFamily: style.headingFont,
        bodyFontFamily: style.bodyFont,
        backgroundColor: "linear-gradient(180deg,#ffffff,#eef2ff)",
        ...buildAnimationProps({ sectionAnimation: "fade-up", sectionAnimationDelay: 0.08 }),
      }),
      createBlock(BlockTypes.IMAGE_GALLERY, {
        title: `${pageName} visuals`,
        galleryVariant: "spotlight-strip",
        images: visuals.gallery,
        columns: 3,
        ...buildAnimationProps({ sectionAnimation: "zoom", sectionAnimationDelay: 0.12 }),
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
        ...buildAnimationProps({ sectionAnimation: "blur-in", sectionAnimationDelay: 0.16 }),
      }),
      createBlock(BlockTypes.CTA_BUTTON, {
        text: "Book a Consultation",
        link: "#contact",
        style: "split-banner",
        backgroundColor: "linear-gradient(135deg,#111827,#312e81)",
        textColor: "#ffffff",
        buttonColor: "linear-gradient(135deg,#22d3ee,#2563eb)",
        borderColor: "rgba(125,211,252,0.3)",
        ...buildAnimationProps({ sectionAnimation: "fade-up", sectionAnimationDelay: 0.2 }),
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
        backgroundStyle: "image",
        backgroundImage: visuals.hero,
        backgroundColor: "linear-gradient(135deg,#0f172a,#7c3aed)",
        heroVariant: "spotlight",
        minHeight: "640px",
        headingFontFamily: style.headingFont,
        bodyFontFamily: style.bodyFont,
        ...buildAnimationProps({ sectionAnimation: "zoom", textAnimation: "blur-in" }),
      }),
      createBlock(BlockTypes.CONTACT_FORM, {
        title: pageName,
        subtitle: `Use this page to collect qualified leads from ${audience}.`,
        mediaPosition: "right",
        mediaImage: visuals.gallery[1]?.src || visuals.hero,
        formVariant: "split-card",
        sectionGradient: "linear-gradient(135deg,#111827,#1d4ed8)",
        cardBackgroundColor: "rgba(255,255,255,0.96)",
        buttonBackgroundColor: "linear-gradient(135deg,#f472b6,#fb7185)",
        ...buildAnimationProps({ sectionAnimation: "fade-up", sectionAnimationDelay: 0.08 }),
      }),
      createBlock(BlockTypes.FAQ, {
        title: "Before you reach out",
        items: [
          { question: "Who is this for?", answer: audience },
          { question: "What can I expect?", answer: objective },
        ],
        backgroundColor: "linear-gradient(180deg,#eef2ff,#ffffff)",
        ...buildAnimationProps({ sectionAnimation: "fade-up", sectionAnimationDelay: 0.12 }),
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
        backgroundColor: "linear-gradient(180deg,#fdf2f8,#ffffff)",
        textColor: style.textColor,
        textFontSize: 24,
        ...buildAnimationProps({ sectionAnimation: "fade-up", sectionAnimationDelay: 0.04 }),
      }),
      createBlock(BlockTypes.TESTIMONIAL, {
        text: `"${businessName} delivered a result we can clearly measure."`,
        author: "Client Example",
        role: "Case study",
        testimonialVariant: style.testimonialVariant || "spotlight",
        headingFontFamily: style.headingFont,
        bodyFontFamily: style.bodyFont,
        ...buildAnimationProps({ sectionAnimation: "fade-in", sectionAnimationDelay: 0.08 }),
      }),
      createBlock(BlockTypes.STATS, {
        title: "A website should be the start of the sales system",
        subtitle: "Built to help you launch faster, capture more leads, and manage follow-up from one connected platform.",
        stats: [
          { number: "1", label: "All-In-One Platform", detail: "Build websites, funnels, landing pages, CRM, bookings, email and automation inside one workspace." },
          { number: "24/7", label: "Lead Capture & Follow-Up", detail: "Capture enquiries around the clock and keep prospects moving with automated follow-up." },
          { number: "0", label: "Code Needed", detail: "Update pages, forms, content and campaigns without waiting on a developer." },
          { number: "100%", label: "Owned Inside Gr8 Result", detail: "Keep your website, marketing tools, leads and business systems together in Gr8 Result." },
        ],
        statsVariant: "split-scoreboard",
        backgroundColor: "linear-gradient(180deg,#111827,#1f2937)",
        textColor: "#f8fafc",
        ...buildAnimationProps({ sectionAnimation: "blur-in", sectionAnimationDelay: 0.12 }),
      }),
      createBlock(BlockTypes.IMAGE_GALLERY, {
        title: "Result visuals",
        galleryVariant: "balanced-grid",
        images: visuals.gallery,
        ...buildAnimationProps({ sectionAnimation: "zoom", sectionAnimationDelay: 0.16 }),
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
        backgroundColor: "linear-gradient(180deg,#eef2ff,#ffffff)",
        textColor: style.textColor,
        ...buildAnimationProps({ sectionAnimation: "fade-up", sectionAnimationDelay: 0.04 }),
      }),
      createBlock(BlockTypes.IMAGE_GALLERY, {
        title: pageName,
        columns: 3,
        galleryVariant: "editorial-mosaic",
        images: visuals.gallery,
        ...buildAnimationProps({ sectionAnimation: "zoom", sectionAnimationDelay: 0.08 }),
      }),
      createBlock(BlockTypes.CTA_BUTTON, {
        text: "Ask About a Similar Project",
        link: "#contact",
        style: "editorial-outline",
        ...buildAnimationProps({ sectionAnimation: "fade-in", sectionAnimationDelay: 0.12 }),
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
      backgroundStyle: "image",
      backgroundImage: visuals.hero,
      backgroundColor: "linear-gradient(135deg,#0f172a,#1d4ed8)",
      heroVariant: "spotlight",
      minHeight: "660px",
      headingFontFamily: style.headingFont,
      bodyFontFamily: style.bodyFont,
      ...buildAnimationProps({ sectionAnimation: "zoom", textAnimation: "blur-in" }),
    }),
    createBlock(BlockTypes.TEXT, {
      text: lines([
        `${offer} for ${audience}.`,
        objective,
      ]),
      backgroundColor: "linear-gradient(180deg,#ffffff,#f8fafc)",
      textColor: style.textColor,
      textFontSize: 20,
      ...buildAnimationProps({ sectionAnimation: "fade-up", sectionAnimationDelay: 0.08 }),
    }),
    createBlock(BlockTypes.IMAGE_GALLERY, {
      title: `${pageName} highlights`,
      galleryVariant: "balanced-grid",
      images: visuals.gallery,
      ...buildAnimationProps({ sectionAnimation: "zoom", sectionAnimationDelay: 0.12 }),
    }),
    createBlock(BlockTypes.CTA_BUTTON, {
      text: "Take the Next Step",
      link: "#contact",
      style: "split-banner",
      ...buildAnimationProps({ sectionAnimation: "fade-in", sectionAnimationDelay: 0.16 }),
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
          links: buildProjectPageLinks(project?.pages),
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
      // Page already has saved blocks — always trust them and never silently replace.
      // (chaiData is stripped from localStorage so the old manual-edit heuristic was
      //  unreliable and caused user edits to be wiped on every reload.)
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

function inlineRichTextToHtml(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/<\/?[a-z][\s\S]*>/i.test(raw)) return raw;
  return escapeHtml(raw);
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

function cssDeclaration(name, value, unit = "") {
  if (value === undefined || value === null || value === "") return "";
  return `${name}:${escapeHtml(String(value))}${unit};`;
}

function cssPxDeclaration(name, value) {
  if (value === undefined || value === null || value === "") return "";
  const text = String(value).trim();
  if (!text) return "";
  if (/^-?\d+(\.\d+)?$/.test(text)) return `${name}:${escapeHtml(text)}px;`;
  return `${name}:${escapeHtml(text)};`;
}

function typographyCss(props = {}, target = "body") {
  const headlineBlock = props.headlineBlock && typeof props.headlineBlock === "object" ? props.headlineBlock : {};
  const bodyBlock = props.bodyBlock && typeof props.bodyBlock === "object" ? props.bodyBlock : {};
  const source = target === "heading" ? headlineBlock : bodyBlock;
  const fontSize = source.fontSize
    || (target === "heading" ? (props.headlineFontSize || props.headingFontSize) : (props.textFontSize || props.bodyFontSize || props.subheadlineFontSize));
  const lineHeight = source.lineHeight
    || (target === "heading" ? (props.headlineLineHeight || props.headingLineHeight) : (props.textLineHeight || props.bodyLineHeight || props.subheadlineLineHeight || props.lineHeight));
  const fontFamily = source.fontFamily
    || (target === "heading" ? (props.headlineFontFamily || props.headingFontFamily) : (props.fontFamily || props.bodyFontFamily));
  const fontWeight = source.fontWeight
    || (target === "heading" ? (props.headlineFontWeight || props.headingFontWeight) : (props.fontWeight || props.bodyFontWeight));
  const textAlign = source.alignment
    || (target === "heading"
      ? (props.headlineAlignment || props.headlineAlign || props.headingAlign || props.textAlign || props.alignment)
      : (props.bodyAlign || props.textAlign || props.alignment));
  const color = source.color
    || (target === "heading" ? (props.headlineColor || props.headingColor) : (props.textColor || props.bodyColor || props.subtleTextColor));

  return [
    cssPxDeclaration("font-size", fontSize),
    cssDeclaration("line-height", lineHeight),
    cssDeclaration("font-family", fontFamily),
    cssDeclaration("font-weight", fontWeight),
    cssDeclaration("text-align", textAlign),
    cssDeclaration("color", color),
    cssPxDeclaration("letter-spacing", source.letterSpacing || props.letterSpacing),
  ].join("");
}

function spacingCss(props = {}) {
  return [
    cssPxDeclaration("margin", props.margin),
    cssPxDeclaration("margin-top", props.marginTop),
    cssPxDeclaration("margin-right", props.marginRight),
    cssPxDeclaration("margin-bottom", props.marginBottom),
    cssPxDeclaration("margin-left", props.marginLeft),
    cssPxDeclaration("padding", props.padding),
    cssPxDeclaration("padding-top", props.paddingTop),
    cssPxDeclaration("padding-right", props.paddingRight),
    cssPxDeclaration("padding-bottom", props.paddingBottom),
    cssPxDeclaration("padding-left", props.paddingLeft),
  ].join("");
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
    case BlockTypes.HERO: {
      const headlineBlock = props.headlineBlock && typeof props.headlineBlock === "object" ? props.headlineBlock : {};
      const bodyBlock = props.bodyBlock && typeof props.bodyBlock === "object" ? props.bodyBlock : {};
      const headingHtml = inlineRichTextToHtml(headlineBlock.content ?? props.headline ?? "Your headline");
      const bodyHtml = richTextToHtml(bodyBlock.content ?? props.subheadline ?? "Describe what this page offers.");
      const contentWidth = Math.max(320, Number(props.contentWidth || props.baseLayoutWidth || 940) || 940);
      const sectionAlign = headlineBlock.alignment || props.headlineAlignment || props.headlineAlign || props.headingAlign || props.alignment || "center";
      const overlayOpacity = Math.max(0, Math.min(1, Number(props.backgroundOverlayOpacity ?? props.overlayOpacity ?? 0.55)));
      const overlayColor = colorWithAlpha(props.backgroundOverlayColor || props.overlayColor || "#020617", overlayOpacity);
      return `<section style="position:relative;overflow:hidden;padding:88px 20px;min-height:${escapeHtml(props.minHeight || "480px")};background:${props.backgroundImage ? `linear-gradient(${overlayColor}, ${overlayColor}), url('${escapeHtml(props.backgroundImage)}') center/cover no-repeat` : (props.backgroundColor || style.heroBg || "#1d4ed8")};color:${escapeHtml(headlineBlock.color || props.headlineColor || "#ffffff")};text-align:${escapeHtml(sectionAlign)};${spacingCss(props)}">
        <div style="position:relative;z-index:1;max-width:${Math.max(contentWidth + (props.floatingImage ? 480 : 0), contentWidth)}px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:42px;align-items:center;overflow:hidden;">
          <div style="max-width:${contentWidth}px;">
            ${props.eyebrow ? `<div style="display:inline-flex;margin:0 0 16px;padding:7px 13px;border-radius:999px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${escapeHtml(headlineBlock.color || props.headlineColor || "#ffffff")};">${inlineRichTextToHtml(props.eyebrow)}</div>` : ""}
            <h1 style="margin:0 0 16px;${typographyCss(props, "heading")}word-break:break-word;overflow-wrap:anywhere;">${headingHtml}</h1>
            <div style="${typographyCss(props, "body")}word-break:break-word;overflow-wrap:anywhere;">${bodyHtml}</div>
            ${(props.ctaText || props.secondaryCtaText) ? `<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:24px;">${props.ctaText ? `<a href="${escapeHtml(props.ctaLink || "#")}" style="display:inline-flex;align-items:center;justify-content:center;min-height:48px;background:${props.buttonColor || "#ffffff"};color:${props.buttonTextColor || style.heroBg || "#1d4ed8"};padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:800;">${inlineRichTextToHtml(props.ctaText)}</a>` : ""}${props.secondaryCtaText ? `<a href="${escapeHtml(props.secondaryCtaLink || "#")}" style="display:inline-flex;align-items:center;justify-content:center;min-height:48px;background:rgba(255,255,255,0.08);color:${escapeHtml(headlineBlock.color || props.headlineColor || "#ffffff")};border:1px solid rgba(255,255,255,0.22);padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:800;">${inlineRichTextToHtml(props.secondaryCtaText)}</a>` : ""}</div>` : ""}
          </div>
          ${props.floatingImage ? `<img src="${escapeHtml(props.floatingImage)}" alt="${escapeHtml(props.floatingAlt || props.headline || "Project dashboard")}" style="width:100%;max-width:${Math.max(220, Number(props.floatingWidth || 430))}px;height:${Math.max(160, Number(props.floatingHeight || 310))}px;object-fit:cover;border-radius:24px;border:1px solid rgba(255,255,255,0.18);box-shadow:0 32px 80px rgba(0,0,0,0.42);justify-self:center;transform:rotate(${Number(props.floatingRotation || 0)}deg);" />` : ""}
        </div>
      </section>`;
    }
    case BlockTypes.PARALLAX:
      return `<section style="position:relative;overflow:hidden;padding:88px 20px;min-height:${escapeHtml(props.minHeight || "480px")};background:${props.backgroundImage ? `linear-gradient(rgba(15,23,42,0.45), rgba(15,23,42,0.22)), url('${escapeHtml(props.backgroundImage)}') center/cover no-repeat` : (props.backgroundColor || style.heroBg || "#1d4ed8")};color:${props.headlineColor || "#ffffff"};text-align:${escapeHtml(props.headlineBlock?.alignment || props.headlineAlignment || "center")};${spacingCss(props)}">
        ${props.floatingImage ? `<img src="${escapeHtml(props.floatingImage)}" alt="${escapeHtml(props.floatingAlt || "Overlay image")}" style="position:absolute;left:${escapeHtml(String(props.floatingX ?? 76))}%;top:${escapeHtml(String(props.floatingY ?? 58))}%;transform:translate(-50%,-50%);width:${escapeHtml(String(props.floatingWidth ?? 260))}px;height:${escapeHtml(String(props.floatingHeight ?? 260))}px;object-fit:cover;border-radius:18px;box-shadow:0 24px 48px rgba(15,23,42,0.28);" />` : ""}
        <div style="position:relative;z-index:1;max-width:${escapeHtml(String(props.contentWidth || 940))}px;margin:0 auto;overflow:hidden;">
          <h1 style="margin:0 0 16px;${typographyCss(props, "heading")}word-break:break-word;overflow-wrap:anywhere;">${inlineRichTextToHtml(props.headlineBlock?.content ?? props.headline ?? "Your headline")}</h1>
          <div style="${typographyCss(props, "body")}word-break:break-word;overflow-wrap:anywhere;">${richTextToHtml(props.bodyBlock?.content ?? props.subheadline ?? "Describe what this page offers.")}</div>
          <a href="${escapeHtml(props.ctaLink || "#")}" style="display:inline-block;margin-top:18px;background:${props.buttonColor || "#ffffff"};color:${props.buttonTextColor || style.heroBg || "#1d4ed8"};padding:12px 18px;border-radius:999px;text-decoration:none;font-weight:700;">${escapeHtml(props.ctaText || "Get Started")}</a>
        </div>
      </section>`;
    case BlockTypes.TEXT:
      return `<section style="background:${props.backgroundColor || style.textBg || "#ffffff"};color:${props.textColor || style.textColor || "#0f172a"};${spacingCss(props)}">
        <div style="${sectionBase}${typographyCss(props, "body")}">${richTextToHtml(props.text || "Add your content here.")}</div>
      </section>`;
    case BlockTypes.IMAGE: {
      const stretch = props?.fullWidthBackground !== false;
      const imageSectionBase = stretch
        ? "width:100vw;max-width:100vw;margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw);padding:0;"
        : sectionBase;
      return `<section style="background:${style.textBg || "#ffffff"};"><div style="${imageSectionBase}"><img src="${escapeHtml(props.src || "https://placehold.co/1200x700/e2e8f0/0f172a?text=Image")}" alt="${escapeHtml(props.alt || "Image")}" style="width:100%;max-width:100%;height:${escapeHtml(props.height || "400px")};object-fit:cover;border-radius:${stretch ? "0" : "16px"};display:block;" />${props.caption ? `<p style="margin:12px 0 0;color:#64748b;padding:${stretch ? "0 24px" : "0"};">${escapeHtml(props.caption)}</p>` : ""}</div></section>`;
    }
    case BlockTypes.FEATURE_LIST: {
      const clamp = (value, fallback, min, max) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.round(parsed))) : fallback;
      };
      const desktop = clamp(props.cardsPerRowDesktop ?? (props.layout === "columns" ? 3 : 1), 3, 1, 6);
      const tablet = clamp(props.cardsPerRowTablet, Math.min(3, desktop), 1, 4);
      const mobile = clamp(props.cardsPerRowMobile, 1, 1, 2);
      const hGap = clamp(props.horizontalGap, 18, 0, 80);
      const vGap = clamp(props.verticalGap, 18, 0, 80);
      const customWidth = clamp(props.customCardWidth || props.featureCardWidth, 320, 160, 900);
      const align = String(props.horizontalAlignment || "stretch");
      const justify = align === "left" ? "start" : align === "right" ? "end" : align === "center" ? "center" : "stretch";
      const gridColumns = String(props.cardSize || "auto") === "custom"
        ? (align === "stretch" ? `repeat(auto-fit,minmax(min(100%,${customWidth}px),1fr))` : `repeat(auto-fit,minmax(min(100%,${customWidth}px),${customWidth}px))`)
        : "repeat(var(--wb-list-columns),minmax(0,1fr))";
      const contentWidthValue = String(props.contentMaxWidth || "").toLowerCase();
      const contentMaxWidth = contentWidthValue === "full" ? "none" : Number(props.contentMaxWidth) > 0 ? `${Math.max(320, Number(props.contentMaxWidth))}px` : String(props.sectionWidth || "boxed") === "full" ? "none" : String(props.sectionWidth || "boxed") === "wide" ? "1600px" : "1200px";
      const sectionStretch = props.fullWidthBackground === true ? "width:100vw;max-width:100vw;margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw);" : "width:100%;";
      const scope = `wb-list-${String(block?.id || block?.uid || "feature-list").replace(/[^a-zA-Z0-9_-]/g, "")}`;
      const mode = String(props.cardHeightMode || "auto");
      const cardHeight = clamp(props.featureCardHeight, 0, 0, 1600);
      const cardHeightCss = mode === "equal" ? "height:100%;" : mode === "min" && cardHeight > 0 ? `min-height:${cardHeight}px;` : mode === "max" && cardHeight > 0 ? `max-height:${cardHeight}px;overflow:hidden;` : "";
      const featureItems = asArray(props.items).map((item, idx) => {
        const isObject = item && typeof item === "object";
        const title = isObject ? (item.title || item.heading || `Feature ${idx + 1}`) : String(item || "");
        const body = isObject ? (item.body || item.text || item.content || "") : "";
        const image = isObject ? (item.image || item.src || "") : "";
        const featureMarker = props.bulletStyle === "number" ? `${idx + 1}.` : props.bulletStyle === "disc" ? "&bull;" : "✓";
        return `<article style="display:flex;flex-direction:column;gap:14px;padding:18px;border-radius:22px;background:${escapeHtml(props.itemBackgroundColor || "#eff6ff")};border:1px solid ${escapeHtml(props.borderColor || "#dbeafe")};box-shadow:0 18px 42px rgba(15,23,42,0.16);min-height:100%;box-sizing:border-box;${cardHeightCss}">
          ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(htmlToPlainText(title))}" style="width:100%;height:180px;object-fit:cover;border-radius:16px;display:block;" />` : ""}
          <div style="display:flex;gap:10px;align-items:flex-start;">
            <span style="font-weight:900;color:${escapeHtml(props.accentColor || "#38bdf8")};">${featureMarker}</span>
            <div><h3 style="margin:0 0 8px;font-size:22px;line-height:1.22;color:${escapeHtml(props.textColor || style.textColor || "#0f172a")};">${inlineRichTextToHtml(title)}</h3>${body ? `<div style="color:${escapeHtml(props.textColor || style.textColor || "#0f172a")};opacity:.82;line-height:1.65;">${richTextToHtml(body)}</div>` : ""}</div>
          </div>
        </article>`;
      }).join("");
      return `<section style="${sectionStretch}background:${escapeHtml(props.backgroundColor || style.textBg || "#ffffff")};color:${escapeHtml(props.textColor || style.textColor || "#0f172a")};${spacingCss(props)}"><style>.${scope}{--wb-list-columns:${desktop};}@media(max-width:1024px){.${scope}{--wb-list-columns:${tablet};}}@media(max-width:640px){.${scope}{--wb-list-columns:${mobile};}}</style><div style="max-width:${contentMaxWidth};margin:0 auto;padding:56px 20px;box-sizing:border-box;"><h2 style="margin:0 0 24px;font-size:34px;text-align:${escapeHtml(props.headingAlign || props.headlineAlignment || props.alignment || "left")};">${richTextToHtml(props.title || "Features")}</h2><div class="${scope}" style="display:grid;grid-template-columns:${gridColumns};column-gap:${hGap}px;row-gap:${vGap}px;justify-content:${justify};${align === "stretch" ? "justify-items:stretch;" : ""}align-items:${mode === "equal" ? "stretch" : "start"};">${featureItems}</div></div></section>`;
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
      return `<section style="background:${variantTheme.sectionBg};${spacingCss(props)}"><div style="${sectionBase}"><h2 style="margin:0 0 18px;${typographyCss(props, "heading")}">${richTextToHtml(props.title || "Pricing")}</h2><div style="display:grid;grid-template-columns:repeat(${Math.max(1, asArray(props.plans).length)} ,minmax(0,${pricingCardWidth}px));gap:${pricingCardGap}px;align-items:center;justify-content:center;">${plans}</div></div></section>`;
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
            return `<div style="position:absolute;left:${Number(img?.x || 0)}px;top:${Number(img?.y || 0)}px;width:${Number(img?.width || 360)}px;height:${Number(img?.height || 140)}px;display:flex;flex-direction:column;align-items:stretch;justify-content:${justify};text-align:${align};padding:12px;overflow:hidden;transform:rotate(${Number(img?.rotation || 0)}deg);z-index:${Number(img?.zIndex || idx + 1)};color:${escapeHtml(img?.textColor || "#ffffff")};font-size:${Number(img?.fontSize || 40)}px;font-weight:${escapeHtml(String(img?.fontWeight || "700"))};background:${escapeHtml(img?.background || "transparent")};">${richTextToHtml(img?.content || "Headline Text")}</div>`;
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
      return `<section style="background:${escapeHtml(props.backgroundColor || style.textBg || "#ffffff")};color:${escapeHtml(props.textColor || style.textColor || "#0f172a")};${spacingCss(props)}"><div style="${sectionBase}">${props.title ? `<h2 style="margin:0 0 18px;font-size:34px;">${inlineRichTextToHtml(props.title)}</h2>` : ""}<div style="display:grid;grid-template-columns:${grid};gap:16px;"><div style="padding:18px;border-radius:18px;background:${escapeHtml(props.cardBackgroundColor || "#f8fafc")};border:1px solid ${escapeHtml(props.borderColor || "#dbeafe")};">${leftImage}<h3 style="margin:0 0 8px;">${inlineRichTextToHtml(props.leftTitle || "Left Column")}</h3><div>${richTextToHtml(props.leftContent || "")}</div></div><div style="padding:18px;border-radius:18px;background:${escapeHtml(props.cardBackgroundColor || "#f8fafc")};border:1px solid ${escapeHtml(props.borderColor || "#dbeafe")};">${rightImage}<h3 style="margin:0 0 8px;">${inlineRichTextToHtml(props.rightTitle || "Right Column")}</h3><div>${richTextToHtml(props.rightContent || "")}</div></div></div></div></section>`;
    }
    case BlockTypes.COLUMNS_3: {
      const renderCol = (title, image, content) => `<div style="padding:18px;border-radius:18px;background:${escapeHtml(props.cardBackgroundColor || "#f8fafc")};border:1px solid ${escapeHtml(props.borderColor || "#dbeafe")};">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(htmlToPlainText(title || "Column"))}" style="width:100%;border-radius:14px;object-fit:cover;margin:0 0 12px;" />` : ""}<h3 style="margin:0 0 8px;">${inlineRichTextToHtml(title || "Column")}</h3><div>${richTextToHtml(content || "")}</div></div>`;
      return `<section style="background:${escapeHtml(props.backgroundColor || style.textBg || "#ffffff")};color:${escapeHtml(props.textColor || style.textColor || "#0f172a")};"><div style="${sectionBase}">${props.title ? `<h2 style="margin:0 0 18px;font-size:34px;">${escapeHtml(props.title)}</h2>` : ""}<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;">${renderCol(props.column1Title, props.column1Image, props.column1)}${renderCol(props.column2Title, props.column2Image, props.column2)}${renderCol(props.column3Title, props.column3Image, props.column3)}</div></div></section>`;
    }
    case BlockTypes.FAQ: {
      const items = asArray(props.items).map((item) => `<details style="padding:14px 0;border-bottom:1px solid #e2e8f0;"><summary style="cursor:pointer;font-weight:${escapeHtml(String(props.questionFontWeight || "inherit"))};">${richTextToHtml(item?.q || item?.question || "Question")}</summary><div style="margin:10px 0 0;color:#475569;">${richTextToHtml(item?.a || item?.answer || "Answer")}</div></details>`).join("");
      return `<section style="background:${style.textBg || "#ffffff"};"><div style="${sectionBase};max-width:820px;"><h2 style="margin:0 0 18px;font-size:34px;">${richTextToHtml(props.title || "FAQ")}</h2>${items}</div></section>`;
    }
    case BlockTypes.CTA_BUTTON:
      return `<section style="background:${escapeHtml(props.backgroundColor || style.textBg || "#ffffff")};color:${escapeHtml(props.textColor || style.textColor || "#0f172a")};${spacingCss(props)}"><div style="${sectionBase};text-align:${escapeHtml(props.alignment || "center")};"><div style="max-width:820px;margin:0 auto;padding:${props.style === "stacked-card" ? "34px" : "0"};border-radius:28px;border:${props.style === "stacked-card" ? `1px solid ${escapeHtml(props.borderColor || "rgba(255,255,255,0.18)")}` : "0"};background:${props.style === "stacked-card" ? "rgba(255,255,255,0.08)" : "transparent"};">${props.eyebrow ? `<div style="margin:0 0 10px;font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;opacity:.76;">${inlineRichTextToHtml(props.eyebrow)}</div>` : ""}${props.title ? `<h2 style="margin:0 0 12px;font-size:38px;line-height:1.12;">${inlineRichTextToHtml(props.title)}</h2>` : ""}${props.description ? `<div style="margin:0 auto 22px;max-width:680px;line-height:1.65;opacity:.84;">${richTextToHtml(props.description)}</div>` : ""}<a href="${escapeHtml(props.link || "#")}" style="display:inline-flex;align-items:center;justify-content:center;min-height:48px;background:${escapeHtml(props.buttonColor || "#0f172a")};color:${escapeHtml(props.buttonTextColor || "#ffffff")};text-decoration:none;border-radius:999px;padding:12px 20px;font-weight:800;">${inlineRichTextToHtml(props.text || "Get Started")}</a>${props.note ? `<div style="margin-top:14px;font-size:14px;opacity:.72;">${richTextToHtml(props.note)}</div>` : ""}</div></div></section>`;
    case BlockTypes.STATS: {
      const statItems = asArray(props.stats || props.items).map((item) => `<div style="flex:1 1 220px;padding:20px;border-radius:20px;background:${escapeHtml(props.cardBackgroundColor || "rgba(255,255,255,0.9)")};border:1px solid ${escapeHtml(props.borderColor || "rgba(226,232,240,0.92)")};box-sizing:border-box;"><div style="font-size:30px;font-weight:900;color:${escapeHtml(props.accentColor || props.textColor || "#0f172a")};">${richTextToHtml(item?.number || item?.value || "0")}</div><div style="margin-top:8px;font-weight:800;color:${escapeHtml(props.textColor || "#0f172a")};">${richTextToHtml(item?.label || "Metric")}</div>${item?.detail ? `<div style="margin-top:8px;line-height:1.55;color:${escapeHtml(props.textColor || "#475569")};opacity:.78;">${richTextToHtml(item.detail)}</div>` : ""}</div>`).join("");
      return `<section style="background:${escapeHtml(props.backgroundColor || style.textBg || "#ffffff")};color:${escapeHtml(props.textColor || style.textColor || "#0f172a")};${spacingCss(props)}"><div style="${sectionBase}">${props.title ? `<h2 style="margin:0 0 12px;font-size:34px;text-align:center;">${richTextToHtml(props.title)}</h2>` : ""}${props.subtitle ? `<div style="margin:0 auto 24px;max-width:760px;text-align:center;line-height:1.65;opacity:.82;">${richTextToHtml(props.subtitle)}</div>` : ""}<div style="display:flex;gap:16px;flex-wrap:wrap;">${statItems}</div></div></section>`;
    }
    case BlockTypes.SPACE: {
      const spStyle = props.backgroundStyle;
      const spBg =
        spStyle === "color"    ? (props.backgroundColor  || "transparent") :
        spStyle === "gradient" ? (props.backgroundGradient || "transparent") :
        spStyle === "image" && props.backgroundImage
          ? `url(${JSON.stringify(escapeHtml(props.backgroundImage))})`
          : "transparent";
      const spBgExtra = spStyle === "image" && props.backgroundImage
        ? `;background-size:${escapeHtml(props.backgroundSize || "cover")};background-position:${escapeHtml(props.backgroundPosition || "center center")};background-repeat:no-repeat`
        : "";
      const spacerMaxWidth = props.fullWidthBackground === true ? "none" : `${Math.max(320, Number(props.baseLayoutWidth || 1120))}px`;
      const spacerMargin = props.fullWidthBackground === true ? "0" : "0 auto";
      return `<div style="height:${escapeHtml(props.height || "40px")};width:100%;max-width:${spacerMaxWidth};margin:${spacerMargin};box-sizing:border-box;background:${spBg}${spBgExtra};"></div>`;
    }
    case BlockTypes.DIVIDER: {
      const legacyStyle = String(props.style || "").toLowerCase();
      const dividerType = String(props.dividerType || (legacyStyle === "dots" ? "decorative" : "line")).toLowerCase();
      const lineStyle = String(props.lineStyle || (legacyStyle === "dashes" ? "dashed" : legacyStyle === "dots" ? "dotted" : "solid")).toLowerCase();
      const thickness = Math.max(1, Math.min(24, Number(props.thickness || 1)));
      const width = Math.max(5, Math.min(100, Number(props.width || 100)));
      const align = String(props.alignment || "center");
      const justify = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
      const color = escapeHtml(props.color || "#cbd5e1");
      const secondaryColor = escapeHtml(props.secondaryColor || props.color || "#38bdf8");
      const background = escapeHtml(props.backgroundColor || "transparent");
      const label = String(props.label || "").trim();
      const showLabel = !!props.showLabel && label;
      const labelColor = escapeHtml(props.labelColor || "#64748b");
      const paddingTop = Math.max(0, Math.min(240, Number(props.paddingTop ?? 24)));
      const paddingBottom = Math.max(0, Math.min(240, Number(props.paddingBottom ?? 24)));
      const maxWidth = props.fullWidthBackground === true ? "none" : `${Math.max(320, Number(props.baseLayoutWidth || 1120))}px`;
      const borderStyle = lineStyle === "double" ? "double" : lineStyle === "dotted" ? "dotted" : lineStyle === "dashed" ? "dashed" : "solid";
      const lineCss = dividerType === "gradient"
        ? `height:${thickness}px;border-radius:999px;background:linear-gradient(90deg, transparent, ${color}, ${secondaryColor}, transparent);`
        : dividerType === "decorative"
          ? `height:${thickness}px;background-image:radial-gradient(circle, ${color} ${Math.max(1, Math.ceil(thickness / 2))}px, transparent ${Math.max(2, Math.ceil(thickness / 2) + 1)}px);background-size:${Math.max(10, thickness * 5)}px ${Math.max(4, thickness)}px;background-repeat:repeat-x;background-position:center;`
          : `border-top:${thickness}px ${borderStyle} ${color};`;
      const lineSpan = `<span style="display:block;width:${showLabel ? "100" : width}%;max-width:100%;min-width:24px;box-sizing:border-box;${lineCss}"></span>`;
      const inner = showLabel
        ? `<div style="display:grid;grid-template-columns:minmax(24px,1fr) auto minmax(24px,1fr);align-items:center;gap:12px;width:${width}%;max-width:100%;">${lineSpan}<span style="color:${labelColor};font-size:14px;font-weight:700;letter-spacing:0;white-space:nowrap;">${escapeHtml(label)}</span>${lineSpan}</div>`
        : lineSpan;
      return `<section style="background:${background};padding:${paddingTop}px 32px ${paddingBottom}px;box-sizing:border-box;width:100%;max-width:${maxWidth};margin-left:auto;margin-right:auto;"><div style="width:100%;max-width:${Math.max(320, Number(props.baseLayoutWidth || 1120))}px;margin:0 auto;display:flex;justify-content:${justify};box-sizing:border-box;">${inner}</div></section>`;
    }
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

const CURRENT_PLATFORM_PRICING = {
  starter: {
    price: "$79",
    individualPrice: "$215",
    description: "For solo operators and small teams just getting started.",
    features: ["Team Seats — 2 users", "CRM Pipelines — 1", "Communities — 1", "Social Profiles — 3", "Automation Workflows — 5", "Calendar & Bookings", "Shared Phone Number", "Marketplace Access", "Reporting — Email & CRM stats", "Support — Email"],
    extras: ["14 days free, then 50% off first 3 months", "Email contacts — 5,000", "Email sends/mo — 50,000", "SMS credits/mo — 500", "Websites — 1", "Funnels — Landing pages only", "Projects Hub — 3 jobs · 5 projects · 2 users", "AI credits/mo — 50", "Storage — 5 GB"],
    billingPrice: 79,
    chartIndividualPrice: 215,
  },
  growth: {
    price: "$249",
    individualPrice: "$474",
    description: "For growing teams scaling sales and marketing operations.",
    features: ["Team Seats — 5 users", "CRM Pipelines — 3", "Communities — 3", "Social Profiles — 7", "Automation Workflows — 8", "SMS Scheduled Campaigns — 3", "Call Recording & AI Transcription", "Calendar & Bookings", "Shared Phone Number", "Affiliate Management", "Reporting — Email, SMS & Call Analytics", "Support — Priority Email"],
    extras: ["14 days free, then 50% off first 3 months", "Email contacts — 15,000", "Email sends/mo — 150,000", "SMS credits/mo — 2,500", "Websites — 2", "Funnels — 1 (+ extras at cost)", "Projects Hub — 15 jobs · 20 projects · dependencies", "AI credits/mo — 250", "Storage — 25 GB"],
    billingPrice: 249,
    chartIndividualPrice: 474,
  },
  scale: {
    price: "$399",
    individualPrice: "$913",
    description: "For established businesses scaling teams and operations.",
    features: ["Team Seats — 10 users", "CRM Pipelines — 10", "Communities — Unlimited", "Social Profiles — 15", "Automation Workflows — 10", "SMS Scheduled Campaigns — 10", "AI Transcription + Sentiment", "AI Website Builder", "Shared Phone Number", "Reporting — Full Analytics + CSV export", "Support — Dedicated Onboarding"],
    extras: ["14 days free, then 50% off first 3 months", "Email contacts — 40,000", "Email sends/mo — 400,000", "SMS credits/mo — 5,000", "Websites — 3", "Funnels — 3 (+ extras at cost)", "Projects Hub — Unlimited jobs & projects · resource allocation · critical path", "AI credits/mo — 750", "Storage — 100 GB"],
    billingPrice: 399,
    chartIndividualPrice: 913,
  },
  professional: {
    price: "$799",
    individualPrice: "$1883",
    description: "Complete business OS for large businesses with bigger teams, higher turnover, and advanced support needs.",
    features: ["Team Seats — Up to 25 users", "CRM Pipelines — Unlimited", "Communities — Unlimited", "Social Profiles — Unlimited", "Automation Workflows — Unlimited", "AI Call Transcription & Sentiment", "AI Content & Post Generation", "Shared Phone Number", "Reporting — Full Analytics + Scheduled Reports", "Support — Account Manager + SLA"],
    extras: ["14 days free trial", "Email contacts — 200,000", "Email sends/mo — 2,000,000", "SMS credits/mo — 10,000", "Websites — 5", "Funnels — 10 (+ extras at cost)", "Projects Hub — Unlimited · API", "AI credits/mo — 5,000", "Storage — 500 GB"],
    billingPrice: 799,
    chartIndividualPrice: 1883,
  },
};

const SHARED_PLATFORM_PRICING = Object.fromEntries(
  getPlatformPricingTablePlans().map((plan) => [
    platformPlanKey(plan.name),
    {
      price: plan.price,
      individualPrice: plan.individualPrice,
      description: plan.description,
      features: plan.features,
      extras: plan.extras,
      billingPrice: Number(String(plan.price || "").replace(/[^0-9.]/g, "")) || 0,
      chartIndividualPrice: Number(String(plan.individualPrice || "").replace(/[^0-9.]/g, "")) || 0,
    },
  ])
);

const CURRENT_PLATFORM_SAVINGS_HEADLINE = '<span style="color: rgb(255, 192, 0);"><span style="font-size: 64px;">Replace Multiple Expensive Subscriptions &amp; Save Up To $10,600 Per Year</span></span>';
const CURRENT_PLATFORM_PRICING_TITLE = 'Our Pricing Plans - Save up to $10,600 per year on your subscription costs<div><span style="color: rgb(255, 192, 0);">That\'s $10,600 back in your bank, not wasted on multiple platforms that do not do what you need. Our platform is designed to help you scale your business to new heights.</span></div>';

function platformPlanKey(name) {
  return String(name || "").toLowerCase().replace(/ plan$/, "").trim();
}

function isPlatformPricingPageName(pageName) {
  return slugify(String(pageName || "")) === "pricing";
}

function syncPlatformPricingBlocks(blocks) {
  if (!Array.isArray(blocks)) return blocks;

  return blocks.map((block) => {
    if (!block || typeof block !== "object") return block;
    const props = { ...(block.props || {}) };

    if (block.type === "hero") {
      const headline = String(props.headline || props.headlineBlock?.content || "");
      if (/Save Up To \$?(9,900|10,600)/i.test(headline)) {
        props.headline = CURRENT_PLATFORM_SAVINGS_HEADLINE;
        props.headlineBlock = { ...(props.headlineBlock || {}), content: CURRENT_PLATFORM_SAVINGS_HEADLINE };
      }
    }

    if (block.type === "pricing-table") {
      const plans = Array.isArray(props.plans) ? props.plans : [];
      const isPlatformPricingTable = plans.some((plan) => SHARED_PLATFORM_PRICING[platformPlanKey(plan?.name)]);
      if (isPlatformPricingTable) {
        props.title = CURRENT_PLATFORM_PRICING_TITLE;
        props.plans = plans.map((plan) => {
          const current = SHARED_PLATFORM_PRICING[platformPlanKey(plan?.name)];
          if (!current) return plan;
          return {
            ...plan,
            price: current.price,
            individualPrice: current.individualPrice,
            description: current.description,
            features: current.features,
            includedFeatures: current.features,
            extras: current.extras,
          };
        });
      }
    }

    if (block.type === "chart") {
      const plans = Array.isArray(props.plans) ? props.plans : [];
      const isPlatformChart = plans.some((plan) => SHARED_PLATFORM_PRICING[platformPlanKey(plan?.name)]);
      if (isPlatformChart) {
        props.headline = CURRENT_PLATFORM_SAVINGS_HEADLINE;
        props.headlineBlock = { ...(props.headlineBlock || {}), content: CURRENT_PLATFORM_SAVINGS_HEADLINE };
        props.plans = plans.map((plan) => {
          const current = SHARED_PLATFORM_PRICING[platformPlanKey(plan?.name)];
          if (!current) return plan;
          return {
            ...plan,
            billingPrice: current.billingPrice,
            individualPrice: current.chartIndividualPrice,
          };
        });
      }
    }

    return { ...block, props };
  });
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
    Object.entries(pageBlocksSource).map(([pageName, blocks]) => {
      const normalizedBlocks = normalizeStoredBlockList(blocks, { project: normalizationProject });
      return [pageName, normalizedBlocks];
    })
  );
  const templateOverride = project?.templateSlug ? getWebsiteTemplateOverride(project.templateSlug) : null;
  const baseProject = {
    ...project,
    globalNavBlock: normalizeStoredBlock(project?.globalNavBlock || templateOverride?.globalNavBlock || null, { project: normalizationProject }),
    globalFooterBlock: normalizeStoredBlock(project?.globalFooterBlock || templateOverride?.globalFooterBlock || null, { project: normalizationProject }),
  };
  const globalBlockPatch = normalizeGlobalBlocks(baseProject);
  const globalNavBlock = "globalNavBlock" in globalBlockPatch ? globalBlockPatch.globalNavBlock : (baseProject.globalNavBlock || null);
  const globalFooterBlock = "globalFooterBlock" in globalBlockPatch ? globalBlockPatch.globalFooterBlock : (baseProject.globalFooterBlock || null);

  seedProjectAssets(project, pageBlocks, { globalNavBlock, globalFooterBlock });

  (Array.isArray(project?.pages) ? project.pages : []).forEach((page) => {
    if (!page?.name) return;

    const current = String(pagesContent[page.name] || "").trim();
    if (current) return;

    const blocksForPage = Array.isArray(pageBlocks?.[page.name]) ? pageBlocks[page.name] : [];
    if (blocksForPage.length) {
      pagesContent[page.name] = "";
      return;
    }

    if (project?.mode === "blank" && !blocksForPage.length) {
      if (!(page.name in pagesContent)) pagesContent[page.name] = "";
      return;
    }

    pagesContent[page.name] = buildInitialPageHtml(project, page, blocksForPage);
  });

  return { pagesContent, pageBlocks, ...globalBlockPatch };
}

function importLegacyWebsiteProjects(currentProjects) {
  if (!hasWindow()) return currentProjects;
  if (window.localStorage.getItem(LEGACY_IMPORT_MARKER_KEY)) return currentProjects;

  const rawLegacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!rawLegacy) return currentProjects;

  const parsedLegacy = safeParse(rawLegacy);
  const legacyProjects = Array.isArray(parsedLegacy)
    ? parsedLegacy.map((project) => normalizeIncomingWebsiteProject(project)).filter(Boolean)
    : [];

  window.localStorage.setItem(LEGACY_IMPORT_MARKER_KEY, "1");

  if (!legacyProjects.length) return currentProjects;

  const merged = new Map();
  [...currentProjects, ...legacyProjects]
    .sort(compareProjectUpdatedAtDesc)
    .forEach((project) => {
      const id = String(project?.id || "").trim();
      if (!id || merged.has(id)) return;
      merged.set(id, project);
    });

  const nextProjects = Array.from(merged.values()).sort(compareProjectUpdatedAtDesc);

  if (JSON.stringify(currentProjects) !== JSON.stringify(nextProjects)) {
    saveWebsiteProjects(nextProjects);
  }

  return nextProjects;
}

export function listWebsiteProjects(options = {}) {
  if (!hasWindow()) return [];
  const projects = importLegacyWebsiteProjects(readWebsiteProjectsFromStorage());
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

function saveProjectBackup(project) {
  if (!hasWindow() || !project?.id) return;
  try {
    const raw = window.localStorage.getItem(BACKUP_STORAGE_KEY);
    const backups = raw ? JSON.parse(raw) : {};
    backups[String(project.id)] = { project, savedAt: new Date().toISOString() };
    window.localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(backups));
  } catch {
    // Backup is best-effort; never throw
  }
}

export function restoreWebsiteProjectFromBackup(projectId) {
  if (!hasWindow()) return null;
  try {
    const raw = window.localStorage.getItem(BACKUP_STORAGE_KEY);
    if (!raw) return null;
    const backups = JSON.parse(raw);
    return backups[String(projectId)]?.project || null;
  } catch {
    return null;
  }
}

// Sentinel returned when every localStorage attempt fails due to quota.
// Callers can check `=== "quota"` to trigger an emergency server sync.
export const SAVE_RESULT_QUOTA_EXCEEDED = "quota";

export function saveWebsiteProjects(projects) {
  if (!hasWindow()) return false;

  const primary = normalizeProjectsForStorage(projects);

  try {
    writeWebsiteProjectsToStorage(primary);
    return true;
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      console.warn("Could not save website projects.", error);
      return false;
    }

    try {
      const compact = normalizeProjectsForStorage(projects, { compact: true });
      writeWebsiteProjectsToStorage(compact);
      return true;
    } catch {
      try {
        const emergency = normalizeProjectsForStorage(projects, { compact: true }).slice(0, 3);
        writeWebsiteProjectsToStorage(emergency);
        return true;
      } catch (finalError) {
        // Storage completely full — caller must handle this by syncing to the server
        console.warn("Website project storage is full; triggering emergency server sync.", finalError);
        return SAVE_RESULT_QUOTA_EXCEEDED;
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

  if (input?.brandAssets) {
    const mergedAssets = mergeWebsiteBuilderAssetSources(getWebsiteBuilderAssets(), input.brandAssets);
    saveWebsiteBuilderAssets(mergedAssets);
  }

  const baseProject = {
    id,
    name: input?.name || "New Website Project",
    mode: input?.mode || "ai",
    buildType: input?.buildType || "website",
    stylePack: input?.stylePack || input?.brief?.stylePack || input?.brief?.importStylePack || "executive",
    templateSlug: input?.templateSlug || "",
    status: input?.status || "draft",
    brief: input?.brief || {},
    pages: normalizeProjectPages(input?.pages, input?.templateSlug || ""),
    copyAngles: Array.isArray(input?.copyAngles) ? input.copyAngles : [],
    createdAt: now,
    updatedAt: now,
    pagesContent: cleanPageMap(input?.pagesContent || {}),
    pageBlocks: cleanPageMap(input?.pageBlocks || {}),
    chaiData: cleanPageMap(input?.chaiData || {}),
    globalNavBlock: input?.globalNavBlock || null,
    globalFooterBlock: input?.globalFooterBlock || null,
  };

  const prepared = prepareProjectContent(baseProject);
  const project = {
    ...baseProject,
    pagesContent: prepared.pagesContent,
    pageBlocks: prepared.pageBlocks,
    ...("globalNavBlock" in prepared ? { globalNavBlock: prepared.globalNavBlock } : {}),
    ...("globalFooterBlock" in prepared ? { globalFooterBlock: prepared.globalFooterBlock } : {}),
  };

  const projects = listWebsiteProjects({ includeUnsaved: true });
  projects.unshift(project);
  saveWebsiteProjects(projects);
  return project;
}

export function cacheWebsiteProject(project, options = {}) {
  const normalized = normalizeIncomingWebsiteProject(project);
  if (!normalized) return null;

  const includeUnsaved = options?.includeUnsaved !== false;
  const onlyIfNewer = options?.onlyIfNewer !== false;
  const projects = listWebsiteProjects({ includeUnsaved });
  const nextProjects = [];

  for (const entry of projects) {
    if (String(entry?.id || "") !== String(normalized.id)) {
      nextProjects.push(entry);
      continue;
    }

    const incomingPageCount = Array.isArray(normalized.pages) ? normalized.pages.length : 0;
    const existingPageCount = Array.isArray(entry?.pages) ? entry.pages.length : 0;
    if (incomingPageCount <= 1 && existingPageCount > 1) {
      const incomingPageName = normalized.pages?.[0]?.name || "";
      const merged = {
        ...entry,
        updatedAt: normalized.updatedAt || entry.updatedAt,
        pageBlocks: incomingPageName
          ? { ...(entry.pageBlocks || {}), ...(normalized.pageBlocks?.[incomingPageName] ? { [incomingPageName]: normalized.pageBlocks[incomingPageName] } : {}) }
          : entry.pageBlocks,
        pagesContent: incomingPageName
          ? { ...(entry.pagesContent || {}), ...(Object.prototype.hasOwnProperty.call(normalized.pagesContent || {}, incomingPageName) ? { [incomingPageName]: normalized.pagesContent[incomingPageName] || "" } : {}) }
          : entry.pagesContent,
        chaiData: incomingPageName
          ? { ...(entry.chaiData || {}), ...(normalized.chaiData?.[incomingPageName] ? { [incomingPageName]: normalized.chaiData[incomingPageName] } : {}) }
          : entry.chaiData,
        globalNavBlock: "globalNavBlock" in normalized ? normalized.globalNavBlock : entry.globalNavBlock,
        globalFooterBlock: "globalFooterBlock" in normalized ? normalized.globalFooterBlock : entry.globalFooterBlock,
      };
      nextProjects.push(merged);
      saveWebsiteProjects(nextProjects.concat(projects.filter((item) => !nextProjects.includes(item) && String(item?.id || "") !== String(normalized.id))).sort(compareProjectUpdatedAtDesc));
      return merged;
    }

    if (onlyIfNewer) {
      const localUpdatedAt = Date.parse(entry?.updatedAt || entry?.createdAt || 0) || 0;
      const incomingUpdatedAt = Date.parse(normalized?.updatedAt || normalized?.createdAt || 0) || 0;
      if (localUpdatedAt > incomingUpdatedAt) {
        nextProjects.push(entry);
        saveWebsiteProjects(nextProjects.concat(projects.filter((item) => !nextProjects.includes(item) && String(item?.id || "") !== String(normalized.id))).sort(compareProjectUpdatedAtDesc));
        return entry;
      }
      // Server is newer and about to overwrite local — save local as backup first
      saveProjectBackup(entry);
    }
  }

  nextProjects.push(normalized);
  for (const entry of projects) {
    if (String(entry?.id || "") === String(normalized.id)) continue;
    if (nextProjects.includes(entry)) continue;
    nextProjects.push(entry);
  }

  nextProjects.sort(compareProjectUpdatedAtDesc);
  saveWebsiteProjects(nextProjects);
  return nextProjects.find((entry) => String(entry?.id || "") === String(normalized.id)) || normalized;
}

export function cacheWebsiteProjects(projects, options = {}) {
  if (!Array.isArray(projects) || !projects.length) {
    return listWebsiteProjects({ includeUnsaved: options?.includeUnsaved !== false });
  }

  const includeUnsaved = options?.includeUnsaved !== false;
  const onlyIfNewer = options?.onlyIfNewer !== false;
  // When replaceAll is true the server list is authoritative for *existence* —
  // stale local drafts that were deleted on the server will not be re-merged.
  // However we still need to protect locally-newer edits from being overwritten
  // by an older server snapshot (e.g. a sync that hasn't completed yet).
  const replaceAll = options?.replaceAll === true;
  const merged = new Map();

  // Always build a local lookup map so we can compare timestamps even in
  // replaceAll mode. In non-replaceAll mode it also seeds the merged result.
  const localById = new Map();
  listWebsiteProjects({ includeUnsaved }).forEach((project) => {
    if (!project?.id) return;
    localById.set(String(project.id), project);
    if (!replaceAll) {
      merged.set(String(project.id), project);
    }
  });

  projects.forEach((project) => {
    const normalized = normalizeIncomingWebsiteProject(project);
    if (!normalized?.id) return;

    const key = String(normalized.id);
    // In replaceAll mode `merged` has no local seed, so look up the local copy
    // separately for the recency check.
    const existing = merged.get(key) ?? (replaceAll ? localById.get(key) : undefined);
    if (existing && onlyIfNewer) {
      const localUpdatedAt = Date.parse(existing?.updatedAt || existing?.createdAt || 0) || 0;
      const incomingUpdatedAt = Date.parse(normalized?.updatedAt || normalized?.createdAt || 0) || 0;
      if (localUpdatedAt > incomingUpdatedAt) {
        // Local is newer — keep it even in replaceAll mode so unsaved edits
        // are not silently overwritten by a stale server snapshot.
        merged.set(key, existing);
        return;
      }
    }

    merged.set(key, normalized);
  });

  const nextProjects = Array.from(merged.values()).sort(compareProjectUpdatedAtDesc);
  saveWebsiteProjects(nextProjects);
  return nextProjects;
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
    ...("globalNavBlock" in prepared ? { globalNavBlock: prepared.globalNavBlock } : {}),
    ...("globalFooterBlock" in prepared ? { globalFooterBlock: prepared.globalFooterBlock } : {}),
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
    ...("globalNavBlock" in prepared ? { globalNavBlock: prepared.globalNavBlock } : {}),
    ...("globalFooterBlock" in prepared ? { globalFooterBlock: prepared.globalFooterBlock } : {}),
  };

  projects.splice(idx, 1);
  projects.unshift(normalizedNext);
  const saveResult = saveWebsiteProjects(projects);
  if (saveResult === SAVE_RESULT_QUOTA_EXCEEDED) {
    // Signal to the caller that local save failed — they must sync to server immediately
    const annotated = { ...normalizedNext, _localSaveFailed: true };
    return annotated;
  }
  return saveResult ? normalizedNext : null;
}

export function deleteWebsiteProject(id) {
  const projects = listWebsiteProjects({ includeUnsaved: true });
  const next = projects.filter((p) => String(p.id) !== String(id));
  saveWebsiteProjects(next);
}
