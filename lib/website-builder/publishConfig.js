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
  return safeTrim(process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_BASE_URL || "https://www.gr8result.com");
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

export function resolveWebsiteDomain(record) {
  const customDomain = normalizeDomain(record?.custom_domain);
  if (customDomain) return customDomain;
  return normalizeDomain(record?.primary_domain);
}

export function createPublicationPayload(project = {}) {
  const fallbackSlug = slugifyWebsiteValue(project.slug || project.name || project.id || "site");
  const slug = fallbackSlug || `site-${Date.now()}`;
  const primaryDomain = buildDefaultSiteDomain(slug);

  return {
    slug,
    name: safeTrim(project.name) || "Untitled Website",
    primary_domain: primaryDomain,
    site_data: {
      id: safeTrim(project.id),
      name: safeTrim(project.name) || "Untitled Website",
      status: safeTrim(project.status) || "draft",
      pages: Array.isArray(project.pages) ? project.pages : [],
      pageBlocks: project?.pageBlocks && typeof project.pageBlocks === "object" ? project.pageBlocks : {},
      pagesContent: project?.pagesContent && typeof project.pagesContent === "object" ? project.pagesContent : {},
      globalNavBlock: project?.globalNavBlock || null,
      globalFooterBlock: project?.globalFooterBlock || null,
      brandAssets: normalizeWebsiteBuilderAssets(project?.brandAssets),
      stylePack: safeTrim(project.stylePack) || "executive",
      buildType: safeTrim(project.buildType) || "website",
      templateSlug: safeTrim(project.templateSlug),
      updatedAt: safeTrim(project.updatedAt) || new Date().toISOString(),
    },
  };
}

export function isReservedHost(hostname) {
  const host = normalizeDomain(hostname);
  const appHost = getAppHost();
  const rootDomain = getSiteRootDomain();
  return !host
    || host === "localhost"
    || host === "127.0.0.1"
    || host === appHost
    || host === rootDomain
    || host.startsWith("www.")
    || host.endsWith(".vercel.app");
}

export function isLikelyCustomDomain(hostname) {
  const host = normalizeDomain(hostname);
  const rootDomain = getSiteRootDomain();
  if (!host || !rootDomain) return false;
  return host !== rootDomain && !host.endsWith(`.${rootDomain}`);
}

export function extractSiteSlugFromHost(hostname) {
  const host = normalizeDomain(hostname);
  const rootDomain = getSiteRootDomain();
  if (!host || !rootDomain || !host.endsWith(`.${rootDomain}`)) return "";
  return slugifyWebsiteValue(host.slice(0, -1 * (`.${rootDomain}`.length)));
}