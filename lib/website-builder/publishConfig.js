import { isUnsafeAccordionPanelImageUrl, normalizeAccordionBlocks, resolveAccordionPanelImageUrl } from "./accordionPanels";
import { DEFAULT_FOOTER_COMPANY_LINKS, GR8_RESULT_FOOTER_NAVIGATION_LINKS, buildFooterNavigationContext, footerBlockToGlobalFooter, globalFooterToFooterBlock, normalizeFooterNavigationBlock } from "./footerNavigation";
import { getAssetFromLibrary, normalizeWebsiteBuilderAssets } from "./mediaAssets";
import { normalizeVideoHeroBlock as normalizeVideoHeroForPersistence, resolveVideoHeroUrl } from "./videoHero";

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

export function resolveProjectCustomDomain(project = {}) {
  return normalizeDomain(
    project?.customDomain
    || project?.custom_domain
    || project?.publication?.customDomain
    || project?.publication?.custom_domain
    || ""
  );
}

export function resolveProjectSlug(project = {}, fallback = "site") {
  return slugifyWebsiteValue(project?.slug || project?.publication?.slug || fallback);
}

export function withProjectPublicationIdentity(project = {}, defaults = {}) {
  const slug = resolveProjectSlug(project, defaults.slug || project?.name || project?.id || "site");
  const customDomain = resolveProjectCustomDomain(project) || normalizeDomain(defaults.customDomain);
  const defaultPrimaryDomain = normalizeDomain(defaults.primaryDomain);
  const primaryDomain = normalizeDomain(
    customDomain
      ? (defaultPrimaryDomain || customDomain)
      : (
          project?.primaryDomain
          || project?.primary_domain
          || project?.publication?.primaryDomain
          || project?.publication?.primary_domain
          || defaultPrimaryDomain
          || ""
        )
  );
  const publication = project?.publication && typeof project.publication === "object" ? project.publication : {};

  return {
    ...project,
    slug,
    customDomain,
    custom_domain: customDomain,
    primaryDomain,
    primary_domain: primaryDomain,
    publication: {
      ...publication,
      slug,
      customDomain,
      custom_domain: customDomain,
      primaryDomain,
      primary_domain: primaryDomain,
    },
  };
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
  if (raw === "__WB_PRESERVE_DATA_URL__") return "";
  if (!raw || /^(blob:|file:)/i.test(raw)) return "";
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i.test(raw)) return "";
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
  "imageSrc",
  "desktopImage",
  "mobileImage",
  "src",
  "image",
  "source",
  "iconImage",
  "backgroundImage",
  "backgroundVideo",
  "desktopVideo",
  "mobileVideo",
  "uploadedVideo",
  "floatingImage",
  "rightImage",
  "leftImage",
  "heroImage",
  "thumbnailUrl",
  "videoSrc",
  "videoUrl",
  "video",
  "posterSrc",
  "posterUrl",
]);

