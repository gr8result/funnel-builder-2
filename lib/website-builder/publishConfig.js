import { normalizeWebsiteBuilderAssets } from "./mediaAssets";

function safeTrim(value) {
  return String(value || "").trim();
}

export function slugifyWebsiteValue(value) {
  return safeTrim(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 63);
}

export function normalizeDomain(value) {
  return safeTrim(value)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

export function getAppBaseUrl() {
  return safeTrim(process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_BASE_URL || getPlatformAppUrl());
}

export function getPlatformAppUrl() {
  return safeTrim(
    process.env.NEXT_PUBLIC_PLATFORM_APP_URL
    || process.env.PLATFORM_APP_URL
    || "https://app.gr8result.digital"
  );
}

export function getPlatformAppHost() {
  try {
    return normalizeDomain(new URL(getPlatformAppUrl()).hostname);
  } catch {
    return normalizeDomain(getPlatformAppUrl());
  }
}

export function getPublishBaseUrl() {
  const explicit = safeTrim(
    process.env.NEXT_PUBLIC_WEBSITE_PUBLISH_BASE_URL
    || process.env.WEBSITE_PUBLISH_BASE_URL
    || process.env.NEXT_PUBLIC_SITE_URL
    || process.env.SITE_PUBLISH_BASE_URL
  );
  if (explicit) return explicit;

  const vercelHost = safeTrim(process.env.VERCEL_URL);
  if (vercelHost) {
    return vercelHost.startsWith("http") ? vercelHost : `https://${vercelHost}`;
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }

  return getAppBaseUrl();
}

export function getAppHost() {
  try {
    return normalizeDomain(new URL(getAppBaseUrl()).hostname);
  } catch {
    return normalizeDomain(getAppBaseUrl());
  }
}

export function getPublishHost() {
  try {
    return normalizeDomain(new URL(getPublishBaseUrl()).hostname);
  } catch {
    return normalizeDomain(getPublishBaseUrl());
  }
}

export function getSiteRootDomain() {
  const explicitRoot = normalizeDomain(process.env.WEBSITE_ROOT_DOMAIN || process.env.NEXT_PUBLIC_WEBSITE_ROOT_DOMAIN);
  if (explicitRoot) return explicitRoot.replace(/^www\./, "");

  return "";
}

export function getCustomDomainTargetHost() {
  return normalizeDomain(process.env.WEBSITE_CNAME_TARGET || process.env.NEXT_PUBLIC_WEBSITE_CNAME_TARGET || getPublishHost());
}

export function buildDefaultSiteDomain(slug) {
  const safeSlug = slugifyWebsiteValue(slug || "site");
  const rootDomain = getSiteRootDomain();
  if (!safeSlug || !rootDomain) return "";
  return `${safeSlug}.${rootDomain}`;
}

export function buildWebsitePath(slug) {
  return `/sites/${slugifyWebsiteValue(slug || "site")}`;
}

export function buildHostedWebsiteUrl({ slug, protocol = "https" }) {
  const baseUrl = getPublishBaseUrl().replace(/\/$/, "");
  return `${baseUrl}${buildWebsitePath(slug)}`;
}

export function buildWebsiteDomainUrl({ domain, protocol = "https" }) {
  const safeDomain = normalizeDomain(domain);
  if (!safeDomain) return "";
  return `${protocol}://${safeDomain}`;
}

export function buildWebsiteUrl({ slug, domain, protocol = "https" }) {
  const safeDomain = normalizeDomain(domain);
  if (safeDomain && isLikelyCustomDomain(safeDomain)) {
    return buildWebsiteDomainUrl({ domain: safeDomain, protocol });
  }
  return buildHostedWebsiteUrl({ slug, protocol });
}

function normalizePublishedMediaUrl(value) {
  const raw = safeTrim(value);
  if (!raw || /^blob:/i.test(raw)) return "";
  if (/^(https?:|data:|\/\/)/i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${getAppBaseUrl().replace(/\/$/, "")}${raw}`;
  return raw;
}

const PUBLISHED_ASSET_FIELD_NAMES = new Set([
  "imageUrl",
  "iconUrl",
  "logoUrl",
  "avatarUrl",
  "mediaUrl",
  "src",
  "image",
  "iconImage",
  "backgroundImage",
  "floatingImage",
  "rightImage",
  "leftImage",
  "videoSrc",
  "videoUrl",
  "posterSrc",
  "posterUrl",
]);

function classifyPublishedAssetUrl(value) {
  const raw = safeTrim(value);
  if (!raw) return null;
  if (/^blob:/i.test(raw)) return "blob";
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i.test(raw)) return "localhost";
  if (/^https?:\/\//i.test(raw)) return null;
  if (/^\/\//.test(raw)) return null;
  if (/^data:image\//i.test(raw)) return null;
  if (/^data:/i.test(raw)) return "invalid";
  if (/^\//.test(raw)) return "relative";
  if (/\.(?:png|jpe?g|webp|gif|svg|avif|mp4|webm)(?:[?#].*)?$/i.test(raw)) return "relative";
  return null;
}

export function validatePublishedAssetUrls(siteData = {}) {
  const report = {
    generatedAt: new Date().toISOString(),
    invalidImageUrls: [],
    localhostUrls: [],
    blobUrls: [],
    relativeAssetUrls: [],
    missingPublicAssets: [],
    duplicateFallbackSubstitutions: [],
  };

  function add(kind, path, value) {
    const entry = { path, value: safeTrim(value) };
    if (kind === "blob") report.blobUrls.push(entry);
    else if (kind === "localhost") report.localhostUrls.push(entry);
    else if (kind === "relative") report.relativeAssetUrls.push(entry);
    else report.invalidImageUrls.push(entry);
  }

  function visit(value, path = "site_data") {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }

    if (!value || typeof value !== "object") return;

    Object.entries(value).forEach(([key, childValue]) => {
      const childPath = `${path}.${key}`;
      if (typeof childValue === "string" && PUBLISHED_ASSET_FIELD_NAMES.has(key)) {
        const kind = classifyPublishedAssetUrl(childValue);
        if (kind) add(kind, childPath, childValue);
      }
      if (key === "images" || key === "competitorIcons" || key === "featureIcons" || key === "logos") {
        visit(childValue, childPath);
        return;
      }
      if (childValue && typeof childValue === "object") visit(childValue, childPath);
    });
  }

  visit(siteData);
  report.summary = {
    invalidImageUrls: report.invalidImageUrls.length,
    localhostUrls: report.localhostUrls.length,
    blobUrls: report.blobUrls.length,
    relativeAssetUrls: report.relativeAssetUrls.length,
    missingPublicAssets: report.missingPublicAssets.length,
    duplicateFallbackSubstitutions: report.duplicateFallbackSubstitutions.length,
  };
  return report;
}

export function collectVideoHeroMedia(pageBlocks = {}) {
  const entries = [];
  const visitBlock = (block, pageName = "", index = -1, location = "page") => {
    if (!block || typeof block !== "object") return;
    if (String(block.type || "") === "video-hero") {
      const props = block.props || {};
      entries.push({
        location,
        pageName,
        index,
        id: block.id || "",
        videoSrc: safeTrim(props.videoSrc || props.videoUrl || props.videoURL || ""),
        posterSrc: safeTrim(props.posterSrc || props.posterUrl || props.posterURL || ""),
      });
    }
  };

  if (Array.isArray(pageBlocks)) {
    pageBlocks.forEach((block, index) => visitBlock(block, "", index));
    return entries;
  }

  if (pageBlocks && typeof pageBlocks === "object") {
    Object.entries(pageBlocks).forEach(([pageName, blocks]) => {
      (Array.isArray(blocks) ? blocks : []).forEach((block, index) => visitBlock(block, pageName, index));
    });
  }

  return entries;
}

export function normalizeVideoHeroBlocks(pageBlocks = {}) {
  const normalizeBlock = (block) => {
    if (!block || typeof block !== "object" || String(block.type || "") !== "video-hero") return block;
    const props = block.props || {};
    const videoSrc = normalizePublishedMediaUrl(props.videoSrc || props.videoUrl || props.videoURL || "");
    const posterSrc = normalizePublishedMediaUrl(props.posterSrc || props.posterUrl || props.posterURL || "");
    return {
      ...block,
      props: {
        ...props,
        videoSrc,
        videoUrl: videoSrc,
        posterSrc,
        posterUrl: posterSrc,
      },
    };
  };

  if (Array.isArray(pageBlocks)) return pageBlocks.map(normalizeBlock);
  if (!pageBlocks || typeof pageBlocks !== "object") return {};

  return Object.fromEntries(
    Object.entries(pageBlocks).map(([pageName, blocks]) => [
      pageName,
      Array.isArray(blocks) ? blocks.map(normalizeBlock) : blocks,
    ])
  );
}

export function resolveWebsiteDomain(record) {
  const customDomain = normalizeDomain(record?.custom_domain);
  if (customDomain) return customDomain;
  return normalizeDomain(record?.primary_domain);
}

export function createPublicationPayload(project = {}) {
  const fallbackSlug = slugifyWebsiteValue(project.slug || project.name || project.id || "site");
  const slug = fallbackSlug || `site-${Date.now()}`;
  const primaryDomain = buildDefaultSiteDomain(slug);
  const pageBlocks = normalizeVideoHeroBlocks(project?.pageBlocks && typeof project.pageBlocks === "object" ? project.pageBlocks : {});
  const globalNavBlock = project?.globalNavBlock || null;
  const globalFooterBlock = project?.globalFooterBlock || null;
  const siteData = {
    id: safeTrim(project.id),
    name: safeTrim(project.name) || "Untitled Website",
    status: safeTrim(project.status) || "draft",
    pages: Array.isArray(project.pages) ? project.pages : [],
    pageBlocks,
    pagesContent: project?.pagesContent && typeof project.pagesContent === "object" ? project.pagesContent : {},
    globalNavBlock: globalNavBlock?.type === "video-hero" ? normalizeVideoHeroBlocks([globalNavBlock])[0] : globalNavBlock,
    globalFooterBlock: globalFooterBlock?.type === "video-hero" ? normalizeVideoHeroBlocks([globalFooterBlock])[0] : globalFooterBlock,
    brandAssets: normalizeWebsiteBuilderAssets(project?.brandAssets),
    stylePack: safeTrim(project.stylePack) || "executive",
    buildType: safeTrim(project.buildType) || "website",
    templateSlug: safeTrim(project.templateSlug),
    updatedAt: safeTrim(project.updatedAt) || new Date().toISOString(),
  };
  const assetValidationReport = validatePublishedAssetUrls(siteData);

  return {
    slug,
    name: safeTrim(project.name) || "Untitled Website",
    primary_domain: primaryDomain,
    site_data: {
      ...siteData,
      publication: {
        assetValidationReport,
      },
    },
  };
}

export function isReservedHost(hostname) {
  const host = normalizeDomain(hostname);
  const appHost = getAppHost();
  const publishHost = getPublishHost();
  const rootDomain = getSiteRootDomain();
  const reservedAppSubdomain = rootDomain ? `app.${rootDomain}` : "";
  return !host
    || host === "localhost"
    || host === "127.0.0.1"
    || host === appHost
    || host === publishHost
    || host === rootDomain
    || host === reservedAppSubdomain
    || host.startsWith("www.")
    || host.endsWith(".vercel.app");
}

export function isLikelyCustomDomain(hostname) {
  const host = normalizeDomain(hostname);
  if (!host) return false;
  const appHost = getAppHost();
  const platformAppHost = getPlatformAppHost();
  const publishHost = getPublishHost();
  return host !== appHost
    && host !== platformAppHost
    && host !== publishHost
    && host !== "localhost"
    && host !== "127.0.0.1"
    && !host.endsWith(".vercel.app");
}

export function extractSiteSlugFromHost(hostname) {
  const host = normalizeDomain(hostname);
  const rootDomain = getSiteRootDomain();
  if (!host || !rootDomain || !host.endsWith(`.${rootDomain}`)) return "";
  return slugifyWebsiteValue(host.slice(0, -1 * (`.${rootDomain}`.length)));
}
