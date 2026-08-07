const IMAGE_URL_KEYS = [
  "imageUrl",
  "imageSrc",
  "image",
  "src",
  "mediaUrl",
  "assetUrl",
  "url",
  "backgroundImage",
  "backgroundImageUrl",
  "desktopImage",
  "mobileImage",
  "floatingImage",
  "logo",
  "logoUrl",
  "iconImage",
  "iconUrl",
  "avatar",
  "avatarUrl",
  "thumbnail",
  "poster",
];

function safeTrim(value) {
  return String(value || "").trim();
}

function platformAssetBaseUrl() {
  return safeTrim(
    process.env.NEXT_PUBLIC_PLATFORM_APP_URL
    || process.env.NEXT_PUBLIC_BASE_URL
    || "https://app.gr8result.digital"
  ).replace(/\/$/, "");
}

function isAppOwnedPublicAssetPath(pathname = "") {
  return /^\/(?:assets|email-assets|imported)\//i.test(String(pathname || ""));
}

export function normalizeRenderableImageUrl(value, platformBase = platformAssetBaseUrl()) {
  const raw = safeTrim(value);
  if (!raw || /^(blob:|file:)/i.test(raw)) return "";
  const base = safeTrim(platformBase).replace(/\/$/, "") || "https://app.gr8result.digital";

  if (raw.startsWith("/") && isAppOwnedPublicAssetPath(raw)) {
    return `${base}${raw}`;
  }

  if (!/^https?:\/\//i.test(raw)) return raw;

  try {
    const url = new URL(raw);
    if (!isAppOwnedPublicAssetPath(url.pathname)) return raw;
    const baseUrl = new URL(base);
    if (url.hostname === baseUrl.hostname) return raw;
    return `${base}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return raw;
  }
}

const BLOCK_IMAGE_PRIORITY = {
  hero: ["backgroundImage", "backgroundImageUrl", "imageUrl", "image", "mediaUrl", "src", "floatingImage"],
  parallax: ["backgroundImage", "backgroundImageUrl", "imageUrl", "image", "mediaUrl", "src"],
  image: ["src", "imageUrl", "imageSrc", "image", "mediaUrl", "assetUrl", "url"],
  "image-stack": ["src", "imageUrl", "imageSrc", "image", "mediaUrl", "assetUrl", "url"],
  "feature-list": ["imageUrl", "image", "imageSrc", "iconImage", "iconUrl", "mediaUrl", "src"],
  testimonial: ["avatarUrl", "avatar", "imageUrl", "image", "src"],
  team: ["avatarUrl", "avatar", "imageUrl", "image", "src"],
  default: IMAGE_URL_KEYS,
};

function getAssetSrc(assets, assetId) {
  if (!assetId || !assets) return "";
  const asset = Array.isArray(assets)
    ? assets.find((item) => String(item?.id || "") === String(assetId))
    : [
        assets.logo,
        ...(Array.isArray(assets.images) ? assets.images : []),
        ...(Array.isArray(assets.videos) ? assets.videos : []),
      ].filter(Boolean).find((item) => String(item?.id || "") === String(assetId));
  return String(asset?.src || asset?.url || "").trim();
}

export function isRenderableImageUrl(value) {
  const url = String(value || "").trim();
  if (!url) return false;
  if (/^(https?:|data:image\/)/i.test(url)) return true;
  if (url.startsWith("/")) return true;
  return false;
}

export function resolveImageUrlFromValue(value, assets, options = {}) {
  if (!value) return "";
  if (typeof value === "string") return isRenderableImageUrl(value) ? normalizeRenderableImageUrl(value, options.platformBase) : "";
  if (typeof value !== "object") return "";

  const assetSrc = getAssetSrc(assets, value.assetId || value.imageAssetId || value.backgroundImageAssetId || value.avatarAssetId);
  if (assetSrc) return normalizeRenderableImageUrl(assetSrc, options.platformBase);

  for (const key of IMAGE_URL_KEYS) {
    const candidate = resolveImageUrlFromValue(value[key], assets, options);
    if (candidate) return candidate;
  }

  return "";
}

export function resolveBlockImageUrl(blockOrProps, options = {}) {
  const assets = options.assets;
  const blockType = String(options.blockType || blockOrProps?.type || "").trim();
  const props = blockOrProps?.props && typeof blockOrProps.props === "object" ? blockOrProps.props : blockOrProps || {};

  const explicitAssetSrc = getAssetSrc(assets, props.assetId || props.imageAssetId || props.backgroundImageAssetId || props.avatarAssetId);
  if (explicitAssetSrc) return normalizeRenderableImageUrl(explicitAssetSrc, options.platformBase);

  const priority = BLOCK_IMAGE_PRIORITY[blockType] || BLOCK_IMAGE_PRIORITY.default;
  for (const key of priority) {
    const candidate = resolveImageUrlFromValue(props[key], assets, options);
    if (candidate) return candidate;
  }

  return "";
}

export function resolveLayerImageUrl(layer, assets, options = {}) {
  const assetSrc = getAssetSrc(assets, layer?.assetId || layer?.imageAssetId);
  return assetSrc
    ? normalizeRenderableImageUrl(assetSrc, options.platformBase)
    : resolveImageUrlFromValue(layer, assets, options);
}