function classifyPublishedAssetUrl(value) {
  const raw = safeTrim(value);
  if (!raw) return null;
  if (/^blob:/i.test(raw)) return "blob";
  if (/^file:/i.test(raw)) return "invalid";
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i.test(raw)) return "localhost";
  if (/^https?:\/\//i.test(raw)) {
    if (/\/storage\/v1\/object\/sign\//i.test(raw)) return "signed-storage";
    if (/\/storage\/v1\/object\/authenticated\//i.test(raw)) return "private-storage";
    return null;
  }
  if (/^\/\//.test(raw)) return null;
  if (raw === "__WB_PRESERVE_DATA_URL__") return "invalid";
  if (/^data:image\//i.test(raw)) return "data";
  if (/^data:/i.test(raw)) return "invalid";
  if (/^\/storage\/v1\/object\/sign\//i.test(raw)) return "signed-storage";
  if (/^\/storage\/v1\/object\/authenticated\//i.test(raw)) return "private-storage";
  if (/^\//.test(raw)) return "relative";
  if (/\.(?:png|jpe?g|webp|gif|svg|avif|mp4|webm)(?:[?#].*)?$/i.test(raw)) return "relative";
  return null;
}

function normalizeSocialPlatformName(value = "") {
  const normalized = safeTrim(value)
    .toLowerCase()
    .replace(/&amp;/g, "and")
    .replace(/<[^>]+>/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!normalized) return "";
  if (/\bfacebook\b|\bfb\b/.test(normalized)) return "facebook-file";
  if (/\binstagram\b|\binsta\b/.test(normalized)) return "instagram-file";
  if (/\blinkedin\b|\blinked in\b/.test(normalized)) return "linkedin-file";
  if (/\bpinterest\b/.test(normalized)) return "pinterest-file";
  if (/\btiktok\b|\btik tok\b/.test(normalized)) return "tiktok-file";
  if (/\byoutube\b|\byou tube\b/.test(normalized)) return "youtube-file";
  if (normalized === "x" || /\btwitter\b|\bx twitter\b/.test(normalized)) return "x-file";
  return "";
}

function iconNameFromSocialIconUrl(value = "") {
  const raw = safeTrim(value).toLowerCase();
  const match = raw.match(/(?:^|\/)(facebook|instagram|linkedin|pinterest|tiktok|youtube|x|twitter)\.(?:svg|png|webp|jpe?g)(?:[?#].*)?$/);
  if (!match) return "";
  return match[1] === "twitter" ? "x-file" : `${match[1]}-file`;
}

function iconNameFromSocialIconKey(value = "") {
  const raw = safeTrim(value);
  const socialIconKeys = {
    "facebook-file": "facebook-file",
    "facebook-file-png": "facebook-file",
    "instagram-file": "instagram-file",
    "instagram-file-png": "instagram-file",
    "linkedin-file": "linkedin-file",
    "linkedin-file-png": "linkedin-file",
    "pinterest-file": "pinterest-file",
    "pinterest-file-png": "pinterest-file",
    "youtube-file": "youtube-file",
    "youtube-file-png": "youtube-file",
    "tiktok-file": "tiktok-file",
    "si-tiktok": "tiktok-file",
    "x-file": "x-file",
    "x-file-png": "x-file",
    "si-x": "x-file",
  };
  return socialIconKeys[raw] || "";
}

function isUnsafePublishedIconUrl(value = "") {
  const raw = safeTrim(value);
  if (!raw) return false;
  if (/^(blob:|file:)/i.test(raw)) return true;
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i.test(raw)) return true;
  if (/^\/(?:email-assets|imported|_next|static|tmp|temp)\//i.test(raw)) return true;
  return false;
}

function isUnsafePublishedImageUrl(value = "") {
  const raw = safeTrim(value);
  if (!raw) return false;
  if (/^(blob:|file:)/i.test(raw)) return true;
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i.test(raw)) return true;
  if (/^data:/i.test(raw)) return true;
  if (/\/storage\/v1\/object\/sign\//i.test(raw)) return true;
  return false;
}

function isAppOwnedPublicAssetPath(pathname = "") {
  return /^\/(?:assets|email-assets|imported)\//i.test(String(pathname || ""));
}

const KNOWN_PUBLISHED_ASSET_REPAIRS = new Map([
  [
    "https://bvtxfphktypdqmlnveqf.supabase.co/storage/v1/object/public/assets/35ab846e-0764-498b-b1f8-7d2cf27d85a5/web-1779254218148-ChatGPT-Image-May-20--2026--02_12_55-PM.png",
    "https://bvtxfphktypdqmlnveqf.supabase.co/storage/v1/object/public/assets/35ab846e-0764-498b-b1f8-7d2cf27d85a5/web-1779576621033-Funnels-and-leads.png",
  ],
]);

function normalizeAppOwnedPublicAssetUrl(value = "") {
  const raw = safeTrim(value);
  if (!raw) return raw;
  const repaired = KNOWN_PUBLISHED_ASSET_REPAIRS.get(raw);
  if (repaired) return repaired;
  const platformBase = getPlatformAppUrl().replace(/\/$/, "");
  if (raw.startsWith("/") && isAppOwnedPublicAssetPath(raw)) return `${platformBase}${raw}`;
  if (!/^https?:\/\//i.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (!isAppOwnedPublicAssetPath(url.pathname)) return raw;
    const platformUrl = new URL(platformBase);
    if (normalizeDomain(url.hostname) === normalizeDomain(platformUrl.hostname)) return raw;
    return `${platformBase}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return raw;
  }
}

function resolvePublishedPanelImage(panel = {}) {
  return resolveAccordionPanelImageUrl(panel);
}

function normalizePublishedAccordionPanel(panel = {}) {
  if (!panel || typeof panel !== "object" || Array.isArray(panel)) return panel;
  const imageUrl = resolvePublishedPanelImage(panel);
  const safeImageUrl = isUnsafePublishedImageUrl(imageUrl) || isUnsafeAccordionPanelImageUrl(imageUrl) ? "" : imageUrl;
  return {
    ...panel,
    imageUrl: safeImageUrl,
    image: safeImageUrl,
    useBlockImageSettings: panel.useBlockImageSettings !== false,
    imageFit: safeTrim(panel.imageFit) || "",
    imageObjectPosition: safeTrim(panel.imageObjectPosition) || "",
    imageScale: panel.imageScale === "" || panel.imageScale == null ? "" : panel.imageScale,
  };
}

function normalizePublishedAccordionImageSettings(props = {}) {
  return {
    imageFit: safeTrim(props.imageFit) || "contain",
    imageObjectPosition: safeTrim(props.imageObjectPosition) || "center center",
    imageScale: props.imageScale === "" || props.imageScale == null ? 100 : props.imageScale,
    imageMaxHeightMode: safeTrim(props.imageMaxHeightMode) || "auto",
    imageMaxHeightCustom: props.imageMaxHeightCustom === "" || props.imageMaxHeightCustom == null ? 500 : props.imageMaxHeightCustom,
    imagePadding: props.imagePadding === "" || props.imagePadding == null ? 0 : props.imagePadding,
    panelImageHeightMode: safeTrim(props.panelImageHeightMode) || "match",
    panelImageFixedHeight: props.panelImageFixedHeight === "" || props.panelImageFixedHeight == null ? 500 : props.panelImageFixedHeight,
  };
}

function normalizePublishedGridItemIcons(item = {}) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return item;
  const iconName = safeTrim(item.iconName);
  const iconImage = safeTrim(item.iconImage || item.iconUrl);
  const inferredIconName = normalizeSocialPlatformName([item.title, item.label, item.text, item.eyebrow, item.platform, item.name].filter(Boolean).join(" "))
    || iconNameFromSocialIconKey(item.iconKey)
    || iconNameFromSocialIconUrl(iconImage);
  const nextIconName = iconName || inferredIconName;
  const shouldClearIconImage = isUnsafePublishedIconUrl(iconImage);
  return {
    ...item,
    ...(nextIconName ? { iconName: nextIconName } : {}),
    ...(iconImage && !shouldClearIconImage ? { iconImage, iconUrl: iconImage } : {}),
    ...(shouldClearIconImage ? { iconImage: "", iconUrl: "", iconAssetId: "" } : {}),
  };
}

function isEmptyOrPreservedAssetValue(value) {
  const raw = safeTrim(value);
  return !raw || raw === "__WB_PRESERVE_DATA_URL__";
}

function assetFieldNameFromAssetIdKey(key = "") {
  if (key === "assetId") return "src";
  if (!key.endsWith("AssetId")) return "";
  return key.slice(0, -"AssetId".length) || "src";
}

function assignResolvedAssetField(target, fieldName, assetSrc) {
  if (!fieldName || !assetSrc) return;
  if (isEmptyOrPreservedAssetValue(target[fieldName])) target[fieldName] = assetSrc;
  if (fieldName === "image" && isEmptyOrPreservedAssetValue(target.imageUrl)) target.imageUrl = assetSrc;
  if (fieldName === "imageUrl" && isEmptyOrPreservedAssetValue(target.image)) target.image = assetSrc;
  if (fieldName === "icon" || fieldName === "iconImage" || fieldName === "iconUrl") {
    if (isEmptyOrPreservedAssetValue(target.iconImage)) target.iconImage = assetSrc;
    if (isEmptyOrPreservedAssetValue(target.iconUrl)) target.iconUrl = assetSrc;
  }
  if (fieldName === "logo" && isEmptyOrPreservedAssetValue(target.logoUrl)) target.logoUrl = assetSrc;
  if (fieldName === "logoUrl" && isEmptyOrPreservedAssetValue(target.logo)) target.logo = assetSrc;
}

function resolvePublishedAssetReferences(value, assets) {
  const normalizedAssets = normalizeWebsiteBuilderAssets(assets);
  const visit = (entry) => {
    if (Array.isArray(entry)) return entry.map(visit);
    if (!entry || typeof entry !== "object") return entry;

    const next = {};
    Object.entries(entry).forEach(([key, child]) => {
      next[key] = visit(child);
    });

    Object.entries(next).forEach(([key, child]) => {
      if (!key.endsWith("AssetId") && key !== "assetId") return;
      const asset = getAssetFromLibrary(normalizedAssets, child);
      const assetSrc = safeTrim(asset?.src);
      if (!assetSrc) return;
      assignResolvedAssetField(next, assetFieldNameFromAssetIdKey(key), assetSrc);
    });

    return next;
  };

  return visit(value);
}

function normalizePublishedAssetUrlFields(value, key = "") {
  if (Array.isArray(value)) return value.map((entry) => normalizePublishedAssetUrlFields(entry));
  if (!value || typeof value !== "object") {
    if (typeof value !== "string" || !PUBLISHED_ASSET_FIELD_NAMES.has(key)) return value;
    if (value.trim() === "__WB_PRESERVE_DATA_URL__") return "";
    return normalizeAppOwnedPublicAssetUrl(value);
  }
  const next = {};
  Object.entries(value).forEach(([childKey, child]) => {
    next[childKey] = normalizePublishedAssetUrlFields(child, childKey);
  });
  return next;
}

function normalizePublishedBlockAssets(block, assets) {
  if (!block || typeof block !== "object") return block;
  const props = normalizePublishedAssetUrlFields(resolvePublishedAssetReferences(block.props && typeof block.props === "object" ? block.props : {}, assets));
  const nextProps = { ...props };
  if (Array.isArray(nextProps.items)) {
    nextProps.items = nextProps.items.map(normalizePublishedGridItemIcons);
  }
  if (["scroll-stack", "feature-accordion", "side-scroll-accordion"].includes(String(block.type || ""))) {
    Object.assign(nextProps, normalizePublishedAccordionImageSettings(nextProps));
    if (Array.isArray(nextProps.panels)) {
      nextProps.panels = nextProps.panels.map(normalizePublishedAccordionPanel);
    }
    if (Array.isArray(nextProps.items)) {
      nextProps.items = nextProps.items.map((item) => normalizePublishedAccordionPanel(item));
    }
  }
  return { ...block, props: nextProps };
}

export function validatePublishedAssetUrls(siteData = {}) {
  const report = {
    generatedAt: new Date().toISOString(),
    invalidImageUrls: [],
    dataUrls: [],
    localhostUrls: [],
    blobUrls: [],
    signedStorageUrls: [],
    privateStorageUrls: [],
    relativeAssetUrls: [],
    missingPublicAssets: [],
    duplicateFallbackSubstitutions: [],
    invalidAssets: [],
  };

  function add(kind, path, value) {
    const entry = { path, value: safeTrim(value) };
    const typeByKind = {
      blob: "blob-asset-url",
      localhost: "localhost-asset-url",
      "signed-storage": "signed-storage-asset-url",
      "private-storage": "private-storage-asset-url",
      relative: "relative-asset-url",
      data: "inline-data-asset-url",
      invalid: "invalid-asset-url",
    };
    report.invalidAssets.push({ type: typeByKind[kind] || "invalid-asset-url", ...entry });
    if (kind === "blob") report.blobUrls.push(entry);
    else if (kind === "localhost") report.localhostUrls.push(entry);
    else if (kind === "signed-storage") report.signedStorageUrls.push(entry);
    else if (kind === "private-storage") report.privateStorageUrls.push(entry);
    else if (kind === "relative") report.relativeAssetUrls.push(entry);
    else if (kind === "data") report.dataUrls.push(entry);
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
    dataUrls: report.dataUrls.length,
    localhostUrls: report.localhostUrls.length,
    blobUrls: report.blobUrls.length,
    signedStorageUrls: report.signedStorageUrls.length,
    privateStorageUrls: report.privateStorageUrls.length,
    relativeAssetUrls: report.relativeAssetUrls.length,
    missingPublicAssets: report.missingPublicAssets.length,
    duplicateFallbackSubstitutions: report.duplicateFallbackSubstitutions.length,
    invalidAssets: report.invalidAssets.length,
  };
  return report;
}

export function getPublishedAssetValidationFailures(report = {}) {
  if (Array.isArray(report.invalidAssets) && report.invalidAssets.length) {
    return report.invalidAssets;
  }
  return [
    ...(Array.isArray(report.invalidImageUrls) ? report.invalidImageUrls.map((entry) => ({ type: "invalid-asset-url", ...entry })) : []),
    ...(Array.isArray(report.localhostUrls) ? report.localhostUrls.map((entry) => ({ type: "localhost-asset-url", ...entry })) : []),
    ...(Array.isArray(report.blobUrls) ? report.blobUrls.map((entry) => ({ type: "blob-asset-url", ...entry })) : []),
    ...(Array.isArray(report.signedStorageUrls) ? report.signedStorageUrls.map((entry) => ({ type: "signed-storage-asset-url", ...entry })) : []),
    ...(Array.isArray(report.privateStorageUrls) ? report.privateStorageUrls.map((entry) => ({ type: "private-storage-asset-url", ...entry })) : []),
    ...(Array.isArray(report.relativeAssetUrls) ? report.relativeAssetUrls.map((entry) => ({ type: "relative-asset-url", ...entry })) : []),
    ...(Array.isArray(report.dataUrls) ? report.dataUrls.map((entry) => ({ type: "inline-data-asset-url", ...entry })) : []),
    ...(Array.isArray(report.missingPublicAssets) ? report.missingPublicAssets.map((entry) => ({ type: "missing-public-asset", ...entry })) : []),
  ];
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
        videoSrc: safeTrim(resolveVideoHeroUrl(props)),
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

export function normalizeVideoHeroBlocks(pageBlocks = {}, assets = null) {
  const normalizeBlock = (block) => {
    if (!block || typeof block !== "object" || String(block.type || "") !== "video-hero") return block;
    block = normalizeVideoHeroForPersistence({
      ...block,
      props: resolvePublishedAssetReferences(block.props || {}, assets),
    });
    const props = block.props || {};
    const videoSrc = normalizePublishedMediaUrl(resolveVideoHeroUrl(props));
    const posterSrc = normalizePublishedMediaUrl(props.posterSrc || props.posterUrl || props.posterURL || "");
    const {
      video,
      videoSrc: legacyVideoSrc,
      videoURL,
      mediaUrl,
      src,
      source,
      desktopVideo,
      backgroundVideo,
      uploadedVideo,
      posterSrc: legacyPosterSrc,
      posterURL,
      ...restProps
    } = props;
    return {
      ...block,
      props: {
        ...restProps,
        videoUrl: videoSrc,
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

export function normalizePublishedWebsiteBlocks(pageBlocks = {}, footerContext = {}, assets = null) {
  const normalizeBlock = (block) => normalizePublishedBlockAssets(normalizeFooterNavigationBlock(block, footerContext), assets);
  if (Array.isArray(pageBlocks)) return normalizeAccordionBlocks(pageBlocks).map(normalizeBlock);
  if (!pageBlocks || typeof pageBlocks !== "object") return {};

  return Object.fromEntries(
    Object.entries(pageBlocks).map(([pageName, blocks]) => [
      pageName,
      Array.isArray(blocks) ? normalizeAccordionBlocks(blocks).map(normalizeBlock) : blocks,
    ])
  );
}

export function normalizePublishedGlobalFooterBlock(globalFooterBlock = null, project = {}, footerContext = {}, assets = null) {
  let normalizedGlobalFooterBlock = globalFooterBlock?.type === "video-hero"
    ? normalizeVideoHeroBlocks([globalFooterBlock], assets)[0]
    : normalizePublishedBlockAssets(normalizeFooterNavigationBlock(globalFooterBlock, footerContext), assets);
  if (safeTrim(project?.id).replace(/^draft:/, "") === "2208a52a-8175-477e-823c-fc6de7fe4afe" && normalizedGlobalFooterBlock?.type === "footer") {
    const props = normalizedGlobalFooterBlock.props || {};
    const currentNav = Array.isArray(props.navigationLinks) ? props.navigationLinks : [];
    const currentCompany = Array.isArray(props.companyLinks || props.extraLinks) ? (props.companyLinks || props.extraLinks) : [];
    normalizedGlobalFooterBlock = {
      ...normalizedGlobalFooterBlock,
      props: {
        ...props,
        navigationLinks: currentNav.length >= GR8_RESULT_FOOTER_NAVIGATION_LINKS.length ? currentNav : GR8_RESULT_FOOTER_NAVIGATION_LINKS,
        companyLinks: currentCompany.length >= DEFAULT_FOOTER_COMPANY_LINKS.length ? currentCompany : DEFAULT_FOOTER_COMPANY_LINKS,
        extraLinks: currentCompany.length >= DEFAULT_FOOTER_COMPANY_LINKS.length ? currentCompany : DEFAULT_FOOTER_COMPANY_LINKS,
        footerNavManual: true,
      },
    };
  }
  return normalizedGlobalFooterBlock;
}

function collectUrlsFromValue(value, path, entries, fieldNames) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectUrlsFromValue(item, `${path}[${index}]`, entries, fieldNames));
    return;
  }
  if (!value || typeof value !== "object") return;
  Object.entries(value).forEach(([key, childValue]) => {
    const childPath = `${path}.${key}`;
    if (typeof childValue === "string" && fieldNames.has(key) && safeTrim(childValue)) {
      entries.push({ path: childPath, field: key, url: safeTrim(childValue) });
    }
    if (childValue && typeof childValue === "object") collectUrlsFromValue(childValue, childPath, entries, fieldNames);
  });
}

export function collectWebsitePublishIntegrity(project = {}) {
  const pages = Array.isArray(project?.pages) ? project.pages : [];
  const projectAssets = normalizeWebsiteBuilderAssets(project?.brandAssets);
  const pageBlocks = normalizeVideoHeroBlocks(project?.pageBlocks && typeof project.pageBlocks === "object" ? project.pageBlocks : {}, projectAssets);
  const imageFields = new Set(["imageUrl", "image", "imageSrc", "src", "mediaUrl", "desktopImage", "backgroundImage", "iconUrl", "iconImage", "logoUrl"]);
  const videoEntries = collectVideoHeroMedia(pageBlocks).filter((entry) => safeTrim(entry.videoSrc));
  const imageEntries = [];
  const iconEntries = [];

  Object.entries(pageBlocks).forEach(([pageName, blocks]) => {
    (Array.isArray(blocks) ? blocks : []).forEach((block, index) => {
      const basePath = `pageBlocks.${pageName}[${index}]`;
      const foundImages = [];
      const propsForIntegrity = normalizePublishedAssetUrlFields(resolvePublishedAssetReferences(block?.props || {}, projectAssets));
      collectUrlsFromValue(propsForIntegrity, `${basePath}.props`, foundImages, imageFields);
      foundImages.forEach((entry) => {
        const payload = { ...entry, pageName, blockId: block?.id || "", blockType: block?.type || "" };
        if (entry.field === "iconUrl" || entry.field === "iconImage") iconEntries.push(payload);
        else imageEntries.push(payload);
      });
      if (["marquee-strip", "wave-marquee"].includes(String(block?.type || ""))) {
        const items = Array.isArray(propsForIntegrity?.items) ? propsForIntegrity.items : [];
        items.forEach((item, itemIndex) => {
          if (!item || typeof item !== "object") return;
          const hasIcon = safeTrim(item.iconName || item.iconKey || item.iconUrl || item.iconImage || item.label || item.text);
          if (hasIcon) {
            iconEntries.push({
              pageName,
              blockId: block?.id || "",
              blockType: block?.type || "",
              path: `${basePath}.props.items[${itemIndex}]`,
              field: "marqueeItem",
              url: safeTrim(item.iconUrl || item.iconImage || item.iconName || item.iconKey),
              label: safeTrim(item.label || item.text || item.title),
            });
          }
        });
      }
    });
  });

  const globalFooterBlock = project?.globalFooterBlock?.type === "footer"
    ? project.globalFooterBlock
    : globalFooterToFooterBlock(project?.globalFooter, null);
  const footerContext = buildFooterNavigationContext({ pages });
  const globalFooter = footerBlockToGlobalFooter(globalFooterBlock, footerContext) || project?.globalFooter || null;
  const navigationLinks = Array.isArray(globalFooter?.navigationLinks) ? globalFooter.navigationLinks : [];
  const companyLinks = Array.isArray(globalFooter?.companyLinks) ? globalFooter.companyLinks : [];

  return {
    pages: pages.map((page) => {
      const pageName = page?.name || "";
      const blocks = Array.isArray(pageBlocks?.[pageName]) ? pageBlocks[pageName] : [];
      return {
        id: page?.id || page?.slug || pageName,
        name: pageName,
        version: page?.version || project?.projectVersion || "",
        updatedAt: page?.updatedAt || project?.updatedAt || "",
        blockCount: blocks.length,
        blockIds: blocks.map((block) => block?.id || ""),
      };
    }),
    videos: videoEntries,
    images: imageEntries,
    icons: iconEntries,
    footer: {
      hasGlobalFooter: !!globalFooter,
      navigationCount: navigationLinks.length,
      companyCount: companyLinks.length,
      navigationLinks,
      companyLinks,
    },
  };
}

export function compareWebsitePublishIntegrity(savedProject = {}, publishSiteData = {}) {
  const saved = collectWebsitePublishIntegrity(savedProject);
  const published = collectWebsitePublishIntegrity(publishSiteData);
  const issues = [];

  const byKey = (entries) => new Map((Array.isArray(entries) ? entries : []).map((entry) => [
    `${entry.pageName}|${entry.blockId}|${entry.path}|${entry.field}`,
    entry,
  ]));
  const publishedVideos = new Map(published.videos.map((entry) => [`${entry.pageName}|${entry.id}`, entry]));
  saved.videos.forEach((entry) => {
    const match = publishedVideos.get(`${entry.pageName}|${entry.id}`);
    if (safeTrim(entry.videoSrc) && safeTrim(match?.videoSrc) !== safeTrim(entry.videoSrc)) {
      issues.push({ type: "videoUrl-removed", message: `${entry.pageName} Video Hero ${entry.id || ""} videoUrl was removed from the publish payload.`, expected: entry.videoSrc, actual: match?.videoSrc || "" });
    }
  });

  const publishedImages = byKey(published.images);
  saved.images.forEach((entry) => {
    const match = publishedImages.get(`${entry.pageName}|${entry.blockId}|${entry.path}|${entry.field}`);
    if (safeTrim(entry.url) && safeTrim(match?.url) !== safeTrim(entry.url)) {
      issues.push({ type: "imageUrl-removed", message: `${entry.pageName} ${entry.blockType} ${entry.field} was removed from the publish payload.`, expected: entry.url, actual: match?.url || "" });
    }
  });

  if (saved.icons.length && published.icons.length < saved.icons.length) {
    issues.push({ type: "icons-dropped", message: `Icon count dropped from ${saved.icons.length} to ${published.icons.length} in the publish payload.` });
  }

  if (saved.footer.navigationCount > 0 && published.footer.navigationCount < saved.footer.navigationCount) {
    issues.push({ type: "footer-navigation-dropped", message: `Footer navigation count dropped from ${saved.footer.navigationCount} to ${published.footer.navigationCount}.` });
  }

  saved.pages.forEach((page) => {
    const match = published.pages.find((entry) => entry.name === page.name || entry.id === page.id);
    if (match && page.blockCount !== match.blockCount) {
      issues.push({ type: "page-block-count-changed", message: `${page.name} block count changed from ${page.blockCount} to ${match.blockCount} in the publish payload.` });
    }
  });

  return { ok: issues.length === 0, issues, saved, published };
}

export function resolveWebsiteDomain(record) {
  const customDomain = normalizeDomain(record?.custom_domain);
  if (customDomain) return customDomain;
  return normalizeDomain(record?.primary_domain);
}

export function createPublicationPayload(project = {}) {
  project = withProjectPublicationIdentity(project);
  const fallbackSlug = slugifyWebsiteValue(project.slug || project.name || project.id || "site");
  const slug = fallbackSlug || `site-${Date.now()}`;
  const primaryDomain = buildDefaultSiteDomain(slug);
  const footerContext = buildFooterNavigationContext({ pages: project?.pages, logInvalid: true });
  const publishedAssets = normalizeWebsiteBuilderAssets(project?.brandAssets);
  const pageBlocks = normalizePublishedWebsiteBlocks(normalizeVideoHeroBlocks(project?.pageBlocks && typeof project.pageBlocks === "object" ? project.pageBlocks : {}, publishedAssets), footerContext, publishedAssets);
  const globalNavBlock = project?.globalNavBlock || null;
  const globalFooterBlock = project?.globalFooterBlock || globalFooterToFooterBlock(project?.globalFooter, null) || null;
  const normalizedGlobalNavBlock = globalNavBlock?.type === "video-hero" ? normalizeVideoHeroBlocks([globalNavBlock], publishedAssets)[0] : normalizePublishedBlockAssets(globalNavBlock, publishedAssets);
  const normalizedGlobalFooterBlock = normalizePublishedGlobalFooterBlock(globalFooterBlock, project, footerContext, publishedAssets);
  const siteData = {
    id: safeTrim(project.id),
    name: safeTrim(project.name) || "Untitled Website",
    status: safeTrim(project.status) || "draft",
    slug,
    customDomain: resolveProjectCustomDomain(project),
    custom_domain: resolveProjectCustomDomain(project),
    primaryDomain: project.primaryDomain || project.primary_domain || primaryDomain || "",
    primary_domain: project.primary_domain || project.primaryDomain || primaryDomain || "",
    pages: Array.isArray(project.pages) ? project.pages : [],
    pageBlocks,
    pagesContent: project?.pagesContent && typeof project.pagesContent === "object" ? project.pagesContent : {},
    globalNavBlock: normalizedGlobalNavBlock,
    globalFooterBlock: normalizedGlobalFooterBlock,
    globalFooter: footerBlockToGlobalFooter(normalizedGlobalFooterBlock, footerContext) || project?.globalFooter || null,
    brandAssets: publishedAssets,
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
